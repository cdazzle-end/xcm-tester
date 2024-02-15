import fs from 'fs'
import { Observable, timeout } from 'rxjs'
// import { options } from "@acala-network/api";
import * as paraspell from '@paraspell/sdk'
import { WsProvider, ApiPromise, Keyring, ApiRx } from '@polkadot/api'
import { KeyringPair } from '@polkadot/keyring/types';
import { TNode, getAssetsObject, getNode, getNodeEndpointOption, getAllNodeProviders, getTNode } from '@paraspell/sdk'
import path from 'path';
import { cryptoWaitReady } from "@polkadot/util-crypto"
import { wsLocalFrom, wsLocalDestination, assetSymbol, fromChain, toChain } from '../xcm_tests/testParams.ts'
import { BN, compactStripLength, u8aToHex } from '@polkadot/util'
import { getAssetBySymbolOrId, getParaspellChainName, getAssetRegistryObject, readLogData, getEndpointsForChain, connectFirstApi, getAssetRegistryObjectBySymbol, watchTokenDeposit, getBalanceChange, getSigner, watchTokenBalance, printInstruction, increaseIndex } from './utils.ts'
import { ResultDataObject, MyAssetRegistryObject, MyAsset, AssetNodeData, InstructionType, SwapInstruction, TransferInstruction, TransferToHomeThenDestInstruction, TxDetails, TransferToHomeChainInstruction, TransferParams, TransferAwayFromHomeChainInstruction, TransferrableAssetObject, TransferTxStats, BalanceChangeStats, SwapTxStats, SwapExtrinsicContainer, ExtrinsicObject, ChainNonces, TransferExtrinsicContainer, ReverseSwapExtrinsicParams, SwapResultObject, ExtrinsicSetResult, IndexObject, ArbExecutionResult, PathNodeValues, LastNode } from './types.ts'
import { AssetNode } from './AssetNode.ts'
import { prodRelayPolkadot, prodRelayKusama, createWsEndpoints, prodParasKusamaCommon, prodParasKusama } from '@polkadot/apps-config/endpoints'
import { buildInstructions, getTransferrableAssetObject } from './instructionUtils.ts';

import { getKarSwapExtrinsicBestPath } from './../swaps/karSwap.ts';
import { getMovrSwapTx } from './../swaps/movr/movrSwap.ts';
// import { getBncSwapExtrinsic } from './../swaps/bnc/bncSwap.ts';
import { getBncSwapExtrinsic } from './../swaps/bncSwap.ts';
import { getBsxSwapExtrinsic } from './../swaps/bsxSwap.ts';
// const bncSwap = await import('./../swaps/bnc/bncSwap.ts');
// const { getBncSwapExtrinsic } = bncSwap;
// import bnc from './../swaps/bnc/bncSwap.ts';
// import { getBsxSwapExtrinsic } from './../swaps/bsxSwap.ts';
// const bsxSwap = await import('./../swaps/bsx/bsxSwap.ts');
// const { getBsxSwapExtrinsic } = bsxSwap;
import { getMgxSwapExtrinsic } from './../swaps/mgxSwap.ts';
import { getHkoSwapExtrinsic } from './../swaps/hkoSwap.ts';
import { checkAndApproveToken } from './../swaps/movr/utils/utils.ts';
import { SubmittableExtrinsic } from '@polkadot/api/submittable/types'
import { EventRecord } from '@polkadot/types/interfaces/index';

import { FixedPointNumber, Token } from "@acala-network/sdk-core";
import { ISubmittableResult } from '@polkadot/types/types/extrinsic';
// import { BalanceData, getAdapter } from '@polkawallet/bridge';
import { arb_wallet, localRpcs, mainWalletAddress, testNets } from './txConsts.ts';
import { buildSwapExtrinsic, buildTransferExtrinsicReworked } from './extrinsicUtils.ts';

// Get the __dirname equivalent in ES module
// const __dirname = path.dirname(fileURLToPath(import.meta.url));
// console.log(__dirname)
// import { fileURLToPath } from 'url';
import { fileURLToPath } from 'url';
import { BalanceChangeStatue } from 'src/types.ts';
import { logSwapTxStats, logSwapTxResults, logTransferTxStats, logArbExecutionResults, logInstructions, logSubmittableExtrinsics } from './logUtils.ts';
import { Result } from '@polkadot/types';
import { runAndReturnFallbackArb, runArbFallback } from './executeArbFallback.ts';
import { Mangata, MangataInstance } from '@mangata-finance/sdk';
import { reverse } from 'dns';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const allConnectionPromises = new Map<string, Promise<ApiPromise>>();
export const allConnections = new Map<string, ApiPromise>();
export let promiseApis: Record<number, ApiPromise> = {};
export let observableApis: Record<number, ApiRx> = {};
const aliceAddress = "HNZata7iMYWmk5RvZRTiAsSDhV8366zq2YGb3tLH5Upf74F"

// const getSigner = async () => {
//     await cryptoWaitReady()
//     const keyring = new Keyring({
//       type: "sr25519",
//     });
  
//     // Add Alice to our keyring with a hard-deived path (empty phrase, so uses dev)
//     return keyring.addFromUri("//Alice");
//   };

// const mgxRpc = 'wss://kusama-rpc.mangata.online'
const dazzleMgxAddres = '5G22cv9fT5RNVm2AV4MKgagmKH9aoZL4289UDcYrToP9K6hQ'
const localHost = "ws://172.26.130.75:"
const aliceErc20 = "0xf24FF3a9CF04c71Dbc94D0b566f7A27B94566cac"

const fromNode = getNode(fromChain)
const toNode = getNode(toChain)


let scriptPid: string | null = null;
let chopsticksPid: string | null = null;

const testLogFile1 = "2023-06-17_18-26-43.json";
const testLogFolder = "2024-01-22";
const testLogDay = "Kusama_00-12-04.json";
const testLogFolder2 = "2024-01-29";
const testLogDay2 = "Kusama_15-01-33.json";
const testLogHko = "Kusama_17-09-41.json"
const testLogBsx = "Kusama_17-43-40.json"

