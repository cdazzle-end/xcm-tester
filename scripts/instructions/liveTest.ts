import { ApiPromise, ApiRx } from '@polkadot/api';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { AssetNode } from './AssetNode.ts';
import { buildSwapExtrinsicDynamic, buildTransferExtrinsicDynamic, createSwapExtrinsicObject } from './extrinsicUtils.ts';
import { buildInstructionSet, buildInstructionSetTest } from './instructionUtils.ts';
import { dotNodeKeys, dotTargetNode, ksmTargetNode, kusamaNodeKeys } from './txConsts.ts';
import { AsyncFileData, ChainNonces, ExecutionState, ExtrinsicObject, ExtrinsicSetResultDynamic, IndexObject, InstructionType, JsonPathNode, LastNode, Relay, SwapInstruction, SwapProperties, TransactionState, TransferInstruction, TransferProperties } from './types.ts';
import { getArbExecutionPath, getAssetRegistry, getAssetRegistryObject, getAssetRegistryObjectBySymbol, getLatestDefaultArb, getLatestAsyncFilesKusama, getLatestAsyncFilesPolkadot, getLatestTargetFileKusama, getLatestTargetFilePolkadot, getTotalArbResultAmount, printExtrinsicSetResults, printInstructionSet, readLogData, truncateAssetPath } from './utils.ts';
// import { BalanceChangeStatue } from 'src/types.ts';
import { runAndReturnFallbackArb, runAndReturnTargetArb } from './executeArbFallback.ts';
import { allocateFundsForSwapFromRelay, buildAndExecuteSwapExtrinsic, checkAndAllocateRelayToken, confirmLastTransactionSuccess, executeAndReturnExtrinsic } from './executionUtils.ts';
import { logAllResultsDynamic, logProfits } from './logUtils.ts';
// import { liveWallet3Pk } from 'scripts/swaps/movr/utils/const.ts';
import { TNode } from '@paraspell/sdk';
// import { getBsxSwapExtrinsic, testBsxSwap } from './../swaps/bsxSwap.ts';
import '@galacticcouncil/api-augment/basilisk';
import { closeApis, getApiForNode } from './apiUtils.ts';
import { BalanceAdapter, getRelayTokenBalances } from './balanceUtils.ts';
import { GlobalState } from './GlobalState.ts'
import { getExecutionAttempts, getExecutionState, getExecutionSuccess, getExtrinsicSetResults, getLastNode, getTransactionProperties, getTransactionState, initializeLastGlobalState, resetGlobalState, setExecutionRelay, setExecutionSuccess, setLastFile, setLastNode, setTransactionState } from './globalStateUtils.ts';
import { nodeLogger, pathLogger } from './logger.ts';
import { buildAndExecuteAllocationExtrinsics, buildAndExecuteExtrinsics } from './arbExecutor.ts';
// import { globalState } from './polkadotTest.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const allConnectionPromises = new Map<string, Promise<ApiPromise>>();
export const allConnections = new Map<string, ApiPromise>();
export let promiseApis: Record<number, ApiPromise> = {};
export let observableApis: Record<number, ApiRx> = {};
export let apiMap: Map<TNode | "Kusama" | "Polkadot", ApiPromise> = new Map<TNode, ApiPromise>();
export let balanceAdapterMap: Map<TNode | "Kusama" | "Polkadot", BalanceAdapter> = new Map<TNode, BalanceAdapter>();

const aliceAddress = "HNZata7iMYWmk5RvZRTiAsSDhV8366zq2YGb3tLH5Upf74F"

// const mgxRpc = 'wss://kusama-rpc.mangata.online'
const dazzleMgxAddres = '5G22cv9fT5RNVm2AV4MKgagmKH9aoZL4289UDcYrToP9K6hQ'
const aliceErc20 = "0xf24FF3a9CF04c71Dbc94D0b566f7A27B94566cac"

// export const globalState = GlobalState.getInstance(relay);
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





