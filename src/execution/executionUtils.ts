import { DispatchError, DispatchErrorModule, EventRecord, ExtrinsicStatus, Hash } from "@polkadot/types/interfaces"
import { BN } from "@polkadot/util/bn"
import { AssetNode } from "../core/AssetNode.ts"
import { checkAndApproveToken } from "../swaps/movr/utils/utils.ts"
import { getRelayMinimum, getSigner, isSwapExtrinsicContainer, isSwapProperties, isTransferExtrinsicContainer, isTransferInstruction, isTransferProperties, isTxDetails, trackPromise } from "../utils/utils.ts"
import { ArbExecutionResult, BalanceChange, ExtrinsicContainer, LastNode, Relay, RelayTokenBalances, SingleSwapResultData, SingleTransferResultData, SwapExtrinsicContainer, SwapProperties, SwapTxStats, TransactionState, TransferExtrinsicContainer, TransferInstruction, TransferProperties, TxDetails } from "./../types/types.ts"

import * as paraspell from '@paraspell/sdk'
import { KeyringPair } from '@polkadot/keyring/types'
import { BalanceData } from "@polkawallet/bridge"
import { getApiForNode } from "../utils/apiUtils.ts"
import { attemptQueryRelayTokenBalances, balanceChangeDisplay, getBalance, getBalanceChange, getDisplayBalance, getRelayTokenBalances, watchTokenBalance } from "./../utils/balanceUtils.ts"
import { stateSetLastNode, stateSetResultData, stateSetTracking, stateSetTransactionProperties, stateSetTransactionState } from "./../utils/globalStateUtils.ts"
import { buildInstructionSet, createAllocationPaths as createAllocationAssetPaths, getStartChainAllocationPath } from "./instructionUtils.ts"
// import {BigNumber as bn } from "bignumber.js"
import bn from 'bignumber.js'
import { Observable } from "rxjs"
import { buildAndExecuteTransferExtrinsic } from "./arbExecutor.ts"
import { createTransferResultData, getInitialBalances, getSigners, handleTransferError, processTransferEvents, setupBalanceWatch, shouldExecuteTransfer, transferUpdateStateAndFeeBook, waitForDepositEventData, waitForDestinationBalanceChange } from "./transferUtils.ts"
// import { H256 } from '@polkadot/types/primitive';
bn.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 }) // Set to max precision

function createSwapProperties(
    chopsticks: boolean, 
    address: string, 
    assetInBalance: bn,
    assetOutBalance: bn,
    swapTxContainer: SwapExtrinsicContainer
){
    let swapProperties: SwapProperties = {
        type: 'Swap',
        relay: swapTxContainer.relay,
        chopsticks: chopsticks,
        node: swapTxContainer.chain,
        paraId: swapTxContainer.chainId,
        address: address,
        assetIn: swapTxContainer.assetIn,
        assetOut: swapTxContainer.assetOut,
        assetInStartBalance: assetInBalance,
        assetOutStartBalance: assetOutBalance,
        inputAmount: swapTxContainer.assetAmountIn.toString(),
        destAssetKey: swapTxContainer.assetOut.getAssetKey()
    }
    return swapProperties
}

export function createTransferProperties(
    container: TransferExtrinsicContainer,
    chopsticks: boolean,
    startAddress: string,
    startNodeStartBalance: bn,
    destAddress: string,
    destNodeStartBalance: bn,

): TransferProperties{
    return {
        type: "Transfer",
        relay: container.relay,
        chopsticks: chopsticks,
        startAsset: container.startAsset,
        destAsset: container.destinationAsset,
        startAddress,
        startNodeStartBalance,
        destNodeStartBalance,
        destAddress,
        inputAmount: container.pathAmount,
        reserveAmount: container.transferReserveAmount,
        assetDecimals: container.startAsset.getDecimals().toString(),
        destAssetKey: container.destinationAsset.getAssetKey()
        
    }
}

export function createSwapTxStats(
    txHash: any,
    swapTxContainer: SwapExtrinsicContainer,
    tokenInBalanceChange: BalanceChange,
    tokenOutBalanceChange: BalanceChange
): SwapTxStats{
    return {
        txHash,
        chain: swapTxContainer.chain,
        assetInKey: swapTxContainer.assetIn.getAssetKey(),
        assetOutKey: swapTxContainer.assetOut.getAssetKey(),
        expectedAmountIn: swapTxContainer.assetAmountIn.toString(),
        expectedAmountOut: swapTxContainer.expectedAmountOut.toString(),
        tokenInBalanceChange,
        tokenOutBalanceChange
    }
}

