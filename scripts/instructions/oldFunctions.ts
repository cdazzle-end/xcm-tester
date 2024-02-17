
// async function runArbTester(chopsticks: boolean){
//     let latestFile = getLatestFileFromLatestDay()
//     let [assetPath, reversePath] = constructRoute(latestFile)
//     // let reverse
//     let instructionsPromise = buildInstructionSet(assetPath)


//     let [instructions]= await Promise.all([instructionsPromise])

//     logInstructions(instructions, latestFile)
//     // logInstructions(reverseInstructions, latestFile, true)

//     let executeMovr = false
//     let extrinsicsPromise = buildExtrinsicSet(instructions, chopsticks)
//     // let reverseExtrinsicsPromise = buildExtrinsicSet(reverseInstructions)
//     let [extrinsics] = await Promise.all([extrinsicsPromise])
//     // if(extrinsics.length != reverseExtrinsics.length){
//     //     throw new Error("Extrinsics and reverse extrinsics are not the same length")
//     // }
//     logSubmittableExtrinsics(extrinsics, latestFile)

//     let results: ExtrinsicSetResult = await executeExtrinsicSet(extrinsics, latestFile, executeMovr, false, chopsticks)

//     console.log("Execution complete, now executing reverse")
//     console.log("******************************************")

//     if(results.extrinsicIndex > 0) {
//         // Get last node key and pass it to arb finder, function: search_a_to_b --LAST_NODE --LAST_NODE_VALUE -> --KSM
//         let lastNodeAssetKey = results.lastNode.assetKey;
//         let lastNodeAssetValue = results.lastNode.assetValue;
//         let lastNodeChainId = results.lastNode.chainId;
//         let lastNodeAssetSymbol = results.lastNode.assetSymbol;

//         console.log("LAST NODE ASSET KEY: " + lastNodeAssetKey)
//         let ksmTargetNode = '"2000{\\"NativeAssetId\\":{\\"Token\\":\\"KSM\\"}}"'
//         let functionArgs = `${lastNodeAssetKey} ${ksmTargetNode} ${lastNodeAssetValue}`
//         console.log("Executing Arb Fallback with args: " + functionArgs)

//         if(lastNodeChainId == 0){
//             console.log("Last node chain is KUSAMA. Cant find arb with that. Can just exit successfully")
//         } else {
//             let fallbackArbResults: ResultDataObject[] = await runAndReturnFallbackArb(functionArgs, true)
//             console.log("Fallback Arb Results: ")
//             console.log(JSON.stringify(fallbackArbResults, null, 2))
    
//             let assetPath: AssetNode[] = fallbackArbResults.map(result => readLogData(result))
    
//             console.log("Asset Path: ")
//             console.log(JSON.stringify(assetPath, null, 2))
        
//             let reverseInstructions = await buildInstructionSet(assetPath)
        
//             let reverseExtrinsicSet = await buildExtrinsicSet(reverseInstructions, chopsticks)
        
//             console.log("Executing Reverse Extrinsics: ")
//             let latestFile = getLatestFileFromLatestDay()
//             let reverseResults: ExtrinsicSetResult = await executeExtrinsicSet(reverseExtrinsicSet, latestFile, false, true, chopsticks)
    
//             console.log("ORIGIN EXTRINSICS")
//             console.log(JSON.stringify(results.success, null, 2))
//             console.log(JSON.stringify(results.arbExecutionResult, null, 2))
//             console.log(JSON.stringify(results.extrinsicIndex, null, 2))
    
//             console.log("REVERSE EXTRINSICS")
//             console.log(JSON.stringify(reverseResults.success, null, 2))
//             console.log(JSON.stringify(reverseResults.arbExecutionResult, null, 2))
//             console.log(JSON.stringify(reverseResults.extrinsicIndex, null, 2))
//         }


//     } else {
//         console.log("No extrinsics completed. No reverse extrinsics")
//     }
// }

// Build extrinsics from instructions
// async function buildExtrinsicSet(instructionSet: (SwapInstruction | TransferInstruction)[], chopsticks: boolean): Promise<ExtrinsicObject[]> {
//     let extrinsicSet: ExtrinsicObject[] = [];
//     let swapInstructions: SwapInstruction[] = [];
//     let extrinsicIndex: IndexObject = {i: 0}
//     let chainNonces: ChainNonces = {
//         2000: 0,
//         2023: 0,
//         2001: 0,
//         2090: 0,
//         2110: 0,
//         2085: 0
//     }

//     // let txIndex = 0;
//     for (const instruction of instructionSet) {
//         switch (instruction.type) {
//             case InstructionType.Swap:
//                 // Accumulate swap instructions
                