// Use instructions to build and execute tx's one by one. Main execution flow happens here
// export async function buildAndExecuteExtrinsics(
//     relay: Relay, 
//     instructionSet: (SwapInstruction | TransferInstruction)[], 
//     chopsticks: boolean, 
//     executeMovr: boolean, 
//     testLoops: number, 
//     allocationExtrinsic: boolean
// ): Promise<ExtrinsicSetResultDynamic> {
//     let swapInstructions: SwapInstruction[] = [];
//     let extrinsicIndex: IndexObject = {i: 0}
//     // let allExtrinsicResultData: (SingleSwapResultData | SingleTransferResultData) [] = [];

//     let nodeEndKeys = relay === 'kusama' ? kusamaNodeKeys : dotNodeKeys

//     if(getExtrinsicSetResults() != null){
//         console.log("********************************************************")
//         console.log("Using global state extrinsic set results")
//         // allExtrinsicResultData = globalState.extrinsicSetResults.extrinsicData
//     } else {
//         console.log("********************************************************")
//         console.log("Extrinsic set is null")
//     }

//     let nextInputValue: string = "0";
//     let testLoopIndex = 0;
//     // let lastNode: LastNode;
//     let firstInputValue = instructionSet[0].assetNodes[0].pathValue
//     console.log("FIRST INSTRUCTION INPUT VALUE: ", firstInputValue)
//     try{
//         for (const instruction of instructionSet) {
//             console.log("LOOP NUMBER: ", testLoopIndex)
//             console.log("Allocation Extrinsic: ", allocationExtrinsic)
//             const lastNodeCheck: LastNode | null = getLastNode()
//             const lastExtrinsicSetResultsCheck: ExtrinsicSetResultDynamic | null = getExtrinsicSetResults()
//             // If last successful node is a DOT/KSM node, we can finish
//             if(allocationExtrinsic == false && lastNodeCheck != null && nodeEndKeys.includes(lastNodeCheck.assetKey) && lastExtrinsicSetResultsCheck != null){
//                 return lastExtrinsicSetResultsCheck
//             }
//             if(testLoopIndex > testLoops){
//                 break;
//             }
//             testLoopIndex += 1;
            
//             switch (instruction.type) {
//                 case InstructionType.Swap:
//                     console.log("SWAP INSTRUCTION")
//                     // TESTS if EVM, SKIP and set next to 0
//                     if(
//                         chopsticks == true && relay == 'kusama' && instruction.assetNodes[0].getChainId() == 2023 ||
//                         chopsticks == true && relay == 'polkadot' && instruction.assetNodes[0].getChainId() == 2004
//                     ){
//                         nextInputValue = "0"
//                         console.log("Skipping EVM swap")
//                         break;
//                     }
//                     // If swap is of the same type, accumulate so that we can execute all swaps in one tx
//                     if(swapInstructions.length == 0 || swapInstructions[swapInstructions.length - 1].pathType == instruction.pathType){
//                         swapInstructions.push(instruction);

//                     // If swap is of a different type, build and execute swap for the so far accumulated swap instructions
//                     } else {
//                         let instructionsToExecute = swapInstructions

//                         while(instructionsToExecute.length > 0){
//                             if(Number.parseFloat(nextInputValue) > 0){
//                                 instructionsToExecute[0].assetNodes[0].pathValue = nextInputValue.toString()
//                             }
//                             let [swapExtrinsicContainer, remainingInstructions] = await buildSwapExtrinsicDynamic(relay, instructionsToExecute, extrinsicIndex, chopsticks);

//                             let extrinsicObj: ExtrinsicObject = await createSwapExtrinsicObject(swapExtrinsicContainer)
                            
//                             let extrinsicResultData = await executeAndReturnExtrinsic(extrinsicObj, extrinsicIndex, chopsticks, executeMovr)
//                             if(!extrinsicResultData){
//                                 throw new Error("Extrinsic Result Data undefined")
//                             }
//                             if(allocationExtrinsic){
//                                 allocationExtrinsic = false
//                             }
//                             if(extrinsicResultData.success == false){
//                                 console.log("Extrinsic failed")
//                                 console.log(extrinsicResultData.arbExecutionResult)
//                                 let extrinsicSetResults: ExtrinsicSetResultDynamic | null = getExtrinsicSetResults()
//                                 if(extrinsicSetResults === null){
//                                     throw new Error("Global State extrinsic set results is undefined")
//                                 }
//                                 return extrinsicSetResults
//                             }

