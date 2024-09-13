import '@galacticcouncil/api-augment/basilisk';
import { dotNodeKeys, kusamaNodeKeys } from '../config/txConsts.ts';
import { getAllNodes, isEvmChain, isTransferResult, printExtrinsicSetResults, printInstruction } from '../utils/utils.ts';
import { ExtrinsicObject, ExtrinsicSetResultDynamic, IndexObject, InstructionType, LastNode, Relay, SingleTransferResultData, SwapInstruction, TransferInstruction } from './../types/types.ts';
import { confirmLastExtrinsicSuccess, stateGetExtrinsicSetResults, stateGetLastNode, stateGetNextInputValue, stateSetNextInputValue, wasLastExtrinsicSuccessful } from './../utils/globalStateUtils.ts';
import { executeAndReturnExtrinsic } from './executionUtils.ts';
import { buildSwapExtrinsicDynamic, buildTransferExtrinsicDynamic } from './extrinsicUtils.ts';


// Use instructions to build and execute tx's one by one. Main execution flow happens here
export async function buildAndExecuteExtrinsics(
    relay: Relay, 
    instructionSet: (SwapInstruction | TransferInstruction)[], 
    chopsticks: boolean, 
    executeMovr: boolean, 
    // testLoops: number, 
    allocationExtrinsic: boolean
): Promise<ExtrinsicSetResultDynamic> {
    let swapInstructionQueue: SwapInstruction[] = [];

    const destinationNodes = getAllNodes(relay)

    // let nextInputValue: string = "0";
    let loopIndex = 0;
    // let lastNode: LastNode;
    let firstInputValue = instructionSet[0].assetNodes[0].pathValue
    // console.log("FIRST INSTRUCTION INPUT VALUE: ", firstInputValue)
    try{
        for (const instruction of instructionSet) {
            console.log(`Loop index: ${loopIndex}`)
            printInstruction(instruction)
            // console.log("LOOP NUMBER: ", loopIndex)
            // console.log("Allocation Extrinsic: ", allocationExtrinsic)
            const lastExtrinsicSetResultsCheck: ExtrinsicSetResultDynamic | null = stateGetExtrinsicSetResults()
            // If last successful node is a DOT/KSM node, we can finish
            if(allocationExtrinsic == false && destinationNodes.includes(stateGetLastNode()!.assetKey) && lastExtrinsicSetResultsCheck != null){
                console.log(`Returning because reached end target`)
                return lastExtrinsicSetResultsCheck
            }

            loopIndex += 1;
            
            switch (instruction.type) {
                case InstructionType.Swap:
                    // TESTS if EVM, SKIP and set next to 0
                    if (chopsticks === true && isEvmChain(instruction.assetNodes[0].chain)) {
                        console.log("Skipping EVM swap")
                        stateSetNextInputValue('0')
                        break;
                    }
                    // If swap queue is empty OR swap is of the same type as swap instructions in the queue, add swap to the queue
                    if(swapInstructionQueue.length == 0 || swapInstructionQueue[swapInstructionQueue.length - 1].pathType == instruction.pathType){
                        swapInstructionQueue.push(instruction);
                    } else {
                        // If there are previous swap instructions in the queue AND this swap is of different type, execute queued swap instructions, excluding this new swap
                        await buildAndExecuteSwapExtrinsics(relay, swapInstructionQueue, chopsticks, executeMovr, allocationExtrinsic)
                       
                        // If extrinsic failed then return
                        let extrinsicResults = stateGetExtrinsicSetResults()
                        if(extrinsicResults!.success === false) throw new Error(`Extrinsic failed. Returning results...`)  

                        confirmLastExtrinsicSuccess()
                        
                        // After executing swap instruction queue, clear queue and add this new swap instruction to queue
                        swapInstructionQueue = [instruction];
                    }
                    break;
                default: // Execute TRANSFER instructions

                    // First execute any queued up swap instructions
                    if (swapInstructionQueue.length > 0) {
                        await buildAndExecuteSwapExtrinsics(relay, swapInstructionQueue, chopsticks, executeMovr, allocationExtrinsic)
                        swapInstructionQueue = [];   

                        // If extrinsic failed then return
                        let extrinsicResults = stateGetExtrinsicSetResults()
                        if(extrinsicResults!.success === false) throw new Error(`Extrinsic failed. Returning results...`)   

                        confirmLastExtrinsicSuccess()
                    }
                    

                    // Then execute transfer instructions
                    let instructionsToExecute = [instruction]
                    await buildAndExecuteTransferExtrinsics(relay, instructionsToExecute, chopsticks, executeMovr, allocationExtrinsic)

                    // If extrinsic failed then return
                    let extrinsicResults = stateGetExtrinsicSetResults()
                    if(extrinsicResults!.success === false) throw new Error(`Extrinsic failed. Returning results...`)    
                    confirmLastExtrinsicSuccess()            
                   
                    break;

            }
        }
        // Handle any remaining swap instructions at the end of the instruction set
        // let instructionsToExecute = swapInstructionQueue
        await buildAndExecuteSwapExtrinsics(relay, swapInstructionQueue, chopsticks, executeMovr, allocationExtrinsic)

        // If extrinsic failed then return
        let extrinsicResults = stateGetExtrinsicSetResults()
        if(extrinsicResults!.success === false) throw new Error(`Extrinsic failed. Returning results...`)  

        confirmLastExtrinsicSuccess()

        swapInstructionQueue = [];   
    } catch(e){
        // Need to properly handle this. Error should be extrinsicResultData
        console.log(`Execution error`)
        console.log(e)
        let extrinsicSetResults: ExtrinsicSetResultDynamic | null = stateGetExtrinsicSetResults()
        if(extrinsicSetResults === null){
            throw new Error("Can't return extrinsic set results. Extrinsics undefined")
        }       
        printExtrinsicSetResults(extrinsicSetResults.allExtrinsicResults)
        return extrinsicSetResults
    }
    let extrinsicSetResults: ExtrinsicSetResultDynamic | null = stateGetExtrinsicSetResults()
    if(extrinsicSetResults === null){
        throw new Error("Can't return extrinsic set results. Extrinsics undefined")
    }       
    return extrinsicSetResults
}

