import '@galacticcouncil/api-augment/basilisk';
import { dotNodeKeys, kusamaNodeKeys } from '../config/txConsts.ts';
import { isTransferResult, printExtrinsicSetResults } from '../utils/utils.ts';
import { ExtrinsicObject, ExtrinsicSetResultDynamic, IndexObject, InstructionType, LastNode, Relay, SingleTransferResultData, SwapInstruction, TransferInstruction } from './../types/types.ts';
import { getExtrinsicSetResults, getLastNode } from './../utils/globalStateUtils.ts';
import { buildAndExecuteSwapExtrinsic, executeAndReturnExtrinsic } from './executionUtils.ts';
import { buildSwapExtrinsicDynamic, buildTransferExtrinsicDynamic } from './extrinsicUtils.ts';


// Use instructions to build and execute tx's one by one. Main execution flow happens here
export async function buildAndExecuteExtrinsics(
    relay: Relay, 
    instructionSet: (SwapInstruction | TransferInstruction)[], 
    chopsticks: boolean, 
    executeMovr: boolean, 
    testLoops: number, 
    allocationExtrinsic: boolean
): Promise<ExtrinsicSetResultDynamic> {
    let swapInstructions: SwapInstruction[] = [];
    // let allExtrinsicResultData: (SingleSwapResultData | SingleTransferResultData) [] = [];

    let nodeEndKeys = relay === 'kusama' ? kusamaNodeKeys : dotNodeKeys

    if(getExtrinsicSetResults() != null){
        console.log("********************************************************")
        console.log("Using global state extrinsic set results")
        // allExtrinsicResultData = globalState.extrinsicSetResults.extrinsicData
    } else {
        console.log("********************************************************")
        console.log("Extrinsic set is null")
    }

    let nextInputValue: string = "0";
    let testLoopIndex = 0;
    // let lastNode: LastNode;
    let firstInputValue = instructionSet[0].assetNodes[0].pathValue
    console.log("FIRST INSTRUCTION INPUT VALUE: ", firstInputValue)
    try{
        for (const instruction of instructionSet) {
            console.log("LOOP NUMBER: ", testLoopIndex)
            console.log("Allocation Extrinsic: ", allocationExtrinsic)
            const lastNodeCheck: LastNode | null = getLastNode()
            const lastExtrinsicSetResultsCheck: ExtrinsicSetResultDynamic | null = getExtrinsicSetResults()
            // If last successful node is a DOT/KSM node, we can finish
            if(allocationExtrinsic == false && lastNodeCheck != null && nodeEndKeys.includes(lastNodeCheck.assetKey) && lastExtrinsicSetResultsCheck != null){
                return lastExtrinsicSetResultsCheck
            }
            if(testLoopIndex > testLoops){
                break;
            }
            testLoopIndex += 1;
            
            switch (instruction.type) {
                case InstructionType.Swap:
                    console.log("SWAP INSTRUCTION")
                    // TESTS if EVM, SKIP and set next to 0
                    if(
                        chopsticks == true && relay == 'kusama' && instruction.assetNodes[0].getChainId() == 2023 ||
                        chopsticks == true && relay == 'polkadot' && instruction.assetNodes[0].getChainId() == 2004
                    ){
                        nextInputValue = "0"
                        console.log("Skipping EVM swap")
                        break;
                    }
                    // If swap is of the same type, accumulate so that we can execute all swaps in one tx
                    if(swapInstructions.length == 0 || swapInstructions[swapInstructions.length - 1].pathType == instruction.pathType){
                        swapInstructions.push(instruction);

                    // If swap is of a different type, build and execute swap for the so far accumulated swap instructions
                    } else {
                        let instructionsToExecute = swapInstructions

                        while(instructionsToExecute.length > 0){
                            if(Number.parseFloat(nextInputValue) > 0){
                                instructionsToExecute[0].assetNodes[0].pathValue = nextInputValue.toString()
                            }
                            let [swapExtrinsicContainer, remainingInstructions] = await buildSwapExtrinsicDynamic(relay, instructionsToExecute, chopsticks);

                            // let extrinsicObj: ExtrinsicObject = await createSwapExtrinsicObject(swapExtrinsicContainer)
                            
                            let extrinsicResultData = await executeAndReturnExtrinsic(swapExtrinsicContainer, chopsticks, executeMovr)
                            if(!extrinsicResultData){
                                throw new Error("Extrinsic Result Data undefined")
                            }
                            if(allocationExtrinsic){
                                allocationExtrinsic = false
                            }
                            if(extrinsicResultData.success == false){
                                console.log("Extrinsic failed")
                                console.log(extrinsicResultData.arbExecutionResult)
                                let extrinsicSetResults: ExtrinsicSetResultDynamic | null = getExtrinsicSetResults()
                                if(extrinsicSetResults === null){
                                    throw new Error("Global State extrinsic set results is undefined")
                                }
                                return extrinsicSetResults
                            }

                            // MOVR/GLMR swaps return undefined in test, not error just skip
                            if(!extrinsicResultData){
                                nextInputValue = "0"
                                break;
                            }
                            nextInputValue = extrinsicResultData.lastNode!.assetValue
                            instructionsToExecute = remainingInstructions

                        }

                        // Accumulate new swap instruction
                        swapInstructions = [instruction];
                    }
                    break;
                default:
                    // For other types of instructions
                    // First execute any queued up swap instructions
                    if (swapInstructions.length > 0) {
                        let instructionsToExecute = swapInstructions
                        while(instructionsToExecute.length > 0){
                            if( Number.parseFloat(nextInputValue) > 0){
                                instructionsToExecute[0].assetNodes[0].pathValue = nextInputValue.toString()
                            }
                            let [swapExtrinsicContainer, remainingInstructions] = await buildSwapExtrinsicDynamic(relay, instructionsToExecute, chopsticks);

                            console.log("Swap Tx container assetAmountIn (Actual Value): ", swapExtrinsicContainer.assetAmountIn.toChainData())
                            console.log("Swap Tx container pathAmount (Display Value) ", swapExtrinsicContainer.pathAmount)

                            // let extrinsicObj: ExtrinsicObject = {
                            //     type: "Swap",
                            //     extrinsicContainer: swapExtrinsicContainer
                            // }
                            let extrinsicResultData = await executeAndReturnExtrinsic(swapExtrinsicContainer, chopsticks, executeMovr)
                            if(allocationExtrinsic){
                                allocationExtrinsic = false
                            }
                            // If undefined, not error just skip
                            if(!extrinsicResultData){
                                nextInputValue = "0"
                                break;
                            }
                            if(extrinsicResultData.success == false){
                                console.log("Extrinsic failed")
                                console.log(extrinsicResultData.arbExecutionResult)
                                let extrinsicSetResults: ExtrinsicSetResultDynamic | null = getExtrinsicSetResults()
                                if(extrinsicSetResults === null){
                                    throw new Error("")
                                }
                                return extrinsicSetResults
                            }
                            nextInputValue = extrinsicResultData.lastNode!.assetValue
                            instructionsToExecute = remainingInstructions
                        }
                        swapInstructions = [];   
                    }
                    // Then execute transfer instructions
                    let instructionsToExecute = [instruction]
                    while(instructionsToExecute.length > 0){
                        console.log("************************************")
                        console.log("Creating transfer extrinsic")
                        if(Number.parseFloat(nextInputValue) > 0){
                            instructionsToExecute[0].assetNodes[0].pathValue = nextInputValue.toString()
                            console.log(`Setting instruction.assetNodes[0].pathValue to previous output: ${nextInputValue}`)
                        }
                        let [transferExtrinsic, remainingInstructions] = await buildTransferExtrinsicDynamic(relay, instructionsToExecute[0], chopsticks);

                        // let extrinsicObj: ExtrinsicObject = {
                        //     type: "Transfer",
                        //     extrinsicContainer: transferExtrinsic
                        // }
    
                        let transferExtrinsicResultData = await executeAndReturnExtrinsic(transferExtrinsic, chopsticks, executeMovr)
                        if(!transferExtrinsicResultData){
                            throw new Error("Transfer Tx Result Data: undefined")
                        }
                        if(allocationExtrinsic){
                            allocationExtrinsic = false
                        }
                        // If undefined and running test, either start or dest chain not running in chopsticks. not error just skip
                        if(chopsticks && !transferExtrinsicResultData){
                            nextInputValue = "0"
                            break;
                        }
                        if(transferExtrinsicResultData.success == false){
                            console.log("Extrinsic failed")
                            console.log(transferExtrinsicResultData.arbExecutionResult)
                            let extrinsicSetResults: ExtrinsicSetResultDynamic | null = getExtrinsicSetResults()
                            if(extrinsicSetResults === null){
                                throw new Error("Extrsinsic set results undefined")
                            }
                            return extrinsicSetResults
                        }
                        
                        nextInputValue = transferExtrinsicResultData.lastNode!.assetValue
                        console.log(`*** Completed extrinsic. Setting next input value to: ${nextInputValue}`)
                        instructionsToExecute = remainingInstructions
                    }
                    break;

            }
        }
        // Handle any remaining swap instructions at the end of the instruction set
        let instructionsToExecute = swapInstructions
        while(instructionsToExecute.length > 0 && testLoopIndex < testLoops){
            console.log("Reached end")
            console.log("Execute remaining swap instructions")
            let [extrinsicResultData, remainingInstructions] = await buildAndExecuteSwapExtrinsic(relay, instructionsToExecute, chopsticks, executeMovr, nextInputValue )
            
            // If undefined, not error just skip
            if(!extrinsicResultData){
                nextInputValue = "0"
                break;
            }
            
            // REVIEW Allocation extrinsic execution flow
            if(allocationExtrinsic){
                allocationExtrinsic = false
            }
            if(extrinsicResultData.success == false){
                console.log("Extrinsic failed")
                console.log(extrinsicResultData.arbExecutionResult)
                let extrinsicSetResults: ExtrinsicSetResultDynamic | null = getExtrinsicSetResults()
                if(extrinsicSetResults === null){
                    throw new Error("Extrsinsic set results undefined")
                }
                return extrinsicSetResults
            }

            nextInputValue = extrinsicResultData.lastNode!.assetValue
            instructionsToExecute = remainingInstructions
        }
        swapInstructions = [];   
    } catch(e){
        // Need to properly handle this. Error should be extrinsicResultData
        console.log(e)
        let extrinsicSetResults: ExtrinsicSetResultDynamic | null = getExtrinsicSetResults()
        if(extrinsicSetResults === null){
            throw new Error("Extrsinsic set results undefined")
        }       
        printExtrinsicSetResults(extrinsicSetResults.allExtrinsicResults)
        return extrinsicSetResults
    }
    let extrinsicSetResults: ExtrinsicSetResultDynamic | null = getExtrinsicSetResults()
    if(extrinsicSetResults === null){
        throw new Error("Extrsinsic set results undefined")
    }       
    return extrinsicSetResults
}