// REVIEW Consolidate MOVR and GLMR into one
export async function executeSingleSwapExtrinsicMovr(
    // extrinsicObj: ExtrinsicObject,
    swapExtrinsicContainer: SwapExtrinsicContainer,
    chopsticks: boolean
): Promise<SingleSwapResultData>{

    const movrTx = swapExtrinsicContainer.extrinsic
    const relay = swapExtrinsicContainer.relay
    const chain = swapExtrinsicContainer.chain
    const api = swapExtrinsicContainer.api!
    const chainId = swapExtrinsicContainer.chainId
    const assetIn = swapExtrinsicContainer.assetIn
    const assetOut = swapExtrinsicContainer.assetOut
    const expectedAmountIn = swapExtrinsicContainer.assetAmountIn
    const expectedAmountOut = swapExtrinsicContainer.expectedAmountOut
    let blockHash = ""

    const movrBatchSwapParams = swapExtrinsicContainer.movrBatchSwapParams! // *
    const liveWallet = movrBatchSwapParams.wallet
    const batchContract = movrBatchSwapParams.batchContract
    const tokens = movrBatchSwapParams.inputTokens
    const dexes = movrBatchSwapParams.dexAddresses
    const inputTokens = movrBatchSwapParams.inputTokens
    const outputTokens = movrBatchSwapParams.outputTokens
    const movrTxInfo = {
        inputTokens: inputTokens,
        outputTokens: outputTokens,
        dexes: dexes
    }

    const batchContractAddress = await batchContract.getAddress()
    console.log(`Wallet: ${liveWallet.address} | Batch Contract: ${batchContractAddress}`)
    // let signer = await getSigner(true)

    for(let i = 0; i < tokens.length; i++){
        let tokenInput = movrBatchSwapParams.amount0Ins[i] > 0 ? movrBatchSwapParams.amount0Ins[i] : movrBatchSwapParams.amount1Ins[i]
        let approval = await checkAndApproveToken(tokens[i], liveWallet, batchContractAddress, tokenInput)
    }

    // let destinationAssetKey = JSON.stringify(assetOut.tokenData.chain.toString() + JSON.stringify(assetOut.tokenData.localId))
    const destinationAssetKey = assetOut.getAssetKey()
    let signer = await getSigner(chopsticks, false)

    //***************************
    let tokenInBalanceStart = await getBalance(relay, chopsticks, api, assetIn.asset, signer.address)
    let tokenOutBalanceStart = await getBalance(relay, chopsticks, api, assetOut.asset, signer.address)
    // ***************************

    let swapProperties: SwapProperties = createSwapProperties(
        chopsticks, 
        
        signer.address, 
        tokenInBalanceStart, 
        tokenOutBalanceStart, 
        swapExtrinsicContainer
    )
    stateSetTransactionProperties(swapProperties)
    // ******************************************************
    let unsubscribeOne: (() => void) = () => {}; 
    let unsubscribeTwo: (() => void) = () => {}; 

    let balanceObservableIn$: Observable<BalanceData> = await watchTokenBalance(relay, chainId, chopsticks, api, assetIn.asset, liveWallet.address)
    let balanceObservableOut$: Observable<BalanceData> = await watchTokenBalance(relay, chainId, chopsticks, api, assetOut.asset, liveWallet.address)
    let balancePromiseIn: Promise<BalanceChange> = getBalanceChange(balanceObservableIn$, (unsub) => {
        unsubscribeOne = unsub
    })
    let balancePromiseOut: Promise<BalanceChange> = getBalanceChange(balanceObservableOut$, (unsub) => {
        unsubscribeTwo = unsub
    })

    try{
        // **************************************************************************************
        stateSetTransactionState(TransactionState.Broadcasted)
        let txReceipt = await movrTx()
        let txHash = await txReceipt.wait()
        blockHash = txHash.blockHash
        // **************************************************************************************

        let tokenInBalanceStats = await balancePromiseIn
        let tokenOutBalanceStats = await balancePromiseOut
        console.log(`EXPECTED TOKEN IN ${expectedAmountIn.toString()} || ACTUAL TOKEN IN ${JSON.stringify(tokenInBalanceStats.changeInBalance.toString())}`)
        console.log(`EXPECTED TOKEN OUT ${expectedAmountOut.toString()} || ACTUAL TOKEN OUT ${JSON.stringify(tokenOutBalanceStats.changeInBalance.toString())}`)
        let assetRegistryObject = swapExtrinsicContainer.assetNodes[swapExtrinsicContainer.assetNodes.length - 1].asset;
        // let assetRegistryObject = swapExtrinsicContainer.assetNodes[swapExtrinsicContainer.assetNodes.length - 1].assetRegistryObject;
        let lastNode: LastNode = {
            assetKey: JSON.stringify(assetRegistryObject.tokenData.chain.toString() + JSON.stringify(assetRegistryObject.tokenData.localId)),
            assetValue: balanceChangeDisplay(tokenOutBalanceStats),
            chainId: assetRegistryObject.tokenData.chain,
            assetSymbol: assetRegistryObject.tokenData.symbol
        }
        let swapSuccess = false
        if(tokenInBalanceStats.changeInBalance.abs().gt(new bn(0)) && tokenOutBalanceStats.changeInBalance.abs().gt(new bn(0))){
            swapSuccess = true
            console.log("Swap MOVR Extrinsic successful. setting last node...")
            await stateSetLastNode(lastNode)
            await stateSetTransactionState(TransactionState.Finalized)
        }

        let swapStats: SwapTxStats = createSwapTxStats(txHash, swapExtrinsicContainer, tokenInBalanceStats, tokenOutBalanceStats)

        let actualAmountIn = tokenInBalanceStats.changeInBalance.abs()
        let actualAmountOut = tokenOutBalanceStats.changeInBalance.abs()
        // logSwapTxResults(tx, logFilePath)
        
        let inputReadable = new bn(actualAmountIn).div(new bn(10).pow(assetIn.getDecimals())).toString()
        let outputReadable = new bn(actualAmountOut).div(new bn(10).pow(assetOut.getDecimals())).toString()
        
        let arbResultString: ArbExecutionResult = {
            assetSymbolIn: assetIn.getAssetSymbol(),
            assetSymbolOut: assetOut.getAssetSymbol(),
            assetAmountIn: inputReadable,
            assetAmountOut: outputReadable,
            blockHash : blockHash,
            result: `SUCCESS: ${true} - SWAP: (${chain}) ${chainId} ${assetIn.getAssetSymbol()} ${actualAmountIn}-> ${assetOut.getAssetSymbol()} ${actualAmountOut}| Dexes: ${JSON.stringify(dexes)}`
        }
        let txDetails: TxDetails = {
            success: swapSuccess,
            txHash: txHash,
            movrInfo: movrTxInfo
        }
        let swapTxResult = {
            txString: `(${chain}) ${chainId} ${assetIn.getAssetSymbol()} -> ${assetOut.getAssetSymbol()}`,
            txDetails: txDetails
        }


        

        let swapResultData: SingleSwapResultData = {
            success: swapSuccess,
            arbExecutionResult: arbResultString,
            swapTxStats: swapStats,
            swapTxResults: swapTxResult,
            lastNode: lastNode,
        }
        await stateSetResultData(swapResultData)
        return swapResultData
    } catch(e){
        if (unsubscribeOne) unsubscribeOne();
        if (unsubscribeTwo) unsubscribeTwo();
        console.log("ERROR: " + e)
        console.log("MOVR swap failed")
        let txDetails: TxDetails = {
            success: false,
            movrInfo: movrTxInfo
        }
        let swapTxResult = {
            txString: `(${chain}) ${chainId} ${assetIn.getAssetSymbol()} -> ${assetOut.getAssetSymbol()}`,
            txDetails: txDetails
        }
        let inputReadable = getDisplayBalance(expectedAmountIn, assetIn.getDecimals())
        let arbResultString: ArbExecutionResult = {
            assetSymbolIn: assetIn.getAssetSymbol(),
            assetSymbolOut: assetOut.getAssetSymbol(),
            assetAmountIn: inputReadable,
            assetAmountOut: "0",
            blockHash: blockHash,
            result: `SUCCESS: ${false} - SWAP: (${chain}) ${chainId} ${assetIn.getAssetSymbol()} ${expectedAmountIn} -> ${assetOut.getAssetSymbol()} | Dexes: ${JSON.stringify(dexes)}`
        }

        let swapResultData: SingleSwapResultData = {
            success: false,
            arbExecutionResult: arbResultString,
            swapTxStats: null,
            swapTxResults: swapTxResult,
            lastNode: null,
        }

        await stateSetResultData(swapResultData)

        return swapResultData
    }
}
// REVIEW Consolidate MOVR and GLMR into one
export async function executeSingleSwapExtrinsicGlmr(
    swapExtrinsicContainer: SwapExtrinsicContainer, 
    chopsticks: boolean
): Promise<SingleSwapResultData>{
    if (!swapExtrinsicContainer) throw new Error("Evm swap tx container undefined")
    const glmrTx = swapExtrinsicContainer.extrinsic
    const relay = swapExtrinsicContainer.relay
    const chain = swapExtrinsicContainer.chain
    const api = swapExtrinsicContainer.api!
    const chainId = swapExtrinsicContainer.chainId
    const assetIn = swapExtrinsicContainer.assetIn;
    const assetOut = swapExtrinsicContainer.assetOut
    const expectedAmountIn = swapExtrinsicContainer.assetAmountIn
    const expectedAmountOut = swapExtrinsicContainer.expectedAmountOut
    let blockHash = ""

    const managerSwapParams = swapExtrinsicContainer.glmrSwapParams! // *
    let inputTokens: string[] = []
    let outputTokens: string[] = [] 
    let dexes: string[] = []
    console.log("Manager Swap Params: " + JSON.stringify(managerSwapParams, null, 2))
    managerSwapParams.forEach((swap) => {
        inputTokens.push(swap.inputToken)
        outputTokens.push(swap.outputToken)
        dexes.push(swap.dexAddress)
    })
    let glmrTxInfo = {
        inputTokens: inputTokens,
        outputTokens: outputTokens,
        dexes: dexes
    }

    //  *** Set transaction properties for state tracking ***
    let signer = await getSigner(chopsticks, true)
    let tokenInBalanceStart = await getBalance(relay, chopsticks, api, assetIn.asset, signer.address)
    let tokenOutBalanceStart = await getBalance(relay, chopsticks, api, assetOut.asset, signer.address)
    
    let swapProperties: SwapProperties = createSwapProperties(chopsticks, signer.address, tokenInBalanceStart, tokenOutBalanceStart, swapExtrinsicContainer)
    stateSetTransactionProperties(swapProperties)
    // ******************************************************
    let unsubscribeOne: (() => void) = () => {}; 
    let unsubscribeTwo: (() => void) = () => {}; 
    let balanceObservableIn$ = await watchTokenBalance(relay, chainId, chopsticks, api, assetIn.asset, signer.address)
    let balanceObservableOut$ = await watchTokenBalance(relay, chainId, chopsticks, api, assetOut.asset, signer.address)
    let balancePromiseIn = getBalanceChange(balanceObservableIn$, (unsub) => {
        unsubscribeOne = unsub
    })
    let balancePromiseOut = getBalanceChange(balanceObservableOut$, (unsub) => {
        unsubscribeTwo = unsub
    })

    try{
        // **************************************************************************************
        stateSetTransactionState(TransactionState.Broadcasted)
        console.log("Broadcasting GLMR swap...")
        let txReceipt = await glmrTx()
        console.log("GLMR swap tx receipt: " + JSON.stringify(txReceipt))
        let txHash = await txReceipt.wait()
        blockHash = txHash.blockHash
        // **************************************************************************************

        let tokenInBalanceStats = await balancePromiseIn
        let tokenOutBalanceStats = await balancePromiseOut
        console.log(`EXPECTED TOKEN IN ${expectedAmountIn.toString()} || ACTUAL TOKEN IN ${JSON.stringify(tokenInBalanceStats.changeInBalance.toString())}`)
        console.log(`EXPECTED TOKEN OUT ${expectedAmountOut.toString()} || ACTUAL TOKEN OUT ${JSON.stringify(tokenOutBalanceStats.changeInBalance.toString())}`)
        let lastNode: LastNode = {
            assetKey: assetOut.getAssetKey(),
            assetValue: balanceChangeDisplay(tokenOutBalanceStats),
            chainId: chainId,
            assetSymbol: assetOut.getAssetSymbol()
        }
        let swapSuccess = false
        if(tokenInBalanceStats.changeInBalance.abs().gt(new bn(0)) && tokenOutBalanceStats.changeInBalance.abs().gt(new bn(0))){
            swapSuccess = true
            console.log("Swap MOVR Extrinsic successful. setting last node...")
            await stateSetLastNode(lastNode)
            await stateSetTransactionState(TransactionState.Finalized)
        }

        let swapStats: SwapTxStats = createSwapTxStats(txHash, swapExtrinsicContainer, tokenInBalanceStats, tokenOutBalanceStats)

        let actualAmountIn = tokenInBalanceStats.changeInBalance.abs()
        let actualAmountOut = tokenOutBalanceStats.changeInBalance.abs()
        let inputReadable = new bn(actualAmountIn).div(new bn(10).pow(assetIn.getDecimals())).toString()
        let outputReadable = new bn(actualAmountOut).div(new bn(10).pow(assetOut.getDecimals())).toString()
        // logSwapTxResults(tx, logFilePath)
        let arbResultString: ArbExecutionResult = {
            assetSymbolIn: assetIn.getAssetSymbol(),
            assetSymbolOut: assetOut.getAssetSymbol(),
            assetAmountIn: inputReadable,
            assetAmountOut: outputReadable,
            blockHash : blockHash,
            result: `SUCCESS: ${true} - SWAP: (${chain}) ${chainId} ${assetIn.getAssetSymbol()} ${actualAmountIn}-> ${assetOut.getAssetSymbol()} ${actualAmountOut}| Dexes: ${JSON.stringify(dexes)}`
        }
        let txDetails: TxDetails = {
            success: swapSuccess,
            txHash: txHash,
            glmrInfo: glmrTxInfo
        }
        let swapTxResult = {
            txString: `(${chain}) ${chainId} ${assetIn.getAssetSymbol()} -> ${assetOut.getAssetSymbol()}`,
            txDetails: txDetails
        }
        
        let swapResultData: SingleSwapResultData = {
            success: swapSuccess,
            arbExecutionResult: arbResultString,
            swapTxStats: swapStats,
            swapTxResults: swapTxResult,
            lastNode: lastNode,
        }
        await stateSetResultData(swapResultData)
        return swapResultData
    } catch(e){
        unsubscribeOne()
        unsubscribeTwo()
        console.log("ERROR: " + e)
        console.log("GLMR swap failed")
        let txDetails: TxDetails = {
            success: false,
            glmrInfo: glmrTxInfo
        }
        let swapTxResult = {
            txString: `(${chain}) ${chainId} ${assetIn.getAssetSymbol()} -> ${assetOut.getAssetSymbol()}`,
            txDetails: txDetails
        }
        let inputReadable = getDisplayBalance(expectedAmountIn, assetIn.getDecimals())
        // let inputReadable = new bn(expectedAmountIn.toChainData()).div(new bn(10).pow(assetIn.getDecimals())).toString()
        let arbResultString: ArbExecutionResult = {
            assetSymbolIn: assetIn.getAssetSymbol(),
            assetSymbolOut: assetOut.getAssetSymbol(),
            assetAmountIn: inputReadable,
            assetAmountOut: "0",
            blockHash: blockHash,
            result: `SUCCESS: ${false} - SWAP: (${chain}) ${chainId} ${assetIn.getAssetSymbol()} ${expectedAmountIn} -> ${assetOut.getAssetSymbol()} | Dexes: ${JSON.stringify(dexes)}`
        }

        let swapResultData: SingleSwapResultData = {
            success: false,
            arbExecutionResult: arbResultString,
            swapTxStats: null,
            swapTxResults: swapTxResult,
            lastNode: null,
        }
        await stateSetResultData(swapResultData)

        return swapResultData
    }
}



