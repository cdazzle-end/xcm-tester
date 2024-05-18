import fs from 'fs'
import { WsProvider, ApiPromise, Keyring, ApiRx } from '@polkadot/api'
import path from 'path';
import { cryptoWaitReady } from "@polkadot/util-crypto"
import { getAssetBySymbolOrId, getParaspellChainName, getAssetRegistryObject, readLogData, getAssetRegistryObjectBySymbol, watchTokenDeposit, getBalanceChange, getSigner, watchTokenBalance, printInstruction, increaseIndex, getLastSuccessfulNodeFromResultData, printExtrinsicSetResults, getLatestFileFromLatestDay, constructRouteFromFile, getLastSuccessfulNodeFromAllExtrinsics, getBalance, setLastFile, getLastExecutionState, getNativeBalanceAcrossChains, getNodeFromChainId, getTotalArbResultAmount, getLatestTargetFileKusama, setLastExtrinsicSet, setLastNode, getLatestAsyncFilesKusama, setExecutionSuccess, resetExecutionState, getLatestTargetFilePolkadot, setExecutionRelay, getLatestAsyncFilesPolkadot, constructRouteFromJson, getBalanceChainAsset, printAllocations, printInstructionSet } from './utils.ts'
import { ResultDataObject, MyAssetRegistryObject, MyAsset, AssetNodeData, InstructionType, SwapInstruction, TransferInstruction, TransferToHomeThenDestInstruction, TxDetails, TransferToHomeChainInstruction, TransferParams, TransferAwayFromHomeChainInstruction, TransferrableAssetObject, TransferTxStats, BalanceChangeStats, SwapTxStats, SwapExtrinsicContainer, ExtrinsicObject, ChainNonces, TransferExtrinsicContainer, ReverseSwapExtrinsicParams, SwapResultObject, ExtrinsicSetResult, IndexObject, ArbExecutionResult, PathNodeValues, LastNode, SingleExtrinsicResultData, SingleTransferResultData, SingleSwapResultData, ExtrinsicSetResultDynamic, ExecutionState, LastFilePath, PreExecutionTransfer, TransactionState, TransferProperties, SwapProperties, AsyncFileData, Relay, JsonPathNode } from './types.ts'
import { AssetNode } from './AssetNode.ts'
import { allocateKsmFromPreTransferPaths, buildInstructionSet, buildInstructions, collectRelayToken, getPreTransferPath, getTransferrableAssetObject } from './instructionUtils.ts';
import * as paraspell from '@paraspell/sdk';
import { arb_wallet_kusama, dotNodeKeys, dotTargetNode, ksmRpc, ksmTargetNode, kusamaNodeKeys, live_wallet_3, localRpcs, mainWalletAddress, mainWalletEthAddress, testBncNode, testNets, testZlkNode } from './txConsts.ts';
import { buildSwapExtrinsicDynamic, buildTransferExtrinsicDynamic, buildTransferExtrinsicReworked, buildTransferKsmToChain, buildTransferToKsm, createSwapExtrinsicObject, createTransferExtrinsicObject } from './extrinsicUtils.ts';
import { EventRecord } from "@polkadot/types/interfaces"
import { fileURLToPath } from 'url';
// import { BalanceChangeStatue } from 'src/types.ts';
import { logSwapTxStats, logSwapTxResults, logTransferTxStats, logArbExecutionResults, logInstructions, logSubmittableExtrinsics, logResultsDynamic, logAllArbAttempts, logAllResultsDynamic, logProfits, logLastFilePath } from './logUtils.ts';
import { runAndReturnFallbackArb, runAndReturnTargetArb, runArbFallback } from './executeArbFallback.ts';
import { Mangata, MangataInstance } from '@mangata-finance/sdk';
import { reverse } from 'dns';
import { buildAndExecuteSwapExtrinsic, confirmLastTransactionSuccess, executeAndReturnExtrinsic, executeSingleSwapExtrinsic, executeSingleSwapExtrinsicMovr, executeSingleTransferExtrinsic, executeTransferTx } from './executionUtils.ts';
// import { liveWallet3Pk } from 'scripts/swaps/movr/utils/const.ts';
import { TNode } from '@paraspell/sdk';
import { BN } from '@polkadot/util/bn/bn';
import { FixedPointNumber } from '@acala-network/sdk-core';
import { movrContractAddress, xcKarContractAddress, xcXrtContractAddress } from './../swaps/movr/utils/const.ts';
import { formatMovrTx, getMovrSwapTx, testXcTokensMoonriver } from './../swaps/movr/movrSwap.ts';
// import { getBsxSwapExtrinsic, testBsxSwap } from './../swaps/bsxSwap.ts';
import '@galacticcouncil/api-augment/basilisk';
import { getApiForNode } from './apiUtils.ts';

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
    executionSuccess: true
}