function getLatestFileFromLatestDay() {
    
    const resultsDirPath = path.join(__dirname, '/../../../test2/arb-dot-2/arb_handler/result_log_data');
    try {
        // Get list of directories (days)
        const days = fs.readdirSync(resultsDirPath, { withFileTypes: true })
                       .filter(dirent => dirent.isDirectory())
                       .map(dirent => dirent.name)
                       .filter((day) => day.includes("_small"))


        console.log("Days: ", JSON.stringify(days, null, 2))
        // Sort directories by date
        const sortedDays = days.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
        // console.log("Sorted Days: ", JSON.stringify(sortedDays, null, 2))
        // Get the latest day's directory

        const latestDayDir = sortedDays[sortedDays.length - 1]
        const latestDayPath = path.join(resultsDirPath, latestDayDir);
        console.log("Latest Day Path: ", latestDayPath)
        // Get list of files in the latest day's directory
        const files = fs.readdirSync(latestDayPath);

        // Sort files by timestamp in filename
        const sortedFiles = files.sort((a, b) => {
            const timeA = a.match(/\d{2}-\d{2}-\d{2}/)[0].replace(/-/g, ':');
            const timeB = b.match(/\d{2}-\d{2}-\d{2}/)[0].replace(/-/g, ':');
            return new Date(`${latestDayDir}T${timeA}`).getTime() - new Date(`${latestDayDir}T${timeB}`).getTime();
        });

        // Get the latest file
        const latestFile = sortedFiles[sortedFiles.length - 1];
        const latestFilePath = path.join(latestDayPath, latestFile);

        return latestFilePath;
    } catch (error) {
        console.error('Error:', error);
        return null;
    }
}
function constructRoute(logFilePath: string) {
    const resultsFolderPath = path.join(__dirname, '/../../../test2/arb-dot-2/arb_handler/result_log_data');
    
    // const testResultFile = path.join(resultsFolderPath, testLogFolder2, testLogBsx)
    console.log("LatestFile: ", logFilePath)
    const testResults: ResultDataObject[] = JSON.parse(fs.readFileSync(logFilePath, 'utf8'));
    let assetPath: AssetNode[] = testResults.map(result => readLogData(result))
    let reversePath: AssetNode[] = assetPath.slice().reverse().map((node)  => {
        // Deep copy through JSON serialize-deserialize
        // let newNode: AssetNode = JSON.parse(JSON.stringify(node));
        // newNode.pathValue = node.getReducedPathValue(); // Assuming this is a simple property
        // return newNode;
        let assetNodeData = {
            paraspellAsset: node.paraspellAsset,
            paraspellChain: node.paraspellChain,
            assetRegistryObject: node.assetRegistryObject,
            pathValue: node.getReducedPathValue(),
            pathType: node.pathType
        }
        let newNode = new AssetNode(assetNodeData);
        Object.assign(newNode, node); // Shallow copy properties
        newNode.pathValue = node.getReducedPathValue(); // Modify only in the new instance
        return newNode;
    })
    return [assetPath, reversePath]
}

async function buildInstructionSet(assetPath: AssetNode[]) {
    let instructions: (SwapInstruction | TransferInstruction)[] = [];
    let instructionIndex: IndexObject = {i: 0}
    for (let i = 0; i < assetPath.length - 1; i++) {
        let assetNodes = [assetPath[i], assetPath[i + 1]]
        // console.log(JSON.stringify(assetNodes, null, 2))
        // console.log("BUILDING INSTRUCTIONS")
        let newInstructions = buildInstructions(assetNodes, instructionIndex)
        newInstructions.forEach((instruction) => {
            instructions.push(instruction)
        })
    }
    return instructions
}

// Build extrinsics from instructions
async function buildExtrinsicSet(instructionSet: (SwapInstruction | TransferInstruction)[], chopsticks: boolean): Promise<ExtrinsicObject[]> {
    let extrinsicSet: ExtrinsicObject[] = [];
    let swapInstructions: SwapInstruction[] = [];
    let extrinsicIndex: IndexObject = {i: 0}
    let chainNonces: ChainNonces = {
        2000: 0,
        2023: 0,
        2001: 0,
        2090: 0,
        2110: 0,
        2085: 0
    }

    // let txIndex = 0;
    for (const instruction of instructionSet) {
        switch (instruction.type) {
            case InstructionType.Swap:
                // Accumulate swap instructions
                
                // If swap is of the same type, accumulate
                if(swapInstructions.length == 0 || swapInstructions[swapInstructions.length - 1].pathType == instruction.pathType){
                    swapInstructions.push(instruction);
                } else {
                    // If swap is of a different type, build extrinsic for the accumulated swap instructions
                    let extrinsics = await buildSwapExtrinsic(swapInstructions, chainNonces, extrinsicIndex, chopsticks);
                    extrinsics.forEach((extrinsicContainer) => {
                        let exObj: ExtrinsicObject = {
                            type: "Swap",
                            instructionIndex: extrinsicContainer.instructionIndex,
                            extrinsicIndex: extrinsicContainer.extrinsicIndex,
                            swapExtrinsicContainer: extrinsicContainer
                        }
                        extrinsicSet.push(exObj);
                        swapInstructions = [instruction];
                    })

                }
                break;
            default:
                // For other types of instructions
                if (swapInstructions.length > 0) {
                    let extrinsics = await buildSwapExtrinsic(swapInstructions, chainNonces, extrinsicIndex, chopsticks);
                    extrinsics.forEach((extrinsic) => {
                        let exObj: ExtrinsicObject = {
                            type: "Swap",
                            instructionIndex: extrinsic.instructionIndex,
                            extrinsicIndex: extrinsic.extrinsicIndex,
                            swapExtrinsicContainer: extrinsic
                        }
                        extrinsicSet.push(exObj);
                    })
                    swapInstructions = [];   
                }
                // Handle other types of instructions (e.g., TransferToHomeChain)
                // Add the extrinsic for the current instruction (if needed)
                let transferExtrinsics = await buildTransferExtrinsicReworked(instruction, extrinsicIndex, chopsticks);
                // let reverseTransferExtrinsics = []
                transferExtrinsics.forEach((transferExtrinsic) => {
                    
                    let exObj: ExtrinsicObject = {
                        type: "Transfer",
                        instructionIndex: transferExtrinsic.instructionIndex,
                        extrinsicIndex: transferExtrinsic.extrinsicIndex,
                        transferExtrinsicContainer: transferExtrinsic
                    }
                    extrinsicSet.push(exObj);
                    

                })
                // extrinsicSet.push(transferExtrinsic);
                break;
        }
        // instructionIndex = instructionIndex + 1;
    }

    // Handle any remaining swap instructions at the end of the instruction set
    if (swapInstructions.length > 0) {
        let extrinsics = await buildSwapExtrinsic(swapInstructions, chainNonces, extrinsicIndex, chopsticks);
        extrinsics.forEach((extrinsic) => {
            let exObj: ExtrinsicObject = {
                type: "Swap",
                instructionIndex: extrinsic.instructionIndex,
                extrinsicIndex: extrinsic.extrinsicIndex,
                swapExtrinsicContainer: extrinsic
            }
            extrinsicSet.push(exObj);
        })
        swapInstructions = [];
    }
    return extrinsicSet;
    // let finishedExtrinsicSet = await Promise.all(extrinsicSet)
    // return finishedExtrinsicSet;
}



