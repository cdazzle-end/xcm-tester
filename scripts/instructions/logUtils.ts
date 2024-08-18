import { ExtrinsicObject, SwapInstruction, TransferInstruction, InstructionType, TransferTxStats, SwapTxStats, ArbExecutionResult, ExtrinsicSetResultDynamic, LastFilePath, Relay, AccumulatedFeeData, ReserveFeeData, TransferDepositEventData, TransferDepositJsonData } from "./types.ts";
import path from 'path';
import fs from 'fs';
import bn from 'bignumber.js';
// import { globalState } from "./liveTest.ts";
declare const fetch: any;

import { fileURLToPath } from 'url';
import { getParaId } from "@paraspell/sdk";
import { getAssetRegistryObject, isSwapResult, isTransferResult } from "./utils.ts";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);



export async function queryUsdPriceKucoin(assetSymbol: string){
    let baseUrl = "https://api.kucoin.com";
    const orderBook = "/api/v1/market/orderbook/level2_20";
    let url = `https://api.kucoin.com/api/v1/market/orderbook/level1?symbol=${assetSymbol}-USDT`

    let requestParameter = "?symbol=" + assetSymbol + "-USDT";
    let uri = baseUrl + orderBook + requestParameter;
    const response = await fetch(uri);
    let answer = await response.json();
    // let bids = answer.data.bids;
    let asks = answer.data.asks;
    let askPrice = asks[0][0];
    console.log(askPrice)

    // let testKsmAmount = 0.017263821728000006
    // let arbAmountOutUsd = testKsmAmount * askPrice
    // let arbAmountOutUsdString = `$ ${arbAmountOutUsd.toFixed(2)}`
    // console.log(arbAmountOutUsdString)

    return Number.parseFloat(askPrice)
}

