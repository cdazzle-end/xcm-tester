import fs from 'fs'
import { WsProvider, ApiPromise, Keyring, ApiRx } from '@polkadot/api'
import path from 'path';
import { cryptoWaitReady } from "@polkadot/util-crypto"
import { getAssetBySymbolOrId, getParaspellChainName, getAssetRegistryObject, readLogData, getAssetRegistryObjectBySymbol, watchTokenDeposit, getBalanceChange, getSigner, watchTokenBalance, printInstruction, increaseIndex, getLastSuccessfulNodeFromResultData, printExtrinsicSetResults, getLatestFileFromLatestDay, constructRoute, getLastSuccessfulNodeFromAllExtrinsics, getBalance, setLastFile, getLastExecutionState, getKsmBalancesAcrossChains, getNodeFromChainId, getTotalArbResultAmount, getLatestTargetFile, setLastExtrinsicSet, setLastNode } from './utils.ts'
import { ResultDataObject, MyAssetRegistryObject, MyAsset, AssetNodeData, InstructionType, SwapInstruction, TransferInstruction, TransferToHomeThenDestInstruction, TxDetails, TransferToHomeChainInstruction, TransferParams, TransferAwayFromHomeChainInstruction, TransferrableAssetObject, TransferTxStats, BalanceChangeStats, SwapTxStats, SwapExtrinsicContainer, ExtrinsicObject, ChainNonces, TransferExtrinsicContainer, ReverseSwapExtrinsicParams, SwapResultObject, ExtrinsicSetResult, IndexObject, ArbExecutionResult, PathNodeValues, LastNode, SingleExtrinsicResultData, SingleTransferResultData, SingleSwapResultData, ExtrinsicSetResultDynamic, ExecutionState, LastFilePath, PreExecutionTransfer, TransactionState, TransferProperties, SwapProperties } from './types.ts'
import { AssetNode } from './AssetNode.ts'
import { buildInstructions, getTransferrableAssetObject } from './instructionUtils.ts';
import * as paraspell from '@paraspell/sdk';
import { arb_wallet, ksmRpc, ksmTargetNode, kusamaNodeKeys, live_wallet_3, localRpcs, mainWalletAddress, mainWalletEthAddress, testBncNode, testNets, testZlkNode } from './txConsts.ts';
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
export let apiMap: Map<TNode | "Kusama", ApiPromise> = new Map<TNode, ApiPromise>();

const aliceAddress = "HNZata7iMYWmk5RvZRTiAsSDhV8366zq2YGb3tLH5Upf74F"

// const mgxRpc = 'wss://kusama-rpc.mangata.online'
const dazzleMgxAddres = '5G22cv9fT5RNVm2AV4MKgagmKH9aoZL4289UDcYrToP9K6hQ'
const aliceErc20 = "0xf24FF3a9CF04c71Dbc94D0b566f7A27B94566cac"

