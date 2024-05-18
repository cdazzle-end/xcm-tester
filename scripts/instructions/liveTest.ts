import fs from 'fs'
import { WsProvider, ApiPromise, Keyring, ApiRx } from '@polkadot/api'
import path from 'path';
import { cryptoWaitReady } from "@polkadot/util-crypto"
import { getAssetBySymbolOrId, getParaspellChainName, getAssetRegistryObject, readLogData, getAssetRegistryObjectBySymbol, getSigner, printInstruction, increaseIndex, getLastSuccessfulNodeFromResultData, printExtrinsicSetResults, getLatestFileFromLatestDay, constructRouteFromFile, getLastSuccessfulNodeFromAllExtrinsics, getNodeFromChainId, getTotalArbResultAmount, getLatestTargetFileKusama, getLatestAsyncFilesKusama, getLatestTargetFilePolkadot, getLatestAsyncFilesPolkadot, constructRouteFromJson, printAllocations, printInstructionSet, getFirstSwapNodeFromAssetNodes as truncateAssetPath, getArbExecutionPath } from './utils.ts'
import { ResultDataObject, MyAssetRegistryObject, MyAsset, AssetNodeData, InstructionType, SwapInstruction, TransferInstruction, TransferToHomeThenDestInstruction, TxDetails, TransferToHomeChainInstruction, TransferParams, TransferAwayFromHomeChainInstruction, TransferrableAssetObject, TransferTxStats, BalanceChangeStats, SwapTxStats, SwapExtrinsicContainer, ExtrinsicObject, ChainNonces, TransferExtrinsicContainer, ReverseSwapExtrinsicParams, SwapResultObject, ExtrinsicSetResult, IndexObject, ArbExecutionResult, PathNodeValues, LastNode, SingleExtrinsicResultData, SingleTransferResultData, SingleSwapResultData, ExtrinsicSetResultDynamic, ExecutionState, LastFilePath, PreExecutionTransfer, TransactionState, TransferProperties, SwapProperties, AsyncFileData, Relay, JsonPathNode } from './types.ts'
import { AssetNode } from './AssetNode.ts'
import { allocateKsmFromPreTransferPaths, buildInstructionSet, buildInstructions, getPreTransferPath, getTransferrableAssetObject } from './instructionUtils.ts';
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
import { allocateFundsForSwap, buildAndExecuteSwapExtrinsic, checkAndAllocateRelayToken, collectRelayToken, confirmLastTransactionSuccess, executeAndReturnExtrinsic, executeSingleSwapExtrinsic, executeSingleSwapExtrinsicMovr, executeSingleTransferExtrinsic, executeTransferTx } from './executionUtils.ts';
// import { liveWallet3Pk } from 'scripts/swaps/movr/utils/const.ts';
import { TNode } from '@paraspell/sdk';
import { BN } from '@polkadot/util/bn/bn';
import { FixedPointNumber } from '@acala-network/sdk-core';
import { movrContractAddress, xcKarContractAddress, xcXrtContractAddress } from './../swaps/movr/utils/const.ts';
import { formatMovrTx, getMovrSwapTx, testXcTokensMoonriver } from './../swaps/movr/movrSwap.ts';
// import { getBsxSwapExtrinsic, testBsxSwap } from './../swaps/bsxSwap.ts';
import '@galacticcouncil/api-augment/basilisk';
import { getApiForNode } from './apiUtils.ts';
import { getLastExecutionState, resetExecutionState, setExecutionRelay, setExecutionSuccess, setLastExtrinsicSet, setLastFile } from './globalStateUtils.ts';
import { getNativeBalanceAcrossChains } from './balanceUtils.ts';

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



// Don't need to execute while loop for instructionsToExecute/remainingInstructions because each set should just be one transfer, ANY CHAIN -> KUSAMA
export async function buildAndExecuteAllocationExtrinsics(relay: Relay, instructionSet: TransferInstruction[], chopsticks: boolean, executeMovr: boolean, testLoops: number){
    // let isntructionsToExecute = instructionSet
    // while(isntructionsToExecute.length > 0){
        let extrinsicIndex = {i: 0}
        let [transferExtrinsic, remainingInstructions] = await buildTransferExtrinsicDynamic(relay, instructionSet[0], extrinsicIndex, chopsticks);
        let extrinsicObj: ExtrinsicObject = {
            type: "Transfer",
            instructionIndex: transferExtrinsic.instructionIndex,
            extrinsicIndex: transferExtrinsic.extrinsicIndex,
            transferExtrinsicContainer: transferExtrinsic
        }

        let transferExtrinsicResultData = await executeAndReturnExtrinsic(extrinsicObj, extrinsicIndex, chopsticks, executeMovr)
        if(transferExtrinsicResultData.success == false){
            console.log("Extrinsic failed")
            console.log(transferExtrinsicResultData.arbExecutionResult)
            return transferExtrinsicResultData
        }
        return transferExtrinsicResultData

        // isntructionsToExecute = remainingInstructions
    // }
    
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

                            // MOVR/GLMR swaps return undefined in test, not error just skip
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
        let extrinsicSetResults: ExtrinsicSetResultDynamic = {
            success: false,
            extrinsicData: allExtrinsicResultData,
            lastSuccessfulNode: globalState.lastNode,
        }
        setLastExtrinsicSet(extrinsicSetResults, relay)
        return extrinsicSetResults

    }

    let extrinsicSetResults: ExtrinsicSetResultDynamic = {
        success: true,
        extrinsicData: allExtrinsicResultData,
        lastSuccessfulNode: globalState.lastNode,
    }
    setLastExtrinsicSet(extrinsicSetResults, relay)
    return extrinsicSetResults;
}