export async function logSubmittableExtrinsics(extrinsicSet: ExtrinsicObject[], logFilePath: string, reverse: boolean = false) {
    let logFileStrings = logFilePath.split("\\");
    let logFileDay = logFileStrings[logFileStrings.length - 2]
    let logFileTime = logFileStrings[logFileStrings.length - 1]


    let loggableExtrinsics = extrinsicSet.map((extrinsic) => {
        let loggableTx

        if(extrinsic.type == "Swap"){
            if(!extrinsic.swapExtrinsicContainer){
                throw new Error("swap tx container undefined")
            }
            try {
                loggableTx = {
                    type: extrinsic.type,
                    chainId: extrinsic.swapExtrinsicContainer.chainId,
                    chain: extrinsic.swapExtrinsicContainer.chain,
                    assetIn: extrinsic.swapExtrinsicContainer.assetSymbolIn,
                    assetOut: extrinsic.swapExtrinsicContainer.assetSymbolOut,
                    amountIn: extrinsic.swapExtrinsicContainer.assetAmountIn.toString(),
                    expectedAmountOut: extrinsic.swapExtrinsicContainer.expectedAmountOut.toString(),
                    txString: extrinsic.swapExtrinsicContainer.txString,
                    extrinsic: extrinsic.swapExtrinsicContainer.extrinsic.toHuman()
                }
                return loggableTx
            } catch (e){
                // console.log(extrinsic)
                loggableTx = {
                    type: extrinsic.type,
                    chainId: extrinsic.swapExtrinsicContainer.chainId,
                    chain: extrinsic.swapExtrinsicContainer.chain,
                    assetIn: extrinsic.swapExtrinsicContainer.assetSymbolIn,
                    assetOut: extrinsic.swapExtrinsicContainer.assetSymbolOut,
                    amountIn: extrinsic.swapExtrinsicContainer.assetAmountIn.toString(),
                    expectedAmountOut: extrinsic.swapExtrinsicContainer.expectedAmountOut.toString(),
                    txString: extrinsic.swapExtrinsicContainer.txString,
                    extrinsic: extrinsic.swapExtrinsicContainer.extrinsic
                }
                return loggableTx
            }
        } else {
            if(!extrinsic.transferExtrinsicContainer){
                throw new Error("transfer tx container undefined")
            }
            try{
                loggableTx = {
                    type: extrinsic.type,
                    chainId: extrinsic.transferExtrinsicContainer.startChainId,
                    startChain: extrinsic.transferExtrinsicContainer.firstNode,
                    startNode: extrinsic.transferExtrinsicContainer.firstNode,
                    destChain: extrinsic.transferExtrinsicContainer.secondNode,
                    destNode: extrinsic.transferExtrinsicContainer.secondNode,
                    assetSymbol: extrinsic.transferExtrinsicContainer.assetSymbol,
                    extrinsic: extrinsic.transferExtrinsicContainer.extrinsic.toHuman()
                }
                return loggableTx
            } catch (e){
                
                // console.log(extrinsic)
                loggableTx = {
                    type: extrinsic.type,
                    chainId: extrinsic.transferExtrinsicContainer.startChainId,
                    startChain: extrinsic.transferExtrinsicContainer.firstNode,
                    startNode: extrinsic.transferExtrinsicContainer.firstNode,
                    destChain: extrinsic.transferExtrinsicContainer.secondNode,
                    destNode: extrinsic.transferExtrinsicContainer.secondNode,
                    assetSymbol: extrinsic.transferExtrinsicContainer.assetSymbol,
                    extrinsic: extrinsic.transferExtrinsicContainer.extrinsic
                }
                return loggableTx
            }
        }
    })

    // loggableExtrinsics.forEach((extrinsic) => {
    //     console.log(extrinsic)
    //     if(extrinsic.type == "Swap"){
    //         console.log(JSON.stringify(extrinsic.swapExtrinsic.extrinsic, null, 2))
    //     } else {
    //         console.log(JSON.stringify(extrinsic.transferExtrinsic.extrinsic, null, 2))
    //     }
    // })
    

    let logFileData = JSON.stringify(loggableExtrinsics, null, 2)
    let directoryPath
    if(reverse){
        directoryPath = path.join(__dirname, './reverse/submittableExtrinsics/', logFileDay);
    } else {
        directoryPath = path.join(__dirname, './submittableExtrinsics/', logFileDay);
    }
    // Check if directory exists, create if it doesn't
    if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, { recursive: true });
    }

    // Write data to file in the directory
    const filePath = path.join(directoryPath, logFileTime);
    // if(!fs.existsSync(filePath)){
    //     fs.writeFileSync(filePath, logFileData);
    // } else {
    //     fs.appendFileSync(filePath, logFileData);
    // }
    fs.writeFileSync(filePath, logFileData);

    console.log(`Data written to file: ${filePath}`);
}
export async function logInstructions(instructions: (SwapInstruction | TransferInstruction)[], logFilePath: string,reverse: boolean = false) {
    // let logData = JSON.parse(fs.readFileSync(logFilePath, 'utf8'));
    let logFileStrings = logFilePath.split("\\");
    let logFileDay = logFileStrings[logFileStrings.length - 2]
    let logFileTime = logFileStrings[logFileStrings.length - 1]
    // let logFileData = JSON.stringify(instructions, null, 2)

    let directoryPath;
    if(reverse){
        directoryPath = path.join(__dirname, './reverse/instructionResults/', logFileDay);
    } else {
        directoryPath = path.join(__dirname, './instructionResults/', logFileDay);
    }

    let instructStrings = instructions.map((instruction) => {
        let instructionString = ""
        if(instruction.type == 0){
            instructionString = `(${InstructionType[instruction.type]})${instruction.chain} SwapType: ${instruction.pathType} ${JSON.stringify(instruction.assetNodes[0].getAssetLocalId())} ${JSON.stringify(instruction.assetNodes[0].pathValue)} -> ${JSON.stringify(instruction.assetNodes[1].getAssetLocalId())} ${JSON.stringify(instruction.assetNodes[1].pathValue)}`
        } else {
            instructionString = `(${InstructionType[instruction.type]})${instruction.fromChainId} ${JSON.stringify(instruction.assetNodes[0].getAssetLocalId())} ${JSON.stringify(instruction.startAssetNode.getAssetRegistrySymbol())} -> ${instruction.toChainId} ${JSON.stringify(instruction.assetNodes[1].getAssetLocalId())} ${JSON.stringify(instruction.destinationAssetNode.getAssetRegistrySymbol())}`
        }
        return instructionString
    })

    // Check if directory exists, create if it doesn't
    if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, { recursive: true });
    }
    let logFileData = JSON.stringify([instructStrings, instructions], null, 2)
    // Write data to file in the directory
    const filePath = path.join(directoryPath, logFileTime);
    if(!fs.existsSync(filePath)){
        fs.writeFileSync(filePath, logFileData);
    } else {
        fs.appendFileSync(filePath, logFileData);
    }

    console.log(`Data written to file: ${filePath}`);
}
export function logArbExecutionResults(relay: Relay, arbResults: any[], logFilePath: string, chopsticks: boolean){
    // Get day and time for file name
    let logFileStrings = logFilePath.split("\\");
    let logFileDay = logFileStrings[logFileStrings.length - 2]
    let logFileTime = logFileStrings[logFileStrings.length - 1]

    // Data to write to file
    let swapData = JSON.stringify(arbResults, null, 2)

    // Set directory paths
    let mainDirectoryPath, latestDirectoryPath;
    if(chopsticks){
        mainDirectoryPath = path.join(__dirname, `./logResults/chopsticks/${relay}/arbExecutionResults/`, logFileDay);
        latestDirectoryPath = path.join(__dirname, `./logResults/chopsticks/latestAttempt/${relay}/`);
        
    } else {
        mainDirectoryPath = path.join(__dirname, `./logResults/${relay}/arbExecutionResults/`, logFileDay);
        latestDirectoryPath = path.join(__dirname, `./logResults/latestAttempt/${relay}/`);
    }

    // Check if directory exists, create if it doesn't
    if (!fs.existsSync(mainDirectoryPath)) {
        fs.mkdirSync(mainDirectoryPath, { recursive: true });
    }
    if (!fs.existsSync(latestDirectoryPath)) {
        fs.mkdirSync(latestDirectoryPath, { recursive: true });
    }

    // Write data to file in the directory
    const mainFilePath = path.join(mainDirectoryPath, logFileTime);
    fs.writeFileSync(mainFilePath, swapData);

    // Also write data to latest attempt file
    const latestAttemptPathFile = path.join(latestDirectoryPath, 'arbExecutionResults.json')
    fs.writeFileSync(latestAttemptPathFile, swapData);

    console.log(`Data written to file: ${mainFilePath}`);
}
export async function logSwapTxResults(relay: Relay, txResults: any, logFilePath: string, chopsticks: boolean) {
    // let logData = JSON.parse(fs.readFileSync(logFilePath, 'utf8'));
    let logFileStrings = logFilePath.split("\\");
    let logFileDay = logFileStrings[logFileStrings.length - 2]
    let logFileTime = logFileStrings[logFileStrings.length - 1]
    let logFileData = JSON.stringify(txResults, null, 2)
    
    // Set directory paths
    let mainDirectoryPath, latestDirectoryPath
    if(chopsticks){
        mainDirectoryPath = path.join(__dirname, `./logResults/chopsticks/${relay}/swapExecutionResults/`, logFileDay);
        latestDirectoryPath = path.join(__dirname, `./logResults/chopsticks/latestAttempt/${relay}/`);  
    } else {
        mainDirectoryPath = path.join(__dirname, `./logResults/${relay}/swapExecutionResults/`, logFileDay);
        latestDirectoryPath = path.join(__dirname, `./logResults/latestAttempt/${relay}/`);
    }
    // Check if directory exists, create if it doesn't
    if (!fs.existsSync(mainDirectoryPath)) {
        fs.mkdirSync(mainDirectoryPath, { recursive: true });
    }

    // Check directories
    if(!fs.existsSync(mainDirectoryPath)){
        fs.mkdirSync(mainDirectoryPath, { recursive: true });
    }
    if (!fs.existsSync(latestDirectoryPath)) {
        fs.mkdirSync(latestDirectoryPath, { recursive: true });
    }

    // Write data to file in the directory
    const mainFilePath = path.join(mainDirectoryPath, logFileTime);
    fs.writeFileSync(mainFilePath, logFileData);

    const latestAttemptPathFile = path.join(latestDirectoryPath, 'swapExecutionStats.json')
    fs.writeFileSync(latestAttemptPathFile, logFileData);

    console.log(`Data written to file: ${mainFilePath}`);
}
export function logTransferTxStats(relay: Relay, transferTxStats: TransferTxStats[], logFilePath: string, chopsticks: boolean){
    // Get day and time for file name
    let logFileStrings = logFilePath.split("\\");
    let logFileDay = logFileStrings[logFileStrings.length - 2]
    let logFileTime = logFileStrings[logFileStrings.length - 1]

    // Data to write to file
    let swapData = JSON.stringify(transferTxStats, null, 2)

    // Set directory paths
    let mainDirectoryPath, latestDirectoryPath;
    if(chopsticks){
        mainDirectoryPath = path.join(__dirname, `./logResults/chopsticks/${relay}/transferExecutionResults/`, logFileDay);
        latestDirectoryPath = path.join(__dirname, `./logResults/chopsticks/latestAttempt/${relay}/`);
        
    } else {
        mainDirectoryPath = path.join(__dirname, `./logResults/${relay}/transferExecutionResults/`, logFileDay);
        latestDirectoryPath = path.join(__dirname, `./logResults/latestAttempt/${relay}/`);
    }

    // Check if directory exists, create if it doesn't
    if (!fs.existsSync(mainDirectoryPath)) {
        fs.mkdirSync(mainDirectoryPath, { recursive: true });
    }
    if (!fs.existsSync(latestDirectoryPath)) {
        fs.mkdirSync(latestDirectoryPath, { recursive: true });
    }

    // Write data to file in the directory
    const mainFilePath = path.join(mainDirectoryPath, logFileTime);
    fs.writeFileSync(mainFilePath, swapData);

    // Also write data to latest attempt file
    const latestAttemptPathFile = path.join(latestDirectoryPath, 'transferExecutionResults.json')
    fs.writeFileSync(latestAttemptPathFile, swapData);

    console.log(`Data written to file: ${mainFilePath}`);
}
export function logSwapTxStats(relay: Relay, swapTxStats: SwapTxStats[], logFilePath: string, chopsticks: boolean){
    // Get day and time for file name
    let logFileStrings = logFilePath.split("\\");
    let logFileDay = logFileStrings[logFileStrings.length - 2]
    let logFileTime = logFileStrings[logFileStrings.length - 1]

    // Data to write to file
    let swapData = JSON.stringify(swapTxStats, null, 2)

    // Set directory paths
    let mainDirectoryPath, latestDirectoryPath;
    if(chopsticks){
        mainDirectoryPath = path.join(__dirname, `./logResults/chopsticks/${relay}/swapExecutionStats/`, logFileDay);
        latestDirectoryPath = path.join(__dirname, `./logResults/chopsticks/latestAttempt/${relay}/`);
        
    } else {
        mainDirectoryPath = path.join(__dirname, `./logResults/${relay}/swapExecutionStats/`, logFileDay);
        latestDirectoryPath = path.join(__dirname, `./logResults/latestAttempt/${relay}/`);
    }

    // Check if directory exists, create if it doesn't
    if (!fs.existsSync(mainDirectoryPath)) {
        fs.mkdirSync(mainDirectoryPath, { recursive: true });
    }
    if (!fs.existsSync(latestDirectoryPath)) {
        fs.mkdirSync(latestDirectoryPath, { recursive: true });
    }

    // Write data to file in the directory
    const mainFilePath = path.join(mainDirectoryPath, logFileTime);
    fs.writeFileSync(mainFilePath, swapData);

    // Also write data to latest attempt file
    const latestAttemptPathFile = path.join(latestDirectoryPath, 'swapExecutionStats.json')
    fs.writeFileSync(latestAttemptPathFile, swapData);

    console.log(`Data written to file: ${mainFilePath}`);
}
export function logExtrinsicSetResults(relay: Relay, extrinsicSetResults: ExtrinsicSetResultDynamic, logFilePath: string, chopsticks: boolean){
    // Get day and time for file name
    let logFileStrings = logFilePath.split("\\");
    let logFileDay = logFileStrings[logFileStrings.length - 2]
    let logFileTime = logFileStrings[logFileStrings.length - 1]

    // Data to write to file
    let swapData = JSON.stringify(extrinsicSetResults, null, 2)

    // Set directory paths
    let mainDirectoryPath, latestDirectoryPath;
    if(chopsticks){
        mainDirectoryPath = path.join(__dirname, `./logResults/chopsticks/${relay}/extrinsicSetResults/`, logFileDay);
        latestDirectoryPath = path.join(__dirname, `./logResults/chopsticks/latestAttempt/${relay}/`);
        
    } else {
        mainDirectoryPath = path.join(__dirname, `./logResults/${relay}/extrinsicSetResults/`, logFileDay);
        latestDirectoryPath = path.join(__dirname, `./logResults/latestAttempt/${relay}/`);
    }

    // Check if directory exists, create if it doesn't
    if (!fs.existsSync(mainDirectoryPath)) {
        fs.mkdirSync(mainDirectoryPath, { recursive: true });
    }
    if (!fs.existsSync(latestDirectoryPath)) {
        fs.mkdirSync(latestDirectoryPath, { recursive: true });
    }

    // Write data to file in the directory
    const mainFilePath = path.join(mainDirectoryPath, logFileTime);
    fs.writeFileSync(mainFilePath, swapData);

    // Also write data to latest attempt file
    const latestAttemptPathFile = path.join(latestDirectoryPath, 'extrinsicSetResults.json')
    fs.writeFileSync(latestAttemptPathFile, swapData);

    console.log(`Data written to file: ${mainFilePath}`);
}
/**
 * Log accumulated fees from global state for the run
 * - Accumulated fees are tracked in globalState.accumulatedFees as AccumlatedFeeData
 * - globalState.accumulatedFees is updated at the end of each successful executeSingleTransferExtrinsic() via updateAccumulatedFeeData()
 * - updateAccumulatedFeeData() takes the transfer and deposit fees from transfer extrinsic execution (FeeData objects)
 * - Total fee amounts for the run are stored in globalState.accumulatedFees. 
 * - Fees are stored according to their fee asset location. 
 * 
 * Saves accumulated fees for the run from globalState.accumlatedFees in accumulatedFees/<latest-file> and latestAttempt/<relay>/accumlatedFees.json
 * 
 * @param relay 
 * @param accumulatedFees - AccumulatedFeeData from globalState.accumulatedFees
 * @param logFilePath 
 * @param chopsticks 
 */
