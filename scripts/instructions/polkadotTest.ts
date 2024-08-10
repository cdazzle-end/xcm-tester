import fs from 'fs'
import { WsProvider, ApiPromise, Keyring, ApiRx } from '@polkadot/api'
import path from 'path';
import { cryptoWaitReady } from "@polkadot/util-crypto"
import { getAssetBySymbolOrId, getParaspellChainName, getAssetRegistryObject, readLogData, getAssetRegistryObjectBySymbol, getSigner, printInstruction, increaseIndex, getLastSuccessfulNodeFromResultData, printExtrinsicSetResults, getLatestFileFromLatestDay, constructRouteFromFile, getLastSuccessfulNodeFromAllExtrinsics, getNodeFromChainId, getTotalArbResultAmount, getLatestTargetFileKusama, getLatestAsyncFilesKusama, getLatestTargetFilePolkadot, getLatestAsyncFilesPolkadot, constructRouteFromJson, printAllocations, printInstructionSet, getChainIdFromNode, getAssetKey, getAssetRegistry, getAssetsAtLocation } from './utils.ts'
import { MyAssetRegistryObject, MyAsset, AssetNodeData, InstructionType, SwapInstruction, TransferInstruction, TransferToHomeThenDestInstruction, TxDetails, TransferToHomeChainInstruction, TransferParams, TransferAwayFromHomeChainInstruction, TransferrableAssetObject, TransferTxStats, BalanceChangeStats, SwapTxStats, SwapExtrinsicContainer, ExtrinsicObject, ChainNonces, TransferExtrinsicContainer, SwapResultObject, ExtrinsicSetResult, IndexObject, ArbExecutionResult, PathNodeValues, LastNode, SingleExtrinsicResultData, SingleTransferResultData, SingleSwapResultData, ExtrinsicSetResultDynamic, ExecutionState, LastFilePath, PreExecutionTransfer, TransactionState, TransferProperties, SwapProperties, AsyncFileData, Relay, JsonPathNode } from './types.ts'
import { AssetNode } from './AssetNode.ts'
import { allocateKsmFromPreTransferPaths, buildInstructionSet, buildInstructions, getPreTransferPath, getTransferrableAssetObject } from './instructionUtils.ts';
import * as paraspell from '@paraspell/sdk';
import { arb_wallet_kusama, dotNodeKeys, dotTargetNode, ksmRpc, ksmTargetNode, kusamaNodeKeys, live_wallet_3, localRpcs, mainWalletAddress, mainWalletEthAddress, testBncNode, testNets, testZlkNode } from './txConsts.ts';
import { buildSwapExtrinsicDynamic, buildTransferExtrinsicDynamic, buildTransferExtrinsicReworked, buildTransferKsmToChain, buildTransferToKsm, createSwapExtrinsicObject, createTransferExtrinsicObject } from './extrinsicUtils.ts';
import { EventRecord } from "@polkadot/types/interfaces"
import { fileURLToPath } from 'url';
// import { BalanceChangeStatue } from 'src/types.ts';
import { logSwapTxStats, logSwapTxResults, logTransferTxStats, logArbExecutionResults, logInstructions, logSubmittableExtrinsics, logAllResultsDynamic, logProfits, logLastFilePath, updateFeeBook, updateEventFeeBook } from './logUtils.ts';
import { runAndReturnFallbackArb, runAndReturnTargetArb, runArbFallback } from './executeArbFallback.ts';
import { Mangata, MangataInstance } from '@mangata-finance/sdk';
import { reverse } from 'dns';
import { buildAndExecuteSwapExtrinsic, checkAndAllocateRelayToken, confirmLastTransactionSuccess, executeAndReturnExtrinsic, executeSingleSwapExtrinsic, executeSingleSwapExtrinsicMovr, executeSingleTransferExtrinsic, executeTransferTx, executeXcmTransfer } from './executionUtils.ts';
// import { liveWallet3Pk } from 'scripts/swaps/movr/utils/const.ts';
import { TNode, getParaId } from '@paraspell/sdk';
import { BN } from '@polkadot/util/bn/bn';
import { FixedPointNumber } from '@acala-network/sdk-core';
import { movrContractAddress, xcKarContractAddress, xcXrtContractAddress } from './../swaps/movr/utils/const.ts';
import { formatMovrTx, getMovrSwapTx, testXcTokensMoonriver } from './../swaps/movr/movrSwap.ts';
// import { getBsxSwapExtrinsic, testBsxSwap } from './../swaps/bsxSwap.ts';
import '@galacticcouncil/api-augment/basilisk';
import { getApiForNode } from './apiUtils.ts';
import { setLastExtrinsicSet, getLastExecutionState, setExecutionSuccess } from './globalStateUtils.ts';
import { getBalanceChainAsset, getBalanceChange, getBalanceFromId, getRelayTokenBalances, watchTokenBalance } from './balanceUtils.ts';
import bn, { BigNumber } from 'bignumber.js'
import { ManagerSwapParams } from './../swaps/glmr/utils/types.ts';
import { executeSingleGlmrSwap, testGlmrRpc } from './../swaps/glmr/glmrSwap.ts';
import { getAdapter } from '@polkawallet/bridge';
import { firstValueFrom, Observable, timeout } from "rxjs";
import { FrameSystemEventRecord } from '@polkadot/types/lookup';
import { listenForXcmpEventHydra, getHydraDepositFees, listenForXcmpEventAcala, getAcalaDepositFees, getMoonbeamDepositFees, listenForXcmpEventMoonbeam, listenForXcmpTransferPolkadot, listenForXcmpEventThree, listenForXcmpEventForNode as listenForDestinationDepositAmounts, getXcmTransferEventData } from './feeUtils.ts';
// const { blake2AsU8a } = require('@polkadot/util-crypto');
// const { u8aToHex } = require('@polkadot/util');
import { blake2AsU8a } from '@polkadot/util-crypto';
import { u8aToHex, stringToU8a, numberToU8a } from '@polkadot/util';
import * as Chopsticks from '@acala-network/chopsticks';
import '@galacticcouncil/api-augment/hydradx';

