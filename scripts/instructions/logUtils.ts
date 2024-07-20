import { ExtrinsicObject, SwapInstruction, TransferInstruction, InstructionType, TransferTxStats, SwapTxStats, ArbExecutionResult, ExtrinsicSetResultDynamic, LastFilePath, Relay, TransferEventData, DepositEventData, TransferLogData, DepositLogData, AccumulatedFeeData, ReserveFeeData } from "./types.ts";
import path from 'path';
import fs from 'fs';
import bn from 'bignumber.js';
// import { globalState } from "./liveTest.ts";
declare const fetch: any;

import { fileURLToPath } from 'url';
import { getParaId } from "@paraspell/sdk";
import { getAssetRegistryObject } from "./utils.ts";
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
            instructionString = `(${InstructionType[instruction.type]})${instruction.fromChainId} ${JSON.stringify(instruction.assetNodes[0].getAssetLocalId())} ${JSON.stringify(instruction.startAssetNode.paraspellAsset)} -> ${instruction.toChainId} ${JSON.stringify(instruction.assetNodes[1].getAssetLocalId())} ${JSON.stringify(instruction.destinationAssetNode.paraspellAsset)}`
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

export function logExecutionFees(relay: Relay, accumulatedFees: AccumulatedFeeData, logFilePath: string, chopsticks: boolean){
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
    let allExtrinsicsSet = globalState.extrinsicSetResults
    allExtrinsicsSet.allExtrinsicResults.forEach((swapOrTransferResultData) => {
        arbResults.push(swapOrTransferResultData.arbExecutionResult)
        if('swapTxStats' in swapOrTransferResultData){
            swapTxStats.push(swapOrTransferResultData.swapTxStats)
            swapTxResults.push(swapOrTransferResultData.swapTxResults)
        } else if ('transferTxStats' in swapOrTransferResultData){
            transferTxStats.push(swapOrTransferResultData.transferTxStats)
        }
    })

    accumulatedFees = globalState.accumulatedFeeData
    xcmReserveFees = globalState.xcmFeeReserves

    await logSwapTxStats(relay, swapTxStats, logFilePath, chopsticks)
    await logSwapTxResults(relay, swapTxResults, logFilePath, chopsticks)
    await logTransferTxStats(relay, transferTxStats, logFilePath, chopsticks)
    await logArbExecutionResults(relay, arbResults, logFilePath, chopsticks)
    await logExtrinsicSetResults(relay, allExtrinsicsSet, logFilePath, chopsticks)
    await logExecutionFees(relay, accumulatedFees, logFilePath, chopsticks)
    await logXcmFeeReserves(relay, xcmReserveFees, logFilePath, chopsticks)
    await updateFeeBook();

}
// log the latest file path so we can re run the arb from the last node and connect it to the previous attempt via latestFilePath
export async function logLastFilePath(logFilePath: string){
    let logFile: LastFilePath = {
        filePath: logFilePath
    }
    fs.writeFileSync(path.join(__dirname, './lastAttemptFile.json'), JSON.stringify(logFile, null, 2))
}
// export async function logAllArbAttempts(relay: Relay, logFilePath: string, chopsticks: boolean){
//     let allArbExecutions: ArbExecutionResult[] = []

//     const { globalState } = await import("./liveTest.ts");
//     let allExtrinsicsSet = globalState.extrinsicSetResults
//     allExtrinsicsSet.allExtrinsicResults.forEach((extrinsicData) => {
//         allArbExecutions.push(extrinsicData.arbExecutionResult)
//     })
//     // allExtrinsicSets.forEach((extrinsicSet) => {
//     //     extrinsicSet.extrinsicData.forEach((extrinsicData) => {
//     //         allArbExecutions.push(extrinsicData.arbExecutionResult)
//     //     })
//     // })
//     // allArbExecutions = allArbExecutions.reverse()
//     let logFileStrings = logFilePath.split("\\");
//     let logFileDay = logFileStrings[logFileStrings.length - 2]
//     let logFileTime = logFileStrings[logFileStrings.length - 1]
//     let logFileData = JSON.stringify(allArbExecutions, null, 2)
    