export function logAccumulatedFees(relay: Relay, accumulatedFees: AccumulatedFeeData, logFilePath: string, chopsticks: boolean){
    // Get day and time for file name
    let logFileStrings = logFilePath.split("\\");
    let logFileDay = logFileStrings[logFileStrings.length - 2]
    let logFileTime = logFileStrings[logFileStrings.length - 1]

    // Data to write to file
    let swapData = JSON.stringify(accumulatedFees, null, 2)

    // Set directory paths
    let mainDirectoryPath, latestDirectoryPath;
    if(chopsticks){
        mainDirectoryPath = path.join(__dirname, `./logResults/chopsticks/${relay}/accumulatedFees/`, logFileDay);
        latestDirectoryPath = path.join(__dirname, `./logResults/chopsticks/latestAttempt/${relay}/`);
        
    } else {
        mainDirectoryPath = path.join(__dirname, `./logResults/${relay}/accumulatedFees/`, logFileDay);
        latestDirectoryPath = path.join(__dirname, `./logResults/latestAttempt/${relay}/`);
    }

    // Check if directory exists, create if it doesn't
    if (!fs.existsSync(mainDirectoryPath)) {
        fs.mkdirSync(mainDirectoryPath, { recursive: true });
    }
    if (!fs.existsSync(latestDirectoryPath)) {
        fs.mkdirSync(latestDirectoryPath, { recursive: true });
    }

    // Write data to file in the directory
    const mainFilePath = path.join(mainDirectoryPath, logFileTime);
    fs.writeFileSync(mainFilePath, swapData);

    // Also write data to latest attempt file
    const latestAttemptPathFile = path.join(latestDirectoryPath, 'accumulatedFees.json')
    fs.writeFileSync(latestAttemptPathFile, swapData);

    console.log(`Data written to file: ${mainFilePath}`);
}