async function executeExtrinsicSet(extrinsicSet: ExtrinsicObject[], logFilePath: string, executeMovr: boolean, reverseSwaps: boolean, chopsticks: boolean) {
    
    // console.log(signer.address)
    
    let arbExecutionResults: ArbExecutionResult[] = []
    let resultPathNodes: PathNodeValues[] = []
    let transferTxStats: TransferTxStats[] = []
    let swapTxStats: SwapTxStats[] = []
    let swapTxResults = []
    
    // This is what we pass to the fallback arb function.
    let lastNodeAssetKey: string;
    let lastNodeAssetValue: string;
    let lastNode: LastNode;

    // let executeMovr = false
    console.log("executeExtrinsicSet function")
    let extrinsicIndex = 0;

    let executionLoopIndex = 0;
    try {
        for (const extrinsicObj of extrinsicSet) {

            //test three tx's then execute reverse tx's
            // if(executionLoopIndex < 3){
                console.log("Execute Extrinsic Set Top of Loop")


            if (extrinsicObj.type == "Transfer"){
                let extrinsic = extrinsicObj.transferExtrinsicContainer.extrinsic
                let startChain = extrinsicObj.transferExtrinsicContainer.firstNode
                let destChain = extrinsicObj.transferExtrinsicContainer.secondNode
                let startApi = extrinsicObj.transferExtrinsicContainer.startApi
                let destApi = extrinsicObj.transferExtrinsicContainer.destinationApi
                let startParaId = extrinsicObj.transferExtrinsicContainer.startChainId
                let destParaId = extrinsicObj.transferExtrinsicContainer.destinationChainId
                let startTransferrable = extrinsicObj.transferExtrinsicContainer.startTransferrable
                let destTransferrable = extrinsicObj.transferExtrinsicContainer.destinationTransferrable
                let currency = extrinsicObj.transferExtrinsicContainer.destinationTransferrable.paraspellAsset.symbol

                let startSigner, destSigner;
                if(startParaId == 2023){
                    startSigner = await getSigner(chopsticks, true)
                } else {
                    startSigner = await getSigner(chopsticks, false)
                }
                if(destParaId == 2023){
                    destSigner = await getSigner(chopsticks, true)
                } else {
                    destSigner = await getSigner(chopsticks, false)
                }
                let watchWithdrawAddress: string = startSigner.address.toString()
                let watchDepositAddress: string = destSigner.address.toString()

                console.log("Execute Extrinsic Set Loop: Transfer extrinsic")
                console.log(`Execute Extrinsic Set Loop: Start Chain: ${startChain} ${startParaId}| Destination Chain: ${destChain} ${destParaId} | Currency: ${JSON.stringify(currency)} `)
                if(testNets.includes(startChain) && testNets.includes(destChain)){
                    let startBalanceUnsub, destBalanceUnsub;
                    console.log("Execute Extrinsic Set Loop: Initiating balance adapter for START chain " + startChain)
                    let startBalanceObservable$ = await watchTokenDeposit(startParaId, startApi, 0, startTransferrable, watchWithdrawAddress) 
                    let startBalanceChangePromise = getBalanceChange(startBalanceObservable$, (unsub) =>{
                        startBalanceUnsub = unsub
                    })
                    console.log("Execute Extrinsic Set Loop: Initiating balance adapter for DESTINATION chain " + destChain)
                    let destBalanceObservable$ = await watchTokenDeposit(destParaId, destApi, 0, destTransferrable, watchDepositAddress)
                    console.log(`(${startChain} -> ${destChain}) ${JSON.stringify(extrinsicObj.transferExtrinsicContainer.assetSymbol)} ${JSON.stringify(extrinsicObj.transferExtrinsicContainer.assetIdStart)}`)
                    console.log(extrinsic.toHuman())
                    let txPromise;
                    try{
                        // **************************************************************************************
                        txPromise = await executeTransferExtrinsic(extrinsicObj.transferExtrinsicContainer, startParaId, chopsticks)
                        // **************************************************************************************

                    } catch(e) {
                        console.log("ERROR: " + e)
                        txPromise = e
                        await startBalanceUnsub()
                        await destBalanceUnsub()
                        // For now just throw if an extrinsic fails, and then execute reverse txs
                        // throw new Error("Transfer failed, executing reverse txs")
                        let transferAmount = extrinsicObj.transferExtrinsicContainer.pathAmount
                        let arbString: ArbExecutionResult = { 
                            assetSymbolIn: currency,
                            assetSymbolOut: currency,
                            result: `FAILURE: TRANSFER: (${startChain} ${startParaId} ${currency} ${transferAmount}-> ${destChain}) ${destParaId} | ERROR: ${e}` 
                        }
                        
                        let pathNodeValues: PathNodeValues = {
                            pathInLocalId: extrinsicObj.transferExtrinsicContainer.pathInLocalId,
                            pathOutLocalId: extrinsicObj.transferExtrinsicContainer.pathOutLocalId,
                            pathInSymbol: currency,
                            pathOutSymbol: currency,
                            pathSwapType: extrinsicObj.transferExtrinsicContainer.pathSwapType,
                            pathValue: extrinsicObj.transferExtrinsicContainer.pathAmount,
                            pathValueNext: 0
                        
                        }
                        arbExecutionResults.push(arbString)
                        resultPathNodes.push(pathNodeValues)
                        let extrinsicSetResult: ExtrinsicSetResult = {
                            success: false,
                            arbExecutionResult: arbExecutionResults,
                            resultPathNodes: resultPathNodes,
                            transferTxStats: transferTxStats,
                            swapTxStats: swapTxStats,
                            swapTxResults: swapTxResults,
                            lastNode: lastNode,
                            extrinsicIndex: extrinsicIndex
                        }

                        return extrinsicSetResult

                    }
                    
                    console.log("Execute Extrinsic Set Loop: Transfer promise created")
                    let startBalanceStats = await startBalanceChangePromise;
                    let destBalanceStats = await getBalanceChange(destBalanceObservable$, (unsub) =>{
                        destBalanceUnsub = unsub
                    })
                    let feesAndGasAmount = startBalanceStats.changeInBalance.add(destBalanceStats.changeInBalance)
                    console.log(`Execute Extrinsic Set Loop: Start Balance Change: ${JSON.stringify(startBalanceStats)} | Destination Balance Change: ${JSON.stringify(destBalanceStats)} | Fees and Gas: ${feesAndGasAmount}`)
                    let txResultObject: TransferTxStats = {
                        startChain: startChain,
                        startParaId: startParaId,
                        destChain: destChain,
                        destParaId: destParaId,
                        currency: currency,
                        startBalanceStats: startBalanceStats,
                        destBalanceStats: destBalanceStats,
                        feesAndGasAmount: feesAndGasAmount
                    }
                    let txResult = await txPromise
                    
                    let successMetric = destBalanceStats.changeInBalance.gt(new FixedPointNumber(0))
                    let transferAmount = extrinsicObj.transferExtrinsicContainer.pathAmount
                    let arbString: ArbExecutionResult = {
                        assetSymbolIn: currency,
                        assetSymbolOut: currency,
                        result:`SUCCESS: ${successMetric} - TRANSFER: (${startChain} ${startParaId} ${currency} ${transferAmount}-> ${destChain}) ${destParaId} | FEES: ${feesAndGasAmount.toString()}`
                    }
                    
                    let pathValueNext = Number.parseFloat(destBalanceStats.changeInBalanceString)
                    let pathNode: PathNodeValues = {
                        pathInLocalId: extrinsicObj.transferExtrinsicContainer.pathInLocalId,
                        pathOutLocalId: extrinsicObj.transferExtrinsicContainer.pathOutLocalId,
                        pathInSymbol: currency,
                        pathOutSymbol: currency,
                        pathValue: extrinsicObj.transferExtrinsicContainer.pathAmount,
                        pathSwapType: extrinsicObj.transferExtrinsicContainer.pathSwapType,
                        pathValueNext: pathValueNext
                    }
                    let assetRegistryObject = extrinsicObj.transferExtrinsicContainer.destinationTransferrable.assetRegistryObject
                    let lastNodeChainId = assetRegistryObject.tokenData.chain
                    let lastNodeLocalId = assetRegistryObject.tokenData.localId
                    let lastNodeAssetSymbol = assetRegistryObject.tokenData.symbol
                    lastNodeAssetKey = JSON.stringify(lastNodeChainId.toString() + JSON.stringify(lastNodeLocalId))
                    lastNodeAssetValue = pathValueNext.toString()
                    
                    lastNode = {
                        assetKey: lastNodeAssetKey,
                        assetValue: lastNodeAssetValue,
                        chainId:lastNodeChainId,
                        assetSymbol: lastNodeAssetSymbol
                    }

                    arbExecutionResults.push(arbString)
                    resultPathNodes.push(pathNode)
                    transferTxStats.push(txResultObject)
                } else {
                    console.log("Chain not supported")
                }
                console.log("---------------------------------------------")
            } else if(extrinsicObj.type == "Swap" && extrinsicObj.swapExtrinsicContainer.chainId != 2023){
                console.log("Swap extrinsic")
                let extrinsic = extrinsicObj.swapExtrinsicContainer.extrinsic
                let chain = extrinsicObj.swapExtrinsicContainer.chain
                let api = extrinsicObj.swapExtrinsicContainer.api
                let chainId = extrinsicObj.swapExtrinsicContainer.chainId
                let assetInSymbol = extrinsicObj.swapExtrinsicContainer.assetSymbolIn
                let assetOutSymbol = extrinsicObj.swapExtrinsicContainer.assetSymbolOut
                let assetIn = extrinsicObj.swapExtrinsicContainer.pathInLocalId
                let assetOut = extrinsicObj.swapExtrinsicContainer.pathOutLocalId
                let expectedAmountIn = extrinsicObj.swapExtrinsicContainer.assetAmountIn
                let expectedAmountOut = extrinsicObj.swapExtrinsicContainer.expectedAmountOut
                let reverseTx: ReverseSwapExtrinsicParams = extrinsicObj.swapExtrinsicContainer.reverseTx

                let signer = await getSigner(chopsticks, false)

                let tokenInBalance$ = await watchTokenBalance(chainId, api, assetInSymbol, chain, signer.address)
                let tokenOutBalance$ = await watchTokenBalance(chainId, api, assetOutSymbol, chain, signer.address)

                let tokenInUnsub, tokenOutUnsub;
                let tokenInBalancePromise = getBalanceChange(tokenInBalance$, (unsub) => {
                    tokenInUnsub = unsub
                
                })
                let tokenOutBalancePromise = getBalanceChange(tokenOutBalance$, (unsub) => {
                    tokenOutUnsub = unsub   
                })

                let tokenInBalanceStats:BalanceChangeStats, tokenOutBalanceStats:BalanceChangeStats, tx, txHash;
                try{
                    
                    // **************************************************************************************
                    tx = await executeSwapExtrinsic(extrinsicObj.swapExtrinsicContainer, chopsticks)
                    // **************************************************************************************
                    txHash = tx.txDetails.txHash
                } catch (e) {
                    console.log("ERROR: " + e)
                    
                    await tokenInUnsub()
                    await tokenOutUnsub()
                    // For now just throw if an extrinsic fails, and then execute reverse tx
                    // throw new Error("Swap failed, executing reverse txs")
                    let arbString: ArbExecutionResult = {
                        assetSymbolIn: assetInSymbol,
                        assetSymbolOut: assetOutSymbol,
                        result:`FAILURE: SWAP: (${chain}) ${chainId} ${assetInSymbol} ${expectedAmountIn.toNumber()}-> ${assetOutSymbol} | ERROR: ${e}`
                    }
                    
                    let txDetailsResponse = e.txDetails
                    let txDetails: TxDetails = {
                        success: false,
                        movrInfo: txDetailsResponse
                    }
                    let swapTxResult = {
                        txString: `(${chain}) ${chainId} ${assetInSymbol} -> ${assetOutSymbol}`,
                        txDetails: txDetails
                    }

                    let pathNode: PathNodeValues = {
                        pathInLocalId: extrinsicObj.swapExtrinsicContainer.pathInLocalId,
                        pathOutLocalId: extrinsicObj.swapExtrinsicContainer.pathOutLocalId,
                        pathInSymbol: assetInSymbol,
                        pathOutSymbol: assetOutSymbol,
                        pathSwapType: extrinsicObj.swapExtrinsicContainer.pathSwapType,
                        pathValue: extrinsicObj.swapExtrinsicContainer.pathAmount,
                        pathValueNext: 0
                    }

                    
                    arbExecutionResults.push(arbString)
                    swapTxResults.push(swapTxResult)
                    resultPathNodes.push(pathNode)

                    let extrinsicSetResults: ExtrinsicSetResult = {
                        success: false,
                        arbExecutionResult: arbExecutionResults,
                        resultPathNodes: resultPathNodes,
                        transferTxStats: transferTxStats,
                        swapTxStats: swapTxStats,
                        swapTxResults: swapTxResults,
                        // reverseExtrinsics: reverseExtrinsics,
                        // reverseAssetNodes: reverseNodes,
                        // lastNodeAssetKey: lastNodeAssetKey,
                        // lastNodeAssetValue: lastNodeAssetValue,
                        lastNode: lastNode,
                        extrinsicIndex: extrinsicIndex
                    }
                    return extrinsicSetResults
                }
                tokenInBalanceStats = await tokenInBalancePromise
                tokenOutBalanceStats = await tokenOutBalancePromise
                console.log(`EXPECTED TOKEN IN ${expectedAmountIn.toString()} || EXPECTED TOKEN OUT ${expectedAmountOut.toString()}`)
                console.log(`ACTUAL TOKEN IN ${JSON.stringify(tokenInBalanceStats.changeInBalance.toString())} || ACTUAL TOKEN OUT ${(JSON.stringify(tokenOutBalanceStats.changeInBalance.toString()))}`)

                let swapStats: SwapTxStats = {
                    txHash: txHash,
                    chain: chain,
                    paraId: chainId,
                    currencyIn: assetInSymbol,
                    currencyOut: assetOutSymbol,
                    expectedAmountIn: expectedAmountIn.toString(),
                    actualAmountIn: tokenInBalanceStats.changeInBalance.toString(),
                    expectedAmountOut: expectedAmountOut.toString(),
                    actualAmountOut: tokenOutBalanceStats.changeInBalance.toString(),
                    tokenInBalanceChange: tokenInBalanceStats,
                    tokenOutBalanceChange: tokenOutBalanceStats,
                } 

                // logSwapTxResults(tx, logFilePath)
                let assetNodes = extrinsicObj.swapExtrinsicContainer.assetNodes
                assetNodes.forEach((node, index) => {
                    let reverseAssetNode;
                    if(index == assetNodes.length - 1){
                    reverseAssetNode = new AssetNode({
                        paraspellChain: node.paraspellChain,
                        paraspellAsset: node.paraspellAsset,
                        assetRegistryObject: node.assetRegistryObject,
                        pathValue: tokenOutBalanceStats.changeInBalance.toNumber(),
                        pathType: node.pathType
                    })
                    } else if(index > 0){
                        reverseAssetNode = new AssetNode({
                            paraspellChain: node.paraspellChain,
                            paraspellAsset: node.paraspellAsset,
                            assetRegistryObject: node.assetRegistryObject,
                            pathValue: node.pathValue,
                            pathType: node.pathType
                        })
                    }
                    // reverseNodes.push(reverseAssetNode)
                })


                let swapTxResult = {
                    txString: `(${chain}) ${chainId} ${assetInSymbol} -> ${assetOutSymbol}`,
                    txDetails: tx.txDetails
                }
                let actualAmountIn = tokenInBalanceStats.changeInBalance.toString()
                let actualAmountOut = tokenOutBalanceStats.changeInBalance.toString()

                let arbResultString: ArbExecutionResult = {
                    assetSymbolIn: assetInSymbol,
                    assetSymbolOut: assetOutSymbol,
                    result:`SUCCESS: ${tx.txDetails.success} - SWAP: (${chain}) ${chainId} ${assetInSymbol} ${actualAmountIn}-> ${assetOutSymbol} ${actualAmountOut} | `
                }
                
                let pathValueNext = Number.parseFloat(tokenOutBalanceStats.changeInBalanceString)

                let pathNode: PathNodeValues = {
                    pathInLocalId: extrinsicObj.swapExtrinsicContainer.pathInLocalId,
                    pathOutLocalId: extrinsicObj.swapExtrinsicContainer.pathOutLocalId,
                    pathInSymbol: assetInSymbol,
                    pathOutSymbol: assetOutSymbol,
                    pathSwapType: extrinsicObj.swapExtrinsicContainer.pathSwapType,
                    pathValue: extrinsicObj.swapExtrinsicContainer.pathAmount,
                    pathValueNext:pathValueNext
                }
                
                swapTxStats.push(swapStats)
                arbExecutionResults.push(arbResultString)
                swapTxResults.push(swapTxResult)
                resultPathNodes.push(pathNode)

                let assetRegistryObject = extrinsicObj.swapExtrinsicContainer.assetNodes[extrinsicObj.swapExtrinsicContainer.assetNodes.length - 1].assetRegistryObject;
                let lastNodeChainId = assetRegistryObject.tokenData.chain
                let lastNodeLocalId = assetRegistryObject.tokenData.localId
                let lastNodeAssetSymbol = assetRegistryObject.tokenData.symbol
                lastNodeAssetKey = JSON.stringify(lastNodeChainId.toString() + JSON.stringify(lastNodeLocalId))
                lastNodeAssetValue = pathValueNext.toString()
                lastNode = {
                    assetKey: lastNodeAssetKey,
                    assetValue: lastNodeAssetValue,
                    chainId:lastNodeChainId,
                    assetSymbol: lastNodeAssetSymbol
                }

                console.log("---------------------------------------------")
                // console.log(JSON.stringify(extrinsic, null, 2))
            } else if(extrinsicObj.type == "Swap" && extrinsicObj.swapExtrinsicContainer.chainId == 2023 && executeMovr == true){
                let movrTx = extrinsicObj.swapExtrinsicContainer.extrinsic
                let chain = extrinsicObj.swapExtrinsicContainer.chain
                let api = extrinsicObj.swapExtrinsicContainer.api
                let chainId = extrinsicObj.swapExtrinsicContainer.chainId
                let assetInSymbol = extrinsicObj.swapExtrinsicContainer.assetSymbolIn
                let assetOutSymbol = extrinsicObj.swapExtrinsicContainer.assetSymbolOut
                // let assetIn = extrinsicObj.swapExtrinsicContainer.pathInLocalId
                // let assetOut = extrinsicObj.swapExtrinsicContainer.pathOutLocalId
                let expectedAmountIn = extrinsicObj.swapExtrinsicContainer.assetAmountIn
                let expectedAmountOut = extrinsicObj.swapExtrinsicContainer.expectedAmountOut
                if(extrinsicIndex == 0){
                    let firstAssetNode = extrinsicObj.swapExtrinsicContainer.assetNodes[0]
                    let paraspellChain = chain
                    let paraspellAsset = firstAssetNode.paraspellAsset
                    let assetRegistryObject = firstAssetNode.assetRegistryObject
                    let pathValue = firstAssetNode.pathValue
                    let pathType = firstAssetNode.pathType
                }
                

                // const txString = `MOV ${startAsset} -> ${destAsset}`
                // let movrBatchSwapParams = await getMovrSwapTx(instructions, false)
                
                // let liveWallet = movrBatchSwapParams.wallet;
                // let batchContract = movrBatchSwapParams.batchContract;
                
            

                let movrBatchSwapParams = extrinsicObj.swapExtrinsicContainer.movrBatchSwapParams
                let liveWallet = movrBatchSwapParams.wallet
                let batchContract = movrBatchSwapParams.batchContract
                let tokens = movrBatchSwapParams.inputTokens
                let reverseTxParams = movrBatchSwapParams.reverseSwapParams
                let dexes = movrBatchSwapParams.dexAddresses
                let inputTokens = movrBatchSwapParams.inputTokens
                let outputTokens = movrBatchSwapParams.outputTokens
                let movrTxInfo = {
                    inputTokens: inputTokens,
                    outputTokens: outputTokens,
                    dexes: dexes
                }

                let batchContractAddress = await batchContract.getAddress()
                console.log(`Wallet: ${liveWallet.address} | Batch Contract: ${batchContractAddress}`)
                // let signer = await getSigner(true)

                for(let i = 0; i < tokens.length; i++){
                    let tokenInput = movrBatchSwapParams.amount0Ins[i] > 0 ? movrBatchSwapParams.amount0Ins[i] : movrBatchSwapParams.amount1Ins[i]
                    let approval = await checkAndApproveToken(tokens[i], liveWallet, batchContractAddress, tokenInput)
                }

                let unsubscribeOne, unsubscribeTwo;
                let balanceObservableIn$ = await watchTokenBalance(chainId, api, assetInSymbol, chain, liveWallet.address)
                let balanceObservableOut$ = await watchTokenBalance(chainId, api, assetOutSymbol, chain, liveWallet.address)
                let balancePromiseIn = await getBalanceChange(balanceObservableIn$, (unsub) => {
                    unsubscribeOne = unsub
                })
                let balancePromiseOut = await getBalanceChange(balanceObservableOut$, (unsub) => {
                    unsubscribeTwo = unsub
                })

                try{
                    // **************************************************************************************
                    let txReceipt = await movrTx()
                    let txHash = await txReceipt.wait()
                    // **************************************************************************************
        
                    let tokenInBalanceStats = await balancePromiseIn
                    let tokenOutBalanceStats = await balancePromiseOut
                    console.log(`EXPECTED TOKEN IN ${expectedAmountIn.toString()} || ACTUAL TOKEN IN ${JSON.stringify(tokenInBalanceStats.startBalanceString.toString())}`)
                    console.log(`EXPECTED TOKEN OUT ${expectedAmountOut.toString()} || ACTUAL TOKEN IN ${JSON.stringify(tokenInBalanceStats.changeInBalance.toString())}`)
                    
                    let swapStats: SwapTxStats = {
                        txHash: txHash,
                        chain: chain,
                        paraId: chainId,
                        currencyIn: assetInSymbol,
                        currencyOut: assetOutSymbol,
                        expectedAmountIn: expectedAmountIn.toString(),
                        actualAmountIn: tokenInBalanceStats.changeInBalance.toString(),
                        expectedAmountOut: expectedAmountOut.toString(),
                        actualAmountOut: tokenOutBalanceStats.changeInBalance.toString(),
                        tokenInBalanceChange: tokenInBalanceStats,
                        tokenOutBalanceChange: tokenOutBalanceStats,
                    }
        
                    let assetNodes = extrinsicObj.swapExtrinsicContainer.assetNodes
                    assetNodes.forEach((node, index) => {
                        let reverseAssetNode;
                        if(index == assetNodes.length - 1){
                        reverseAssetNode = new AssetNode({
                            paraspellChain: node.paraspellChain,
                            paraspellAsset: node.paraspellAsset,
                            assetRegistryObject: node.assetRegistryObject,
                            pathValue: tokenOutBalanceStats.changeInBalance.toNumber(),
                            pathType: node.pathType
                        })
                        } else if(index > 0){
                            reverseAssetNode = new AssetNode({
                                paraspellChain: node.paraspellChain,
                                paraspellAsset: node.paraspellAsset,
                                assetRegistryObject: node.assetRegistryObject,
                                pathValue: node.pathValue,
                                pathType: node.pathType
                            })
                        }
                        // reverseNodes.push(reverseAssetNode)
                    })

                    let actualAmountIn = tokenInBalanceStats.changeInBalance.toString()
                    let actualAmountOut = tokenOutBalanceStats.changeInBalance.toString()
                    // logSwapTxResults(tx, logFilePath)
                    let arbResultString: ArbExecutionResult = {
                        assetSymbolIn: assetInSymbol,
                        assetSymbolOut: assetOutSymbol,
                        result: `SUCCESS: ${false} - SWAP: (${chain}) ${chainId} ${assetInSymbol} ${actualAmountIn}-> ${assetOutSymbol} ${actualAmountOut}| Dexes: ${JSON.stringify(dexes)}`
                    }
                    let txDetails: TxDetails = {
                        success: true,
                        txHash: txHash,
                        movrInfo: movrTxInfo
                    }
                    let swapTxResult = {
                        txString: `(${chain}) ${chainId} ${assetInSymbol} -> ${assetOutSymbol}`,
                        txDetails: txDetails
                    }
                    let pathValueNext = Number.parseFloat(tokenOutBalanceStats.changeInBalanceString)
                    let pathNode: PathNodeValues = {
                        pathInLocalId: extrinsicObj.transferExtrinsicContainer.pathInLocalId,
                        pathOutLocalId: extrinsicObj.transferExtrinsicContainer.pathOutLocalId,
                        pathInSymbol: assetInSymbol,
                        pathOutSymbol: assetOutSymbol,
                        pathSwapType: extrinsicObj.transferExtrinsicContainer.pathSwapType,
                        pathValue: extrinsicObj.transferExtrinsicContainer.pathAmount,
                        pathValueNext: pathValueNext
                    
                    }
                    resultPathNodes.push(pathNode)
                    swapTxStats.push(swapStats)
                    swapTxResults.push(swapTxResult)
                    arbExecutionResults.push(arbResultString)

                    let assetRegistryObject = extrinsicObj.swapExtrinsicContainer.assetNodes[extrinsicObj.swapExtrinsicContainer.assetNodes.length - 1].assetRegistryObject;
                    let lastNodeChainId = assetRegistryObject.tokenData.chain
                    let lastNodeLocalId = assetRegistryObject.tokenData.localId
                    let lastNodeAssetSymbol = assetRegistryObject.tokenData.symbol
                    lastNodeAssetKey = JSON.stringify(lastNodeChainId.toString() + JSON.stringify(lastNodeLocalId))
                    lastNodeAssetValue = pathValueNext.toString()
                    lastNode = {
                        assetKey: lastNodeAssetKey,
                        assetValue: lastNodeAssetValue,
                        chainId:lastNodeChainId,
                        assetSymbol: lastNodeAssetSymbol

                    }
                } catch(e){
                    unsubscribeOne()
                    unsubscribeTwo()
                    console.log("ERROR: " + e)
                    console.log("MOVR swap failed")
                    let txDetails: TxDetails = {
                        success: false,
                        movrInfo: movrTxInfo
                    }
                    let swapTxResult = {
                        txString: `(${chain}) ${chainId} ${assetInSymbol} -> ${assetOutSymbol}`,
                        txDetails: txDetails
                    }

                    let arbResultString: ArbExecutionResult = {
                        assetSymbolIn: assetInSymbol,
                        assetSymbolOut: assetOutSymbol,
                        result: `SUCCESS: ${false} - SWAP: (${chain}) ${chainId} ${assetInSymbol} ${expectedAmountIn} -> ${assetOutSymbol} | Dexes: ${JSON.stringify(dexes)}`
                    }
                    let pathNode: PathNodeValues = {
                        pathInLocalId: extrinsicObj.swapExtrinsicContainer.pathInLocalId,
                        pathOutLocalId: extrinsicObj.swapExtrinsicContainer.pathOutLocalId,
                        pathInSymbol: assetInSymbol,
                        pathOutSymbol: assetOutSymbol,
                        pathSwapType: extrinsicObj.swapExtrinsicContainer.pathSwapType,
                        pathValue: extrinsicObj.swapExtrinsicContainer.pathAmount,
                        pathValueNext:0
                    }
                    swapTxResults.push(swapTxResult)
                    arbExecutionResults.push(arbResultString)
                    resultPathNodes.push(pathNode)
                    // let pathNextValue = Number.parseFloat(tokenOutBalanceStats.changeInBalanceString)

                    
                    let extrinsicSetResults: ExtrinsicSetResult = {
                        success: false,
                        arbExecutionResult: arbExecutionResults,
                        resultPathNodes: resultPathNodes,
                        transferTxStats: transferTxStats,
                        swapTxStats: swapTxStats,
                        swapTxResults: swapTxResults,
                        lastNode: lastNode,
                        extrinsicIndex: extrinsicIndex
                    }
                    return extrinsicSetResults
                }
            }
                
            extrinsicIndex += 1;
        // }  
        executionLoopIndex += 1;
    } 

    } catch(e){
        console.log(e)
        throw new Error("Extrinsic failed, should have return set results before this")
    }   

    logSwapTxStats(swapTxStats, logFilePath, reverseSwaps)
    logSwapTxResults(swapTxResults, logFilePath, reverseSwaps)
    logTransferTxStats(transferTxStats, logFilePath, reverseSwaps)
    logArbExecutionResults(arbExecutionResults, logFilePath, reverseSwaps)

    let extrinsicSetResults: ExtrinsicSetResult = {
        success: true,
        arbExecutionResult: arbExecutionResults,
        resultPathNodes: resultPathNodes,
        transferTxStats: transferTxStats,
        swapTxStats: swapTxStats,
        swapTxResults: swapTxResults,
        lastNode: lastNode,
        extrinsicIndex: extrinsicIndex
    }
    return extrinsicSetResults
}


