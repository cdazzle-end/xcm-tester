import '@galacticcouncil/api-augment/basilisk';
import '@galacticcouncil/api-augment/hydradx';
import * as paraspell from '@paraspell/sdk';
import { ApiPromise, ApiRx, Keyring, WsProvider } from '@polkadot/api';
import { cryptoWaitReady } from "@polkadot/util-crypto";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { localRpcs } from './../config/txConsts.ts';
import { ExecutionState, ExtrinsicSetResultDynamic, ArbFinderNode, LastNode, NewFeeBook, PromiseTracker, Relay, SwapInstruction, TransferInstruction, TxDetails, SingleTransferResultData, SingleSwapResultData, AssetMap, IMyAsset, PNode } from './../types/types.ts';
import { getAssetsAtLocation, getChainIdFromNode, getSigner, printInstructionSet, readLogData, stateSetExecutionSuccess, stateSetExecutionRelay, stateSetLastNode, apiLogger, mainLogger, getApiForNode, getBalanceFromId, queryRelayTokenBalances, getTransferType, getWalletAddressFormatted, listenForXcmpDepositEvent, trackPromise, stateGetExtrinsicSetResults, isSwapResult, isTransferResult, stateGetLastNode, getAssetRegistry, getAssetRegistryMap, getMyAssetById, getRelayTransferFee, getMyAssetBySymbol, logChainStates, getApiMap, getBifrostDexApi, } from './../utils/index.ts';
import { getParaId, TNode } from '@paraspell/sdk';
import { getAdapter,  } from '@polkawallet/bridge';
import bn from 'bignumber.js';
import { testGlmrRpc } from './../swaps/index.ts';
import * as Chopsticks from '@acala-network/chopsticks';
import { buildAndExecuteExtrinsics, buildInstructionSet, buildInstructionSetTest, executeTransferExtrinsic, executeXcmTransfer } from './../execution/index.ts';
import { AssetNode, GlobalState, MyAsset } from './../core/index.ts';
import { arbRunFallbackSearch, arbRunTargetSearch, findLatestFileInLatestDirectory, findNewTargetArb, getBlockNumbers, updateAssetsAndLpsReworked } from './../arbFinder/runArbFinder.ts'
import keyring from '@polkadot/keyring';
import { arbFinderPath } from '../config/index.ts';
// import { acalaFileTest } from '../config/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// export const allConnectionPromises = new Map<string, Promise<ApiPromise>>();
// export const allConnections = new Map<string, ApiPromise>();
// export let promiseApis: Record<number, ApiPromise> = {};
// export let observableApis: Record<number, ApiRx> = {};
// export let apiMap: Map<PNode, ApiPromise> = new Map<TNode, ApiPromise>();

const aliceAddress = "HNZata7iMYWmk5RvZRTiAsSDhV8366zq2YGb3tLH5Upf74F"

// const mgxRpc = 'wss://kusama-rpc.mangata.online'
const dazzleMgxAddres = '5G22cv9fT5RNVm2AV4MKgagmKH9aoZL4289UDcYrToP9K6hQ'
const aliceErc20 = "0xf24FF3a9CF04c71Dbc94D0b566f7A27B94566cac"

// export let globalState: ExecutionState = {
//     tracking: true, // Only false for async allocation
//     relay: null,
//     lastNode: null,
//     lastFilePath: null,
//     extrinsicSetResults: null,
//     transactionState: null,
//     transactionProperties: null,
//     executionAttempts: 0,
//     executionSuccess: true,
//     accumulatedFeeData: null,
//     xcmFeeReserves: null
// }


// async function buildTest(){
//     let relay: Relay = 'polkadot'

//     let latestFile = './testAcaPath.json'
//     let arbPathData = JSON.parse(fs.readFileSync(latestFile, 'utf8'))
//     let assetPath: AssetNode[] = arbPathData.map(result => readLogData(result, relay))

//     assetPath.forEach(asset => {
//         console.log(`Chain: ${asset.getChainId()}, Node: ${asset.paraspellChain}, Asset: ${asset.getAssetRegistrySymbol()}, Amount: ${asset.pathValue}`)
//     })

//     let instructionSet = await buildInstructionSet(relay, assetPath)
//     await printInstructionSet(instructionSet)

//     // await buildPolkadotExtrinsics(relay, instructionSet, false, false, 20)
//     await buildAndExecuteExtrinsics(relay, instructionSet, true, false, 20)
// }

// Use instructions to build and execute tx's one by one. Main execution flow happens here
// async function buildPolkadotExtrinsics(relay: Relay, instructionSet: (SwapInstruction | TransferInstruction)[], chopsticks: boolean, executeMovr: boolean, testLoops: number): Promise<ExtrinsicSetResultDynamic> {
//     let swapInstructions: SwapInstruction[] = [];
//     let extrinsicIndex: IndexObject = {i: 0}
//     let allExtrinsicResultData: (SingleSwapResultData | SingleTransferResultData) [] = [];

//     let nodeEndKeys = relay === 'kusama' ? kusamaNodeKeys : dotNodeKeys

//     if(globalState.extrinsicSetResults != null){
//         console.log("********************************************************")
//         console.log("Using global state extrinsic set results")
//         allExtrinsicResultData = globalState.extrinsicSetResults.allExtrinsicResults
//     } else {
//         console.log("********************************************************")
//         console.log("Extrinsic set is null")
//     }
//     let chainNonces: ChainNonces = relay === 'kusama' ? 
//     {
//         2000: 0,
//         2023: 0,
//         2001: 0,
//         2090: 0,
//         2110: 0,
//         2085: 0
//     } : {
//         2000: 0,
//         2023: 0,
//         2001: 0,
//         2090: 0,
//         2110: 0,
//         2085: 0
//     }
//     let nextInputValue: number = 0;
//     let testLoopIndex = 0;
//     // let lastNode: LastNode;
//     console.log("Instruction set length: ", instructionSet.length)
//     try{
//         for (const instruction of instructionSet) {
//             // console.log("Instruction: ", instruction)
//             // If last successful node is a KSM node, we can finish
//             if(globalState.lastNode != null && nodeEndKeys.includes(globalState.lastNode.assetKey)){
//                 let extrinsicSetResults: ExtrinsicSetResultDynamic = {
//                     success: true,
//                     allExtrinsicResults: allExtrinsicResultData,
//                     lastSuccessfulNode: globalState.lastNode,
//                 }
//                 return extrinsicSetResults
//             }
//             if(testLoopIndex > testLoops){
//                 console.log("Breaking out of loop")
//                 break;
//             }
//             testLoopIndex += 1;
//             switch (instruction.type) {
//                 case InstructionType.Swap:
//                     //If MOVR, SKIP and set next to 0
//                     // if(chopsticks == true && instruction.assetNodes[0].getChainId() == 2023){
//                     //     nextInputValue = 0
//                     //     break;
//                     // }
//                     // If swap is of the same type, accumulate
//                     if(swapInstructions.length == 0 || swapInstructions[swapInstructions.length - 1].pathType == instruction.pathType){
//                         swapInstructions.push(instruction);

//                     // If swap is of a different type, build extrinsic for the so far accumulated swap instructions
//                     } else {
//                         let instructionsToExecute = swapInstructions

//                         while(instructionsToExecute.length > 0){
//                             if(nextInputValue > 0){
//                                 instructionsToExecute[0].assetNodes[0].pathValue = nextInputValue.toString()
//                             }

//                             console.log("Building swap extrinsic: ")

//                             let [swapExtrinsicContainer, remainingInstructions] = await buildSwapExtrinsicDynamic(relay, instructionsToExecute, chainNonces, extrinsicIndex, chopsticks);
//                             let extrinsicObj: ExtrinsicObject = await createSwapExtrinsicObject(swapExtrinsicContainer)

//                             console.log(JSON.stringify(swapExtrinsicContainer.extrinsic))
//                             instructionsToExecute = remainingInstructions
//                             // let extrinsicResultData = await executeAndReturnExtrinsic(extrinsicObj, extrinsicIndex, chopsticks, executeMovr)
//                             // if(extrinsicResultData.success == false){
//                             //     console.log("Extrinsic failed")
//                             //     console.log(extrinsicResultData.arbExecutionResult)
                                
                                
//                             //     allExtrinsicResultData.push(extrinsicResultData)
//                             //     printExtrinsicSetResults(allExtrinsicResultData)
//                             //     // let lastSuccessfulNode = await getLastSuccessfulNodeFromResultData(allExtrinsicResultData)
//                             //     let extrinsicSetResults: ExtrinsicSetResultDynamic = {
//                             //         success: false,
//                             //         extrinsicData: allExtrinsicResultData,
//                             //         lastSuccessfulNode: globalState.lastNode,
//                             //     }
//                             //     setLastExtrinsicSet(extrinsicSetResults)
//                             //     return extrinsicSetResults
//                             // }

//                             // // MOVR swaps return undefined in test, not error just skip
//                             // if(!extrinsicResultData){
//                             //     nextInputValue = 0
//                             //     break;
//                             // }
//                             // allExtrinsicResultData.push(extrinsicResultData)
//                             // let extrinsicSetResults: ExtrinsicSetResultDynamic = {
//                             //     success: true,
//                             //     extrinsicData: allExtrinsicResultData,
//                             //     lastSuccessfulNode: globalState.lastNode,
//                             // }
//                             // setLastExtrinsicSet(extrinsicSetResults)
//                             // nextInputValue = Number.parseFloat(extrinsicResultData.lastNode.assetValue)
//                             // instructionsToExecute = remainingInstructions


//                         }
//                         swapInstructions = [instruction];
//                     }
//                     break;
//                 default:
//                     // For other types of instructions
//                     // First execute any queued up swap instructions
//                     if (swapInstructions.length > 0) {
//                         let instructionsToExecute = swapInstructions
//                         while(instructionsToExecute.length > 0){
//                             if( nextInputValue > 0){
//                                 instructionsToExecute[0].assetNodes[0].pathValue = nextInputValue.toString()
//                             }
//                             console.log("Building swap extrinsic: ")
//                             let [swapExtrinsicContainer, remainingInstructions] = await buildSwapExtrinsicDynamic(relay, instructionsToExecute, chainNonces, extrinsicIndex, chopsticks);