async function buildTest(){
    let relay: Relay = 'polkadot'
    // let latestFiles = getLatestAsyncFilesPolkadot()
    // let latestFile = latestFiles[1][1] // latest file with 1 amount input
    // console.log(`Latest file: ${latestFile}`)
    // setLastFile(latestFile, relay)
    let latestFile = './testAcaPath.json'
    let arbPathData = JSON.parse(fs.readFileSync(latestFile, 'utf8'))
    let assetPath: AssetNode[] = arbPathData.map(result => readLogData(result, relay))

    assetPath.forEach(asset => {
        console.log(`Chain: ${asset.getChainId()}, Node: ${asset.paraspellChain}, Asset: ${asset.getAssetRegistrySymbol()}, Amount: ${asset.pathValue}`)
    })

    let instructionSet = await buildInstructionSet(relay, assetPath)
    await printInstructionSet(instructionSet)

    // await buildPolkadotExtrinsics(relay, instructionSet, false, false, 20)
    await buildAndExecuteExtrinsics(relay, instructionSet, true, false, 20)
}

// Use instructions to build and execute tx's one by one. Main execution flow happens here
async function buildPolkadotExtrinsics(relay: Relay, instructionSet: (SwapInstruction | TransferInstruction)[], chopsticks: boolean, executeMovr: boolean, testLoops: number): Promise<ExtrinsicSetResultDynamic> {
    let swapInstructions: SwapInstruction[] = [];
    let extrinsicIndex: IndexObject = {i: 0}
    let allExtrinsicResultData: (SingleSwapResultData | SingleTransferResultData) [] = [];

    let nodeEndKeys = relay === 'kusama' ? kusamaNodeKeys : dotNodeKeys

    if(globalState.extrinsicSetResults != null){
        console.log("********************************************************")
        console.log("Using global state extrinsic set results")
        allExtrinsicResultData = globalState.extrinsicSetResults.extrinsicData
    } else {
        console.log("********************************************************")
        console.log("Extrinsic set is null")
    }
    let chainNonces: ChainNonces = relay === 'kusama' ? 
    {
        2000: 0,
        2023: 0,
        2001: 0,
        2090: 0,
        2110: 0,
        2085: 0
    } : {
        2000: 0,
        2023: 0,
        2001: 0,
        2090: 0,
        2110: 0,
        2085: 0
    }
    let nextInputValue: number = 0;
    let testLoopIndex = 0;
    // let lastNode: LastNode;
    console.log("Instruction set length: ", instructionSet.length)
    try{
        for (const instruction of instructionSet) {
            // console.log("Instruction: ", instruction)
            // If last successful node is a KSM node, we can finish
            if(globalState.lastNode != null && nodeEndKeys.includes(globalState.lastNode.assetKey)){
                let extrinsicSetResults: ExtrinsicSetResultDynamic = {
                    success: true,
                    extrinsicData: allExtrinsicResultData,
                    lastSuccessfulNode: globalState.lastNode,
                }
                return extrinsicSetResults
            }
            if(testLoopIndex > testLoops){
                console.log("Breaking out of loop")
                break;
            }
            testLoopIndex += 1;
            switch (instruction.type) {
                case InstructionType.Swap:
                    //If MOVR, SKIP and set next to 0
                    // if(chopsticks == true && instruction.assetNodes[0].getChainId() == 2023){
                    //     nextInputValue = 0
                    //     break;
                    // }
                    // If swap is of the same type, accumulate
                    if(swapInstructions.length == 0 || swapInstructions[swapInstructions.length - 1].pathType == instruction.pathType){
                        swapInstructions.push(instruction);

                    // If swap is of a different type, build extrinsic for the so far accumulated swap instructions
                    } else {
                        let instructionsToExecute = swapInstructions

                        while(instructionsToExecute.length > 0){
                            if(nextInputValue > 0){
                                instructionsToExecute[0].assetNodes[0].pathValue = nextInputValue
                            }

                            console.log("Building swap extrinsic: ")

                            let [swapExtrinsicContainer, remainingInstructions] = await buildSwapExtrinsicDynamic(relay, instructionsToExecute, chainNonces, extrinsicIndex, chopsticks);
                            let extrinsicObj: ExtrinsicObject = await createSwapExtrinsicObject(swapExtrinsicContainer)

                            console.log(JSON.stringify(swapExtrinsicContainer.extrinsic))
                            instructionsToExecute = remainingInstructions
                            // let extrinsicResultData = await executeAndReturnExtrinsic(extrinsicObj, extrinsicIndex, chopsticks, executeMovr)
                            // if(extrinsicResultData.success == false){
                            //     console.log("Extrinsic failed")
                            //     console.log(extrinsicResultData.arbExecutionResult)
                                
                                
                            //     allExtrinsicResultData.push(extrinsicResultData)
                            //     printExtrinsicSetResults(allExtrinsicResultData)
                            //     // let lastSuccessfulNode = await getLastSuccessfulNodeFromResultData(allExtrinsicResultData)
                            //     let extrinsicSetResults: ExtrinsicSetResultDynamic = {
                            //         success: false,
                            //         extrinsicData: allExtrinsicResultData,
                            //         lastSuccessfulNode: globalState.lastNode,
                            //     }
                            //     setLastExtrinsicSet(extrinsicSetResults)
                            //     return extrinsicSetResults
                            // }

                            // // MOVR swaps return undefined in test, not error just skip
                            // if(!extrinsicResultData){
                            //     nextInputValue = 0
                            //     break;
                            // }
                            // allExtrinsicResultData.push(extrinsicResultData)
                            // let extrinsicSetResults: ExtrinsicSetResultDynamic = {
                            //     success: true,
                            //     extrinsicData: allExtrinsicResultData,
                            //     lastSuccessfulNode: globalState.lastNode,
                            // }
                            // setLastExtrinsicSet(extrinsicSetResults)
                            // nextInputValue = Number.parseFloat(extrinsicResultData.lastNode.assetValue)
                            // instructionsToExecute = remainingInstructions


                        }
                        swapInstructions = [instruction];
                    }
                    break;
                default:
                    // For other types of instructions
                    // First execute any queued up swap instructions
                    if (swapInstructions.length > 0) {
                        let instructionsToExecute = swapInstructions
                        while(instructionsToExecute.length > 0){
                            if( nextInputValue > 0){
                                instructionsToExecute[0].assetNodes[0].pathValue = nextInputValue
                            }
                            console.log("Building swap extrinsic: ")
                            let [swapExtrinsicContainer, remainingInstructions] = await buildSwapExtrinsicDynamic(relay, instructionsToExecute, chainNonces, extrinsicIndex, chopsticks);

                            console.log(JSON.stringify(swapExtrinsicContainer.extrinsic))
                            instructionsToExecute = remainingInstructions
                            // let extrinsicObj: ExtrinsicObject = {
                            //     type: "Swap",
                            //     instructionIndex: swapExtrinsicContainer.instructionIndex,
                            //     extrinsicIndex: swapExtrinsicContainer.extrinsicIndex,
                            //     swapExtrinsicContainer: swapExtrinsicContainer
                            // }
                            // let extrinsicResultData = await executeAndReturnExtrinsic(extrinsicObj, extrinsicIndex, chopsticks, executeMovr)
                            // // If undefined, not error just skip
                            // if(!extrinsicResultData){
                            //     nextInputValue = 0
                            //     break;
                            // }
                            // if(extrinsicResultData.success == false){
                            //     console.log("Extrinsic failed")
                            //     console.log(extrinsicResultData.arbExecutionResult)
                            //     allExtrinsicResultData.push(extrinsicResultData)
                            //     printExtrinsicSetResults(allExtrinsicResultData)
                            //     // let lastSuccessfulNode = await getLastSuccessfulNodeFromResultData(allExtrinsicResultData)
                            //     let extrinsicSetResults: ExtrinsicSetResultDynamic = {
                            //         success: false,
                            //         extrinsicData: allExtrinsicResultData,
                            //         lastSuccessfulNode: globalState.lastNode,
                            //     }
                            //     setLastExtrinsicSet(extrinsicSetResults)
                            //     return extrinsicSetResults
                            // }
                            // allExtrinsicResultData.push(extrinsicResultData)
                            // let extrinsicSetResults: ExtrinsicSetResultDynamic = {
                            //     success: true,
                            //     extrinsicData: allExtrinsicResultData,
                            //     lastSuccessfulNode: globalState.lastNode,
                            // }
                            // setLastExtrinsicSet(extrinsicSetResults)
                            // nextInputValue = Number.parseFloat(extrinsicResultData.lastNode.assetValue)
                            // instructionsToExecute = remainingInstructions
                        }
                        swapInstructions = [];   
                    }
                    // Then execute transfer instructions
                    let instructionsToExecute = [instruction]
                    while(instructionsToExecute.length > 0){
                        if(nextInputValue > 0){
                            instructionsToExecute[0].assetNodes[0].pathValue = nextInputValue
                        }
                        console.log("Building transfer extrinsic: ")
                        let [transferExtrinsic, remainingInstructions] = await buildTransferExtrinsicDynamic(relay, instructionsToExecute[0], extrinsicIndex, chopsticks);
                        instructionsToExecute = remainingInstructions
                        console.log(JSON.stringify(transferExtrinsic.extrinsic))
                        // let extrinsicObj: ExtrinsicObject = {
                        //     type: "Transfer",
                        //     instructionIndex: transferExtrinsic.instructionIndex,
                        //     extrinsicIndex: transferExtrinsic.extrinsicIndex,
                        //     transferExtrinsicContainer: transferExtrinsic
                        // }
    
                        // let transferExtrinsicResultData = await executeAndReturnExtrinsic(extrinsicObj, extrinsicIndex, chopsticks, executeMovr)
                        // // If undefined and running test, either start or dest chain not running in chopsticks. not error just skip
                        // if(chopsticks && !transferExtrinsicResultData){
                        //     nextInputValue = 0
                        //     break;
                        // }
                        // if(transferExtrinsicResultData.success == false){
                        //     console.log("Extrinsic failed")
                        //     console.log(transferExtrinsicResultData.arbExecutionResult)
                        //     allExtrinsicResultData.push(transferExtrinsicResultData)
                        //     printExtrinsicSetResults(allExtrinsicResultData)
                        //     // let lastSuccessfulNode = await getLastSuccessfulNodeFromResultData(allExtrinsicResultData)
                        //     let extrinsicSetResults: ExtrinsicSetResultDynamic = {
                        //         success: false,
                        //         extrinsicData: allExtrinsicResultData,
                        //         lastSuccessfulNode: globalState.lastNode,
                        //     }
                        //     setLastExtrinsicSet(extrinsicSetResults)
                        //     return extrinsicSetResults
                        // }
                        
                        // nextInputValue = Number.parseFloat(transferExtrinsicResultData.lastNode.assetValue)
                        // allExtrinsicResultData.push(transferExtrinsicResultData)
                        // instructionsToExecute = remainingInstructions
                        // let extrinsicSetResults: ExtrinsicSetResultDynamic = {
                        //     success: true,
                        //     extrinsicData: allExtrinsicResultData,
                        //     lastSuccessfulNode: globalState.lastNode,
                        // }
                        // setLastExtrinsicSet(extrinsicSetResults)
                    }
                    break;

            }
        }
        // Handle any remaining swap instructions at the end of the instruction set
        // let instructionsToExecute = swapInstructions
        // while(instructionsToExecute.length > 0 && testLoopIndex < testLoops){
        //     let [extrinsicResultData, remainingInstructions] = await buildAndExecuteSwapExtrinsic(relay, instructionsToExecute, chopsticks, executeMovr, nextInputValue, chainNonces, extrinsicIndex)
        //     if(extrinsicResultData.success == false){
        //         console.log("Extrinsic failed")
        //         console.log(extrinsicResultData.arbExecutionResult)
        //         allExtrinsicResultData.push(extrinsicResultData)
        //         printExtrinsicSetResults(allExtrinsicResultData)
        //         // let lastSuccessfulNode = await getLastSuccessfulNodeFromResultData(allExtrinsicResultData)
        //         let extrinsicSetResults: ExtrinsicSetResultDynamic = {
        //             success: false,
        //             extrinsicData: allExtrinsicResultData,
        //             lastSuccessfulNode: globalState.lastNode,
        //         }
        //         setLastExtrinsicSet(extrinsicSetResults)
        //         return extrinsicSetResults
        //     }
        //     // If undefined, not error just skip
        //     if(!extrinsicResultData){
        //         nextInputValue = 0
        //         break;
        //     }
        //     allExtrinsicResultData.push(extrinsicResultData)
        //     let extrinsicSetResults: ExtrinsicSetResultDynamic = {
        //         success: true,
        //         extrinsicData: allExtrinsicResultData,
        //         lastSuccessfulNode: globalState.lastNode,
        //     }
        //     setLastExtrinsicSet(extrinsicSetResults)
        //     nextInputValue = Number.parseFloat(extrinsicResultData.lastNode.assetValue)
        //     instructionsToExecute = remainingInstructions
        // }
        swapInstructions = [];   
    } catch(e){
        // Need to properly handle this. Error should be extrinsicResultData
        // console.log(e)
        // printExtrinsicSetResults(allExtrinsicResultData)
        // // let lastSuccessfulNode = await getLastSuccessfulNodeFromResultData(allExtrinsicResultData)
        // let extrinsicSetResults: ExtrinsicSetResultDynamic = {
        //     success: false,
        //     extrinsicData: allExtrinsicResultData,
        //     lastSuccessfulNode: globalState.lastNode,
        // }
        // setLastExtrinsicSet(extrinsicSetResults)
        // return extrinsicSetResults

    }
    // let lastSuccessfulNode = await getLastSuccessfulNodeFromResultData(allExtrinsicResultData)
    // let extrinsicSetResults: ExtrinsicSetResultDynamic = {
    //     success: true,
    //     extrinsicData: allExtrinsicResultData,
    //     lastSuccessfulNode: globalState.lastNode,
    // }
    // setLastExtrinsicSet(extrinsicSetResults)
    // return extrinsicSetResults;
}