import {mainLogger, dbLogger, apiLogger} from './logger.ts'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const allConnectionPromises = new Map<string, Promise<ApiPromise>>();
export const allConnections = new Map<string, ApiPromise>();
export let promiseApis: Record<number, ApiPromise> = {};
export let observableApis: Record<number, ApiRx> = {};
export let apiMap: Map<TNode | "Kusama" | "Polkadot", ApiPromise> = new Map<TNode, ApiPromise>();

const aliceAddress = "HNZata7iMYWmk5RvZRTiAsSDhV8366zq2YGb3tLH5Upf74F"

// const mgxRpc = 'wss://kusama-rpc.mangata.online'
const dazzleMgxAddres = '5G22cv9fT5RNVm2AV4MKgagmKH9aoZL4289UDcYrToP9K6hQ'
const aliceErc20 = "0xf24FF3a9CF04c71Dbc94D0b566f7A27B94566cac"

export let globalState: ExecutionState = {
    tracking: true, // Only false for async allocation
    relay: null,
    lastNode: null,
    lastFilePath: null,
    extrinsicSetResults: null,
    transactionState: null,
    transactionProperties: null,
    executionAttempts: 0,
    executionSuccess: true,
    accumulatedFeeData: null,
    xcmFeeReserves: null
}


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