//                 // If swap is of the same type, accumulate
//                 if(swapInstructions.length == 0 || swapInstructions[swapInstructions.length - 1].pathType == instruction.pathType){
//                     swapInstructions.push(instruction);
//                 } else {
//                     // If swap is of a different type, build extrinsic for the accumulated swap instructions
//                     let extrinsics = await buildSwapExtrinsic(swapInstructions, chainNonces, extrinsicIndex, chopsticks);
//                     extrinsics.forEach((extrinsicContainer) => {
//                         let exObj: ExtrinsicObject = {
//                             type: "Swap",
//                             instructionIndex: extrinsicContainer.instructionIndex,
//                             extrinsicIndex: extrinsicContainer.extrinsicIndex,
//                             swapExtrinsicContainer: extrinsicContainer
//                         }
//                         extrinsicSet.push(exObj);
//                         swapInstructions = [instruction];
//                     })

//                 }
//                 break;
//             default:
//                 // For other types of instructions
//                 if (swapInstructions.length > 0) {
//                     let extrinsics = await buildSwapExtrinsic(swapInstructions, chainNonces, extrinsicIndex, chopsticks);
//                     extrinsics.forEach((extrinsic) => {
//                         let exObj: ExtrinsicObject = {
//                             type: "Swap",
//                             instructionIndex: extrinsic.instructionIndex,
//                             extrinsicIndex: extrinsic.extrinsicIndex,
//                             swapExtrinsicContainer: extrinsic
//                         }
//                         extrinsicSet.push(exObj);
//                     })
//                     swapInstructions = [];   
//                 }
//                 // Handle other types of instructions (e.g., TransferToHomeChain)
//                 // Add the extrinsic for the current instruction (if needed)
//                 let transferExtrinsics = await buildTransferExtrinsicReworked(instruction, extrinsicIndex, chopsticks);
//                 // let reverseTransferExtrinsics = []
//                 transferExtrinsics.forEach((transferExtrinsic) => {
                    
//                     let exObj: ExtrinsicObject = {
//                         type: "Transfer",
//                         instructionIndex: transferExtrinsic.instructionIndex,
//                         extrinsicIndex: transferExtrinsic.extrinsicIndex,
//                         transferExtrinsicContainer: transferExtrinsic
//                     }
//                     extrinsicSet.push(exObj);
                    

//                 })
//                 break;
//         }
//     }

//     // Handle any remaining swap instructions at the end of the instruction set
//     if (swapInstructions.length > 0) {
//         let extrinsics = await buildSwapExtrinsic(swapInstructions, chainNonces, extrinsicIndex, chopsticks);
//         extrinsics.forEach((extrinsic) => {
//             let exObj: ExtrinsicObject = {
//                 type: "Swap",
//                 instructionIndex: extrinsic.instructionIndex,
//                 extrinsicIndex: extrinsic.extrinsicIndex,
//                 swapExtrinsicContainer: extrinsic
//             }
//             extrinsicSet.push(exObj);
//         })
//         swapInstructions = [];
//     }
//     return extrinsicSet;
// }

// async function executeExtrinsicSet(extrinsicSet: ExtrinsicObject[], logFilePath: string, executeMovr: boolean, reverseSwaps: boolean, chopsticks: boolean) {
    
//     // console.log(signer.address)
    
//     let arbExecutionResults: ArbExecutionResult[] = []
//     let resultPathNodes: PathNodeValues[] = []
//     let transferTxStats: TransferTxStats[] = []
//     let swapTxStats: SwapTxStats[] = []
//     let swapTxResults = []
    
//     // This is what we pass to the fallback arb function.
//     let lastNodeAssetKey: string;
//     let lastNodeAssetValue: string;
//     let lastNode: LastNode;

//     // let executeMovr = false
//     console.log("executeExtrinsicSet function")
//     let extrinsicIndex = 0;

//     let executionLoopIndex = 0;
//     try {
//         for (const extrinsicObj of extrinsicSet) {

//             //test three tx's then execute reverse tx's
//             // if(executionLoopIndex < 3){
//                 console.log("Execute Extrinsic Set Top of Loop")


//             if (extrinsicObj.type == "Transfer"){
//                 let extrinsic = extrinsicObj.transferExtrinsicContainer.extrinsic
//                 let startChain = extrinsicObj.transferExtrinsicContainer.firstNode
//                 let destChain = extrinsicObj.transferExtrinsicContainer.secondNode
//                 let startApi = extrinsicObj.transferExtrinsicContainer.startApi
//                 let destApi = extrinsicObj.transferExtrinsicContainer.destinationApi
//                 let startParaId = extrinsicObj.transferExtrinsicContainer.startChainId
//                 let destParaId = extrinsicObj.transferExtrinsicContainer.destinationChainId
//                 let startTransferrable = extrinsicObj.transferExtrinsicContainer.startTransferrable
//                 let destTransferrable = extrinsicObj.transferExtrinsicContainer.destinationTransferrable
//                 let currency = extrinsicObj.transferExtrinsicContainer.destinationTransferrable.paraspellAsset.symbol

//                 let startSigner, destSigner;
//                 if(startParaId == 2023){
//                     startSigner = await getSigner(chopsticks, true)
//                 } else {
//                     startSigner = await getSigner(chopsticks, false)
//                 }
//                 if(destParaId == 2023){
//                     destSigner = await getSigner(chopsticks, true)
//                 } else {
//                     destSigner = await getSigner(chopsticks, false)
//                 }
//                 let watchWithdrawAddress: string = startSigner.address.toString()
//                 let watchDepositAddress: string = destSigner.address.toString()

