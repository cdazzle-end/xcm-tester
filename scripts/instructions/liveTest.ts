import fs from 'fs'
import { WsProvider, ApiPromise, Keyring, ApiRx } from '@polkadot/api'
import path from 'path';
import { cryptoWaitReady } from "@polkadot/util-crypto"
import { getAssetBySymbolOrId, getParaspellChainName, getAssetRegistryObject, readLogData, getEndpointsForChain, connectFirstApi, getAssetRegistryObjectBySymbol, watchTokenDeposit, getBalanceChange, getSigner, watchTokenBalance, printInstruction, increaseIndex, getLastSuccessfulNodeFromResultData, printExtrinsicSetResults, getLatestFileFromLatestDay, constructRoute, getLastSuccessfulNodeFromAllExtrinsics, getBalance } from './utils.ts'
import { ResultDataObject, MyAssetRegistryObject, MyAsset, AssetNodeData, InstructionType, SwapInstruction, TransferInstruction, TransferToHomeThenDestInstruction, TxDetails, TransferToHomeChainInstruction, TransferParams, TransferAwayFromHomeChainInstruction, TransferrableAssetObject, TransferTxStats, BalanceChangeStats, SwapTxStats, SwapExtrinsicContainer, ExtrinsicObject, ChainNonces, TransferExtrinsicContainer, ReverseSwapExtrinsicParams, SwapResultObject, ExtrinsicSetResult, IndexObject, ArbExecutionResult, PathNodeValues, LastNode, SingleExtrinsicResultData, SingleTransferResultData, SingleSwapResultData, ExtrinsicSetResultDynamic } from './types.ts'
import { AssetNode } from './AssetNode.ts'
import { buildInstructions, getTransferrableAssetObject } from './instructionUtils.ts';
import * as paraspell from '@paraspell/sdk';
import { arb_wallet, ksmRpc, ksmTargetNode, live_wallet_3, localRpcs, mainWalletAddress, mainWalletEthAddress, testBncNode, testNets, testZlkNode } from './txConsts.ts';
import { buildSwapExtrinsic, buildSwapExtrinsicDynamic, buildTransferExtrinsicDynamic, buildTransferExtrinsicReworked, createSwapExtrinsicObject, createTransferExtrinsicObject } from './extrinsicUtils.ts';
import { EventRecord } from "@polkadot/types/interfaces"
import { fileURLToPath } from 'url';
// import { BalanceChangeStatue } from 'src/types.ts';
import { logSwapTxStats, logSwapTxResults, logTransferTxStats, logArbExecutionResults, logInstructions, logSubmittableExtrinsics, logResultsDynamic, logAllArbAttempts, logAllResultsDynamic, logProfits } from './logUtils.ts';
import { runAndReturnFallbackArb, runArbFallback } from './executeArbFallback.ts';
import { Mangata, MangataInstance } from '@mangata-finance/sdk';
import { reverse } from 'dns';
import { buildAndExecuteSwapExtrinsic, executeAndReturnExtrinsic, executeSingleSwapExtrinsic, executeSingleSwapExtrinsicMovr, executeSingleTransferExtrinsic } from './executionUtils.ts';
// import { liveWallet3Pk } from 'scripts/swaps/movr/utils/const.ts';
import { TNode } from '@paraspell/sdk';
import { BN } from '@polkadot/util/bn/bn';
import { FixedPointNumber } from '@acala-network/sdk-core';
import { movrContractAddress, xcKarContractAddress, xcXrtContractAddress } from './../swaps/movr/utils/const.ts';
import { formatMovrTx, getMovrSwapTx, testXcTokensMoonriver } from './../swaps/movr/movrSwap.ts';
import { getBsxSwapExtrinsic, testBsxSwap } from './../swaps/bsxSwap.ts';
import '@galacticcouncil/api-augment/basilisk';

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
                            let [swapExtrinsicContainer, remainingInstructions] = await buildSwapExtrinsicDynamic(instructionsToExecute, chainNonces, extrinsicIndex, chopsticks);
                            let extrinsicObj: ExtrinsicObject = await createSwapExtrinsicObject(swapExtrinsicContainer)
                            
                            let extrinsicResultData = await executeAndReturnExtrinsic(extrinsicObj, extrinsicIndex, chopsticks, executeMovr)
                            if(extrinsicResultData.success == false){
                                console.log("Extrinsic failed")
                                console.log(extrinsicResultData.arbExecutionResult)
                                
                                
                                allExtrinsicResultData.push(extrinsicResultData)
                                printExtrinsicSetResults(allExtrinsicResultData)
                                let lastSuccessfulNode = await getLastSuccessfulNodeFromResultData(allExtrinsicResultData)
                                let extrinsicSetResults: ExtrinsicSetResultDynamic = {
                                    success: false,
                                    extrinsicData: allExtrinsicResultData,
                                    lastSuccessfulNode: lastSuccessfulNode,
                                }
                                return extrinsicSetResults
                            }

                            // MOVR swaps return undefined in test, not error just skip
                            if(!extrinsicResultData){
                                nextInputValue = 0
                                break;
                            }
                            allExtrinsicResultData.push(extrinsicResultData)
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
                            let [swapExtrinsicContainer, remainingInstructions] = await buildSwapExtrinsicDynamic(instructionsToExecute, chainNonces, extrinsicIndex, chopsticks);
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
                                let lastSuccessfulNode = await getLastSuccessfulNodeFromResultData(allExtrinsicResultData)
                                let extrinsicSetResults: ExtrinsicSetResultDynamic = {
                                    success: false,
                                    extrinsicData: allExtrinsicResultData,
                                    lastSuccessfulNode: lastSuccessfulNode,
                                }
                                return extrinsicSetResults
                            }
                            allExtrinsicResultData.push(extrinsicResultData)
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
                        let [transferExtrinsic, remainingInstructions] = await buildTransferExtrinsicDynamic(instructionsToExecute[0], extrinsicIndex, chopsticks);
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
                            let lastSuccessfulNode = await getLastSuccessfulNodeFromResultData(allExtrinsicResultData)
                            let extrinsicSetResults: ExtrinsicSetResultDynamic = {
                                success: false,
                                extrinsicData: allExtrinsicResultData,
                                lastSuccessfulNode: lastSuccessfulNode,
                            }
                            return extrinsicSetResults
                        }
                        
                        nextInputValue = Number.parseFloat(transferExtrinsicResultData.lastNode.assetValue)
                        allExtrinsicResultData.push(transferExtrinsicResultData)
                        instructionsToExecute = remainingInstructions
                    }
                    break;

            }
        }
        // Handle any remaining swap instructions at the end of the instruction set
        let instructionsToExecute = swapInstructions
        while(instructionsToExecute.length > 0 && testLoopIndex < testLoops){
            let [extrinsicResultData, remainingInstructions] = await buildAndExecuteSwapExtrinsic(instructionsToExecute, chopsticks, executeMovr, nextInputValue, chainNonces, extrinsicIndex)
            if(extrinsicResultData.success == false){
                console.log("Extrinsic failed")
                console.log(extrinsicResultData.arbExecutionResult)
                allExtrinsicResultData.push(extrinsicResultData)
                printExtrinsicSetResults(allExtrinsicResultData)
                let lastSuccessfulNode = await getLastSuccessfulNodeFromResultData(allExtrinsicResultData)
                let extrinsicSetResults: ExtrinsicSetResultDynamic = {
                    success: false,
                    extrinsicData: allExtrinsicResultData,
                    lastSuccessfulNode: lastSuccessfulNode,
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
            instructionsToExecute = remainingInstructions
        }
        swapInstructions = [];   
    } catch(e){
        // Need to properly handle this. Error should be extrinsicResultData
        console.log(e)
        printExtrinsicSetResults(allExtrinsicResultData)
        let lastSuccessfulNode = await getLastSuccessfulNodeFromResultData(allExtrinsicResultData)
        let extrinsicSetResults: ExtrinsicSetResultDynamic = {
            success: false,
            extrinsicData: allExtrinsicResultData,
            lastSuccessfulNode: lastSuccessfulNode,
        }
        return extrinsicSetResults

    }
    let lastSuccessfulNode = await getLastSuccessfulNodeFromResultData(allExtrinsicResultData)
    let extrinsicSetResults: ExtrinsicSetResultDynamic = {
        success: true,
        extrinsicData: allExtrinsicResultData,
        lastSuccessfulNode: lastSuccessfulNode,
    }
    return extrinsicSetResults;
}