async function testXcm(){
    let chopsticks = true
    let relay: Relay = 'polkadot'

    
    let assetId = "USDT" // USDT
    let amount = "1000000" // 1000 hdx
    
    let fromNode: TNode = 'HydraDX'
    let signer = await getSigner(chopsticks, false)
    
    let toNode: TNode = 'AssetHubPolkadot'
    let destWallet = await getSigner(chopsticks, false)

    let fromApi = await getApiForNode(fromNode, chopsticks)
    let toApi = await getApiForNode(toNode, chopsticks)
    
    let xcmTx = paraspell.Builder(fromApi).from(fromNode).to(toNode).currency(assetId).amount(amount).address(destWallet.address).build()
    // let xcmTx = paraspell.Builder(fromApi).to(toNode).amount(amount).address(destWallet.address).build()
    console.log(JSON.stringify(xcmTx.toHuman()))

    let txResult: Promise<TxDetails> = executeXcmTransfer(xcmTx, signer); 
    console.log("Execute Transfer: tx promise created. Waiting for result...")
    let txResultData = await txResult

    // let xcmEventPromise = listenForDestinationDepositAmounts(toApi, toNode, "hrmp", destWallet.address, txResultData.xcmMessageHash);

    // console.log("Wait for xcmp event")
    // let eventData  = await xcmEventPromise as any
    // console.log("XCM Event Data: " + JSON.stringify(eventData, null, 2))
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

//     let originFeeAsset = getAssetRegistryObjectBySymbol(originChainId, originTransferData.feeAssetSymbol, relay)
//     let destinationFeeAsset = getAssetRegistryObjectBySymbol(destinationChainId, depositEventData.assetSymbol, relay)

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

    let assetObject = getAssetRegistryObjectBySymbol(chainId, assetSymbol, relay)

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
    // let destinationFeeAsset = getAssetRegistryObjectBySymbol(destinationChainId, depositEventData.assetSymbol, relay)
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
    

    let balanceObservable = balanceAdapter.subscribeTokenBalance(chainToken, address)
    let balance = await firstValueFrom(balanceObservable)

    return balance.free
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

async function testBifrostWallet(){
    let chopsticks = true
    let api = await getApiForNode("BifrostPolkadot", chopsticks)
    let signer = await getSigner(chopsticks, false)

    console.log("Signer address: " + signer.address)

    let ss58Format = await api.consts.system.ss58Prefix;
    console.log("SS58 Format: " + ss58Format.toNumber())
    let keyring = new Keyring({
        ss58Format: 0,
        type: 'sr25519'
    })

    let destAddress = keyring.encodeAddress(signer.address, ss58Format.toNumber())

    console.log("Dest Address: " + destAddress)


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
    let nativeBalances = await getRelayTokenBalances(chopsticks, relay)
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

    let pathNodes: JsonPathNode[] = JSON.parse(fs.readFileSync(testPath).toString())

    await mainLogger.info("Main Test Logger")
    // mainLogger.info(JSON.stringify(pathNodes, null, 2))

    await apiLogger.info("Api Test Logger")
    await apiLogger.info(JSON.stringify(pathNodes, null, 2))

}

async function testBalanceAdapters(){
    let relay: Relay = 'polkadot'
    let paraId = 2034
    let assetSymbol = 'PINK'
    let assetObject = await getAssetRegistryObjectBySymbol(paraId, assetSymbol, relay)
    let assetId = assetObject.tokenData.localId

    let chopsticks = true
    let eth = false
    let signer = await getSigner(chopsticks, eth);

    let node: TNode = 'HydraDX'
    let api = await getApiForNode(node, chopsticks)

    let balance = await getBalanceFromId(paraId, relay, chopsticks, api, assetObject, node, signer.address)

    console.log(`Balance for ${assetSymbol} on ${node} for ${signer.address}: ${JSON.stringify(balance)}`)
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
    // let startNodeAsset = await getAssetRegistryObjectBySymbol(startParaId, assetSymbol, relay)
    // let destNodeAsset = await getAssetRegistryObjectBySymbol(destParaId, assetSymbol, relay)

    // let startAssetId = startNodeAsset.tokenData.localId
    // let destAssetId = destNodeAsset.tokenData.localId

    let signer = await getSigner(chopsticks, eth);

    // let startNodeBalance = await getBalanceFromId(startParaId, relay, chopsticks, startApi, startNodeAsset, startNode, signer.address)
    // let destNodeBalance = await getBalanceFromId(destParaId, relay, chopsticks, destApi, destNodeAsset, destNode, signer.address)

    // console.log(`Balance for ${assetSymbol} on ${startNode} for ${signer.address}: ${JSON.stringify(startNodeBalance)}`)
    // console.log(`Balance for ${assetSymbol} on ${destNode} for ${signer.address}: ${JSON.stringify(destNodeBalance)}`)


    // let xcmTx = paraspell.Builder(startApi).from(startNode).to(destNode).currency(startAssetId).amount(transferAmount.toString()).address(signer.address).build()
    // console.log(`Executing xcm tx: ${JSON.stringify(xcmTx.toHuman(), null, 2)}`)

    // console.log(JSON.stringify(xcmTx, null, 2))

    // let result = await xcmTx.signAndSend(signer)
    // console.log(`Tx hash: ${result}`)

    // Basic transfer test
    const aliceBalance = await startApi.query.system.account(signer.address)
    console.log(aliceBalance.toHuman())

    const BOB_ADDRESS = "7Lpe5LRa2Ntx9KGDk77xzoBPYTCAvj7QqaBx4Nz2TFqL3sLw"
    const transfer = startApi.tx.balances.transferKeepAlive(BOB_ADDRESS, 1000000000000);

    // Sign and send the transaction
    const hash = await transfer.signAndSend(signer);

    console.log('Transfer sent with hash', hash.toHex());
    // let txDetails = await executeXcmTransfer(xcmTx, signer);

    // console.log(`Transfer succes: ${txDetails.success}`)

    // startNodeBalance = await getBalanceFromId(startParaId, relay, chopsticks, startApi, startNodeAsset, startNode, signer.address)
    // destNodeBalance = await getBalanceFromId(destParaId, relay, chopsticks, destApi, destNodeAsset, destNode, signer.address)

    // console.log(`Balance for ${assetSymbol} on ${startNode} for ${signer.address}: ${JSON.stringify(startNodeBalance)}`)
    // console.log(`Balance for ${assetSymbol} on ${destNode} for ${signer.address}: ${JSON.stringify(destNodeBalance)}`)

}

async function main(){
    // let wallet = await getSigner(false, false)
    // let ethWallet = await getSigner(false, true)

    // await testXcm()
    // await setBlockModeManual('HydraDX')
    // await setBlockModeInstant('HydraDX')
    // await testMoonXcm()
    // await testAssetLocation()
    // await testBifrostWallet()
    // await testGlmrSwap()
    // await testCheckAndAllocate();
    // await testCheckAndAllocate();
    // await testCheckAndAllocate();
    // await testLogger()
    // await testBalanceAdapters()
    await testParaspellReworked()
    // await newBlock('HydraDX')
    // await testChopsticks()
    process.exit(0)
}

main()