//                 console.log("Execute Extrinsic Set Loop: Transfer extrinsic")
//                 console.log(`Execute Extrinsic Set Loop: Start Chain: ${startChain} ${startParaId}| Destination Chain: ${destChain} ${destParaId} | Currency: ${JSON.stringify(currency)} `)
//                 if(testNets.includes(startChain) && testNets.includes(destChain)){
//                     let startBalanceUnsub, destBalanceUnsub;
//                     console.log("Execute Extrinsic Set Loop: Initiating balance adapter for START chain " + startChain)
//                     let startBalanceObservable$ = await watchTokenDeposit(startParaId, startApi, 0, startTransferrable, watchWithdrawAddress) 
//                     let startBalanceChangePromise = getBalanceChange(startBalanceObservable$, (unsub) =>{
//                         startBalanceUnsub = unsub
//                     })
//                     console.log("Execute Extrinsic Set Loop: Initiating balance adapter for DESTINATION chain " + destChain)
//                     let destBalanceObservable$ = await watchTokenDeposit(destParaId, destApi, 0, destTransferrable, watchDepositAddress)
//                     console.log(`(${startChain} -> ${destChain}) ${JSON.stringify(extrinsicObj.transferExtrinsicContainer.assetSymbol)} ${JSON.stringify(extrinsicObj.transferExtrinsicContainer.assetIdStart)}`)
//                     console.log(extrinsic.toHuman())
//                     let txPromise;
//                     try{
//                         // **************************************************************************************
//                         txPromise = await executeTransferExtrinsic(extrinsicObj.transferExtrinsicContainer, startParaId, chopsticks)
//                         // **************************************************************************************

//                     } catch(e) {
//                         console.log("ERROR: " + e)
//                         txPromise = e
//                         await startBalanceUnsub()
//                         await destBalanceUnsub()
//                         // For now just throw if an extrinsic fails, and then execute reverse txs
//                         // throw new Error("Transfer failed, executing reverse txs")
//                         let transferAmount = extrinsicObj.transferExtrinsicContainer.pathAmount
//                         let arbString: ArbExecutionResult = { 
//                             assetSymbolIn: currency,
//                             assetSymbolOut: currency,
//                             assetAmountIn: Math.abs(Number.parseFloat(transferAmount.toString())),
//                             assetAmountOut: 0,
//                             result: `FAILURE: TRANSFER: (${startChain} ${startParaId} ${currency} ${transferAmount}-> ${destChain}) ${destParaId} | ERROR: ${e}` 
//                         }
                        
//                         let pathNodeValues: PathNodeValues = {
//                             pathInLocalId: extrinsicObj.transferExtrinsicContainer.pathInLocalId,
//                             pathOutLocalId: extrinsicObj.transferExtrinsicContainer.pathOutLocalId,
//                             pathInSymbol: currency,
//                             pathOutSymbol: currency,
//                             pathSwapType: extrinsicObj.transferExtrinsicContainer.pathSwapType,
//                             pathValue: extrinsicObj.transferExtrinsicContainer.pathAmount,
//                             pathValueNext: 0
                        
//                         }
//                         arbExecutionResults.push(arbString)
//                         resultPathNodes.push(pathNodeValues)
//                         let extrinsicSetResult: ExtrinsicSetResult = {
//                             success: false,
//                             arbExecutionResult: arbExecutionResults,
//                             resultPathNodes: resultPathNodes,
//                             transferTxStats: transferTxStats,
//                             swapTxStats: swapTxStats,
//                             swapTxResults: swapTxResults,
//                             lastNode: lastNode,
//                             extrinsicIndex: extrinsicIndex
//                         }

//                         return extrinsicSetResult

//                     }
                    
//                     console.log("Execute Extrinsic Set Loop: Transfer promise created")
//                     let startBalanceStats = await startBalanceChangePromise;
//                     let destBalanceStats = await getBalanceChange(destBalanceObservable$, (unsub) =>{
//                         destBalanceUnsub = unsub
//                     })
//                     let feesAndGasAmount = startBalanceStats.changeInBalance.add(destBalanceStats.changeInBalance)
//                     console.log(`Execute Extrinsic Set Loop: Start Balance Change: ${JSON.stringify(startBalanceStats)} | Destination Balance Change: ${JSON.stringify(destBalanceStats)} | Fees and Gas: ${feesAndGasAmount}`)
//                     let txResultObject: TransferTxStats = {
//                         startChain: startChain,
//                         startParaId: startParaId,
//                         destChain: destChain,
//                         destParaId: destParaId,
//                         currency: currency,
//                         startBalanceStats: startBalanceStats,
//                         destBalanceStats: destBalanceStats,
//                         feesAndGasAmount: feesAndGasAmount
//                     }
//                     let txResult = await txPromise
                    
