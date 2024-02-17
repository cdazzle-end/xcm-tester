import fs from 'fs'
import { WsProvider, ApiPromise, Keyring, ApiRx } from '@polkadot/api'
import path from 'path';
import { cryptoWaitReady } from "@polkadot/util-crypto"
import { getAssetBySymbolOrId, getParaspellChainName, getAssetRegistryObject, readLogData, getEndpointsForChain, connectFirstApi, getAssetRegistryObjectBySymbol, watchTokenDeposit, getBalanceChange, getSigner, watchTokenBalance, printInstruction, increaseIndex, getLastNodeFromResultData, printExtrinsicSetResults, getLatestFileFromLatestDay, constructRoute } from './utils.ts'
import { ResultDataObject, MyAssetRegistryObject, MyAsset, AssetNodeData, InstructionType, SwapInstruction, TransferInstruction, TransferToHomeThenDestInstruction, TxDetails, TransferToHomeChainInstruction, TransferParams, TransferAwayFromHomeChainInstruction, TransferrableAssetObject, TransferTxStats, BalanceChangeStats, SwapTxStats, SwapExtrinsicContainer, ExtrinsicObject, ChainNonces, TransferExtrinsicContainer, ReverseSwapExtrinsicParams, SwapResultObject, ExtrinsicSetResult, IndexObject, ArbExecutionResult, PathNodeValues, LastNode, SingleExtrinsicResultData, SingleTransferResultData, SingleSwapResultData, ExtrinsicSetResultDynamic } from './types.ts'
import { AssetNode } from './AssetNode.ts'
import { buildInstructions, getTransferrableAssetObject } from './instructionUtils.ts';

import { arb_wallet, ksmTargetNode, localRpcs, mainWalletAddress, testNets } from './txConsts.ts';
import { buildSwapExtrinsic, buildSwapExtrinsicDynamic, buildTransferExtrinsicDynamic, buildTransferExtrinsicReworked, createTransferExtrinsicObject } from './extrinsicUtils.ts';

import { fileURLToPath } from 'url';
import { BalanceChangeStatue } from 'src/types.ts';
import { logSwapTxStats, logSwapTxResults, logTransferTxStats, logArbExecutionResults, logInstructions, logSubmittableExtrinsics, logResultsDynamic, logAllArbAttempts } from './logUtils.ts';
import { runAndReturnFallbackArb, runArbFallback } from './executeArbFallback.ts';
import { Mangata, MangataInstance } from '@mangata-finance/sdk';
import { reverse } from 'dns';
import { executeSingleSwapExtrinsic, executeSingleSwapExtrinsicMovr, executeSingleTransferExtrinsic } from './executionUtils.ts';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const allConnectionPromises = new Map<string, Promise<ApiPromise>>();
export const allConnections = new Map<string, ApiPromise>();
export let promiseApis: Record<number, ApiPromise> = {};
export let observableApis: Record<number, ApiRx> = {};
const aliceAddress = "HNZata7iMYWmk5RvZRTiAsSDhV8366zq2YGb3tLH5Upf74F"

// const mgxRpc = 'wss://kusama-rpc.mangata.online'
const dazzleMgxAddres = '5G22cv9fT5RNVm2AV4MKgagmKH9aoZL4289UDcYrToP9K6hQ'
const aliceErc20 = "0xf24FF3a9CF04c71Dbc94D0b566f7A27B94566cac"

// Build instructions from arb result log
async function buildInstructionSet(assetPath: AssetNode[]) {
    let instructions: (SwapInstruction | TransferInstruction)[] = [];
    let instructionIndex: IndexObject = {i: 0}
    for (let i = 0; i < assetPath.length - 1; i++) {
        let assetNodes = [assetPath[i], assetPath[i + 1]]
        let newInstructions = buildInstructions(assetNodes, instructionIndex)
        newInstructions.forEach((instruction) => {
            instructions.push(instruction)
        })
    }
    return instructions
}