export let globalState: ExecutionState = {
    lastNode: null,
    lastFilePath: null,
    extrinsicSetResults: null,
    transactionState: null,
    transactionProperties: null
    // apiMap: apiMap
}

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
    if(globalState.extrinsicSetResults != null){
        console.log("********************************************************")
        console.log("Using global state extrinsic set results")
        allExtrinsicResultData = globalState.extrinsicSetResults.extrinsicData
    } else {
        console.log("********************************************************")
        console.log("Extrinsic set is null")
    }
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

            // If last successful node is a KSM node, we can finish
            if(globalState.lastNode != null && kusamaNodeKeys.includes(globalState.lastNode.assetKey)){
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
                                // let lastSuccessfulNode = await getLastSuccessfulNodeFromResultData(allExtrinsicResultData)
                                let extrinsicSetResults: ExtrinsicSetResultDynamic = {
                                    success: false,
                                    extrinsicData: allExtrinsicResultData,
                                    lastSuccessfulNode: globalState.lastNode,
                                }
                                setLastExtrinsicSet(extrinsicSetResults)
                                return extrinsicSetResults
                            }

                            // MOVR swaps return undefined in test, not error just skip
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
                            setLastExtrinsicSet(extrinsicSetResults)
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
                                // let lastSuccessfulNode = await getLastSuccessfulNodeFromResultData(allExtrinsicResultData)
                                let extrinsicSetResults: ExtrinsicSetResultDynamic = {
                                    success: false,
                                    extrinsicData: allExtrinsicResultData,
                                    lastSuccessfulNode: globalState.lastNode,
                                }
                                setLastExtrinsicSet(extrinsicSetResults)
                                return extrinsicSetResults
                            }
                            allExtrinsicResultData.push(extrinsicResultData)
                            let extrinsicSetResults: ExtrinsicSetResultDynamic = {
                                success: true,
                                extrinsicData: allExtrinsicResultData,
                                lastSuccessfulNode: globalState.lastNode,
                            }
                            setLastExtrinsicSet(extrinsicSetResults)
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
                            // let lastSuccessfulNode = await getLastSuccessfulNodeFromResultData(allExtrinsicResultData)
                            let extrinsicSetResults: ExtrinsicSetResultDynamic = {
                                success: false,
                                extrinsicData: allExtrinsicResultData,
                                lastSuccessfulNode: globalState.lastNode,
                            }
                            setLastExtrinsicSet
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
                        setLastExtrinsicSet(extrinsicSetResults)
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
                // let lastSuccessfulNode = await getLastSuccessfulNodeFromResultData(allExtrinsicResultData)
                let extrinsicSetResults: ExtrinsicSetResultDynamic = {
                    success: false,
                    extrinsicData: allExtrinsicResultData,
                    lastSuccessfulNode: globalState.lastNode,
                }
                setLastExtrinsicSet(extrinsicSetResults)
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
            setLastExtrinsicSet(extrinsicSetResults)
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
        setLastExtrinsicSet(extrinsicSetResults)
        return extrinsicSetResults

    }
    // let lastSuccessfulNode = await getLastSuccessfulNodeFromResultData(allExtrinsicResultData)
    let extrinsicSetResults: ExtrinsicSetResultDynamic = {
        success: true,
        extrinsicData: allExtrinsicResultData,
        lastSuccessfulNode: globalState.lastNode,
    }
    setLastExtrinsicSet(extrinsicSetResults)
    return extrinsicSetResults;
}