// // Skip route nodes up to ksm node to start from / first swap node
async function getFirstSwapNodeFromInstructions(instructions: (SwapInstruction | TransferInstruction)[], chopsticks: boolean){ 
    let instructionIndex = 0;   
    let firstInstruction = instructions.find((instruction, index) => {
        if(instruction.type == InstructionType.Swap){
            instructionIndex = index
            return true
        }   
    })
    if(!firstInstruction){
        throw new Error("No swap instructions found")
    }
    let instructionsToExecute = instructions.slice(instructionIndex)

    return instructionsToExecute
}

async function runFromLastNode(relay: Relay, chopsticks: boolean, executeMovr: boolean, customInput: number = 0){
    // setExecutionSuccess(false, relay)
    globalState = getLastExecutionState(relay)
    // let relay = globalState.relay
    let lastNode: LastNode = globalState.lastNode
    let logFilePath: string = globalState.lastFilePath
    let lastExtrinsicSet: ExtrinsicSetResultDynamic = globalState.extrinsicSetResults
    let lastTransactionState: TransactionState = globalState.transactionState
    let lastTransactionProperties: TransferProperties | SwapProperties = globalState.transactionProperties

    // If last transaction has been submitted but not finalized, we need to query the balances to see if it completed successfully or not
    if(lastTransactionState == TransactionState.Broadcasted){
        await confirmLastTransactionSuccess(lastTransactionProperties)
        globalState.transactionState = TransactionState.PreSubmission
    }

    lastExtrinsicSet.extrinsicData.forEach((extrinsicData) => {
        console.log(JSON.stringify(extrinsicData.arbExecutionResult, null, 2))
    })
    // globalState = executionState

    if(!lastNode){
        console.log("Last node is undefined. No extrinsics executed successfully. Exiting")
        return;
    }
    
    const currentDateTime = new Date().toString();

    console.log(currentDateTime);

    let arbLoops = 0
    let arbSuccess = false

    //Rerun arb until success or last node is Kusama
    while(!arbSuccess && lastNode.chainId != 0 && arbLoops < 1){
        arbLoops += 1

        if(lastTransactionState == TransactionState.Broadcasted){
            let transactionSuccess = await confirmLastTransactionSuccess(lastTransactionProperties)
            globalState.transactionState = TransactionState.PreSubmission
            lastNode = globalState.lastNode
        }
        // let lastNodeValueTemp = '40.00'
        let arbInput = customInput > 0 ? customInput : lastNode.assetValue
        let targetNode = relay === 'kusama' ? ksmTargetNode : dotTargetNode
        let functionArgs = `${lastNode.assetKey} ${targetNode} ${arbInput}`
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

        logAllResultsDynamic(relay, logFilePath, true)
        logAllArbAttempts(relay, logFilePath, chopsticks)
        if(extrinsicSetResults.success){
            arbSuccess = true
        }

        lastNode = globalState.lastNode
        if(!lastNode){
            console.log("Last node undefined. ERROR: some extrinsics have executed successfully")
            throw new Error("Last node undefined. ERROR: some extrinsics have executed successfully")
        }
    }
    if(arbSuccess){
        setExecutionSuccess(true, relay)
    }
    let arbAmountOut = await getTotalArbResultAmount(relay, lastNode)
    await logProfits(relay, arbAmountOut, logFilePath, chopsticks )
}

