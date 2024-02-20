import { EventRecord } from "@polkadot/types/interfaces"
import { BN } from "@polkadot/util/bn"
import { checkAndApproveToken } from "./../swaps/movr/utils/utils.ts"
import { AssetNode } from "./AssetNode.ts"
import { testNets, localRpcs } from "./txConsts.ts"
import { ExtrinsicObject, IndexObject, SingleSwapResultData, SwapTxStats, ArbExecutionResult, TxDetails, PathNodeValues, ReverseSwapExtrinsicParams, BalanceChangeStats, LastNode, SingleTransferResultData, TransferTxStats, TransferExtrinsicContainer, SwapExtrinsicContainer, SwapResultObject, SwapInstruction, ExtrinsicSetResultDynamic, ChainNonces } from "./types.ts"
import { watchTokenBalance, getBalanceChange, getSigner, watchTokenDeposit, increaseIndex, printExtrinsicSetResults, getLastSuccessfulNodeFromResultData, getBalance } from "./utils.ts"
import { FixedPointNumber, Token } from "@acala-network/sdk-core";
import { buildSwapExtrinsicDynamic, createSwapExtrinsicObject } from "./extrinsicUtils.ts"
import { timeout } from "rxjs/internal/operators/timeout.js"
import { BalanceData } from "src/types.ts"