// Use instructions to build and execute tx's one by one. Main execution flow happens here
async function buildAndExecuteExtrinsics(instructionSet: (SwapInstruction | TransferInstruction)[], chopsticks: boolean, executeMovr: boolean, testLoops: number): Promise<ExtrinsicSetResultDynamic> {
    let swapInstructions: SwapInstruction[] = [];
    let extrinsicIndex: IndexObject = {i: 0}
    let allExtrinsicResultData: (SingleSwapResultData | SingleTransferResultData) [] = [];
    let chainNonces: ChainNonces = {
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
            if(testLoopIndex > testLoops){
                break;
            }
            testLoopIndex += 1;
            switch (instruction.type) {
                case InstructionType.Swap:
                    //If MOVR, SKIP and set next to 0
                    if(chopsticks == true && instruction.assetNodes[0].getChainId() == 2023){
                        nextInputValue = 0
                        break;
                    }
                    // If swap is of the same type, accumulate
                    if(swapInstructions.length == 0 || swapInstructions[swapInstructions.length - 1].pathType == instruction.pathType){
                        swapInstructions.push(instruction);
                    } else {
                        // If swap is of a different type, build extrinsic for the so far accumulated swap instructions
                        if(nextInputValue > 0){
                            swapInstructions[0].assetNodes[0].pathValue = nextInputValue
                        }

                        let [swapExtrinsicContainer, remainingInstructions] = await buildSwapExtrinsicDynamic(swapInstructions, chainNonces, extrinsicIndex, chopsticks);
                        let extrinsicObj: ExtrinsicObject = {
                            type: "Swap",
                            instructionIndex: swapExtrinsicContainer.instructionIndex,
                            extrinsicIndex: swapExtrinsicContainer.extrinsicIndex,
                            swapExtrinsicContainer: swapExtrinsicContainer
                        }
                        
                        let extrinsicResultData = await executeAndReturnExtrinsic(extrinsicObj, extrinsicIndex, chopsticks, executeMovr)
                        if(extrinsicResultData.success == false){
                            console.log("Extrinsic failed")
                            console.log(extrinsicResultData.arbExecutionResult)
                            printExtrinsicSetResults(allExtrinsicResultData)
                            let lastNode = await getLastNodeFromResultData(allExtrinsicResultData)
                            let extrinsicSetResults: ExtrinsicSetResultDynamic = {
                                success: false,
                                extrinsicData: allExtrinsicResultData,
                                lastSuccessfulNode: lastNode,
                            }
                            return extrinsicSetResults
                        }

                        // If undefined, not error just skip
                        if(!extrinsicResultData){
                            nextInputValue = 0
                            break;
                        }

                        allExtrinsicResultData.push(extrinsicResultData)
                        nextInputValue = Number.parseFloat(extrinsicResultData.lastNode.assetValue)
                        while(remainingInstructions.length > 0){
                            remainingInstructions[0].assetNodes[0].pathValue = nextInputValue
                            let [nextSwapContainer, furtherRemainingInstructions] = await buildSwapExtrinsicDynamic(remainingInstructions, chainNonces, extrinsicIndex, chopsticks);
                            let nextExtrinsicObj: ExtrinsicObject = {
                                type: "Swap",
                                instructionIndex: nextSwapContainer.instructionIndex,
                                extrinsicIndex: nextSwapContainer.extrinsicIndex,
                                swapExtrinsicContainer: nextSwapContainer
                            }

                            let nextExtrinsicResultData = await executeAndReturnExtrinsic(nextExtrinsicObj, extrinsicIndex, chopsticks, executeMovr)
                            if(nextExtrinsicResultData.success == false){
                                console.log("Extrinsic failed")
                                console.log(nextExtrinsicResultData.arbExecutionResult)
                                printExtrinsicSetResults(allExtrinsicResultData)
                                let lastNode = await getLastNodeFromResultData(allExtrinsicResultData)
                                let extrinsicSetResults: ExtrinsicSetResultDynamic = {
                                    success: false,
                                    extrinsicData: allExtrinsicResultData,
                                    lastSuccessfulNode: lastNode,
                                }
                                return extrinsicSetResults
                            }
                            allExtrinsicResultData.push(nextExtrinsicResultData)
                            nextInputValue = Number.parseFloat(nextExtrinsicResultData.lastNode.assetValue)

                            remainingInstructions = furtherRemainingInstructions
                        }
                        swapInstructions = [instruction];
                    }
                    break;
                default:
                    // For other types of instructions
                    if (swapInstructions.length > 0) {
                        if( nextInputValue > 0){
                            swapInstructions[0].assetNodes[0].pathValue = nextInputValue
                        }
                        let [swapExtrinsicContainer, remainingInstructions] = await buildSwapExtrinsicDynamic(swapInstructions, chainNonces, extrinsicIndex, chopsticks);
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
                            printExtrinsicSetResults(allExtrinsicResultData)
                            let lastNode = await getLastNodeFromResultData(allExtrinsicResultData)
                            let extrinsicSetResults: ExtrinsicSetResultDynamic = {
                                success: false,
                                extrinsicData: allExtrinsicResultData,
                                lastSuccessfulNode: lastNode,
                            }
                            return extrinsicSetResults
                        }
                        allExtrinsicResultData.push(extrinsicResultData)
                        nextInputValue = Number.parseFloat(extrinsicResultData.lastNode.assetValue)
                        while(remainingInstructions.length > 0){
                            remainingInstructions[0].assetNodes[0].pathValue = nextInputValue
                            let [nextSwapContainer, furtherRemainingInstructions] = await buildSwapExtrinsicDynamic(remainingInstructions, chainNonces, extrinsicIndex, chopsticks);
                            let nextExtrinsicObj: ExtrinsicObject = {
                                type: "Swap",
                                instructionIndex: nextSwapContainer.instructionIndex,
                                extrinsicIndex: nextSwapContainer.extrinsicIndex,
                                swapExtrinsicContainer: nextSwapContainer
                            }

                            let nextExtrinsicResultData = await executeAndReturnExtrinsic(nextExtrinsicObj, extrinsicIndex, chopsticks, executeMovr)
                            if(nextExtrinsicResultData.success == false){
                                console.log("Extrinsic failed")
                                console.log(nextExtrinsicResultData.arbExecutionResult)
                                printExtrinsicSetResults(allExtrinsicResultData)
                                let lastNode = await getLastNodeFromResultData(allExtrinsicResultData)
                                let extrinsicSetResults: ExtrinsicSetResultDynamic = {
                                    success: false,
                                    extrinsicData: allExtrinsicResultData,
                                    lastSuccessfulNode: lastNode,
                                }
                                return extrinsicSetResults
                            }
                            allExtrinsicResultData.push(nextExtrinsicResultData)
                            nextInputValue = Number.parseFloat(nextExtrinsicResultData.lastNode.assetValue)

                            remainingInstructions = furtherRemainingInstructions
                        }

                        swapInstructions = [];   
                    }
                    // Handle other types of instructions (e.g., TransferToHomeChain)
                    // Add the extrinsic for the current instruction (if needed)
                    if(nextInputValue > 0){
                        instruction.assetNodes[0].pathValue = nextInputValue
                    }
                    let [transferExtrinsic, remainingInstructions] = await buildTransferExtrinsicDynamic(instruction, extrinsicIndex, chopsticks);
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
                        printExtrinsicSetResults(allExtrinsicResultData)
                        let lastNode = await getLastNodeFromResultData(allExtrinsicResultData)
                        let extrinsicSetResults: ExtrinsicSetResultDynamic = {
                            success: false,
                            extrinsicData: allExtrinsicResultData,
                            lastSuccessfulNode: lastNode,
                        }
                        return extrinsicSetResults
                    }
                    // If undefined, not error just skip
                    if(!transferExtrinsicResultData){
                        nextInputValue = 0
                        break;
                    }
                    nextInputValue = Number.parseFloat(transferExtrinsicResultData.lastNode.assetValue)
                    allExtrinsicResultData.push(transferExtrinsicResultData)

                    // Max transfer is two instructions
                    if(remainingInstructions.length > 0){
                        // Set input transfer amount to the output of the previous transfer
                        if(nextInputValue > 0){
                            remainingInstructions[0].assetNodes[0].pathValue = nextInputValue
                        }
                        let [transferExtrinsic, other] = await buildTransferExtrinsicDynamic(remainingInstructions[0], extrinsicIndex, chopsticks);
                        let extrinsicObj: ExtrinsicObject = await createTransferExtrinsicObject(transferExtrinsic)
                        let transferExtrinsicResultData = await executeAndReturnExtrinsic(extrinsicObj, extrinsicIndex, chopsticks, executeMovr)
                        if(transferExtrinsicResultData.success == false){
                            console.log("Extrinsic failed")
                            console.log(transferExtrinsicResultData.arbExecutionResult)
                            printExtrinsicSetResults(allExtrinsicResultData)
                            let lastNode = await getLastNodeFromResultData(allExtrinsicResultData)
                            let extrinsicSetResults: ExtrinsicSetResultDynamic = {
                                success: false,
                                extrinsicData: allExtrinsicResultData,
                                lastSuccessfulNode: lastNode,
                            }
                            return extrinsicSetResults
                        }
                        nextInputValue = Number.parseFloat(transferExtrinsicResultData.lastNode.assetValue)
                        allExtrinsicResultData.push(transferExtrinsicResultData)

                    }
                    // extrinsicSet.push(transferExtrinsic);
                    break;

            }
        }
        // Handle any remaining swap instructions at the end of the instruction set
        if (swapInstructions.length > 0 && testLoopIndex < testLoops) {
            if( nextInputValue > 0){
                swapInstructions[0].assetNodes[0].pathValue = nextInputValue
            }
            let [swapExtrinsicContainer, remainingInstructions] = await buildSwapExtrinsicDynamic(swapInstructions, chainNonces, extrinsicIndex, chopsticks);
            let extrinsicObj: ExtrinsicObject = {
                type: "Swap",
                instructionIndex: swapExtrinsicContainer.instructionIndex,
                extrinsicIndex: swapExtrinsicContainer.extrinsicIndex,
                swapExtrinsicContainer: swapExtrinsicContainer
            }
            let extrinsicResultData = await executeAndReturnExtrinsic(extrinsicObj, extrinsicIndex, chopsticks, executeMovr)
            if(extrinsicResultData.success == false){
                console.log("Extrinsic failed")
                console.log(extrinsicResultData.arbExecutionResult)
                printExtrinsicSetResults(allExtrinsicResultData)
                let lastNode = await getLastNodeFromResultData(allExtrinsicResultData)
                let extrinsicSetResults: ExtrinsicSetResultDynamic = {
                    success: false,
                    extrinsicData: allExtrinsicResultData,
                    lastSuccessfulNode: lastNode,
                }
                return extrinsicSetResults
            }
            if(!extrinsicResultData){
                nextInputValue = 0
            } else {
                allExtrinsicResultData.push(extrinsicResultData)
                nextInputValue = Number.parseFloat(extrinsicResultData.lastNode.assetValue)
                while(remainingInstructions.length > 0){
                    remainingInstructions[0].assetNodes[0].pathValue = nextInputValue
                    let [nextSwapContainer, furtherRemainingInstructions] = await buildSwapExtrinsicDynamic(remainingInstructions, chainNonces, extrinsicIndex, chopsticks);
                    let nextExtrinsicObj: ExtrinsicObject = {
                        type: "Swap",
                        instructionIndex: nextSwapContainer.instructionIndex,
                        extrinsicIndex: nextSwapContainer.extrinsicIndex,
                        swapExtrinsicContainer: nextSwapContainer
                    }
    
                    let nextExtrinsicResultData = await executeAndReturnExtrinsic(nextExtrinsicObj, extrinsicIndex, chopsticks, executeMovr)
                    if(nextExtrinsicResultData.success == false){
                        console.log("Extrinsic failed")
                        console.log(nextExtrinsicResultData.arbExecutionResult)
                        printExtrinsicSetResults(allExtrinsicResultData)
                        let lastNode = await getLastNodeFromResultData(allExtrinsicResultData)
                        let extrinsicSetResults: ExtrinsicSetResultDynamic = {
                            success: false,
                            extrinsicData: allExtrinsicResultData,
                            lastSuccessfulNode: lastNode,
                        }
                        return extrinsicSetResults
                    }
                    allExtrinsicResultData.push(nextExtrinsicResultData)
                    nextInputValue = Number.parseFloat(nextExtrinsicResultData.lastNode.assetValue)
    
                    remainingInstructions = furtherRemainingInstructions
                }
            }
            swapInstructions = [];   
        }
    } catch(e){
        console.log(e)
        printExtrinsicSetResults(allExtrinsicResultData)
        let lastNode = await getLastNodeFromResultData(allExtrinsicResultData)
        let extrinsicSetResults: ExtrinsicSetResultDynamic = {
            success: false,
            extrinsicData: allExtrinsicResultData,
            lastSuccessfulNode: lastNode,
        }
        return extrinsicSetResults

    }
    let lastNode = await getLastNodeFromResultData(allExtrinsicResultData)
    let extrinsicSetResults: ExtrinsicSetResultDynamic = {
        success: true,
        extrinsicData: allExtrinsicResultData,
        lastSuccessfulNode: lastNode,
    }
    return extrinsicSetResults;
}