export async function buildAndExecuteSwapExtrinsics(
    relay: Relay, 
    swapInstructionQueue: SwapInstruction[], 
    chopsticks: boolean, 
    executeMovr: boolean,
    allocationExtrinsic: boolean,
    // nextInputValue: string
): Promise<void> {
    while(swapInstructionQueue.length > 0){

        // Set input of swap to output of last transaction
        const nextInputValue = stateGetNextInputValue()
        if(Number.parseFloat(nextInputValue) > 0){
            swapInstructionQueue[0].assetNodes[0].pathValue = nextInputValue
        }

        // Build an extrinsic for as many swap instructions as possible, return the extrinsic and the remaining instructions that weren't included
        let [swapExtrinsicContainer, remainingInstructions] = await buildSwapExtrinsicDynamic(relay, swapInstructionQueue, chopsticks);
        
        // Execute extrinsic
        let extrinsicResultData = await executeAndReturnExtrinsic(swapExtrinsicContainer, chopsticks, executeMovr)
        if(!extrinsicResultData){
            throw new Error("Extrinsic Result Data undefined")
        }
        if(allocationExtrinsic){
            allocationExtrinsic = false
        }

        // If extrinsic failed, return results
        if(extrinsicResultData.success == false){
            console.log("Extrinsic failed")
            console.log(extrinsicResultData.arbExecutionResult)
            let extrinsicSetResults: ExtrinsicSetResultDynamic | null = stateGetExtrinsicSetResults()
            if(extrinsicSetResults === null){
                throw new Error("Global State extrinsic set results is undefined")
            }
            return
        }

        // MOVR/GLMR swaps return undefined in test, not error just skip
        if(!extrinsicResultData){
            // nextInputValue = "0"
            stateSetNextInputValue('0')
            break;
        }
        // nextInputValue = extrinsicResultData.lastNode!.assetValue
        stateSetNextInputValue(extrinsicResultData.lastNode!.assetValue)
        swapInstructionQueue = remainingInstructions
    }
}