// Don't need to execute while loop for instructionsToExecute/remainingInstructions because each set should just be one transfer, ANY CHAIN -> KUSAMA
/**
 * Build and execute a single transfer extrinsic from a TransferInstruction
 * - After building allocation instructions, execute them as singular transfers
 * 
 * @param relay 
 * @param instructionSet - Single TransferInstruction
 * @param chopsticks 
 * @param executeMovr 
 * @returns 
 */
export async function buildAndExecuteTransferExtrinsic(
    relay: Relay, 
    instructionSet: TransferInstruction, 
    chopsticks: boolean, 
    executeMovr: boolean
): Promise<SingleTransferResultData>{
    let [transferExtrinsic, remainingInstructions] = await buildTransferExtrinsicDynamic(relay, instructionSet[0], chopsticks);
    

    let transferExtrinsicResultData = await executeAndReturnExtrinsic(transferExtrinsic, chopsticks, executeMovr)
    if(transferExtrinsicResultData === undefined || !isTransferResult(transferExtrinsicResultData)){
        throw new Error('Transfer result data error')
    }

    if(transferExtrinsicResultData.success == false){
        console.log("Extrinsic failed")
        console.log(transferExtrinsicResultData.arbExecutionResult)
        return transferExtrinsicResultData
    }
    return transferExtrinsicResultData
    
}