export async function executeSingleSwapExtrinsic(
    // extrinsicObj: ExtrinsicObject,
    swapTxContainer: SwapExtrinsicContainer,
    chopsticks: boolean
): Promise<SingleSwapResultData>{
    console.log("Execute Single Swap Extrinsic ()")
    // let swapTxContainer = extrinsicObj.swapExtrinsicContainer!
    const api = swapTxContainer.api!

    const relay = swapTxContainer.relay
    const chain = swapTxContainer.chain
    const chainId = swapTxContainer.chainId


    const expectedAmountIn = swapTxContainer.assetAmountIn
    const expectedAmountOut = swapTxContainer.expectedAmountOut
    let blockHash = ""

    const assetIn = swapTxContainer.assetIn
    const assetOut = swapTxContainer.assetOut

    let signer = await getSigner(chopsticks, false)
    let tokenInBalanceStart: bn = await getBalance(relay, chopsticks, api, assetIn.asset, signer.address)
    let tokenOutBalanceStart: bn = await getBalance(relay, chopsticks, api, assetOut.asset, signer.address)

    let swapProperties: SwapProperties = createSwapProperties(
        chopsticks,
        signer.address,  
        tokenInBalanceStart, 
        tokenOutBalanceStart,
        swapTxContainer
    )
    stateSetTransactionProperties(swapProperties)

    let tokenInBalance$ = await watchTokenBalance(relay, chainId, chopsticks, api, assetIn.asset, signer.address)
    let tokenOutBalance$ = await watchTokenBalance(relay, chainId, chopsticks, api,assetOut.asset, signer.address)

    let tokenInUnsub, tokenOutUnsub;
    let tokenInBalancePromise = getBalanceChange(tokenInBalance$, (unsub) => {
        tokenInUnsub = unsub
    
    })
    let tokenOutBalancePromise = getBalanceChange(tokenOutBalance$, (unsub) => {
        tokenOutUnsub = unsub   
    })
    let outTracker = trackPromise(tokenOutBalancePromise)
    let trackedTokenOutBalancePromise = outTracker.trackedPromise
    let tokenOutResolved = outTracker.isResolved
    let tokenInBalanceStats: BalanceChange,
        tokenOutBalanceStats: BalanceChange = {} as BalanceChange,
        tx: TxDetails,
        txHash;

    try{
                    
        // **************************************************************************************
        tx = await executeSwapExtrinsic(swapTxContainer, chopsticks)
        // **************************************************************************************
        txHash = tx.txHash
        blockHash = tx.blockHash!
    } catch (e) {
        //REVIEW type safety
        if(!isTxDetails(e)) throw new Error("Swap failure, unknown error type");

        let decodedError = e.decodedError
        let txDetailsResponse = e as TxDetails
        console.log("DECODED ERROR: " + JSON.stringify(decodedError, null, 2))               
        await tokenInUnsub()
        await tokenOutUnsub()
        // For now just throw if an extrinsic fails, and then execute reverse tx
        // throw new Error("Swap failed, executing reverse txs")
        // let inputReadable = getDisplayBalance(expectedAmountIn, assetIn.getDecimals())
        // let inputReadable = new bn(expectedAmountIn.toChainData()).div(new bn(10).pow(assetIn.getDecimals())).toString()
        let arbString: ArbExecutionResult = {
            assetSymbolIn: assetIn.getAssetSymbol(),
            assetSymbolOut: assetOut.getAssetSymbol(),
            assetAmountIn: getDisplayBalance(expectedAmountIn, assetIn.getDecimals()),
            assetAmountOut: "0",
            blockHash: blockHash,
            result:`FAILURE: SWAP: (${chain}) ${chainId} ${assetIn.getAssetSymbol()} ${expectedAmountIn.toNumber()}-> ${assetOut.getAssetSymbol()} | ERROR: ${JSON.stringify(decodedError)}`
        }
        
        // REVIEW how movr swap tx details work
        let txDetails: TxDetails = {
            success: false,
            movrInfo: txDetailsResponse
        }
        let swapTxResult = {
            txString: `(${chain}) ${chainId} ${assetIn.getAssetSymbol()} -> ${assetOut.getAssetSymbol()}`,
            txDetails: txDetails
        }

        let extrinsicResultData: SingleSwapResultData = {
            success: false,
            arbExecutionResult: arbString,
            swapTxStats: null,
            swapTxResults: swapTxResult,
            lastNode: null,
        }
        
        await stateSetResultData(extrinsicResultData)

        return extrinsicResultData
    }

    if(!tx.success){
        throw new Error("Swap Tx failed, but didnt throw error in catch")
    }
    console.log("() AWAIT getBalanceChange(tokenIn)")
    tokenInBalanceStats = await tokenInBalancePromise
    if(tokenInBalanceStats.changeInBalance.eq(new bn(0))){

        let tokenInBalanceEnd: bn = await getBalance(relay, chopsticks, api, assetIn.asset, signer.address)
        // let tokenInBalanceEndBn: bn = tokenInBalanceEnd.free._getInner()
        let balanceChangeAmount:bn = tokenInBalanceEnd.minus(tokenInBalanceStart).abs()
        
        tokenInBalanceStats = {
            startBalance: tokenInBalanceStart,
            endBalance: tokenInBalanceEnd,
            changeInBalance: balanceChangeAmount,
            decimals: assetIn.getDecimals()
        }
    }

    console.log("() AWAIT getBalanceChange(tokenOut)")
    let tokenOutBalanceConfirmed = false;
    let success: boolean = tx.success
    // tokenOutBalanceStats = await tokenOutBalancePromise
    while (!tokenOutBalanceConfirmed){
        if(tokenOutResolved()){
            console.log("promiseTracker tokenOut RESOLVED")
            tokenOutBalanceStats = await trackedTokenOutBalancePromise
            tokenOutBalanceConfirmed = true;
            if(!tokenOutBalanceStats.changeInBalance.gt(new bn(0))){
                success = false
            }
        } else {
            console.log("promiseTracker tokenOut NOT RESOLVED. Querying balance...")
            let tokenOutBalanceEnd: bn = await getBalance(relay, chopsticks, api, assetOut.asset, signer.address)
            let balanceChangeAmount = tokenOutBalanceStart.minus(tokenOutBalanceEnd).abs()
            if(balanceChangeAmount.gt(new bn(0))){
                console.log("balanceQuery SUCCESS")
                tokenOutBalanceConfirmed = true
                tokenOutBalanceStats = {
                    startBalance: tokenOutBalanceStart,
                    endBalance: tokenOutBalanceEnd,
                    changeInBalance: balanceChangeAmount,
                    decimals: assetOut.getDecimals()
                }
                stateSetTransactionState(TransactionState.Finalized)
                tokenOutUnsub()
            } else {
                console.log("balanceQuery FAILED. Retrying in 10 seconds...")
                await new Promise(resolve => setTimeout(resolve, 10000))
            
            }
        }
    }


    
    let lastNode: LastNode = {
        assetKey: assetOut.getAssetKey(),
        assetValue: balanceChangeDisplay(tokenOutBalanceStats),
        chainId: assetOut.getChainId(),
        assetSymbol: assetOut.getAssetSymbol()
    }
    
    if(success){
        console.log("Swap Extrinsic successful. Setting last node...")
        await stateSetLastNode(lastNode)
    }
    
    
    console.log(`EXPECTED TOKEN IN ${expectedAmountIn.toString()} || EXPECTED TOKEN OUT ${expectedAmountOut.toString()}`)
    console.log(`ACTUAL TOKEN IN ${JSON.stringify(tokenInBalanceStats.changeInBalance.toString())} || ACTUAL TOKEN OUT ${(JSON.stringify(tokenOutBalanceStats.changeInBalance.toString()))}`)

    let swapStats: SwapTxStats = createSwapTxStats(txHash, swapTxContainer, tokenInBalanceStats, tokenOutBalanceStats)

    let swapTxResult = {
        txString: `(${chain}) ${chainId} ${assetIn.getAssetSymbol()} -> ${assetOut.getAssetSymbol()}`,
        txDetails: tx
    }

    let actualAmountIn
    if(success){
        actualAmountIn = tokenInBalanceStats.changeInBalance.abs()
    } else {
        actualAmountIn = expectedAmountIn.abs()
    }
    
    let actualAmountOut = tokenOutBalanceStats.changeInBalance.abs()

    let inputReadable = new bn(actualAmountIn).div(new bn(10).pow(new bn(assetIn.getDecimals()))).toString()
    let outputReadable = new bn(actualAmountOut).div(new bn(10).pow(new bn(assetOut.getDecimals()))).toString()

    let arbResultString: ArbExecutionResult = {
        assetSymbolIn: assetIn.getAssetSymbol(),
        assetSymbolOut: assetOut.getAssetSymbol(),
        assetAmountIn: inputReadable,
        assetAmountOut: outputReadable,
        blockHash: blockHash,
        result:`SUCCESS: ${success} - SWAP: (${chain}) ${chainId} ${assetIn.getAssetSymbol()} ${actualAmountIn}-> ${assetOut.getAssetSymbol()} ${actualAmountOut} | `
    }
    
    let extrinsicResultData: SingleSwapResultData;
    if(tokenOutBalanceStats.changeInBalance.gt(new bn(0))){
        extrinsicResultData = {
            success: true,
            arbExecutionResult: arbResultString,
            swapTxStats: swapStats,
            swapTxResults: swapTxResult,
            lastNode: lastNode,
        }
        
    } else {
        extrinsicResultData = {
            success: false,
            arbExecutionResult: arbResultString,
            swapTxStats: swapStats,
            swapTxResults: swapTxResult,
            lastNode: lastNode,
        }
        
    }
    await stateSetResultData(extrinsicResultData)

    console.log(`SUCCESS: ${success} - SWAP: (${chain}) ${chainId} ${assetIn.getAssetSymbol()} ${actualAmountIn}-> ${assetOut.getAssetSymbol()} ${actualAmountOut}`)
    console.log("*******************************************************")
    return extrinsicResultData

    


}