/**
 * Build and execute transfer extrinscs from instruction
 * - Will execute single transfer, or break transfer instruction into 2 extrinsics and execute them
 * - Returns the output of last transfer
 * 
 * @param relay 
 * @param transferInstructions 
 * @param chopsticks 
 * @param executeMovr 
 * @param nextInputValue 
 * @param allocationExtrinsic 
 * @returns 
 */
export async function buildAndExecuteTransferExtrinsics(
    relay: Relay,
    transferInstructions: TransferInstruction[],
    chopsticks: boolean,
    executeMovr: boolean,
    // nextInputValue: string,
    allocationExtrinsic: boolean
): Promise<void> {
    while(transferInstructions.length > 0){
        // --- TRACKING
        const nextInputValue = stateGetNextInputValue()
        if(Number.parseFloat(nextInputValue) > 0){
            transferInstructions[0].assetNodes[0].pathValue = nextInputValue
        }

        let [transferExtrinsic, remainingInstructions] = await buildTransferExtrinsicDynamic(relay, transferInstructions[0], chopsticks);

        let transferExtrinsicResultData = await executeAndReturnExtrinsic(transferExtrinsic, chopsticks, executeMovr)
        if(!transferExtrinsicResultData){
            throw new Error("Transfer Tx Result Data: undefined")
        }
        // --- TRACKING
        if(allocationExtrinsic){
            allocationExtrinsic = false
        }
        // If undefined and running test, either start or dest chain not running in chopsticks. not error just skip
        if(chopsticks && !transferExtrinsicResultData){
            stateSetNextInputValue('0')
            break;
        }
        if(transferExtrinsicResultData.success === false){
            console.log("Extrinsic failed")
            console.log(transferExtrinsicResultData.arbExecutionResult)
            let extrinsicSetResults: ExtrinsicSetResultDynamic | null = stateGetExtrinsicSetResults()
            if(extrinsicSetResults === null){
                throw new Error("Extrsinsic set results undefined")
            }
            return
        }

        // --- TRACKING
        stateSetNextInputValue(transferExtrinsicResultData.lastNode!.assetValue)
        transferInstructions = remainingInstructions
    }
}

// Don't need to execute while loop for instructionsToExecute/remainingInstructions because each set should just be one transfer, ANY CHAIN -> KUSAMA
/**
 * Build and execute a single transfer extrinsic from a TransferInstruction
 * - After building allocation instructions, execute them as singular transfers
 * 
 * Execute transfer extrinsics without affecting global state
 * 
 * Need to modify other transfer extrinsic executor to handle allocation extrinsics where:
 * - Input value is not set to previous output
 * - Don't set global state next input value
 * 
 * @param relay 
 * @param transferInstruction - Single TransferInstruction
 * @param chopsticks 
 * @param executeMovr 
 * @returns 
 */
export async function buildAndExecuteTransferExtrinsic(
    relay: Relay, 
    transferInstruction: TransferInstruction, 
    chopsticks: boolean, 
    executeMovr: boolean
): Promise<SingleTransferResultData>{
    let [transferExtrinsic, remainingInstructions] = await buildTransferExtrinsicDynamic(relay, transferInstruction, chopsticks);
    

    let transferExtrinsicResultData = await executeAndReturnExtrinsic(transferExtrinsic, chopsticks, executeMovr)
    if(transferExtrinsicResultData === undefined || !isTransferResult(transferExtrinsicResultData)){
        throw new Error('Transfer result data error')
    }

    if(transferExtrinsicResultData.success == false){
        console.log("Extrinsic failed")
        console.log(transferExtrinsicResultData.arbExecutionResult)
        return transferExtrinsicResultData
    }

    confirmLastExtrinsicSuccess()
    return transferExtrinsicResultData
    
}