import { DispatchError, EventRecord, ExtrinsicStatus, H256, Hash } from "@polkadot/types/interfaces"
import { BN } from "@polkadot/util/bn"
import { checkAndApproveToken } from "./../swaps/movr/utils/utils.ts"
import { AssetNode } from "./AssetNode.ts"
import { testNets, localRpcs } from "./txConsts.ts"
import { ExtrinsicObject, IndexObject, SingleSwapResultData, SwapTxStats, ArbExecutionResult, TxDetails, PathNodeValues, BalanceChangeStats, LastNode, SingleTransferResultData, TransferTxStats, TransferExtrinsicContainer, SwapExtrinsicContainer, SwapResultObject, SwapInstruction, ChainNonces, PreExecutionTransfer, TransactionState, TransferProperties, SwapProperties, Relay, TransferInstruction, NativeBalancesType, FeeData, ReserveFeeData, BalanceChangeStatsBn, PromiseTracker, TransferDepositEventData } from "./types.ts"
import { getSigner, increaseIndex, printExtrinsicSetResults, getLastSuccessfulNodeFromResultData, getAssetRegistryObjectBySymbol, getAssetRegistryObject, getAssetDecimalsFromLocation, getWalletAddressFormatted, isTxDetails } from "./utils.ts"
import { FixedPointNumber, Token } from "@acala-network/sdk-core";
import { buildSwapExtrinsicDynamic, createSwapExtrinsicObject } from "./extrinsicUtils.ts"
import { getApiForNode } from "./apiUtils.ts"
import { BalanceData } from "src/types.ts"
import * as paraspell from '@paraspell/sdk'
import {KeyringPair} from '@polkadot/keyring/types'
import { allocateKsmFromPreTransferPaths, buildInstructionSet, collectKsmToRelayPaths, getFundingPath, getPreTransferPath } from "./instructionUtils.ts"
import { getBalance, getBalanceChange, getBalanceFromId, getDisplayBalance, getRelayTokenBalances, watchTokenBalance, watchTokenDeposit } from "./balanceUtils.ts"
import { setLastNode, setResultData, setTransactionState, setTransctionProperties, updateAccumulatedFeeData, updateXcmFeeReserves } from "./globalStateUtils.ts"
import {BigNumber as bn } from "bignumber.js"
import { swapManagerContractLive } from "./../swaps/glmr/utils/const.ts"
import { createFeeDatas, createReserveFees, getTransferType, getXcmTransferEventData, listenForXcmpDepositEvent } from "./feeUtils.ts"
import { WsProvider, ApiPromise, Keyring, ApiRx } from '@polkadot/api'
import { logEventFeeBook } from "./logUtils.ts"
// import { H256 } from '@polkadot/types/primitive';
bn.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 }) // Set to max precision


