import { EventRecord } from "@polkadot/types/interfaces"
import { BN } from "@polkadot/util/bn"
import { checkAndApproveToken } from "./../swaps/movr/utils/utils.ts"
import { AssetNode } from "./AssetNode.ts"
import { testNets, localRpcs } from "./txConsts.ts"
import { ExtrinsicObject, IndexObject, SingleSwapResultData, SwapTxStats, ArbExecutionResult, TxDetails, PathNodeValues, ReverseSwapExtrinsicParams, BalanceChangeStats, LastNode, SingleTransferResultData, TransferTxStats, TransferExtrinsicContainer, SwapExtrinsicContainer, SwapResultObject } from "./types.ts"
import { watchTokenBalance, getBalanceChange, getSigner, watchTokenDeposit, increaseIndex } from "./utils.ts"
import { FixedPointNumber, Token } from "@acala-network/sdk-core";





export async function executeSingleSwapExtrinsicMovr(extrinsicObj: ExtrinsicObject, extrinsicIndex: IndexObject, chopsticks: boolean): Promise<SingleSwapResultData>{
    let movrTx = extrinsicObj.swapExtrinsicContainer.extrinsic
    let chain = extrinsicObj.swapExtrinsicContainer.chain
    let api = extrinsicObj.swapExtrinsicContainer.api
    let chainId = extrinsicObj.swapExtrinsicContainer.chainId
    let assetInSymbol = extrinsicObj.swapExtrinsicContainer.assetSymbolIn
    let assetOutSymbol = extrinsicObj.swapExtrinsicContainer.assetSymbolOut
    // let assetIn = extrinsicObj.swapExtrinsicContainer.pathInLocalId
    // let assetOut = extrinsicObj.swapExtrinsicContainer.pathOutLocalId
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
    let balanceObservableIn$ = await watchTokenBalance(chainId, api, assetInSymbol, chain, liveWallet.address)
    let balanceObservableOut$ = await watchTokenBalance(chainId, api, assetOutSymbol, chain, liveWallet.address)
    let balancePromiseIn = await getBalanceChange(balanceObservableIn$, (unsub) => {
        unsubscribeOne = unsub
    })
    let balancePromiseOut = await getBalanceChange(balanceObservableOut$, (unsub) => {
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
            result: `SUCCESS: ${false} - SWAP: (${chain}) ${chainId} ${assetInSymbol} ${actualAmountIn}-> ${assetOutSymbol} ${actualAmountOut}| Dexes: ${JSON.stringify(dexes)}`
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
            pathInLocalId: extrinsicObj.transferExtrinsicContainer.pathInLocalId,
            pathOutLocalId: extrinsicObj.transferExtrinsicContainer.pathOutLocalId,
            pathInSymbol: assetInSymbol,
            pathOutSymbol: assetOutSymbol,
            pathSwapType: extrinsicObj.transferExtrinsicContainer.pathSwapType,
            pathValue: extrinsicObj.transferExtrinsicContainer.pathAmount,
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
    let reverseTx: ReverseSwapExtrinsicParams = extrinsicObj.swapExtrinsicContainer.reverseTx

    let signer = await getSigner(chopsticks, false)

    let tokenInBalance$ = await watchTokenBalance(chainId, api, assetInSymbol, chain, signer.address)
    let tokenOutBalance$ = await watchTokenBalance(chainId, api, assetOutSymbol, chain, signer.address)

    let tokenInUnsub, tokenOutUnsub;
    let tokenInBalancePromise = getBalanceChange(tokenInBalance$, (unsub) => {
        tokenInUnsub = unsub
    
    })
    let tokenOutBalancePromise = getBalanceChange(tokenOutBalance$, (unsub) => {
        tokenOutUnsub = unsub   
    })

    let tokenInBalanceStats:BalanceChangeStats, tokenOutBalanceStats:BalanceChangeStats, tx, txHash;
    try{
                    
        // **************************************************************************************
        tx = await executeSwapExtrinsic(extrinsicObj.swapExtrinsicContainer, chopsticks)
        // **************************************************************************************
        txHash = tx.txDetails.txHash
    } catch (e) {
        console.log("ERROR: " + e)
                    
        await tokenInUnsub()
        await tokenOutUnsub()
        // For now just throw if an extrinsic fails, and then execute reverse tx
        // throw new Error("Swap failed, executing reverse txs")
        let arbString: ArbExecutionResult = {
            assetSymbolIn: assetInSymbol,
            assetSymbolOut: assetOutSymbol,
            assetAmountIn: Math.abs(Number.parseFloat(expectedAmountIn.toString())),
            assetAmountOut: 0,
            result:`FAILURE: SWAP: (${chain}) ${chainId} ${assetInSymbol} ${expectedAmountIn.toNumber()}-> ${assetOutSymbol} | ERROR: ${e}`
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

    tokenInBalanceStats = await tokenInBalancePromise
    tokenOutBalanceStats = await tokenOutBalancePromise
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
        txDetails: tx.txDetails
    }
    let actualAmountIn = tokenInBalanceStats.changeInBalance.toString()
    let actualAmountOut = tokenOutBalanceStats.changeInBalance.toString()

    let arbResultString: ArbExecutionResult = {
        assetSymbolIn: assetInSymbol,
        assetSymbolOut: assetOutSymbol,
        assetAmountIn: Math.abs(Number.parseFloat(actualAmountIn)),
        assetAmountOut: Math.abs(Number.parseFloat(actualAmountOut)),
        result:`SUCCESS: ${tx.txDetails.success} - SWAP: (${chain}) ${chainId} ${assetInSymbol} ${actualAmountIn}-> ${assetOutSymbol} ${actualAmountOut} | `
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

    console.log("Execute Extrinsic Set Loop: Transfer extrinsic")
    console.log(`Execute Extrinsic Set Loop: Start Chain: ${startChain} ${startParaId}| Destination Chain: ${destChain} ${destParaId} | Currency: ${JSON.stringify(currency)} `)
    if(testNets.includes(startChain) && testNets.includes(destChain)){
        let startBalanceUnsub, destBalanceUnsub;
        console.log("Execute Extrinsic Set Loop: Initiating balance adapter for START chain " + startChain)
        let startBalanceObservable$ = await watchTokenDeposit(startParaId, startApi, 0, startTransferrable, watchWithdrawAddress) 
        let startBalanceChangePromise = getBalanceChange(startBalanceObservable$, (unsub) =>{
            startBalanceUnsub = unsub
        })
        console.log("Execute Extrinsic Set Loop: Initiating balance adapter for DESTINATION chain " + destChain)
        let destBalanceObservable$ = await watchTokenDeposit(destParaId, destApi, 0, destTransferrable, watchDepositAddress)
        console.log(`(${startChain} -> ${destChain}) ${JSON.stringify(extrinsicObj.transferExtrinsicContainer.assetSymbol)} ${JSON.stringify(extrinsicObj.transferExtrinsicContainer.assetIdStart)}`)
        console.log(extrinsic.toHuman())
        let txPromise;
        try{
            // **************************************************************************************
            txPromise = await executeTransferExtrinsic(extrinsicObj.transferExtrinsicContainer, startParaId, chopsticks)
            // **************************************************************************************

        } catch(e) {
            console.log("ERROR: " + e)
            txPromise = e
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
                result: `FAILURE: TRANSFER: (${startChain} ${startParaId} ${currency} ${transferAmount}-> ${destChain}) ${destParaId} | ERROR: ${e}` 
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

            return extrinsicResultData

        }
        
        console.log("Execute Extrinsic Set Loop: Transfer promise created")
        let startBalanceStats = await startBalanceChangePromise;
        let destBalanceStats = await getBalanceChange(destBalanceObservable$, (unsub) =>{
            destBalanceUnsub = unsub
        })
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
        let txResult = await txPromise
        
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

export async function executeTransferExtrinsic(transfer: TransferExtrinsicContainer, startParaId: number, chopsticks: boolean) {
    let signer;
    if(startParaId ==2023){
        signer = await getSigner(chopsticks, true)
    } else {
        signer = await getSigner(chopsticks, false);
    }
    
    let tx = transfer.extrinsic
    // signer.
    // let txNonce = 0
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
                            const {index, error} = dispatchError.asModule;
                            const moduleIndex = parseInt(index.toString(), 10);
                            const errorCodeHex = error.toString().substring(2, 4); // "09"
                            const errorIndex = parseInt(errorCodeHex, 16);

                            // Get the module and error metadata
                            decodedError = tx.registry.findMetaError({index: new BN(moduleIndex), error: new BN(errorIndex)});
                            dispatchErrorCode = dispatchError.asModule;
                            console.log("Execute Transfer: Dispatch Error: " + dispatchError.toString())
                            console.log("Execute Transfer: DECODED MODULE: " + JSON.stringify(decodedError, null, 2))

                        }
                    })
                    const hash = status.hash;
                    let txDetails: TxDetails = { success, hash, dispatchError: dispatchErrorCode, decodedError, included, finalized, eventLogs, blockHash, txHash, txIndex };
                    resolve(txDetails);
                } else if (status.isReady) {
                    // let's not be too noisy..
                    console.log("Execute Transfer: Status: Ready")
                } else if (dispatchError){
                    console.log("Execute Transfer: Dispatch error: " + dispatchError.toString())
                    if(dispatchError.isModule){
                        const decoded = tx.registry.findMetaError(dispatchError.asModule);
                        console.log("Execute Transfer: DISPATCH ERROR DECODED: " + JSON.stringify(decoded, null, 2))
                        const { docs, name, section } = decoded;
                        reject(new Error(`${section}.${name}: ${docs.join(' ')}`));
                    } else {
                        reject(new Error(dispatchError.toString()));
                    
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
        let txDetails: TxDetails = await txResult;
        let resultObject = {
            // txString,
            txDetails
        }
        return resultObject
    } else {
        console.log("Execute Transfer: NOT EXECUTING TRANSFER")
    } 
    return false
}
export async function executeSwapExtrinsic(txContainer: SwapExtrinsicContainer, chopsticks: boolean):Promise<SwapResultObject> {
    let signer = await getSigner(chopsticks, false);
    //If MOVR/EVM execute smart contract call
    if(txContainer.chainId == 2023){
        let tx = txContainer.extrinsic
        const txString = txContainer.txString
        console.log(JSON.stringify(tx))
        let resultObject: SwapResultObject = {
            txString
        }
        
        return resultObject
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
            let txResult: any= new Promise((resolve, reject) => {
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
                        console.log(
                            `Execute Swap: 💯 Transaction ${tx.meta.name}(..) Finalized at blockHash ${status.asFinalized}`
                        );
                        blockHash = status.asFinalized.toString();
                        finalized = [...events];
                        events.forEach((eventObj) => {
                            eventLogs.push(eventObj.toHuman())
                            if(eventObj.event.method == "ExtrinsicFailed" && eventObj.event.data.dispatchError){
                                const {index, error} = dispatchError.asModule;
                                const moduleIndex = parseInt(index, 10);
                                const errorCodeHex = error.toString().substring(2, 4); // "09"
                                const errorIndex = parseInt(errorCodeHex, 16);

                                // Get the module and error metadata
                                decodedError = tx.registry.findMetaError({index: new BN(moduleIndex), error: new BN(errorIndex)});
                                dispatchErrorCode = dispatchError.asModule;
                                console.log("Execute Swap: Dispatch Error: " + dispatchError.toString())
                                console.log("Execute Swap: DECODED MODULE: " + JSON.stringify(decodedError, null, 2))
                                let txDetails: TxDetails = { success, dispatchError: dispatchErrorCode, decodedError, included, finalized, blockHash, eventLogs };
                                // console.log("Execute Swap: txDetails Object: " + JSON.stringify(txDetails, null, 2))
                                reject(txDetails);
                            }
                        })
                        const hash = status.hash;
                        let txDetails: TxDetails = { success, hash, dispatchError: dispatchErrorCode, decodedError, eventLogs, blockHash, txHash, txIndex };
                        resolve(txDetails);
                    } else if (status.isReady) {
                        // let's not be too noisy..
                    } else if (dispatchError){
                        console.log("Execute Swap: Dispatch error: " + dispatchError.toString())
                        if(dispatchError.isModule){
                            const decoded = tx.registry.findMetaError(dispatchError.asModule);
                            console.log("Execute Swap: DISPATCH ERROR DECODED: " + JSON.stringify(decoded, null, 2))
                            const { docs, name, section } = decoded;
                            let txDetails: TxDetails = { success:false, dispatchError: dispatchErrorCode, decodedError, included, finalized, blockHash, eventLogs }
                            reject(txDetails);
                        } else {
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
            let txDetails: TxDetails = await txResult;
            let resultObject: SwapResultObject = {
                // txString,
                txDetails
            }
            return resultObject
        }

    }
    
}