import { ApiPromise, ApiRx } from '@polkadot/api';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { AssetNode } from './AssetNode.ts';
import { buildSwapExtrinsicDynamic, buildTransferExtrinsicDynamic, createSwapExtrinsicObject } from './extrinsicUtils.ts';
import { buildInstructionSet, buildInstructionSetTest } from './instructionUtils.ts';
import { dotNodeKeys, dotTargetNode, ksmTargetNode, kusamaNodeKeys } from './txConsts.ts';
import { AsyncFileData, ChainNonces, ExecutionState, ExtrinsicObject, ExtrinsicSetResultDynamic, IndexObject, InstructionType, JsonPathNode, LastNode, Relay, SwapInstruction, SwapProperties, TransactionState, TransferInstruction, TransferProperties } from './types.ts';
import { getArbExecutionPath, getAssetRegistry, getAssetRegistryObject, getAssetRegistryObjectBySymbol, getLatestAsyncFilesKusama, getLatestAsyncFilesPolkadot, getLatestTargetFileKusama, getLatestTargetFilePolkadot, getTotalArbResultAmount, printExtrinsicSetResults, printInstructionSet, readLogData, truncateAssetPath } from './utils.ts';
import { runAndReturnFallbackArb, runAndReturnTargetArb } from './executeArbFallback.ts';
import { allocateFundsForSwapFromRelay, buildAndExecuteSwapExtrinsic, checkAndAllocateRelayToken, confirmLastTransactionSuccess, executeAndReturnExtrinsic } from './executionUtils.ts';
import { logAllResultsDynamic, logProfits } from './logUtils.ts';
import { TNode } from '@paraspell/sdk';
import '@galacticcouncil/api-augment/basilisk';
import { closeApis, getApiForNode } from './apiUtils.ts';
import { BalanceAdapter, getRelayTokenBalances } from './balanceUtils.ts';
import { getExtrinsicSetResults, getLastNode, initializeLastGlobalState, stateSetExecutionRelay, stateSetExecutionSuccess, stateSLastFile, stateSLastNode } from './globalStateUtils.ts';
import { nodeLogger, pathLogger } from './logger.ts';


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
    let extrinsicIndex: IndexObject = {i: 0}
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
                            let [swapExtrinsicContainer, remainingInstructions] = await buildSwapExtrinsicDynamic(relay, instructionsToExecute, extrinsicIndex, chopsticks);

                            let extrinsicObj: ExtrinsicObject = await createSwapExtrinsicObject(swapExtrinsicContainer)
                            
                            let extrinsicResultData = await executeAndReturnExtrinsic(extrinsicObj, extrinsicIndex, chopsticks, executeMovr)
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
                            let [swapExtrinsicContainer, remainingInstructions] = await buildSwapExtrinsicDynamic(relay, instructionsToExecute, extrinsicIndex, chopsticks);

                            console.log("Swap Tx container assetAmountIn (Actual Value): ", swapExtrinsicContainer.assetAmountIn.toChainData())
                            console.log("Swap Tx container pathAmount (Display Value) ", swapExtrinsicContainer.pathAmount)

                            let extrinsicObj: ExtrinsicObject = {
                                type: "Swap",
                                instructionIndex: swapExtrinsicContainer.instructionIndex,
                                extrinsicIndex: swapExtrinsicContainer.extrinsicIndex,
                                swapExtrinsicContainer: swapExtrinsicContainer
                            }
                            let extrinsicResultData = await executeAndReturnExtrinsic(extrinsicObj, extrinsicIndex, chopsticks, executeMovr)
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
                        let [transferExtrinsic, remainingInstructions] = await buildTransferExtrinsicDynamic(relay, instructionsToExecute[0], extrinsicIndex, chopsticks);

                        let extrinsicObj: ExtrinsicObject = {
                            type: "Transfer",
                            instructionIndex: transferExtrinsic.instructionIndex,
                            extrinsicIndex: transferExtrinsic.extrinsicIndex,
                            transferExtrinsicContainer: transferExtrinsic
                        }
    
                        let transferExtrinsicResultData = await executeAndReturnExtrinsic(extrinsicObj, extrinsicIndex, chopsticks, executeMovr)
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
            let [extrinsicResultData, remainingInstructions] = await buildAndExecuteSwapExtrinsic(relay, instructionsToExecute, chopsticks, executeMovr, nextInputValue, extrinsicIndex)
            
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
        if(!transferExtrinsicResultData){
            throw new Error("Transfer Tx Result Data: undefined")
        }
        if(transferExtrinsicResultData.success == false){
            console.log("Extrinsic failed")
            console.log(transferExtrinsicResultData.arbExecutionResult)
            return transferExtrinsicResultData
        }
        return transferExtrinsicResultData

        // isntructionsToExecute = remainingInstructions
    // }
    
}