//                             // MOVR/GLMR swaps return undefined in test, not error just skip
//                             if(!extrinsicResultData){
//                                 nextInputValue = "0"
//                                 break;
//                             }
//                             nextInputValue = extrinsicResultData.lastNode!.assetValue
//                             instructionsToExecute = remainingInstructions

//                         }

//                         // Accumulate new swap instruction
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
//                             let [swapExtrinsicContainer, remainingInstructions] = await buildSwapExtrinsicDynamic(relay, instructionsToExecute, extrinsicIndex, chopsticks);

//                             console.log("Swap Tx container assetAmountIn (Actual Value): ", swapExtrinsicContainer.assetAmountIn.toChainData())
//                             console.log("Swap Tx container pathAmount (Display Value) ", swapExtrinsicContainer.pathAmount)

//                             let extrinsicObj: ExtrinsicObject = {
//                                 type: "Swap",
//                                 instructionIndex: swapExtrinsicContainer.instructionIndex,
//                                 extrinsicIndex: swapExtrinsicContainer.extrinsicIndex,
//                                 swapExtrinsicContainer: swapExtrinsicContainer
//                             }
//                             let extrinsicResultData = await executeAndReturnExtrinsic(extrinsicObj, extrinsicIndex, chopsticks, executeMovr)
//                             if(allocationExtrinsic){
//                                 allocationExtrinsic = false
//                             }
//                             // If undefined, not error just skip
//                             if(!extrinsicResultData){
//                                 nextInputValue = "0"
//                                 break;
//                             }
//                             if(extrinsicResultData.success == false){
//                                 console.log("Extrinsic failed")
//                                 console.log(extrinsicResultData.arbExecutionResult)
//                                 let extrinsicSetResults: ExtrinsicSetResultDynamic | null = getExtrinsicSetResults()
//                                 if(extrinsicSetResults === null){
//                                     throw new Error("")
//                                 }
//                                 return extrinsicSetResults
//                             }
//                             nextInputValue = extrinsicResultData.lastNode!.assetValue
//                             instructionsToExecute = remainingInstructions
//                         }
//                         swapInstructions = [];   
//                     }
//                     // Then execute transfer instructions
//                     let instructionsToExecute = [instruction]
//                     while(instructionsToExecute.length > 0){
//                         console.log("************************************")
//                         console.log("Creating transfer extrinsic")
//                         if(Number.parseFloat(nextInputValue) > 0){
//                             instructionsToExecute[0].assetNodes[0].pathValue = nextInputValue.toString()
//                             console.log(`Setting instruction.assetNodes[0].pathValue to previous output: ${nextInputValue}`)
//                         }
//                         let [transferExtrinsic, remainingInstructions] = await buildTransferExtrinsicDynamic(relay, instructionsToExecute[0], extrinsicIndex, chopsticks);

//                         let extrinsicObj: ExtrinsicObject = {
//                             type: "Transfer",
//                             instructionIndex: transferExtrinsic.instructionIndex,
//                             extrinsicIndex: transferExtrinsic.extrinsicIndex,
//                             transferExtrinsicContainer: transferExtrinsic
//                         }
    
//                         let transferExtrinsicResultData = await executeAndReturnExtrinsic(extrinsicObj, extrinsicIndex, chopsticks, executeMovr)
//                         if(!transferExtrinsicResultData){
//                             throw new Error("Transfer Tx Result Data: undefined")
//                         }
//                         if(allocationExtrinsic){
//                             allocationExtrinsic = false
//                         }
//                         // If undefined and running test, either start or dest chain not running in chopsticks. not error just skip
//                         if(chopsticks && !transferExtrinsicResultData){
//                             nextInputValue = "0"
//                             break;
//                         }
//                         if(transferExtrinsicResultData.success == false){
//                             console.log("Extrinsic failed")
//                             console.log(transferExtrinsicResultData.arbExecutionResult)
//                             let extrinsicSetResults: ExtrinsicSetResultDynamic | null = getExtrinsicSetResults()
//                             if(extrinsicSetResults === null){
//                                 throw new Error("Extrsinsic set results undefined")
//                             }
//                             return extrinsicSetResults
//                         }
                        