export async function executeSingleSwapExtrinsicMovr(extrinsicObj: ExtrinsicObject, extrinsicIndex: IndexObject, chopsticks: boolean): Promise<SingleSwapResultData>{
    let movrTx = extrinsicObj.swapExtrinsicContainer.extrinsic
    let chain = extrinsicObj.swapExtrinsicContainer.chain
    let api = extrinsicObj.swapExtrinsicContainer.api
    let chainId = extrinsicObj.swapExtrinsicContainer.chainId
    let assetInSymbol = extrinsicObj.swapExtrinsicContainer.assetSymbolIn
    let assetOutSymbol = extrinsicObj.swapExtrinsicContainer.assetSymbolOut
    let assetIn = extrinsicObj.swapExtrinsicContainer.pathInLocalId
    let assetOut = extrinsicObj.swapExtrinsicContainer.pathOutLocalId
    let expectedAmountIn = extrinsicObj.swapExtrinsicContainer.assetAmountIn
    let expectedAmountOut = extrinsicObj.swapExtrinsicContainer.expectedAmountOut
    if(extrinsicIndex.i == 0){
        let firstAssetNode = extrinsicObj.swapExtrinsicContainer.assetNodes[0]
    }
    let movrBatchSwapParams = extrinsicObj.swapExtrinsicContainer.movrBatchSwapParams
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

    let unsubscribeOne, unsubscribeTwo;
    let balanceObservableIn$ = await watchTokenBalance(chainId, chopsticks, api, assetInSymbol, chain, liveWallet.address)
    let balanceObservableOut$ = await watchTokenBalance(chainId, chopsticks, api, assetOutSymbol, chain, liveWallet.address)
    let balancePromiseIn = getBalanceChange(balanceObservableIn$, (unsub) => {
        unsubscribeOne = unsub
    })
    let balancePromiseOut = getBalanceChange(balanceObservableOut$, (unsub) => {
        unsubscribeTwo = unsub
    })

    try{
        // **************************************************************************************
        let txReceipt = await movrTx()
        let txHash = await txReceipt.wait()
        // **************************************************************************************

        let tokenInBalanceStats = await balancePromiseIn
        let tokenOutBalanceStats = await balancePromiseOut
        console.log(`EXPECTED TOKEN IN ${expectedAmountIn.toString()} || ACTUAL TOKEN IN ${JSON.stringify(tokenInBalanceStats.startBalanceString.toString())}`)
        console.log(`EXPECTED TOKEN OUT ${expectedAmountOut.toString()} || ACTUAL TOKEN IN ${JSON.stringify(tokenInBalanceStats.changeInBalance.toString())}`)
        
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
        let actualAmountIn = tokenInBalanceStats.changeInBalance.toString()
        let actualAmountOut = tokenOutBalanceStats.changeInBalance.toString()
        // logSwapTxResults(tx, logFilePath)
        let arbResultString: ArbExecutionResult = {
            assetSymbolIn: assetInSymbol,
            assetSymbolOut: assetOutSymbol,
            assetAmountIn: Math.abs(Number.parseFloat(actualAmountIn)),
            assetAmountOut: Math.abs(Number.parseFloat(actualAmountOut)),
            result: `SUCCESS: ${true} - SWAP: (${chain}) ${chainId} ${assetInSymbol} ${actualAmountIn}-> ${assetOutSymbol} ${actualAmountOut}| Dexes: ${JSON.stringify(dexes)}`
        }
        let txDetails: TxDetails = {
            success: true,
            txHash: txHash,
            movrInfo: movrTxInfo
        }
        let swapTxResult = {
            txString: `(${chain}) ${chainId} ${assetInSymbol} -> ${assetOutSymbol}`,
            txDetails: txDetails
        }
        let pathValueNext = Number.parseFloat(tokenOutBalanceStats.changeInBalanceString)
        let pathNode: PathNodeValues = {
            pathInLocalId: extrinsicObj.swapExtrinsicContainer.pathInLocalId,
            pathOutLocalId: extrinsicObj.swapExtrinsicContainer.pathOutLocalId,
            pathInSymbol: assetInSymbol,
            pathOutSymbol: assetOutSymbol,
            pathSwapType: extrinsicObj.swapExtrinsicContainer.pathSwapType,
            pathValue: extrinsicObj.swapExtrinsicContainer.pathAmount,
            pathValueNext: pathValueNext
        
        }

        let assetRegistryObject = extrinsicObj.swapExtrinsicContainer.assetNodes[extrinsicObj.swapExtrinsicContainer.assetNodes.length - 1].assetRegistryObject;
        let lastNodeChainId = assetRegistryObject.tokenData.chain
        let lastNodeLocalId = assetRegistryObject.tokenData.localId
        let lastNodeAssetSymbol = assetRegistryObject.tokenData.symbol
        let lastNodeAssetKey = JSON.stringify(lastNodeChainId.toString() + JSON.stringify(lastNodeLocalId))
        let lastNodeAssetValue = pathValueNext.toString()
        let lastNode = {
            assetKey: lastNodeAssetKey,
            assetValue: lastNodeAssetValue,
            chainId:lastNodeChainId,
            assetSymbol: lastNodeAssetSymbol

        }

        let swapResultData: SingleSwapResultData = {
            success: true,
            arbExecutionResult: arbResultString,
            resultPathNode: pathNode,
            swapTxStats: swapStats,
            swapTxResults: swapTxResult,
            lastNode: lastNode,
            extrinsicIndex: extrinsicIndex.i
        }
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

        let arbResultString: ArbExecutionResult = {
            assetSymbolIn: assetInSymbol,
            assetSymbolOut: assetOutSymbol,
            assetAmountIn: Math.abs(Number.parseFloat(expectedAmountIn.toString())),
            assetAmountOut: 0,
            result: `SUCCESS: ${false} - SWAP: (${chain}) ${chainId} ${assetInSymbol} ${expectedAmountIn} -> ${assetOutSymbol} | Dexes: ${JSON.stringify(dexes)}`
        }
        let pathNode: PathNodeValues = {
            pathInLocalId: extrinsicObj.swapExtrinsicContainer.pathInLocalId,
            pathOutLocalId: extrinsicObj.swapExtrinsicContainer.pathOutLocalId,
            pathInSymbol: assetInSymbol,
            pathOutSymbol: assetOutSymbol,
            pathSwapType: extrinsicObj.swapExtrinsicContainer.pathSwapType,
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

    // Return both the new promise and a function to check if it's resolved
    return { trackedPromise, isResolved: () => isResolved };
}
export async function executeSingleSwapExtrinsic(extrinsicObj: ExtrinsicObject, extrinsicIndex: IndexObject, chopsticks: boolean): Promise<SingleSwapResultData>{
    console.log("Swap extrinsic")
    let extrinsic = extrinsicObj.swapExtrinsicContainer.extrinsic
    let chain = extrinsicObj.swapExtrinsicContainer.chain
    let api = extrinsicObj.swapExtrinsicContainer.api
    let chainId = extrinsicObj.swapExtrinsicContainer.chainId
    let assetInSymbol = extrinsicObj.swapExtrinsicContainer.assetSymbolIn
    let assetOutSymbol = extrinsicObj.swapExtrinsicContainer.assetSymbolOut
    let assetIn = extrinsicObj.swapExtrinsicContainer.pathInLocalId
    let assetOut = extrinsicObj.swapExtrinsicContainer.pathOutLocalId
    let expectedAmountIn = extrinsicObj.swapExtrinsicContainer.assetAmountIn
    let expectedAmountOut = extrinsicObj.swapExtrinsicContainer.expectedAmountOut

    let signer = await getSigner(chopsticks, false)
    let tokenInBalanceStart = await getBalance(chainId, chopsticks, api, assetInSymbol, chain, signer.address)
    let tokenOutBalanceStart = await getBalance(chainId, chopsticks, api, assetOutSymbol, chain, signer.address)

    let tokenInBalance$ = await watchTokenBalance(chainId, chopsticks, api, assetInSymbol, chain, signer.address)
    let tokenOutBalance$ = await watchTokenBalance(chainId, chopsticks, api, assetOutSymbol, chain, signer.address)

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
    let tokenInBalanceStats:BalanceChangeStats, tokenOutBalanceStats:BalanceChangeStats, tx: TxDetails, txHash;
    try{
                    
        // **************************************************************************************
        tx = await executeSwapExtrinsic(extrinsicObj.swapExtrinsicContainer, chopsticks)
        // **************************************************************************************
        txHash = tx.txHash
    } catch (e) {
        // console.log("ERROR: ")
        // console.log(e)     
        let decodedError = e.decodedError
        console.log("DECODED ERROR: " + JSON.stringify(decodedError, null, 2))               
        await tokenInUnsub()
        await tokenOutUnsub()
        // For now just throw if an extrinsic fails, and then execute reverse tx
        // throw new Error("Swap failed, executing reverse txs")
        let arbString: ArbExecutionResult = {
            assetSymbolIn: assetInSymbol,
            assetSymbolOut: assetOutSymbol,
            assetAmountIn: Math.abs(Number.parseFloat(expectedAmountIn.toString())),
            assetAmountOut: 0,
            result:`FAILURE: SWAP: (${chain}) ${chainId} ${assetInSymbol} ${expectedAmountIn.toNumber()}-> ${assetOutSymbol} | ERROR: ${JSON.stringify(decodedError)}`
        }
        
        let txDetailsResponse = e.txDetails
        let txDetails: TxDetails = {
            success: false,
            movrInfo: txDetailsResponse
        }
        let swapTxResult = {
            txString: `(${chain}) ${chainId} ${assetInSymbol} -> ${assetOutSymbol}`,
            txDetails: txDetails
        }

        let pathNode: PathNodeValues = {
            pathInLocalId: extrinsicObj.swapExtrinsicContainer.pathInLocalId,
            pathOutLocalId: extrinsicObj.swapExtrinsicContainer.pathOutLocalId,
            pathInSymbol: assetInSymbol,
            pathOutSymbol: assetOutSymbol,
            pathSwapType: extrinsicObj.swapExtrinsicContainer.pathSwapType,
            pathValue: extrinsicObj.swapExtrinsicContainer.pathAmount,
            pathValueNext: 0
        }

        let swapTxStats: SwapTxStats;
        let lastNode: LastNode;
        let extrinsicResultData: SingleSwapResultData = {
            success: false,
            arbExecutionResult: arbString,
            resultPathNode: pathNode,
            swapTxStats: swapTxStats,
            swapTxResults: swapTxResult,
            lastNode: lastNode,
            extrinsicIndex: extrinsicIndex.i
        }
        return extrinsicResultData
    }

    if(!tx.success){
        throw new Error("Swap Tx failed, but didnt throw error in catch")
    }
    console.log("SWAP awaiting token balance in")
    tokenInBalanceStats = await tokenInBalancePromise

    console.log("SWAP awaiting token balance in")
    let tokenOutBalanceConfirmed = false;
    // tokenOutBalanceStats = await tokenOutBalancePromise
    while (!tokenOutBalanceConfirmed){
        if(tokenOutResolved()){
            console.log("TOKEN OUT BALANCE CHANGE NORMAL")
            tokenOutBalanceStats = await trackedTokenOutBalancePromise
            tokenOutBalanceConfirmed = true;
        } else {
            console.log("TOKEN OUT BALANCE NOT DETECTED. QUERYING BALANCE")
            let tokenOutBalanceEnd: BalanceData = await getBalance(chainId, chopsticks, api, assetOutSymbol, chain, signer.address)
            let tokenOutFn = tokenOutBalanceEnd.free
            let balanceChangeAmount = tokenOutFn.minus(tokenOutBalanceStart.free)
            if(balanceChangeAmount.gt(new FixedPointNumber(0))){
                console.log("BALANCE QUERIED AND DETECTED CHANGE IN BALANCE")
                tokenOutBalanceConfirmed = true
                tokenOutBalanceStats = {
                    startBalance: tokenOutBalanceStart.free,
                    endBalance: tokenOutBalanceEnd.free,
                    changeInBalance: balanceChangeAmount,
                    startBalanceString: tokenOutBalanceStart.toString(),
                    endBalanceString: tokenOutBalanceEnd.toString(),
                    changeInBalanceString: balanceChangeAmount.toString()
                }
                tokenOutUnsub()
            } else {
                console.log("BALANCE QUERIED AND NO CHANGE IN BALANCE, waiting 10 seconds")
                await new Promise(resolve => setTimeout(resolve, 10000))
            
            }
        }
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

    // logSwapTxResults(tx, logFilePath)
    let assetNodes = extrinsicObj.swapExtrinsicContainer.assetNodes
    assetNodes.forEach((node, index) => {
        let reverseAssetNode;
        if(index == assetNodes.length - 1){
        reverseAssetNode = new AssetNode({
            paraspellChain: node.paraspellChain,
            paraspellAsset: node.paraspellAsset,
            assetRegistryObject: node.assetRegistryObject,
            pathValue: tokenOutBalanceStats.changeInBalance.toNumber(),
            pathType: node.pathType
        })
        } else if(index > 0){
            reverseAssetNode = new AssetNode({
                paraspellChain: node.paraspellChain,
                paraspellAsset: node.paraspellAsset,
                assetRegistryObject: node.assetRegistryObject,
                pathValue: node.pathValue,
                pathType: node.pathType
            })
        }
        // reverseNodes.push(reverseAssetNode)
    })

    let swapTxResult = {
        txString: `(${chain}) ${chainId} ${assetInSymbol} -> ${assetOutSymbol}`,
        txDetails: tx
    }
    let actualAmountIn = tokenInBalanceStats.changeInBalance.toString()
    let actualAmountOut = tokenOutBalanceStats.changeInBalance.toString()

    let arbResultString: ArbExecutionResult = {
        assetSymbolIn: assetInSymbol,
        assetSymbolOut: assetOutSymbol,
        assetAmountIn: Math.abs(Number.parseFloat(actualAmountIn)),
        assetAmountOut: Math.abs(Number.parseFloat(actualAmountOut)),
        result:`SUCCESS: ${tx.success} - SWAP: (${chain}) ${chainId} ${assetInSymbol} ${actualAmountIn}-> ${assetOutSymbol} ${actualAmountOut} | `
    }
    
    let pathValueNext = Number.parseFloat(tokenOutBalanceStats.changeInBalanceString)

    let pathNode: PathNodeValues = {
        pathInLocalId: extrinsicObj.swapExtrinsicContainer.pathInLocalId,
        pathOutLocalId: extrinsicObj.swapExtrinsicContainer.pathOutLocalId,
        pathInSymbol: assetInSymbol,
        pathOutSymbol: assetOutSymbol,
        pathSwapType: extrinsicObj.swapExtrinsicContainer.pathSwapType,
        pathValue: extrinsicObj.swapExtrinsicContainer.pathAmount,
        pathValueNext:pathValueNext
    }

    let assetRegistryObject = extrinsicObj.swapExtrinsicContainer.assetNodes[extrinsicObj.swapExtrinsicContainer.assetNodes.length - 1].assetRegistryObject;
    let lastNodeChainId = assetRegistryObject.tokenData.chain
    let lastNodeLocalId = assetRegistryObject.tokenData.localId
    let lastNodeAssetSymbol = assetRegistryObject.tokenData.symbol
    let lastNodeAssetKey = JSON.stringify(lastNodeChainId.toString() + JSON.stringify(lastNodeLocalId))
    let lastNodeAssetValue = pathValueNext.toString()
    let lastNode = {
        assetKey: lastNodeAssetKey,
        assetValue: lastNodeAssetValue,
        chainId:lastNodeChainId,
        assetSymbol: lastNodeAssetSymbol
    }

    if(tokenOutBalanceStats.changeInBalance.gt(new FixedPointNumber(0))){
        let extrinsicResultData: SingleSwapResultData = {
            success: true,
            arbExecutionResult: arbResultString,
            resultPathNode: pathNode,
            swapTxStats: swapStats,
            swapTxResults: swapTxResult,
            lastNode: lastNode,
            extrinsicIndex: extrinsicIndex.i
        }
        return extrinsicResultData
    } else {
        let extrinsicResultData: SingleSwapResultData = {
            success: false,
            arbExecutionResult: arbResultString,
            resultPathNode: pathNode,
            swapTxStats: swapStats,
            swapTxResults: swapTxResult,
            lastNode: lastNode,
            extrinsicIndex: extrinsicIndex.i
        }
        return extrinsicResultData
    }

    


}
export async function executeSingleTransferExtrinsic(extrinsicObj: ExtrinsicObject, extrinsicIndex: IndexObject, chopsticks: boolean):Promise<SingleTransferResultData>{
    let extrinsicResultData: SingleTransferResultData;
    let arbExecutionResult: ArbExecutionResult;
    let resultPathNode: PathNodeValues;
    let transferTxStats: TransferTxStats;

    let lastNodeAssetKey: string;
    let lastNodeAssetValue: string;
    let lastNode: LastNode;


    let extrinsic = extrinsicObj.transferExtrinsicContainer.extrinsic
    let startChain = extrinsicObj.transferExtrinsicContainer.firstNode
    let destChain = extrinsicObj.transferExtrinsicContainer.secondNode
    let startApi = extrinsicObj.transferExtrinsicContainer.startApi
    let destApi = extrinsicObj.transferExtrinsicContainer.destinationApi
    let startParaId = extrinsicObj.transferExtrinsicContainer.startChainId
    let destParaId = extrinsicObj.transferExtrinsicContainer.destinationChainId
    let startTransferrable = extrinsicObj.transferExtrinsicContainer.startTransferrable
    let destTransferrable = extrinsicObj.transferExtrinsicContainer.destinationTransferrable
    let currency = extrinsicObj.transferExtrinsicContainer.destinationTransferrable.paraspellAsset.symbol
    if(startChain == "Kusama" || destChain == "Kusama"){
        currency = "KSM"
    }


    let startSigner, destSigner;
    if(startParaId == 2023){
        startSigner = await getSigner(chopsticks, true)
    } else {
        startSigner = await getSigner(chopsticks, false)
    }
    if(destParaId == 2023){
        destSigner = await getSigner(chopsticks, true)
    } else {
        destSigner = await getSigner(chopsticks, false)
    }
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
   

    console.log("Execute Extrinsic Set Loop: Transfer extrinsic")
    console.log(`Execute Extrinsic Set Loop: Start Chain: ${startChain} ${startParaId}| Destination Chain: ${destChain} ${destParaId} | Currency: ${JSON.stringify(currency)} `)
    if(execute){
        let startBalanceUnsub, destBalanceUnsub;
        console.log("Execute Extrinsic Set Loop: Initiating balance adapter for START chain " + startChain)
        let startBalanceObservable$ = await watchTokenDeposit(startParaId, chopsticks, startApi, 0, startTransferrable, watchWithdrawAddress) 
        let startBalanceChangePromise = getBalanceChange(startBalanceObservable$, (unsub) =>{
            startBalanceUnsub = unsub
        })
        console.log("Execute Extrinsic Set Loop: Initiating balance adapter for DESTINATION chain " + destChain)
        let destBalanceObservable$ = await watchTokenDeposit(destParaId, chopsticks, destApi, 0, destTransferrable, watchDepositAddress)
        let destBalanceChangePromise = getBalanceChange(destBalanceObservable$, (unsub) =>{
            destBalanceUnsub = unsub
        })
        console.log(`(${startChain} -> ${destChain}) ${JSON.stringify(extrinsicObj.transferExtrinsicContainer.assetSymbol)} ${JSON.stringify(extrinsicObj.transferExtrinsicContainer.assetIdStart)}`)
        // console.log(extrinsic.toHuman())
        let txDetailsPromise: Promise<TxDetails>;
        try{
            // **************************************************************************************
            txDetailsPromise = executeTransferExtrinsic(extrinsicObj.transferExtrinsicContainer, startParaId, chopsticks)
            // **************************************************************************************
            console.log("Execute Extrinsic Set Loop: Transfer promise created")
            let txDetails = await txDetailsPromise
        } catch(e) {
            // console.log("ERROR: " + e)
            // txPromise = e
            let decodedError = e.decodedError
            await startBalanceUnsub()
            await destBalanceUnsub()
            // For now just throw if an extrinsic fails, and then execute reverse txs
            // throw new Error("Transfer failed, executing reverse txs")
            let transferAmount = extrinsicObj.transferExtrinsicContainer.pathAmount
            arbExecutionResult = { 
                assetSymbolIn: currency,
                assetSymbolOut: currency,
                assetAmountIn: transferAmount,
                assetAmountOut: 0,
                result: `FAILURE: TRANSFER: (${startChain} ${startParaId} ${currency} ${transferAmount}-> ${destChain}) ${destParaId} | ERROR: ${JSON.stringify(decodedError)}` 
            }
            
            resultPathNode = {
                pathInLocalId: extrinsicObj.transferExtrinsicContainer.pathInLocalId,
                pathOutLocalId: extrinsicObj.transferExtrinsicContainer.pathOutLocalId,
                pathInSymbol: currency,
                pathOutSymbol: currency,
                pathSwapType: extrinsicObj.transferExtrinsicContainer.pathSwapType,
                pathValue: extrinsicObj.transferExtrinsicContainer.pathAmount,
                pathValueNext: 0
            
            }   
            extrinsicResultData = {
                success: false,
                arbExecutionResult: arbExecutionResult,
                resultPathNode: resultPathNode,
                transferTxStats: transferTxStats,
                lastNode: lastNode,
                extrinsicIndex: extrinsicIndex.i,
            }
            increaseIndex(extrinsicIndex)
            console.log("Returning on CATCH from failed Transfer Extrinsic")
            return extrinsicResultData

        }

        
        
        console.log("Execute swap: AWAIT startBalanceChangePromise")
        let startBalanceStats = await startBalanceChangePromise;
        console.log("Execute swap: AWAIT destBalanceChangePromise")
        let destBalanceStats = await destBalanceChangePromise;
        // let destBalanceStats = await getBalanceChange(destBalanceObservable$, (unsub) =>{
        //     destBalanceUnsub = unsub
        // })
        console.log("AWAIT txDetailsPromise")
        let txDetails = await txDetailsPromise
        console.log("Tx Details Success: " + txDetails.success)
        let feesAndGasAmount = startBalanceStats.changeInBalance.add(destBalanceStats.changeInBalance)
        console.log(`Execute Extrinsic Set Loop: Start Balance Change: ${JSON.stringify(startBalanceStats)} | Destination Balance Change: ${JSON.stringify(destBalanceStats)} | Fees and Gas: ${feesAndGasAmount}`)
        transferTxStats = {
            startChain: startChain,
            startParaId: startParaId,
            destChain: destChain,
            destParaId: destParaId,
            currency: currency,
            startBalanceStats: startBalanceStats,
            destBalanceStats: destBalanceStats,
            feesAndGasAmount: feesAndGasAmount
        }
        
        
        let successMetric = destBalanceStats.changeInBalance.gt(new FixedPointNumber(0))
        let transferAmount = extrinsicObj.transferExtrinsicContainer.pathAmount
        arbExecutionResult = {
            assetSymbolIn: currency,
            assetSymbolOut: currency,
            assetAmountIn: transferAmount,
            assetAmountOut: Number.parseFloat(destBalanceStats.changeInBalanceString),
            result:`SUCCESS: ${successMetric} - TRANSFER: (${startChain} ${startParaId} ${currency} ${transferAmount}-> ${destChain}) ${destParaId} | FEES: ${feesAndGasAmount.toString()} | START: ${startBalanceStats.changeInBalanceString} -> DEST: ${destBalanceStats.changeInBalanceString} DEST 2: ${Number.parseFloat(destBalanceStats.changeInBalanceString)} DEST 3: ${destBalanceStats.changeInBalance.toNumber()}`
        }
        
        let pathValueNext = Number.parseFloat(destBalanceStats.changeInBalanceString)
        resultPathNode= {
            pathInLocalId: extrinsicObj.transferExtrinsicContainer.pathInLocalId,
            pathOutLocalId: extrinsicObj.transferExtrinsicContainer.pathOutLocalId,
            pathInSymbol: currency,
            pathOutSymbol: currency,
            pathValue: extrinsicObj.transferExtrinsicContainer.pathAmount,
            pathSwapType: extrinsicObj.transferExtrinsicContainer.pathSwapType,
            pathValueNext: pathValueNext
        }
        let assetRegistryObject = extrinsicObj.transferExtrinsicContainer.destinationTransferrable.assetRegistryObject
        let lastNodeChainId = assetRegistryObject.tokenData.chain
        let lastNodeLocalId = assetRegistryObject.tokenData.localId
        let lastNodeAssetSymbol = assetRegistryObject.tokenData.symbol
        lastNodeAssetKey = JSON.stringify(lastNodeChainId.toString() + JSON.stringify(lastNodeLocalId))
        lastNodeAssetValue = pathValueNext.toString()
        
        lastNode = {
            assetKey: lastNodeAssetKey,
            assetValue: lastNodeAssetValue,
            chainId:lastNodeChainId,
            assetSymbol: lastNodeAssetSymbol
        }
        extrinsicResultData = {
            success: true,
            arbExecutionResult: arbExecutionResult,
            resultPathNode: resultPathNode,
            transferTxStats: transferTxStats,
            lastNode: lastNode,
            extrinsicIndex: extrinsicIndex.i,
        }
        increaseIndex(extrinsicIndex)
        return extrinsicResultData
    } else {
        console.log("Chain not supported")
    }
    console.log("---------------------------------------------")
}

export async function executeTransferExtrinsic(transfer: TransferExtrinsicContainer, startParaId: number, chopsticks: boolean): Promise<TxDetails> {
    let signer;
    if(startParaId ==2023){
        signer = await getSigner(chopsticks, true)
    } else {
        signer = await getSigner(chopsticks, false);
    }
    
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
        console.log(`Execute Transfer: (${transfer.firstNode} -> ${transfer.secondNode}) ${JSON.stringify(transfer.assetSymbol)} ${JSON.stringify(transfer.assetIdStart)}`)

        let txResult: any= new Promise((resolve, reject) => {
            let success = false;
            let included: EventRecord[] = [];
            let finalized: EventRecord[] = [];
            let eventLogs: any[] = [];
            let blockHash: string = "";
            let dispatchErrorCode;
            let decodedError;
            console.log(`Execute Transfer: Sending tx -- ${JSON.stringify(tx.toHuman())}`)
            tx.signAndSend(signer, ({ events = [], status, txHash, txIndex, dispatchError }) => {
                if (status.isInBlock) {
                    success = dispatchError ? false : true;
                    console.log(
                        `Execute Transfer: 📀 Transaction ${tx.meta.name}(..) included at blockHash ${status.asInBlock} [success = ${success}]`
                    );
                    included = [...events];

                } else if (status.isBroadcast) {
                    console.log(`Execute Transfer: 🚀 Transaction broadcasted.`);
                } else if (status.isFinalized) {
                    console.log(
                        `Execute Transfer: 💯 Transaction ${tx.meta.name}(..) Finalized at blockHash ${status.asFinalized}`
                    );
                    blockHash = status.asFinalized.toString();
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
                            decodedError = tx.registry.findMetaError({index: new BN(moduleIndex), error: new BN(errorIndex)});
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
                        const decoded = tx.registry.findMetaError(dispatchError.asModule);
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
    //If MOVR/EVM execute smart contract call
    if(txContainer.chainId == 2023){
        throw new Error("Function: executeSwapExtrinsic() should not be called with MOVR swaps")
    } else {
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
                tx.signAndSend(signer, {nonce: accountNonce}, ({ events = [], status, txHash, txIndex, dispatchError }) => {
                    if (status.isInBlock) {
                        success = dispatchError ? false : true;
                        console.log(
                            `Execute Swap: 📀 Transaction ${tx.meta.name}(..) included at blockHash ${status.asInBlock} [success = ${success}]`
                        );
                        included = [...events];
    
                    } else if (status.isBroadcast) {
                        console.log(`Execute Swap: 🚀 Transaction broadcasted.`);
                    } else if (status.isFinalized) {
                        success = dispatchError ? false : true;
                        console.log(
                            `Execute Swap: 💯 Transaction ${tx.meta.name}(..) Finalized at blockHash ${status.asFinalized}`
                        );
                        blockHash = status.asFinalized.toString();
                        finalized = [...events];
                        events.forEach((eventObj) => {
                            eventLogs.push(eventObj.toHuman())
                            if(eventObj.event.method == "ExtrinsicFailed" && eventObj.event.data.dispatchError){
                                console.log("Execute Swap: Extrinsic Failed event detected")
                                const {index, error} = dispatchError.asModule;
                                const moduleIndex = parseInt(index, 10);
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
        }

    }
    
}

export async function buildAndExecuteSwapExtrinsic(instructionsToExecute: SwapInstruction[], chopsticks: boolean, executeMovr: boolean, nextInputValue: number, chainNonces: ChainNonces, extrinsicIndex: IndexObject): Promise<[(SingleSwapResultData | SingleTransferResultData), SwapInstruction[]]>{
    if(nextInputValue > 0){
        instructionsToExecute[0].assetNodes[0].pathValue = nextInputValue
    }
    let [swapExtrinsicContainer, remainingInstructions] = await buildSwapExtrinsicDynamic(instructionsToExecute, chainNonces, extrinsicIndex, chopsticks);
    let extrinsicObj: ExtrinsicObject = await createSwapExtrinsicObject(swapExtrinsicContainer)
    
    let extrinsicResultData = await executeAndReturnExtrinsic(extrinsicObj, extrinsicIndex, chopsticks, executeMovr)
    return [extrinsicResultData, remainingInstructions]
}

// Handle different extrinsic types
export async function executeAndReturnExtrinsic(extrinsicObj: ExtrinsicObject, extrinsicIndex: IndexObject, chopsticks: boolean, executeMovr: boolean = false) {
    // let executeMovr = false
    try {
        if (extrinsicObj.type == "Transfer"){
            let transferExtrinsicResults: SingleTransferResultData = await executeSingleTransferExtrinsic(extrinsicObj, extrinsicIndex, chopsticks)
            return transferExtrinsicResults
        } else if (extrinsicObj.type == "Swap" && extrinsicObj.swapExtrinsicContainer.chainId != 2023){
            let swapExtrinsicResults: SingleSwapResultData = await executeSingleSwapExtrinsic(extrinsicObj, extrinsicIndex, chopsticks);
            return swapExtrinsicResults
        } else if (extrinsicObj.type == "Swap" && extrinsicObj.swapExtrinsicContainer.chainId == 2023 && executeMovr == true){
            let swapExtrinsicResults: SingleSwapResultData = await executeSingleSwapExtrinsicMovr(extrinsicObj, extrinsicIndex, chopsticks);
            return swapExtrinsicResults
        }
    } catch (e) {
        console.log(e)
        throw new Error("Extrinsic Execution failed")
    }
}