//     let directoryPath;
    
//     if(!chopsticks){
//         directoryPath = path.join(__dirname, `./logResults/${relay}/liveSwapExecutionStats/allArbAttempts`, logFileDay);
//     } else {
//         directoryPath = path.join(__dirname, `./logResults/chopsticks/${relay}/allArbAttempts`, logFileDay);
//     }
//     let latestAttemptFolder = path.join(__dirname, `./logResults/latestAttempt/${relay}/`)

//     // Check if directory exists, create if it doesn't
//     if (!fs.existsSync(directoryPath)) {
//         fs.mkdirSync(directoryPath, { recursive: true });
//     }
//     if (!fs.existsSync(latestAttemptFolder)) {
//         fs.mkdirSync(latestAttemptFolder, { recursive: true });
//     }

//     // Write data to file in the directory
//     const filePath = path.join(directoryPath, logFileTime);
//     const latestAttemptFilePath = path.join(latestAttemptFolder, 'allArbResults.json')

//     // if(!fs.existsSync(filePath)){
//     //     fs.writeFileSync(filePath, logFileData);
//     // } else {
//     //     fs.appendFileSync(filePath, logFileData);
//     // }
//     fs.writeFileSync(filePath, logFileData);
//     fs.writeFileSync(latestAttemptFilePath, logFileData);

//     // Log profits for live execution
//     // if(!chopsticks){
//     //     let profitFilePath = path.join(__dirname, './liveSwapExecutionStats', 'profitStats.json')
//     // }
// }

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