//                             console.log(JSON.stringify(swapExtrinsicContainer.extrinsic))
//                             instructionsToExecute = remainingInstructions
//                             // let extrinsicObj: ExtrinsicObject = {
//                             //     type: "Swap",
//                             //     instructionIndex: swapExtrinsicContainer.instructionIndex,
//                             //     extrinsicIndex: swapExtrinsicContainer.extrinsicIndex,
//                             //     swapExtrinsicContainer: swapExtrinsicContainer
//                             // }
//                             // let extrinsicResultData = await executeAndReturnExtrinsic(extrinsicObj, extrinsicIndex, chopsticks, executeMovr)
//                             // // If undefined, not error just skip
//                             // if(!extrinsicResultData){
//                             //     nextInputValue = 0
//                             //     break;
//                             // }
//                             // if(extrinsicResultData.success == false){
//                             //     console.log("Extrinsic failed")
//                             //     console.log(extrinsicResultData.arbExecutionResult)
//                             //     allExtrinsicResultData.push(extrinsicResultData)
//                             //     printExtrinsicSetResults(allExtrinsicResultData)
//                             //     // let lastSuccessfulNode = await getLastSuccessfulNodeFromResultData(allExtrinsicResultData)
//                             //     let extrinsicSetResults: ExtrinsicSetResultDynamic = {
//                             //         success: false,
//                             //         extrinsicData: allExtrinsicResultData,
//                             //         lastSuccessfulNode: globalState.lastNode,
//                             //     }
//                             //     setLastExtrinsicSet(extrinsicSetResults)
//                             //     return extrinsicSetResults
//                             // }
//                             // allExtrinsicResultData.push(extrinsicResultData)
//                             // let extrinsicSetResults: ExtrinsicSetResultDynamic = {
//                             //     success: true,
//                             //     extrinsicData: allExtrinsicResultData,
//                             //     lastSuccessfulNode: globalState.lastNode,
//                             // }
//                             // setLastExtrinsicSet(extrinsicSetResults)
//                             // nextInputValue = Number.parseFloat(extrinsicResultData.lastNode.assetValue)
//                             // instructionsToExecute = remainingInstructions
//                         }
//                         swapInstructions = [];   
//                     }
//                     // Then execute transfer instructions
//                     let instructionsToExecute = [instruction]
//                     while(instructionsToExecute.length > 0){
//                         if(nextInputValue > 0){
//                             instructionsToExecute[0].assetNodes[0].pathValue = nextInputValue.toString()
//                         }
//                         console.log("Building transfer extrinsic: ")
//                         let [transferExtrinsic, remainingInstructions] = await buildTransferExtrinsicDynamic(relay, instructionsToExecute[0], extrinsicIndex, chopsticks);
//                         instructionsToExecute = remainingInstructions
//                         console.log(JSON.stringify(transferExtrinsic.extrinsic))
//                         // let extrinsicObj: ExtrinsicObject = {
//                         //     type: "Transfer",
//                         //     instructionIndex: transferExtrinsic.instructionIndex,
//                         //     extrinsicIndex: transferExtrinsic.extrinsicIndex,
//                         //     transferExtrinsicContainer: transferExtrinsic
//                         // }
    
//                         // let transferExtrinsicResultData = await executeAndReturnExtrinsic(extrinsicObj, extrinsicIndex, chopsticks, executeMovr)
//                         // // If undefined and running test, either start or dest chain not running in chopsticks. not error just skip
//                         // if(chopsticks && !transferExtrinsicResultData){
//                         //     nextInputValue = 0
//                         //     break;
//                         // }
//                         // if(transferExtrinsicResultData.success == false){
//                         //     console.log("Extrinsic failed")
//                         //     console.log(transferExtrinsicResultData.arbExecutionResult)
//                         //     allExtrinsicResultData.push(transferExtrinsicResultData)
//                         //     printExtrinsicSetResults(allExtrinsicResultData)
//                         //     // let lastSuccessfulNode = await getLastSuccessfulNodeFromResultData(allExtrinsicResultData)
//                         //     let extrinsicSetResults: ExtrinsicSetResultDynamic = {
//                         //         success: false,
//                         //         extrinsicData: allExtrinsicResultData,
//                         //         lastSuccessfulNode: globalState.lastNode,
//                         //     }
//                         //     setLastExtrinsicSet(extrinsicSetResults)
//                         //     return extrinsicSetResults
//                         // }
                        
//                         // nextInputValue = Number.parseFloat(transferExtrinsicResultData.lastNode.assetValue)
//                         // allExtrinsicResultData.push(transferExtrinsicResultData)
//                         // instructionsToExecute = remainingInstructions
//                         // let extrinsicSetResults: ExtrinsicSetResultDynamic = {
//                         //     success: true,
//                         //     extrinsicData: allExtrinsicResultData,
//                         //     lastSuccessfulNode: globalState.lastNode,
//                         // }
//                         // setLastExtrinsicSet(extrinsicSetResults)
//                     }
//                     break;

//             }
//         }
//         // Handle any remaining swap instructions at the end of the instruction set
//         // let instructionsToExecute = swapInstructions
//         // while(instructionsToExecute.length > 0 && testLoopIndex < testLoops){
//         //     let [extrinsicResultData, remainingInstructions] = await buildAndExecuteSwapExtrinsic(relay, instructionsToExecute, chopsticks, executeMovr, nextInputValue, chainNonces, extrinsicIndex)
//         //     if(extrinsicResultData.success == false){
//         //         console.log("Extrinsic failed")
//         //         console.log(extrinsicResultData.arbExecutionResult)
//         //         allExtrinsicResultData.push(extrinsicResultData)
//         //         printExtrinsicSetResults(allExtrinsicResultData)
//         //         // let lastSuccessfulNode = await getLastSuccessfulNodeFromResultData(allExtrinsicResultData)
//         //         let extrinsicSetResults: ExtrinsicSetResultDynamic = {
//         //             success: false,
//         //             extrinsicData: allExtrinsicResultData,
//         //             lastSuccessfulNode: globalState.lastNode,
//         //         }
//         //         setLastExtrinsicSet(extrinsicSetResults)
//         //         return extrinsicSetResults
//         //     }
//         //     // If undefined, not error just skip
//         //     if(!extrinsicResultData){
//         //         nextInputValue = 0
//         //         break;
//         //     }
//         //     allExtrinsicResultData.push(extrinsicResultData)
//         //     let extrinsicSetResults: ExtrinsicSetResultDynamic = {
//         //         success: true,
//         //         extrinsicData: allExtrinsicResultData,
//         //         lastSuccessfulNode: globalState.lastNode,
//         //     }
//         //     setLastExtrinsicSet(extrinsicSetResults)
//         //     nextInputValue = Number.parseFloat(extrinsicResultData.lastNode.assetValue)
//         //     instructionsToExecute = remainingInstructions
//         // }
//         swapInstructions = [];   
//     } catch(e){
//         // Need to properly handle this. Error should be extrinsicResultData
//         // console.log(e)
//         // printExtrinsicSetResults(allExtrinsicResultData)
//         // // let lastSuccessfulNode = await getLastSuccessfulNodeFromResultData(allExtrinsicResultData)
//         // let extrinsicSetResults: ExtrinsicSetResultDynamic = {
//         //     success: false,
//         //     extrinsicData: allExtrinsicResultData,
//         //     lastSuccessfulNode: globalState.lastNode,
//         // }
//         // setLastExtrinsicSet(extrinsicSetResults)
//         // return extrinsicSetResults

//     }
//     // let lastSuccessfulNode = await getLastSuccessfulNodeFromResultData(allExtrinsicResultData)
//     // let extrinsicSetResults: ExtrinsicSetResultDynamic = {
//     //     success: true,
//     //     extrinsicData: allExtrinsicResultData,
//     //     lastSuccessfulNode: globalState.lastNode,
//     // }
//     // setLastExtrinsicSet(extrinsicSetResults)
//     // return extrinsicSetResults;
// }

// Use instructions to build and execute tx's one by one. Main execution flow happens here
// async function buildAndExecuteExtrinsics(relay: Relay, instructionSet: (SwapInstruction | TransferInstruction)[], chopsticks: boolean, executeMovr: boolean, testLoops: number): Promise<ExtrinsicSetResultDynamic> {
//     let swapInstructions: SwapInstruction[] = [];
//     let extrinsicIndex: IndexObject = {i: 0}
//     let allExtrinsicResultData: (SingleSwapResultData | SingleTransferResultData) [] = [];

//     let nodeEndKeys = relay === 'kusama' ? kusamaNodeKeys : dotNodeKeys

//     if(globalState.extrinsicSetResults != null){
//         console.log("********************************************************")
//         console.log("Using global state extrinsic set results")
//         allExtrinsicResultData = globalState.extrinsicSetResults.allExtrinsicResults
//     } else {
//         console.log("********************************************************")
//         console.log("Extrinsic set is null")
//     }
//     let chainNonces: ChainNonces = relay === 'kusama' ? 
//     {
//         2000: 0,
//         2023: 0,
//         2001: 0,
//         2090: 0,
//         2110: 0,
//         2085: 0
//     } : {
//         2000: 0,
//         2023: 0,
//         2001: 0,
//         2090: 0,
//         2110: 0,
//         2085: 0
//     }
//     let nextInputValue: string = "0";
//     let testLoopIndex = 0;
//     // let lastNode: LastNode;
//     try{
//         for (const instruction of instructionSet) {