//                         nextInputValue = transferExtrinsicResultData.lastNode!.assetValue
//                         console.log(`*** Completed extrinsic. Setting next input value to: ${nextInputValue}`)
//                         instructionsToExecute = remainingInstructions
//                     }
//                     break;

//             }
//         }
//         // Handle any remaining swap instructions at the end of the instruction set
//         let instructionsToExecute = swapInstructions
//         while(instructionsToExecute.length > 0 && testLoopIndex < testLoops){
//             console.log("Reached end")
//             console.log("Execute remaining swap instructions")
//             let [extrinsicResultData, remainingInstructions] = await buildAndExecuteSwapExtrinsic(relay, instructionsToExecute, chopsticks, executeMovr, nextInputValue, extrinsicIndex)
            
//             // If undefined, not error just skip
//             if(!extrinsicResultData){
//                 nextInputValue = "0"
//                 break;
//             }
            
//             // REVIEW Allocation extrinsic execution flow
//             if(allocationExtrinsic){
//                 allocationExtrinsic = false
//             }
//             if(extrinsicResultData.success == false){
//                 console.log("Extrinsic failed")
//                 console.log(extrinsicResultData.arbExecutionResult)
//                 let extrinsicSetResults: ExtrinsicSetResultDynamic | null = getExtrinsicSetResults()
//                 if(extrinsicSetResults === null){
//                     throw new Error("Extrsinsic set results undefined")
//                 }
//                 return extrinsicSetResults
//             }

//             nextInputValue = extrinsicResultData.lastNode!.assetValue
//             instructionsToExecute = remainingInstructions
//         }
//         swapInstructions = [];   
//     } catch(e){
//         // Need to properly handle this. Error should be extrinsicResultData
//         console.log(e)
//         let extrinsicSetResults: ExtrinsicSetResultDynamic | null = getExtrinsicSetResults()
//         if(extrinsicSetResults === null){
//             throw new Error("Extrsinsic set results undefined")
//         }       
//         printExtrinsicSetResults(extrinsicSetResults.allExtrinsicResults)
//         return extrinsicSetResults
//     }
//     let extrinsicSetResults: ExtrinsicSetResultDynamic | null = getExtrinsicSetResults()
//     if(extrinsicSetResults === null){
//         throw new Error("Extrsinsic set results undefined")
//     }       
//     return extrinsicSetResults
// }



