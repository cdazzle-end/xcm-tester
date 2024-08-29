import '@galacticcouncil/api-augment/basilisk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runAndReturnFallbackArb, getArbExecutionPath, findNewTargetArb } from './arbFinder/runArbFinder.ts';
import { dotTargetNode, ksmTargetNode } from './config/index.ts';
import { AssetNode, GlobalState } from './core/index.ts';
import { allocateFundsForSwapFromRelay, buildAndExecuteTransferExtrinsic, buildAndExecuteExtrinsics, buildInstructionSet, allocateToRelay, confirmLastTransactionSuccess } from './execution/index.ts';
import { ExecutionState, ExtrinsicSetResultDynamic, InstructionType, ArbFinderNode, LastNode, Relay, SwapInstruction, SwapProperties, TransactionState, TransferInstruction, TransferProperties } from './types/types.ts';
import { closeApis, getExecutionAttempts, getExecutionSuccess, getLastNode, getLatestDefaultArb, getLastTargetArb, getTotalArbResultAmount, getTransactionProperties, getTransactionState, initializeLastGlobalState, logAllResultsDynamic, logProfits, nodeLogger, pathLogger, printInstructionSet, readLogData, resetGlobalState, stateSetExecutionRelay, stateSetExecutionSuccess, stateSetLastNode, stateSetTransactionState, stateSetLastFile, truncateAssetPath } from './utils/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// REVIEW Over use of getLastNode() here is redundant, could be cleaned up
async function runFromLastNode(relay: Relay, chopsticks: boolean, executeMovr: boolean, customInput: number = 0){
    // setExecutionSuccess(false, relay)
    const executionState: Readonly<ExecutionState> = initializeLastGlobalState(relay)

    console.log(`Last Global State: ${JSON.stringify(executionState.lastNode, null, 2)} | 
        ${JSON.stringify(executionState.transactionProperties, null, 2)} | 
        ${JSON.stringify(executionState.transactionState, null, 2)}`)
    
    let lastNode: LastNode | null = executionState.lastNode
    let logFilePath: string = executionState.lastFilePath!
    let lastExtrinsicSet: ExtrinsicSetResultDynamic = executionState.extrinsicSetResults!
    let lastTransactionState: TransactionState = executionState.transactionState!
    let lastTransactionProperties: TransferProperties | SwapProperties = executionState.transactionProperties!


    lastExtrinsicSet.allExtrinsicResults.forEach((extrinsicData) => {
        console.log(JSON.stringify(extrinsicData.arbExecutionResult, null, 2))
    })

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
            stateSetTransactionState(TransactionState.PreSubmission)
            lastNode = getLastNode()!
        }
        // let lastNodeValueTemp = '40.00'
        let arbInput = customInput > 0 ? customInput : lastNode.assetValue
        let targetNode = relay === 'kusama' ? ksmTargetNode : dotTargetNode
        let functionArgs = `${lastNode.assetKey} ${targetNode} ${arbInput}`
        customInput = 0
        console.log("Executing Arb Fallback with args: " + functionArgs)
        

        let arbResults: ArbFinderNode[];
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

        await logAllResultsDynamic(chopsticks)
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
        await stateSetExecutionSuccess(true)
    }
    // await logAllResultsDynamic(relay, logFilePath, chopsticks)
    // await logAllArbAttempts(relay, logFilePath, chopsticks)
    let arbAmountOut = await getTotalArbResultAmount(relay, getLastNode()!, chopsticks)
    await logProfits(arbAmountOut, chopsticks )
}

// Main function. Find new arb with specified input amount, or use previous arb path. Execute path and log results
/**
 * Find and Execute arb with specified input amount
 * 
 * @param relay - Which relay to use. 'polkadot' or 'kusama'
 * @param chopsticks - To run on chopsticks testnet set to true. Parachain instances must be running and their ports configured properly
 * @param executeMovr - To execute swaps on evm, set to true. If running on chopsticks, can't properly execute swaps, so set to false 
 * @param inputAmount - Specify amount in short notation, (1.0 instead of 10000000000). Will find arb for this amount
 * @param useLatestTarget - To use latest arb found instead of searching for a new one
 * @returns 
 */