//                     let successMetric = destBalanceStats.changeInBalance.gt(new FixedPointNumber(0))
//                     let transferAmount = extrinsicObj.transferExtrinsicContainer.pathAmount
//                     let arbString: ArbExecutionResult = {
//                         assetSymbolIn: currency,
//                         assetSymbolOut: currency,
//                         assetAmountIn: Math.abs(Number.parseFloat(transferAmount.toString())),
//                         assetAmountOut: Math.abs(Number.parseFloat(transferAmount.toString())),
//                         result:`SUCCESS: ${successMetric} - TRANSFER: (${startChain} ${startParaId} ${currency} ${transferAmount}-> ${destChain}) ${destParaId} | FEES: ${feesAndGasAmount.toString()}`
//                     }
                    
//                     let pathValueNext = Number.parseFloat(destBalanceStats.changeInBalanceString)
//                     let pathNode: PathNodeValues = {
//                         pathInLocalId: extrinsicObj.transferExtrinsicContainer.pathInLocalId,
//                         pathOutLocalId: extrinsicObj.transferExtrinsicContainer.pathOutLocalId,
//                         pathInSymbol: currency,
//                         pathOutSymbol: currency,
//                         pathValue: extrinsicObj.transferExtrinsicContainer.pathAmount,
//                         pathSwapType: extrinsicObj.transferExtrinsicContainer.pathSwapType,
//                         pathValueNext: pathValueNext
//                     }
//                     let assetRegistryObject = extrinsicObj.transferExtrinsicContainer.destinationTransferrable.assetRegistryObject
//                     let lastNodeChainId = assetRegistryObject.tokenData.chain
//                     let lastNodeLocalId = assetRegistryObject.tokenData.localId
//                     let lastNodeAssetSymbol = assetRegistryObject.tokenData.symbol
//                     lastNodeAssetKey = JSON.stringify(lastNodeChainId.toString() + JSON.stringify(lastNodeLocalId))
//                     lastNodeAssetValue = pathValueNext.toString()
                    
//                     lastNode = {
//                         assetKey: lastNodeAssetKey,
//                         assetValue: lastNodeAssetValue,
//                         chainId:lastNodeChainId,
//                         assetSymbol: lastNodeAssetSymbol
//                     }

//                     arbExecutionResults.push(arbString)
//                     resultPathNodes.push(pathNode)
//                     transferTxStats.push(txResultObject)
//                 } else {
//                     console.log("Chain not supported")
//                 }
//                 console.log("---------------------------------------------")
//             } else if(extrinsicObj.type == "Swap" && extrinsicObj.swapExtrinsicContainer.chainId != 2023){
//                 console.log("Swap extrinsic")
//                 let extrinsic = extrinsicObj.swapExtrinsicContainer.extrinsic
//                 let chain = extrinsicObj.swapExtrinsicContainer.chain
//                 let api = extrinsicObj.swapExtrinsicContainer.api
//                 let chainId = extrinsicObj.swapExtrinsicContainer.chainId
//                 let assetInSymbol = extrinsicObj.swapExtrinsicContainer.assetSymbolIn
//                 let assetOutSymbol = extrinsicObj.swapExtrinsicContainer.assetSymbolOut
//                 let assetIn = extrinsicObj.swapExtrinsicContainer.pathInLocalId
//                 let assetOut = extrinsicObj.swapExtrinsicContainer.pathOutLocalId
//                 let expectedAmountIn = extrinsicObj.swapExtrinsicContainer.assetAmountIn
//                 let expectedAmountOut = extrinsicObj.swapExtrinsicContainer.expectedAmountOut
//                 let reverseTx: ReverseSwapExtrinsicParams = extrinsicObj.swapExtrinsicContainer.reverseTx

//                 let signer = await getSigner(chopsticks, false)

//                 let tokenInBalance$ = await watchTokenBalance(chainId, api, assetInSymbol, chain, signer.address)
//                 let tokenOutBalance$ = await watchTokenBalance(chainId, api, assetOutSymbol, chain, signer.address)

//                 let tokenInUnsub, tokenOutUnsub;
//                 let tokenInBalancePromise = getBalanceChange(tokenInBalance$, (unsub) => {
//                     tokenInUnsub = unsub
                
//                 })
//                 let tokenOutBalancePromise = getBalanceChange(tokenOutBalance$, (unsub) => {
//                     tokenOutUnsub = unsub   
//                 })

//                 let tokenInBalanceStats:BalanceChangeStats, tokenOutBalanceStats:BalanceChangeStats, tx, txHash;
//                 try{
                    
//                     // **************************************************************************************
//                     tx = await executeSwapExtrinsic(extrinsicObj.swapExtrinsicContainer, chopsticks)
//                     // **************************************************************************************
//                     txHash = tx.txDetails.txHash
//                 } catch (e) {
//                     console.log("ERROR: " + e)
                    