export async function executeSingleSwapExtrinsicMovr(extrinsicObj: ExtrinsicObject, extrinsicIndex: IndexObject, chopsticks: boolean): Promise<SingleSwapResultData>{
    if (!extrinsicObj.swapExtrinsicContainer) throw new Error("Evm swap container undefined")

    let movrTx = extrinsicObj.swapExtrinsicContainer.extrinsic
    let relay = extrinsicObj.swapExtrinsicContainer.relay
    let chain = extrinsicObj.swapExtrinsicContainer.chain
    let api = extrinsicObj.swapExtrinsicContainer.api!
    let chainId = extrinsicObj.swapExtrinsicContainer.chainId
    let assetInSymbol = extrinsicObj.swapExtrinsicContainer.assetSymbolIn
    let assetOutSymbol = extrinsicObj.swapExtrinsicContainer.assetSymbolOut
    // let assetIn = extrinsicObj.swapExtrinsicContainer.pathInLocalId
    // let assetOut = extrinsicObj.swapExtrinsicContainer.pathOutLocalId
    let expectedAmountIn = extrinsicObj.swapExtrinsicContainer.assetAmountIn
    let expectedAmountOut = extrinsicObj.swapExtrinsicContainer.expectedAmountOut
    let blockHash = ""
    if(extrinsicIndex.i == 0){
        let firstAssetNode = extrinsicObj.swapExtrinsicContainer.assetNodes[0]
    }
    let movrBatchSwapParams = extrinsicObj.swapExtrinsicContainer.movrBatchSwapParams!
    let liveWallet = movrBatchSwapParams.wallet
    let batchContract = movrBatchSwapParams.batchContract
    let tokens = movrBatchSwapParams.inputTokens
    let dexes = movrBatchSwapParams.dexAddresses
    let inputTokens = movrBatchSwapParams.inputTokens
    let outputTokens = movrBatchSwapParams.outputTokens
    let movrTxInfo = {
        inputTokens: inputTokens,
        outputTokens: outputTokens,
        dexes: dexes
    }

    let batchContractAddress = await batchContract.getAddress()
    console.log(`Wallet: ${liveWallet.address} | Batch Contract: ${batchContractAddress}`)
    // let signer = await getSigner(true)

    for(let i = 0; i < tokens.length; i++){
        let tokenInput = movrBatchSwapParams.amount0Ins[i] > 0 ? movrBatchSwapParams.amount0Ins[i] : movrBatchSwapParams.amount1Ins[i]
        let approval = await checkAndApproveToken(tokens[i], liveWallet, batchContractAddress, tokenInput)
    }

    // let tokenInBalanceStart = await getBalance(chainId, chopsticks, api, assetInSymbol, chain, liveWallet.address)
    // let tokenOutBalanceStart = await getBalance(chainId, chopsticks, api, assetOutSymbol, chain, liveWallet.address)

    //  *** Set transaction properties for state tracking ***
    let assetNodes = extrinsicObj.swapExtrinsicContainer.assetNodes
    let startAssetRegistryObject = extrinsicObj.swapExtrinsicContainer.assetNodes[0].assetRegistryObject;
    let destAssetRegistryObject = extrinsicObj.swapExtrinsicContainer.assetNodes[extrinsicObj.swapExtrinsicContainer.assetNodes.length - 1].assetRegistryObject;
    let assetInDecimals = assetNodes[0].assetRegistryObject.tokenData.decimals
    let assetOutDecimals = assetNodes[assetNodes.length - 1].assetRegistryObject.tokenData.decimals
    let destinationAssetKey = JSON.stringify(destAssetRegistryObject.tokenData.chain.toString() + JSON.stringify(destAssetRegistryObject.tokenData.localId))
    let signer = await getSigner(chopsticks, false)

    //***************************
    let tokenInBalanceStart = await getBalance(chainId, relay, chopsticks, api, assetInSymbol, startAssetRegistryObject, chain, signer.address)
    let tokenOutBalanceStart = await getBalance(chainId, relay, chopsticks, api, assetOutSymbol, destAssetRegistryObject, chain, signer.address)

    // let inBalanceStartNew = await getBalanceFromId()
    // let outBalanceStartNew

    // ***************************

    let swapProperties: SwapProperties = {
        type: 'Swap',
        relay: relay,
        chopsticks: chopsticks,
        node: chain,
        paraId: chainId,
        address: signer.address,
        assetInSymbol: assetInSymbol,
        assetInLocalId: startAssetRegistryObject.tokenData.localId,
        assetInStartBalance: tokenInBalanceStart,
        assetInStartBalanceString: tokenInBalanceStart.free.toString(),
        assetOutSymbol: assetOutSymbol,
        assetOutLocalId: destAssetRegistryObject.tokenData.localId,
        assetOutStartBalance: tokenOutBalanceStart,
        assetOutStartBalanceString: tokenOutBalanceStart.free.toString(),
        inputAmount: expectedAmountIn.toChainData(),
        assetInDecimals: assetInDecimals,
        assetOutDecimals: assetOutDecimals,
        destAssetKey: destinationAssetKey
    }
    setTransctionProperties(swapProperties, relay)
    // ******************************************************
    let unsubscribeOne, unsubscribeTwo;
    let balanceObservableIn$ = await watchTokenBalance(relay, chainId, chopsticks, api, assetInSymbol, startAssetRegistryObject, chain, liveWallet.address)
    let balanceObservableOut$ = await watchTokenBalance(relay, chainId, chopsticks, api, assetOutSymbol, destAssetRegistryObject, chain, liveWallet.address)
    let balancePromiseIn = getBalanceChange(balanceObservableIn$, (unsub) => {
        unsubscribeOne = unsub
    })
    let balancePromiseOut = getBalanceChange(balanceObservableOut$, (unsub) => {
        unsubscribeTwo = unsub
    })

    try{
        // **************************************************************************************
        setTransactionState(TransactionState.Broadcasted, relay)
        let txReceipt = await movrTx()
        let txHash = await txReceipt.wait()
        blockHash = txHash.blockHash
        // **************************************************************************************

        let tokenInBalanceStats = await balancePromiseIn
        let tokenOutBalanceStats = await balancePromiseOut
        console.log(`EXPECTED TOKEN IN ${expectedAmountIn.toString()} || ACTUAL TOKEN IN ${JSON.stringify(tokenInBalanceStats.changeInBalance.toString())}`)
        console.log(`EXPECTED TOKEN OUT ${expectedAmountOut.toString()} || ACTUAL TOKEN OUT ${JSON.stringify(tokenOutBalanceStats.changeInBalance.toString())}`)
        let assetRegistryObject = extrinsicObj.swapExtrinsicContainer.assetNodes[extrinsicObj.swapExtrinsicContainer.assetNodes.length - 1].assetRegistryObject;
        // let assetRegistryObject = extrinsicObj.swapExtrinsicContainer.assetNodes[extrinsicObj.swapExtrinsicContainer.assetNodes.length - 1].assetRegistryObject;
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
            await setLastNode(lastNode, relay)
            await setTransactionState(TransactionState.Finalized, relay)
        }

        

        let swapStats: SwapTxStats = {
            txHash: txHash,
            chain: chain,
            paraId: chainId,
            currencyIn: assetInSymbol,
            currencyOut: assetOutSymbol,
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
        
        let inputReadable = new bn(actualAmountIn).div(new bn(10).pow(assetInDecimals)).toString()
        let outputReadable = new bn(actualAmountOut).div(new bn(10).pow(assetOutDecimals)).toString()
        
        let arbResultString: ArbExecutionResult = {
            assetSymbolIn: assetInSymbol,
            assetSymbolOut: assetOutSymbol,
            assetAmountIn: inputReadable,
            assetAmountOut: outputReadable,
            blockHash : blockHash,
            result: `SUCCESS: ${true} - SWAP: (${chain}) ${chainId} ${assetInSymbol} ${actualAmountIn}-> ${assetOutSymbol} ${actualAmountOut}| Dexes: ${JSON.stringify(dexes)}`
        }
        let txDetails: TxDetails = {
            success: swapSuccess,
            txHash: txHash,
            movrInfo: movrTxInfo
        }
        let swapTxResult = {
            txString: `(${chain}) ${chainId} ${assetInSymbol} -> ${assetOutSymbol}`,
            txDetails: txDetails
        }
        let pathValueNext = Number.parseFloat(tokenOutBalanceStats.changeInBalanceDisplay)
        let pathNode: PathNodeValues = {
            // pathInLocalId: extrinsicObj.swapExtrinsicContainer.pathInLocalId,
            // pathOutLocalId: extrinsicObj.swapExtrinsicContainer.pathOutLocalId,
            pathInSymbol: assetInSymbol,
            pathOutSymbol: assetOutSymbol,
            pathSwapType: extrinsicObj.swapExtrinsicContainer.pathType,
            pathValue: extrinsicObj.swapExtrinsicContainer.pathAmount,
            pathValueNext: pathValueNext
        
        }

        

        let swapResultData: SingleSwapResultData = {
            success: swapSuccess,
            arbExecutionResult: arbResultString,
            resultPathNode: pathNode,
            swapTxStats: swapStats,
            swapTxResults: swapTxResult,
            lastNode: lastNode,
            extrinsicIndex: extrinsicIndex.i
        }
        await setResultData(swapResultData, relay)
        return swapResultData
    } catch(e){
        unsubscribeOne()
        unsubscribeTwo()
        console.log("ERROR: " + e)
        console.log("MOVR swap failed")
        let txDetails: TxDetails = {
            success: false,
            movrInfo: movrTxInfo
        }
        let swapTxResult = {
            txString: `(${chain}) ${chainId} ${assetInSymbol} -> ${assetOutSymbol}`,
            txDetails: txDetails
        }

        let inputReadable = new bn(expectedAmountIn.abs().toChainData()).div(new bn(10).pow(assetInDecimals)).toString()
        let arbResultString: ArbExecutionResult = {
            assetSymbolIn: assetInSymbol,
            assetSymbolOut: assetOutSymbol,
            assetAmountIn: inputReadable,
            assetAmountOut: "0",
            blockHash: blockHash,
            result: `SUCCESS: ${false} - SWAP: (${chain}) ${chainId} ${assetInSymbol} ${expectedAmountIn} -> ${assetOutSymbol} | Dexes: ${JSON.stringify(dexes)}`
        }
        let pathNode: PathNodeValues = {
            // pathInLocalId: extrinsicObj.swapExtrinsicContainer.pathInLocalId,
            // pathOutLocalId: extrinsicObj.swapExtrinsicContainer.pathOutLocalId,
            pathInSymbol: assetInSymbol,
            pathOutSymbol: assetOutSymbol,
            pathSwapType: extrinsicObj.swapExtrinsicContainer.pathType,
            pathValue: extrinsicObj.swapExtrinsicContainer.pathAmount,
            pathValueNext:0
        }

        let swapResultData: SingleSwapResultData = {
            success: false,
            arbExecutionResult: arbResultString,
            resultPathNode: pathNode,
            swapTxStats: null,
            swapTxResults: swapTxResult,
            lastNode: null,
            extrinsicIndex: extrinsicIndex.i
        }

        await setResultData(swapResultData, relay)

        return swapResultData
    }
}