// PROBABLY CAN REWRITE THIS. Only read latest tx results. Update entry in database. Instead of reading all and writing from scratch each time. If it saves time
export function updateFeeBook(){
    console.log("UPDATING FEE BOOK")
    let polkadotDirectory = path.join(__dirname, "./logResults/polkadot/transferExecutionResults/")
    let kusamaDirectory = path.join(__dirname, './logResults/kusama/transferExecutionResults/')

    let oldDirectory = path.join(__dirname, './deprecated/transferExecutionResults/')
    let chopsticksPolkadotDirectory = path.join(__dirname, "./logResults/chopsticks/polkadot/transferExecutionResults/")
    let chopsticksKusamaDirectory = path.join(__dirname, './logResults/chopsticks/kusama/transferExecutionResults/')


    const polkadotDayDirs = fs.readdirSync(polkadotDirectory, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

    const kusamaDayDirs = fs.readdirSync(kusamaDirectory, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

    // chopsticks files
    const chopstickPolkadotDirs = fs.readdirSync(chopsticksPolkadotDirectory, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

    const chopsticksKusamaDirs = fs.readdirSync(chopsticksKusamaDirectory, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
        // .forEach(dirent => kusamaDayDirs.push(dirent.name));

    const oldDayDirs = fs.readdirSync(oldDirectory, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);


    const polkadotData: TransferTxStats[] = [];
    const polkadotDataChopsticks: TransferTxStats[] = [];
    const kusamaData: TransferTxStats[] = [];
    const kusamaDataChopsticks: TransferTxStats[] = [];

    for (const dayDir of polkadotDayDirs) {
        const dayDirPath = path.join(polkadotDirectory, dayDir);

        // Read the list of JSON files in the day directory
        const jsonFiles = fs.readdirSync(dayDirPath, { withFileTypes: true })
                            .filter(dirent => dirent.isFile() && dirent.name.endsWith('.json'))
                            .map(dirent => dirent.name);

        for (const jsonFile of jsonFiles) {
            const jsonFilePath = path.join(dayDirPath, jsonFile);
            const fileContent = fs.readFileSync(jsonFilePath, 'utf-8');
            const jsonData: TransferTxStats[] = JSON.parse(fileContent);
            jsonData.forEach((txData) => {
                polkadotData.push(txData)
            })
        }
    }

    for (const dayDir of chopstickPolkadotDirs) {
        const dayDirPath = path.join(chopsticksPolkadotDirectory, dayDir);

        // Read the list of JSON files in the day directory
        const jsonFiles = fs.readdirSync(dayDirPath, { withFileTypes: true })
                            .filter(dirent => dirent.isFile() && dirent.name.endsWith('.json'))
                            .map(dirent => dirent.name);

        for (const jsonFile of jsonFiles) {
            const jsonFilePath = path.join(dayDirPath, jsonFile);
            const fileContent = fs.readFileSync(jsonFilePath, 'utf-8');
            const jsonData: TransferTxStats[] = JSON.parse(fileContent);
            jsonData.forEach((txData) => {
                polkadotDataChopsticks.push(txData)
            })
        }
    }

    for (const dayDir of kusamaDayDirs) {
        const dayDirPath = path.join(kusamaDirectory, dayDir);
        const jsonFiles = fs.readdirSync(dayDirPath, { withFileTypes: true })
                            .filter(dirent => dirent.isFile() && dirent.name.endsWith('.json'))
                            .map(dirent => dirent.name);

        for (const jsonFile of jsonFiles) {
            const jsonFilePath = path.join(dayDirPath, jsonFile);
            const fileContent = fs.readFileSync(jsonFilePath, 'utf-8');
            const jsonData: TransferTxStats[] = JSON.parse(fileContent);
            jsonData.forEach((txData) => {
                kusamaData.push(txData)
            })
        }
    }

    for (const dayDir of chopsticksKusamaDirs) {
        const dayDirPath = path.join(chopsticksKusamaDirectory, dayDir);

        // Read the list of JSON files in the day directory
        const jsonFiles = fs.readdirSync(dayDirPath, { withFileTypes: true })
                            .filter(dirent => dirent.isFile() && dirent.name.endsWith('.json'))
                            .map(dirent => dirent.name);

        for (const jsonFile of jsonFiles) {
            const jsonFilePath = path.join(dayDirPath, jsonFile);
            const fileContent = fs.readFileSync(jsonFilePath, 'utf-8');
            const jsonData: TransferTxStats[] = JSON.parse(fileContent);
            jsonData.forEach((txData) => {
                kusamaDataChopsticks.push(txData)
            })
        }
    }

    for (const dayDir of oldDayDirs) {
        const dayDirPath = path.join(oldDirectory, dayDir);
        const jsonFiles = fs.readdirSync(dayDirPath, { withFileTypes: true })
                            .filter(dirent => dirent.isFile() && dirent.name.endsWith('.json'))
                            .map(dirent => {
                                // let relay = dirent.name
                                return dirent.name
                            });

        for (const jsonFile of jsonFiles) {
            let relay = jsonFile.startsWith("Polkadot") ? "Polkadot" : "Kusama"
            const jsonFilePath = path.join(dayDirPath, jsonFile);
            const fileContent = fs.readFileSync(jsonFilePath, 'utf-8');
            const jsonData: TransferTxStats[] = JSON.parse(fileContent);

            jsonData.forEach((txData) => {
                if(relay == "Polkadot"){
                    // console.log("Polkadot data entry")
                    // console.log(JSON.stringify(txData, null,2))
                    polkadotData.push(txData)
                } else {
                    // console.log("Kusama data entry")
                    // console.log(JSON.stringify(txData, null,2))
                    kusamaData.push(txData)
                }
                // oldData.push(txData)
            })
        }
    }

    let feeBook = {}
    polkadotData.map((txData) => {
        if(txData){
            let originChain = txData.startParaId
            let assetSymbol = txData.currency
            let destChain = txData.destParaId
            let transferKey = `polkadot-${originChain}-${assetSymbol}-${destChain}`
            if (!feeBook[transferKey]){
                feeBook[transferKey] = []
            }
            feeBook[transferKey].push(txData.feesAndGasAmount)
        }  
    })

    polkadotDataChopsticks.map((txData) => {
        if(txData){
            let originChain = txData.startParaId
            let assetSymbol = txData.currency
            let destChain = txData.destParaId
            let transferKey = `polkadot-${originChain}-${assetSymbol}-${destChain}`
            if (!feeBook[transferKey]){
                feeBook[transferKey] = []
            }
            feeBook[transferKey].push(txData.feesAndGasAmount)
        }  
    })

    kusamaData.map((txData) => {
        if(txData){
            let originChain = txData.startParaId
            let assetSymbol = txData.currency
            let destChain = txData.destParaId
            let transferKey = `kusama-${originChain}-${assetSymbol}-${destChain}`
            if (!feeBook[transferKey]){
                feeBook[transferKey] = []
            }
            feeBook[transferKey].push(txData.feesAndGasAmount)
        }
        
    })

    kusamaDataChopsticks.map((txData) => {
        if(txData){
            let originChain = txData.startParaId
            let assetSymbol = txData.currency
            let destChain = txData.destParaId
            let transferKey = `kusama-${originChain}-${assetSymbol}-${destChain}`
            if (!feeBook[transferKey]){
                feeBook[transferKey] = []
            }
            feeBook[transferKey].push(txData.feesAndGasAmount)
        }
        
    })


    let feeBookFinal = {}
    Object.entries(feeBook).forEach(([key, entry]: [any, any[]]) => {
        // console.log(key)
        // console.log(entry)
        let firstNonZeroEntry = entry.find((feeData) => {
            feeData = feeData as any
            let value = new bn(feeData.inner)
            if(value.abs() > new bn(0)){
                return true
            }
        })
        if(firstNonZeroEntry){
            let feeValue = new bn(firstNonZeroEntry.inner).abs()
            let feeDecimals = new bn(firstNonZeroEntry.precision)
            feeBookFinal[key] = {
                'fee': feeValue.toFixed(),
                'decimals': feeDecimals.toFixed()
            }
        }
    })

    let feeBookPath = path.join(__dirname, './../../feeBook.json')
    fs.writeFileSync(feeBookPath, JSON.stringify(feeBookFinal, null, 2))
    console.log("DONE UPDATING FEE BOOK")
}



export function updateEventFeeBook(transferData: TransferEventData, depositData: DepositEventData, relay: Relay){
    let originParaId = transferData.node == "Polkadot" || transferData.node == "Kusama" ? 0 : getParaId(transferData.node)
    let destParaId = depositData.node == "Polkadot" || depositData.node == "Kusama" ? 0 : getParaId(depositData.node)

    // let transferredAssetObject = getAssetRegistryObject()

    let transferKey = `${relay}-transfer`
    let transferChainKey = `${originParaId}`
    let transferAssetKey = `${JSON.stringify(transferData.transferAssetId)}`
    let depositKey = `${relay}-deposit`
    let depositChainKey = `${destParaId}`
    let depositAssetKey = `${JSON.stringify(depositData.assetId)}`

    let feeBookPath = path.join(__dirname, './../../eventFeeBook.json')
    let feeBook = JSON.parse(fs.readFileSync(feeBookPath, 'utf8'))

    // console.log(`TRANSFER DATA ${JSON.stringify(transferData, null, 2)}`)
    let transferLogData: TransferLogData = {
        transferAmount: transferData.transferAmount.toFixed(),
        transferDecimals: transferData.transferAssetDecimals.toString(),
        transferAssetSymbol: transferData.transferAssetSymbol,
        transferAssetId: transferData.transferAssetId,
        feeAmount: transferData.feeAmount.toFixed(),
        feeDecimals: transferData.feeAssetDecimals.toString(),
        feeAssetSymbol: transferData.feeAssetSymbol,
        feeAssetId: transferData.feeAssetId
    }
    
    let feeAmount = new bn(depositData.feeAmount)

    // console.log(`DEPOSIT DATA ${JSON.stringify(depositData, null, 2)}`)
    // console.log(`FEE AMOUNT ${feeAmount}`)
    let depositLogData: DepositLogData = {
        depositAmount: depositData.depositAmount.toFixed(),
        feeAmount: feeAmount.toFixed(),
        feeDecimals: depositData.assetDecimals.toString(),
        feeAssetSymbol: depositData.assetSymbol,
        feeAssetId: depositData.assetId,
    }
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