// Use instructions to build and execute tx's one by one. Main execution flow happens here
async function buildAndExecuteExtrinsics(relay: Relay, instructionSet: (SwapInstruction | TransferInstruction)[], chopsticks: boolean, executeMovr: boolean, testLoops: number): Promise<ExtrinsicSetResultDynamic> {
    let swapInstructions: SwapInstruction[] = [];
    let extrinsicIndex: IndexObject = {i: 0}
    let allExtrinsicResultData: (SingleSwapResultData | SingleTransferResultData) [] = [];

    let nodeEndKeys = relay === 'kusama' ? kusamaNodeKeys : dotNodeKeys

    if(globalState.extrinsicSetResults != null){
        console.log("********************************************************")
        console.log("Using global state extrinsic set results")
        allExtrinsicResultData = globalState.extrinsicSetResults.extrinsicData
    } else {
        console.log("********************************************************")
        console.log("Extrinsic set is null")
    }
    let chainNonces: ChainNonces = relay === 'kusama' ? 
    {
        2000: 0,
        2023: 0,
        2001: 0,
        2090: 0,
        2110: 0,
        2085: 0
    } : {
        2000: 0,
        2023: 0,
        2001: 0,
        2090: 0,
        2110: 0,
        2085: 0
    }
    let nextInputValue: number = 0;
    let testLoopIndex = 0;
    // let lastNode: LastNode;
    try{
        for (const instruction of instructionSet) {

            // If last successful node is a KSM node, we can finish
            if(globalState.lastNode != null && nodeEndKeys.includes(globalState.lastNode.assetKey)){
                let extrinsicSetResults: ExtrinsicSetResultDynamic = {
                    success: true,
                    extrinsicData: allExtrinsicResultData,
                    lastSuccessfulNode: globalState.lastNode,
                }
                return extrinsicSetResults
            }
            if(testLoopIndex > testLoops){
                break;
            }
            testLoopIndex += 1;
            switch (instruction.type) {
                case InstructionType.Swap:
                    //If EVM, SKIP and set next to 0
                    if(
                        chopsticks == true && relay == 'kusama' && instruction.assetNodes[0].getChainId() == 2023 ||
                        chopsticks == true && relay == 'polkadot' && instruction.assetNodes[0].getChainId() == 2004
                    ){
                        nextInputValue = 0
                        break;
                    }
                    // If swap is of the same type, accumulate
                    if(swapInstructions.length == 0 || swapInstructions[swapInstructions.length - 1].pathType == instruction.pathType){
                        swapInstructions.push(instruction);

                    // If swap is of a different type, build extrinsic for the so far accumulated swap instructions
                    } else {
                        let instructionsToExecute = swapInstructions

                        while(instructionsToExecute.length > 0){
                            if(nextInputValue > 0){
                                instructionsToExecute[0].assetNodes[0].pathValue = nextInputValue
                            }
                            let [swapExtrinsicContainer, remainingInstructions] = await buildSwapExtrinsicDynamic(relay, instructionsToExecute, chainNonces, extrinsicIndex, chopsticks);
                            let extrinsicObj: ExtrinsicObject = await createSwapExtrinsicObject(swapExtrinsicContainer)
                            
                            let extrinsicResultData = await executeAndReturnExtrinsic(extrinsicObj, extrinsicIndex, chopsticks, executeMovr)
                            // MOVR swaps return undefined in test, not error just skip
                            if(!extrinsicResultData){
                                nextInputValue = 0
                                break;
                            }
                            
                            if(extrinsicResultData.success == false){
                                console.log("Extrinsic failed")
                                console.log(extrinsicResultData.arbExecutionResult)
                                
                                
                                allExtrinsicResultData.push(extrinsicResultData)
                                printExtrinsicSetResults(allExtrinsicResultData)
                                // let lastSuccessfulNode = await getLastSuccessfulNodeFromResultData(allExtrinsicResultData)
                                let extrinsicSetResults: ExtrinsicSetResultDynamic = {
                                    success: false,
                                    extrinsicData: allExtrinsicResultData,
                                    lastSuccessfulNode: globalState.lastNode,
                                }
                                setLastExtrinsicSet(extrinsicSetResults, relay)
                                return extrinsicSetResults
                            }

                            
                            allExtrinsicResultData.push(extrinsicResultData)
                            let extrinsicSetResults: ExtrinsicSetResultDynamic = {
                                success: true,
                                extrinsicData: allExtrinsicResultData,
                                lastSuccessfulNode: globalState.lastNode,
                            }
                            setLastExtrinsicSet(extrinsicSetResults, relay)
                            nextInputValue = Number.parseFloat(extrinsicResultData.lastNode.assetValue)
                            instructionsToExecute = remainingInstructions

                        }
                        swapInstructions = [instruction];
                    }
                    break;
                default:
                    // For other types of instructions
                    // First execute any queued up swap instructions
                    if (swapInstructions.length > 0) {
                        let instructionsToExecute = swapInstructions
                        while(instructionsToExecute.length > 0){
                            if( nextInputValue > 0){
                                instructionsToExecute[0].assetNodes[0].pathValue = nextInputValue
                            }
                            let [swapExtrinsicContainer, remainingInstructions] = await buildSwapExtrinsicDynamic(relay, instructionsToExecute, chainNonces, extrinsicIndex, chopsticks);
                            let extrinsicObj: ExtrinsicObject = {
                                type: "Swap",
                                instructionIndex: swapExtrinsicContainer.instructionIndex,
                                extrinsicIndex: swapExtrinsicContainer.extrinsicIndex,
                                swapExtrinsicContainer: swapExtrinsicContainer
                            }
                            let extrinsicResultData = await executeAndReturnExtrinsic(extrinsicObj, extrinsicIndex, chopsticks, executeMovr)
                            // If undefined, not error just skip
                            if(!extrinsicResultData){
                                nextInputValue = 0
                                break;
                            }
                            if(extrinsicResultData.success == false){
                                console.log("Extrinsic failed")
                                console.log(extrinsicResultData.arbExecutionResult)
                                allExtrinsicResultData.push(extrinsicResultData)
                                printExtrinsicSetResults(allExtrinsicResultData)
                                // let lastSuccessfulNode = await getLastSuccessfulNodeFromResultData(allExtrinsicResultData)
                                let extrinsicSetResults: ExtrinsicSetResultDynamic = {
                                    success: false,
                                    extrinsicData: allExtrinsicResultData,
                                    lastSuccessfulNode: globalState.lastNode,
                                }
                                setLastExtrinsicSet(extrinsicSetResults, relay)
                                return extrinsicSetResults
                            }
                            allExtrinsicResultData.push(extrinsicResultData)
                            let extrinsicSetResults: ExtrinsicSetResultDynamic = {
                                success: true,
                                extrinsicData: allExtrinsicResultData,
                                lastSuccessfulNode: globalState.lastNode,
                            }
                            setLastExtrinsicSet(extrinsicSetResults, relay)
                            nextInputValue = Number.parseFloat(extrinsicResultData.lastNode.assetValue)
                            instructionsToExecute = remainingInstructions
                        }
                        swapInstructions = [];   
                    }
                    // Then execute transfer instructions
                    let instructionsToExecute = [instruction]
                    while(instructionsToExecute.length > 0){
                        if(nextInputValue > 0){
                            instructionsToExecute[0].assetNodes[0].pathValue = nextInputValue
                        }
                        let [transferExtrinsic, remainingInstructions] = await buildTransferExtrinsicDynamic(relay, instructionsToExecute[0], extrinsicIndex, chopsticks);
                        let extrinsicObj: ExtrinsicObject = {
                            type: "Transfer",
                            instructionIndex: transferExtrinsic.instructionIndex,
                            extrinsicIndex: transferExtrinsic.extrinsicIndex,
                            transferExtrinsicContainer: transferExtrinsic
                        }
    
                        let transferExtrinsicResultData = await executeAndReturnExtrinsic(extrinsicObj, extrinsicIndex, chopsticks, executeMovr)
                        // If undefined and running test, either start or dest chain not running in chopsticks. not error just skip
                        if(chopsticks && !transferExtrinsicResultData){
                            nextInputValue = 0
                            break;
                        }
                        if(transferExtrinsicResultData.success == false){
                            console.log("Extrinsic failed")
                            console.log(transferExtrinsicResultData.arbExecutionResult)
                            allExtrinsicResultData.push(transferExtrinsicResultData)
                            printExtrinsicSetResults(allExtrinsicResultData)
                            // let lastSuccessfulNode = await getLastSuccessfulNodeFromResultData(allExtrinsicResultData)
                            let extrinsicSetResults: ExtrinsicSetResultDynamic = {
                                success: false,
                                extrinsicData: allExtrinsicResultData,
                                lastSuccessfulNode: globalState.lastNode,
                            }
                            setLastExtrinsicSet(extrinsicSetResults, relay)
                            return extrinsicSetResults
                        }
                        
                        nextInputValue = Number.parseFloat(transferExtrinsicResultData.lastNode.assetValue)
                        allExtrinsicResultData.push(transferExtrinsicResultData)
                        instructionsToExecute = remainingInstructions
                        let extrinsicSetResults: ExtrinsicSetResultDynamic = {
                            success: true,
                            extrinsicData: allExtrinsicResultData,
                            lastSuccessfulNode: globalState.lastNode,
                        }
                        setLastExtrinsicSet(extrinsicSetResults, relay)
                    }
                    break;

            }
        }
        // Handle any remaining swap instructions at the end of the instruction set
        let instructionsToExecute = swapInstructions
        while(instructionsToExecute.length > 0 && testLoopIndex < testLoops){
            let [extrinsicResultData, remainingInstructions] = await buildAndExecuteSwapExtrinsic(relay, instructionsToExecute, chopsticks, executeMovr, nextInputValue, chainNonces, extrinsicIndex)
            if(extrinsicResultData.success == false){
                console.log("Extrinsic failed")
                console.log(extrinsicResultData.arbExecutionResult)
                allExtrinsicResultData.push(extrinsicResultData)
                printExtrinsicSetResults(allExtrinsicResultData)
                // let lastSuccessfulNode = await getLastSuccessfulNodeFromResultData(allExtrinsicResultData)
                let extrinsicSetResults: ExtrinsicSetResultDynamic = {
                    success: false,
                    extrinsicData: allExtrinsicResultData,
                    lastSuccessfulNode: globalState.lastNode,
                }
                setLastExtrinsicSet(extrinsicSetResults, relay)
                return extrinsicSetResults
            }
            // If undefined, not error just skip
            if(!extrinsicResultData){
                nextInputValue = 0
                break;
            }
            allExtrinsicResultData.push(extrinsicResultData)
            let extrinsicSetResults: ExtrinsicSetResultDynamic = {
                success: true,
                extrinsicData: allExtrinsicResultData,
                lastSuccessfulNode: globalState.lastNode,
            }
            setLastExtrinsicSet(extrinsicSetResults, relay)
            nextInputValue = Number.parseFloat(extrinsicResultData.lastNode.assetValue)
            instructionsToExecute = remainingInstructions
        }
        swapInstructions = [];   
    } catch(e){
        // Need to properly handle this. Error should be extrinsicResultData
        console.log(e)
        printExtrinsicSetResults(allExtrinsicResultData)
        // let lastSuccessfulNode = await getLastSuccessfulNodeFromResultData(allExtrinsicResultData)
        let extrinsicSetResults: ExtrinsicSetResultDynamic = {
            success: false,
            extrinsicData: allExtrinsicResultData,
            lastSuccessfulNode: globalState.lastNode,
        }
        setLastExtrinsicSet(extrinsicSetResults, relay)
        return extrinsicSetResults

    }
    // let lastSuccessfulNode = await getLastSuccessfulNodeFromResultData(allExtrinsicResultData)
    let extrinsicSetResults: ExtrinsicSetResultDynamic = {
        success: true,
        extrinsicData: allExtrinsicResultData,
        lastSuccessfulNode: globalState.lastNode,
    }
    setLastExtrinsicSet(extrinsicSetResults, relay)
    return extrinsicSetResults;
}
async function runFromLastNode(relay: Relay, chopsticks: boolean, executeMovr: boolean, customInput: number = 0){
    globalState = getLastExecutionState(relay)
    let lastTransactionState: TransactionState = globalState.transactionState

    // If last transaction has been submitted but not finalized, we need to query the balances to see if it completed successfully or not
    if(globalState.transactionState == TransactionState.Broadcasted){
        await confirmLastTransactionSuccess(globalState.transactionProperties)
        globalState.transactionState = TransactionState.PreSubmission
    }

    globalState.extrinsicSetResults.extrinsicData.forEach((extrinsicData) => {
        console.log(JSON.stringify(extrinsicData.arbExecutionResult, null, 2))
    })
    // globalState = executionState

    if(!globalState.lastNode){
        console.log("Last node is undefined. No extrinsics executed successfully. Exiting")
        return;
    }
    
    const currentDateTime = new Date().toString();

    console.log(currentDateTime);

    let arbLoops = 0
    let arbSuccess = false

    //Rerun arb until success or last node is Kusama
    while(!arbSuccess && globalState.lastNode.chainId != 0 && arbLoops < 1){
        arbLoops += 1

        if(lastTransactionState == TransactionState.Broadcasted){
            let transactionSuccess = await confirmLastTransactionSuccess(globalState.transactionProperties)
            globalState.transactionState = TransactionState.PreSubmission
            // lastNode = globalState.lastNode
        }
        // let lastNodeValueTemp = '40.00'
        let arbInput = customInput > 0 ? customInput : globalState.lastNode.assetValue
        let targetNode = relay === 'kusama' ? ksmTargetNode : dotTargetNode
        let functionArgs = `${globalState.lastNode.assetKey} ${targetNode} ${arbInput}`
        customInput = 0
        console.log("Executing Arb Fallback with args: " + functionArgs)
        

        let arbResults: ResultDataObject[];
        try{
            arbResults = await runAndReturnFallbackArb(functionArgs, chopsticks, relay)
        } catch {
            console.log("Failed to run fallback arb")
            continue;
        }
        let assetPath: AssetNode[] = arbResults.map(result => readLogData(result, relay))
        let instructions = await buildInstructionSet(relay, assetPath)
        await printInstructionSet(instructions)
        let extrinsicSetResults = await buildAndExecuteExtrinsics(relay, instructions, chopsticks, executeMovr, 100)

        logAllResultsDynamic(relay, globalState.lastFilePath, true)
        logAllArbAttempts(relay, globalState.lastFilePath, chopsticks)
        if(extrinsicSetResults.success){
            arbSuccess = true
        }

        globalState.lastNode = globalState.lastNode
        if(!globalState.lastNode){
            console.log("Last node undefined. ERROR: some extrinsics have executed successfully")
            throw new Error("Last node undefined. ERROR: some extrinsics have executed successfully")
        }
    }
    if(arbSuccess){
        setExecutionSuccess(true, relay)
    }
    let arbAmountOut = await getTotalArbResultAmount(relay, globalState.lastNode)
    await logProfits(relay, arbAmountOut, globalState.lastFilePath, chopsticks )
}