// Handle different extrinsic types
async function executeAndReturnExtrinsic(extrinsicObj: ExtrinsicObject, extrinsicIndex: IndexObject, chopsticks: boolean, executeMovr: boolean = false) {
    // let executeMovr = false
    try {
        if (extrinsicObj.type == "Transfer"){
            let transferExtrinsicResults: SingleTransferResultData = await executeSingleTransferExtrinsic(extrinsicObj, extrinsicIndex, chopsticks)
            return transferExtrinsicResults
        } else if (extrinsicObj.type == "Swap" && extrinsicObj.swapExtrinsicContainer.chainId != 2023){
            let swapExtrinsicResults: SingleSwapResultData = await executeSingleSwapExtrinsic(extrinsicObj, extrinsicIndex, chopsticks);
            return swapExtrinsicResults
        } else if (extrinsicObj.type == "Swap" && extrinsicObj.swapExtrinsicContainer.chainId == 2023 && executeMovr == true){
            let swapExtrinsicResults: SingleSwapResultData = await executeSingleSwapExtrinsicMovr(extrinsicObj, extrinsicIndex, chopsticks);
            return swapExtrinsicResults
        }
    } catch (e) {
        console.log(e)
        throw new Error("Extrinsic Execution failed")
    }
}

async function runDynamicArbTester(chopsticks: boolean){
    let latestFile = getLatestFileFromLatestDay()
    let assetPath = constructRoute(latestFile)
    // let reverse
    let instructionsPromise = await buildInstructionSet(assetPath)
    let executeMovr = false
    let testLoops = 100
    let totalArbResults: ArbExecutionResult[] = []
    let executionResults: ExtrinsicSetResultDynamic = await buildAndExecuteExtrinsics(instructionsPromise, chopsticks, executeMovr, testLoops)
    executionResults.extrinsicData.forEach((extrinsicData) => {
        totalArbResults.push(extrinsicData.arbExecutionResult)
    })
    logResultsDynamic(executionResults, latestFile, false)
    console.log("Execution success: " + executionResults.success)
    let lastNode = executionResults.lastSuccessfulNode
    console.log(`Last Node: ${JSON.stringify(executionResults.lastSuccessfulNode)}`)
    if(lastNode.chainId == 0){
        console.log("Last node chain is KUSAMA. Cant find arb with that. Can just exit successfully")
    } else {
        let functionArgs = `${lastNode.assetKey} ${ksmTargetNode} ${lastNode.assetValue}`
        console.log("Executing Arb Fallback with args: " + functionArgs)

        let fallbackArbResults: ResultDataObject[] = await runAndReturnFallbackArb(functionArgs, chopsticks)

        console.log("Fallback Arb Results: ")
        console.log(JSON.stringify(fallbackArbResults, null, 2))

        let assetPath: AssetNode[] = fallbackArbResults.map(result => readLogData(result))
    
        console.log("Asset Path: ")
        console.log(JSON.stringify(assetPath, null, 2))
    
        let reverseInstructions = await buildInstructionSet(assetPath)
    
        let reverseExtrinsicResult = await buildAndExecuteExtrinsics(reverseInstructions, chopsticks, executeMovr, 100)
        logResultsDynamic(reverseExtrinsicResult, latestFile, true)

        console.log("ORIGIN EXTRINSICS")
        printExtrinsicSetResults(executionResults.extrinsicData)
        console.log("REVERSE EXTRINSICS")
        printExtrinsicSetResults(reverseExtrinsicResult.extrinsicData)
        console.log(`Last Node: ${JSON.stringify(executionResults.lastSuccessfulNode)}`)
        console.log(`Last Node Reverse: ${JSON.stringify(reverseExtrinsicResult.lastSuccessfulNode)}`)
    // let arbResults = executionResults.extrinsicData.forEach((extrinsicData) => {
    //     console.log(extrinsicData.arbExecutionResult)
    // })
    }
}