// REVIEW Over use of getLastNode() here is redundant, could be cleaned up
async function runFromLastNode(relay: Relay, chopsticks: boolean, executeMovr: boolean, customInput: number = 0){
    // setExecutionSuccess(false, relay)
    const executionState: Readonly<ExecutionState> = initializeLastGlobalState(relay)
    let lastNode: LastNode | null = executionState.lastNode
    let logFilePath: string = executionState.lastFilePath!
    let lastExtrinsicSet: ExtrinsicSetResultDynamic = executionState.extrinsicSetResults!
    let lastTransactionState: TransactionState = executionState.transactionState!
    let lastTransactionProperties: TransferProperties | SwapProperties = executionState.transactionProperties!

    console.log("Last transaction properties: ", JSON.stringify(lastTransactionProperties, null, 2))


    lastExtrinsicSet.allExtrinsicResults.forEach((extrinsicData) => {
        console.log(JSON.stringify(extrinsicData.arbExecutionResult, null, 2))
    })
    // globalState = executionState

    if(lastNode === null){
        console.log("Last node is undefined. No extrinsics executed successfully. Exiting")
        return;
    }
    
    const currentDateTime = new Date().toString();

    console.log(currentDateTime);

    let arbLoops = 0
    let arbSuccess = false

    //Rerun arb until success or last node is Kusama/Dot Token
    while(!arbSuccess && getLastNode()!.chainId != 0 && arbLoops < 1){
        arbLoops += 1

        // If last transaction has been submitted but not finalized, we need to query the balances to see if it completed successfully or not
        if(lastTransactionState == TransactionState.Broadcasted){
            await confirmLastTransactionSuccess(lastTransactionProperties)
            setTransactionState(TransactionState.PreSubmission)
            // globalState.transactionState = TransactionState.PreSubmission
            lastNode = getLastNode()!
        }
        // let lastNodeValueTemp = '40.00'
        let arbInput = customInput > 0 ? customInput : lastNode.assetValue
        let targetNode = relay === 'kusama' ? ksmTargetNode : dotTargetNode
        let functionArgs = `${lastNode.assetKey} ${targetNode} ${arbInput}`
        customInput = 0
        console.log("Executing Arb Fallback with args: " + functionArgs)
        

        let arbResults: JsonPathNode[];
        try{
            arbResults = await runAndReturnFallbackArb(functionArgs, chopsticks, relay)
        } catch {
            console.log("Failed to run fallback arb")
            continue;
        }
        console.log("ARB PATH FIRST INPUT VALUE: ", arbResults[0].path_value)
        let assetPath: AssetNode[] = arbResults.map(result => readLogData(result, relay))
        let instructions = await buildInstructionSet(relay, assetPath)

        // ****************************************************
        let inputPathValue = instructions[0].assetNodes[0].pathValue
        console.log("INPUT PATH VALUE: ", inputPathValue)
        // ****************************************************
        
        await printInstructionSet(instructions)
        let extrinsicSetResults = await buildAndExecuteExtrinsics(relay, instructions, chopsticks, executeMovr, 100, true)

        await logAllResultsDynamic(relay, logFilePath, chopsticks)
        // await logAllArbAttempts(relay, logFilePath, chopsticks)
        if(extrinsicSetResults.success){
            arbSuccess = true
        }

        lastNode = getLastNode()
        if(lastNode === null){
            console.log("Last node undefined. ERROR: some extrinsics have executed successfully")
            throw new Error("Last node undefined. ERROR: some extrinsics have executed successfully")
        }
    }
    if(arbSuccess){
        await setExecutionSuccess(true)
    }
    // await logAllResultsDynamic(relay, logFilePath, chopsticks)
    // await logAllArbAttempts(relay, logFilePath, chopsticks)
    let arbAmountOut = await getTotalArbResultAmount(relay, getLastNode()!, chopsticks)
    await logProfits(relay, arbAmountOut, logFilePath, chopsticks )
}

