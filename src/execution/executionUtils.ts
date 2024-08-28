import { DispatchError, DispatchErrorModule, EventRecord, ExtrinsicStatus, H256, Hash } from "@polkadot/types/interfaces"
import { BN } from "@polkadot/util/bn"
import { checkAndApproveToken } from "../swaps/movr/utils/utils.ts"
import { AssetNode } from "../core/AssetNode.ts"
import { testNets, localRpcs } from "../config/txConsts.ts"
import { ExtrinsicObject, IndexObject, SingleSwapResultData, SwapTxStats, ArbExecutionResult, TxDetails, BalanceChangeStats, LastNode, SingleTransferResultData, TransferTxStats, TransferExtrinsicContainer, SwapExtrinsicContainer, SwapResultObject, SwapInstruction, ChainNonces, PreExecutionTransfer, TransactionState, TransferProperties, SwapProperties, Relay, TransferInstruction, NativeBalancesType, FeeData, ReserveFeeData, BalanceChangeStatsBn, PromiseTracker, TransferDepositEventData, IMyAsset, ExtrinsicContainer } from "./../types/types.ts"
import { getSigner, increaseIndex, printExtrinsicSetResults, getLastSuccessfulNodeFromResultData, getAssetRegistryObjectBySymbol, getAssetRegistryObject, getAssetDecimalsFromLocation, getWalletAddressFormatted, isTxDetails, isSwapExtrinsicContainer, isTransferExtrinsicContainer, isTransferProperties, isSwapProperties } from "../utils/utils.ts"
import { FixedPointNumber, Token } from "@acala-network/sdk-core";
import { buildSwapExtrinsicDynamic } from "./extrinsicUtils.ts"
import { getApiForNode } from "../utils/apiUtils.ts"
import { BalanceData } from "@polkawallet/bridge"
import * as paraspell from '@paraspell/sdk'
import {KeyringPair} from '@polkadot/keyring/types'
import { allocateKsmFromPreTransferPaths, buildInstructionSet, collectKsmToRelayPaths, getFundingPath, getPreTransferPath } from "./instructionUtils.ts"
import { getBalance, getBalanceChange, getBalanceFromId, getDisplayBalance, getRelayTokenBalances, watchTokenBalance, watchTokenDeposit } from "./../utils/balanceUtils.ts"
import { stateSetLastNode, stateSetResultData, stateSetTransactionState, stateSetTransactionProperties, updateXcmFeeReserves, stateSetTracking } from "./../utils/globalStateUtils.ts"
// import {BigNumber as bn } from "bignumber.js"
import bn from 'bignumber.js'
import { swapManagerContractLive } from "../swaps/glmr/utils/const.ts"
import { createFeeDatas, createReserveFees, getTransferType, getXcmTransferEventData, listenForXcmpDepositEvent } from "../utils/feeUtils.ts"
import { WsProvider, ApiPromise, Keyring, ApiRx } from '@polkadot/api'
import { logEventFeeBook } from "../utils/logUtils.ts"
import { TNode } from "@paraspell/sdk"
import { buildAndExecuteAllocationExtrinsics } from "./arbExecutor.ts"
import { MyAsset } from "../core/index.ts"
import { Observable } from "rxjs"
// import { H256 } from '@polkadot/types/primitive';
bn.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 }) // Set to max precision