// Only returns undefined when in testing, and skipping chains to execute transfers on.
/**
 * Execution handler for single transfer extrinsic
 * - Check if chains are active, if not skip execution
 * - Get signers for start chain and destination chain
 * - Get initial balances for start chain and destination chain
 * - Setup BalanceChange trackers for start chain and destination chain
 * - Update state.TransactionProperties
 * - Execute transfer extrinsic
 * - Process events on start chain | Initiate deposit event tracker on destination chain
 * - Wait for BalanceChange completion on start and destination chains
 * - Wait for and process deposit event tracker on destination chain
 * - Format transfer result data
 * - Update state.LastNode, state.TransactionState, state.ResultData
 * - return transfer result data
 * 
 * @param transferTxContainer 
 * @param chopsticks 
 * @returns 
 */
export async function executeSingleTransferExtrinsic(
    // extrinsicObj: ExtrinsicObject, 
    transferTxContainer: TransferExtrinsicContainer,
    chopsticks: boolean
):Promise<SingleTransferResultData | undefined>{
    console.log("Execute Single Transfer Extrinsic ()")

    const { relay, extrinsic, startAsset, startChain, startApi, destinationAsset, destinationApi, destinationChain } = transferTxContainer

    if (!shouldExecuteTransfer(chopsticks, startChain, destinationChain)) {
        console.log("Chain not supported");
        return undefined;
    }

    console.log(`Execute Extrinsic Set Loop: Start Chain: ${startChain} ${startAsset.getChainId()}| Destination Chain: ${destinationChain} ${destinationAsset.getChainId()} | Asset Symbol: ${JSON.stringify(startAsset.getAssetSymbol())} `)

    stateSetTransactionState(TransactionState.PreSubmission)

    const [startSigner, destSigner] = await getSigners(chopsticks, startChain, destinationChain);
    const [startNodeStartBalance, destNodeStartBalance] = await getInitialBalances(relay, chopsticks, transferTxContainer, startSigner, destSigner);
    
    const transferProperties: TransferProperties = createTransferProperties(transferTxContainer, chopsticks, startSigner.address, startNodeStartBalance, destSigner.address, destNodeStartBalance)
    await stateSetTransactionProperties(transferProperties);

    const { balanceChangeTracker: startBalanceChangeTracker, unsubscribe: startBalanceUnsub } = await setupBalanceWatch(relay, startAsset.asset, startApi, startSigner.address, chopsticks);
    const { balanceChangeTracker: destinationBalanceChangeTracker, unsubscribe: destBalanceUnsub } = await setupBalanceWatch(relay, destinationAsset.asset, destinationApi, destSigner.address, chopsticks);

    // Extract properties before extrinsic is executed
    const xcmTxProperties = extrinsic.toHuman() as any
    let txDetails: TxDetails;
    try {
        txDetails = await executeTransferExtrinsic(transferTxContainer, startSigner);
        
        let [startEventData, depositEventTracker] = await processTransferEvents(transferTxContainer, txDetails, xcmTxProperties, destinationBalanceChangeTracker, destSigner);
        
        const [startBalanceChangeStats, destBalanceChangeStats] = await Promise.all([
            startBalanceChangeTracker.trackedPromise,
            waitForDestinationBalanceChange(destinationBalanceChangeTracker, depositEventTracker, destNodeStartBalance, destBalanceUnsub, transferTxContainer, chopsticks,destSigner.address)
        ]);

        let [transferFeeData, depositFeeData, reserveFeeData] = await waitForDepositEventData(startEventData, depositEventTracker, transferTxContainer);

        let transferResultData: SingleTransferResultData = await createTransferResultData(transferTxContainer, startBalanceChangeStats, destBalanceChangeStats, transferFeeData, depositFeeData, txDetails);
    
        transferUpdateStateAndFeeBook(transferTxContainer, transferResultData, startEventData, startEventData, reserveFeeData, relay);

        return transferResultData
    } catch (error) {
        return handleTransferError(error, transferTxContainer, txDetails!, startBalanceUnsub, destBalanceUnsub);
    }
}