//                     await tokenInUnsub()
//                     await tokenOutUnsub()
//                     // For now just throw if an extrinsic fails, and then execute reverse tx
//                     // throw new Error("Swap failed, executing reverse txs")
//                     let arbString: ArbExecutionResult = {
//                         assetSymbolIn: assetInSymbol,
//                         assetSymbolOut: assetOutSymbol,
//                         assetAmountIn: Math.abs(Number.parseFloat(expectedAmountIn.toString())),
//                         assetAmountOut: 0,
//                         result:`FAILURE: SWAP: (${chain}) ${chainId} ${assetInSymbol} ${expectedAmountIn.toNumber()}-> ${assetOutSymbol} | ERROR: ${e}`
//                     }
                    
//                     let txDetailsResponse = e.txDetails
//                     let txDetails: TxDetails = {
//                         success: false,
//                         movrInfo: txDetailsResponse
//                     }
//                     let swapTxResult = {
//                         txString: `(${chain}) ${chainId} ${assetInSymbol} -> ${assetOutSymbol}`,
//                         txDetails: txDetails
//                     }

//                     let pathNode: PathNodeValues = {
//                         pathInLocalId: extrinsicObj.swapExtrinsicContainer.pathInLocalId,
//                         pathOutLocalId: extrinsicObj.swapExtrinsicContainer.pathOutLocalId,
//                         pathInSymbol: assetInSymbol,
//                         pathOutSymbol: assetOutSymbol,
//                         pathSwapType: extrinsicObj.swapExtrinsicContainer.pathSwapType,
//                         pathValue: extrinsicObj.swapExtrinsicContainer.pathAmount,
//                         pathValueNext: 0
//                     }

                    
//                     arbExecutionResults.push(arbString)
//                     swapTxResults.push(swapTxResult)
//                     resultPathNodes.push(pathNode)

//                     let extrinsicSetResults: ExtrinsicSetResult = {
//                         success: false,
//                         arbExecutionResult: arbExecutionResults,
//                         resultPathNodes: resultPathNodes,
//                         transferTxStats: transferTxStats,
//                         swapTxStats: swapTxStats,
//                         swapTxResults: swapTxResults,
//                         // reverseExtrinsics: reverseExtrinsics,
//                         // reverseAssetNodes: reverseNodes,
//                         // lastNodeAssetKey: lastNodeAssetKey,
//                         // lastNodeAssetValue: lastNodeAssetValue,
//                         lastNode: lastNode,
//                         extrinsicIndex: extrinsicIndex
//                     }
//                     return extrinsicSetResults
//                 }
//                 tokenInBalanceStats = await tokenInBalancePromise
//                 tokenOutBalanceStats = await tokenOutBalancePromise
//                 console.log(`EXPECTED TOKEN IN ${expectedAmountIn.toString()} || EXPECTED TOKEN OUT ${expectedAmountOut.toString()}`)
//                 console.log(`ACTUAL TOKEN IN ${JSON.stringify(tokenInBalanceStats.changeInBalance.toString())} || ACTUAL TOKEN OUT ${(JSON.stringify(tokenOutBalanceStats.changeInBalance.toString()))}`)

//                 let swapStats: SwapTxStats = {
//                     txHash: txHash,
//                     chain: chain,
//                     paraId: chainId,
//                     currencyIn: assetInSymbol,
//                     currencyOut: assetOutSymbol,
//                     expectedAmountIn: expectedAmountIn.toString(),
//                     actualAmountIn: tokenInBalanceStats.changeInBalance.toString(),
//                     expectedAmountOut: expectedAmountOut.toString(),
//                     actualAmountOut: tokenOutBalanceStats.changeInBalance.toString(),
//                     tokenInBalanceChange: tokenInBalanceStats,
//                     tokenOutBalanceChange: tokenOutBalanceStats,
//                 } 

//                 // logSwapTxResults(tx, logFilePath)
//                 let assetNodes = extrinsicObj.swapExtrinsicContainer.assetNodes
//                 assetNodes.forEach((node, index) => {
//                     let reverseAssetNode;
//                     if(index == assetNodes.length - 1){
//                     reverseAssetNode = new AssetNode({
//                         paraspellChain: node.paraspellChain,
//                         paraspellAsset: node.paraspellAsset,
//                         assetRegistryObject: node.assetRegistryObject,
//                         pathValue: tokenOutBalanceStats.changeInBalance.toNumber(),
//                         pathType: node.pathType
//                     })
//                     } else if(index > 0){
//                         reverseAssetNode = new AssetNode({
//                             paraspellChain: node.paraspellChain,
//                             paraspellAsset: node.paraspellAsset,
//                             assetRegistryObject: node.assetRegistryObject,
//                             pathValue: node.pathValue,
//                             pathType: node.pathType
//                         })
//                     }
//                     // reverseNodes.push(reverseAssetNode)
//                 })


//                 let swapTxResult = {
//                     txString: `(${chain}) ${chainId} ${assetInSymbol} -> ${assetOutSymbol}`,
//                     txDetails: tx.txDetails
//                 }
//                 let actualAmountIn = tokenInBalanceStats.changeInBalance.toString()
//                 let actualAmountOut = tokenOutBalanceStats.changeInBalance.toString()