//             // If last successful node is a KSM node, we can finish
//             if(globalState.lastNode != null && nodeEndKeys.includes(globalState.lastNode.assetKey)){
//                 let extrinsicSetResults: ExtrinsicSetResultDynamic = {
//                     success: true,
//                     allExtrinsicResults: allExtrinsicResultData,
//                     lastSuccessfulNode: globalState.lastNode,
//                 }
//                 return extrinsicSetResults
//             }
//             if(testLoopIndex > testLoops){
//                 break;
//             }
//             testLoopIndex += 1;
//             switch (instruction.type) {
//                 case InstructionType.Swap:
//                     //If EVM, SKIP and set next to 0
//                     if(
//                         chopsticks == true && relay == 'kusama' && instruction.assetNodes[0].getChainId() == 2023 ||
//                         chopsticks == true && relay == 'polkadot' && instruction.assetNodes[0].getChainId() == 2004
//                     ){
//                         nextInputValue = "0"
//                         break;
//                     }
//                     // If swap is of the same type, accumulate
//                     if(swapInstructions.length == 0 || swapInstructions[swapInstructions.length - 1].pathType == instruction.pathType){
//                         swapInstructions.push(instruction);

//                     // If swap is of a different type, build extrinsic for the so far accumulated swap instructions
//                     } else {
//                         let instructionsToExecute = swapInstructions

//                         while(instructionsToExecute.length > 0){
//                             if(Number.parseFloat(nextInputValue) > 0){
//                                 instructionsToExecute[0].assetNodes[0].pathValue = nextInputValue.toString()
//                             }
//                             let [swapExtrinsicContainer, remainingInstructions] = await buildSwapExtrinsicDynamic(relay, instructionsToExecute, chainNonces, extrinsicIndex, chopsticks);
//                             let extrinsicObj: ExtrinsicObject = await createSwapExtrinsicObject(swapExtrinsicContainer)
                            
//                             let extrinsicResultData = await executeAndReturnExtrinsic(extrinsicObj, extrinsicIndex, chopsticks, executeMovr)
//                             // MOVR swaps return undefined in test, not error just skip
//                             if(!extrinsicResultData){
//                                 nextInputValue = "0"
//                                 break;
//                             }
                            
//                             if(extrinsicResultData.success == false){
//                                 console.log("Extrinsic failed")
//                                 console.log(extrinsicResultData.arbExecutionResult)
                                
                                
//                                 allExtrinsicResultData.push(extrinsicResultData)
//                                 printExtrinsicSetResults(allExtrinsicResultData)
//                                 // let lastSuccessfulNode = await getLastSuccessfulNodeFromResultData(allExtrinsicResultData)
//                                 let extrinsicSetResults: ExtrinsicSetResultDynamic = {
//                                     success: false,
//                                     allExtrinsicResults: allExtrinsicResultData,
//                                     lastSuccessfulNode: globalState.lastNode,
//                                 }
//                                 setLastExtrinsicSet(extrinsicSetResults, relay)
//                                 return extrinsicSetResults
//                             }

                            
//                             allExtrinsicResultData.push(extrinsicResultData)
//                             let extrinsicSetResults: ExtrinsicSetResultDynamic = {
//                                 success: true,
//                                 allExtrinsicResults: allExtrinsicResultData,
//                                 lastSuccessfulNode: globalState.lastNode,
//                             }
//                             setLastExtrinsicSet(extrinsicSetResults, relay)
//                             nextInputValue = extrinsicResultData.lastNode.assetValue
//                             instructionsToExecute = remainingInstructions

//                         }
//                         swapInstructions = [instruction];
//                     }
//                     break;
//                 default:
//                     // For other types of instructions
//                     // First execute any queued up swap instructions
//                     if (swapInstructions.length > 0) {
//                         let instructionsToExecute = swapInstructions
//                         while(instructionsToExecute.length > 0){
//                             if( Number.parseFloat(nextInputValue) > 0){
//                                 instructionsToExecute[0].assetNodes[0].pathValue = nextInputValue.toString()
//                             }
//                             let [swapExtrinsicContainer, remainingInstructions] = await buildSwapExtrinsicDynamic(relay, instructionsToExecute, chainNonces, extrinsicIndex, chopsticks);
//                             let extrinsicObj: ExtrinsicObject = {
//                                 type: "Swap",
//                                 instructionIndex: swapExtrinsicContainer.instructionIndex,
//                                 extrinsicIndex: swapExtrinsicContainer.extrinsicIndex,
//                                 swapExtrinsicContainer: swapExtrinsicContainer
//                             }
//                             let extrinsicResultData = await executeAndReturnExtrinsic(extrinsicObj, extrinsicIndex, chopsticks, executeMovr)
//                             // If undefined, not error just skip
//                             if(!extrinsicResultData){
//                                 nextInputValue = "0"
//                                 break;
//                             }
//                             if(extrinsicResultData.success == false){
//                                 console.log("Extrinsic failed")
//                                 console.log(extrinsicResultData.arbExecutionResult)
//                                 allExtrinsicResultData.push(extrinsicResultData)
//                                 printExtrinsicSetResults(allExtrinsicResultData)
//                                 // let lastSuccessfulNode = await getLastSuccessfulNodeFromResultData(allExtrinsicResultData)
//                                 let extrinsicSetResults: ExtrinsicSetResultDynamic = {
//                                     success: false,
//                                     allExtrinsicResults: allExtrinsicResultData,
//                                     lastSuccessfulNode: globalState.lastNode,
//                                 }
//                                 setLastExtrinsicSet(extrinsicSetResults, relay)
//                                 return extrinsicSetResults
//                             }
//                             allExtrinsicResultData.push(extrinsicResultData)
//                             let extrinsicSetResults: ExtrinsicSetResultDynamic = {
//                                 success: true,
//                                 allExtrinsicResults: allExtrinsicResultData,
//                                 lastSuccessfulNode: globalState.lastNode,
//                             }
//                             setLastExtrinsicSet(extrinsicSetResults, relay)
//                             nextInputValue = extrinsicResultData.lastNode.assetValue
//                             instructionsToExecute = remainingInstructions
//                         }
//                         swapInstructions = [];   
//                     }
//                     // Then execute transfer instructions
//                     let instructionsToExecute = [instruction]
//                     while(instructionsToExecute.length > 0){
//                         if(Number.parseFloat(nextInputValue) > 0){
//                             instructionsToExecute[0].assetNodes[0].pathValue = nextInputValue.toString()
//                         }
//                         let [transferExtrinsic, remainingInstructions] = await buildTransferExtrinsicDynamic(relay, instructionsToExecute[0], extrinsicIndex, chopsticks);
//                         let extrinsicObj: ExtrinsicObject = {
//                             type: "Transfer",
//                             instructionIndex: transferExtrinsic.instructionIndex,
//                             extrinsicIndex: transferExtrinsic.extrinsicIndex,
//                             transferExtrinsicContainer: transferExtrinsic
//                         }
    
//                         let transferExtrinsicResultData = await executeAndReturnExtrinsic(extrinsicObj, extrinsicIndex, chopsticks, executeMovr)
//                         // If undefined and running test, either start or dest chain not running in chopsticks. not error just skip
//                         if(chopsticks && !transferExtrinsicResultData){
//                             nextInputValue = "0"
//                             break;
//                         }
//                         if(transferExtrinsicResultData.success == false){
//                             console.log("Extrinsic failed")
//                             console.log(transferExtrinsicResultData.arbExecutionResult)
//                             allExtrinsicResultData.push(transferExtrinsicResultData)
//                             printExtrinsicSetResults(allExtrinsicResultData)
//                             // let lastSuccessfulNode = await getLastSuccessfulNodeFromResultData(allExtrinsicResultData)
//                             let extrinsicSetResults: ExtrinsicSetResultDynamic = {
//                                 success: false,
//                                 allExtrinsicResults: allExtrinsicResultData,
//                                 lastSuccessfulNode: globalState.lastNode,
//                             }
//                             setLastExtrinsicSet(extrinsicSetResults, relay)
//                             return extrinsicSetResults
//                         }
                        
//                         nextInputValue = transferExtrinsicResultData.lastNode.assetValue
//                         allExtrinsicResultData.push(transferExtrinsicResultData)
//                         instructionsToExecute = remainingInstructions
//                         let extrinsicSetResults: ExtrinsicSetResultDynamic = {
//                             success: true,
//                             allExtrinsicResults: allExtrinsicResultData,
//                             lastSuccessfulNode: globalState.lastNode,
//                         }
//                         setLastExtrinsicSet(extrinsicSetResults, relay)
//                     }
//                     break;

//             }
//         }
//         // Handle any remaining swap instructions at the end of the instruction set
//         let instructionsToExecute = swapInstructions
//         while(instructionsToExecute.length > 0 && testLoopIndex < testLoops){
//             let [extrinsicResultData, remainingInstructions] = await buildAndExecuteSwapExtrinsic(relay, instructionsToExecute, chopsticks, executeMovr, nextInputValue, chainNonces, extrinsicIndex)
//             if(extrinsicResultData.success == false){
//                 console.log("Extrinsic failed")
//                 console.log(extrinsicResultData.arbExecutionResult)
//                 allExtrinsicResultData.push(extrinsicResultData)
//                 printExtrinsicSetResults(allExtrinsicResultData)
//                 // let lastSuccessfulNode = await getLastSuccessfulNodeFromResultData(allExtrinsicResultData)
//                 let extrinsicSetResults: ExtrinsicSetResultDynamic = {
//                     success: false,
//                     allExtrinsicResults: allExtrinsicResultData,
//                     lastSuccessfulNode: globalState.lastNode,
//                 }
//                 setLastExtrinsicSet(extrinsicSetResults, relay)
//                 return extrinsicSetResults
//             }
//             // If undefined, not error just skip
//             if(!extrinsicResultData){
//                 nextInputValue = "0"
//                 break;
//             }
//             allExtrinsicResultData.push(extrinsicResultData)
//             let extrinsicSetResults: ExtrinsicSetResultDynamic = {
//                 success: true,
//                 allExtrinsicResults: allExtrinsicResultData,
//                 lastSuccessfulNode: globalState.lastNode,
//             }
//             setLastExtrinsicSet(extrinsicSetResults, relay)
//             nextInputValue = extrinsicResultData.lastNode.assetValue
//             instructionsToExecute = remainingInstructions
//         }
//         swapInstructions = [];   
//     } catch(e){
//         // Need to properly handle this. Error should be extrinsicResultData
//         console.log(e)
//         printExtrinsicSetResults(allExtrinsicResultData)
//         // let lastSuccessfulNode = await getLastSuccessfulNodeFromResultData(allExtrinsicResultData)
//         let extrinsicSetResults: ExtrinsicSetResultDynamic = {
//             success: false,
//             allExtrinsicResults: allExtrinsicResultData,
//             lastSuccessfulNode: globalState.lastNode,
//         }
//         setLastExtrinsicSet(extrinsicSetResults, relay)
//         return extrinsicSetResults