export async function executeSingleSwapExtrinsicGlmr(extrinsicObj: ExtrinsicObject, extrinsicIndex: IndexObject, chopsticks: boolean): Promise<SingleSwapResultData>{
    if (!extrinsicObj.swapExtrinsicContainer) throw new Error("Evm swap tx container undefined")
    let glmrTx = extrinsicObj.swapExtrinsicContainer.extrinsic
    let relay = extrinsicObj.swapExtrinsicContainer.relay
    let chain = extrinsicObj.swapExtrinsicContainer.chain
    let api = extrinsicObj.swapExtrinsicContainer.api!
    let chainId = extrinsicObj.swapExtrinsicContainer.chainId
    let assetInSymbol = extrinsicObj.swapExtrinsicContainer.assetSymbolIn
    let assetOutSymbol = extrinsicObj.swapExtrinsicContainer.assetSymbolOut
    // let assetIn = extrinsicObj.swapExtrinsicContainer.pathInLocalId
    // let assetOut = extrinsicObj.swapExtrinsicContainer.pathOutLocalId
    let expectedAmountIn = extrinsicObj.swapExtrinsicContainer.assetAmountIn
    let expectedAmountOut = extrinsicObj.swapExtrinsicContainer.expectedAmountOut
    let blockHash = ""
    if(extrinsicIndex.i == 0){
        let firstAssetNode = extrinsicObj.swapExtrinsicContainer.assetNodes[0]
    }

    let managerContractAddress = swapManagerContractLive

    let managerSwapParams = extrinsicObj.swapExtrinsicContainer.glmrSwapParams!
    let liveWallet = managerSwapParams
    // let batchContract = managerSwapParams.batchContract
    // let tokens = managerSwapParams.inputTokens
    // let dexes = managerSwapParams.dexAddresses
    // let inputTokens = managerSwapParams.inputTokens
    // let outputTokens = managerSwapParams.outputTokens
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

    // let batchContractAddress = await batchContract.getAddress()
    // console.log(`Wallet: ${liveWallet.address} | Batch Contract: ${batchContractAddress}`)
    // let signer = await getSigner(true)

    // for(let i = 0; i < tokens.length; i++){
    //     let tokenInput = managerSwapParams.amount0Ins[i] > 0 ? managerSwapParams.amount0Ins[i] : managerSwapParams.amount1Ins[i]
    //     let approval = await checkAndApproveToken(tokens[i], liveWallet, batchContractAddress, tokenInput)
    // }

    // let tokenInBalanceStart = await getBalance(chainId, chopsticks, api, assetInSymbol, chain, liveWallet.address)
    // let tokenOutBalanceStart = await getBalance(chainId, chopsticks, api, assetOutSymbol, chain, liveWallet.address)

    //  *** Set transaction properties for state tracking ***
    let assetNodes = extrinsicObj.swapExtrinsicContainer.assetNodes
    let startAssetRegistryObject = extrinsicObj.swapExtrinsicContainer.assetNodes[0].assetRegistryObject;
    let destAssetRegistryObject = extrinsicObj.swapExtrinsicContainer.assetNodes[extrinsicObj.swapExtrinsicContainer.assetNodes.length - 1].assetRegistryObject;
    let assetInDecimals = assetNodes[0].assetRegistryObject.tokenData.decimals
    let assetOutDecimals = assetNodes[assetNodes.length - 1].assetRegistryObject.tokenData.decimals
    let destinationAssetKey = JSON.stringify(destAssetRegistryObject.tokenData.chain.toString() + JSON.stringify(destAssetRegistryObject.tokenData.localId))
    let signer = await getSigner(chopsticks, true)
    let tokenInBalanceStart = await getBalance(chainId, relay, chopsticks, api, assetInSymbol, startAssetRegistryObject, chain, signer.address)
    let tokenOutBalanceStart = await getBalance(chainId, relay, chopsticks, api, assetOutSymbol, destAssetRegistryObject, chain, signer.address)
    let swapProperties: SwapProperties = {
        type: 'Swap',
        relay: relay,
        chopsticks: chopsticks,
        node: chain,
        paraId: chainId,
        address: signer.address,
        assetInSymbol: assetInSymbol,
        assetInLocalId: startAssetRegistryObject.tokenData.localId,
        assetInStartBalance: tokenInBalanceStart,
        assetInStartBalanceString: tokenInBalanceStart.free.toString(),
        assetOutSymbol: assetOutSymbol,
        assetOutLocalId: destAssetRegistryObject.tokenData.localId,
        assetOutStartBalance: tokenOutBalanceStart,
        assetOutStartBalanceString: tokenOutBalanceStart.free.toString(),
        inputAmount: expectedAmountIn.toChainData(),
        assetInDecimals: assetInDecimals,
        assetOutDecimals: assetOutDecimals,
        destAssetKey: destinationAssetKey
    }
    setTransctionProperties(swapProperties, relay)
    // ******************************************************
    let unsubscribeOne, unsubscribeTwo;
    let balanceObservableIn$ = await watchTokenBalance(relay, chainId, chopsticks, api, assetInSymbol, startAssetRegistryObject, chain, signer.address)
    let balanceObservableOut$ = await watchTokenBalance(relay, chainId, chopsticks, api, assetOutSymbol, destAssetRegistryObject, chain, signer.address)
    let balancePromiseIn = getBalanceChange(balanceObservableIn$, (unsub) => {
        unsubscribeOne = unsub
    })
    let balancePromiseOut = getBalanceChange(balanceObservableOut$, (unsub) => {
        unsubscribeTwo = unsub
    })

    try{
        // **************************************************************************************
        setTransactionState(TransactionState.Broadcasted, relay)
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
        let assetRegistryObject = extrinsicObj.swapExtrinsicContainer.assetNodes[extrinsicObj.swapExtrinsicContainer.assetNodes.length - 1].assetRegistryObject;
        // let assetRegistryObject = extrinsicObj.swapExtrinsicContainer.assetNodes[extrinsicObj.swapExtrinsicContainer.assetNodes.length - 1].assetRegistryObject;
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
            await setLastNode(lastNode, relay)
            await setTransactionState(TransactionState.Finalized, relay)
        }

        

        let swapStats: SwapTxStats = {
            txHash: txHash,
            chain: chain,
            paraId: chainId,
            currencyIn: assetInSymbol,
            currencyOut: assetOutSymbol,
            expectedAmountIn: expectedAmountIn.toString(),
            actualAmountIn: tokenInBalanceStats.changeInBalance.toString(),
            expectedAmountOut: expectedAmountOut.toString(),
            actualAmountOut: tokenOutBalanceStats.changeInBalance.toString(),
            tokenInBalanceChange: tokenInBalanceStats,
            tokenOutBalanceChange: tokenOutBalanceStats,
        }
        let actualAmountIn = tokenInBalanceStats.changeInBalance.abs()
        let actualAmountOut = tokenOutBalanceStats.changeInBalance.abs()
        let inputReadable = new bn(actualAmountIn).div(new bn(10).pow(assetInDecimals)).toString()
        let outputReadable = new bn(actualAmountOut).div(new bn(10).pow(assetOutDecimals)).toString()
        // logSwapTxResults(tx, logFilePath)
        let arbResultString: ArbExecutionResult = {
            assetSymbolIn: assetInSymbol,
            assetSymbolOut: assetOutSymbol,
            assetAmountIn: inputReadable,
            assetAmountOut: outputReadable,
            blockHash : blockHash,
            result: `SUCCESS: ${true} - SWAP: (${chain}) ${chainId} ${assetInSymbol} ${actualAmountIn}-> ${assetOutSymbol} ${actualAmountOut}| Dexes: ${JSON.stringify(dexes)}`
        }
        let txDetails: TxDetails = {
            success: swapSuccess,
            txHash: txHash,
            glmrInfo: glmrTxInfo
        }
        let swapTxResult = {
            txString: `(${chain}) ${chainId} ${assetInSymbol} -> ${assetOutSymbol}`,
            txDetails: txDetails
        }
        let pathValueNext = Number.parseFloat(tokenOutBalanceStats.changeInBalanceDisplay)
        let pathNode: PathNodeValues = {
            pathInSymbol: assetInSymbol,
            pathOutSymbol: assetOutSymbol,
            pathSwapType: extrinsicObj.swapExtrinsicContainer.pathType,
            pathValue: extrinsicObj.swapExtrinsicContainer.pathAmount,
            pathValueNext: pathValueNext
        
        }

        

        let swapResultData: SingleSwapResultData = {
            success: swapSuccess,
            arbExecutionResult: arbResultString,
            resultPathNode: pathNode,
            swapTxStats: swapStats,
            swapTxResults: swapTxResult,
            lastNode: lastNode,
            extrinsicIndex: extrinsicIndex.i
        }
        await setResultData(swapResultData, relay)
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
            txString: `(${chain}) ${chainId} ${assetInSymbol} -> ${assetOutSymbol}`,
            txDetails: txDetails
        }
        let inputReadable = new bn(expectedAmountIn.toChainData()).div(new bn(10).pow(assetInDecimals)).toString()
        let arbResultString: ArbExecutionResult = {
            assetSymbolIn: assetInSymbol,
            assetSymbolOut: assetOutSymbol,
            assetAmountIn: inputReadable,
            assetAmountOut: "0",
            blockHash: blockHash,
            result: `SUCCESS: ${false} - SWAP: (${chain}) ${chainId} ${assetInSymbol} ${expectedAmountIn} -> ${assetOutSymbol} | Dexes: ${JSON.stringify(dexes)}`
        }
        let pathNode: PathNodeValues = {
            // pathInLocalId: extrinsicObj.swapExtrinsicContainer.pathInLocalId,
            // pathOutLocalId: extrinsicObj.swapExtrinsicContainer.pathOutLocalId,
            pathInSymbol: assetInSymbol,
            pathOutSymbol: assetOutSymbol,
            pathSwapType: extrinsicObj.swapExtrinsicContainer.pathType,
            pathValue: extrinsicObj.swapExtrinsicContainer.pathAmount,
            pathValueNext:0
        }

        let swapResultData: SingleSwapResultData = {
            success: false,
            arbExecutionResult: arbResultString,
            resultPathNode: pathNode,
            swapTxStats: null,
            swapTxResults: swapTxResult,
            lastNode: null,
            extrinsicIndex: extrinsicIndex.i
        }
        await setResultData(swapResultData, relay)

        return swapResultData
    }
}