//                 let arbResultString: ArbExecutionResult = {
//                     assetSymbolIn: assetInSymbol,
//                     assetSymbolOut: assetOutSymbol,
//                     assetAmountIn: Math.abs(Number.parseFloat(actualAmountIn)),
//                     assetAmountOut: Math.abs(Number.parseFloat(actualAmountOut)),
//                     result:`SUCCESS: ${tx.txDetails.success} - SWAP: (${chain}) ${chainId} ${assetInSymbol} ${actualAmountIn}-> ${assetOutSymbol} ${actualAmountOut} | `
//                 }
                
//                 let pathValueNext = Number.parseFloat(tokenOutBalanceStats.changeInBalanceString)

//                 let pathNode: PathNodeValues = {
//                     pathInLocalId: extrinsicObj.swapExtrinsicContainer.pathInLocalId,
//                     pathOutLocalId: extrinsicObj.swapExtrinsicContainer.pathOutLocalId,
//                     pathInSymbol: assetInSymbol,
//                     pathOutSymbol: assetOutSymbol,
//                     pathSwapType: extrinsicObj.swapExtrinsicContainer.pathSwapType,
//                     pathValue: extrinsicObj.swapExtrinsicContainer.pathAmount,
//                     pathValueNext:pathValueNext
//                 }
                
//                 swapTxStats.push(swapStats)
//                 arbExecutionResults.push(arbResultString)
//                 swapTxResults.push(swapTxResult)
//                 resultPathNodes.push(pathNode)

//                 let assetRegistryObject = extrinsicObj.swapExtrinsicContainer.assetNodes[extrinsicObj.swapExtrinsicContainer.assetNodes.length - 1].assetRegistryObject;
//                 let lastNodeChainId = assetRegistryObject.tokenData.chain
//                 let lastNodeLocalId = assetRegistryObject.tokenData.localId
//                 let lastNodeAssetSymbol = assetRegistryObject.tokenData.symbol
//                 lastNodeAssetKey = JSON.stringify(lastNodeChainId.toString() + JSON.stringify(lastNodeLocalId))
//                 lastNodeAssetValue = pathValueNext.toString()
//                 lastNode = {
//                     assetKey: lastNodeAssetKey,
//                     assetValue: lastNodeAssetValue,
//                     chainId:lastNodeChainId,
//                     assetSymbol: lastNodeAssetSymbol
//                 }

//                 console.log("---------------------------------------------")
//                 // console.log(JSON.stringify(extrinsic, null, 2))
//             } else if(extrinsicObj.type == "Swap" && extrinsicObj.swapExtrinsicContainer.chainId == 2023 && executeMovr == true){
//                 let movrTx = extrinsicObj.swapExtrinsicContainer.extrinsic
//                 let chain = extrinsicObj.swapExtrinsicContainer.chain
//                 let api = extrinsicObj.swapExtrinsicContainer.api
//                 let chainId = extrinsicObj.swapExtrinsicContainer.chainId
//                 let assetInSymbol = extrinsicObj.swapExtrinsicContainer.assetSymbolIn
//                 let assetOutSymbol = extrinsicObj.swapExtrinsicContainer.assetSymbolOut
//                 // let assetIn = extrinsicObj.swapExtrinsicContainer.pathInLocalId
//                 // let assetOut = extrinsicObj.swapExtrinsicContainer.pathOutLocalId
//                 let expectedAmountIn = extrinsicObj.swapExtrinsicContainer.assetAmountIn
//                 let expectedAmountOut = extrinsicObj.swapExtrinsicContainer.expectedAmountOut
//                 if(extrinsicIndex == 0){
//                     let firstAssetNode = extrinsicObj.swapExtrinsicContainer.assetNodes[0]
//                     let paraspellChain = chain
//                     let paraspellAsset = firstAssetNode.paraspellAsset
//                     let assetRegistryObject = firstAssetNode.assetRegistryObject
//                     let pathValue = firstAssetNode.pathValue
//                     let pathType = firstAssetNode.pathType
//                 }
                

//                 // const txString = `MOV ${startAsset} -> ${destAsset}`
//                 // let movrBatchSwapParams = await getMovrSwapTx(instructions, false)
                
//                 // let liveWallet = movrBatchSwapParams.wallet;
//                 // let batchContract = movrBatchSwapParams.batchContract;
                
            

//                 let movrBatchSwapParams = extrinsicObj.swapExtrinsicContainer.movrBatchSwapParams
//                 let liveWallet = movrBatchSwapParams.wallet
//                 let batchContract = movrBatchSwapParams.batchContract
//                 let tokens = movrBatchSwapParams.inputTokens
//                 let reverseTxParams = movrBatchSwapParams.reverseSwapParams
//                 let dexes = movrBatchSwapParams.dexAddresses
//                 let inputTokens = movrBatchSwapParams.inputTokens
//                 let outputTokens = movrBatchSwapParams.outputTokens
//                 let movrTxInfo = {
//                     inputTokens: inputTokens,
//                     outputTokens: outputTokens,
//                     dexes: dexes
//                 }