async function runDynamicArbLive(chopsticks: boolean){

    let latestFile = getLatestFileFromLatestDay()
    let assetPath = constructRoute(latestFile)
    let instructions = await buildInstructionSet(assetPath)
    let executeMovr = false
    let testLoops = 100
    let allExtrinsicSets: ExtrinsicSetResultDynamic[] = []
    let executionResults: ExtrinsicSetResultDynamic = await buildAndExecuteExtrinsics(instructions, chopsticks, executeMovr, testLoops)
    logResultsDynamic(executionResults, latestFile, false)
    allExtrinsicSets.push(executionResults)
    let arbSuccess = executionResults.success
    let lastNode = executionResults.lastSuccessfulNode

    let arbLoops = 0
    //Rerun arb until success or last node is Kusama
    while(!arbSuccess && lastNode.chainId != 0 && arbLoops < 3){
        let functionArgs = `${lastNode.assetKey} ${ksmTargetNode} ${lastNode.assetValue}`
        console.log("Executing Arb Fallback with args: " + functionArgs)

        let fallbackArbResults: ResultDataObject[] = await runAndReturnFallbackArb(functionArgs, chopsticks)
        let assetPath: AssetNode[] = fallbackArbResults.map(result => readLogData(result))
        let reverseInstructions = await buildInstructionSet(assetPath)
        let reverseExtrinsicResult = await buildAndExecuteExtrinsics(reverseInstructions, chopsticks, executeMovr, 100)
        logResultsDynamic(reverseExtrinsicResult, latestFile, true)
        allExtrinsicSets.push(reverseExtrinsicResult)
        if(reverseExtrinsicResult.success){
            arbSuccess = true
            lastNode = reverseExtrinsicResult.lastSuccessfulNode
        }
    }
    logAllArbAttempts(allExtrinsicSets, latestFile, chopsticks)
    let arbAmountOut = await getTotalArbResultAmount()
    console.log(`Result for latest file ${latestFile}: ${arbSuccess}`)
    console.log(`Total Arb Amount Out: ${arbAmountOut}`)
}