function trackPromise(promise) {
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
export async function executeSingleSwapExtrinsic(extrinsicObj: ExtrinsicObject, extrinsicIndex: IndexObject, chopsticks: boolean): Promise<SingleSwapResultData>{
    console.log("Execute Single Swap Extrinsic ()")
    let swapTxContainer = extrinsicObj.swapExtrinsicContainer!
    let api = swapTxContainer.api!

    let relay = swapTxContainer.relay
    let chain = swapTxContainer.chain
    let chainId = swapTxContainer.chainId


    let expectedAmountIn = swapTxContainer.assetAmountIn
    let expectedAmountOut = swapTxContainer.expectedAmountOut
    let blockHash = ""

    let startAssetRegistryObject = swapTxContainer.assetNodes[0].assetRegistryObject;
    let destAssetRegistryObject = swapTxContainer.assetNodes[swapTxContainer.assetNodes.length - 1].assetRegistryObject;

    let assetOutSymbol = destAssetRegistryObject.tokenData.symbol
    let assetOutLocalId = destAssetRegistryObject.tokenData.localId
    let assetOutDecimals = destAssetRegistryObject.tokenData.decimals
    let assetInSymbol = startAssetRegistryObject.tokenData.symbol
    let assetInLocalId = startAssetRegistryObject.tokenData.localId
    let assetInDecimals = startAssetRegistryObject.tokenData.decimals

    let destinationAssetKey = JSON.stringify(destAssetRegistryObject.tokenData.chain.toString() + JSON.stringify(destAssetRegistryObject.tokenData.localId))

    let signer = await getSigner(chopsticks, false)
    let tokenInBalanceStart = await getBalance(chainId, relay, chopsticks, api, assetInSymbol, startAssetRegistryObject, chain, signer.address)
    let tokenOutBalanceStart = await getBalance(chainId, relay, chopsticks, api, assetOutSymbol, destAssetRegistryObject, chain, signer.address)

    let swapProperties: SwapProperties = {
        type: 'Swap',
        relay: relay,
        chopsticks: chopsticks,
        node: chain,
        paraId: chainId,
        address: signer.address,
        assetInSymbol: assetInSymbol,
        assetInLocalId: assetInLocalId,
        assetOutSymbol: assetOutSymbol,
        assetOutLocalId: assetOutLocalId,
        assetInStartBalance: tokenInBalanceStart,
        assetInStartBalanceString: tokenInBalanceStart.free.toString(),
        assetOutStartBalance: tokenOutBalanceStart,
        assetOutStartBalanceString: tokenOutBalanceStart.free.toString(),
        inputAmount: expectedAmountIn.toChainData(),
        assetInDecimals: assetInDecimals,
        assetOutDecimals: assetOutDecimals,
        destAssetKey: destinationAssetKey
    }
    setTransctionProperties(swapProperties, relay)

    let tokenInBalance$ = await watchTokenBalance(relay, chainId, chopsticks, api, assetInSymbol, startAssetRegistryObject, chain, signer.address)
    let tokenOutBalance$ = await watchTokenBalance(relay, chainId, chopsticks, api, assetOutSymbol, destAssetRegistryObject, chain, signer.address)

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
        let inputReadable = new bn(expectedAmountIn.toChainData()).div(new bn(10).pow(assetInDecimals)).toString()
        let arbString: ArbExecutionResult = {
            assetSymbolIn: assetInSymbol,
            assetSymbolOut: assetOutSymbol,
            assetAmountIn: inputReadable,
            assetAmountOut: "0",
            blockHash: blockHash,
            result:`FAILURE: SWAP: (${chain}) ${chainId} ${assetInSymbol} ${expectedAmountIn.toNumber()}-> ${assetOutSymbol} | ERROR: ${JSON.stringify(decodedError)}`
        }
        
        // REVIEW how movr swap tx details work
        let txDetails: TxDetails = {
            success: false,
            movrInfo: txDetailsResponse
        }
        let swapTxResult = {
            txString: `(${chain}) ${chainId} ${assetInSymbol} -> ${assetOutSymbol}`,
            txDetails: txDetails
        }

        let pathNode: PathNodeValues = {
            // pathInLocalId: swapTxContainer.pathInLocalId,
            // pathOutLocalId: swapTxContainer.pathOutLocalId,
            pathInSymbol: assetInSymbol,
            pathOutSymbol: assetOutSymbol,
            pathSwapType: swapTxContainer.pathType,
            pathValue: swapTxContainer.pathAmount,
            pathValueNext: 0
        }

        let extrinsicResultData: SingleSwapResultData = {
            success: false,
            arbExecutionResult: arbString,
            resultPathNode: pathNode,
            swapTxStats: null,
            swapTxResults: swapTxResult,
            lastNode: null,
            extrinsicIndex: extrinsicIndex.i
        }
        
        await setResultData(extrinsicResultData, relay)

        return extrinsicResultData
    }

    if(!tx.success){
        throw new Error("Swap Tx failed, but didnt throw error in catch")
    }
    console.log("() AWAIT getBalanceChange(tokenIn)")
    tokenInBalanceStats = await tokenInBalancePromise
    if(tokenInBalanceStats.changeInBalance.eq(new bn(0))){

        let tokenInBalanceEnd: BalanceData = await getBalance(chainId, relay, chopsticks, api, assetInSymbol, startAssetRegistryObject, chain, signer.address)
        let tokenInBalanceStartBn = tokenInBalanceStart.free._getInner()
        let tokenInBalanceEndBn = tokenInBalanceEnd.free._getInner()
        let balanceChangeAmount = tokenInBalanceEndBn.minus(tokenInBalanceStartBn).abs()
        
        tokenInBalanceStats = {
            startBalance: tokenInBalanceStartBn,
            endBalance: tokenInBalanceEndBn,
            changeInBalance: balanceChangeAmount,
            startBalanceDisplay: tokenInBalanceStartBn.div(new bn(10).pow(assetInDecimals)).toString(),
            endBalanceDisplay: tokenInBalanceEndBn.div(new bn(10).pow(assetInDecimals)).toString(),
            changeInBalanceDisplay: balanceChangeAmount.div(new bn(10).pow(assetInDecimals)).toString()
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
            let tokenOutBalanceEnd: BalanceData = await getBalance(chainId, relay, chopsticks, api, assetOutSymbol, destAssetRegistryObject, chain, signer.address)
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
                    startBalanceDisplay: tokenOutBalanceStartBn.div(new bn(10).pow(assetOutDecimals)).toString(),
                    endBalanceDisplay: tokenOutBalanceEndBn.div(new bn(10).pow(assetOutDecimals)).toString(),
                    changeInBalanceDisplay: balanceChangeAmount.div(new bn(10).pow(assetOutDecimals)).toString()
                }
                setTransactionState(TransactionState.Finalized, relay)
                tokenOutUnsub()
            } else {
                console.log("balanceQuery FAILED. Retrying in 10 seconds...")
                await new Promise(resolve => setTimeout(resolve, 10000))
            
            }
        }
    }


    
    let lastNode: LastNode = {
        assetKey: JSON.stringify(destAssetRegistryObject.tokenData.chain.toString() + JSON.stringify(destAssetRegistryObject.tokenData.localId)),
        assetValue: tokenOutBalanceStats.changeInBalanceDisplay,
        chainId: destAssetRegistryObject.tokenData.chain,
        assetSymbol: destAssetRegistryObject.tokenData.symbol
    }
    
    if(success){
        console.log("Swap Extrinsic successful. Setting last node...")
        await setLastNode(lastNode, relay)
    }
    
    
    console.log(`EXPECTED TOKEN IN ${expectedAmountIn.toString()} || EXPECTED TOKEN OUT ${expectedAmountOut.toString()}`)
    console.log(`ACTUAL TOKEN IN ${JSON.stringify(tokenInBalanceStats.changeInBalance.toString())} || ACTUAL TOKEN OUT ${(JSON.stringify(tokenOutBalanceStats.changeInBalance.toString()))}`)

    let swapStats: SwapTxStats = {
        txHash: txHash,
        chain: chain,
        paraId: chainId,
        currencyIn: assetInSymbol,
        currencyOut: assetOutSymbol,
        expectedAmountIn: expectedAmountIn.toString(),
        actualAmountIn: tokenInBalanceStats.changeInBalance.toString(),
        expectedAmountOut: expectedAmountOut.toString(),
        actualAmountOut: tokenOutBalanceStats.changeInBalance.toString(),
        tokenInBalanceChange: tokenInBalanceStats,
        tokenOutBalanceChange: tokenOutBalanceStats,
    } 

    let swapTxResult = {
        txString: `(${chain}) ${chainId} ${assetInSymbol} -> ${assetOutSymbol}`,
        txDetails: tx
    }

    let actualAmountIn
    if(success){
        actualAmountIn = tokenInBalanceStats.changeInBalance.abs()
    } else {
        actualAmountIn = expectedAmountIn.abs().toChainData()
    }
    
    let actualAmountOut = tokenOutBalanceStats.changeInBalance.abs()

    let inputReadable = new bn(actualAmountIn).div(new bn(10).pow(new bn(assetInDecimals))).toString()
    let outputReadable = new bn(actualAmountOut).div(new bn(10).pow(new bn(assetOutDecimals))).toString()

    let arbResultString: ArbExecutionResult = {
        assetSymbolIn: assetInSymbol,
        assetSymbolOut: assetOutSymbol,
        assetAmountIn: inputReadable,
        assetAmountOut: outputReadable,
        blockHash: blockHash,
        result:`SUCCESS: ${success} - SWAP: (${chain}) ${chainId} ${assetInSymbol} ${actualAmountIn}-> ${assetOutSymbol} ${actualAmountOut} | `
    }
    
    let pathValueNext = Number.parseFloat(tokenOutBalanceStats.changeInBalanceDisplay)

    let pathNode: PathNodeValues = {
        // pathInLocalId: swapTxContainer.pathInLocalId,
        // pathOutLocalId: swapTxContainer.pathOutLocalId,
        pathInSymbol: assetInSymbol,
        pathOutSymbol: assetOutSymbol,
        pathSwapType: swapTxContainer.pathType,
        pathValue: swapTxContainer.pathAmount,
        pathValueNext:pathValueNext
    }

    let extrinsicResultData: SingleSwapResultData;
    if(tokenOutBalanceStats.changeInBalance.gt(new bn(0))){
        extrinsicResultData = {
            success: true,
            arbExecutionResult: arbResultString,
            resultPathNode: pathNode,
            swapTxStats: swapStats,
            swapTxResults: swapTxResult,
            lastNode: lastNode,
            extrinsicIndex: extrinsicIndex.i
        }
        
    } else {
        extrinsicResultData = {
            success: false,
            arbExecutionResult: arbResultString,
            resultPathNode: pathNode,
            swapTxStats: swapStats,
            swapTxResults: swapTxResult,
            lastNode: lastNode,
            extrinsicIndex: extrinsicIndex.i
        }
        
    }
    await setResultData(extrinsicResultData, relay)

    console.log(`SUCCESS: ${success} - SWAP: (${chain}) ${chainId} ${assetInSymbol} ${actualAmountIn}-> ${assetOutSymbol} ${actualAmountOut}`)
    console.log("*******************************************************")
    return extrinsicResultData

    


}