/**
 * 
 * @param relay 
 * @param feeReserveData - ReserveFeeData[] 
 * @param logFilePath 
 * @param chopsticks 
 */
export async function logXcmFeeReserves(relay: Relay, feeReserveData: ReserveFeeData[], logFilePath: string, chopsticks: boolean){
    // Get day and time for file name
    let logFileStrings = logFilePath.split("\\");
    let logFileDay = logFileStrings[logFileStrings.length - 2]
    let logFileTime = logFileStrings[logFileStrings.length - 1]

    // Data to write to file
    let feeData = JSON.stringify(feeReserveData, null, 2)

    // Set directory paths
    let mainDirectoryPath, latestDirectoryPath;
    if(chopsticks){
        mainDirectoryPath = path.join(__dirname, `./logResults/chopsticks/${relay}/xcmReserveFees/`, logFileDay);
        latestDirectoryPath = path.join(__dirname, `./logResults/chopsticks/latestAttempt/${relay}/`);
        
    } else {
        mainDirectoryPath = path.join(__dirname, `./logResults/${relay}/xcmReserveFees/`, logFileDay);
        latestDirectoryPath = path.join(__dirname, `./logResults/latestAttempt/${relay}/`);
    }

    if (!fs.existsSync(mainDirectoryPath)) {
        fs.mkdirSync(mainDirectoryPath, { recursive: true });
    }
    if (!fs.existsSync(latestDirectoryPath)) {
        fs.mkdirSync(latestDirectoryPath, { recursive: true });
    }

    // Write data to file in the directory
    const mainFilePath = path.join(mainDirectoryPath, logFileTime);
    fs.writeFileSync(mainFilePath, feeData);

    // Also write data to latest attempt file
    const latestAttemptPathFile = path.join(latestDirectoryPath, 'xcmReserveFees.json')
    fs.writeFileSync(latestAttemptPathFile, feeData);

    console.log(`Data written to file: ${mainFilePath}`);
}

