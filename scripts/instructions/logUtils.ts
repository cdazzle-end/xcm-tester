import { ExtrinsicObject, SwapInstruction, TransferInstruction, InstructionType, TransferTxStats, SwapTxStats, ArbExecutionResult, ExtrinsicSetResultDynamic, LastFilePath, Relay } from "./types.ts";
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
// import { globalState } from "./liveTest.ts";
declare const fetch: any;

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
export function logArbExecutionResults(relay: Relay, arbResults: any[], logFilePath: string, reverse: boolean){
    let logFileStrings = logFilePath.split("\\");
    let logFileDay = logFileStrings[logFileStrings.length - 2]
    let logFileTime = logFileStrings[logFileStrings.length - 1]
    let logFileData = JSON.stringify(arbResults, null, 2)
    let directoryPath;
    if(reverse){
        directoryPath = path.join(__dirname, './reverse/arbExecutionResults/', logFileDay);
    } else {
        directoryPath = path.join(__dirname, `./logResults/${relay}/arbExecutionResults/`, logFileDay);
    }

    if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, { recursive: true });
    }

    // Write data to file in the directory
    const filePath = path.join(directoryPath, logFileTime);
    
    if(!fs.existsSync(filePath)){
        fs.writeFileSync(filePath, logFileData);
    } else {
        // fs.appendFileSync(filePath, logFileData);
        fs.writeFileSync(filePath, logFileData);
    }

    const latestAttemptFolderPath = path.join(__dirname, `./logResults/latestAttempt/${relay}/`)
    if (!fs.existsSync(latestAttemptFolderPath)) {
        fs.mkdirSync(latestAttemptFolderPath, { recursive: true });
    }
    const latestFilePath = path.join(latestAttemptFolderPath, 'arbExecutionResults.json');

    // arbExecutionResults.json
    if(!fs.existsSync(latestFilePath)){
        console.log("Creating latest attempt file")
        fs.writeFileSync(latestFilePath, logFileData);
    } 
    else {
        console.log("Appending to latest attempt file")
        fs.writeFileSync(latestFilePath, logFileData);
        // fs.appendFileSync(latestFilePath, logFileData);
    }
    console.log(`Data written to file: ${filePath}`);
    console.log(`Data written to file: ${latestFilePath}`);
}
export async function logSwapTxResults(relay: Relay, txResults: any, logFilePath: string, reverse: boolean = false) {
    // let logData = JSON.parse(fs.readFileSync(logFilePath, 'utf8'));
    let logFileStrings = logFilePath.split("\\");
    let logFileDay = logFileStrings[logFileStrings.length - 2]
    let logFileTime = logFileStrings[logFileStrings.length - 1]
    let logFileData = JSON.stringify(txResults, null, 2)
    let directoryPath;
    if(reverse){
        directoryPath = path.join(__dirname, './reverse/swapExecutionResults/', logFileDay);
    } else {
        directoryPath = path.join(__dirname, `./logResults/${relay}/swapExecutionResults/`, logFileDay);
    }
    // Check if directory exists, create if it doesn't
    if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, { recursive: true });
    }

    // Write data to file in the directory
    const filePath = path.join(directoryPath, logFileTime);
    // const latestAttemptPath = path.join(__dirname, `./latestAttempt/${relay}/swapExecutionStats.json`)
    const latestAttemptPath = path.join(__dirname, `./logResults/latestAttempt/${relay}/`)
    if(!fs.existsSync(latestAttemptPath)){
        fs.mkdirSync(latestAttemptPath, { recursive: true });
    }
    const latestAttemptPathFile = path.join(latestAttemptPath, 'swapExecutionStats.json')
    // if(!fs.existsSync(filePath)){
    //     fs.writeFileSync(filePath, logFileData);
    // } else {
    //     fs.appendFileSync(filePath, logFileData);
    // }
    fs.writeFileSync(filePath, logFileData);
    fs.writeFileSync(latestAttemptPathFile, logFileData);

    console.log(`Data written to file: ${filePath}`);

    // logData.forEach((result, index) => {
    //     result.txDetails = txResults[index]
    // })
    // let logDataString = JSON.stringify(logData, null, 2)
    // fs.writeFileSync(logFilePath, logDataString)
}
export function logTransferTxStats(relay: Relay, transferTxStats: TransferTxStats[], logFilePath: string, reverse: boolean = false){
    let logFileStrings = logFilePath.split("\\");
    let logFileDay = logFileStrings[logFileStrings.length - 2]
    let logFileTime = logFileStrings[logFileStrings.length - 1]
    let logFileData = JSON.stringify(transferTxStats, null, 2)
    let directoryPath;
    if(reverse){
        directoryPath = path.join(__dirname, './reverse/transferExecutionResults/', logFileDay);
    } else {
        directoryPath = path.join(__dirname, `./logResults/${relay}/transferExecutionResults/`, logFileDay);
    }
    if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, { recursive: true });
    }

    // Write data to file in the directory
    const filePath = path.join(directoryPath, logFileTime);
    // const latestAttemptPath = path.join(__dirname, `./latestAttempt/${relay}/transferExecutionResults.json`)
    const latestAttemptPath = path.join(__dirname, `./logResults/latestAttempt/${relay}/`)
    if(!fs.existsSync(latestAttemptPath)){
        fs.mkdirSync(latestAttemptPath, { recursive: true });
    }
    const latestAttemptPathFile = path.join(latestAttemptPath, 'transferExecutionResults.json')
    // if(!fs.existsSync(filePath)){
    //     fs.writeFileSync(filePath, logFileData);
    // } else {
    //     fs.appendFileSync(filePath, logFileData);
    // }
    fs.writeFileSync(latestAttemptPathFile, logFileData);
    fs.writeFileSync(filePath, logFileData);

    console.log(`Data written to file: ${filePath}`);
}
export function logSwapTxStats(relay: Relay, swapTxStats: SwapTxStats[], logFilePath: string, reverse: boolean = false){
    let logFileStrings = logFilePath.split("\\");
    let logFileDay = logFileStrings[logFileStrings.length - 2]
    let logFileTime = logFileStrings[logFileStrings.length - 1]
    let logFileData = JSON.stringify(swapTxStats, null, 2)
    
    let directoryPath;
    if(reverse){
        directoryPath = path.join(__dirname, './reverse/swapExecutionStats/', logFileDay);
    } else {
        directoryPath = path.join(__dirname, `./logResults/${relay}/swapExecutionStats/`, logFileDay);
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
    const latestAttemptPath = path.join(__dirname, `./logResults/latestAttempt/${relay}/`)
    if(!fs.existsSync(latestAttemptPath)){
        fs.mkdirSync(latestAttemptPath, { recursive: true });
    }
    const latestAttemptPathFile = path.join(latestAttemptPath, 'swapExecutionStats.json')
    fs.writeFileSync(filePath, logFileData);
    fs.writeFileSync(latestAttemptPathFile, logFileData);

    console.log(`Data written to file: ${filePath}`);
}

export async function logResultsDynamic(relay: Relay, extrinsicSetResults: ExtrinsicSetResultDynamic, logFilePath: string, reverse: boolean){
    let lastNode = extrinsicSetResults.lastSuccessfulNode
    let extrinsicSetData = extrinsicSetResults.extrinsicData

    let arbResults: ArbExecutionResult[] = []
    let swapTxStats: SwapTxStats[] = []
    let swapTxResults: any[] = []
    let transferTxStats: TransferTxStats[] = []

    extrinsicSetData.forEach((resultData) => {
        arbResults.push(resultData.arbExecutionResult)
        if('swapTxStats' in resultData){
            swapTxStats.push(resultData.swapTxStats)
            swapTxResults.push(resultData.swapTxResults)
        } else if ('transferTxStats' in resultData){
            transferTxStats.push(resultData.transferTxStats)
        }
    })

    logSwapTxStats(relay, swapTxStats, logFilePath, reverse)
    logSwapTxResults(relay, swapTxResults, logFilePath, reverse)
    logTransferTxStats(relay, transferTxStats, logFilePath, reverse)
    logArbExecutionResults(relay, arbResults, logFilePath,reverse)

    let lastNodeString = `LAST SUCCESSFUL NODE: ${lastNode.chainId} ${lastNode.assetSymbol} ${lastNode.assetValue}`
    let extrinsicSetString = `EXTRINSIC SET RESULTS: ${JSON.stringify(extrinsicSetData, null, 2)}`
    let logString = lastNodeString + "\n" + extrinsicSetString
    fs.appendFileSync(logFilePath, logString)
}
export async function logAllResultsDynamic(relay: Relay, logFilePath: string, reverse: boolean){
    // let lastNode = extrinsicSetResults.lastSuccessfulNode
    // let extrinsicSetData = extrinsicSetResults.extrinsicData

    let arbResults: ArbExecutionResult[] = []
    let swapTxStats: SwapTxStats[] = []
    let swapTxResults: any[] = []
    let transferTxStats: TransferTxStats[] = []

    const { globalState } = await import("./liveTest.ts");
    let allExtrinsicsSet = globalState.extrinsicSetResults
    allExtrinsicsSet.extrinsicData.forEach((swapOrTransferResultData) => {
        arbResults.push(swapOrTransferResultData.arbExecutionResult)
            if('swapTxStats' in swapOrTransferResultData){
                swapTxStats.push(swapOrTransferResultData.swapTxStats)
                swapTxResults.push(swapOrTransferResultData.swapTxResults)
            } else if ('transferTxStats' in swapOrTransferResultData){
                transferTxStats.push(swapOrTransferResultData.transferTxStats)
            }
    })
    reverse = false;
    logSwapTxStats(relay, swapTxStats, logFilePath, reverse)
    logSwapTxResults(relay, swapTxResults, logFilePath, reverse)
    logTransferTxStats(relay, transferTxStats, logFilePath, reverse)
    logArbExecutionResults(relay, arbResults, logFilePath,reverse)
    let latestAllExtrinsicsPath = path.join(__dirname, `./logResults/latestAttempt/${relay}/`)
    if(!fs.existsSync(latestAllExtrinsicsPath)){
        fs.mkdirSync(latestAllExtrinsicsPath, { recursive: true });
    }
    latestAllExtrinsicsPath = path.join(latestAllExtrinsicsPath, 'allExtrinsicSetResults.json')
    fs.writeFileSync(latestAllExtrinsicsPath, JSON.stringify(allExtrinsicsSet, null, 2))

    // let lastNodeString = `LAST SUCCESSFUL NODE: ${lastNode.chainId} ${lastNode.assetSymbol} ${lastNode.assetValue}`
    // let extrinsicSetString = `EXTRINSIC SET RESULTS: ${JSON.stringify(extrinsicSetData, null, 2)}`
    // let logString = lastNodeString + "\n" + extrinsicSetString
    // fs.appendFileSync(logFilePath, logString)
}
// log the latest file path so we can re run the arb from the last node and connect it to the previous attempt via latestFilePath
export async function logLastFilePath(logFilePath: string){
    let logFile: LastFilePath = {
        filePath: logFilePath
    }
    fs.writeFileSync(path.join(__dirname, './lastAttemptFile.json'), JSON.stringify(logFile, null, 2))
}
export async function logAllArbAttempts(relay: Relay, logFilePath: string, chopsticks: boolean){
    let allArbExecutions: ArbExecutionResult[] = []

    const { globalState } = await import("./liveTest.ts");
    let allExtrinsicsSet = globalState.extrinsicSetResults
    allExtrinsicsSet.extrinsicData.forEach((extrinsicData) => {
        allArbExecutions.push(extrinsicData.arbExecutionResult)
    })
    // allExtrinsicSets.forEach((extrinsicSet) => {
    //     extrinsicSet.extrinsicData.forEach((extrinsicData) => {
    //         allArbExecutions.push(extrinsicData.arbExecutionResult)
    //     })
    // })
    // allArbExecutions = allArbExecutions.reverse()
    let logFileStrings = logFilePath.split("\\");
    let logFileDay = logFileStrings[logFileStrings.length - 2]
    let logFileTime = logFileStrings[logFileStrings.length - 1]
    let logFileData = JSON.stringify(allArbExecutions, null, 2)
    
    let directoryPath;
    
    if(!chopsticks){
        directoryPath = path.join(__dirname, `./logResults/${relay}/liveSwapExecutionStats/allArbAttempts`, logFileDay);
    } else {
        directoryPath = path.join(__dirname, `./logResults/chopsticks/${relay}/allArbAttempts`, logFileDay);
    }
    let latestAttemptFolder = path.join(__dirname, `./logResults/latestAttempt/${relay}/`)

    // Check if directory exists, create if it doesn't
    if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, { recursive: true });
    }
    if (!fs.existsSync(latestAttemptFolder)) {
        fs.mkdirSync(latestAttemptFolder, { recursive: true });
    }

    // Write data to file in the directory
    const filePath = path.join(directoryPath, logFileTime);
    const latestAttemptFilePath = path.join(latestAttemptFolder, 'allArbResults.json')

    // if(!fs.existsSync(filePath)){
    //     fs.writeFileSync(filePath, logFileData);
    // } else {
    //     fs.appendFileSync(filePath, logFileData);
    // }
    fs.writeFileSync(filePath, logFileData);
    fs.writeFileSync(latestAttemptFilePath, logFileData);

    // Log profits for live execution
    // if(!chopsticks){
    //     let profitFilePath = path.join(__dirname, './liveSwapExecutionStats', 'profitStats.json')
    // }
}

export async function logProfits(relay: Relay, arbAmountOut: number, logFilePath: string, chopsticks: boolean){
    let logFileStrings = logFilePath.split("\\");
    let logFileDay = logFileStrings[logFileStrings.length - 2]
    let logFileTime = logFileStrings[logFileStrings.length - 1]
    let logDayTime = logFileDay + logFileTime

    let live = chopsticks ? 'test_' : 'live_'
    let logEntry = live + logDayTime
    let tokenSymbol = relay == 'kusama' ? 'KSM' : 'DOT'
    let tokenPrice = await queryUsdPriceKucoin(tokenSymbol)
    let arbAmountOutUsd = arbAmountOut * tokenPrice
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

async function run(){
    // await queryUsdPriceKucoin("KSM")

}

// run()