//                 let batchContractAddress = await batchContract.getAddress()
//                 console.log(`Wallet: ${liveWallet.address} | Batch Contract: ${batchContractAddress}`)
//                 // let signer = await getSigner(true)

//                 for(let i = 0; i < tokens.length; i++){
//                     let tokenInput = movrBatchSwapParams.amount0Ins[i] > 0 ? movrBatchSwapParams.amount0Ins[i] : movrBatchSwapParams.amount1Ins[i]
//                     let approval = await checkAndApproveToken(tokens[i], liveWallet, batchContractAddress, tokenInput)
//                 }

//                 let unsubscribeOne, unsubscribeTwo;
//                 let balanceObservableIn$ = await watchTokenBalance(chainId, api, assetInSymbol, chain, liveWallet.address)
//                 let balanceObservableOut$ = await watchTokenBalance(chainId, api, assetOutSymbol, chain, liveWallet.address)
//                 let balancePromiseIn = await getBalanceChange(balanceObservableIn$, (unsub) => {
//                     unsubscribeOne = unsub
//                 })
//                 let balancePromiseOut = await getBalanceChange(balanceObservableOut$, (unsub) => {
//                     unsubscribeTwo = unsub
//                 })

//                 try{
//                     // **************************************************************************************
//                     let txReceipt = await movrTx()
//                     let txHash = await txReceipt.wait()
//                     // **************************************************************************************
        
//                     let tokenInBalanceStats = await balancePromiseIn
//                     let tokenOutBalanceStats = await balancePromiseOut
//                     console.log(`EXPECTED TOKEN IN ${expectedAmountIn.toString()} || ACTUAL TOKEN IN ${JSON.stringify(tokenInBalanceStats.startBalanceString.toString())}`)
//                     console.log(`EXPECTED TOKEN OUT ${expectedAmountOut.toString()} || ACTUAL TOKEN IN ${JSON.stringify(tokenInBalanceStats.changeInBalance.toString())}`)
                    
//                     let swapStats: SwapTxStats = {
//                         txHash: txHash,
//                         chain: chain,
//                         paraId: chainId,
//                         currencyIn: assetInSymbol,
//                         currencyOut: assetOutSymbol,
//                         expectedAmountIn: expectedAmountIn.toString(),
//                         actualAmountIn: tokenInBalanceStats.changeInBalance.toString(),
//                         expectedAmountOut: expectedAmountOut.toString(),
//                         actualAmountOut: tokenOutBalanceStats.changeInBalance.toString(),
//                         tokenInBalanceChange: tokenInBalanceStats,
//                         tokenOutBalanceChange: tokenOutBalanceStats,
//                     }
        
//                     let assetNodes = extrinsicObj.swapExtrinsicContainer.assetNodes
//                     assetNodes.forEach((node, index) => {
//                         let reverseAssetNode;
//                         if(index == assetNodes.length - 1){
//                         reverseAssetNode = new AssetNode({
//                             paraspellChain: node.paraspellChain,
//                             paraspellAsset: node.paraspellAsset,
//                             assetRegistryObject: node.assetRegistryObject,
//                             pathValue: tokenOutBalanceStats.changeInBalance.toNumber(),
//                             pathType: node.pathType
//                         })
//                         } else if(index > 0){
//                             reverseAssetNode = new AssetNode({
//                                 paraspellChain: node.paraspellChain,
//                                 paraspellAsset: node.paraspellAsset,
//                                 assetRegistryObject: node.assetRegistryObject,
//                                 pathValue: node.pathValue,
//                                 pathType: node.pathType
//                             })
//                         }
//                         // reverseNodes.push(reverseAssetNode)
//                     })

//                     let actualAmountIn = tokenInBalanceStats.changeInBalance.toString()
//                     let actualAmountOut = tokenOutBalanceStats.changeInBalance.toString()
//                     // logSwapTxResults(tx, logFilePath)
//                     let arbResultString: ArbExecutionResult = {
//                         assetSymbolIn: assetInSymbol,
//                         assetSymbolOut: assetOutSymbol,
//                         assetAmountIn: Math.abs(Number.parseFloat(actualAmountIn)),
//                         assetAmountOut: Math.abs(Number.parseFloat(actualAmountOut)),
//                         result: `SUCCESS: ${true} - SWAP: (${chain}) ${chainId} ${assetInSymbol} ${actualAmountIn}-> ${assetOutSymbol} ${actualAmountOut}| Dexes: ${JSON.stringify(dexes)}`
//                     }
//                     let txDetails: TxDetails = {
//                         success: true,
//                         txHash: txHash,
//                         movrInfo: movrTxInfo
//                     }
//                     let swapTxResult = {
//                         txString: `(${chain}) ${chainId} ${assetInSymbol} -> ${assetOutSymbol}`,
//                         txDetails: txDetails
//                     }
//                     let pathValueNext = Number.parseFloat(tokenOutBalanceStats.changeInBalanceString)
//                     let pathNode: PathNodeValues = {
//                         pathInLocalId: extrinsicObj.transferExtrinsicContainer.pathInLocalId,
//                         pathOutLocalId: extrinsicObj.transferExtrinsicContainer.pathOutLocalId,
//                         pathInSymbol: assetInSymbol,
//                         pathOutSymbol: assetOutSymbol,
//                         pathSwapType: extrinsicObj.transferExtrinsicContainer.pathSwapType,
//                         pathValue: extrinsicObj.transferExtrinsicContainer.pathAmount,
//                         pathValueNext: pathValueNext
                    