/**
 * Run at the end of each execution attempt. Logs results from globalState
 * 
 * Logs: 
 * - swapTxStats, 
 * - swapTxResults, 
 * - transferTxStats, 
 * - arbExecutionResults, 
 * - extrinsicSetResults, 
 * - executionFees, 
 * - xcmFeeReserves
 *
 * @param relay - Which relay to run on
 * @param logFilePath - File path to arb finder result JSON file that was used. Log results with the same date and time.
 * @param chopsticks - Running on chopsticks instead of live
 * @returns void
 *
 * @beta
 */
export async function logAllResultsDynamic(relay: Relay, logFilePath: string, chopsticks: boolean){

    // let lastNode = extrinsicSetResults.lastSuccessfulNode
    // let extrinsicSetData = extrinsicSetResults.extrinsicData

    let arbResults: ArbExecutionResult[] = []
    let swapTxStats: SwapTxStats[] = []
    let swapTxResults: any[] = []
    let transferTxStats: TransferTxStats[] = []
    let accumulatedFees: AccumulatedFeeData;
    let xcmReserveFees: ReserveFeeData[] = []

    const { globalState } = await import("./liveTest.ts");
    let allExtrinsicsSet = globalState.extrinsicSetResults!
    allExtrinsicsSet.allExtrinsicResults.forEach((result) => {
        arbResults.push(result.arbExecutionResult);
    
        if (isSwapResult(result)) {
            swapTxStats.push(result.swapTxStats);
            swapTxResults.push(result.swapTxResults);
        } else if (isTransferResult(result)) {
            transferTxStats.push(result.transferTxStats);
        }
    })

    accumulatedFees = globalState.accumulatedFeeData!
    xcmReserveFees = globalState.xcmFeeReserves!

    // REVIEW Consolidate log info. What is used/needed.
    await logSwapTxStats(relay, swapTxStats, logFilePath, chopsticks)
    await logSwapTxResults(relay, swapTxResults, logFilePath, chopsticks)
    await logTransferTxStats(relay, transferTxStats, logFilePath, chopsticks)
    await logArbExecutionResults(relay, arbResults, logFilePath, chopsticks)
    await logExtrinsicSetResults(relay, allExtrinsicsSet, logFilePath, chopsticks)
    // await logAccumulatedFees(relay, accumulatedFees, logFilePath, chopsticks)
    await logXcmFeeReserves(relay, xcmReserveFees, logFilePath, chopsticks)
    // await updateFeeBook();

}
// log the latest file path so we can re run the arb from the last node and connect it to the previous attempt via latestFilePath
export async function logLastFilePath(logFilePath: string){
    let logFile: LastFilePath = {
        filePath: logFilePath
    }
    fs.writeFileSync(path.join(__dirname, './lastAttemptFile.json'), JSON.stringify(logFile, null, 2))
}