// // Skip route nodes up to ksm node to start from / first swap node
async function getFirstKsmNode(instructions: (SwapInstruction | TransferInstruction)[], chopsticks: boolean){ 
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


async function createTransferPathNode(assetKey: string, pathValue: number){
    let pathNode = {
        node_key: assetKey,
        asset_name: "KSM",
        path_value: pathValue,
        path_identifier: 0
    }
    return pathNode
}

async function getPreTransferPath(startChainId: number, inputAmount: number, chopsticks: boolean, ksmBalances: any): Promise<AssetNode[]>{
    // let ksmBalances = await getKsmBalancesAcrossChains(chopsticks)
    let [firstChainWithSufficientFunds, balance] = Object.entries(ksmBalances).find(([chainId, balance]) => {
        console.log(`Comparing chain: ${balance} with balance: ${inputAmount}`)
        let chainBalance = balance as number
        return Number.parseInt(chainId) != Number.parseInt(startChainId.toString()) && chainBalance > inputAmount
    })

    let inputAmountFixed = new FixedPointNumber(inputAmount.toString(), 12)
    //Kusama is checked first, and if insufficient, transfer to Kusama then to start node
    if(Number.parseInt(firstChainWithSufficientFunds) != 0) {
        // let toKsmTransfer = await buildTransferToKsm(firstChainWithSufficientFunds, inputAmountFixed, chopsticks)
        // let ksmToChainTransfer = await buildTransferKsmToChain(startChainId, inputAmountFixed, chopsticks)
        let firstAssetObject = getAssetRegistryObjectBySymbol(Number.parseInt(firstChainWithSufficientFunds), "KSM")
        let secondAssetObject = getAssetRegistryObjectBySymbol(0, "KSM")
        let thirdAssetObject = getAssetRegistryObjectBySymbol(startChainId, "KSM")

        let firstAssetKey = JSON.stringify(firstAssetObject.tokenData.chain) + JSON.stringify(firstAssetObject.tokenData.localId)
        let secondAssetKey = JSON.stringify(secondAssetObject.tokenData.chain) + JSON.stringify(secondAssetObject.tokenData.localId)
        let thirdAssetKey = JSON.stringify(thirdAssetObject.tokenData.chain) + JSON.stringify(thirdAssetObject.tokenData.localId)
        let keys = [firstAssetKey, secondAssetKey, thirdAssetKey]
        let pathNodesPromise = keys.map((key) => {
            return createTransferPathNode(key, inputAmount)
        })
        let pathNodes = await Promise.all(pathNodesPromise)

        // Remove last node to not duplicate KSM node when concatted with assetPath
        pathNodes.pop()
        fs.writeFileSync(path.join(__dirname, './preTransferNodes.json'), JSON.stringify(pathNodes, null, 2))
    } else {
        // let ksmToChainTransfer = await buildTransferKsmToChain(startChainId, inputAmountFixed, chopsticks)
        let secondAssetObject = getAssetRegistryObjectBySymbol(0, "KSM")
        let thirdAssetObject = getAssetRegistryObjectBySymbol(startChainId, "KSM")
        let secondAssetKey = JSON.stringify(secondAssetObject.tokenData.chain.toString() + JSON.stringify(secondAssetObject.tokenData.localId))
        let thirdAssetKey = JSON.stringify(thirdAssetObject.tokenData.chain.toString() + JSON.stringify(thirdAssetObject.tokenData.localId))
        let keys = [secondAssetKey, thirdAssetKey]
        let pathNodesPromise = keys.map((key) => {
            return createTransferPathNode(key, inputAmount)
        })
        let pathNodes = await Promise.all(pathNodesPromise)

        // Remove last node to not duplicate KSM node when concatted with assetPath
        pathNodes.pop()
        fs.writeFileSync(path.join(__dirname, './preTransferNodes.json'), JSON.stringify(pathNodes, null, 2))
    }
    let preTransferFile = path.join(__dirname, './preTransferNodes.json') 
    let assetPath = constructRoute(preTransferFile)
    return assetPath
    // BUILD ASSET NODE ROUTE
}

// async function getRequiredBalanceForChain(destinationChainId: number, inputAmount: number, ksmBalances: any, chopsticks: boolean){
//     //Find first chain with enough balance
    
//     console.log(`KSM BALANCES: ${JSON.stringify(ksmBalances, null, 2)}`)
//     let [chainWithBalance, balance] = Object.entries(ksmBalances).find(([chainId, balance]) => {
//         console.log(`Comparing chain: ${balance} with balance: ${inputAmount}`)
//         let chainBalance = balance as number
//         return chainBalance > inputAmount
//     })
    
//     console.log(`Chain with balance: ${chainWithBalance} : ${balance}`)
//     let pathNodes = []
//     let transferTxs: PreExecutionTransfer[] = []

//     let ksmAccount = await getSigner(chopsticks, false)
//     // Construct Route
//     if(Number.parseInt(chainWithBalance) != 0){

//         let startChainNode: TNode = getParaspellChainName(Number.parseInt(chainWithBalance)) as TNode
//         let api: ApiPromise = await getApiForNode(startChainNode, chopsticks)
//         let formattedAmount = new FixedPointNumber(balance.toString(), 12)
//         let tx = paraspell.Builder(api).from(startChainNode).amount(formattedAmount.toChainData()).address(ksmAccount.address) .build()
//         let firstChainToKusama: PreExecutionTransfer = {
//             fromChainId: Number.parseInt(chainWithBalance),
//             toChainId: 0,
//             extrinsic: tx,
//             transferAmount: Number.parseFloat(balance.toString())
//         }
//         transferTxs.push(firstChainToKusama)
//         console.log(JSON.stringify(tx.toHuman())) 
//     }

//     let destinationChainNode = getNodeFromChainId(destinationChainId)
//     let destinationAccount = destinationChainNode == "Moonriver" ? await getSigner(chopsticks, true) : ksmAccount

//     let api: ApiPromise = await getApiForNode("Kusama", 0, chopsticks)
//     let formattedInput = new FixedPointNumber(inputAmount.toString(), 12).toChainData()
//     let secondTx = paraspell.Builder(api).to(destinationChainNode).amount(formattedInput).address(destinationAccount.address).build()
//     let kusamaToDestination: PreExecutionTransfer = {
//         fromChainId: 0,
//         toChainId: destinationChainId,
//         extrinsic: secondTx,
//         transferAmount: inputAmount
//     }
//     transferTxs.push(kusamaToDestination)
//     console.log(JSON.stringify(secondTx.toHuman()))
//     return transferTxs
// }


async function runDynamicArbLive(chopsticks: boolean, executeMovr: boolean, small: boolean){
    // let small = true
    let latestFile = getLatestFileFromLatestDay(small)
    // let latestFile = getLatestFileFromLatestDay(small)
    let assetPath = constructRoute(latestFile)
    let instructions = await buildInstructionSet(assetPath)
    let instructionsAbreviated = await getFirstKsmNode(instructions, chopsticks)
    let firstInstruction = instructionsAbreviated[0]
    let startChain = firstInstruction.assetNodes[0].getChainId()
    let startValue = firstInstruction.assetNodes[0].pathValue
    
    console.log("Start Value: ", startValue)

    let ksmBalances = await getKsmBalancesAcrossChains(chopsticks)
    console.log(ksmBalances)
    console.log("Start Chain: ", startChain)
    console.log(`Balance on start chain: ${ksmBalances[startChain]} | Input value: ${startValue}`)

    let executionInstructions = instructionsAbreviated
    if(ksmBalances[startChain] > startValue){
        console.log("StartNode has sufficient start balance")
    } else {
        console.log("StartNode has insufficient start balance. Need to allocate")
        let prePath = await getPreTransferPath(startChain, startValue, chopsticks, ksmBalances)
        let executionPath = prePath.concat(assetPath)
        executionInstructions = await buildInstructionSet(executionPath)
    }

    let testLoops = 100
    let allExtrinsicSets: ExtrinsicSetResultDynamic[] = []
    let executionResults: ExtrinsicSetResultDynamic = await buildAndExecuteExtrinsics(executionInstructions, chopsticks, executeMovr, testLoops)
    
    allExtrinsicSets.push(executionResults)

    setLastFile(latestFile)
    logAllResultsDynamic(latestFile, true)
    logAllArbAttempts(latestFile, chopsticks)
    let arbSuccess = executionResults.success
    let lastNode = globalState.lastNode
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
        logAllResultsDynamic(latestFile, true)
        logAllArbAttempts(latestFile, chopsticks)
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
    // lastNode.assetValue
    let arbAmountOut = await getTotalArbResultAmount(lastNode)
    // let lastSuccessfulNode = await getLastSuccessfulNodeFromResultData()
    logAllResultsDynamic(latestFile, true)
    logAllArbAttempts(latestFile, chopsticks)
    await logProfits(arbAmountOut, latestFile, chopsticks )
    
    console.log(`Result for latest file ${latestFile}: ${arbSuccess}`)
    console.log(`Total Arb Amount Out: ${arbAmountOut}`)
}


async function testLastExtrinsicSet(){
    let executionState: ExecutionState = getLastExecutionState()
    let lastExtrinsicSet: ExtrinsicSetResultDynamic = executionState.extrinsicSetResults
    lastExtrinsicSet.extrinsicData.forEach((extrinsicData) => {
        console.log(JSON.stringify(extrinsicData.arbExecutionResult, null, 2))
    })
}

async function runFromLastNode(chopsticks: boolean, executeMovr: boolean){
    globalState = getLastExecutionState()
    let lastNode: LastNode = globalState.lastNode
    let logFilePath: string = globalState.lastFilePath
    let lastExtrinsicSet: ExtrinsicSetResultDynamic = globalState.extrinsicSetResults
    let lastTransactionState: TransactionState = globalState.transactionState
    let lastTransactionProperties: TransferProperties | SwapProperties = globalState.transactionProperties

    // If last transaction has been submitted but not finalized, we need to query the balances to see if it completed successfully or not
    if(lastTransactionState == TransactionState.Broadcasted){
        let transactionSuccess = await confirmLastTransactionSuccess(lastTransactionProperties)
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
    while(!arbSuccess && lastNode.chainId != 0 && arbLoops < 3){
        arbLoops += 1

        if(lastTransactionState == TransactionState.Broadcasted){
            let transactionSuccess = await confirmLastTransactionSuccess(lastTransactionProperties)
            globalState.transactionState = TransactionState.PreSubmission
            lastNode = globalState.lastNode
        }

        let functionArgs = `${lastNode.assetKey} ${ksmTargetNode} ${lastNode.assetValue}`
        console.log("Executing Arb Fallback with args: " + functionArgs)

        let arbResults: ResultDataObject[];
        try{
            arbResults = await runAndReturnFallbackArb(functionArgs, chopsticks)
        } catch {
            console.log("Failed to run fallback arb")
            continue;
        }
        let assetPath: AssetNode[] = arbResults.map(result => readLogData(result))
        let instructions = await buildInstructionSet(assetPath)
        let extrinsicSetResults = await buildAndExecuteExtrinsics(instructions, chopsticks, executeMovr, 100)

        logAllResultsDynamic(logFilePath, true)
        logAllArbAttempts(logFilePath, chopsticks)
        if(extrinsicSetResults.success){
            arbSuccess = true
        }

        lastNode = globalState.lastNode
        if(!lastNode){
            console.log("Last node undefined. ERROR: some extrinsics have executed successfully")
            throw new Error("Last node undefined. ERROR: some extrinsics have executed successfully")
        }
    }

    let arbAmountOut = await getTotalArbResultAmount(lastNode)
    await logProfits(arbAmountOut, logFilePath, chopsticks )
}

async function runDynamicArbTarget(chopsticks: boolean, executeMovr: boolean, inputAmount: number){
        
        let arbArgs = `${ksmTargetNode} ${ksmTargetNode} ${inputAmount}`
        let targetArbResults
        try{
            targetArbResults = await runAndReturnTargetArb(arbArgs, chopsticks)
        }  catch {
            console.log("Failed to run target arb")
            throw new Error("Failed to run target arb")
        }
        let latestFile = getLatestTargetFile()
        let assetPath: AssetNode[] = targetArbResults.map(result => readLogData(result))
        let targetArbInstructions = await buildInstructionSet(assetPath)
        let instructionsAbreviated = await getFirstKsmNode(targetArbInstructions, chopsticks)
        let firstInstruction = instructionsAbreviated[0]
        let startChain = firstInstruction.assetNodes[0].getChainId()
        let startValue = firstInstruction.assetNodes[0].pathValue

        // console.log("Start Value: ", startValue)
        let ksmBalancesSuccess = false;
        let ksmBalancesQueries = 0;
        let ksmBalances;
        while(!ksmBalancesSuccess && ksmBalancesQueries < 3){
            console.log("Querying KSM Balances")
            ksmBalancesQueries += 1
            try{
                ksmBalances = await getKsmBalancesAcrossChains(chopsticks)
                ksmBalancesSuccess = true
                console.log(ksmBalances)
            } catch(e){
                console.log(e)
                console.log("KSM query failed. Retrying")
            }
        }
        if(!ksmBalancesSuccess){
            console.log("Failed to query KSM balances. Exiting")
            return;
        }
    
        let executionInstructions = instructionsAbreviated
        if(ksmBalances[startChain] > startValue){
            console.log("StartNode has sufficient start balance")
        } else {
            console.log("StartNode has insufficient start balance. Need to allocate")
            let prePath = await getPreTransferPath(startChain, startValue, chopsticks, ksmBalances)
            let executionPath = prePath.concat(assetPath)
            executionInstructions = await buildInstructionSet(executionPath)
        }
    
        let testLoops = 100
        let allExtrinsicSets: ExtrinsicSetResultDynamic[] = []
        let executionResults: ExtrinsicSetResultDynamic = await buildAndExecuteExtrinsics(executionInstructions, chopsticks, executeMovr, testLoops)
        
        allExtrinsicSets.push(executionResults)
    
        setLastFile(latestFile)
        logAllResultsDynamic(latestFile, true)
        logAllArbAttempts(latestFile, chopsticks)
        let arbSuccess = executionResults.success
        let lastNode = globalState.lastNode
        if(!lastNode){
            console.log("Last node is undefined. No extrinsics executed successfully. Exiting")
            return;
        }
        
    
        let arbLoops = 0
        //Rerun arb until success or last node is Kusama
        while(!arbSuccess && lastNode.chainId != 0 && arbLoops < 3){
            arbLoops += 1
            if(globalState.transactionState == TransactionState.Broadcasted){
                let transactionSuccess = await confirmLastTransactionSuccess(globalState.transactionProperties)
                lastNode = globalState.lastNode
                globalState.transactionState = TransactionState.PreSubmission
            }
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

            allExtrinsicSets.push(reverseExtrinsicResult)
            logAllResultsDynamic(latestFile, true)
            logAllArbAttempts(latestFile, chopsticks)
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
        let arbAmountOut = await getTotalArbResultAmount(lastNode)
        logAllResultsDynamic(latestFile, true)
        logAllArbAttempts(latestFile, chopsticks)
        await logProfits(arbAmountOut, latestFile, chopsticks )
        
        console.log(`Result for latest file ${latestFile}: ${arbSuccess}`)
        console.log(`Total Arb Amount Out: ${arbAmountOut}`)
}
// async function testKsmBalances(){
//     let ksmBalances = await getKsmBalancesAcrossChains()
//     console.log(ksmBalances)
// }
// async function testPreTransfers(chopsticks: boolean, executeMovr: boolean){
//     await getPreTransferPath(2000, 0.12, true)
//     let preTransferFile = path.join(__dirname, './preTransferNodes.json') 
//     let assetPath = constructRoute(preTransferFile)
//     let instructions = await buildInstructionSet(assetPath)
//     // let executeMovr = false
//     let testLoops = 100
//     let allExtrinsicSets: ExtrinsicSetResultDynamic[] = []
//     let executionResults: ExtrinsicSetResultDynamic = await buildAndExecuteExtrinsics(instructions, chopsticks, executeMovr, testLoops)
//     // executionResults.extrinsicData = executionResults.extrinsicData.reverse()
// }
// async function testAllocateAndExecute(chopsticks: boolean, executeMovr: boolean){
//     let small = false
//     let latestFile = getLatestFileFromLatestDay(small)
//     console.log("Latest File: ", latestFile)
//     let assetPath = constructRoute(latestFile)
    
//     let instructions = await buildInstructionSet(assetPath)
//     let instructionsAbreviated = await getFirstKsmNode(instructions, chopsticks)
//     let firstInstruction = instructionsAbreviated[0]
//     let startChain = firstInstruction.assetNodes[0].getChainId()
//     let startValue = firstInstruction.assetNodes[0].pathValue
//     console.log("Start Chain: ", startChain)
//     console.log("Start Value: ", startValue)
//     let ksmBalances = await getKsmBalancesAcrossChains(chopsticks)
//     console.log(ksmBalances)

//     let executionInstructions = instructionsAbreviated
//     if(ksmBalances[startChain] > startValue){
//         console.log("StartNode has sufficient start balance")
//     } else {
//         console.log("StartNode has insufficient start balance. Need to allocate")
//         let prePath = await getPreTransferPath(startChain, startValue, chopsticks, ksmBalances)
//         let executionPath = prePath.concat(assetPath)
//         executionInstructions = await buildInstructionSet(executionPath)
//     }

//     executionInstructions.forEach((instruction) => {
//         console.log(instruction.type)
//         instruction.assetNodes.forEach((node) => {
//             console.log(`${node.getAssetRegistrySymbol()} ${node.getChainId()}`)
//         })
//     })

//     // let preTransfers = await getPreTransferPath(2000, 0.05, chopsticks)
//     // // let executeMovr = false
//     let testLoops = 100
//     let allExtrinsicSets: ExtrinsicSetResultDynamic[] = []
//     let executionResults: ExtrinsicSetResultDynamic = await buildAndExecuteExtrinsics(executionInstructions, chopsticks, executeMovr, testLoops)
//     // executionResults.extrinsicData = executionResults.extrinsicData.reverse()
//     // // logResultsDynamic(executionResults, latestFile, false)
    
//     allExtrinsicSets.push(executionResults)
//     // logLastFilePath(latestFile)
//     setLastFile(latestFile)
//     logAllResultsDynamic(allExtrinsicSets, latestFile, true)
//     logAllArbAttempts(allExtrinsicSets, latestFile, chopsticks)
//     // let arbSuccess = executionResults.success
//     // let lastNode = globalState.lastNode
// }
async function run() {
    let chopsticks = false
    let executeMovr = true
    let small = true
    // await runFromLastNode(chopsticks, executeMovr)
    await runDynamicArbTarget(chopsticks, executeMovr, 0.5)
    process.exit(0)
}

run()

function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