// Main function. Find new arb with specified input amount, or use previous arb path. Execute path and log results
async function runDynamicArbTargetRelay(relay: Relay, chopsticks: boolean, executeMovr: boolean, inputAmount: number, useLatestTarget: boolean = false){

    console.log(`Getting global state`)
    let globalState = GlobalState.getInstance('polkadot')
    console.log(`Current Global State: ${JSON.stringify(globalState)}`)
    // resetExecutionState()

    console.log(`Resetting global state`)
    resetGlobalState(relay)
    console.log(`Global State after ressetting now: ${JSON.stringify(globalState)}`)


    setExecutionSuccess(false)    
    setExecutionRelay(relay)

    let latestFile = relay == 'kusama' ? getLatestTargetFileKusama() : getLatestTargetFilePolkadot()
    if(!latestFile){
        throw new Error("Latest File undefined")
    }
    setLastFile(latestFile) // *** FIGURE out better place for this. Last file is used to track arb execution across multiple attempts

    // GET arb execution path data
    let arbPathData: JsonPathNode[] = await getArbExecutionPath(relay, latestFile, inputAmount, useLatestTarget, chopsticks)

    pathLogger.info(`Arb Path Data: ${JSON.stringify(arbPathData, null, 2)}`)

    console.log("ARB PATH DATA: ", JSON.stringify(arbPathData, null, 2))

    // READ arb path data, construct asset path
    let assetPath: AssetNode[] = arbPathData.map(result => readLogData(result, relay))

    nodeLogger.info(`Asset Path: ${JSON.stringify(assetPath, null, 2)}`)

    // Skip nodes up to first swap node
    let assetNodesAbreviated = await truncateAssetPath(assetPath, chopsticks)

    let startChainId = assetNodesAbreviated[0].getChainId()

    // Allocate tokens to relay if needed. Return balance on all chains
    console.log("Check and allocate relay token")
    let nativeBalances = await checkAndAllocateRelayToken(relay, startChainId, chopsticks, inputAmount, executeMovr);

    // GET allocation node from relay -> start chain if needed.
    let executionPath: AssetNode[] = await allocateFundsForSwapFromRelay(relay, assetNodesAbreviated, nativeBalances, chopsticks, executeMovr)

    let firstNode: LastNode = {
        assetKey: JSON.stringify(executionPath[0].getChainId().toString() + JSON.stringify(executionPath[0].getAssetLocalId())),
        assetValue: executionPath[0].pathValue,
        chainId: executionPath[0].getChainId(),
        assetSymbol: executionPath[0].getAssetRegistrySymbol()
    }
    // Set LAST NODE to first node in execution path
    await setLastNode(firstNode)

    // BUILD instruction set from asset path
    let instructionsToExecute: (SwapInstruction | TransferInstruction)[] = await buildInstructionSet(relay, executionPath)
    await printInstructionSet(instructionsToExecute)



    // Check for allocation instruction
    if(instructionsToExecute[0].type != InstructionType.Swap){
        let firstInstruction: TransferInstruction = instructionsToExecute.splice(0, 1)[0] as TransferInstruction
        await buildAndExecuteAllocationExtrinsics(relay, [firstInstruction], chopsticks, executeMovr, 100)
        await logAllResultsDynamic(relay, latestFile, chopsticks)
        instructionsToExecute[0].assetNodes[0].pathValue = getLastNode()!.assetValue
    }

    let testLoops = 100
    
    // BUILD and EXECUTE extrinsics
    let executionResults: ExtrinsicSetResultDynamic = await buildAndExecuteExtrinsics(relay, instructionsToExecute, chopsticks, executeMovr, testLoops, true)

    // LOG results
    await logAllResultsDynamic(relay, latestFile, chopsticks) // Logs Global State Extrinsic Set Results, and to latest attempt folder
    
    let arbSuccess = executionResults.success
    let lastNode: LastNode | null = getLastNode()
    if(lastNode === null){
        console.log("Last node is undefined. No extrinsics executed successfully. Exiting")
        return;
    }
    

    let arbLoops = 0
    //Rerun arb until success or last node is Relay Token
    while(!arbSuccess && lastNode!.chainId != 0 && arbLoops < 1){
        arbLoops += 1
        // const lastTransactionState = getTransactionState()
        if(getTransactionState() == TransactionState.Broadcasted){
            await confirmLastTransactionSuccess(getTransactionProperties()!)
            lastNode = getLastNode()
            setTransactionState(TransactionState.PreSubmission)
        }
        let targetNode = relay === 'kusama' ? ksmTargetNode : dotTargetNode
        let functionArgs = `${lastNode} ${targetNode} ${lastNode}`
        console.log("Executing Arb Fallback with args: " + functionArgs)

        let fallbackArbResults: JsonPathNode[];
        try{
            fallbackArbResults = await runAndReturnFallbackArb(functionArgs, chopsticks, relay)
        } catch {
            console.log("Failed to run fallback arb")
            continue;
        }
        let assetPath: AssetNode[] = fallbackArbResults.map(result => readLogData(result, relay))
        instructionsToExecute = await buildInstructionSet(relay, assetPath)
        executionResults = await buildAndExecuteExtrinsics(relay, instructionsToExecute, chopsticks, executeMovr, 100, false)

        await logAllResultsDynamic(relay, latestFile, chopsticks)
        // await logAllArbAttempts(relay, latestFile, chopsticks)
        if(executionResults.success){
            arbSuccess = true
        }
        // lastNode = await getLastSuccessfulNodeFromAllExtrinsics(allExtrinsicSets)
        lastNode = getLastNode()
        if(!lastNode){
            console.log("Last node undefined. ERROR: some extrinsics have executed successfully")
            throw new Error("Last node undefined. ERROR: some extrinsics have executed successfully")
        }
    }
    if(arbSuccess){
        setExecutionSuccess(true)
    }
    await logAllResultsDynamic(relay, latestFile, chopsticks)

    console.log("Getting total arb amount out for normal arb")
    let arbAmountOut = await getTotalArbResultAmount(relay, getLastNode()!, chopsticks)
    await logProfits(relay, arbAmountOut, latestFile, chopsticks )
    
    console.log(`Result for latest file ${latestFile}: ${arbSuccess}`)
    console.log(`Total Arb Amount Out: ${arbAmountOut}`)

    await closeApis();

}