async function executeTransferExtrinsic(transfer: TransferExtrinsicContainer, startParaId: number, chopsticks: boolean) {
    let signer;
    if(startParaId ==2023){
        signer = await getSigner(chopsticks, true)
    } else {
        signer = await getSigner(chopsticks, false);
    }
    
    let tx = transfer.extrinsic
    // signer.
    // let txNonce = 0
    let execute;
    if(chopsticks){
        let localRpc = localRpcs[transfer.firstNode]
        if(localRpc){
            execute = true
        } else {
            execute = false
        }
    } else {
        execute = true
    }
    
    if(execute){
        // console.log("EXECUTING TRANSFER")
        console.log(`Execute Transfer: (${transfer.firstNode} -> ${transfer.secondNode}) ${JSON.stringify(transfer.assetSymbol)} ${JSON.stringify(transfer.assetIdStart)}`)

        let txResult: any= new Promise((resolve, reject) => {
            let success = false;
            let included: EventRecord[] = [];
            let finalized: EventRecord[] = [];
            let eventLogs: any[] = [];
            let blockHash: string = "";
            let dispatchErrorCode;
            let decodedError;
            console.log(`Execute Transfer: Sending tx -- ${JSON.stringify(tx.toHuman())}`)
            tx.signAndSend(signer, ({ events = [], status, txHash, txIndex, dispatchError }) => {
                if (status.isInBlock) {
                    success = dispatchError ? false : true;
                    console.log(
                        `Execute Transfer: 📀 Transaction ${tx.meta.name}(..) included at blockHash ${status.asInBlock} [success = ${success}]`
                    );
                    included = [...events];

                } else if (status.isBroadcast) {
                    console.log(`Execute Transfer: 🚀 Transaction broadcasted.`);
                } else if (status.isFinalized) {
                    console.log(
                        `Execute Transfer: 💯 Transaction ${tx.meta.name}(..) Finalized at blockHash ${status.asFinalized}`
                    );
                    blockHash = status.asFinalized.toString();
                    finalized = [...events];
                    events.forEach((eventObj) => {
                        eventLogs.push(eventObj.toHuman())
                        if(eventObj.event.method == "ExtrinsicFailed" && dispatchError){
                            const {index, error} = dispatchError.asModule;
                            const moduleIndex = parseInt(index.toString(), 10);
                            const errorCodeHex = error.toString().substring(2, 4); // "09"
                            const errorIndex = parseInt(errorCodeHex, 16);

                            // Get the module and error metadata
                            decodedError = tx.registry.findMetaError({index: new BN(moduleIndex), error: new BN(errorIndex)});
                            dispatchErrorCode = dispatchError.asModule;
                            console.log("Execute Transfer: Dispatch Error: " + dispatchError.toString())
                            console.log("Execute Transfer: DECODED MODULE: " + JSON.stringify(decodedError, null, 2))

                        }
                    })
                    const hash = status.hash;
                    let txDetails: TxDetails = { success, hash, dispatchError: dispatchErrorCode, decodedError, included, finalized, eventLogs, blockHash, txHash, txIndex };
                    resolve(txDetails);
                } else if (status.isReady) {
                    // let's not be too noisy..
                    console.log("Execute Transfer: Status: Ready")
                } else if (dispatchError){
                    console.log("Execute Transfer: Dispatch error: " + dispatchError.toString())
                    if(dispatchError.isModule){
                        const decoded = tx.registry.findMetaError(dispatchError.asModule);
                        console.log("Execute Transfer: DISPATCH ERROR DECODED: " + JSON.stringify(decoded, null, 2))
                        const { docs, name, section } = decoded;
                        reject(new Error(`${section}.${name}: ${docs.join(' ')}`));
                    } else {
                        reject(new Error(dispatchError.toString()));
                    
                    }
                }
                else {
                    console.log(`Execute Transfer: 🤷 Other status ${status}`);
                }
            }).catch((error) => {
                console.log("Execute Transfer: Error: " + error);
                reject(error);
            });
        });
        console.log("Execute Transfer: tx promise created")
        let txDetails: TxDetails = await txResult;
        let resultObject = {
            // txString,
            txDetails
        }
        return resultObject
    } else {
        console.log("Execute Transfer: NOT EXECUTING TRANSFER")
    } 
    return false
}
async function executeSwapExtrinsic(txContainer: SwapExtrinsicContainer, chopsticks: boolean) {
    let signer = await getSigner(chopsticks, false);
    //If MOVR/EVM execute smart contract call
    if(txContainer.chainId == 2023){
        let tx = txContainer.extrinsic
        // let txNonce = txContainer.nonce
        const txString = txContainer.txString
        // console.log(`Executing tx with nonce: ${txNonce} ${txString}`)
        console.log(JSON.stringify(tx))
        // let swapTx = await tx()
        // let swapReceipt = await swapTx.wait()
        let resultObject: SwapResultObject = {
            txString
        }
        
        return resultObject
    } else {
        if(txContainer.extrinsic){
            let tx = txContainer.extrinsic
            let txNonce = txContainer.nonce
            const txString = txContainer.txString
            let accountNonce
            if(txContainer.api){
                try{
                    let accountData = await txContainer.api.query.system.account(signer.address)
                    accountNonce = accountData.nonce.toNumber()
                } catch(e){
                    console.log("Error getting account nonce")
                }
                
            }

            console.log(`Execute Swap: Executing tx with nonce: ${txNonce} ${txString}`)
            console.log(`Execute Swap: ACCOUNT NONCE QUERY: ${JSON.stringify(accountNonce)}`)
            console.log(JSON.stringify(tx.toHuman()))

            // let txHash = await tx.signAndSend(signer, {nonce: txNonce}, (result) => {
                
            // });
            let txResult: any= new Promise((resolve, reject) => {
                let success = false;
                let included: EventRecord[] = [];
                let finalized: EventRecord[] = [];
                let eventLogs: any[] = [];
                let blockHash: string = "";
                let dispatchErrorCode;
                let decodedError;
                tx.signAndSend(signer, {nonce: accountNonce}, ({ events = [], status, txHash, txIndex, dispatchError }) => {
                    if (status.isInBlock) {
                        success = dispatchError ? false : true;
                        console.log(
                            `Execute Swap: 📀 Transaction ${tx.meta.name}(..) included at blockHash ${status.asInBlock} [success = ${success}]`
                        );
                        included = [...events];
    
                    } else if (status.isBroadcast) {
                        console.log(`Execute Swap: 🚀 Transaction broadcasted.`);
                    } else if (status.isFinalized) {
                        console.log(
                            `Execute Swap: 💯 Transaction ${tx.meta.name}(..) Finalized at blockHash ${status.asFinalized}`
                        );
                        blockHash = status.asFinalized.toString();
                        finalized = [...events];
                        events.forEach((eventObj) => {
                            eventLogs.push(eventObj.toHuman())
                            if(eventObj.event.method == "ExtrinsicFailed" && eventObj.event.data.dispatchError){
                                const {index, error} = dispatchError.asModule;
                                const moduleIndex = parseInt(index, 10);
                                const errorCodeHex = error.toString().substring(2, 4); // "09"
                                const errorIndex = parseInt(errorCodeHex, 16);

                                // Get the module and error metadata
                                decodedError = tx.registry.findMetaError({index: new BN(moduleIndex), error: new BN(errorIndex)});
                                dispatchErrorCode = dispatchError.asModule;
                                console.log("Execute Swap: Dispatch Error: " + dispatchError.toString())
                                console.log("Execute Swap: DECODED MODULE: " + JSON.stringify(decodedError, null, 2))
                                let txDetails: TxDetails = { success, dispatchError: dispatchErrorCode, decodedError, included, finalized, blockHash, eventLogs };
                                // console.log("Execute Swap: txDetails Object: " + JSON.stringify(txDetails, null, 2))
                                reject(txDetails);
                            }
                        })
                        const hash = status.hash;
                        let txDetails: TxDetails = { success, hash, dispatchError: dispatchErrorCode, decodedError, eventLogs, blockHash, txHash, txIndex };
                        resolve(txDetails);
                    } else if (status.isReady) {
                        // let's not be too noisy..
                    } else if (dispatchError){
                        console.log("Execute Swap: Dispatch error: " + dispatchError.toString())
                        if(dispatchError.isModule){
                            const decoded = tx.registry.findMetaError(dispatchError.asModule);
                            console.log("Execute Swap: DISPATCH ERROR DECODED: " + JSON.stringify(decoded, null, 2))
                            const { docs, name, section } = decoded;
                            let txDetails: TxDetails = { success:false, dispatchError: dispatchErrorCode, decodedError, included, finalized, blockHash, eventLogs }
                            reject(txDetails);
                        } else {
                            let txDetails: TxDetails = { success:false, dispatchError: dispatchErrorCode, decodedError, included, finalized, blockHash, eventLogs }
                            reject(txDetails);
                        
                        }
                    }
                    else {
                        console.log(`Execute Swap: 🤷 Other status ${status}`);
                        let txDetails: TxDetails = { success:false, dispatchError: dispatchErrorCode, decodedError, included, finalized, blockHash, eventLogs }
                        reject(txDetails)
                    }
                }).catch((error) => {
                    console.log("Execute Swap: Error: " + error);
                    let txDetails: TxDetails = { success:false, dispatchError: dispatchErrorCode, decodedError, included, finalized, blockHash, eventLogs }
                    reject(txDetails);
                });
            });
            let txDetails: TxDetails = await txResult;
            let resultObject: SwapResultObject = {
                // txString,
                txDetails
            }
            return resultObject
        }

    }
    
}