/**
 * Execute transfer extrinsic and return transaction details in a promise
 * 
 * @param transfer 
 * @param signer 
 * @param chopsticks 
 * @returns 
 */
export async function executeTransferExtrinsic(transfer: ExtrinsicContainer, signer: KeyringPair): Promise<TxDetails> {
    if(!isTransferExtrinsicContainer(transfer)) throw new Error("Not a transfer extrinsic container")

    console.log("**************************************")
    console.log(`Execute Transfer: (${transfer.startChain} -> ${transfer.destinationChain}) ${JSON.stringify(transfer.startAsset.getAssetSymbol())} ${JSON.stringify(transfer.startAsset.getLocalId())}`)
    console.log("**************************************")

    return executeXcmTransfer(transfer.extrinsic, signer)
}
export async function executeSwapExtrinsic(txContainer: ExtrinsicContainer, chopsticks: boolean): Promise<TxDetails> {
    if (!isSwapExtrinsicContainer(txContainer)) throw new Error("Not swap container")
    let signer = await getSigner(chopsticks, false);
    let relay = txContainer.relay
    //If MOVR/EVM execute smart contract call
    if(txContainer.chainId == 2023){
        throw new Error("Function: executeSwapExtrinsic() should not be called with MOVR swaps")
    } else {
        // REVIEW Why would txContainer.extrinsic every be undefined?
        if(txContainer.extrinsic){
            let tx = txContainer.extrinsic
            const txString = txContainer.txString
            let accountNonce
            if(txContainer.api){
                try{
                    let accountData = await txContainer.api.query.system.account(signer.address)
                    accountNonce = accountData.nonce.toNumber()
                } catch(e){
                    console.log("Error getting account nonce")
                }
                
            }

            console.log(`Execute Swap: Executing tx: ${txString}`)
            console.log(`Execute Swap: ACCOUNT NONCE QUERY: ${JSON.stringify(accountNonce)}`)
            console.log(JSON.stringify(tx.toHuman()))

            // let txHash = await tx.signAndSend(signer, {nonce: txNonce}, (result) => {
                
            // });
            let txResult: Promise<TxDetails> = new Promise((resolve, reject) => {
                let success = false;
                let included: EventRecord[] = [];
                let finalized: EventRecord[] = [];
                let eventLogs: any[] = [];
                let blockHash: string = "";
                let dispatchErrorCode;
                let decodedError;
                stateSetTransactionState(TransactionState.Broadcasted)
                tx.signAndSend(signer, {nonce: accountNonce}, ({ events = [], status, txHash, txIndex, dispatchError }: {
                    events?: EventRecord[],
                    status: ExtrinsicStatus,
                    txHash: Hash,
                    txIndex?: number,
                    dispatchError?: DispatchError
                }) => {
                    if (status.isInBlock) {
                        success = dispatchError ? false : true;
                        console.log(
                            `Execute Swap: 📀 Transaction ${tx.meta.name}(..) included at blockHash ${status.asInBlock} [success = ${success}]`
                        );
                        blockHash = status.asInBlock.toString();
                        included = [...events];
    
                    } else if (status.isBroadcast) {
                        console.log(`Execute Swap: 🚀 Transaction broadcasted.`);
                    } else if (status.isFinalized) {
                        success = dispatchError ? false : true;
                        console.log(
                            `Execute Swap: 💯 Transaction ${tx.meta.name}(..) Finalized at blockHash ${status.asFinalized}`
                        );
                        // blockHash = status.asFinalized.toString();
                        finalized = [...events];
                        events.forEach((eventObj) => {
                            eventLogs.push(eventObj.toHuman())
                            // REVIEW Changing check because dispatchError doesnt exist on eventObj.event.data, but we get dispatch error in the tx callback 
                            if(eventObj.event.method == "ExtrinsicFailed" && dispatchError){
                                console.log("Execute Swap: Extrinsic Failed event detected")
                                const {index, error} = dispatchError.asModule;
                                const moduleIndex = parseInt(index.toString(), 10);
                                const errorCodeHex = error.toString().substring(2, 4); // "09"
                                const errorIndex = parseInt(errorCodeHex, 16);

                                // Get the module and error metadata
                                decodedError = tx.registry.findMetaError({index: new BN(moduleIndex), error: new BN(errorIndex)});
                                dispatchErrorCode = dispatchError.asModule;
                                console.log("Execute Swap: Dispatch Error: " + dispatchError.toString())
                                console.log("Execute Swap: DECODED MODULE: " + JSON.stringify(decodedError, null, 2))
                                let txDetails: TxDetails = { success: false, dispatchError: dispatchErrorCode, decodedError, included, finalized, blockHash, eventLogs };
                                // console.log("Execute Swap: txDetails Object: " + JSON.stringify(txDetails, null, 2))
                                console.log("Rejecting SWAP Tx")
                                reject(txDetails);
                            }
                            // Check for error events for failed swaps on different chains
                            // MGX error event/ swap failure will still result in sysem.ExtrinsicSuccess
                            if(eventObj.event.method == "SellAssetFailedDueToSlippage"){
                                console.log("MGX Execute Swap: SellAssetFailedDueToSlippage")
                                let txDetails: TxDetails = { success: false, dispatchError: dispatchErrorCode, decodedError, included, finalized, blockHash, eventLogs }
                                reject(txDetails);
                            }
                        })
                        const hash = status.hash;
                        if(!success){
                            throw new Error("Dispatch Error modules found, but no error event found")
                        }
                        let txDetails: TxDetails = { success, hash, dispatchError: dispatchErrorCode, decodedError, eventLogs, blockHash, txHash, txIndex };
                        console.log("Execute Swap: Resolving SWAP tx")
                        resolve(txDetails);
                    } else if (status.isReady) {
                        // let's not be too noisy..
                    } else if (dispatchError){
                        console.log("Execute Swap: Dispatch error: " + dispatchError.toString())
                        if(dispatchError.isModule){
                            const decoded = tx.registry.findMetaError(dispatchError.asModule);
                            console.log("Execute Swap: DISPATCH ERROR DECODED: " + JSON.stringify(decoded, null, 2))
                            const { docs, name, section } = decoded;
                            console.log("Execute Swap: REJECTING SWAP TX from dispatchError")
                            let txDetails: TxDetails = { success:false, dispatchError: dispatchErrorCode, decodedError, included, finalized, blockHash, eventLogs }
                            reject(txDetails);
                        } else {
                            ("Execute Swap: REJECTING SWAP TX from dispatchError")
                            let txDetails: TxDetails = { success:false, dispatchError: dispatchErrorCode, decodedError, included, finalized, blockHash, eventLogs }
                            reject(txDetails);
                        
                        }
                    }
                    else {
                        console.log(`Execute Swap: 🤷 Other status ${status}`);
                        let txDetails: TxDetails = { success:false, dispatchError: dispatchErrorCode, decodedError, included, finalized, blockHash, eventLogs }
                        reject(txDetails)
                    }
                }).catch((error) => {
                    console.log("Execute Swap: Error: " + error);
                    let txDetails: TxDetails = { success:false, dispatchError: dispatchErrorCode, decodedError, included, finalized, blockHash, eventLogs }
                    reject(txDetails);
                });
            });

            console.log("Sent TX. Returning SWAP Tx Promise")
            return txResult
        } else {
            throw new Error("Swap tx container extrinsic is undefined")
        }

    }
    
}

// TODO Reformat this, only used once at the end of the arb execution loop to handle remaining instructions.
// // The rest of the loop uses a build function and an execute function
// export async function buildAndExecuteSwapExtrinsic(
//     relay: Relay, 
//     instructionsToExecute: SwapInstruction[], 
//     chopsticks: boolean, 
//     executeMovr: boolean, 
//     nextInputValue: string,
// ): Promise<[(SingleSwapResultData | SingleTransferResultData | undefined), SwapInstruction[]]>{
//     if(Number.parseFloat(nextInputValue) > 0){
//         instructionsToExecute[0].assetNodes[0].pathValue = nextInputValue
//     }
//     let [swapExtrinsicContainer, remainingInstructions] = await buildSwapExtrinsicDynamic(relay, instructionsToExecute, chopsticks);
//     // let extrinsicObj: ExtrinsicObject = await createSwapExtrinsicObject(swapExtrinsicContainer)
    
