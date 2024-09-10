import '@galacticcouncil/api-augment/basilisk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { findFallbackArb, findNewTargetArb } from './arbFinder/runArbFinder.ts';
import { dotTargetNode, ksmTargetNode } from './config/index.ts';
import { AssetNode, GlobalState } from './core/index.ts';
import { allocateToStartChain, buildAndExecuteTransferExtrinsic, buildAndExecuteExtrinsics, buildInstructionSet, allocateToRelay, confirmLastTransactionSuccess, allocateFunds } from './execution/index.ts';
import { ExecutionState, ExtrinsicSetResultDynamic, InstructionType, ArbFinderNode, LastNode, Relay, SwapInstruction, SwapProperties, TransactionState, TransferInstruction, TransferProperties } from './types/types.ts';
import { closeApis, stateGetExecutionAttempts, stateGetExecutionSuccess, stateGetLastNode, getLatestDefaultArb, getLastTargetArb, getTotalArbResultAmount, stateGetTransactionProperties, stateGetTransactionState, initializeLastGlobalState, logAllResultsDynamic, logProfits, nodeLogger, pathLogger, printInstructionSet, readLogData, resetGlobalState, stateSetExecutionRelay, stateSetExecutionSuccess, stateSetLastNode, stateSetTransactionState, stateSetLastFile, truncateAssetPath, constructAssetNodesFromPath, getTargetNode, stateGetExtrinsicSetResults } from './utils/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// REVIEW Over use of getLastNode() here is redundant, could be cleaned up
async function runFromLastNode(relay: Relay, chopsticks: boolean, executeMovr: boolean, customInput: number = 0){
    initializeLastGlobalState(relay)

    console.log(`Last Global State: ${JSON.stringify(stateGetLastNode()!, null, 2)} | 
        ${JSON.stringify(stateGetTransactionProperties(), null, 2)} | 
        ${JSON.stringify(stateGetTransactionState(), null, 2)}`)

    stateGetExtrinsicSetResults()!.allExtrinsicResults.forEach((extrinsicData) => {
        console.log(JSON.stringify(extrinsicData.arbExecutionResult, null, 2))
    })

    if(stateGetLastNode() === null){
        console.log("Last node is undefined. No extrinsics executed successfully. Exiting")
        return;
    }

    let arbLoops = 0
    let arbSuccess = false

    //Rerun arb until success or last node is Kusama/Dot Token
    while(!arbSuccess && stateGetLastNode()!.chainId != 0 && arbLoops < 1){
        console.log("Arb Execution failed, trying again...")

        // Confirm status of last extrinsic
        if(stateGetTransactionState() == TransactionState.Broadcasted){
            await confirmLastTransactionSuccess(stateGetTransactionProperties()!)
            stateSetTransactionState(TransactionState.PreSubmission)
        }
        let assetPath: AssetNode[] = []

        // Find arb from last successful node (asset and value) to destination node
        let fallbackStartKey = stateGetLastNode()!.assetKey
        let fallbackDestinationKey = getTargetNode(relay)
        let fallbackInputValue = stateGetLastNode()!.assetValue
        try{
            const fallbackArbPath: ArbFinderNode[] = await findFallbackArb(fallbackStartKey, fallbackDestinationKey, fallbackInputValue, chopsticks, relay)
            assetPath = constructAssetNodesFromPath(relay, fallbackArbPath)
        } catch {
            console.log("Failed to run fallback arb")
            continue;
        }
        let instructionsToExecute = await buildInstructionSet(relay, assetPath)

        arbLoops += 1


        let executionResults = await buildAndExecuteExtrinsics(relay, instructionsToExecute, chopsticks, executeMovr, false)

        await logAllResultsDynamic(chopsticks)
        arbSuccess = executionResults.success

        if(stateGetLastNode() === null){
            console.log("Last node undefined. ERROR: some extrinsics have executed successfully")
            throw new Error("Last node undefined. ERROR: some extrinsics have executed successfully")
        }
        
        // -----------
    }
    if(arbSuccess){
        await stateSetExecutionSuccess(true)
    }
    // await logAllResultsDynamic(relay, logFilePath, chopsticks)
    // await logAllArbAttempts(relay, logFilePath, chopsticks)
    let arbAmountOut = await getTotalArbResultAmount(relay, chopsticks)
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
    console.log(`Arb finder path nodes:`)
    arbPathData.forEach((node) => console.log(`${node.node_key} ${node.path_value} ${node.path_type}`))

    // Parse path into asset nodes
    let assetPath: AssetNode[] = constructAssetNodesFromPath(relay, arbPathData)
    assetPath = await truncateAssetPath(assetPath) // Remove beginning xcm tx's before swap
    assetPath = await allocateFunds(relay, assetPath, chopsticks, inputAmount) // Add transfer from relay -> start if needed
    stateSetLastNode(assetPath[0].asLastNode())

    let instructionsToExecute: (SwapInstruction | TransferInstruction)[];
    let executionResults: ExtrinsicSetResultDynamic
    let arbLoops = 0
    let arbSuccess = false

    // Loop to build and execute extrinsics from asset nodes
    while(!arbSuccess && arbLoops < 1){
        if(stateGetLastNode()?.chainId == 0 && arbLoops > 0){
            console.log(`Last node is relay chain, so we could exit here and log profits`)
            break
        }

        if(arbLoops > 0){ // After first attempt, re run arb and try again
            console.log("Arb Execution failed, trying again...")

            // Confirm status of last extrinsic
            if(stateGetTransactionState() == TransactionState.Broadcasted){
                await confirmLastTransactionSuccess(stateGetTransactionProperties()!)
                stateSetTransactionState(TransactionState.PreSubmission)
            }

            // Find arb from last successful node (asset and value) to destination node
            let fallbackStartKey = stateGetLastNode()!.assetKey
            let fallbackDestinationKey = getTargetNode(relay)
            let fallbackInputValue = stateGetLastNode()!.assetValue
            try{
                const fallbackArbPath: ArbFinderNode[] = await findFallbackArb(fallbackStartKey, fallbackDestinationKey, fallbackInputValue, chopsticks, relay)
                assetPath = constructAssetNodesFromPath(relay, fallbackArbPath)
            } catch {
                console.log("Failed to run fallback arb")
                continue;
            }
            instructionsToExecute = await buildInstructionSet(relay, assetPath)

        } else { // On first loop, build instructions, 

            instructionsToExecute = buildInstructionSet(relay, assetPath)

            // REVIEW I think this is only needed for logs that depend on the first node, and we change the first node to the original swap 
            // REMOVE
            // For some reason, instead o executing path as is, we remove the first transfer instruction from the path (if it exists) and execute it by itself
            if(instructionsToExecute[0].type != InstructionType.Swap){
                let firstInstruction: TransferInstruction = instructionsToExecute.splice(0, 1)[0] as TransferInstruction
                await buildAndExecuteTransferExtrinsic(relay, firstInstruction, chopsticks, executeMovr)
                await logAllResultsDynamic(chopsticks)
                instructionsToExecute[0].assetNodes[0].pathValue = stateGetLastNode()!.assetValue
            }
        }
        arbLoops += 1


        executionResults = await buildAndExecuteExtrinsics(relay, instructionsToExecute, chopsticks, executeMovr, false)

        await logAllResultsDynamic(chopsticks)
        arbSuccess = executionResults.success

        if(stateGetLastNode() === null){
            console.log("Last node undefined. ERROR: some extrinsics have executed successfully")
            throw new Error("Last node undefined. ERROR: some extrinsics have executed successfully")
        }
    }
    if(arbSuccess){
        stateSetExecutionSuccess(true)
    }
    // await logAllResultsDynamic(chopsticks)

    console.log("Getting total arb amount out for normal arb")
    let arbAmountOut = await getTotalArbResultAmount(relay, chopsticks)
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
    if(stateGetExecutionSuccess()){
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
        if(stateGetExecutionAttempts() < 4){
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

    let executionResults: ExtrinsicSetResultDynamic = await buildAndExecuteExtrinsics(relay, instructionsToExecute, chopsticks, executeMovr, true)

}



// Run with arg kusama
async function run() {
    const relay = process.argv.slice(2)[0] as Relay
    let chopsticks = false
    let executeMovr = true
    let useLatestTarget = false
    let startNew = true
    let customInput = 0

    // await runFromLastNode(relay, chopsticks, executeMovr)  
    await findAndExecuteArb(relay, chopsticks, executeMovr, 0.20, useLatestTarget)
    
    // await executeTestPath(relay, chopsticks, executeMovr)
    // await testAssetLookup()
    // await checkAndRunLatest(relay, chopsticks, executeMovr, startNew)
    // await executeLatestArb(relay, chopsticks, executeMovr)
    
    process.exit(0)
}

run()