async function runDynamicArbTargetPolkadot(chopsticks: boolean, executeMovr: boolean, inputAmount: number){
    let arbArgs = `${dotTargetNode} ${dotTargetNode} ${inputAmount}`
    let relay: Relay = 'polkadot'
    let targetArbResults
    try{
        targetArbResults = await runAndReturnTargetArb(arbArgs, chopsticks, relay)
    }  catch {
        console.log("Failed to run target arb")
        throw new Error("Failed to run target arb")
    }
    let latestFile = getLatestTargetFilePolkadot()
    let assetPath: AssetNode[] = targetArbResults.map(result => readLogData(result, relay))
    let targetArbInstructions = await buildInstructionSet(relay, assetPath)
}



async function runDynamicArbTargetRelay(relay: Relay, chopsticks: boolean, executeMovr: boolean, inputAmount: number, useLatestTarget: boolean = false){
    // Allocate tokens to relay if needed. Return balance on all chains
    let nativeBalances = await checkAndAllocateRelayToken(relay, chopsticks, inputAmount, executeMovr);

    resetExecutionState()
    setExecutionSuccess(false, relay)    
    setExecutionRelay(relay)

    let latestFile = relay == 'kusama' ? getLatestTargetFileKusama() : getLatestTargetFilePolkadot()

    // GET arb execution path data
    let arbPathData: ResultDataObject[] | JsonPathNode[] = await getArbExecutionPath(relay, latestFile, inputAmount, useLatestTarget, chopsticks)

    // READ arb path data, construct asset path
    let assetPath: AssetNode[] = arbPathData.map(result => readLogData(result, relay))

    //REMOVE uneccessary transfer nodes/instructions from the start
    let assetNodesAbreviated = await truncateAssetPath(assetPath, chopsticks)

    // ALLOCATE funds to chain for first swap
    let executionPath: AssetNode[] = await allocateFundsForSwap(relay, assetNodesAbreviated, nativeBalances, chopsticks, executeMovr)

    // BUILD instruction set from asset path
    let instructionsToExecute: (SwapInstruction | TransferInstruction)[] = await buildInstructionSet(relay, executionPath)
    await printInstructionSet(instructionsToExecute)

    let testLoops = 100
    
    // BUILD and EXECUTE extrinsics
    let executionResults: ExtrinsicSetResultDynamic = await buildAndExecuteExtrinsics(relay, instructionsToExecute, chopsticks, executeMovr, testLoops)
    
    // COLLECT all extrinsic results
    let allExtrinsicSets: ExtrinsicSetResultDynamic[] = []
    allExtrinsicSets.push(executionResults)

    setLastFile(latestFile, relay) // *** FIGURE out better place for this. Last file is used to track arb execution across multiple attempts

    // LOG results
    logAllResultsDynamic(relay, latestFile, true)
    logAllArbAttempts(relay, latestFile, chopsticks)
    let arbSuccess = executionResults.success
    let lastNode = globalState.lastNode
    if(!lastNode){
        console.log("Last node is undefined. No extrinsics executed successfully. Exiting")
        return;
    }
    

    let arbLoops = 0
    //Rerun arb until success or last node is Relay Token
    while(!arbSuccess && lastNode.chainId != 0 && arbLoops < 1){
        arbLoops += 1
        if(globalState.transactionState == TransactionState.Broadcasted){
            await confirmLastTransactionSuccess(globalState.transactionProperties)
            lastNode = globalState.lastNode
            globalState.transactionState = TransactionState.PreSubmission
        }
        let targetNode = relay === 'kusama' ? ksmTargetNode : dotTargetNode
        let functionArgs = `${lastNode.assetKey} ${targetNode} ${lastNode.assetValue}`
        console.log("Executing Arb Fallback with args: " + functionArgs)

        let fallbackArbResults: ResultDataObject[];
        try{
            fallbackArbResults = await runAndReturnFallbackArb(functionArgs, chopsticks, relay)
        } catch {
            console.log("Failed to run fallback arb")
            continue;
        }
        let assetPath: AssetNode[] = fallbackArbResults.map(result => readLogData(result, relay))
        let reverseInstructions = await buildInstructionSet(relay, assetPath)
        let reverseExtrinsicResult = await buildAndExecuteExtrinsics(relay, reverseInstructions, chopsticks, executeMovr, 100)

        allExtrinsicSets.push(reverseExtrinsicResult)
        logAllResultsDynamic(relay, latestFile, true)
        logAllArbAttempts(relay, latestFile, chopsticks)
        if(reverseExtrinsicResult.success){
            arbSuccess = true
        }
        // lastNode = await getLastSuccessfulNodeFromAllExtrinsics(allExtrinsicSets)
        lastNode = globalState.lastNode
        if(!lastNode){
            console.log("Last node undefined. ERROR: some extrinsics have executed successfully")
            throw new Error("Last node undefined. ERROR: some extrinsics have executed successfully")
        }
    }
    if(arbSuccess){
        setExecutionSuccess(true, relay)
    }
    logAllResultsDynamic(relay, latestFile, true)
    logAllArbAttempts(relay, latestFile, chopsticks)

    console.log("Getting total arb amount out for normal arb")
    let arbAmountOut = await getTotalArbResultAmount(relay, globalState.lastNode)
    await logProfits(relay, arbAmountOut, latestFile, chopsticks )
    
    console.log(`Result for latest file ${latestFile}: ${arbSuccess}`)
    console.log(`Total Arb Amount Out: ${arbAmountOut}`)
}