//                     }
//                     resultPathNodes.push(pathNode)
//                     swapTxStats.push(swapStats)
//                     swapTxResults.push(swapTxResult)
//                     arbExecutionResults.push(arbResultString)

//                     let assetRegistryObject = extrinsicObj.swapExtrinsicContainer.assetNodes[extrinsicObj.swapExtrinsicContainer.assetNodes.length - 1].assetRegistryObject;
//                     let lastNodeChainId = assetRegistryObject.tokenData.chain
//                     let lastNodeLocalId = assetRegistryObject.tokenData.localId
//                     let lastNodeAssetSymbol = assetRegistryObject.tokenData.symbol
//                     lastNodeAssetKey = JSON.stringify(lastNodeChainId.toString() + JSON.stringify(lastNodeLocalId))
//                     lastNodeAssetValue = pathValueNext.toString()
//                     lastNode = {
//                         assetKey: lastNodeAssetKey,
//                         assetValue: lastNodeAssetValue,
//                         chainId:lastNodeChainId,
//                         assetSymbol: lastNodeAssetSymbol

//                     }
//                 } catch(e){
//                     unsubscribeOne()
//                     unsubscribeTwo()
//                     console.log("ERROR: " + e)
//                     console.log("MOVR swap failed")
//                     let txDetails: TxDetails = {
//                         success: false,
//                         movrInfo: movrTxInfo
//                     }
//                     let swapTxResult = {
//                         txString: `(${chain}) ${chainId} ${assetInSymbol} -> ${assetOutSymbol}`,
//                         txDetails: txDetails
//                     }

//                     let arbResultString: ArbExecutionResult = {
//                         assetSymbolIn: assetInSymbol,
//                         assetSymbolOut: assetOutSymbol,
//                         assetAmountIn: Math.abs(Number.parseFloat(expectedAmountIn.toString())),
//                         assetAmountOut: 0,
//                         result: `SUCCESS: ${false} - SWAP: (${chain}) ${chainId} ${assetInSymbol} ${expectedAmountIn} -> ${assetOutSymbol} | Dexes: ${JSON.stringify(dexes)}`
//                     }
//                     let pathNode: PathNodeValues = {
//                         pathInLocalId: extrinsicObj.swapExtrinsicContainer.pathInLocalId,
//                         pathOutLocalId: extrinsicObj.swapExtrinsicContainer.pathOutLocalId,
//                         pathInSymbol: assetInSymbol,
//                         pathOutSymbol: assetOutSymbol,
//                         pathSwapType: extrinsicObj.swapExtrinsicContainer.pathSwapType,
//                         pathValue: extrinsicObj.swapExtrinsicContainer.pathAmount,
//                         pathValueNext:0
//                     }
//                     swapTxResults.push(swapTxResult)
//                     arbExecutionResults.push(arbResultString)
//                     resultPathNodes.push(pathNode)
//                     // let pathNextValue = Number.parseFloat(tokenOutBalanceStats.changeInBalanceString)

                    
//                     let extrinsicSetResults: ExtrinsicSetResult = {
//                         success: false,
//                         arbExecutionResult: arbExecutionResults,
//                         resultPathNodes: resultPathNodes,
//                         transferTxStats: transferTxStats,
//                         swapTxStats: swapTxStats,
//                         swapTxResults: swapTxResults,
//                         lastNode: lastNode,
//                         extrinsicIndex: extrinsicIndex
//                     }
//                     return extrinsicSetResults
//                 }
//             }
                
//             extrinsicIndex += 1;
//         // }  
//         executionLoopIndex += 1;
//     } 

//     } catch(e){
//         console.log(e)
//         throw new Error("Extrinsic failed, should have return set results before this")
//     }   

//     logSwapTxStats(swapTxStats, logFilePath, reverseSwaps)
//     logSwapTxResults(swapTxResults, logFilePath, reverseSwaps)
//     logTransferTxStats(transferTxStats, logFilePath, reverseSwaps)
//     logArbExecutionResults(arbExecutionResults, logFilePath, reverseSwaps)

//     let extrinsicSetResults: ExtrinsicSetResult = {
//         success: true,
//         arbExecutionResult: arbExecutionResults,
//         resultPathNodes: resultPathNodes,
//         transferTxStats: transferTxStats,
//         swapTxStats: swapTxStats,
//         swapTxResults: swapTxResults,
//         lastNode: lastNode,
//         extrinsicIndex: extrinsicIndex
//     }
//     return extrinsicSetResults
// }