//     }
//     // let lastSuccessfulNode = await getLastSuccessfulNodeFromResultData(allExtrinsicResultData)
//     let extrinsicSetResults: ExtrinsicSetResultDynamic = {
//         success: true,
//         allExtrinsicResults: allExtrinsicResultData,
//         lastSuccessfulNode: globalState.lastNode,
//     }
//     setLastExtrinsicSet(extrinsicSetResults, relay)
//     return extrinsicSetResults;
// }
// async function runFromLastNode(relay: Relay, chopsticks: boolean, executeMovr: boolean, customInput: number = 0){
//     globalState = getLastExecutionState(relay)
//     let lastTransactionState: TransactionState = globalState.transactionState

//     // If last transaction has been submitted but not finalized, we need to query the balances to see if it completed successfully or not
//     if(globalState.transactionState == TransactionState.Broadcasted){
//         await confirmLastTransactionSuccess(globalState.transactionProperties)
//         globalState.transactionState = TransactionState.PreSubmission
//     }

//     globalState.extrinsicSetResults.allExtrinsicResults.forEach((extrinsicData) => {
//         console.log(JSON.stringify(extrinsicData.arbExecutionResult, null, 2))
//     })
//     // globalState = executionState

//     if(!globalState.lastNode){
//         console.log("Last node is undefined. No extrinsics executed successfully. Exiting")
//         return;
//     }
    
//     const currentDateTime = new Date().toString();

//     console.log(currentDateTime);

//     let arbLoops = 0
//     let arbSuccess = false

//     //Rerun arb until success or last node is Kusama
//     while(!arbSuccess && globalState.lastNode.chainId != 0 && arbLoops < 1){
//         arbLoops += 1

//         if(lastTransactionState == TransactionState.Broadcasted){
//             let transactionSuccess = await confirmLastTransactionSuccess(globalState.transactionProperties)
//             globalState.transactionState = TransactionState.PreSubmission
//             // lastNode = globalState.lastNode
//         }
//         // let lastNodeValueTemp = '40.00'
//         let arbInput = customInput > 0 ? customInput : globalState.lastNode.assetValue
//         let targetNode = relay === 'kusama' ? ksmTargetNode : dotTargetNode
//         let functionArgs = `${globalState.lastNode.assetKey} ${targetNode} ${arbInput}`
//         customInput = 0
//         console.log("Executing Arb Fallback with args: " + functionArgs)
        

//         let arbResults: JsonPathNode[];
//         try{
//             arbResults = await runAndReturnFallbackArb(functionArgs, chopsticks, relay)
//         } catch {
//             console.log("Failed to run fallback arb")
//             continue;
//         }
//         let assetPath: AssetNode[] = arbResults.map(result => readLogData(result, relay))
//         let instructions = await buildInstructionSet(relay, assetPath)
//         await printInstructionSet(instructions)
//         let extrinsicSetResults = await buildAndExecuteExtrinsics(relay, instructions, chopsticks, executeMovr, 100)

//         await logAllResultsDynamic(relay, globalState.lastFilePath, true)
//         // logAllArbAttempts(relay, globalState.lastFilePath, chopsticks)
//         if(extrinsicSetResults.success){
//             arbSuccess = true
//         }

//         globalState.lastNode = globalState.lastNode
//         if(!globalState.lastNode){
//             console.log("Last node undefined. ERROR: some extrinsics have executed successfully")
//             throw new Error("Last node undefined. ERROR: some extrinsics have executed successfully")
//         }
//     }
//     if(arbSuccess){
//         setExecutionSuccess(true, relay)
//     }
//     // let arbAmountOut = await getTotalArbResultAmount(relay, globalState.lastNode)
//     // await logProfits(relay, arbAmountOut, globalState.lastFilePath, chopsticks )
// }

async function executeTestPath(relay: Relay, chopsticks: boolean, executeMovr: boolean){
    stateSetExecutionSuccess(false)    
    stateSetExecutionRelay(relay)

    let testFilePath = path.join(__dirname, `./testXcmPath.json`)
    let arbPathData: ArbFinderNode[] = JSON.parse(fs.readFileSync(testFilePath, 'utf8'))

    let assetPath: AssetNode[] = arbPathData.map(result => readLogData(result, relay))

    let firstNode: LastNode = {
        assetKey: assetPath[0].getAssetSymbol(),
        assetValue: assetPath[0].pathValue,
        chainId: assetPath[0].getChainId(),
        assetSymbol: assetPath[0].getAssetSymbol()
    }
    // Set LAST NODE to first node in execution path
    await stateSetLastNode(firstNode)

    // BUILD instruction set from asset path
    let instructionsToExecute: (SwapInstruction | TransferInstruction)[] = await buildInstructionSet(relay, assetPath)
    await printInstructionSet(instructionsToExecute)

    let testLoops = 100

    let executionResults: ExtrinsicSetResultDynamic = await buildAndExecuteExtrinsics(relay, instructionsToExecute, chopsticks, executeMovr, false)
}

async function testXcm(){
    let chopsticks = true
    let relay: Relay = 'polkadot'

    
    // let assetId = "USDT" // USDT
    // let amount = "1000000" // 1000 hdx
    
    // let fromNode: TNode = 'HydraDX'
    // let signer = await getSigner(chopsticks, false)
    
    // let toNode: TNode = 'AssetHubPolkadot'
    // let destWallet = await getSigner(chopsticks, false)

    // let fromApi = await getApiForNode(fromNode, chopsticks)
    // let toApi = await getApiForNode(toNode, chopsticks)
    
    // let xcmTx = paraspell.Builder(fromApi).from(fromNode).to(toNode).currency(assetId).amount(amount).address(destWallet.address).build()
    // // let xcmTx = paraspell.Builder(fromApi).to(toNode).amount(amount).address(destWallet.address).build()
    // console.log(JSON.stringify(xcmTx.toHuman()))

    // let txResult: Promise<TxDetails> = executeXcmTransfer(xcmTx, signer); 
    // console.log("Execute Transfer: tx promise created. Waiting for result...")
    // let txResultData = await txResult

    // let xcmEventPromise = listenForDestinationDepositAmounts(toApi, toNode, "hrmp", destWallet.address, txResultData.xcmMessageHash);

    // console.log("Wait for xcmp event")
    // let eventData  = await xcmEventPromise as any
    // console.log("XCM Event Data: " + JSON.stringify(eventData, null, 2))
}