function createSwapProperties(
    relay: Relay, 
    chopsticks: boolean, 
    node: TNode, 
    address: string, 
    assetIn: AssetNode, 
    assetOut: AssetNode,
    assetInBalance: BalanceData,
    assetOutBalance: BalanceData,
    inputAmount: FixedPointNumber,
    destinationAssetKey: string
){
    let swapProperties: SwapProperties = {
        type: 'Swap',
        relay: relay,
        chopsticks: chopsticks,
        node: node,
        paraId: assetIn.getChainId(),
        address: address,
        assetIn: assetIn,
        assetOut: assetOut,
        assetInStartBalance: assetInBalance,
        assetOutStartBalance: assetOutBalance,
        inputAmount: inputAmount.toChainData(),
        destAssetKey: destinationAssetKey
    }
    return swapProperties
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
    // const assetIn.getSymbol() = swapExtrinsicContainer.assetSymbolIn
    // const assetOut.getSymbol() = swapExtrinsicContainer.assetSymbolOut
    // const assetIn = swapExtrinsicContainer.pathInLocalId
    // const assetOut = swapExtrinsicContainer.pathOutLocalId
    const expectedAmountIn = swapExtrinsicContainer.assetAmountIn
    const expectedAmountOut = swapExtrinsicContainer.expectedAmountOut
    let blockHash = ""

    const movrBatchSwapParams = swapExtrinsicContainer.movrBatchSwapParams!
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

    // let tokenInBalanceStart = await getBalance(chainId, chopsticks, api, assetIn.getSymbol(), chain, liveWallet.address)
    // let tokenOutBalanceStart = await getBalance(chainId, chopsticks, api, assetOut.getSymbol(), chain, liveWallet.address)

    //  *** Set transaction properties for state tracking ***
    // let assetNodes = swapExtrinsicContainer.assetNodes
    // let assetIn = swapExtrinsicContainer.assetNodes[0].asset;
    // let assetOut = swapExtrinsicContainer.assetNodes[swapExtrinsicContainer.assetNodes.length - 1].asset;

    // let destinationAssetKey = JSON.stringify(assetOut.tokenData.chain.toString() + JSON.stringify(assetOut.tokenData.localId))
    const destinationAssetKey = assetOut.getAssetKey()
    let signer = await getSigner(chopsticks, false)

    //***************************
    let tokenInBalanceStart = await getBalance(chainId, relay, chopsticks, api, assetIn.asset, chain, signer.address)
    let tokenOutBalanceStart = await getBalance(chainId, relay, chopsticks, api, assetOut.asset, chain, signer.address)
    // ***************************

    let swapProperties: SwapProperties = createSwapProperties(relay, chopsticks, chain, signer.address, assetIn, assetOut, tokenInBalanceStart, tokenOutBalanceStart, expectedAmountIn, destinationAssetKey)
    stateSetTransactionProperties(swapProperties)
    // ******************************************************
    let unsubscribeOne: (() => void) = () => {}; 
    let unsubscribeTwo: (() => void) = () => {}; 

    let balanceObservableIn$: Observable<BalanceData> = await watchTokenBalance(relay, chainId, chopsticks, api, assetIn.asset, chain, liveWallet.address)
    let balanceObservableOut$: Observable<BalanceData> = await watchTokenBalance(relay, chainId, chopsticks, api, assetOut.asset, chain, liveWallet.address)
    let balancePromiseIn: Promise<BalanceChangeStatsBn> = getBalanceChange(balanceObservableIn$, (unsub) => {
        unsubscribeOne = unsub
    })
    let balancePromiseOut: Promise<BalanceChangeStatsBn> = getBalanceChange(balanceObservableOut$, (unsub) => {
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
            assetValue: tokenOutBalanceStats.changeInBalanceDisplay,
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

        

        let swapStats: SwapTxStats = {
            txHash: txHash,
            chain: chain,
            paraId: chainId,
            currencyIn: assetIn.getAssetSymbol(),
            currencyOut: assetOut.getAssetSymbol(),
            expectedAmountIn: expectedAmountIn.toString(),
            actualAmountIn: tokenInBalanceStats.changeInBalance.toString(),
            expectedAmountOut: expectedAmountOut.toString(),
            actualAmountOut: tokenOutBalanceStats.changeInBalance.toString(),
            tokenInBalanceChange: tokenInBalanceStats,
            tokenOutBalanceChange: tokenOutBalanceStats,
        }
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

        let inputReadable = new bn(expectedAmountIn.abs().toChainData()).div(new bn(10).pow(assetIn.getDecimals())).toString()
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
    // const assetInSymbol = swapExtrinsicContainer.assetSymbolIn
    // const assetOutSymbol = swapExtrinsicContainer.assetSymbolOut
    // const assetIn = swapExtrinsicContainer.pathInLocalId
    // const assetOut = swapExtrinsicContainer.pathOutLocalId
    const expectedAmountIn = swapExtrinsicContainer.assetAmountIn
    const expectedAmountOut = swapExtrinsicContainer.expectedAmountOut
    let blockHash = ""

    const managerSwapParams = swapExtrinsicContainer.glmrSwapParams!
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
    let destinationAssetKey = assetOut.getAssetKey()
    let signer = await getSigner(chopsticks, true)
    let tokenInBalanceStart = await getBalance(chainId, relay, chopsticks, api, assetIn.asset, chain, signer.address)
    let tokenOutBalanceStart = await getBalance(chainId, relay, chopsticks, api, assetOut.asset, chain, signer.address)
    
    let swapProperties: SwapProperties = createSwapProperties(relay, chopsticks, chain, signer.address, assetIn, assetOut, tokenInBalanceStart, tokenOutBalanceStart, expectedAmountIn, destinationAssetKey)
    stateSetTransactionProperties(swapProperties)
    // ******************************************************
    let unsubscribeOne: (() => void) = () => {}; 
    let unsubscribeTwo: (() => void) = () => {}; 
    let balanceObservableIn$ = await watchTokenBalance(relay, chainId, chopsticks, api, assetIn.asset, chain, signer.address)
    let balanceObservableOut$ = await watchTokenBalance(relay, chainId, chopsticks, api, assetOut.asset, chain, signer.address)
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
        // let assetOut = swapExtrinsicContainer.assetNodes[swapExtrinsicContainer.assetNodes.length - 1].asset;
        // let assetRegistryObject = swapExtrinsicContainer.assetNodes[swapExtrinsicContainer.assetNodes.length - 1].assetRegistryObject;
        let lastNode: LastNode = {
            // assetKey: JSON.stringify(assetOut.tokenData.chain.toString() + JSON.stringify(assetOut.tokenData.localId)),
            assetKey: assetOut.getAssetKey(),
            assetValue: tokenOutBalanceStats.changeInBalanceDisplay,
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

        

        let swapStats: SwapTxStats = {
            txHash: txHash,
            chain: chain,
            paraId: chainId,
            currencyIn: assetIn.getAssetSymbol(),
            currencyOut: assetOut.getAssetSymbol(),
            expectedAmountIn: expectedAmountIn.toString(),
            actualAmountIn: tokenInBalanceStats.changeInBalance.toString(),
            expectedAmountOut: expectedAmountOut.toString(),
            actualAmountOut: tokenOutBalanceStats.changeInBalance.toString(),
            tokenInBalanceChange: tokenInBalanceStats,
            tokenOutBalanceChange: tokenOutBalanceStats,
        }
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
        let inputReadable = new bn(expectedAmountIn.toChainData()).div(new bn(10).pow(assetIn.getDecimals())).toString()
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


function trackPromise(promise: Promise<any>) {
    let isResolved = false;

    // Create a new promise that resolves the same way the original does
    // and updates the `isResolved` flag
    const trackedPromise = promise.then(
        (result) => {
            isResolved = true;
            return result; // Pass through the result
        },
        (error) => {
            isResolved = true;
            throw error; // Rethrow the error to be caught later
        }
    );
    let promiseTracker: PromiseTracker = {
        trackedPromise: trackedPromise,
        isResolved: () => isResolved
    }

    // Return both the new promise and a function to check if it's resolved
    // return { trackedPromise, isResolved: () => isResolved };
    return promiseTracker;
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

    const destinationAssetKey = assetOut.getAssetKey()

    let signer = await getSigner(chopsticks, false)
    let tokenInBalanceStart = await getBalance(chainId, relay, chopsticks, api, assetIn.asset, chain, signer.address)
    let tokenOutBalanceStart = await getBalance(chainId, relay, chopsticks, api, assetOut.asset, chain, signer.address)

    let swapProperties: SwapProperties = createSwapProperties(relay, chopsticks, chain, signer.address, assetIn, assetOut, tokenInBalanceStart, tokenOutBalanceStart, expectedAmountIn, destinationAssetKey)
    stateSetTransactionProperties(swapProperties)

    let tokenInBalance$ = await watchTokenBalance(relay, chainId, chopsticks, api, assetIn.asset, chain, signer.address)
    let tokenOutBalance$ = await watchTokenBalance(relay, chainId, chopsticks, api,assetOut.asset, chain, signer.address)

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
    let tokenInBalanceStats: BalanceChangeStatsBn,
        tokenOutBalanceStats: BalanceChangeStatsBn = {} as BalanceChangeStatsBn,
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
        let inputReadable = new bn(expectedAmountIn.toChainData()).div(new bn(10).pow(assetIn.getDecimals())).toString()
        let arbString: ArbExecutionResult = {
            assetSymbolIn: assetIn.getAssetSymbol(),
            assetSymbolOut: assetOut.getAssetSymbol(),
            assetAmountIn: inputReadable,
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

        let tokenInBalanceEnd: BalanceData = await getBalance(chainId, relay, chopsticks, api, assetIn.asset, chain, signer.address)
        let tokenInBalanceStartBn = tokenInBalanceStart.free._getInner()
        let tokenInBalanceEndBn = tokenInBalanceEnd.free._getInner()
        let balanceChangeAmount = tokenInBalanceEndBn.minus(tokenInBalanceStartBn).abs()
        
        tokenInBalanceStats = {
            startBalance: tokenInBalanceStartBn,
            endBalance: tokenInBalanceEndBn,
            changeInBalance: balanceChangeAmount,
            startBalanceDisplay: tokenInBalanceStartBn.div(new bn(10).pow(assetIn.getDecimals())).toString(),
            endBalanceDisplay: tokenInBalanceEndBn.div(new bn(10).pow(assetIn.getDecimals())).toString(),
            changeInBalanceDisplay: balanceChangeAmount.div(new bn(10).pow(assetIn.getDecimals())).toString()
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
            let tokenOutBalanceEnd: BalanceData = await getBalance(chainId, relay, chopsticks, api, assetOut.asset, chain, signer.address)
            let tokenOutBalanceStartBn = tokenOutBalanceStart.free._getInner()
            let tokenOutBalanceEndBn = tokenOutBalanceEnd.free._getInner()
            let balanceChangeAmount = tokenOutBalanceStartBn.minus(tokenOutBalanceEndBn).abs()
            if(balanceChangeAmount.gt(new bn(0))){
                console.log("balanceQuery SUCCESS")
                tokenOutBalanceConfirmed = true
                tokenOutBalanceStats = {
                    startBalance: tokenOutBalanceStartBn,
                    endBalance: tokenOutBalanceEndBn,
                    changeInBalance: balanceChangeAmount,
                    startBalanceDisplay: tokenOutBalanceStartBn.div(new bn(10).pow(assetOut.getDecimals())).toString(),
                    endBalanceDisplay: tokenOutBalanceEndBn.div(new bn(10).pow(assetOut.getDecimals())).toString(),
                    changeInBalanceDisplay: balanceChangeAmount.div(new bn(10).pow(assetOut.getDecimals())).toString()
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
        assetValue: tokenOutBalanceStats.changeInBalanceDisplay,
        chainId: assetOut.getChainId(),
        assetSymbol: assetOut.getAssetSymbol()
    }
    
    if(success){
        console.log("Swap Extrinsic successful. Setting last node...")
        await stateSetLastNode(lastNode)
    }
    
    
    console.log(`EXPECTED TOKEN IN ${expectedAmountIn.toString()} || EXPECTED TOKEN OUT ${expectedAmountOut.toString()}`)
    console.log(`ACTUAL TOKEN IN ${JSON.stringify(tokenInBalanceStats.changeInBalance.toString())} || ACTUAL TOKEN OUT ${(JSON.stringify(tokenOutBalanceStats.changeInBalance.toString()))}`)

    let swapStats: SwapTxStats = {
        txHash: txHash,
        chain: chain,
        paraId: chainId,
        currencyIn: assetIn.getAssetSymbol(),
        currencyOut: assetOut.getAssetSymbol(),
        expectedAmountIn: expectedAmountIn.toString(),
        actualAmountIn: tokenInBalanceStats.changeInBalance.toString(),
        expectedAmountOut: expectedAmountOut.toString(),
        actualAmountOut: tokenOutBalanceStats.changeInBalance.toString(),
        tokenInBalanceChange: tokenInBalanceStats,
        tokenOutBalanceChange: tokenOutBalanceStats,
    } 

    let swapTxResult = {
        txString: `(${chain}) ${chainId} ${assetIn.getAssetSymbol()} -> ${assetOut.getAssetSymbol()}`,
        txDetails: tx
    }

    let actualAmountIn
    if(success){
        actualAmountIn = tokenInBalanceStats.changeInBalance.abs()
    } else {
        actualAmountIn = expectedAmountIn.abs().toChainData()
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
    
    let pathValueNext = Number.parseFloat(tokenOutBalanceStats.changeInBalanceDisplay)

    // let pathNode: PathNodeValues = {
        // pathInLocalId: swapTxContainer.pathInLocalId,
        // pathOutLocalId: swapTxContainer.pathOutLocalId,
    //     pathInSymbol: assetIn.getAssetSymbol(),
    //     pathOutSymbol: assetOut.getAssetSymbol(),
    //     pathSwapType: swapTxContainer.pathType,
    //     pathValue: swapTxContainer.pathAmount,
    //     pathValueNext:pathValueNext
    // }

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

// Some transactions dont track, like allocate, with asyncronoouus execution would be a mess
// Only returns undefined when in testing, and skipping chains to execute transfers on.
export async function executeSingleTransferExtrinsic(
    // extrinsicObj: ExtrinsicObject, 
    transferTxContainer: TransferExtrinsicContainer,
    chopsticks: boolean
):Promise<SingleTransferResultData | undefined>{
    console.log("Execute Single Transfer Extrinsic ()")
    let extrinsicResultData: SingleTransferResultData;
    let arbExecutionResult: ArbExecutionResult;
    let transferTxStats: TransferTxStats;
    // const transferTxContainer =  
    let relay = transferTxContainer.relay

    stateSetTransactionState(TransactionState.PreSubmission)

    let extrinsic = transferTxContainer.extrinsic
    const xcmTxProperties = extrinsic.toHuman() as any
    const startAsset: AssetNode = transferTxContainer.startAsset
    const destinationAsset: AssetNode = transferTxContainer.destinationAsset


    const startChain = transferTxContainer.startNode
    const startApi = transferTxContainer.startApi
    const startParaId: number = startAsset.getChainId()
    const destApi = transferTxContainer.destinationApi
    const destParaId = destinationAsset.getChainId()
    const destChain = transferTxContainer.destinationNode
    
    //TODO reformat paraspell asset symbol
    const startAssetSymbol = startAsset.getAssetSymbol()
    const destinationAssetSymbol = destinationAsset.getAssetSymbol()
    const inputAmount = transferTxContainer.pathAmount
    const transferReserveAmount = transferTxContainer.transferReserveAmount
    let blockHash = ""
    // if(startChain == "Kusama" || destChain == "Kusama"){
    //     currency = "KSM"
    // }

    let startSigner: KeyringPair, destSigner: KeyringPair;
    startSigner = relay == 'kusama' ?
        startParaId == 2023 ? await getSigner(chopsticks, true) : await getSigner(chopsticks, false) : // Kusama substrate or eth wallet
        startParaId == 2004 ? await getSigner(chopsticks, true) : await getSigner(chopsticks, false) // Polkadot substrate or eth wallet

    destSigner = relay == 'kusama' ?
        destParaId == 2023 ? await getSigner(chopsticks, true) : await getSigner(chopsticks, false) :
        destParaId == 2004 ? await getSigner(chopsticks, true) : await getSigner(chopsticks, false)

    let keyring = new Keyring({
        ss58Format: 0,
        type: 'sr25519'
    })
    let ss58FormatDest = await destApi.consts.system.ss58Prefix;

    let watchWithdrawAddress: string = startSigner.address.toString()
    let watchDepositAddress: string = destSigner.address.toString()

    // If chopsticks, only execute for chains we are running
    let execute = true
    if(chopsticks){
        //If either chain is not running, skip
        if(!testNets.includes(startChain) || !testNets.includes(destChain)){
            execute = false
        }
    }
   
    console.log(`Execute Extrinsic Set Loop: Start Chain: ${startChain} ${startParaId}| Destination Chain: ${destChain} ${destParaId} | Currency: ${JSON.stringify(startAssetSymbol)} `)
    if(execute){
        let startBalance = await getBalance(startParaId, relay, chopsticks, startApi, startAsset.asset, startChain, startSigner.address)
        let destinationStartBalance = await getBalance(destParaId, relay, chopsticks, destApi, destinationAsset.asset, destChain, destSigner.address)
        const destinationAssetKey = destinationAsset.getAssetKey()

        

        let transferProperties: TransferProperties = {
            type: "Transfer",
            relay: relay,
            chopsticks: chopsticks,
            startAsset: startAsset,
            destAsset: destinationAsset,
            // startNode: startChain,
            // startParaId: startParaId,
            // startAssetSymbol: startAsset.getSymbol(),
            // startAssetLocalId: startAsset.getLocalId(),
            startAddress: startSigner.address,
            startNodeStartBalance: startBalance,
            startNodeStartBalanceString: startBalance.free.toString(),
            // destNode: destChain,
            // destParaId: destParaId,
            // destAssetSymbol: destinationAsset.getSymbol(),
            // destAssetLocalId: destinationAsset.getLocalId(),
            destNodeStartBalance: destinationStartBalance,
            destNodeStartBalanceString: destinationStartBalance.free.toString(),
            destAddress: destSigner.address,
            inputAmount: inputAmount,
            reserveAmount: transferReserveAmount,
            assetDecimals: startAsset.getDecimals().toString(),
            destAssetKey: destinationAssetKey
            
        }
        stateSetTransactionProperties(transferProperties)

        let startBalanceUnsub, destBalanceUnsub;
        console.log("Execute Extrinsic Set Loop: Initiating balance adapter for START chain " + startChain)
        let startBalanceObservable$ = await watchTokenDeposit(relay, startParaId, chopsticks, startApi, startAsset.asset, watchWithdrawAddress) 
        let startBalanceChangePromise = getBalanceChange(startBalanceObservable$, (unsub) =>{
            startBalanceUnsub = unsub
        })
        console.log("Execute Extrinsic Set Loop: Initiating balance adapter for DESTINATION chain " + destChain)
        let destBalanceObservable$ = await watchTokenDeposit(relay, destParaId, chopsticks, destApi, destinationAsset.asset, watchDepositAddress)
        let destAdapterBalanceChangePromise = getBalanceChange(destBalanceObservable$, (unsub) =>{
            destBalanceUnsub = unsub
        })
        console.log(`(${startChain} -> ${destChain}) ${JSON.stringify(startAsset.getAssetSymbol())} ${JSON.stringify(startAsset.getLocalId())}`)
        // console.log(extrinsic.toHuman())
        let txDetailsPromise: Promise<TxDetails | undefined>;

        let destAdapterBalanceChangeTracker: PromiseTracker = trackPromise(destAdapterBalanceChangePromise)
        let destTrackedAdapterBalanceChangePromise = destAdapterBalanceChangeTracker.trackedPromise
        let destAdapterBalanceChangeResolved = destAdapterBalanceChangeTracker.isResolved
        let xcmTransferId
        let startTransferEventData: TransferDepositEventData
        let destDepositEventData: TransferDepositEventData
        let txDetails: TxDetails;
        try{
            // **************************************************************************************
            let txDetailsPromise = executeTransferExtrinsic(transferTxContainer, startSigner, chopsticks)
            
            console.log("Execute Extrinsic Set Loop: Transfer promise created")
            // REVIEW Awaiting transfer execution here, but also awaiting it later in the function. The later await is unecessary, but maybe better to await later
            let txReturnCheck = await txDetailsPromise
            // TODO Reformat to properly account for tests skipping instead of returning undefined, probably better way to write this
            if(!txReturnCheck){
                return undefined
            }
            txDetails = txReturnCheck
            // **************************************************************************************

            xcmTransferId = txDetails.xcmMessageHash
            blockHash = txDetails.blockHash!
            let startChainNativeToken = startApi.registry.chainTokens[0]
            startTransferEventData = getXcmTransferEventData(startChain, startAssetSymbol, startAsset.asset, startChainNativeToken, txDetails.finalized!, relay, xcmTxProperties)
        } catch(e) {
            console.log("ERROR: " + e)
            // txPromise = e

            if(!isTxDetails(e)) throw new Error("Transfer failure, unknown error type");
            let decodedError = e.decodedError
            await startBalanceUnsub()
            await destBalanceUnsub()
            // For now just throw if an extrinsic fails, and then execute reverse txs
            // throw new Error("Transfer failed, executing reverse txs")
            let transferAmount = transferTxContainer.pathAmount

            
            // let actualAmountOut = tokenOutBalanceStats.changeInBalance.abs().toChainData()
            arbExecutionResult = { 
                assetSymbolIn: startAssetSymbol,
                assetSymbolOut: startAssetSymbol,
                assetAmountIn: transferAmount,
                assetAmountOut: "0",
                blockHash: blockHash,
                result: `FAILURE: TRANSFER: (${startChain} ${startParaId} ${startAssetSymbol} ${transferAmount}-> ${destChain}) ${destParaId} | ERROR: ${JSON.stringify(decodedError)}` 
            }

            extrinsicResultData = {
                success: false,
                arbExecutionResult: arbExecutionResult,
                transferTxStats: null,
                lastNode: null,
            }
            await stateSetResultData(extrinsicResultData)
            console.log("Returning on CATCH from failed Transfer Extrinsic")
            return extrinsicResultData

        }

        console.log("***** LISTENING FOR DEPOSIT EVENTS ************")
        let transferType = getTransferType(startChain, destChain)
        let destWalletFormatted = getWalletAddressFormatted(destSigner, keyring, destChain, ss58FormatDest)
        const destinationAssetDecimals = destinationAsset.getDecimals()

        console.log("Execute TRANSFER: Initiating deposit event listener")
        let depositEventPromise = listenForXcmpDepositEvent(
            destApi, 
            destChain, 
            transferType, 
            destinationAsset.asset, 
            destWalletFormatted, 
            destAdapterBalanceChangeTracker, 
            xcmTxProperties, 
            xcmTransferId
        ) 
        let depositEventTracker = trackPromise(depositEventPromise)
        
        console.log("Execute TRANSFER: AWAIT startBalanceChangePromise")
        let startBalanceChangeStats = await startBalanceChangePromise;
        

        let tokenDepositConfirmed = false;
        let depositSuccess: boolean = false
        let destBalanceChangeStats: BalanceChangeStatsBn = {} as BalanceChangeStatsBn;

        console.log("Execute TRANSFER: AWAIT destBalanceChangePromise")
        let queryIndex = 0
        while(!tokenDepositConfirmed){
            queryIndex++
            if (queryIndex % 10 != 0 ){
                console.log(`Deposit Event Tracker: ${depositEventTracker.isResolved()} | Waiting 1 sec...`)
                if(destAdapterBalanceChangeResolved()){
                    console.log("Token Deposit resolved NORMALLY")
                    destBalanceChangeStats = await destTrackedAdapterBalanceChangePromise
                    tokenDepositConfirmed = true
                    let destChangeInBalance = destBalanceChangeStats.changeInBalance;
                    let depositAmountSufficient = destChangeInBalance.gt(new bn(0))
                    if(!depositAmountSufficient){
                        console.log("DEST BALANCE CHANGE NOT SUFFICIENT")
                        depositSuccess = false
                    } else {
                        console.log("DEST BALANCE CHANGE SUFFICIENT")
                        depositSuccess = true
                    }
                }
                await new Promise(resolve => setTimeout(resolve, 1000))
            } else {
                console.log("Waited 10 seconds. QUERYING BALANCE...")
                let destEndBalance: BalanceData = await getBalance(destParaId, relay, chopsticks, destApi, destinationAsset.asset, destChain, destSigner.address)
                let destStartBalanceBn = destinationStartBalance.free._getInner()
                let destEndBalanceBn = destEndBalance.free._getInner()
                let destBalanceChange = destEndBalanceBn.minus(destStartBalanceBn)

                let destStartBalanceDisplay = getDisplayBalance(destStartBalanceBn, destinationAssetDecimals)
                let destEndBalanceDisplay = getDisplayBalance(destEndBalanceBn, destinationAssetDecimals)
                let destBalanceChangeDisplay = getDisplayBalance(destBalanceChange, destinationAssetDecimals)
                if(destBalanceChange.gt(new bn(0))){
                    console.log("QUERIED BALANCE AND FOUND CHANGE")
                    tokenDepositConfirmed = true
                    depositSuccess = true
                    destBalanceChangeStats = {
                        startBalance: destStartBalanceBn,
                        endBalance: destEndBalanceBn,
                        changeInBalance: destBalanceChange,
                        startBalanceDisplay: destStartBalanceDisplay.toString(),
                        endBalanceDisplay: destEndBalanceDisplay.toString(),
                        changeInBalanceDisplay: destBalanceChangeDisplay.toString(),
                        decimals: destinationAssetDecimals
                    }
                    destBalanceUnsub()
                }  else {
                    console.log("BALANCE QUERIED AND NO CHANGE IN BALANCE, waiting 10 seconds")
                    await new Promise(resolve => setTimeout(resolve, 1000))
                }
                
            }

        }

        let originFeeAssetDecimals = startTransferEventData.feeAssetDecimals
        if(!originFeeAssetDecimals){
            console.log("GETTING ORIGIN ASSET DECIMALS BY LOCATION ********")
            originFeeAssetDecimals = startAsset.getDecimals()
        }
        
        console.log("*********** WAITING ON DEPOSIT EVENTS **************")
        // REVIEW Maybe just combine FeeData and ReserveFeeData into one
        let transferFeeData: FeeData = {} as FeeData
        let depositFeeData: FeeData = {} as FeeData
        
        let reserveFees: ReserveFeeData[] = []

        // If fail to detect deposit events, dont update fee book
        try {
            destDepositEventData = await depositEventPromise
            if(!destDepositEventData.xcmAssetDecimals){
                destDepositEventData.xcmAssetDecimals = destinationAsset.getDecimals()
            }

            // Track Transfer and Deposit reserve fees
            reserveFees.push(createReserveFees(transferTxContainer, startTransferEventData, 'Transfer'))
            if(new bn(transferTxContainer.depositReserveAmount).isGreaterThan(new bn(0))){
                reserveFees.push(createReserveFees(transferTxContainer, destDepositEventData, 'Deposit'))
            }

            transferFeeData = createFeeDatas(transferTxContainer, startTransferEventData, 'Transfer')
            depositFeeData = createFeeDatas(transferTxContainer, destDepositEventData, 'Deposit')

            reserveFees.forEach((feeData) => console.log(`Fee Data: ${feeData.feeAssetId} ${feeData.feeAssetAmount} | Reserve Data: ${feeData.reserveAssetId} ${feeData.reserveAssetAmount}`))
            console.log(`Transfer fees: ${transferFeeData.feeAssetId} ${transferFeeData.feeAmount} | Deposit fees: ${destDepositEventData.feeAssetId} ${destDepositEventData.feeAmount}`)
            logEventFeeBook(startTransferEventData, destDepositEventData, relay)
            // await updateAccumulatedFeeData(startFeeData, destinationFeeData, relay, chopsticks)
            await updateXcmFeeReserves(reserveFees)
        } catch (error) {
            console.error("ERROR: " + error)
            console.error("Failed to detect deposit events")
        }

        let lastNode: LastNode = {
            assetKey: destinationAsset.getAssetKey(),
            assetValue: destBalanceChangeStats.changeInBalanceDisplay,
            chainId: destinationAsset.getChainId(),
            assetSymbol: destinationAsset.getAssetSymbol()
        }
        // Need to check that received amount is within 1% of expected, so we know the change is not just the fee being paid
        let minimumExpected = new bn(inputAmount).times(.95)
        let sufficient = destBalanceChangeStats.changeInBalance.minus(minimumExpected)   

        // REVIEW This is where thought i was await transfer execution.
        // console.log("AWAIT txDetailsPromise")
        // let txDetails = await txDetailsPromise! as TxDetails

        if(sufficient.gt(new bn(0))){
            console.log("CHANGE In balance is sufficient")
            console.log("Transfer Extrinsic successful. setting last node...")
            await stateSetLastNode(lastNode)
            await stateSetTransactionState(TransactionState.Finalized)
            txDetails.success = true
        } else {
            console.log("CHANGE In balance is NOT sufficient")
            console.log("Balance Change: ", destBalanceChangeStats.changeInBalance.toString())
            console.log("Minimum expected: ", minimumExpected.toString())
            console.log("Suffixient: ", sufficient.toString())
            txDetails.success = false
        }
        console.log("Tx Details Success: " + txDetails.success)
        // let feesAndGasAmount = startBalanceChangeStats.changeInBalance.minus(destBalanceChangeStats.changeInBalance).abs()

        console.log(
            `Execute Extrinsic Set Loop: Start Balance Change: ${JSON.stringify(startBalanceChangeStats.changeInBalanceDisplay)} | 
            Destination Balance Change: ${JSON.stringify(destBalanceChangeStats.changeInBalanceDisplay)} | 
            Transfer Fee Amount: (${transferFeeData.feeAssetId}) ${transferFeeData.feeAmount} | 
            Transfer Reserve Amount: (${transferFeeData.reserveAssetId}) ${transferFeeData.reserveAssetAmount} | 
            Deposit Fee Amount: (${depositFeeData.feeAssetId}) ${depositFeeData.feeAmount} | 
            Deposit Reserve Amount: (${depositFeeData.reserveAssetId}) ${depositFeeData.reserveAssetAmount}`
        )
        transferTxStats = {
            startChain: startChain,
            startParaId: startParaId,
            destChain: destChain,
            destParaId: destParaId,
            startAssetSymbol: startAssetSymbol,
            startAssetId: startAsset.getLocalId(),
            startBalanceStats: startBalanceChangeStats,
            destBalanceStats: destBalanceChangeStats,
            originFee: transferFeeData,
            destinationFee: depositFeeData,
        }
        
        arbExecutionResult = {
            assetSymbolIn: startAssetSymbol,
            assetSymbolOut: startAssetSymbol,
            assetAmountIn: startBalanceChangeStats.changeInBalanceDisplay,
            assetAmountOut: destBalanceChangeStats.changeInBalanceDisplay,
            blockHash: blockHash,
            result: `SUCCESS: ${txDetails.success} - TRANSFER: (${startChain} ${startParaId} ${startAssetSymbol} ${startBalanceChangeStats.changeInBalance} -> ${destChain} ${destParaId} ${startAssetSymbol} ${destBalanceChangeStats.changeInBalance}) |
            Transfer Fee: ${transferFeeData.feeAssetSymbol} ${transferFeeData.feeAmount} | Transfer Reserve: ${transferFeeData.reserveAssetAmount!} |
            Deposit Fee: ${depositFeeData.feeAssetSymbol} ${depositFeeData.feeAmount} | Deposit Reserve ${depositFeeData.reserveAssetAmount} |
            START: ${startBalanceChangeStats.changeInBalanceDisplay} -> DEST: ${destBalanceChangeStats.changeInBalanceDisplay}`
        }
        extrinsicResultData = {
            success: txDetails.success,
            arbExecutionResult: arbExecutionResult,
            transferTxStats: transferTxStats,
            lastNode: lastNode,
        }
        await stateSetResultData(extrinsicResultData)
        console.log(`***** Extrinsic set result LAST NODE PATH VALUE: ${JSON.stringify(lastNode.assetValue)}`)
        return extrinsicResultData
    } else {
        console.log("Chain not supported")
    }
    console.log("---------------------------------------------")
}


// only Return undefined when testing
export async function executeTransferExtrinsic(transfer: ExtrinsicContainer, signer: KeyringPair, chopsticks: boolean): Promise<TxDetails | undefined> {
    if(!isTransferExtrinsicContainer(transfer)) throw new Error("Not a transfer extrinsic container")
    let relay = transfer.relay
    let tx = transfer.extrinsic
    const startAsset = transfer.startAsset
    // signer.
    // let txNonce = 0

    // Dont need to check for local rpc, will already have been checked in calling function
    let execute;
    if(chopsticks){
        let localRpc = localRpcs[transfer.startNode]
        if(localRpc){
            execute = true
        } else {
            execute = false
        }
    } else {
        execute = true
    }
    
    // Execute transfer if running live or if chopsticks and local rpc is set for the chain
    if(execute){
        // console.log("EXECUTING TRANSFER")
        console.log("**************************************")
        console.log(`Execute Transfer: (${transfer.startNode} -> ${transfer.destinationNode}) ${JSON.stringify(startAsset.getAssetSymbol())} ${JSON.stringify(startAsset.getLocalId())}`)
        console.log("**************************************")

        let txResult= executeXcmTransfer(tx, signer)
        console.log("Execute Transfer: tx promise created")
        let txDetails: Promise<TxDetails> = txResult;
        return txDetails
    } else {
        console.log("Execute Transfer: NOT EXECUTING TRANSFER")
    } 
    // return false
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
// The rest of the loop uses a build function and an execute function
export async function buildAndExecuteSwapExtrinsic(
    relay: Relay, 
    instructionsToExecute: SwapInstruction[], 
    chopsticks: boolean, 
    executeMovr: boolean, 
    nextInputValue: string,
): Promise<[(SingleSwapResultData | SingleTransferResultData | undefined), SwapInstruction[]]>{
    if(Number.parseFloat(nextInputValue) > 0){
        instructionsToExecute[0].assetNodes[0].pathValue = nextInputValue
    }
    let [swapExtrinsicContainer, remainingInstructions] = await buildSwapExtrinsicDynamic(relay, instructionsToExecute, chopsticks);
    // let extrinsicObj: ExtrinsicObject = await createSwapExtrinsicObject(swapExtrinsicContainer)
    
    let extrinsicResultData: SingleTransferResultData | SingleSwapResultData | undefined = await executeAndReturnExtrinsic(swapExtrinsicContainer, chopsticks, executeMovr)
    return [extrinsicResultData, remainingInstructions]
}

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

export async function executePreTransfers(relay: Relay, preTransfers: PreExecutionTransfer[], chopsticks: boolean){
    let results: Promise<TxDetails>[] = []
    for (let i = 0; i < preTransfers.length; i++){
        let transfer = preTransfers[i]
        let fromChainId = transfer.fromChainId
        let fromChainApi = await getApiForNode(transfer.fromChainNode, chopsticks)
        let toChainId = transfer.toChainId
        let toChainApi = await getApiForNode(transfer.toChainNode, chopsticks)
        let transferAmount = transfer.transferAmount
        console.log(`Sending ${transferAmount.toNumber()} from ${preTransfers[i].fromChainNode} -> ${preTransfers[i].toChainNode}`)
        let signerAccount = preTransfers[i].fromChainAccount
        let transferExtrinsic = preTransfers[i].extrinsic

        let startAsset = new MyAsset(getAssetRegistryObjectBySymbol(fromChainId, "KSM", relay))
        let destAsset = new MyAsset(getAssetRegistryObjectBySymbol(toChainId, "KSM", relay))

        let startBalanceUnsub, destBalanceUnsub;
        console.log("Execute Extrinsic Set Loop: Initiating balance adapter for START chain " + transfer.fromChainNode)
        let startBalanceObservable$ = await watchTokenBalance(relay, fromChainId, chopsticks, fromChainApi, startAsset, transfer.fromChainNode, transfer.fromChainAccount.address) 
        let startBalanceChangePromise = getBalanceChange(startBalanceObservable$, (unsub) =>{
            startBalanceUnsub = unsub
        })
        console.log("Execute Extrinsic Set Loop: Initiating balance adapter for DESTINATION chain " + transfer.toChainNode)
        //***************************************************
        // Trying to get origin balance and then requery until new balance. Might work better than subscribe
        let toChainBalanceBefore = await getBalance(toChainId, relay, chopsticks, toChainApi, destAsset, transfer.toChainNode, transfer.toChainAccount.address)
        let destBalanceObservable$ = await watchTokenBalance(relay, toChainId, chopsticks, toChainApi, destAsset, transfer.toChainNode, transfer.toChainAccount.address)
        let destBalanceChangePromise = getBalanceChange(destBalanceObservable$, (unsub) =>{
            destBalanceUnsub = unsub
        })
        console.log(`(${transfer.fromChainNode} -> ${transfer.toChainNode} ${transfer.transferAmount.toNumber()}`)
        // console.log(extrinsic.toHuman())
        let txDetailsPromise: Promise<TxDetails>;
        try{
            // **************************************************************************************
            txDetailsPromise = executeTransferTx(transferExtrinsic, signerAccount)
            // **************************************************************************************
            console.log("Execute Extrinsic Set Loop: Transfer promise created")
            let txDetails = await txDetailsPromise

            let balanceChangeObserved = false
            let queryAttemps = 0;
            while (!balanceChangeObserved && queryAttemps < 10){
                queryAttemps++
                console.log("QUERYING BALANCE")
                let toChainBalanceAfter = await getBalance(toChainId, relay, chopsticks, toChainApi, destAsset, transfer.toChainNode, transfer.toChainAccount.address)
                let changeInBalance = toChainBalanceAfter.available.minus(toChainBalanceBefore.available )
                if(changeInBalance.gt(new FixedPointNumber(0))){
                    console.log("QUERY: Balance change observed")
                    console.log(`Balance change: ${changeInBalance.toString()}`)
                    balanceChangeObserved = true
                    destBalanceUnsub()
                    let toChainBalanceStats: BalanceChangeStats = {
                        startBalance: toChainBalanceBefore.available,
                        endBalance: toChainBalanceAfter.available,
                        changeInBalance: changeInBalance,
                        startBalanceString: toChainBalanceBefore.toString(),
                        endBalanceString: toChainBalanceAfter.toString(),
                        changeInBalanceString: changeInBalance.toString()
                    }
                } else {
                    console.log("BALANCE QUERIED AND NO CHANGE IN BALANCE, waiting 10 seconds")
                    await new Promise(resolve => setTimeout(resolve, 10000))
                }
            }
        
        } catch (e) {


        }
        let txResult = await executeTransferTx(transfer.extrinsic, signerAccount)
        // results.push(txResult)   
    }
    return results
}

// If execution fails mid transaction, we need to confirm the last transaction was successful and set last node accordingly 
export async function confirmLastTransactionSuccess(lastTransactionProperties: TransferProperties | SwapProperties){
    console.log("CONFIRMING LAST TRANSACTION....")
    let transactionSuccess = false
    if(isTransferProperties(lastTransactionProperties)){
        let transferProperties = lastTransactionProperties as TransferProperties
        const startAsset = transferProperties.startAsset
        const destAsset = transferProperties.destAsset
        const relay = transferProperties.relay
        const startApi = await getApiForNode(startAsset.chain, transferProperties.chopsticks)
        const destApi = await getApiForNode(destAsset.chain, transferProperties.chopsticks)
        const startNodeCurrentBalance = await getBalance(startAsset.getChainId(), relay, transferProperties.chopsticks, startApi, startAsset.asset, startAsset.chain, transferProperties.startAddress) 
        const destNodeCurrentBalance = await getBalance(destAsset.getChainId(), relay, transferProperties.chopsticks, destApi, destAsset.asset, destAsset.chain, transferProperties.destAddress)

        const startNodeStartBalance: FixedPointNumber = (transferProperties.startNodeStartBalance.free as any)
        const destNodeStartBalance: FixedPointNumber = (transferProperties.destNodeStartBalance.free as any)

        console.log(`Previous Balances: Start: ${startNodeStartBalance.toString()} | Dest: ${destNodeStartBalance.toString()}`)

        const startNodeBalanceChange: FixedPointNumber = startNodeCurrentBalance.free.minus(startNodeStartBalance).abs()
        const destNodeBalanceChange: FixedPointNumber = destNodeCurrentBalance.free.minus(destNodeStartBalance).abs()

        const minimumExpected = new FixedPointNumber(transferProperties.inputAmount, Number.parseInt(transferProperties.assetDecimals)).times(new FixedPointNumber(0.90))
        const startChangeSufficient = startNodeBalanceChange.minus(minimumExpected)
        const destChangeSufficient = destNodeBalanceChange.minus(minimumExpected)
        if(startChangeSufficient.gt(new FixedPointNumber(0)) && destChangeSufficient.gt(new FixedPointNumber(0))){
            transactionSuccess = true
            console.log("LAST TRANSACTION (TRANSFER) WAS SUCCESSFUL")
            const lastSuccessfulNode: LastNode = {
                assetKey: destAsset.getAssetKey(),
                assetValue: destNodeBalanceChange.toString(),
                assetSymbol: destAsset.getAssetSymbol(),
                chainId: destAsset.getChainId()
            }
            console.log("Last Transfer Extrinsic successful. setting last node...")
            await stateSetLastNode(lastSuccessfulNode)
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
        const assetInCurrentBalance = await getBalance(chainId, relay, swapProperties.chopsticks, swapNodeApi,  assetIn.asset, chain, swapProperties.address)
        const assetOutCurrentBalance = await getBalance(chainId, relay, swapProperties.chopsticks, swapNodeApi, assetOut.asset, chain, swapProperties.address)
        const assetInCurrentBalanceBn = new bn(assetInCurrentBalance.free.toChainData())
        const assetOutCurrentBalanceBn = new bn(assetOutCurrentBalance.free.toChainData())

        console.log("SWAP PROPERTIES: " + JSON.stringify(swapProperties, null, 2))
        console.log("ASSET IN START BALANCE: " + JSON.stringify(swapProperties.assetInStartBalance.free))

        const assetInStartBalanceBn = new bn((swapProperties.assetInStartBalance.free as any).inner)
        const assetOutStartBalanceBn = new bn((swapProperties.assetOutStartBalance.free as any).inner)

        const assetInBalanceChangeBn = assetInStartBalanceBn.minus(assetInCurrentBalanceBn).abs()
        const assetOutBalanceChangeBn = assetOutStartBalanceBn.minus(assetOutCurrentBalanceBn).abs()

        const assetInMinimumBalanceChange = new FixedPointNumber(swapProperties.inputAmount, assetIn.getDecimals()).times(new FixedPointNumber(0.90))
        console.log("Asset in minimum balance change: " + assetInMinimumBalanceChange.toChainData())

        const assetInBalanceChangeMinimumBn = new bn(swapProperties.inputAmount).times(new bn(0.90))
        const assetInChangeSufficientBn = assetInBalanceChangeBn.gte(assetInBalanceChangeMinimumBn)
        console.log(`As BigNumber: Asset In Balance Change: ${assetInBalanceChangeBn} | Asset In Minimum Balance Change: ${assetInBalanceChangeMinimumBn} | Asset In Change Sufficient: ${assetInChangeSufficientBn}`)

        // const assetOutBalanceChangeBn = new bn(assetOutBalanceChange.toChainData())
        const assetOutBalanceChangeSufficientBn = assetOutBalanceChangeBn.gt(new bn(0))
        console.log(`As BigNumber: Asset out balance change ${assetOutBalanceChangeBn} | Asset out balance change sufficient: ${assetOutBalanceChangeSufficientBn}`)

        if(assetInChangeSufficientBn && assetOutBalanceChangeSufficientBn){
            transactionSuccess = true
            console.log("LAST TRANSACTION (SWAP) WAS SUCCESSFUL")
            const assetOutBalanceChangeReadable = assetOutBalanceChangeBn.div(new bn(10).pow(new bn(assetOut.getDecimals())))
            const lastSuccessfulNode: LastNode = {
                assetKey: swapProperties.destAssetKey,
                assetValue: assetOutBalanceChangeReadable.toString(),
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


export async function collectRelayToken(relay: Relay, chopsticks: boolean, executeMovr: boolean, nativeBalances: NativeBalancesType, startChainId: number){
    let allocationPaths = await collectKsmToRelayPaths(relay,  nativeBalances, startChainId)
    let allocationInstructions = await Promise.all(allocationPaths.map(async (path) => buildInstructionSet(relay, path)))

    console.log("Executing allocations from chains to Kusama")
    // const { globalState } = await import("./liveTest.ts");
    stateSetTracking(false)
    // Async execution
    let allocationExecutionResultsPromise = allocationInstructions.map(async (instructionSet) => {
        let transferInstructions: TransferInstruction[] = instructionSet as TransferInstruction[]
        // const { buildAndExecuteAllocationExtrinsics } = await import("./liveTest.ts");
        let allocationExecution = buildAndExecuteAllocationExtrinsics(relay, transferInstructions, chopsticks, executeMovr)
        return allocationExecution
    })

    let allocationExecutionResults = await Promise.all(allocationExecutionResultsPromise)

    // Turn it back on for the rest of the execution
    stateSetTracking(true)

    allocationExecutionResults.forEach((result) => {
        console.log("ALLOCATION SUCCESS: " + result.success)
        console.log(JSON.stringify(result.arbExecutionResult, null, 2))
    })

    return allocationExecutionResults
    
}


// Get balance of native token accross chains. If RELAY chain has low funds, collect all funds to relay. Return balances of all chains
export async function checkAndAllocateRelayToken(relay: Relay, startChainId: number, chopsticks: boolean, inputAmount: number, executeMovr: boolean){
    let nativeBalancesSuccess = false;
    let nativeBalancesQueries = 0;
    let nativeBalances;
    const relayChainMinimum = relay == 'kusama' ? 0.01 : 1
    const relayTokenMinimum = relay == 'kusama' ? 0.01 : 0.02 // Keep a small bit of token on each chain to not reap the account
    let executedAllocation = false;
    while(!nativeBalancesSuccess && nativeBalancesQueries < 3){
        console.log("Querying Relay Token Balances")
        nativeBalancesQueries += 1
        try{
            // Query balances. Query may fail
            nativeBalances = await getRelayTokenBalances(chopsticks, relay)
            // console.log("NATIVE BALANCES")
            // console.log(nativeBalances)
            nativeBalancesSuccess = true

            // Allocate relay token if needed
            if(nativeBalances[0] < inputAmount + relayChainMinimum){
                console.log("Insufficient Relay Token balance. Collecting ksm to relay")
                executedAllocation = true
                await collectRelayToken(relay, chopsticks,  executeMovr, nativeBalances, startChainId)
                nativeBalancesSuccess = false;
            }
        } catch(e){
            console.log(e)
            console.log("KSM query failed. Retrying")
        }
    }
    if(!nativeBalancesSuccess){
        throw new Error("Failed to query Relay Token balances")
    }
    // Query balances again after allocation

    nativeBalancesQueries = 0
    while(executedAllocation && !nativeBalancesSuccess && nativeBalancesQueries < 3){
        console.log("Query balance again after executing allocation")
        nativeBalancesQueries += 1
        try{
            nativeBalances = await getRelayTokenBalances(chopsticks, relay)
            nativeBalancesSuccess = true
        } catch(e) {
            console.log(e)
            console.log("Relay Token query failed. Retrying")
        }
    }
    if(!nativeBalancesSuccess){
        throw new Error("Failed to query Relay Token balances")
    }
    return nativeBalances
    
}

export async function allocateFundsForSwap(relay: Relay, assetPath: AssetNode[],  nativeBalances: any, chopsticks: boolean, executeMovr: boolean){
    let startChain = assetPath[0].getChainId()
    let startValue = assetPath[0].getPathValueAsNumber()

    console.log("ALLOCATING FUNDS FOR SWAP")
    let executionPath: AssetNode[] = assetPath
    if(new bn(nativeBalances[startChain]).lt(startValue)){
        
        // Build allocation All chains -> relay chain && relay chain -> startChain when enough allocation
        console.log("*** StartNode has insufficient start balance. Need to allocate")
        let allocationPaths: AssetNode[][] = await getPreTransferPath(relay, startChain, startValue, nativeBalances)
        
        // Execute allocations to RELAY, then add RELAY -> StartNode to execution path
        if(allocationPaths.length > 1){
            let ksmAllocationPath = allocationPaths.pop()!
            await allocateKsmFromPreTransferPaths(relay, allocationPaths, chopsticks, executeMovr)
            executionPath = ksmAllocationPath.concat(assetPath)
        } else {
            executionPath = allocationPaths[0].concat(assetPath)
        }
    }  else {
        console.log("SWAP CHAIN HAS ENOUGH FUNDS")
    }
    return executionPath
}

export async function allocateFundsForSwapFromRelay(relay: Relay, assetPath: AssetNode[],  nativeBalances: any, chopsticks: boolean, executeMovr: boolean){
    let startChain = assetPath[0].getChainId()
    let startValue = assetPath[0].getPathValueAsNumber()

    // console.log("Checking balance again to allocate funds for swap")
    let nativeBalancesRefreshed = await getRelayTokenBalances(chopsticks, relay)

    // console.log("Native Balances: " + JSON.stringify(nativeBalancesRefreshed))

    console.log("ALLOCATING FUNDS FOR SWAP")
    let executionPath: AssetNode[] = assetPath
    if(new bn(nativeBalancesRefreshed[startChain]).lt(startValue)){
        
        // Build allocation All chains -> relay chain && relay chain -> startChain when enough allocation
        console.log("*** StartNode has insufficient start balance. Need to allocate")
        let allocationNode: AssetNode[] = await getFundingPath(relay, startChain, startValue, nativeBalancesRefreshed)
        executionPath = allocationNode.concat(assetPath)
    }  else {
        console.log("SWAP CHAIN HAS ENOUGH FUNDS")
    }
    return executionPath
}

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