//     let extrinsicResultData: SingleTransferResultData | SingleSwapResultData | undefined = await executeAndReturnExtrinsic(swapExtrinsicContainer, chopsticks, executeMovr)
//     return [extrinsicResultData, remainingInstructions]
// }

// Handle different extrinsic types
export async function executeAndReturnExtrinsic(
    // extrinsicObj: ExtrinsicObject,  
    txContainer: ExtrinsicContainer,
    chopsticks: boolean, 
    executeMovr: boolean = false
): Promise<SingleTransferResultData | SingleSwapResultData | undefined>{
    // let executeMovr = false
    
    try {
        console.log("********************************")
        // if (extrinsicObj.type == "Transfer"){
        if(isTransferExtrinsicContainer(txContainer)){
            // Returns undefined on certain tests
            let transferExtrinsicResults: SingleTransferResultData | undefined = await executeSingleTransferExtrinsic(txContainer,chopsticks)
            return transferExtrinsicResults
        } else if (isSwapExtrinsicContainer(txContainer)){
            // let swapTxContainer = extrinsicObj.swapExtrinsicContainer! 
            let relay = txContainer.relay;
            let chainId = txContainer.chainId;
            if(relay == 'polkadot' && chainId != 2004 || relay == 'kusama' && chainId != 2023){
                let swapExtrinsicResults: SingleSwapResultData = await executeSingleSwapExtrinsic(txContainer, chopsticks);
                return swapExtrinsicResults
            } else if (relay == 'kusama' && chainId == 2023 && executeMovr == true ){
                let swapExtrinsicResults: SingleSwapResultData = await executeSingleSwapExtrinsicMovr(txContainer, chopsticks);
                return swapExtrinsicResults
            } else if (relay == 'polkadot' && chainId == 2004 && executeMovr == true){
                let swapExtrinsicResults: SingleSwapResultData = await executeSingleSwapExtrinsicGlmr(txContainer, chopsticks);
                return swapExtrinsicResults
            }
        } 

    } catch (e) {
        console.log(e)
        throw new Error("Extrinsic Execution failed")
    } finally {
        // Ensure APIs are disconnected here

    }
}

export async function executeTransferTx(transferExtrinsicInput: paraspell.Extrinsic, signerAccount: any){
    let txResult: Promise<TxDetails> = new Promise((resolve, reject) => {
        let success = false;
        let included: EventRecord[] = [];
        let finalized: EventRecord[] = [];
        let eventLogs: any[] = [];
        let blockHash: string = "";
        let dispatchErrorCode;
        let decodedError;
        let transferExtrinsic = transferExtrinsicInput as any
        console.log(`Execute Transfer: Sending tx -- ${JSON.stringify(transferExtrinsic.toHuman())}`)
        transferExtrinsic.signAndSend(signerAccount, ({ events = [], status, txHash, txIndex, dispatchError }: {
            events?: EventRecord[],
            status: ExtrinsicStatus,
            txHash: Hash,
            txIndex?: number,
            dispatchError?: DispatchError
        }) => {
            if (status.isInBlock) {
                success = dispatchError ? false : true;
                console.log(
                    `Execute Transfer: 📀 Transaction ${transferExtrinsic.meta.name}(..) included at blockHash ${status.asInBlock} [success = ${success}]`
                );
                included = [...events];
                blockHash = status.asInBlock.toString();

            } else if (status.isBroadcast) {
                console.log(`Execute Transfer: 🚀 Transaction broadcasted.`);
            } else if (status.isFinalized) {
                console.log(
                    `Execute Transfer: 💯 Transaction ${transferExtrinsic.meta.name}(..) Finalized at blockHash ${status.asFinalized}`
                );
                // blockHash = status.asFinalized.toString();
                finalized = [...events];
                events.forEach((eventObj) => {
                    eventLogs.push(eventObj.toHuman())
                    if(eventObj.event.method == "ExtrinsicFailed" && dispatchError){
                        console.log("Execute Transfer: Extrinsic Failed event detected")
                        const {index, error} = dispatchError.asModule;
                        const moduleIndex = parseInt(index.toString(), 10);
                        const errorCodeHex = error.toString().substring(2, 4); // "09"
                        const errorIndex = parseInt(errorCodeHex, 16);

                        // Get the module and error metadata
                        decodedError = transferExtrinsic.registry.findMetaError({index: new BN(moduleIndex), error: new BN(errorIndex)});
                        dispatchErrorCode = dispatchError.asModule;
                        console.log("Execute Transfer: Dispatch Error: " + dispatchError.toString())
                        console.log("Execute Transfer: DECODED MODULE: " + JSON.stringify(decodedError, null, 2))
                        console.log("Execute Transfer: Rejecting Transfer tx")
                        let txDetails: TxDetails = { success: false, dispatchError: dispatchErrorCode, decodedError, included, finalized, blockHash, eventLogs };
                        reject(txDetails);
                    }
                })
                const hash = status.hash;
                let txDetails: TxDetails = { success: true, hash, dispatchError: dispatchErrorCode, decodedError, included, finalized, eventLogs, blockHash, txHash, txIndex };
                console.log("Execute Transfer: Resolving Transfer tx")
                resolve(txDetails);
            } else if (status.isReady) {
                // let's not be too noisy..
                console.log("Execute Transfer: Status: Ready")
            } else if (dispatchError){
                console.log("Execute Transfer: Dispatch error: " + dispatchError.toString())
                if(dispatchError.isModule){
                    const decoded = transferExtrinsic.registry.findMetaError(dispatchError.asModule);
                    console.log("Execute Transfer: DISPATCH ERROR DECODED: " + JSON.stringify(decoded, null, 2))
                    console.log("Execute Transfer: Rejecting Transfer tx from dispatch error")
                    let txDetails: TxDetails = { success:false, dispatchError: dispatchErrorCode, decodedError, included, finalized, blockHash, eventLogs }
                    reject(txDetails);
                } else {
                    console.log("Execute Transfer: Rejecting Transfer tx from dispatch error")
                    let txDetails: TxDetails = { success:false, dispatchError: dispatchErrorCode, decodedError, included, finalized, blockHash, eventLogs }
                    reject(txDetails);
                }
            }
            else {
                console.log(`Execute Transfer: 🤷 Other status ${status}`);
            }
        }).catch((error) => {
            console.log("Execute Transfer: Error: " + error);
            reject(error);
        });
    });
    return txResult;
}


// If execution fails mid transaction, we need to confirm the last transaction was successful and set last node accordingly 
/** Confirm last transaction
 * 
 * If success, update GlobalState lastNode
 * 
 */