async function getLatest(relay: Relay){
    let latestFile = relay === 'kusama' ? await getLatestAsyncFilesKusama() : await getLatestAsyncFilesPolkadot()

    let small, medium, big, smallMinimum, mediumMinimum, bigMinimum;
    if (relay === 'kusama'){
        small = 0.1
        smallMinimum = 0.005
        medium = 0.5
        mediumMinimum = 0.01
        big = 1
        bigMinimum = 0.05
    } else {
        small = 0.5
        smallMinimum = 1
        medium = 2
        mediumMinimum = 1
        big = 5
        bigMinimum = 1
    }


    let estimatedResults = latestFile.map(async ([inputAmount, filePath]) => {
        let latestFileData: ResultDataObject[] = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        let estimatedOutput = latestFileData[latestFileData.length - 1].path_value - inputAmount
        console.log(`Estimated output for input amount ${inputAmount}: ${estimatedOutput}`)
        let asyncFileData: AsyncFileData = {
            inputAmount: inputAmount,
            estimatedOutput: estimatedOutput,
            latestFileData: latestFileData
        }
        return asyncFileData
    })

    let results = await Promise.all(estimatedResults)

    let mediumResult = results.find(asyncFileData => {
        return asyncFileData.inputAmount == medium   
    })
    let smallResult = results.find(asyncFileData => {
        return asyncFileData.inputAmount == small
    })

    if(smallResult.estimatedOutput > mediumResult.estimatedOutput && smallResult.estimatedOutput > mediumMinimum){
        console.log("returning smale result. estimated output: ", smallResult.estimatedOutput);
        return smallResult
    }
    if(mediumResult.estimatedOutput > mediumMinimum){
        console.log("Returning medium result. Estimated output: ", mediumResult.estimatedOutput)
        return mediumResult
    }
    if(smallResult.estimatedOutput > smallMinimum){
        console.log("Returning small result. Estimated output: ", smallResult.estimatedOutput)
        return smallResult
    }
    // throw new Error("No suitable result found")
}

// Check latest outputs, if above threshold, run arb with specified input
async function checkAndRunLatest(relay: Relay, chopsticks: boolean, executeMovr: boolean, startNew: boolean){
    globalState = getLastExecutionState(relay)
    // let relay = globalState.relay
    console.log("Global State: ", globalState)
    if(startNew){
        console.log("Start new.")
        resetExecutionState()
        console.log("Global State: ", globalState)
        globalState.executionSuccess = true
    }
    // console.log("")
    if(globalState.executionSuccess){
        console.log("Last execution was successful. Start new arb")
        let latest = await getLatest(relay)
        if(!latest){
            console.log("No suitable result found")
            return;
        } else {
            console.log("Running arb with input amount: ", latest.inputAmount)
            await runDynamicArbTargetRelay(relay, chopsticks, executeMovr, latest.inputAmount)
        }
    } else {
        console.log("Last execution was not successful. Check total attempts")
        if(globalState.executionAttempts < 4){
            console.log("Less than 4 attempts. Rerun last arb")
            await runFromLastNode(relay, chopsticks, executeMovr)
        } else {
            console.log("More than 4 attempts. Start new arb")
            let latest = await getLatest(relay)
            if(!latest){
                console.log("No suitable result found")
                return;
            } else {
                console.log("Running arb with input amount: ", latest.inputAmount)
                await runDynamicArbTargetRelay(relay, chopsticks, executeMovr, latest.inputAmount)
            }
        }
    }
}


// Run with arg kusama
async function run() {
    let startNew = true
    let chopsticks = true
    let executeMovr = false
    let small = true
    let useLatestTarget = false
    const relay = process.argv.slice(2)[0] as Relay

    // let results = await testCollectKsm(relay, chopsticks, executeMovr)
    // console.log(results)
    // console.log("Executing arb on relay: ", relay)
    // await getLatest()
    // await checkAndRunLatest(relay, chopsticks, executeMovr, startNew)
    let customInput = 0
    // await runFromLastNode(relay, chopsticks, executeMovr)  
    await runDynamicArbTargetRelay(relay, chopsticks, executeMovr, 1.0, useLatestTarget)
    // await getLatest()+
}

run()

function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