export async function logProfits(relay: Relay, arbAmountOut: string, logFilePath: string, chopsticks: boolean){
    let logFileStrings = logFilePath.split("\\");
    let logFileDay = logFileStrings[logFileStrings.length - 2]
    let logFileTime = logFileStrings[logFileStrings.length - 1]
    let logDayTime = logFileDay + logFileTime

    let live = chopsticks ? 'test_' : 'live_'
    let logEntry = live + logDayTime
    let tokenSymbol = relay == 'kusama' ? 'KSM' : 'DOT'
    let tokenPrice = await queryUsdPriceKucoin(tokenSymbol)
    let arbAmountOutUsd = new bn(arbAmountOut).times(new bn(tokenPrice))
    let arbAmountOutUsdString = `${arbAmountOutUsd.toFixed(2)}`

    // let profitLogDatabase = {}
    let result = `${arbAmountOut}|$${arbAmountOutUsdString}`
    // profitLogDatabase[logEntry] = result
    // console.log(logEntry)
    // console.log(arbAmountOut)
    console.log("PROFIT LOG DATABASE")
    console.log(`${logEntry}: ${result}`)

    let profitFilePath = path.join(__dirname, './liveSwapExecutionStats', 'profitStats.json')
    let profitLogDatabase = JSON.parse(fs.readFileSync(profitFilePath, 'utf8'))
    profitLogDatabase[logEntry] = result
    fs.writeFileSync(profitFilePath, JSON.stringify(profitLogDatabase, null, 2))

}