async function testDepositEventListeners(){
    const chopsticks = true
    const relay: Relay = 'polkadot'
    const fromNode: TNode = 'Moonbeam'
    const fromParaId = getChainIdFromNode(fromNode)
    const toNode: TNode = 'HydraDX'
    const toParaId = getChainIdFromNode(toNode)
    const startAsset = new MyAsset(getMyAssetBySymbol(fromParaId, 'GLMR', 'polkadot'))
    const destAsset = new MyAsset(getMyAssetBySymbol(toParaId, 'GLMR', 'polkadot'))
    const amount = '100000000000000000000'
    
    const fromEvm = fromParaId === 2004 ? true : false
    const toEvm = toParaId === 2004 ? true : false

    const fromSigner = await getSigner(chopsticks, fromNode)
    const toSigner = await getSigner(chopsticks, toNode)

    const fromApi = await getApiForNode(fromNode, chopsticks)
    const toApi = await getApiForNode(toNode, chopsticks)

    
    const inputAssetId = JSON.stringify(startAsset.getLocalId()).replace(/\\|"/g, "")
    const xcmTx = paraspell.Builder(fromApi).from(fromNode).to(toNode).currency(inputAssetId).amount(amount).address(toSigner.address).build()
    
    const xcmTxProperties = xcmTx.toHuman() as any

    let keyring = new Keyring({
        ss58Format: 0,
        type: 'sr25519'
    })
    let ss58FormatDest = await toApi.consts.system.ss58Prefix;

    let transferType = getTransferType(fromNode, toNode)
    let destWalletFormatted = getWalletAddressFormatted(toSigner, keyring, toNode, ss58FormatDest)
    const destinationAssetDecimals = Number.parseInt(startAsset.tokenData.decimals)

    let destBalanceUnsub: any
    // const { balanceChangePromise: balanceChangePromise, unsubscribe } = await watchBalanceChange(relay, chopsticks, api, asset, address);
    // const balanceChangeTracker = trackPromise(balanceChangePromise);
    // return { balanceChangeTracker, unsubscribe };
    // let destBalanceObservable$ = await watchTokenBalanceChange(relay, toParaId, chopsticks, toApi, destAsset, toSigner.address)
    // let destAdapterBalanceChangePromise = getBalanceChange(destBalanceObservable$, (unsub) =>{
    //     destBalanceUnsub = unsub
    // })

    // let destBalanceDepositTracker: PromiseTracker = trackPromise(destAdapterBalanceChangePromise)

    // let txResult = executeXcmTransfer(xcmTx, fromSigner)
    // let txDetails = await txResult
    // let xcmTransferId = txDetails.xcmMessageHash

    // let depositEventPromise = listenForXcmpDepositEvent(
    //     toApi, 
    //     toNode, 
    //     transferType,
    //     destAsset, 
    //     destWalletFormatted, 
    //     destBalanceDepositTracker, 
    //     xcmTxProperties, 
    //     xcmTransferId
    // ) 

    // let depositEventTracker = trackPromise(depositEventPromise)

    // const depositEventData = await depositEventPromise

    // console.log(JSON.stringify(depositEventData, null, 2))
}

async function buildTest(){
    let relay: Relay = 'polkadot'
    let chopsticks: boolean = true
    let executeMovr: boolean = false
    // let latestFiles = getLatestAsyncFilesPolkadot()
    // let latestFile = latestFiles[1][1] // latest file with 1 amount input
    // console.log(`Latest file: ${latestFile}`)
    // setLastFile(latestFile, relay)
    let latestFile = './tests/testXcmPath.json'
    let arbPathData = JSON.parse(fs.readFileSync(latestFile, 'utf8'))
    let assetPath: AssetNode[] = arbPathData.map(result => readLogData(result, relay))

    assetPath.forEach(asset => {
        console.log(`Asset Node path data main: ${JSON.stringify(asset.pathData)}`)
        console.log(
            `Chain: ${asset.getChainId()}, 
            Node: ${asset.chain}, 
            Asset: ${asset.getAssetSymbol()}, 
            Amount: ${asset.pathValue}, 
            Fee Amounts: ${JSON.stringify(asset.pathData.xcmDepositFeeAmounts)}, 
            Reserve Amounts: ${JSON.stringify(asset.pathData.xcmDepositReserveAmounts)}`
        )
    })
    console.log("Building instructions")

    let instructionSet = buildInstructionSetTest(relay, assetPath)
    printInstructionSet(instructionSet)

    // await buildPolkadotExtrinsics(relay, instructionSet, false, false, 20)
    let results = await buildAndExecuteExtrinsics(relay, instructionSet, chopsticks, executeMovr, true)
    console.log(`Results: ${JSON.stringify(results.success)}`)
}

async function testAca(){
    let chopsticks = true
    let executeMovr = false
    let api = await getApiForNode('Acala', chopsticks)
    await api.isReady

    console.log("API READY")
    let number = await api.query.system.number()

    console.log("Block number: ", number.toNumber())
}

async function testApi(){
    // const api = await getApiForNode('HydraDX', true)

    // let block = await api.query.system.number()

    // console.log('block: ' + block)
    await queryRelayTokenBalances(true, 'polkadot')
}

async function testAssetLookup(){
    const key = {"NativeAssetId":{"Token":"AUSD"}}
    // let assetObject = getAssetRegistryObject(2000, key, 'polkadot')
    let asset = getMyAssetBySymbol(2000, 'ACA', 'polkadot')
    const id = asset.tokenData.localId
    console.log(id)
    console.log(JSON.stringify(id))
    console.log('-------------')
    let assetObject = getMyAssetById(2000, JSON.stringify(id).replace(/\\|"/g, ""), 'polkadot')
    console.log(assetObject.tokenData.localId)

    const registry = getAssetRegistry('polkadot').filter((assetFilter) => assetFilter.tokenData.chain === 2000)
    registry.forEach((assetR) => {
        console.log(JSON.stringify(assetR.tokenData.localId).replace(/\\|"/g, ""))
    })

}

// async function testMoonXcm(){

//     let chopsticks = true
//     let relay: Relay = 'polkadot'
//     let fromNode: TNode = 'HydraDX'
//     let toNode: TNode = 'Moonbeam'

//     let fromParaId = getParaId(fromNode)
//     let toParaId = getParaId(toNode)

//     let assetId = "HDX"
//     let xcmAmount = "10000000000000" // 100 hdx
//     let relayAmount = "1000000000"

//     let fromEvm = fromParaId == 2004 ? true : false
//     let toEvm = toParaId == 2004 ? true : false 

//     let signer = await getSigner(chopsticks, fromEvm)
//     let destWallet = await getSigner(chopsticks, toEvm)

//     let polkadotWallet = await getSigner(chopsticks, false)
//     let keyring = new Keyring({
//         ss58Format: 0,
//         type: 'sr25519'
//     })

    
//     let relayApi = await getApiForNode("Polkadot", chopsticks)
//     let fromApi = await getApiForNode(fromNode, chopsticks)
//     let toApi = await getApiForNode(toNode, chopsticks)

    
//     let ss58FormatDest = await toApi.consts.system.ss58Prefix;
//     let destWalletFormatted = toParaId == 2004 ? 
//         destWallet.address :
//         keyring.encodeAddress(destWallet.address, ss58FormatDest.toNumber())

//     // let paraToRelayTx = paraspell.Builder(fromApi).from(fromNode).amount(relayAmount).address(polkadotWallet.address).build()
//     // console.log(JSON.stringify(paraToRelayTx.toHuman()))
//     let xcmTx = paraspell.Builder(fromApi).from(fromNode).to(toNode).currency(assetId).amount(xcmAmount).address(destWalletFormatted).build()
//     console.log(JSON.stringify(xcmTx.toHuman()))

//     let originNativeChainToken = fromApi.registry.chainTokens[0]
//     let originNativeBalance = await getBalanceChainAsset(chopsticks, relay, fromNode, fromParaId, originNativeChainToken)
//     let originTransferBalance = await getBalanceChainAsset(chopsticks, relay, fromNode, fromParaId, assetId)
//     // let originNativeChainToken = relayApi.registry.chainTokens[0]
//     // let originNativeBalance = await getBalanceChainAsset(chopsticks, relay, "Polkadot", 0, originNativeChainToken)
//     // let originTransferBalance = await getBalanceChainAsset(chopsticks, relay, fromNode, fromParaId, assetId)
//     let currentBalanceNative = new bn(originNativeBalance.free.toChainData())
//     let currentBalanceTransfer = new bn(originTransferBalance.free.toChainData())

//     let destitnationNativeChainToken = toApi.registry.chainTokens[0]
//     let destinationNativeBalance = new bn((await getBalanceChainAsset(chopsticks, relay, toNode, toParaId, destitnationNativeChainToken)).free.toChainData())
//     let destinationTransferBalance = new bn((await getBalanceChainAsset(chopsticks, relay, toNode, toParaId, assetId)).free.toChainData())
    
//     // let destitnationNativeChainToken = fromApi.registry.chainTokens[0]
//     // // let destinationNativeBalance = new bn((await getBalanceChainAsset(chopsticks, relay, fromNode, fromParaId, destitnationNativeChainToken)).free.toChainData())
//     // let destinationTransferBalance = new bn((await getBalanceChainAsset(chopsticks, relay,fromNode, fromParaId, "DOT")).free.toChainData())
    
//     // let relayToParaTx = paraspell.Builder(relayApi).to(fromNode).amount(relayAmount).address(destWallet.address).build()
//     let paraToParaTxReceipts = await executeXcmTransfer(xcmTx, signer);
//     console.log("Getting origin transfer fees")
//     let originTransferData = getXcmTransferEventData(fromNode, assetId, originNativeChainToken, paraToParaTxReceipts.finalized)

//     // let relayToParaTxReceipt = await executeXcmTransfer(relayToParaTx, polkadotWallet);
//     // let depositPromiseDmp = listenForXcmpEventForNode(toApi, toNode, "dmp", destWalletFormatted, relayToParaTxReceipt.xcmHash);
//     // let depositEventDmp = await depositPromiseDmp
    
//     console.log("XCM fee event: " + JSON.stringify(paraToParaTxReceipts.feeEvent, null, 2))
    

//     let depositPromiseHrmp = listenForDestinationDepositAmounts(toApi, toNode, "hrmp", assetId, 0, destWalletFormatted, paraToParaTxReceipts.xcmMessageHash, paraToParaTxReceipts.xcmMessageId);
//     // let depositPromiseUmp = listenForDestinationDepositAmounts(toApi, toNode, "hrmp", assetId, destWalletFormatted, paraToParaTxReceipts.xcmMessageHash, paraToParaTxReceipts.xcmMessageId);
//     let depositEventData = await depositPromiseHrmp
//     // let [depositAmountEvent, depositFeeEvent] = depositEventData


//     let finalBalanceOriginNative = new bn((await getBalanceChainAsset(chopsticks, relay, fromNode, fromParaId, originNativeChainToken)).free.toChainData())
//     let finalBalanceOriginTransfer = new bn((await getBalanceChainAsset(chopsticks, relay, fromNode, fromParaId, assetId)).free.toChainData())

//     // let finalBalanceOriginNative = new bn((await getBalanceChainAsset(chopsticks, relay, "Polkadot", 0, originNativeChainToken)).free.toChainData())
//     // let finalBalanceOriginTransfer = new bn((await getBalanceChainAsset(chopsticks, relay, fromNode, fromParaId, assetId)).free.toChainData())

//     let finalBalanceDestinationNative = new bn((await getBalanceChainAsset(chopsticks, relay, toNode, toParaId, destitnationNativeChainToken)).free.toChainData())
//     let finalBalanceDestinationTransfer = new bn((await getBalanceChainAsset(chopsticks, relay, toNode, toParaId, assetId)).free.toChainData())

//     let originTransferAmount = currentBalanceTransfer.minus(finalBalanceOriginTransfer)
//     let originCalculatedFee = finalBalanceOriginNative.minus(currentBalanceNative)

//     // let originTransferAmount = currentBalanceNative.minus(finalBalanceOriginNative)
//     // let originCalculatedFee = finalBalanceOriginNative.minus(currentBalanceNative)

//     let destinationCalculatedDepositAmount = finalBalanceDestinationTransfer.minus(destinationTransferBalance)
//     let destinationNativeBalanceChange = finalBalanceDestinationNative.minus(destinationNativeBalance)

//     let destinationCalculatedDepositFee = originTransferAmount.minus(destinationCalculatedDepositAmount)

//     console.log(`BALANCES: Origin transfer amount (ORIGIN CHANGE IN TRANSFER TOKEN AMOUNT): ${originTransferAmount.toString()}`)
//     console.log(`BALANCES: Origin calculated fee (ORIGIN CHANGE IN NATIVE TOKEN BALANCE): ${originCalculatedFee.toString()}`)
//     console.log(`BALANCES: Destination deposit amount (DestinationFinalBalance - DestinationStartBalance): ${destinationCalculatedDepositAmount.toString()}`)
//     console.log(`BALANCES: Destination native balance change (SHOULD BE 0): ${destinationNativeBalanceChange.toString()}`)
//     console.log(`BALANCES: Destination calculated fee (OriginTransferAmount - DestinationDepositAmount): ${destinationCalculatedDepositFee}`)

//     console.log(`EVENT: Origin transfer fee: ${JSON.stringify(originTransferData, null, 2)}`)
//     console.log(`EVENT: Destination deposit amount: ${depositEventData.depositAmount.toString()} ${depositEventData.assetSymbol}`)
//     console.log(`EVENT: Destination deposit fee: ${depositEventData.feeAmount.toString()} ${depositEventData.assetSymbol}`)

//     updateEventFeeBook(originTransferData, depositEventData, relay)
//     let originChainId = getChainIdFromNode(originTransferData.node)
//     let destinationChainId = getChainIdFromNode(depositEventData.node)

//     let originFeeAsset = getMyAssetBySymbol(originChainId, originTransferData.feeAssetSymbol, relay)
//     let destinationFeeAsset = getMyAssetBySymbol(destinationChainId, depositEventData.assetSymbol, relay)

//     let originFeeAssetKey = getAssetKey(originFeeAsset);
//     let destinationFeeAssetKey = getAssetKey(destinationFeeAsset);
//     // let originFeeAssetId = origiFneeAsset.


//     // let [depositAmount, feeAmount] = await depositPromise

//     // console.log("Deposit Amount: " + depositAmount)
//     // console.log("Fee Amount: " + feeAmount)
    
//     process.exit(0)

    
// }



async function testAssetLocation(){
    let node: TNode = 'HydraDX'
    let chainId = getChainIdFromNode(node)
    let assetSymbol = "GLMR"
    let relay: Relay = "polkadot"

    let assetObject = getMyAssetBySymbol(chainId, assetSymbol, relay)

    console.log(JSON.stringify(assetObject, null, 2))

    let testFilePath = path.join(__dirname, 'testLocationData.json')

    fs.writeFileSync(testFilePath, JSON.stringify(assetObject.tokenLocation, null, 2))

    let locationFromFile = JSON.parse(fs.readFileSync(testFilePath).toString())
    console.log(locationFromFile)

    console.log("Assets at location: ")
    let assetsAtLocation = getAssetsAtLocation(locationFromFile, relay)
    assetsAtLocation.forEach((asset) => {
        console.log(asset.tokenData.symbol + " " + asset.tokenData.chain + " " + asset.tokenData.localId)
    })
    // console.log(JSON.stringify(assetsAtLocation, null, 2))
    // let destinationFeeAsset = getMyAssetBySymbol(destinationChainId, depositEventData.assetSymbol, relay)
}

async function testChopsticks(){
    let chopsticks = true
    let localRpc = localRpcs['Acala']
    let provider = new WsProvider(localRpc)
    let api = await ApiPromise.create({ provider })
    await api.isReady
    // let api = await getApiForNode("Acala", chopsticks)
    // let rpcResponse = await provider.send('dev_setBlockBuildMode', [Chopsticks.BuildBlockMode.Instant]);
    
    let rpcResponse = await provider.send('dev_newBlock', [{count: 1}]);
    console.log("RPC Response: " + JSON.stringify(rpcResponse, null, 2))
}


async function getNativeTokenBalance(relay: Relay, node: TNode, address: string, chopsticks: boolean){
    let api = await getApiForNode(node, chopsticks)
    let chainToken = await api.registry.chainTokens[0]

    let paraId = getParaId(node)
    let balanceAdapter = await getAdapter(relay, paraId)

    await balanceAdapter.init(api)

}
async function setBlockModeInstant(node: TNode){
    let chopsticks = true
    let localRpc = localRpcs[node]
    let provider = new WsProvider(localRpc)
    let api = await ApiPromise.create({ provider })
    await api.isReady
    // let api = await getApiForNode("Acala", chopsticks)
    let rpcResponse = await provider.send('dev_setBlockBuildMode', [Chopsticks.BuildBlockMode.Instant]);
    
    // let rpcResponse = await provider.send('dev_newBlock', [{count: 1}]);
    console.log("RPC Response: " + JSON.stringify(rpcResponse, null, 2))
}
async function setBlockModeManual(node: TNode){
    let chopsticks = true
    let localRpc = localRpcs[node]
    let provider = new WsProvider(localRpc)
    let api = await ApiPromise.create({ provider })
    await api.isReady
    let rpcResponse = await provider.send('dev_setBlockBuildMode', [Chopsticks.BuildBlockMode.Manual]);
    
    // let rpcResponse = await provider.send('dev_newBlock', [{count: 1}]);
    console.log("RPC Response: " + JSON.stringify(rpcResponse, null, 2))
}

async function newBlock(node: TNode){
    let chopsticks = true
    let localRpc = localRpcs[node]
    let provider = new WsProvider(localRpc)
    let api = await ApiPromise.create({ provider })
    await api.isReady
    // let rpcResponse = await provider.send('dev_setBlockBuildMode', [Chopsticks.BuildBlockMode.Manual]);
    
    let rpcResponse = await provider.send('dev_newBlock', [{count: 1}]);
    console.log("RPC Response: " + JSON.stringify(rpcResponse, null, 2))
}


// async function testBncStableSwap(){
//     const wsLocalChain = localRpcs["BifrostPolkadot"]
//     const bncRpc = "wss://hk.p.bifrost-rpc.liebi.com/ws"
//     let chopsticks = true
//     // let api = await getApiForNode("BifrostPolkadot", chopsticks)
//     let signer = await getSigner(chopsticks, false)

//     const response = await axios.get('https://raw.githubusercontent.com/zenlinkpro/token-list/main/tokens/bifrost-polkadot.json');
//     const tokensMeta = response.data.tokens;
//     await cryptoWaitReady();

//     let tokenInSymbol = "VDOT"
//     let tokenOutSymbol = "DOT"

//     // generate Tokens
//     const tokens = tokensMeta.map((item: any) => {
//         return new Token(item);
//     });

//     const tokenIn = tokens.find((item) => item.symbol.toLowerCase() === tokenInSymbol.toLowerCase());
//     const tokenOut = tokens.find((item) => item.symbol.toLowerCase() === tokenOutSymbol.toLowerCase());

//     const tokensMap: Record<string, typeof Token> = {};
//     tokens.reduce((total: any, cur: any) => {
//       total[cur.assetId] = cur;
//       return total;
//     }, tokensMap);
  
//     let rpc = chopsticks ? wsLocalChain : bncRpc
//     // generate the dex api
//     const provider = new WsProvider(rpc);
//     const dexApi = new ModuleBApi(
//       provider,
//       BifrostConfig
//     );
  
  
  
//     await provider.isReady;
//     await dexApi.initApi(); // init the api;

//     const account = signer.address;
//     const standardPairs = await firstValueFrom(dexApi.standardPairOfTokens(tokens));
//     const standardPools: any = await firstValueFrom(dexApi.standardPoolOfPairs(standardPairs));
//     const stablePairs = await firstValueFrom(dexApi.stablePairOf());
//     const stablePools = await firstValueFrom(dexApi.stablePoolOfPairs(stablePairs));

//     let amountIn = 10000000000;

//     let tokenInAmountFN = new FixedPointNumber(amountIn, tokenIn.decimals);
//     const tokenInAmount = new TokenAmount(tokenIn, tokenInAmountFN.toChainData());
//     const tokenOutAmountFn = new FixedPointNumber(expectedAmountOut, tokenOut.decimals);
    
// }
async function testCheckAndAllocate(){
    let chopsticks = true;
    let executeMovr = false;
    let relay: Relay = 'polkadot'

    // await checkAndAllocateRelayToken();
    // let nativeBalances = await getRelayTokenBalanceAcrossChains(chopsticks, relay)
    let nativeBalances = await queryRelayTokenBalances(chopsticks, relay)
    console.log("Native Balances: " + JSON.stringify(nativeBalances, null, 2))
    // let relayBalance = await getBalanceChainAsset(chopsticks, relay, "Polkadot", 0, "DOT")
    // console.log("Relay Balance: " + relayBalance.free.toChainData())
    // console.log("Relay Balance: " + relayBalance.free.toString())
}

async function testGlmrSwap(){
    // await executeSingleGlmrSwap()
    await testGlmrRpc()
}

async function testLogger(){
    let testPath = path.join(__dirname, './tests/testGlmrPath.json')

    let pathNodes: ArbFinderNode[] = JSON.parse(fs.readFileSync(testPath).toString())

    await mainLogger.info("Main Test Logger")
    // mainLogger.info(JSON.stringify(pathNodes, null, 2))

    await apiLogger.info("Api Test Logger")
    await apiLogger.info(JSON.stringify(pathNodes, null, 2))

}

async function testParaspellReworked(){
    let chopsticks = true
    let eth = false

    let relay: Relay = 'polkadot'
    let startNode: TNode = 'HydraDX'
    let destNode: TNode = 'AssetHubPolkadot'
    let transferAmount: bn = new bn(100000000000)

    let startParaId = getChainIdFromNode(startNode)
    let startApi = await getApiForNode(startNode, chopsticks)
    let destApi = await getApiForNode(destNode, chopsticks)
    // let destParaId = getChainIdFromNode(destNode)

    let assetSymbol = 'PINK'
    let startNodeAsset = new MyAsset(getMyAssetBySymbol(startParaId, assetSymbol, relay))
    // let destNodeAsset = await getMyAssetBySymbol(destParaId, assetSymbol, relay)

    let startAssetId = startNodeAsset.tokenData.localId
    // let destAssetId = destNodeAsset.tokenData.localId

    let signer = await getSigner(chopsticks, startNode);

    let startNodeBalance = await getBalanceFromId(startParaId, relay, chopsticks, startApi, startNodeAsset, startNode, signer.address)
    // let destNodeBalance = await getBalanceFromId(destParaId, relay, chopsticks, destApi, destNodeAsset, destNode, signer.address)

    console.log(`Balance for ${assetSymbol} on ${startNode} for ${signer.address}: ${JSON.stringify(startNodeBalance)}`)
    // console.log(`Balance for ${assetSymbol} on ${destNode} for ${signer.address}: ${JSON.stringify(destNodeBalance)}`)


    let xcmTx = paraspell.Builder(startApi).from(startNode).to(destNode).currency(startAssetId).amount(transferAmount.toString()).address(signer.address).build()
    console.log(`Executing xcm tx: ${JSON.stringify(xcmTx.toHuman(), null, 2)}`)

    let xcmTxProperties = xcmTx.toHuman() as any
    const txParams = xcmTxProperties.method
    const section = txParams.section
    const method = txParams.method

    console.log(`TxParams: ${JSON.stringify(txParams)}`)
    console.log(`Section: ${JSON.stringify(section)}`)
    console.log(`Method: ${JSON.stringify(method)}`)

    if(method === 'transferMultiassets'){
        console.log(`TRUE`)
    } else {
        console.log(`FASLE`)
    }
    // console.log(JSON.stringify(xcmTx, null, 2))

    // let result = await xcmTx.signAndSend(signer)
    // console.log(`Tx hash: ${result}`)

    // Basic transfer test
    // const aliceBalance = await startApi.query.system.account(signer.address)
    // console.log(aliceBalance.toHuman())

    // const BOB_ADDRESS = "7Lpe5LRa2Ntx9KGDk77xzoBPYTCAvj7QqaBx4Nz2TFqL3sLw"
    // const transfer = startApi.tx.balances.transferKeepAlive(BOB_ADDRESS, 1000000000000);

    // // Sign and send the transaction
    // const hash = await transfer.signAndSend(signer);

    // console.log('Transfer sent with hash', hash.toHex());
    // let txDetails = await executeXcmTransfer(xcmTx, signer);

    // console.log(`Transfer succes: ${txDetails.success}`)

    startNodeBalance = await getBalanceFromId(startParaId, relay, chopsticks, startApi, startNodeAsset, startNode, signer.address)
    // destNodeBalance = await getBalanceFromId(destParaId, relay, chopsticks, destApi, destNodeAsset, destNode, signer.address)

    console.log(`Balance for ${assetSymbol} on ${startNode} for ${signer.address}: ${JSON.stringify(startNodeBalance)}`)
    // console.log(`Balance for ${assetSymbol} on ${destNode} for ${signer.address}: ${JSON.stringify(destNodeBalance)}`)

}

async function testHydraTx(){

    // const wsProvider = new WsProvider(localHydraRpc);
    // const api: ApiPromise = await ApiPromise.create({ provider: wsProvider });
    const api: ApiPromise = await getApiForNode("HydraDX", true)
    await api.isReady
    await cryptoWaitReady()

    let signer = await getSigner(true,"HydraDX")

    let balance = await api.query.system.account(signer.address)
    console.log(balance.toHuman())

    const BOB_ADDRESS = "7Lpe5LRa2Ntx9KGDk77xzoBPYTCAvj7QqaBx4Nz2TFqL3sLw"
    let transfer = await api.tx.balances.transferKeepAlive(BOB_ADDRESS, 1000000000000);

    let hash = await transfer.signAndSend(signer)
    console.log(hash.toHuman())
}

async function rewriteFeeBook(){
    const oldFeeBookPath = path.join(__dirname, './../../eventFeeBook.json')
    const newFeeBookPath = path.join(__dirname, './../../newEventFeeBook.json')
    const newnewFeeBookPath = path.join(__dirname, './../../newNewEventFeeBook.json')
    // const oldFeeBook: OldFeeBook = JSON.parse(fs.readFileSync(oldFeeBookPath, 'utf8'))
    // console.log(newFeeBookPath)
    // const newFeeBook: FeeBook = JSON.parse(fs.readFileSync(newFeeBookPath, 'utf8'))

    // console.log(JSON.stringify(newFeeBook, null, 2))

    // Read the JSON file
    const rawData = fs.readFileSync(newFeeBookPath, 'utf8');
    const newFeeBook: NewFeeBook = JSON.parse(rawData);

    // Create a new object with the updated structure
    // const newFeeBook: NewFeeBook = {
    //     "polkadot-transfer": {},
    //     "polkadot-deposit": {}
    // };

    const newNewFeeBook: NewFeeBook = {
        "polkadot-transfer": {},
        "polkadot-deposit": {}   
    }

    // Transform polkadot-transfer data
    for (const [chainId, chainData] of Object.entries(newFeeBook["polkadot-transfer"])) {
        newNewFeeBook["polkadot-transfer"][chainId] = {};
        for (const [assetKey, assetData] of Object.entries(chainData)) {
            newNewFeeBook["polkadot-transfer"][chainId][assetKey] = {
                xcmAmount: assetData.xcmAmount,
                xcmDecimals: assetData.xcmDecimals,
                xcmAssetSymbol: assetData.xcmAssetSymbol,
                xcmAssetId: assetData.xcmAssetId,
                feeAmount: assetData.feeAmount,
                feeDecimals: assetData.feeDecimals,
                feeAssetSymbol: assetData.feeAssetSymbol,
                feeAssetId: assetData.feeAssetId,
                node: ""
            };
        }
    }

    // Transform polkadot-deposit data
    for (const [chainId, chainData] of Object.entries(newFeeBook["polkadot-deposit"])) {
        newNewFeeBook["polkadot-deposit"][chainId] = {};
        for (const [assetKey, assetData] of Object.entries(chainData)) {
            newNewFeeBook["polkadot-deposit"][chainId][assetKey] = {
                xcmAmount: assetData.xcmAmount,
                xcmDecimals: assetData.xcmDecimals,
                xcmAssetSymbol: assetData.xcmAssetSymbol,
                xcmAssetId: assetData.xcmAssetId,
                feeAmount: assetData.feeAmount,
                feeDecimals: assetData.feeDecimals,
                feeAssetSymbol: assetData.feeAssetSymbol,
                feeAssetId: assetData.feeAssetId,
                node: ""
            };
        }
    }

    // Write the updated data back to the file
    fs.writeFileSync(newnewFeeBookPath, JSON.stringify(newNewFeeBook, null, 2));
    console.log('FeeBook updated successfully!');
}

// async function buildTest(){
//     let relay: Relay = 'polkadot'
//     let chopsticks: boolean = true
//     let executeMovr: boolean = false
//     // let latestFiles = getLatestAsyncFilesPolkadot()
//     // let latestFile = latestFiles[1][1] // latest file with 1 amount input
//     // console.log(`Latest file: ${latestFile}`)
//     // setLastFile(latestFile, relay)
//     let latestFile = './tests/testXcmPath.json'
//     let arbPathData = JSON.parse(fs.readFileSync(latestFile, 'utf8'))
//     let assetPath: AssetNode[] = arbPathData.map(result => readLogData(result, relay))

//     assetPath.forEach(asset => {
//         console.log(`Chain: ${asset.getChainId()}, Node: ${asset.paraspellChain}, Asset: ${asset.getAssetRegistrySymbol()}, Amount: ${asset.pathValue}`)
//     })
//     console.log("Building instructions")

//     let instructionSet = buildInstructionSetTest(relay, assetPath)
//     printInstructionSet(instructionSet)

//     // await buildPolkadotExtrinsics(relay, instructionSet, false, false, 20)
//     let results = await buildAndExecuteExtrinsics(relay, instructionSet, chopsticks, executeMovr, 20, true)
//     console.log(`Results: ${JSON.stringify(results.success)}`)
// }

async function testBalanceAdapters(){
    let relay: Relay = 'polkadot'
    let paraId = 2030
    let assetSymbol = 'vglmr'
    let assetObject = new MyAsset(getMyAssetBySymbol(paraId, assetSymbol, relay))
    let assetId = assetObject.tokenData.localId

    let chopsticks = true
    let eth = false
    let signer = await getSigner(chopsticks, "BifrostPolkadot");

    let node: TNode = 'BifrostPolkadot'
    let api = await getApiForNode(node, chopsticks)

    let balance = await getBalanceFromId(paraId, relay, chopsticks, api, assetObject, node, signer.address)

    console.log(`Balance for ${assetSymbol} on ${node} for ${signer.address}: ${JSON.stringify(balance)}`)
}

async function callArbFinderTargetSearch(){
    let relay: Relay = 'polkadot';
    let testAsset = new MyAsset(getMyAssetBySymbol(2000, 'DOT', relay))
    let assetKey = testAsset.getAssetKey()
    let functionArgs = `${assetKey} ${assetKey} 1`
    let arbCompleted = await arbRunFallbackSearch(assetKey, assetKey, "1", relay)

    if (arbCompleted) {
        // const targetLogFolder = await path.join(
        //     __dirname,
        //     `${arbFinderPath}/target_log_data/${relay}/`
        // );
        const targetLogFolder = `${arbFinderPath}/target_log_data/${relay}/`
        const latestFile = await findLatestFileInLatestDirectory(
            targetLogFolder
        );

        // Set state latest file
        // stateSetLastFile(latestFile)

        const targetArbResults: ArbFinderNode[] = JSON.parse(
            fs.readFileSync(latestFile, "utf8")
        );
        // return targetArbResults;
        console.log(JSON.stringify(targetArbResults, null, 2))
    } else {
        throw new Error("Failed to run target arb")
    }
}

/** Test asset lookup. Re construct asset registry each lookup */
function testAssetRegistryOne(){
    let assetRegistry: IMyAsset[] = getAssetRegistry('polkadot')
    assetRegistry.forEach((asset) => {
        getAssetByKey(new MyAsset(asset).getAssetKey(), 'polkadot')
    })
}
function getAssetByKey(assetKey: string, relay: Relay){
    // console.log(`Searching for asset key: ${assetKey}`)
    let assets = getAssetRegistry(relay)
    let matchingAsset = assets.find((registryAsset) => {
        let registryKey = new MyAsset(registryAsset).getAssetKey()
        if (registryKey === assetKey){
            return true
        }
    })
    if(matchingAsset === undefined) throw new Error(`Cant find asset with key ${assetKey}`)
}

/** Test asset lookup. Create asset registry once and pass it to each function for lookup */
function testAssetRegistryTwo(){
    let assetRegistry: IMyAsset[] = getAssetRegistry('polkadot')
    assetRegistry.forEach((asset) => {
        getAssetByKeyRegistry(new MyAsset(asset).getAssetKey(), assetRegistry)
    })
}

function getAssetByKeyRegistry(assetKey: string, assetRegistry: IMyAsset[]): IMyAsset{
    // console.log(`Searching for asset key: ${assetKey}`)
    let matchingAsset = assetRegistry.find((registryAsset) => {
        let registryKey = new MyAsset(registryAsset).getAssetKey()
        if (registryKey === assetKey){
            return true
        }
    })
    if(matchingAsset === undefined) throw new Error(`Cant find asset with key ${assetKey}`)
    return matchingAsset
}


/** Create asset map, get list of assets, look each asset up in map */
function testAssetMapOne(){
    let relay: Relay = 'polkadot'
    let assetMap: AssetMap = getAssetRegistryMap(relay)
    
    let assetRegistry: IMyAsset[] = getAssetRegistry(relay)
    assetRegistry.forEach((asset) => {
        getAssetByKeyHashmap(asset, assetMap)
    })

}


function getAssetByKeyHashmap(asset: IMyAsset, assetMap: AssetMap){
    let assetKey = new MyAsset(asset).getAssetKey()
    let assetMatch = assetMap.get(assetKey)
    if(assetMatch === undefined) throw new Error(`Map lookup error: ${new MyAsset(asset).getAssetKey()}`)
    if(new MyAsset(assetMatch).getAssetKey() !== assetKey) throw new Error(`Keys do not match`)

    return assetMatch
}
/** get list of assets, look each asset up in map lookup, creating map each time */
function testAssetMapTwo(){
    let relay: Relay = 'polkadot'
    let assetMap: AssetMap = getAssetRegistryMap(relay)
    
    let assetRegistry: IMyAsset[] = getAssetRegistry(relay)
    assetRegistry.forEach((asset) => {
        getAssetByKey(new MyAsset(asset).getAssetKey(), relay)
    })

}
async function testArbProfit(){
    GlobalState.getInstance('polkadot')

    let results: Readonly<ExtrinsicSetResultDynamic> = stateGetExtrinsicSetResults()!;
    let firstExtrinsic: SingleSwapResultData | SingleTransferResultData = results.allExtrinsicResults[0]
    let lastExtrinsic: SingleSwapResultData | SingleTransferResultData = results.allExtrinsicResults[results.allExtrinsicResults.length - 1]

    let originalInputValue: bn;

    console.log("FIRST")
    if(isSwapResult(firstExtrinsic)){
        console.log("Swap")
        originalInputValue = new bn(firstExtrinsic.swapTxStats.assetInBalanceChange.changeInBalance)

    } else if(isTransferResult(firstExtrinsic)){
        console.log("Trasnfer")
        originalInputValue = new bn(firstExtrinsic.transferTxStats.startBalanceStats.changeInBalance)
    } else {
        throw new Error('')
    }
    console.log(originalInputValue)

    let finalOutputValue: bn

    console.log("LAST")
    if(isSwapResult(lastExtrinsic)){
        console.log("Swap")
        finalOutputValue = new bn(lastExtrinsic.swapTxStats.assetOutBalanceChange.changeInBalance)

    } else if(isTransferResult(lastExtrinsic)){
        console.log("Trasnfer")
        finalOutputValue = new bn(lastExtrinsic.transferTxStats.destBalanceStats.changeInBalance)
    }else {
        throw new Error('')
    }
    console.log(finalOutputValue)

    let totalProfit = finalOutputValue.minus(originalInputValue)
    console.log(`Total profit: ${totalProfit.toString()}`)

    let testAsset = new MyAsset(getMyAssetBySymbol(2000, 'DOT', 'polkadot'))
    let assetLocation = testAsset.getLocation();

    let xcmAssets = getAssetsAtLocation(assetLocation, 'polkadot')
    console.log(`Assets at location: ${JSON.stringify(xcmAssets, null, 2)}`)

    let lastNode = stateGetLastNode()
    let lastNodeAsset = new MyAsset(getMyAssetBySymbol(lastNode?.chainId!, lastNode?.assetSymbol!, 'polkadot'))

    console.log(`Last node: ${lastNodeAsset.getAssetKey()}`)

    let foundAsset = xcmAssets.find((xcmAsset) => {
        return new MyAsset(xcmAsset).getAssetKey() == lastNodeAsset.getAssetKey()
    })

    if (foundAsset !== undefined){
        console.log(`Final node is a target node. Success`)
    } else {
        console.log(`Final node is NOT a target. Fail`)
    }

    console.log(`Final node: ${JSON.stringify(foundAsset)}`)

    let value = totalProfit.div(new bn(10).pow(lastNodeAsset.getDecimals()))

    console.log(`Final formatted: ${value}`)
}
// Utility function to measure execution time
function measureExecutionTime(fn: () => void, iterations: number = 1): number {
    const start = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      fn();
    }
    
    const end = performance.now();
    return end - start;
  }

function testExecutionTimes(){
    let timeOne = measureExecutionTime(() => testAssetMapOne(), 1)
    // let timeTwo = measureExecutionTime(() => testAssetRegistryTwo(), 1)

    console.log(`One (Create registry each time): ${timeOne} | Two (Create registry once): `)
}

function testFee(){
    let fee = getRelayTransferFee('polkadot')
    console.log(`Transfer fee: ${fee}`)
}

async function logChain(relay: Relay){
    if (relay !== 'kusama' && relay !== 'polkadot') throw new Error('Relay not specified')
    GlobalState.initializeAndResetGlobalState(relay)

    let inputAmount = '1.0'
    let chopsticks = true

    let latestFile = 'C:/Users/dazzl/CodingProjects/substrate/xcm-test/src/testScripts/testBncPath.json'
    let arbPathData: ArbFinderNode[] = JSON.parse(fs.readFileSync(latestFile, 'utf8'))
    
    await logChainStates(arbPathData, 'testFile', relay, chopsticks)
}
// async function testNumbers(){
//     await getBlockNumbers(true)
// }


async function testXcmAllocation(){
    const relay: Relay = 'polkadot'
    const chopsticks = true
    const inputAmount = '0.2'
    // if (relay !== 'kusama' && relay !== 'polkadot') throw new Error('Relay not specified')
        GlobalState.initializeAndResetGlobalState(relay)
    
    // Execute new arb-finder, or just parse results from last arb file
    // let arbPathData: ArbFinderNode[] = await findNewTargetArb(relay, inputAmount, chopsticks)

    let latestFile = 'C:/Users/dazzl/CodingProjects/substrate/xcm-test/src/testScripts/testBncPath.json'
    let arbPathData = JSON.parse(fs.readFileSync(latestFile, 'utf8'))
    let assetPath: AssetNode[] = arbPathData.map(result => readLogData(result, relay))
    
    console.log(`Arb finder path nodes:`)
    arbPathData.forEach((node) => console.log(`${node.node_key} ${node.path_value} ${node.path_type}`))

    // Parse path into asset nodes
    // let assetPath: AssetNode[] = constructAssetNodesFromPath(relay, arbPathData)
    // assetPath = await truncateAssetPath(assetPath) // Remove beginning xcm tx's before swap
    // assetPath = await allocateFunds(relay, assetPath, chopsticks, inputAmount) // Add transfer from relay -> start if needed
    stateSetLastNode(assetPath[0].asLastNode())

    assetPath.forEach((assetNode) => {
        console.log(`Asset: ${assetNode.getAssetKey()} | Value: ${assetNode.pathValue} | Type: ${assetNode.pathType}`)
    })

    let instructionsToExecute = buildInstructionSet(relay, assetPath)
    let executionResults = await buildAndExecuteExtrinsics(relay, instructionsToExecute, chopsticks, false, false)

    // await logAllResultsDynamic(chopsticks)
    let arbSuccess = executionResults.success

    if(stateGetLastNode() === null){
        console.log("Last node undefined. ERROR: some extrinsics have executed successfully")
        throw new Error("Last node undefined. ERROR: some extrinsics have executed successfully")
    }
        
}

import { updateAssetRegistryWithMap } from './../../../polkadot_assets/assets/assetHandler.ts';
import { updateLpsWithMap } from './../../../polkadot_assets/lps/all_lps.ts';
import axios from 'axios';
import { Token } from '@zenlink-dex/sdk-core';
import { firstValueFrom } from 'rxjs';
export async function testAssetUpdater(){
    console.log(`TESTING UPDATER`)
    let apiMap = getApiMap()
    let relay: Relay = 'polkadot'
    let chopsticks = true
    await updateAssetsAndLpsReworked(chopsticks, relay)

    console.log(`Finished updating assets. Now api map is:`)
    apiMap.forEach((_, key) => {
        console.log(`Api initialized for ${key}`)
    });
    console.log(`Finished UPDATER TEST`)
}

// async function bifrostApi(){
//     let api = await getApiForNode("BifrostPolkadot", true)

//     let block = await api.query.system.number()
//     console.log(`Block: ${block}`)

//     let dexApi = await getBifrostDexApi('polkadot', true)
//     const response = await axios.get('https://raw.githubusercontent.com/zenlinkpro/token-list/main/tokens/bifrost-polkadot.json');
//     const tokensMeta = response.data.tokens;

//     const zenTokens = tokensMeta.map((item: any) => {
//         return new Token(item);
//     });
//     const standardPairs = await firstValueFrom(dexApi.standardPairOfTokens(zenTokens));

//     console.log(`Standard pairs: ${JSON.stringify(standardPairs, null, 2)}`)


// }

async function main(){

    // await testBalanceAdapters()
    // await testDepositEventListeners()
    // await testFilePaths()
    // await testArbProfit()
    // await testAssetRegistryOne()
    // testExecutionTimes()
    // await callArbFinderTargetSearch()
    // testFee()
    // await testNumbers()
    // await logChain('polkadot')
    // await testAssetUpdater()
    await testAssetUpdater()
    process.exit(0)
}

main()