// Check latest outputs, if above threshold, run arb with specified input
async function checkAndRunLatest(relay: Relay, chopsticks: boolean, executeMovr: boolean, startNew: boolean){
    const lastExecutionState = initializeLastGlobalState(relay)
    console.log("Global State: ", lastExecutionState)
    if(startNew){
        console.log("Start new.")
        resetGlobalState(relay)
        console.log("Global State: ", lastExecutionState)
        setExecutionSuccess(true)
    }
    // console.log("")
    if(getExecutionSuccess()){
        console.log("Last execution was successful. Start new arb")
        let latest = await getLatestDefaultArb(relay)
        if(!latest){
            console.log("No suitable result found")
            return;
        } else {
            console.log("Running arb with input amount: ", latest.inputAmount)
            await runDynamicArbTargetRelay(relay, chopsticks, executeMovr, latest.inputAmount)
        }
    } else {
        console.log("Last execution was not successful. Check total attempts")
        if(getExecutionAttempts() < 4){
            console.log("Less than 4 attempts. Rerun last arb")
            await runFromLastNode(relay, chopsticks, executeMovr)
        } else {
            console.log("More than 4 attempts. Start new arb")
            let latest = await getLatestDefaultArb(relay)
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

// TEST Execute latest calculated arb for specified relay and input amount.
async function executeLatestArb(relay: Relay, chopsticks: boolean, executeMovr: boolean){
    setExecutionSuccess(false)    
    setExecutionRelay(relay)

    let latestFile = relay == 'kusama' ? getLatestTargetFileKusama() : getLatestTargetFilePolkadot()
    let arbPathData: JsonPathNode[] = JSON.parse(fs.readFileSync(latestFile!, 'utf8'))

    let assetPath: AssetNode[] = arbPathData.map(result => readLogData(result, relay))

    let firstNode: LastNode = {
        assetKey: assetPath[0].getAssetRegistrySymbol(),
        assetValue: assetPath[0].pathValue,
        chainId: assetPath[0].getChainId(),
        assetSymbol: assetPath[0].getAssetRegistrySymbol()
    }
    // Set LAST NODE to first node in execution path
    await setLastNode(firstNode)

    // BUILD instruction set from asset path
    let instructionsToExecute: (SwapInstruction | TransferInstruction)[] = await buildInstructionSet(relay, assetPath)
    await printInstructionSet(instructionsToExecute)

    let testLoops = 100

    let executionResults: ExtrinsicSetResultDynamic = await buildAndExecuteExtrinsics(relay, instructionsToExecute, chopsticks, executeMovr, testLoops, true)

}



// Run with arg kusama
async function run() {
    let chopsticks = true
    let executeMovr = false

    let useLatestTarget = false
    const relay = process.argv.slice(2)[0] as Relay

    // let results = await testCollectKsm(relay, chopsticks, executeMovr)
    // console.log(results)
    // console.log("Executing arb on relay: ", relay)
    // await getLatest()
    let startNew = true
    // await checkAndRunLatest(relay, chopsticks, executeMovr, startNew)
    // await executeLatestArb(relay, chopsticks, executeMovr)
    let customInput = 0
    // await runFromLastNode(relay, chopsticks, executeMovr)  
    // await testAssetLookup()
    // export const globalState = GlobalState.getInstance(relay);
    await runDynamicArbTargetRelay(relay, chopsticks, executeMovr, 0.50, useLatestTarget)
    // await executeTestPath(relay, chopsticks, executeMovr)
    // await getLatest()
    // await testAca()
    // await buildTest()

    // await testApi()
    process.exit(0)
}

run()