// A function to convert TransferDepositData to TransferDepositJsonData
export function convertToJsonData(data: TransferDepositEventData): TransferDepositJsonData {
    return {
        xcmAmount: data.xcmAmount.toString(),
        xcmAssetSymbol: data.xcmAssetSymbol,
        xcmAssetId: data.xcmAssetId,
        xcmAssetDecimals: data.xcmAssetDecimals.toString(),
        feeAmount: data.feeAmount.toString(),
        feeAssetSymbol: data.feeAssetSymbol,
        feeAssetId: data.feeAssetId,
        feeAssetDecimals: data.feeAssetDecimals.toString(),
        node: data.node
    };
}
/**
 * Updates fee book with latest fee amounts for transfers and deposits. FeeBook is used for arb-finder xcm calculations
 * - Formats data to the structs that arb-finder will parse
 * - Writes to eventFeeBook.json
 * - Execute after successful transfer extrinsic
 * 
 * Logs the fee asset and fee amount for the (sending chain-transferred asset) and (receiving chain-deposit asset)
 * - This accounts for reserve asset. If transferred asset !== fee asset, logs the fee asset (usually the native token) 
 * 
 * Arb-Finder 
 * - If fee asset !== transferred asset, will convert the fee asset to an equivalent value of the transferred asset
 * - This equivalent amount will be deducted from arb calculation amount and logged as reserve amount
 * - Arb-Executor then deducts reserve amount from actual transferred amount, so that it can later be used to pay back the fee asset
 * 
 * @param transferData - TransferEventData from transfer event listener on sending chain
 * @param depositData - DepositEventData from deposit event listener on receiving chain
 */