async function testXcm(){
    let toNode: TNode = 'Moonbeam'
    let fromNode: TNode = 'AssetHubPolkadot'
    let assetId = "1337" // USDT
    let amount = "14000000" // 10
    let api = await getApiForNode(fromNode, true)

    let signer = await getSigner(true, false)
    let destWallet = await getSigner(true, true)
    let destAddress = await destWallet.address

    
    let xcmTx = paraspell.Builder(api).from(fromNode).to(toNode).currency(assetId).amount(amount).address(destAddress).build()
    console.log(JSON.stringify(xcmTx.toHuman(), null, 2))
    // let tx = await xcmTx.signAndSend(signer)
    // console.log(tx.toHuman())

    let txResult: Promise<TxDetails> = new Promise((resolve, reject) => {
        let success = false;
        let included: EventRecord[] = [];
        let finalized: EventRecord[] = [];
        let eventLogs: any[] = [];
        let blockHash: string = "";
        let dispatchErrorCode;
        let decodedError;
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
                        decodedError = xcmTx.registry.findMetaError({index: new BN(moduleIndex), error: new BN(errorIndex)});
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
    console.log("Execute Transfer: tx promise created")
    let txDetails: Promise<TxDetails> = txResult;
    let txResultData = await txDetails
    console.log("Execute Transfer: tx result data: " + JSON.stringify(txResultData, null, 2))
}

async function testAcala(){
    let acala: TNode = 'Acala'
    let fromNode: TNode = 'Unique'
    let assetId = "UNQ" // USDT
    let amount = "100000"

    let api = await getApiForNode(acala, true)
    await api.isReady

    let number = await api.query.system.number();
    console.log("Current block number: ", number.toNumber())
}

async function main(){
    await buildTest()
    // await runFromLastNode('polkadot', true, false)
    // await testXcm()
    // await testAcala()
}

// main()