async function runArbTester(chopsticks: boolean){
    let latestFile = getLatestFileFromLatestDay()
    let [assetPath, reversePath] = constructRoute(latestFile)
    let reverse
    let instructionsPromise = buildInstructionSet(assetPath)


    let [instructions]= await Promise.all([instructionsPromise])

    logInstructions(instructions, latestFile)
    // logInstructions(reverseInstructions, latestFile, true)

    let executeMovr = false
    let extrinsicsPromise = buildExtrinsicSet(instructions, chopsticks)
    // let reverseExtrinsicsPromise = buildExtrinsicSet(reverseInstructions)
    let [extrinsics] = await Promise.all([extrinsicsPromise])
    // if(extrinsics.length != reverseExtrinsics.length){
    //     throw new Error("Extrinsics and reverse extrinsics are not the same length")
    // }
    logSubmittableExtrinsics(extrinsics, latestFile)

    let results: ExtrinsicSetResult = await executeExtrinsicSet(extrinsics, latestFile, executeMovr, false, chopsticks)

    console.log("Execution complete, now executing reverse")
    console.log("******************************************")

    if(results.extrinsicIndex > 0) {
        // Get last node key and pass it to arb finder, function: search_a_to_b --LAST_NODE --LAST_NODE_VALUE -> --KSM
        let lastNodeAssetKey = results.lastNode.assetKey;
        let lastNodeAssetValue = results.lastNode.assetValue;
        let lastNodeChainId = results.lastNode.chainId;
        let lastNodeAssetSymbol = results.lastNode.assetSymbol;

        console.log("LAST NODE ASSET KEY: " + lastNodeAssetKey)
        let ksmTargetNode = '"2000{\\"NativeAssetId\\":{\\"Token\\":\\"KSM\\"}}"'
        let functionArgs = `${lastNodeAssetKey} ${ksmTargetNode} ${lastNodeAssetValue}`
        console.log("Executing Arb Fallback with args: " + functionArgs)

        if(lastNodeChainId == 0){
            console.log("Last node chain is KUSAMA. Cant find arb with that. Can just exit successfully")
        } else {
            let fallbackArbResults: ResultDataObject[] = await runAndReturnFallbackArb(functionArgs)
            console.log("Fallback Arb Results: ")
            console.log(JSON.stringify(fallbackArbResults, null, 2))
    
            let assetPath: AssetNode[] = fallbackArbResults.map(result => readLogData(result))
    
            console.log("Asset Path: ")
            console.log(JSON.stringify(assetPath, null, 2))
        
            let reverseInstructions = await buildInstructionSet(assetPath)
        
            let reverseExtrinsicSet = await buildExtrinsicSet(reverseInstructions, chopsticks)
        
            console.log("Executing Reverse Extrinsics: ")
            let latestFile = getLatestFileFromLatestDay()
            let reverseResults: ExtrinsicSetResult = await executeExtrinsicSet(reverseExtrinsicSet, latestFile, false, true, chopsticks)
    
            console.log("ORIGIN EXTRINSICS")
            console.log(JSON.stringify(results.success, null, 2))
            console.log(JSON.stringify(results.arbExecutionResult, null, 2))
            console.log(JSON.stringify(results.extrinsicIndex, null, 2))
    
            console.log("REVERSE EXTRINSICS")
            console.log(JSON.stringify(reverseResults.success, null, 2))
            console.log(JSON.stringify(reverseResults.arbExecutionResult, null, 2))
            console.log(JSON.stringify(reverseResults.extrinsicIndex, null, 2))
        }


    } else {
        console.log("No extrinsics completed. No reverse extrinsics")
    }
}