// async function runDynamicArbTester(chopsticks: boolean){
//     let latestFile = getLatestFileFromLatestDay()
//     let assetPath = constructRoute(latestFile)
//     // let reverse
//     let instructionsPromise = await buildInstructionSet(assetPath)
//     let executeMovr = false
//     let testLoops = 100
//     let totalArbResults: ArbExecutionResult[] = []
//     let executionResults: ExtrinsicSetResultDynamic = await buildAndExecuteExtrinsics(instructionsPromise, chopsticks, executeMovr, testLoops)
//     executionResults.extrinsicData.forEach((extrinsicData) => {
//         totalArbResults.push(extrinsicData.arbExecutionResult)
//     })
//     logResultsDynamic(executionResults, latestFile, false)
//     console.log("Execution success: " + executionResults.success)
//     let lastNode = executionResults.lastSuccessfulNode
//     console.log(`Last Node: ${JSON.stringify(executionResults.lastSuccessfulNode)}`)
//     if(lastNode.chainId == 0){
//         console.log("Last node chain is KUSAMA. Cant find arb with that. Can just exit successfully")
//     } else {
//         let functionArgs = `${lastNode.assetKey} ${ksmTargetNode} ${lastNode.assetValue}`
//         console.log("Executing Arb Fallback with args: " + functionArgs)