// Some transactions dont track, like allocate, with asyncronoouus execution would be a mess
// Only returns undefined when in testing, and skipping chains to execute transfers on.
export async function executeSingleTransferExtrinsic(extrinsicObj: ExtrinsicObject, extrinsicIndex: IndexObject, chopsticks: boolean):Promise<SingleTransferResultData | undefined>{
    console.log("Execute Single Transfer Extrinsic ()")
    let extrinsicResultData: SingleTransferResultData;
    let arbExecutionResult: ArbExecutionResult;
    let resultPathNode: PathNodeValues;
    let transferTxStats: TransferTxStats;
    let transferTxContainer = extrinsicObj.transferExtrinsicContainer! 
    let relay = transferTxContainer.relay

    setTransactionState(TransactionState.PreSubmission, relay)

    let extrinsic = transferTxContainer.extrinsic
    const xcmTxProperties = extrinsic.toHuman() as any

    const startChain = transferTxContainer.firstNode
    const destChain = transferTxContainer.secondNode
    const startApi = transferTxContainer.startApi
    const destApi = transferTxContainer.destinationApi
    const startParaId = transferTxContainer.startChainId
    const destParaId = transferTxContainer.destinationChainId
    const startTransferrable = transferTxContainer.startTransferrable
    const startAssetRegistryObject = startTransferrable.assetRegistryObject
    const destTransferrable = transferTxContainer.destinationTransferrable
    const destAssetRegistryObject = destTransferrable.assetRegistryObject

    //TODO reformat paraspell asset symbol
    // const currency = transferTxContainer.destinationTransferrable.paraspellAsset.symbol!
    const assetInSymbol = transferTxContainer.startTransferrable.assetRegistryObject.tokenData.symbol
    const assetOutSymbol = transferTxContainer.destinationTransferrable.assetRegistryObject.tokenData.symbol
    const inputAmount = transferTxContainer.pathAmount
    const transferReserveAmount = transferTxContainer.transferReserveAmount
    const assetDecimals =  transferTxContainer.startTransferrable.assetRegistryObject.tokenData.decimals
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

    // console.log(`TRANSFER TX ****** CHAIN: ${startChain} | PARA ID: ${startParaId} | ADDRESS: ${startSigner.address.toString()}`)

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
   

    // console.log("Execute Extrinsic Set Loop: Transfer extrinsic")
    console.log(`Execute Extrinsic Set Loop: Start Chain: ${startChain} ${startParaId}| Destination Chain: ${destChain} ${destParaId} | Currency: ${JSON.stringify(assetInSymbol)} `)
    if(execute){
        let startBalance = await getBalance(startParaId, relay, chopsticks, startApi, assetInSymbol, startAssetRegistryObject, startChain, startSigner.address)
        let destinationStartBalance = await getBalance(destParaId, relay, chopsticks, destApi, assetOutSymbol, destAssetRegistryObject, destChain, destSigner.address)
        let assetRegistryObject = transferTxContainer.destinationTransferrable.assetRegistryObject
        let destinationAssetKey = JSON.stringify(assetRegistryObject.tokenData.chain.toString() + JSON.stringify(assetRegistryObject.tokenData.localId))

        

        let transferProperties: TransferProperties = {
            type: "Transfer",
            relay: relay,
            chopsticks: chopsticks,
            startNode: startChain,
            startParaId: startParaId,
            startAssetSymbol: assetInSymbol,
            startAssetLocalId: startTransferrable.assetRegistryObject.tokenData.localId,
            startAddress: startSigner.address,
            startNodeStartBalance: startBalance,
            startNodeStartBalanceString: startBalance.free.toString(),
            destNode: destChain,
            destParaId: destParaId,
            destAssetSymbol: assetOutSymbol,
            destAssetLocalId: destTransferrable.assetRegistryObject.tokenData.localId,
            destNodeStartBalance: destinationStartBalance,
            destNodeStartBalanceString: destinationStartBalance.free.toString(),
            destAddress: destSigner.address,
            inputAmount: inputAmount,
            reserveAmount: transferReserveAmount,
            assetDecimals: assetDecimals,
            destAssetKey: destinationAssetKey
            
        }
        setTransctionProperties(transferProperties, relay)

        let startBalanceUnsub, destBalanceUnsub;
        console.log("Execute Extrinsic Set Loop: Initiating balance adapter for START chain " + startChain)
        let startBalanceObservable$ = await watchTokenDeposit(relay, startParaId, chopsticks, startApi, startTransferrable, watchWithdrawAddress) 
        let startBalanceChangePromise = getBalanceChange(startBalanceObservable$, (unsub) =>{
            startBalanceUnsub = unsub
        })
        console.log("Execute Extrinsic Set Loop: Initiating balance adapter for DESTINATION chain " + destChain)
        let destBalanceObservable$ = await watchTokenDeposit(relay, destParaId, chopsticks, destApi, destTransferrable, watchDepositAddress)
        let destAdapterBalanceChangePromise = getBalanceChange(destBalanceObservable$, (unsub) =>{
            destBalanceUnsub = unsub
        })
        console.log(`(${startChain} -> ${destChain}) ${JSON.stringify(transferTxContainer.assetSymbol)} ${JSON.stringify(transferTxContainer.assetIdStart)}`)
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
            startTransferEventData = getXcmTransferEventData(startChain, assetInSymbol, startAssetRegistryObject, startChainNativeToken, txDetails.finalized!, relay, xcmTxProperties)
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
                assetSymbolIn: assetInSymbol,
                assetSymbolOut: assetInSymbol,
                assetAmountIn: transferAmount,
                assetAmountOut: "0",
                blockHash: blockHash,
                result: `FAILURE: TRANSFER: (${startChain} ${startParaId} ${assetInSymbol} ${transferAmount}-> ${destChain}) ${destParaId} | ERROR: ${JSON.stringify(decodedError)}` 
            }
            
            resultPathNode = {
                pathInSymbol: assetInSymbol,
                pathOutSymbol: assetInSymbol,
                pathSwapType: transferTxContainer.pathSwapType,
                pathValue: transferTxContainer.pathAmount,
                pathValueNext: 0
            
            }   

            extrinsicResultData = {
                success: false,
                arbExecutionResult: arbExecutionResult,
                resultPathNode: resultPathNode,
                transferTxStats: null,
                lastNode: null,
                extrinsicIndex: extrinsicIndex.i,
            }
            increaseIndex(extrinsicIndex)
            await setResultData(extrinsicResultData, relay)
            console.log("Returning on CATCH from failed Transfer Extrinsic")
            return extrinsicResultData

        }

        console.log("***** LISTENING FOR DEPOSIT EVENTS ************")
        let transferType = getTransferType(startChain, destChain)
        let destWalletFormatted = getWalletAddressFormatted(destSigner, keyring, destChain, ss58FormatDest)
        const destinationAssetDecimals = Number.parseInt(assetRegistryObject.tokenData.decimals)

        console.log("Execute TRANSFER: Initiating deposit event listener")
        let depositEventPromise = listenForXcmpDepositEvent(
            destApi, 
            destChain, 
            transferType, 
            assetOutSymbol, 
            destinationAssetDecimals, 
            destAssetRegistryObject, 
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
                let destEndBalance: BalanceData = await getBalance(destParaId, relay, chopsticks, destApi, assetOutSymbol, destAssetRegistryObject, destChain, destSigner.address)
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
            originFeeAssetDecimals = Number.parseInt(startAssetRegistryObject.tokenData.decimals)
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
                destDepositEventData.xcmAssetDecimals = Number.parseInt(destAssetRegistryObject.tokenData.decimals)
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
            await updateXcmFeeReserves(reserveFees, relay)
        } catch (error) {
            console.error("ERROR: " + error)
            console.error("Failed to detect deposit events")
        }





        let lastNode: LastNode = {
            assetKey: JSON.stringify(assetRegistryObject.tokenData.chain.toString() + JSON.stringify(assetRegistryObject.tokenData.localId)),
            assetValue: destBalanceChangeStats.changeInBalanceDisplay,
            chainId: assetRegistryObject.tokenData.chain,
            assetSymbol: assetRegistryObject.tokenData.symbol
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
            await setLastNode(lastNode, relay)
            await setTransactionState(TransactionState.Finalized, relay)
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
            currency: assetInSymbol,
            startAssetId: startAssetRegistryObject.tokenData.localId,
            startBalanceStats: startBalanceChangeStats,
            destBalanceStats: destBalanceChangeStats,
            // feesAndGasAmount: feesAndGasAmount, 
            originFee: transferFeeData,
            destinationFee: depositFeeData,
        }
        
        arbExecutionResult = {
            assetSymbolIn: assetInSymbol,
            assetSymbolOut: assetInSymbol,
            assetAmountIn: startBalanceChangeStats.changeInBalanceDisplay,
            assetAmountOut: destBalanceChangeStats.changeInBalanceDisplay,
            blockHash: blockHash,
            result: `SUCCESS: ${txDetails.success} - TRANSFER: (${startChain} ${startParaId} ${assetInSymbol} ${startBalanceChangeStats.changeInBalance} -> ${destChain} ${destParaId} ${assetInSymbol} ${destBalanceChangeStats.changeInBalance}) |
            Transfer Fee: ${transferFeeData.feeAssetSymbol} ${transferFeeData.feeAmount} | Transfer Reserve: ${transferFeeData.reserveAssetAmount!} |
            Deposit Fee: ${depositFeeData.feeAssetSymbol} ${depositFeeData.feeAmount} | Deposit Reserve ${depositFeeData.reserveAssetAmount} |
            START: ${startBalanceChangeStats.changeInBalanceDisplay} -> DEST: ${destBalanceChangeStats.changeInBalanceDisplay}`
        }
        
        let pathValueNext = Number.parseFloat(destBalanceChangeStats.changeInBalanceDisplay)
        resultPathNode= {
            pathInSymbol: assetInSymbol,
            pathOutSymbol: assetInSymbol,
            pathValue: transferTxContainer.pathAmount,
            pathSwapType: transferTxContainer.pathSwapType,
            pathValueNext: pathValueNext
        }
        extrinsicResultData = {
            success: txDetails.success,
            arbExecutionResult: arbExecutionResult,
            resultPathNode: resultPathNode,
            transferTxStats: transferTxStats,
            lastNode: lastNode,
            extrinsicIndex: extrinsicIndex.i,
        }
        increaseIndex(extrinsicIndex)
        await setResultData(extrinsicResultData, relay)
        console.log(`***** Extrinsic set result LAST NODE PATH VALUE: ${JSON.stringify(lastNode.assetValue)}`)
        return extrinsicResultData
    } else {
        console.log("Chain not supported")
    }
    console.log("---------------------------------------------")
}