async function findAndExecuteArb(relay: Relay, chopsticks: boolean, executeMovr: boolean, inputAmount: number, useLatestTarget: boolean = false){
    if (relay !== 'kusama' && relay !== 'polkadot') throw new Error('Relay not specified')
    GlobalState.initializeAndResetGlobalState(relay)

    // Execute new arb-finder, or just parse results from last arb file
    let arbPathData: ArbFinderNode[]
    if(useLatestTarget){
        arbPathData = getLastTargetArb(relay)
    } else {
        arbPathData = await findNewTargetArb(relay, inputAmount, chopsticks)
    }

    let assetPath: AssetNode[] = arbPathData.map(result => readLogData(result, relay))

    pathLogger.info(`Arb Path Data: ${JSON.stringify(arbPathData, null, 2)}`)
    nodeLogger.info(`Asset Path: ${JSON.stringify(assetPath, null, 2)}`)

    let assetNodesAbreviated: AssetNode[] = await truncateAssetPath(assetPath)

    let startChainId = assetNodesAbreviated[0].getChainId()

    // Allocate tokens to relay if needed. Return balance on all chains
    console.log("Check and allocate relay token")
    let nativeBalances = await allocateToRelay(relay, startChainId, chopsticks, inputAmount, executeMovr);

    // GET allocation node from relay -> start chain if needed.
    let executionPath: AssetNode[] = await allocateFundsForSwapFromRelay(relay, assetNodesAbreviated, nativeBalances, chopsticks, executeMovr)

    let firstNode = executionPath[0].asLastNode()
    // Set LAST NODE to first node in execution path
    await stateSetLastNode(firstNode)

    // BUILD instruction set from asset path
    let instructionsToExecute: (SwapInstruction | TransferInstruction)[] = await buildInstructionSet(relay, executionPath)

    // Check for allocation instruction
    if(instructionsToExecute[0].type != InstructionType.Swap){
        let firstInstruction: TransferInstruction = instructionsToExecute.splice(0, 1)[0] as TransferInstruction
        await buildAndExecuteTransferExtrinsic(relay, firstInstruction, chopsticks, executeMovr)
        await logAllResultsDynamic(chopsticks)
        instructionsToExecute[0].assetNodes[0].pathValue = getLastNode()!.assetValue
    }

    let testLoops = 100
    
    // BUILD and EXECUTE extrinsics
    let executionResults: ExtrinsicSetResultDynamic = await buildAndExecuteExtrinsics(relay, instructionsToExecute, chopsticks, executeMovr, testLoops, true)

    // LOG results
    await logAllResultsDynamic(chopsticks) // Logs Global State Extrinsic Set Results, and to latest attempt folder
    
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
        if(getTransactionState() == TransactionState.Broadcasted){
            await confirmLastTransactionSuccess(getTransactionProperties()!)
            lastNode = getLastNode()!
            stateSetTransactionState(TransactionState.PreSubmission)
        }
        let targetNode = relay === 'kusama' ? ksmTargetNode : dotTargetNode
        let functionArgs = `${lastNode.assetKey} ${targetNode} ${lastNode.assetValue}`
        console.log("Executing Arb Fallback with args: " + functionArgs)

        let fallbackArbResults: ArbFinderNode[];
        try{
            fallbackArbResults = await runAndReturnFallbackArb(functionArgs, chopsticks, relay)
        } catch {
            console.log("Failed to run fallback arb")
            continue;
        }
        let assetPath: AssetNode[] = fallbackArbResults.map(result => readLogData(result, relay))
        instructionsToExecute = await buildInstructionSet(relay, assetPath)
        executionResults = await buildAndExecuteExtrinsics(relay, instructionsToExecute, chopsticks, executeMovr, 100, false)

        await logAllResultsDynamic(chopsticks)
        // await logAllArbAttempts(chopsticks)
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
        stateSetExecutionSuccess(true)
    }
    await logAllResultsDynamic(chopsticks)

    console.log("Getting total arb amount out for normal arb")
    let arbAmountOut = await getTotalArbResultAmount(relay, getLastNode()!, chopsticks)
    await logProfits(arbAmountOut, chopsticks )
    
    // console.log(`Result for latest file ${latestFile}: ${arbSuccess}`)
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
        stateSetExecutionSuccess(true)
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
            await findAndExecuteArb(relay, chopsticks, executeMovr, latest.inputAmount)
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
                await findAndExecuteArb(relay, chopsticks, executeMovr, latest.inputAmount)
            }
        }
    }
}

// TEST Execute latest calculated arb for specified relay and input amount.
async function executeLatestArb(relay: Relay, chopsticks: boolean, executeMovr: boolean){
    stateSetExecutionSuccess(false)    
    stateSetExecutionRelay(relay)

    let latestFile = getLastTargetArb(relay)
    let arbPathData: ArbFinderNode[] = latestFile

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

    let executionResults: ExtrinsicSetResultDynamic = await buildAndExecuteExtrinsics(relay, instructionsToExecute, chopsticks, executeMovr, testLoops, true)

}



// Run with arg kusama
async function run() {
    const relay = process.argv.slice(2)[0] as Relay
    let chopsticks = true
    let executeMovr = false
    let useLatestTarget = false
    let startNew = true
    let customInput = 0

    // await runFromLastNode(relay, chopsticks, executeMovr)  
    await findAndExecuteArb(relay, chopsticks, executeMovr, 0.50, useLatestTarget)
    
    // await executeTestPath(relay, chopsticks, executeMovr)
    // await testAssetLookup()
    // await checkAndRunLatest(relay, chopsticks, executeMovr, startNew)
    // await executeLatestArb(relay, chopsticks, executeMovr)
    
    process.exit(0)
}

run()