//         let fallbackArbResults: ResultDataObject[] = await runAndReturnFallbackArb(functionArgs, chopsticks)

//         console.log("Fallback Arb Results: ")
//         console.log(JSON.stringify(fallbackArbResults, null, 2))

//         let assetPath: AssetNode[] = fallbackArbResults.map(result => readLogData(result))
    
//         console.log("Asset Path: ")
//         console.log(JSON.stringify(assetPath, null, 2))
    
//         let reverseInstructions = await buildInstructionSet(assetPath)
    
//         let reverseExtrinsicResult = await buildAndExecuteExtrinsics(reverseInstructions, chopsticks, executeMovr, 100)
//         logResultsDynamic(reverseExtrinsicResult, latestFile, true)

//         console.log("ORIGIN EXTRINSICS")
//         printExtrinsicSetResults(executionResults.extrinsicData)
//         console.log("REVERSE EXTRINSICS")
//         printExtrinsicSetResults(reverseExtrinsicResult.extrinsicData)
//         console.log(`Last Node: ${JSON.stringify(executionResults.lastSuccessfulNode)}`)
//         console.log(`Last Node Reverse: ${JSON.stringify(reverseExtrinsicResult.lastSuccessfulNode)}`)
//     // let arbResults = executionResults.extrinsicData.forEach((extrinsicData) => {
//     //     console.log(extrinsicData.arbExecutionResult)
//     // })
//     }
// }