// How much profit we got for latest arb
async function getTotalArbResultAmount(){
    let latestFilePath = path.join(__dirname, './latestAttempt/latestAttempt.json')
    let latestArbResults: ArbExecutionResult[] = JSON.parse(fs.readFileSync(latestFilePath, 'utf8'))
    let assetOut = latestArbResults[latestArbResults.length - 1].assetSymbolOut
    let arbAmountOut = 0;
    let arbAmountIn = latestArbResults[0].assetAmountIn;
    if(assetOut == "KSM"){
        arbAmountOut = latestArbResults[latestArbResults.length - 1].assetAmountOut - arbAmountIn
    }

    return arbAmountOut
    
}


async function testDotWallet(){
    
    const ksmRpc = 'wss://kusama-rpc.dwellir.com'
    const provider = new WsProvider(ksmRpc)
    const api = await ApiPromise.create({ provider })
    await api.isReady
    await cryptoWaitReady()

    let keyring = new Keyring({ type: 'sr25519' });
    let walletKey = arb_wallet
    let liveWallet = keyring.addFromMnemonic(walletKey)


    let recipientAddress = mainWalletAddress
    let transferAmount = 10n ** 10n // 0.01 KSM

    let transferTx = api.tx.balances.transferKeepAlive(recipientAddress, transferAmount)
    let txReceipt = await transferTx.signAndSend(liveWallet, ({ events = [], status }) => {
        if (status.isInBlock) {
            console.log('Successful transfer of ' + transferAmount + ' with hash ' + status.asInBlock.toHex());
            // console.log('Events:', JSON.stringify(events.toHuman(), null, 2));
        }
    });
}

async function run() {
    // await testDotWallet()
//     let chopsticks = true
//     await runArbTester(chopsticks)
    // await testArbFallback()
    await runDynamicArbLive(true)
    process.exit(0)
}

run()

function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