export async function confirmLastTransactionSuccess(lastTransactionProperties: TransferProperties | SwapProperties){
    console.log("CONFIRMING LAST TRANSACTION....")
    let transactionSuccess = false
    if(isTransferProperties(lastTransactionProperties)){
        let transferProperties = lastTransactionProperties as TransferProperties
        console.log(`transfer properties`)
        console.log(JSON.stringify(transferProperties, null, 2))
        const startAsset = new AssetNode(transferProperties.startAsset)
        const destAsset = new AssetNode(transferProperties.destAsset)
        // let assetNode = new AssetNode(startAsset, destAsset)
        const relay = transferProperties.relay
        const startApi = await getApiForNode(startAsset.chain, transferProperties.chopsticks)
        const destApi = await getApiForNode(destAsset.chain, transferProperties.chopsticks)
        const startNodeCurrentBalance: bn = await getBalance(relay, transferProperties.chopsticks, startApi, startAsset.asset, transferProperties.startAddress) 
        const destNodeCurrentBalance: bn = await getBalance(relay, transferProperties.chopsticks, destApi, destAsset.asset, transferProperties.destAddress)

        const startNodeStartBalance: bn = transferProperties.startNodeStartBalance
        const destNodeStartBalance: bn = transferProperties.destNodeStartBalance

        console.log(`Previous Balances: Start: ${startNodeStartBalance.toString()} | Dest: ${destNodeStartBalance.toString()}`)

        const startNodeBalanceChange: bn = startNodeCurrentBalance.minus(startNodeStartBalance).abs()
        const destNodeBalanceChange: bn = destNodeCurrentBalance.minus(destNodeStartBalance).abs()

        const minimumExpected = new bn(transferProperties.inputAmount, Number.parseInt(transferProperties.assetDecimals)).times(new bn(0.90))

        if(startNodeBalanceChange.gt(minimumExpected) && destNodeBalanceChange.gt(minimumExpected)){
            transactionSuccess = true
            console.log("LAST TRANSACTION (TRANSFER) WAS SUCCESSFUL")
            // REVIEW Setting last node value to chain instead of display
            const lastSuccessfulNode: LastNode = {
                assetKey: destAsset.getAssetKey(),
                assetValue: getDisplayBalance(destNodeBalanceChange, destAsset.getDecimals()),
                assetSymbol: destAsset.getAssetSymbol(),
                chainId: destAsset.getChainId()
            }
            console.log("Last Transfer Extrinsic successful. setting last node...")
            stateSetLastNode(lastSuccessfulNode)
        } else {
            console.log("LAST TRANSACTION (TRANSFER) WAS NOT SUCCESSFUL")
        }
    } else if (isSwapProperties(lastTransactionProperties)) {
        
        const swapProperties = lastTransactionProperties as SwapProperties

        const relay = swapProperties.relay
        const assetIn = swapProperties.assetIn
        const assetOut = swapProperties.assetOut
        const chain = assetIn.chain
        const chainId = assetIn.getChainId()
    
        const swapNodeApi = await getApiForNode(chain, swapProperties.chopsticks)
        const assetInCurrentBalance: bn = await getBalance(relay, swapProperties.chopsticks, swapNodeApi,  assetIn.asset, swapProperties.address)
        const assetOutCurrentBalance: bn = await getBalance(relay, swapProperties.chopsticks, swapNodeApi, assetOut.asset, swapProperties.address)

        console.log("SWAP PROPERTIES: " + JSON.stringify(swapProperties, null, 2))
        console.log("ASSET IN START BALANCE: " + JSON.stringify(swapProperties.assetInStartBalance))

        const assetInBalanceChange = swapProperties.assetInStartBalance.minus(assetInCurrentBalance).abs()
        const assetOutBalanceChange = swapProperties.assetOutStartBalance.minus(assetOutCurrentBalance).abs()

        const assetInBalanceChangeMinimum = new bn(swapProperties.inputAmount).times(new bn(0.90))

        if(assetInBalanceChange.gte(assetInBalanceChangeMinimum) && assetOutBalanceChange.gt(new bn(0))){
            transactionSuccess = true
            console.log("LAST TRANSACTION (SWAP) WAS SUCCESSFUL")
            const lastSuccessfulNode: LastNode = {
                assetKey: swapProperties.destAssetKey,
                assetValue: getDisplayBalance(assetOutBalanceChange, assetOut.getDecimals()),
                assetSymbol: assetOut.getAssetSymbol(),
                chainId: chainId
            }
            console.log("Last Swap Extrinsic successful. setting last node...")
            await stateSetLastNode(lastSuccessfulNode)
        } else {
            console.log("LAST TRANSACTION (SWAP) WAS NOT SUCCESSFUL")
        }
        
    } else {
        throw new Error("Can't properly parse transaction properties as Swap or Transfer")
    }
    return transactionSuccess
}

/**
 * Builds asset paths from each chain to relay depending on chain balance
 * 
 * Use each asset path to build a TransferInstruction
 * 
 * Build and execute each TransferInstruction (Asynchronously)
 * 
 * @param relay 
 * @param chopsticks 
 * @param executeMovr 
 * @param nativeBalances 
 * @param startChainId 
 * @returns 
 */
export async function collectRelayToken(relay: Relay, chopsticks: boolean, executeMovr: boolean, nativeBalances: RelayTokenBalances, startChainId: number){
    let assetPaths: AssetNode[][] = await createAllocationAssetPaths(relay,  nativeBalances, startChainId)
    let transferInstructions: TransferInstruction[] = assetPaths.map((path) => {
        const instructionSet: TransferInstruction[] = buildInstructionSet(relay, path).map((instruction) => {
            if(!isTransferInstruction(instruction)) throw new Error('Allocation instruction error')
                return instruction
        })
        // Build instruction set. Allocations will only be one istruction
        return instructionSet[0]
    })

    console.log("Executing allocations from chains to Kusama")

    // Turn tracking off because this is done asyncronously
    stateSetTracking(false)

    let allTransferResultsPromise: Promise<SingleTransferResultData>[] = transferInstructions.map(async (transferInstruction: TransferInstruction) => {
        return buildAndExecuteTransferExtrinsic(relay, transferInstruction, chopsticks, executeMovr)
    })

    let allocationExecutionResults: SingleTransferResultData[] = await Promise.all(allTransferResultsPromise)

    // Turn it back on for the rest of the execution
    stateSetTracking(true)

    allocationExecutionResults.forEach((result) => {
        console.log("ALLOCATION SUCCESS: " + result.success)
        console.log(JSON.stringify(result.arbExecutionResult, null, 2))
    })

    return allocationExecutionResults
    
}

/**
 * Collect tokens from all chains to relay
 * 
 * Modify path to allocate funds from the relay at the beginning
 * 
 * @param relay 
 * @param assetPath - AssetNode[] path to execute 
 * @param startChainId 
 * @param chopsticks 
 * @param inputAmount 
 * @param executeMovr 
 * @return AssetNode[] modified path with allocation node if needed
 */
export async function allocateFunds(
    relay: Relay, 
    assetPath: AssetNode[],
    chopsticks: boolean, 
    inputAmount: number, 
    executeMovr: boolean
): Promise<AssetNode[]> {
    const startChainId = assetPath[0].getChainId()
    await allocateToRelay(relay, startChainId, chopsticks, inputAmount, executeMovr)
    return await allocateToStartChain(relay, assetPath, chopsticks)
}

// Get balance of native token accross chains. If RELAY chain has low funds, collect all funds to relay. Return balances of all chains
/**
 * Checks balance of relay chain. If less than required amount, allocate tokens from each chain to the relay
 * 
 * @param relay 
 * @param startChainId - First swap chain, do not allocate from this chain
 * @param chopsticks 
 * @param inputAmount - Amount required for arb execution
 * @param executeMovr 
 * @returns 
 */
export async function allocateToRelay(
    relay: Relay, 
    startChainId: number, 
    chopsticks: boolean, 
    inputAmount: number, 
    executeMovr: boolean
): Promise<RelayTokenBalances>{

    let nativeBalances: RelayTokenBalances;
    const relayChainMinimum = getRelayMinimum(relay)
    const requiredBalance = new bn(inputAmount).plus(new bn(relayChainMinimum))


    try{
        nativeBalances = await attemptQueryRelayTokenBalances(chopsticks, relay)
    } catch(e){
        throw new Error(`Allocating relay token: Unable to query relay balances. ${JSON.stringify(e, null, 2)}`)
    }

    // If relay has sufficient balance, return
    if(new bn(nativeBalances[0]) >= requiredBalance){
        return nativeBalances
    }

    await collectRelayToken(relay, chopsticks,  executeMovr, nativeBalances, startChainId)

    // Query balances again after allocation
    try{
        nativeBalances = await attemptQueryRelayTokenBalances(chopsticks, relay)
    } catch(e){
        throw new Error(`Allocating relay token: Unable to query relay balances. ${JSON.stringify(e, null, 2)}`)
    }

    return nativeBalances

    // let nativeBalancesSuccess = false;
    // let attempts = 0;
    // let executedAllocation = false;
    // while(!nativeBalancesSuccess && attempts < 3){
    //     console.log("Querying Relay Token Balances")
    //     attempts += 1
    //     try{
    //         // Query balances. Query may fail
    //         // nativeBalances = await getRelayTokenBalances(chopsticks, relay)
    //         nativeBalances = await attemptGetRelayTokenBalances(chopsticks, relay)
    //         nativeBalancesSuccess = true

    //         // Allocate to relay if relay balance is less than input amount + minimum
    //         if(new bn(nativeBalances[0]) < new bn(inputAmount).plus(new bn(relayChainMinimum))){
    //             console.log("Insufficient Relay Token balance. Collecting ksm to relay")
    //             executedAllocation = true
    //             await collectRelayToken(relay, chopsticks,  executeMovr, nativeBalances, startChainId)

    //             // After allocating, need to requery balances
    //             nativeBalancesSuccess = false;
    //         }
    //     } catch(e){
    //         console.log(e)
    //         console.log("Relay query or allocation failed. Retrying")
    //     }
    // }
    // if(!nativeBalancesSuccess){
    //     throw new Error("Failed to query Relay Token balances")
    // }
    // // Query balances again after allocation

    // attempts = 0
    // while(executedAllocation && !nativeBalancesSuccess && attempts < 3){
    //     console.log("Query balance again after executing allocation")
    //     attempts += 1
    //     try{
    //         nativeBalances = await getRelayTokenBalances(chopsticks, relay)
    //         nativeBalancesSuccess = true
    //     } catch(e) {
    //         console.log(e)
    //         console.log("Relay Token query failed. Retrying")
    //     }
    // }
    // if(!nativeBalancesSuccess){
    //     throw new Error("Failed to query Relay Token balances")
    // }
    // return nativeBalances
    
}