async function testKarXrtPath(chopsticks: boolean, movr: boolean){
    let testRouteFilePath = path.join(__dirname, './testMovrPath.json')
    let route = constructRoute(testRouteFilePath)
    let instructions = await buildInstructionSet(route)
    let swapInstructions: SwapInstruction[] = instructions.map((instruction) => {
        return instruction as SwapInstruction
    })
    let inputSwapInstructions = [swapInstructions[1]]
    let chainNonces: ChainNonces = {
        2000: 0,
        2023: 0,
        2001: 0,
        2090: 0,
        2110: 0,
        2085: 0
    }
    let  txIndex: IndexObject = {i: 0}
    let instructionIndex: number[] = []
    let movrTx = await getMovrSwapTx(inputSwapInstructions, chopsticks)
    let swapContainer = await formatMovrTx(movrTx, inputSwapInstructions, chainNonces, txIndex, instructionIndex,chopsticks)
    console.log(JSON.stringify(swapContainer.movrBatchSwapParams, null, 2))
    let extrinsicObj: ExtrinsicObject = await createSwapExtrinsicObject(swapContainer)

    let movrTxResult = await executeSingleSwapExtrinsicMovr(extrinsicObj, txIndex, true)
    console.log(movrTxResult)
    // let testLoops = 100
    // let allExtrinsicSets: ExtrinsicSetResultDynamic[] = []
    // let executionResults: ExtrinsicSetResultDynamic = await buildAndExecuteExtrinsics(instructions, chopsticks, movr, testLoops)
    // allExtrinsicSets.push(executionResults)
    // logAllResultsDynamic(allExtrinsicSets, testRouteFilePath, true)
}

async function runDynamicArbLive(chopsticks: boolean, executeMovr: boolean){
    let small = true
    let latestFile = getLatestFileFromLatestDay(small)
    let assetPath = constructRoute(latestFile)
    let instructions = await buildInstructionSet(assetPath)
    // let executeMovr = false
    let testLoops = 100
    let allExtrinsicSets: ExtrinsicSetResultDynamic[] = []
    let executionResults: ExtrinsicSetResultDynamic = await buildAndExecuteExtrinsics(instructions, chopsticks, executeMovr, testLoops)
    // executionResults.extrinsicData = executionResults.extrinsicData.reverse()
    // logResultsDynamic(executionResults, latestFile, false)
    
    allExtrinsicSets.push(executionResults)
    logAllResultsDynamic(allExtrinsicSets, latestFile, true)
    logAllArbAttempts(allExtrinsicSets, latestFile, chopsticks)
    let arbSuccess = executionResults.success
    // let lastNode = executionResults.lastSuccessfulNode
    let lastNode = await getLastSuccessfulNodeFromAllExtrinsics(allExtrinsicSets)
    if(!lastNode){
        console.log("Last node is undefined. No extrinsics executed successfully. Exiting")
        return;
    }
    

    let arbLoops = 0
    //Rerun arb until success or last node is Kusama
    while(!arbSuccess && lastNode.chainId != 0 && arbLoops < 3){
        arbLoops += 1
        let functionArgs = `${lastNode.assetKey} ${ksmTargetNode} ${lastNode.assetValue}`
        console.log("Executing Arb Fallback with args: " + functionArgs)

        let fallbackArbResults: ResultDataObject[];
        try{
            fallbackArbResults = await runAndReturnFallbackArb(functionArgs, chopsticks)
        } catch {
            console.log("Failed to run fallback arb")
            continue;
        }
        let assetPath: AssetNode[] = fallbackArbResults.map(result => readLogData(result))
        let reverseInstructions = await buildInstructionSet(assetPath)
        let reverseExtrinsicResult = await buildAndExecuteExtrinsics(reverseInstructions, chopsticks, executeMovr, 100)
        // reverseExtrinsicResult.extrinsicData = reverseExtrinsicResult.extrinsicData.reverse()
        // logResultsDynamic(reverseExtrinsicResult, latestFile, true)

        allExtrinsicSets.push(reverseExtrinsicResult)
        logAllResultsDynamic(allExtrinsicSets, latestFile, true)
        logAllArbAttempts(allExtrinsicSets, latestFile, chopsticks)
        if(reverseExtrinsicResult.success){
            arbSuccess = true
        }
        lastNode = await getLastSuccessfulNodeFromAllExtrinsics(allExtrinsicSets)
        if(!lastNode){
            console.log("Last node undefined. ERROR: some extrinsics have executed successfully")
            throw new Error("Last node undefined. ERROR: some extrinsics have executed successfully")
        }
    }
    let arbAmountOut = await getTotalArbResultAmount()
    logAllResultsDynamic(allExtrinsicSets, latestFile, true)
    logAllArbAttempts(allExtrinsicSets, latestFile, chopsticks)
    await logProfits(arbAmountOut, latestFile, chopsticks )
    
    console.log(`Result for latest file ${latestFile}: ${arbSuccess}`)
    console.log(`Total Arb Amount Out: ${arbAmountOut}`)
}
async function logProfitTest(){

    let testDay = "testDay35"
    let testAmount = 1.145
    let profitLogDatabase = {}
    profitLogDatabase[testDay] = testAmount
    console.log("PROFIT LOG DATABASE")
    console.log(profitLogDatabase)

    let profitFilePath = path.join(__dirname, './liveSwapExecutionStats', 'profitStats.json')
    profitLogDatabase = JSON.parse(fs.readFileSync(profitFilePath, 'utf8'))
    profitLogDatabase[testDay] = testAmount
    fs.writeFileSync(profitFilePath, JSON.stringify(profitLogDatabase, null, 2))

}
async function testFallback(){
    let functionArgs = `${testBncNode} ${ksmTargetNode} 10`
    console.log("Calling arb fallback function")
    let fallbackArbResults = await runAndReturnFallbackArb(functionArgs, true)

}