export function logEventFeeBook(transferData: TransferDepositEventData, depositData: TransferDepositEventData, relay: Relay){

    let originParaId = transferData.node == "Polkadot" || transferData.node == "Kusama" ? 0 : getParaId(transferData.node)
    let destParaId = depositData.node == "Polkadot" || depositData.node == "Kusama" ? 0 : getParaId(depositData.node)

    // let transferredAssetObject = getAssetRegistryObject()

    let transferKey = `${relay}-transfer`
    let transferChainKey = `${originParaId}`
    let transferAssetKey = `${JSON.stringify(transferData.xcmAssetId)}`
    let depositKey = `${relay}-deposit`
    let depositChainKey = `${destParaId}`
    let depositAssetKey = `${JSON.stringify(depositData.xcmAssetId)}`

    let feeBookPath = path.join(__dirname, './../../newEventFeeBook.json')
    let feeBook = JSON.parse(fs.readFileSync(feeBookPath, 'utf8'))

    const transferLogData: TransferDepositJsonData = convertToJsonData(transferData)
    const depositLogData: TransferDepositJsonData = convertToJsonData(depositData)

    
    // ****
    if(!feeBook[transferKey]){
        feeBook[transferKey] = {}
    }
    if(!feeBook[transferKey][transferChainKey]){
        feeBook[transferKey][transferChainKey] = {}
    }
    if(!feeBook[transferKey][transferChainKey][transferAssetKey]){
        feeBook[transferKey][transferChainKey][transferAssetKey] = {}
    }

    if(transferData.feeAmount.abs() > new bn(0)){
        feeBook[transferKey][transferChainKey][transferAssetKey] = transferLogData
    }

    if(!feeBook[depositKey]){
        feeBook[depositKey] = {}
    }
    if(!feeBook[depositKey][depositChainKey]){
        feeBook[depositKey][depositChainKey] = {}
    }
    if(!feeBook[depositKey][depositChainKey][depositAssetKey]){
        feeBook[depositKey][depositChainKey][depositAssetKey] = depositLogData
    }
    if(depositData.feeAmount.abs() > new bn(0)){
        feeBook[depositKey][depositChainKey][depositAssetKey] = depositLogData
    }

    fs.writeFileSync(feeBookPath, JSON.stringify(feeBook, null, 2))
}

async function run(){
    // await queryUsdPriceKucoin("KSM")

}

// run()