/**
 * Ensure start chain has sufficient funds. Prepend arb path with transfer node. Return final AssetNode path
 * - Prepend only if start chain has insufficient balance for swap
 * - The xcm node will be the relay asset, on the relay chain, for an amount slightly larger than the swap amount
 * - After prepending new node, the first transaction will be an xcm transfer from the relay chain to the start chain
 * 
 * @param relay 
 * @param assetPath - AssetNode[] path to execute, before preppending allocation node
 * @param chopsticks 
 * @returns AssetNode[] - final arb path that will be executed
 */
export async function allocateToStartChain(relay: Relay, assetPath: AssetNode[], chopsticks: boolean){
    let startChainId = assetPath[0].getChainId()
    let startValue = assetPath[0].getPathValueAsNumber()

    let relayTokenBalances: RelayTokenBalances = await getRelayTokenBalances(chopsticks, relay)

    
    let executionPath: AssetNode[] = assetPath
    if(new bn(relayTokenBalances[startChainId]).lt(startValue)){
        // Build allocation relay chain -> startChain 
        console.log("*** StartNode has insufficient start balance. Need to allocate")
        let allocationNode: AssetNode[] = await getStartChainAllocationPath(relay, startChainId, startValue, relayTokenBalances)
        executionPath = allocationNode.concat(assetPath)
    }  else {
        console.log("SWAP CHAIN HAS ENOUGH FUNDS")
    }
    return executionPath
}

// export async function allocateFundsForSwap(relay: Relay, assetPath: AssetNode[],  nativeBalances: any, chopsticks: boolean, executeMovr: boolean){
//     let startChain = assetPath[0].getChainId()
//     let startValue = assetPath[0].getPathValueAsNumber()

//     console.log("ALLOCATING FUNDS FOR SWAP")
//     let executionPath: AssetNode[] = assetPath
//     if(new bn(nativeBalances[startChain]).lt(startValue)){
        
//         // Build allocation All chains -> relay chain && relay chain -> startChain when enough allocation
//         console.log("*** StartNode has insufficient start balance. Need to allocate")
//         let allocationPaths: AssetNode[][] = await getPreTransferPath(relay, startChain, startValue, nativeBalances)
        
//         // Execute allocations to RELAY, then add RELAY -> StartNode to execution path
//         if(allocationPaths.length > 1){
//             let ksmAllocationPath = allocationPaths.pop()!
//             await allocateKsmFromPreTransferPaths(relay, allocationPaths, chopsticks, executeMovr)
//             executionPath = ksmAllocationPath.concat(assetPath)
//         } else {
//             executionPath = allocationPaths[0].concat(assetPath)
//         }
//     }  else {
//         console.log("SWAP CHAIN HAS ENOUGH FUNDS")
//     }
//     return executionPath
// }

export async function executeXcmTransfer(xcmTx: paraspell.Extrinsic, signer: KeyringPair): Promise<TxDetails>{
    return new Promise((resolve, reject) => {
        let success = false;
        let included: EventRecord[] = [];
        let finalized: EventRecord[] = [];
        let eventLogs: any[] = [];
        let blockHash: string = "";
        let dispatchErrorCode: DispatchErrorModule;
        let decodedError;
        let xcmMessageHash;
        let xcmMessageId;
        let feeEvent;
        xcmTx.signAndSend(signer, ({ events = [], status, txHash, txIndex, dispatchError }) => {
            if (status.isInBlock) {
                success = dispatchError ? false : true;
                console.log(
                    `Execute Transfer: 📀 Transaction ${xcmTx.meta.name}(..) included at blockHash ${status.asInBlock} [success = ${success}]`
                );
                included = [...events];
                blockHash = status.asInBlock.toString();

            } else if (status.isBroadcast) {
                console.log(`Execute Transfer: 🚀 Transaction broadcasted.`);
            } else if (status.isFinalized) {
                console.log(
                    `Execute Transfer: 💯 Transaction ${xcmTx.meta.name}(..) Finalized at blockHash ${status.asFinalized}`
                );
                finalized = [...events];
                events.forEach((eventObj) => {
                    // console.log("*******************************************")
                    // console.log(JSON.stringify(eventObj.toHuman(), null, 2))
                    eventLogs.push(eventObj.toHuman())

                    // console.log("********************************************")
                    // console.log("XCM Transfer execution event data. LOOKING for xcm ID and HASH")
                    // console.log(JSON.stringify(eventObj.event.data.toHuman(), null, 2))

                    // XTokens Transfer event
                    if (eventObj.event.section === 'xcmpQueue' && eventObj.event.method === 'XcmpMessageSent') {
                        xcmMessageHash = eventObj.event.data[0].toString();
                    }

                    if(eventObj.event.section === 'polkadotXcm' && eventObj.event.method === 'Sent'){
                        xcmMessageId = eventObj.event.data[3].toString();
                    }

                    // XTokens UMP transfer event
                    if(eventObj.event.section === 'parachainSystem' && eventObj.event.method === 'UpwardMessageSent'){
                        xcmMessageHash= eventObj.event.data[0].toString();
                    }

                    // XcmPallet Transfer event (Polkadot DMP)
                    if (eventObj.event.section === 'xcmPallet' && eventObj.event.method === 'Sent') {
                        xcmMessageHash = eventObj.event.data[3].toString();
                    }

                    // FEE Event
                    if(eventObj.event.section === 'transactionPayment' && eventObj.event.method === 'TransactionFeePaid'){
                        // console.log("Found FEE Event")
                        feeEvent = eventObj.event.data
                        // console.log("FEE EVENT: " + JSON.stringify(feeEvent, null, 2))
                        // console.log(`Fee amount: ${feeEvent[1].toString()} ${feeEvent[0].toString()}`)
                    }


                    if(eventObj.event.method == "ExtrinsicFailed" && dispatchError){
                        console.log("Execute Transfer: Extrinsic Failed event detected")
                        const {index, error} = dispatchError.asModule;
                        const moduleIndex = parseInt(index.toString(), 10);
                        const errorCodeHex = error.toString().substring(2, 4); // "09"
                        const errorIndex = parseInt(errorCodeHex, 16);

                        // Get the module and error metadata
                        decodedError = xcmTx.registry.findMetaError({index: new BN(moduleIndex), error: new BN(errorIndex)});
                        dispatchErrorCode = dispatchError.asModule;
                        console.log("Execute Transfer: Dispatch Error: " + dispatchError.toString())
                        console.log("Execute Transfer: DECODED MODULE: " + JSON.stringify(decodedError, null, 2))
                        console.log("Execute Transfer: Rejecting Transfer tx")
                        let txDetails: TxDetails = { success: false, dispatchError: dispatchErrorCode, decodedError, included, finalized, blockHash, eventLogs, xcmMessageHash: xcmMessageHash };
                        reject(txDetails);
                    }
                })
                const hash = status.hash;
                let txDetails: TxDetails = { success: true, hash, dispatchError: dispatchErrorCode, decodedError, included, finalized, eventLogs, blockHash, txHash, txIndex, xcmMessageHash: xcmMessageHash, xcmMessageId: xcmMessageId, feeEvent };
                console.log("Execute Transfer: Resolving Transfer tx")
                resolve(txDetails);
            } else if (status.isReady) {
                console.log("Execute Transfer: Status: Ready")
            } else if (dispatchError){
                console.log("Execute Transfer: Dispatch error: " + dispatchError.toString())
                if(dispatchError.isModule){
                    const decoded = xcmTx.registry.findMetaError(dispatchError.asModule);
                    console.log("Execute Transfer: DISPATCH ERROR DECODED: " + JSON.stringify(decoded, null, 2))
                    console.log("Execute Transfer: Rejecting Transfer tx from dispatch error")
                    let txDetails: TxDetails = { success:false, dispatchError: dispatchErrorCode, decodedError, included, finalized, blockHash, eventLogs }
                    reject(txDetails);
                } else {
                    console.log("Execute Transfer: Rejecting Transfer tx from dispatch error")
                    let txDetails: TxDetails = { success:false, dispatchError: dispatchErrorCode, decodedError, included, finalized, blockHash, eventLogs }
                    reject(txDetails);
                }
            }
            else {
                console.log(`Execute Transfer: 🤷 Other status ${status}`);
            }
        }).catch((error) => {
            console.log("Execute Transfer: Error: " + error);
            reject(error);
        });
    });
}