// only Return undefined when testing
export async function executeTransferExtrinsic(transfer: TransferExtrinsicContainer, signer: KeyringPair, chopsticks: boolean): Promise<TxDetails | undefined> {

    let relay = transfer.relay
    let tx = transfer.extrinsic
    // signer.
    // let txNonce = 0

    // Dont need to check for local rpc, will already have been checked in calling function
    let execute;
    if(chopsticks){
        let localRpc = localRpcs[transfer.firstNode]
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
        console.log(`Execute Transfer: (${transfer.firstNode} -> ${transfer.secondNode}) ${JSON.stringify(transfer.assetSymbol)} ${JSON.stringify(transfer.assetIdStart)}`)
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
export async function executeSwapExtrinsic(txContainer: SwapExtrinsicContainer, chopsticks: boolean): Promise<TxDetails> {
    let signer = await getSigner(chopsticks, false);
    let relay = txContainer.relay
    //If MOVR/EVM execute smart contract call
    if(txContainer.chainId == 2023){
        throw new Error("Function: executeSwapExtrinsic() should not be called with MOVR swaps")
    } else {
        // REVIEW Why would txContainer.extrinsic every be undefined?
        if(txContainer.extrinsic){
            let tx = txContainer.extrinsic
            let txNonce = txContainer.nonce
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

            console.log(`Execute Swap: Executing tx with nonce: ${txNonce} ${txString}`)
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
                setTransactionState(TransactionState.Broadcasted, relay)
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
export async function buildAndExecuteSwapExtrinsic(relay: Relay ,instructionsToExecute: SwapInstruction[], chopsticks: boolean, executeMovr: boolean, nextInputValue: string, chainNonces: ChainNonces, extrinsicIndex: IndexObject): Promise<[(SingleSwapResultData | SingleTransferResultData | undefined), SwapInstruction[]]>{
    if(Number.parseFloat(nextInputValue) > 0){
        instructionsToExecute[0].assetNodes[0].pathValue = nextInputValue
    }
    let [swapExtrinsicContainer, remainingInstructions] = await buildSwapExtrinsicDynamic(relay, instructionsToExecute, chainNonces, extrinsicIndex, chopsticks);
    let extrinsicObj: ExtrinsicObject = await createSwapExtrinsicObject(swapExtrinsicContainer)
    
    let extrinsicResultData: SingleTransferResultData | SingleSwapResultData | undefined = await executeAndReturnExtrinsic(extrinsicObj, extrinsicIndex, chopsticks, executeMovr)
    return [extrinsicResultData, remainingInstructions]
}

// Handle different extrinsic types
export async function executeAndReturnExtrinsic(extrinsicObj: ExtrinsicObject, extrinsicIndex: IndexObject, chopsticks: boolean, executeMovr: boolean = false): Promise<SingleTransferResultData | SingleSwapResultData | undefined>{
    // let executeMovr = false
    
    try {
        console.log("********************************")
        if (extrinsicObj.type == "Transfer"){
            // Returns undefined on certain tests
            let transferExtrinsicResults: SingleTransferResultData | undefined = await executeSingleTransferExtrinsic(extrinsicObj, extrinsicIndex, chopsticks)
            return transferExtrinsicResults
        } else if (extrinsicObj.type == "Swap"){
            let swapTxContainer = extrinsicObj.swapExtrinsicContainer! 
            let relay = swapTxContainer.relay;
            let chainId = swapTxContainer.chainId;
            if(relay == 'polkadot' && chainId != 2004 || relay == 'kusama' && chainId != 2023){
                let swapExtrinsicResults: SingleSwapResultData = await executeSingleSwapExtrinsic(extrinsicObj, extrinsicIndex, chopsticks);
                return swapExtrinsicResults
            } else if (relay == 'kusama' && chainId == 2023 && executeMovr == true ){
                let swapExtrinsicResults: SingleSwapResultData = await executeSingleSwapExtrinsicMovr(extrinsicObj, extrinsicIndex, chopsticks);
                return swapExtrinsicResults
            } else if (relay == 'polkadot' && chainId == 2004 && executeMovr == true){
                let swapExtrinsicResults: SingleSwapResultData = await executeSingleSwapExtrinsicGlmr(extrinsicObj, extrinsicIndex, chopsticks);
                return swapExtrinsicResults
            }
        } 
        
        // else if (extrinsicObj.type == "Swap" && extrinsicObj.swapExtrinsicContainer.chainId == 2023 && executeMovr == true){
        //     let swapExtrinsicResults: SingleSwapResultData = await executeSingleSwapExtrinsicMovr(extrinsicObj, extrinsicIndex, chopsticks);
        //     return swapExtrinsicResults
        // }
    } catch (e) {
        console.log(e)
        throw new Error("Extrinsic Execution failed")
    } finally {
        // Ensure APIs are disconnected here
        // if (extrinsicObj.transferExtrinsicContainer) {
        //     console.log("Disconnecting Transfer APIs")
        //     console.log("Start API: " + extrinsicObj.transferExtrinsicContainer.startApi.isConnected)
        //     console.log("Destination API: " + extrinsicObj.transferExtrinsicContainer.destinationApi.isConnected)
        //     if(extrinsicObj.transferExtrinsicContainer.startApi.isConnected){
        //         await extrinsicObj.transferExtrinsicContainer.startApi.disconnect();
        //         console.log("Start API disconnected")
        //     }
        //     if(extrinsicObj.transferExtrinsicContainer.destinationApi.isConnected){
        //         await extrinsicObj.transferExtrinsicContainer.destinationApi.disconnect();
        //         console.log("Destination API disconnected")
        //     }
            
            
        // }
        // if (extrinsicObj.swapExtrinsicContainer) {
        //     console.log("Disconnecting Swap API")
        //     console.log("Swap API: " + extrinsicObj.swapExtrinsicContainer.api.isConnected)
        //     // Assuming similar API disconnect methods for swap extrinsic containers
        //     if(extrinsicObj.swapExtrinsicContainer.api.isConnected){
        //         await extrinsicObj.swapExtrinsicContainer.api.disconnect()
        //         console.log("Swap API disconnected")
        //     }
        // }
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

        let startAssetObject = getAssetRegistryObjectBySymbol(fromChainId, "KSM", relay)
        let destAssetObject = getAssetRegistryObjectBySymbol(toChainId, "KSM", relay)

        let startBalanceUnsub, destBalanceUnsub;
        console.log("Execute Extrinsic Set Loop: Initiating balance adapter for START chain " + transfer.fromChainNode)
        let startBalanceObservable$ = await watchTokenBalance(relay, fromChainId, chopsticks, fromChainApi, "KSM", startAssetObject, transfer.fromChainNode, transfer.fromChainAccount.address) 
        let startBalanceChangePromise = getBalanceChange(startBalanceObservable$, (unsub) =>{
            startBalanceUnsub = unsub
        })
        console.log("Execute Extrinsic Set Loop: Initiating balance adapter for DESTINATION chain " + transfer.toChainNode)
        //***************************************************
        // Trying to get origin balance and then requery until new balance. Might work better than subscribe
        let toChainBalanceBefore = await getBalance(toChainId, relay, chopsticks, toChainApi, "KSM", destAssetObject, transfer.toChainNode, transfer.toChainAccount.address)
        let destBalanceObservable$ = await watchTokenBalance(relay, toChainId, chopsticks, toChainApi, "KSM", destAssetObject, transfer.toChainNode, transfer.toChainAccount.address)
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
                let toChainBalanceAfter = await getBalance(toChainId, relay, chopsticks, toChainApi, "KSM", destAssetObject, transfer.toChainNode, transfer.toChainAccount.address)
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
    if(lastTransactionProperties.type == "Transfer"){
        let transferProperties = lastTransactionProperties as TransferProperties
        let startAssetId = JSON.stringify(transferProperties.startAssetLocalId).replace(/\\|"/g, "")
        let destAssetId = JSON.stringify(transferProperties.destAssetLocalId).replace(/\\|"/g, "")
        let startAssetObject = getAssetRegistryObject(transferProperties.startParaId, startAssetId, transferProperties.relay)
        let destAssetObject = getAssetRegistryObject(transferProperties.destParaId, destAssetId, transferProperties.relay)
        let relay = transferProperties.relay
        let startApi = await getApiForNode(transferProperties.startNode, transferProperties.chopsticks)
        let destApi = await getApiForNode(transferProperties.destNode, transferProperties.chopsticks)
        let startNodeCurrentBalance = await getBalance(transferProperties.startParaId, relay, transferProperties.chopsticks, startApi, transferProperties.startAssetSymbol, startAssetObject, transferProperties.startNode, transferProperties.startAddress) 
        let destNodeCurrentBalance = await getBalance(transferProperties.destParaId, relay, transferProperties.chopsticks, destApi, transferProperties.destAssetSymbol, destAssetObject, transferProperties.destNode, transferProperties.destAddress)

        let startNodeStartBalance = new FixedPointNumber(transferProperties.startNodeStartBalanceString, Number.parseInt(transferProperties.assetDecimals))
        let destNodeStartBalance = new FixedPointNumber(transferProperties.destNodeStartBalanceString, Number.parseInt(transferProperties.assetDecimals))

        console.log(`Previous Balances: Start: ${startNodeStartBalance.toString()} | Dest: ${destNodeStartBalance.toString()}`)

        let startNodeBalanceChange: FixedPointNumber = startNodeCurrentBalance.free.minus(startNodeStartBalance).abs()
        let destNodeBalanceChange: FixedPointNumber = destNodeCurrentBalance.free.minus(destNodeStartBalance).abs()

        let minimumExpected = new FixedPointNumber(transferProperties.inputAmount, Number.parseInt(transferProperties.assetDecimals)).times(new FixedPointNumber(0.90))
        let startChangeSufficient = startNodeBalanceChange.minus(minimumExpected)
        let destChangeSufficient = destNodeBalanceChange.minus(minimumExpected)
        if(startChangeSufficient.gt(new FixedPointNumber(0)) && destChangeSufficient.gt(new FixedPointNumber(0))){
            transactionSuccess = true
            console.log("LAST TRANSACTION (TRANSFER) WAS SUCCESSFUL")
            let lastSuccessfulNode: LastNode = {
                assetKey: transferProperties.destAssetKey,
                assetValue: destNodeBalanceChange.toString(),
                assetSymbol: transferProperties.destAssetSymbol,
                chainId: transferProperties.destParaId
            }
            console.log("Last Transfer Extrinsic successful. setting last node...")
            await setLastNode(lastSuccessfulNode, relay)
        } else {
            console.log("LAST TRANSACTION (TRANSFER) WAS NOT SUCCESSFUL")
        }
    } else {
        let swapProperties = lastTransactionProperties as SwapProperties
        let startAssetId = JSON.stringify(swapProperties.assetInLocalId).replace(/\\|"/g, "")
        let destAssetId = JSON.stringify(swapProperties.assetOutLocalId).replace(/\\|"/g, "")
        let assetInObject = getAssetRegistryObject(swapProperties.paraId, startAssetId, swapProperties.relay)
        let assetOutObject = getAssetRegistryObject(swapProperties.paraId, destAssetId, swapProperties.relay)
        let relay = swapProperties.relay
        let swapNodeApi = await getApiForNode(swapProperties.node, swapProperties.chopsticks)
        let assetInCurrentBalance = await getBalance(swapProperties.paraId, relay, swapProperties.chopsticks, swapNodeApi, swapProperties.assetInSymbol, assetInObject, swapProperties.node, swapProperties.address)
        let assetOutCurrentBalance = await getBalance(swapProperties.paraId, relay, swapProperties.chopsticks, swapNodeApi, swapProperties.assetOutSymbol, assetOutObject, swapProperties.node, swapProperties.address)
        let assetInCurrentBalanceBn = new bn(assetInCurrentBalance.free.toChainData())
        let assetOutCurrentBalanceBn = new bn(assetOutCurrentBalance.free.toChainData())

        console.log("SWAP PROPERTIES: " + JSON.stringify(swapProperties, null, 2))
        console.log("ASSET IN START BALANCE: " + JSON.stringify(swapProperties.assetInStartBalance.free))

        let assetInStartBalanceBn = new bn((swapProperties.assetInStartBalance.free as any).inner)
        let assetOutStartBalanceBn = new bn((swapProperties.assetOutStartBalance.free as any).inner)

        let assetInBalanceChangeBn = assetInStartBalanceBn.minus(assetInCurrentBalanceBn).abs()
        let assetOutBalanceChangeBn = assetOutStartBalanceBn.minus(assetOutCurrentBalanceBn).abs()

        let assetInMinimumBalanceChange = new FixedPointNumber(swapProperties.inputAmount, Number.parseInt(swapProperties.assetInDecimals)).times(new FixedPointNumber(0.90))
        console.log("Asset in minimum balance change: " + assetInMinimumBalanceChange.toChainData())

        let assetInBalanceChangeMinimumBn = new bn(swapProperties.inputAmount).times(new bn(0.90))
        let assetInChangeSufficientBn = assetInBalanceChangeBn.gte(assetInBalanceChangeMinimumBn)
        console.log(`As BigNumber: Asset In Balance Change: ${assetInBalanceChangeBn} | Asset In Minimum Balance Change: ${assetInBalanceChangeMinimumBn} | Asset In Change Sufficient: ${assetInChangeSufficientBn}`)

        // let assetOutBalanceChangeBn = new bn(assetOutBalanceChange.toChainData())
        let assetOutBalanceChangeSufficientBn = assetOutBalanceChangeBn.gt(new bn(0))
        console.log(`As BigNumber: Asset out balance change ${assetOutBalanceChangeBn} | Asset out balance change sufficient: ${assetOutBalanceChangeSufficientBn}`)

        if(assetInChangeSufficientBn && assetOutBalanceChangeSufficientBn){
            transactionSuccess = true
            console.log("LAST TRANSACTION (SWAP) WAS SUCCESSFUL")
            let assetOutBalanceChangeReadable = assetOutBalanceChangeBn.div(new bn(10).pow(new bn(swapProperties.assetOutDecimals)))
            let lastSuccessfulNode: LastNode = {
                assetKey: swapProperties.destAssetKey,
                assetValue: assetOutBalanceChangeReadable.toString(),
                assetSymbol: swapProperties.assetOutSymbol,
                chainId: swapProperties.paraId
            }
            console.log("Last Swap Extrinsic successful. setting last node...")
            await setLastNode(lastSuccessfulNode, relay)
        } else {
            console.log("LAST TRANSACTION (SWAP) WAS NOT SUCCESSFUL")
        }
        
    }
    return transactionSuccess
}


export async function collectRelayToken(relay: Relay, chopsticks: boolean, executeMovr: boolean, nativeBalances: NativeBalancesType, startChainId: number){
    let allocationPaths = await collectKsmToRelayPaths(relay,  nativeBalances, startChainId)
    let allocationInstructions = await Promise.all(allocationPaths.map(async (path) => await buildInstructionSet(relay, path)))

    console.log("Executing allocations from chains to Kusama")
    const { globalState } = await import("./liveTest.ts");
    globalState.tracking = false;
    // Async execution
    let allocationExecutionResultsPromise = allocationInstructions.map(async (instructionSet) => {
        let transferInstructions: TransferInstruction[] = instructionSet as TransferInstruction[]
        const { buildAndExecuteAllocationExtrinsics } = await import("./liveTest.ts");
        let allocationExecution = buildAndExecuteAllocationExtrinsics(relay, transferInstructions, chopsticks, executeMovr, 100)
        return allocationExecution
    })

    let allocationExecutionResults = await Promise.all(allocationExecutionResultsPromise)

    // Turn it back on for the rest of the execution
    globalState.tracking = true;

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
        let allocationPaths: AssetNode[][] = await getPreTransferPath(relay, startChain, startValue, chopsticks, nativeBalances)
        
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
        let allocationNode: AssetNode[] = await getFundingPath(relay, startChain, startValue, chopsticks, nativeBalancesRefreshed)
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
        let dispatchErrorCode;
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