async function testArbFallback(){
    let ksmTargetNode = '"2000{\\"NativeAssetId\\":{\\"Token\\":\\"KSM\\"}}"'
    let startNode = '"2001{\\"Native\\":\\"BNC\\"}"'
    let startNodeValue = "50"
    let functionArgs = `${startNode} ${ksmTargetNode} ${startNodeValue}`
    console.log("Executing Arb Fallback with args: " + functionArgs)
    let fallbackArbResults: ResultDataObject[] = await runAndReturnFallbackArb(functionArgs)
    let assetPath: AssetNode[] = fallbackArbResults.map(result => readLogData(result))

    console.log("Asset Path: ")
    console.log(JSON.stringify(assetPath, null, 2))

    let reverseInstructions = await buildInstructionSet(assetPath)
    let chopsticks = true
    let reverseExtrinsicSet = await buildExtrinsicSet(reverseInstructions, chopsticks)

    console.log("Executing Reverse Extrinsics: ")
    let latestFile = getLatestFileFromLatestDay()
    let results: ExtrinsicSetResult = await executeExtrinsicSet(reverseExtrinsicSet, latestFile, false, true, chopsticks)

    console.log(JSON.stringify(results.success, null, 2))
    console.log(JSON.stringify(results.arbExecutionResult, null, 2))
    console.log(JSON.stringify(results.extrinsicIndex, null, 2))
}

async function testMovrBalanceOnMgx(){
    let chainId = 2110
    let mgxRpc = localRpcs["Mangata"]
    const mangata: MangataInstance = Mangata.instance([])
    let mgxApi = await mangata.api()
    let wallet = await getSigner(true, false)
    let assetSymbol = "MOVR"
    let node = "Mangata"
    let assetId = 1
    let observable = await watchTokenBalance(chainId, mgxApi, assetSymbol, node, wallet.address)
    let unsubscribe;
    let balance = await getBalanceChange(observable, (unsub) => {
        unsubscribe = unsub
    })
    console.log(`Balance of ${assetSymbol} on ${chainId}: ${balance}`)

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
    await testDotWallet()
//     let chopsticks = true
//     await runArbTester(chopsticks)
    // await testArbFallback()
    process.exit(0)
}

run()

function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