// How much profit we got for latest arb
async function getTotalArbResultAmount(){
    let latestFilePath = path.join(__dirname, './latestAttempt/arbExecutionResults.json')
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

async function testMovrWallet(){
    // const movrRpc = 'wss://moonriver.api.onfinality.io/public-ws'
    // const provider = new WsProvider(movrRpc)
    // const api = await ApiPromise.create({ provider })
    // await api.isReady
    // await cryptoWaitReady()

    // let keyring = new Keyring({ type: 'sr25519' });
    // let walletKey = liveWallet3Pk
    // let liveWallet = keyring.addFromMnemonic(walletKey)

    let liveWallet = await getSigner(false, true)

    console.log("Live Wallet: " + JSON.stringify(liveWallet.address, null, 2))

    // let recipientAddress = mainWalletEthAddress
    // let transferAmount = 10n ** 10n // 0.01 KSM

    // let transferTx = api.tx.balances.transferKeepAlive(recipientAddress, transferAmount)
    // let txReceipt = await transferTx.signAndSend(liveWallet, ({ events = [], status }) => {
    //     if (status.isInBlock) {
    //         console.log('Successful transfer of ' + transferAmount + ' with hash ' + status.asInBlock.toHex());
    //         // console.log('Events:', JSON.stringify(events.toHuman(), null, 2));
    //     }
    // });
    // console.log("Tx Receipt: " + JSON.stringify(txReceipt, null, 2))
}

async function testEndpoints(node: TNode | "Kusama", chopsticks: boolean){
    let apiEndpoint: string[];
    if(node == "Kusama"){
        apiEndpoint = [ksmRpc]
        // throw new Error("Trying to transfer kusama away from home chain to kusama")
    } else{
        apiEndpoint = paraspell.getAllNodeProviders(node)
    }
    
    // -- But initialize test endpoints until real
    if(chopsticks){
        let localRpc = localRpcs[node]
        if(localRpc){
            apiEndpoint = localRpc
        }
    }

    let api: ApiPromise;
    // if(node == "Mangata"){
    //     const MangataSDK = await import('@mangata-finance/sdk')
    //     api = await MangataSDK.Mangata.instance([apiEndpoint[1]]).api()
    // } else {
    //     let provider = new WsProvider(apiEndpoint)
    //     api = await ApiPromise.create({ provider: provider });
    // }
    let apiSet = await connectFirstApi(apiEndpoint, 2110)
    api = apiSet.promise
    await api.isReady
    return api
}

async function testMovrTx(){
    // let wallet = await getSigner(true, true)
    // const index = 0;
    // let ethDerPath = `m/44'/60'/0'/0/${index}`;
    // let keyring = new Keyring({ type: 'ethereum' });
    // // let wallet = keyring.addFromUri(`${live_wallet_3}/${ethDerPath}`);
    // // console.log(live_wallet_3)
    // let wallet = keyring.addFromUri(`${live_wallet_3}`);
    let wallet = await getSigner(false, true)
    let recipientAddress = mainWalletAddress
    // let amount = 10n ** 17n // 0.1 MOVR

    let assetSymbol = "MOVR"
    let localrpc = localRpcs["Moonriver"]
    let movrApiEndpoints = paraspell.getAllNodeProviders("Moonriver")
    let provider = new WsProvider(movrApiEndpoints[0])
    let api = await ApiPromise.create({ provider: provider });
    await api.isReady

    let fromChain: TNode = "Moonriver"
    let toChain: TNode = "ParallelHeiko"
    let assetSymbolOrId = getAssetBySymbolOrId(fromChain, "MOVR")
    console.log("Asset Symbol or Id: ")
    console.log(assetSymbolOrId)
    if(!assetSymbolOrId){
        throw new Error("Cant find asset symbol or id")
    }
    let currencyParameter = assetSymbolOrId.assetId ?? assetSymbolOrId.symbol

    let decimals = paraspell.getAssetDecimals(fromChain, assetSymbol);
    let amount = new FixedPointNumber(0.01, Number(decimals));

    let address = wallet.address
    console.log("Address: " + address)
    const xcmTx = paraspell.Builder(api).from(fromChain).to(toChain).currency(currencyParameter).amount(amount.toChainData()).address(recipientAddress).build()

    let unsubscribeOne
    let balanceObservable$ = await watchTokenBalance(2023, false, api, "XCKAR", "Moonriver", wallet.address)
    // let balanceChage = await getBalanceChange(balanceObservable$)
    let balancePromise = await getBalanceChange(balanceObservable$, (unsub) => {
        unsubscribeOne = unsub
    })

    let tokenBalanceChange = await balancePromise
    console.log("Balance Change: " + JSON.stringify(tokenBalanceChange, null, 2))
    // let txResult: any= new Promise((resolve, reject) => {
    //     let success = false;
    //     let included: EventRecord[] = [];
    //     let finalized: EventRecord[] = [];
    //     let eventLogs: any[] = [];
    //     let blockHash: string = "";
    //     let dispatchErrorCode;
    //     let decodedError;
    //     console.log(`Execute Transfer: Sending tx -- ${JSON.stringify(xcmTx.toHuman())}`)
    //     xcmTx.signAndSend(wallet, ({ events = [], status, txHash, txIndex, dispatchError }) => {
    //         if (status.isInBlock) {
    //             success = dispatchError ? false : true;
    //             console.log(
    //                 `Execute Transfer: 📀 Transaction ${xcmTx.meta.name}(..) included at blockHash ${status.asInBlock} [success = ${success}]`
    //             );
    //             included = [...events];

    //         } else if (status.isBroadcast) {
    //             console.log(`Execute Transfer: 🚀 Transaction broadcasted.`);
    //         } else if (status.isFinalized) {
    //             console.log(
    //                 `Execute Transfer: 💯 Transaction ${xcmTx.meta.name}(..) Finalized at blockHash ${status.asFinalized}`
    //             );
    //             blockHash = status.asFinalized.toString();
    //             finalized = [...events];
    //             events.forEach((eventObj) => {
    //                 eventLogs.push(eventObj.toHuman())
    //                 if(eventObj.event.method == "ExtrinsicFailed" && dispatchError){
    //                     const {index, error} = dispatchError.asModule;
    //                     const moduleIndex = parseInt(index.toString(), 10);
    //                     const errorCodeHex = error.toString().substring(2, 4); // "09"
    //                     const errorIndex = parseInt(errorCodeHex, 16);

    //                     // Get the module and error metadata
    //                     decodedError = xcmTx.registry.findMetaError({index: new BN(moduleIndex), error: new BN(errorIndex)});
    //                     dispatchErrorCode = dispatchError.asModule;
    //                     console.log("Execute Transfer: Dispatch Error: " + dispatchError.toString())
    //                     console.log("Execute Transfer: DECODED MODULE: " + JSON.stringify(decodedError, null, 2))
    //                 }
    //             })
    //             const hash = status.hash;
    //             let txDetails: TxDetails = { success, hash, dispatchError: dispatchErrorCode, decodedError, included, finalized, eventLogs, blockHash, txHash, txIndex };
    //             resolve(txDetails);
    //         } else if (status.isReady) {
    //             // let's not be too noisy..
    //             console.log("Execute Transfer: Status: Ready")
    //         } else if (dispatchError){
    //             console.log("Execute Transfer: Dispatch error: " + dispatchError.toString())
    //             if(dispatchError.isModule){
    //                 const decoded = xcmTx.registry.findMetaError(dispatchError.asModule);
    //                 console.log("Execute Transfer: DISPATCH ERROR DECODED: " + JSON.stringify(decoded, null, 2))
    //                 const { docs, name, section } = decoded;
    //                 reject(new Error(`${section}.${name}: ${docs.join(' ')}`));
    //             } else {
    //                 reject(new Error(dispatchError.toString()));
    //             }
    //         }
    //         else {
    //             console.log(`Execute Transfer: 🤷 Other status ${status}`);
    //         }
    //     }).catch((error) => {
    //         console.log("Execute Transfer: Error: " + error);
    //         reject(error);
    //     });
    // });
    // let hash = await txResult
    // console.log("Tx Result: " + JSON.stringify(hash, null, 2))
}
async function testBsxTx(){
    let testRouteFilePath = path.join(__dirname, './testBsxPath.json')
    let route = constructRoute(testRouteFilePath)
    let instructions = await buildInstructionSet(route)
    let swapInstructions: SwapInstruction[] = instructions.map((instruction) => {
        return instruction as SwapInstruction
    })
    let inputSwapInstructions = [swapInstructions[1]]
    let chainNonces: ChainNonces = {
        2000: 0,
        2023: 0,
        2001: 0,
        2090: 0,
        2110: 0,
        2085: 0
    }
    let  txIndex: IndexObject = {i: 0}
    let instructionIndex: number[] = []
    let bsxTx = await testBsxSwap(swapInstructions, true)
    console.log(bsxTx.toHuman())
}
async function testZlkFallback(){
    let functionArgs = `${testZlkNode} ${ksmTargetNode} 10`
    console.log("Calling arb fallback function")
    let fallbackArbResults = await runAndReturnFallbackArb(functionArgs, false)

    console.log("Fallback Arb Results: ")
    console.log(JSON.stringify(fallbackArbResults, null, 2))

}
async function testMovrBatchSwap(){
    let tokenPath = [xcKarContractAddress, movrContractAddress, xcXrtContractAddress ]
    await testXcTokensMoonriver(tokenPath, 0.3, 50)
}
async function testBalance(){
    let apiEndpoints = getEndpointsForChain(2000)
    let provider = new WsProvider(apiEndpoints[0])
    const api = await ApiPromise.create({ provider: provider });
    await api.isReady

    let wallet = await getSigner(false, false)

    let balance = await getBalance(2000, false, api, "KAR", "Karura", wallet.address)
    console.log("Balance: " + JSON.stringify(balance, null, 2))
}
async function run() {
    // await testDotWallet()
//     let chopsticks = true
//     await runArbTester(chopsticks)
    // // await testArbFallback()
    // await testBalance()
    // await testBsxTx()
    let chopsticks = false
    let executeMovr = true
    await runDynamicArbLive(chopsticks, executeMovr)
    // await testZlkFallback()
    // await testKarXrtPath(false, false)
    // await logProfitTest()
    // await testMovrTx()
    // let api = await testEndpoints("Mangata", false)
    
    // await testMovrBatchSwap()

    // console.log(JSON.stringify(api.consts, null, 2))
    // await testFallback()
    // await testMovrWallet()
    process.exit(0)
}

run()

function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
