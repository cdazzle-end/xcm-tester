import { ExtrinsicObject, SwapInstruction, TransferInstruction, InstructionType, TransferTxStats, SwapTxStats, ArbExecutionResult, ExtrinsicSetResultDynamic } from "./types.ts";
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


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
export function logArbExecutionResults(arbResults: any[], logFilePath: string, reverse: boolean){
    let logFileStrings = logFilePath.split("\\");
    let logFileDay = logFileStrings[logFileStrings.length - 2]
    let logFileTime = logFileStrings[logFileStrings.length - 1]
    let logFileData = JSON.stringify(arbResults, null, 2)
    let directoryPath;
    if(reverse){
        directoryPath = path.join(__dirname, './reverse/arbExecutionResults/', logFileDay);
    } else {
        directoryPath = path.join(__dirname, './arbExecutionResults/', logFileDay);
    }

    if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, { recursive: true });
    }

    // Write data to file in the directory
    const filePath = path.join(directoryPath, logFileTime);
    const latestAttemptPath = path.join(__dirname, './latestAttempt/arbExecutionResults.json')
    // if(!fs.existsSync(filePath)){
    //     fs.writeFileSync(filePath, logFileData);
    // } else {
    //     fs.appendFileSync(filePath, logFileData);
    // }
    fs.writeFileSync(filePath, logFileData);
    fs.writeFileSync(latestAttemptPath, logFileData);
    console.log(`Data written to file: ${filePath}`);
}
export async function logSwapTxResults(txResults: any, logFilePath: string, reverse: boolean = false) {
    // let logData = JSON.parse(fs.readFileSync(logFilePath, 'utf8'));
    let logFileStrings = logFilePath.split("\\");
    let logFileDay = logFileStrings[logFileStrings.length - 2]
    let logFileTime = logFileStrings[logFileStrings.length - 1]
    let logFileData = JSON.stringify(txResults, null, 2)
    let directoryPath;
    if(reverse){
        directoryPath = path.join(__dirname, './reverse/swapExecutionResults/', logFileDay);
    } else {
        directoryPath = path.join(__dirname, './swapExecutionResults/', logFileDay);
    }
    // Check if directory exists, create if it doesn't
    if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, { recursive: true });
    }

    // Write data to file in the directory
    const filePath = path.join(directoryPath, logFileTime);
    const latestAttemptPath = path.join(__dirname, './latestAttempt/swapExecutionStats.json')
    // if(!fs.existsSync(filePath)){
    //     fs.writeFileSync(filePath, logFileData);
    // } else {
    //     fs.appendFileSync(filePath, logFileData);
    // }
    fs.writeFileSync(filePath, logFileData);
    fs.writeFileSync(latestAttemptPath, logFileData);

    console.log(`Data written to file: ${filePath}`);

    // logData.forEach((result, index) => {
    //     result.txDetails = txResults[index]
    // })
    // let logDataString = JSON.stringify(logData, null, 2)
    // fs.writeFileSync(logFilePath, logDataString)
}
export function logTransferTxStats(transferTxStats: TransferTxStats[], logFilePath: string, reverse: boolean = false){
    let logFileStrings = logFilePath.split("\\");
    let logFileDay = logFileStrings[logFileStrings.length - 2]
    let logFileTime = logFileStrings[logFileStrings.length - 1]
    let logFileData = JSON.stringify(transferTxStats, null, 2)
    let directoryPath;
    if(reverse){
        directoryPath = path.join(__dirname, './reverse/transferExecutionResults/', logFileDay);
    } else {
        directoryPath = path.join(__dirname, './transferExecutionResults/', logFileDay);
    }
    if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, { recursive: true });
    }

    // Write data to file in the directory
    const filePath = path.join(directoryPath, logFileTime);
    const latestAttemptPath = path.join(__dirname, './latestAttempt/transferExecutionResults.json')
    // if(!fs.existsSync(filePath)){
    //     fs.writeFileSync(filePath, logFileData);
    // } else {
    //     fs.appendFileSync(filePath, logFileData);
    // }
    fs.writeFileSync(latestAttemptPath, logFileData);
    fs.writeFileSync(filePath, logFileData);

    console.log(`Data written to file: ${filePath}`);
}
export function logSwapTxStats(swapTxStats: SwapTxStats[], logFilePath: string, reverse: boolean = false){
    let logFileStrings = logFilePath.split("\\");
    let logFileDay = logFileStrings[logFileStrings.length - 2]
    let logFileTime = logFileStrings[logFileStrings.length - 1]
    let logFileData = JSON.stringify(swapTxStats, null, 2)
    
    let directoryPath;
    if(reverse){
        directoryPath = path.join(__dirname, './reverse/swapExecutionStats/', logFileDay);
    } else {
        directoryPath = path.join(__dirname, './swapExecutionStats/', logFileDay);
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
    const latestAttemptPath = path.join(__dirname, './latestAttempt/swapExecutionStats.json')
    fs.writeFileSync(filePath, logFileData);
    fs.writeFileSync(latestAttemptPath, logFileData);

    console.log(`Data written to file: ${filePath}`);
}

export async function logResultsDynamic(extrinsicSetResults: ExtrinsicSetResultDynamic, logFilePath: string, reverse: boolean){
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

    logSwapTxStats(swapTxStats, logFilePath, reverse)
    logSwapTxResults(swapTxResults, logFilePath, reverse)
    logTransferTxStats(transferTxStats, logFilePath, reverse)
    logArbExecutionResults(arbResults, logFilePath,reverse)

    let lastNodeString = `LAST SUCCESSFUL NODE: ${lastNode.chainId} ${lastNode.assetSymbol} ${lastNode.assetValue}`
    let extrinsicSetString = `EXTRINSIC SET RESULTS: ${JSON.stringify(extrinsicSetData, null, 2)}`
    let logString = lastNodeString + "\n" + extrinsicSetString
    fs.appendFileSync(logFilePath, logString)
}
export async function logAllResultsDynamic(allExtrinsicSetResults: ExtrinsicSetResultDynamic[], logFilePath: string, reverse: boolean){
    // let lastNode = extrinsicSetResults.lastSuccessfulNode
    // let extrinsicSetData = extrinsicSetResults.extrinsicData

    let arbResults: ArbExecutionResult[] = []
    let swapTxStats: SwapTxStats[] = []
    let swapTxResults: any[] = []
    let transferTxStats: TransferTxStats[] = []

    allExtrinsicSetResults.forEach((extrinsicSet) => {
        extrinsicSet.extrinsicData.forEach((swapOrTransferResultData) => {
            arbResults.push(swapOrTransferResultData.arbExecutionResult)
            if('swapTxStats' in swapOrTransferResultData){
                swapTxStats.push(swapOrTransferResultData.swapTxStats)
                swapTxResults.push(swapOrTransferResultData.swapTxResults)
            } else if ('transferTxStats' in swapOrTransferResultData){
                transferTxStats.push(swapOrTransferResultData.transferTxStats)
            }
        })
    })

    // extrinsicSetData.forEach((resultData) => {
    //     arbResults.push(resultData.arbExecutionResult)
    //     if('swapTxStats' in resultData){
    //         swapTxStats.push(resultData.swapTxStats)
    //         swapTxResults.push(resultData.swapTxResults)
    //     } else if ('transferTxStats' in resultData){
    //         transferTxStats.push(resultData.transferTxStats)
    //     }
    // })
    reverse = false;
    logSwapTxStats(swapTxStats, logFilePath, reverse)
    logSwapTxResults(swapTxResults, logFilePath, reverse)
    logTransferTxStats(transferTxStats, logFilePath, reverse)
    logArbExecutionResults(arbResults, logFilePath,reverse)

    // let lastNodeString = `LAST SUCCESSFUL NODE: ${lastNode.chainId} ${lastNode.assetSymbol} ${lastNode.assetValue}`
    // let extrinsicSetString = `EXTRINSIC SET RESULTS: ${JSON.stringify(extrinsicSetData, null, 2)}`
    // let logString = lastNodeString + "\n" + extrinsicSetString
    // fs.appendFileSync(logFilePath, logString)
}

export async function logAllArbAttempts(allExtrinsicSets: ExtrinsicSetResultDynamic[], logFilePath: string, chopsticks: boolean){
    let allArbExecutions: ArbExecutionResult[] = []
    allExtrinsicSets.forEach((extrinsicSet) => {
        extrinsicSet.extrinsicData.forEach((extrinsicData) => {
            allArbExecutions.push(extrinsicData.arbExecutionResult)
        })
    })
    // allArbExecutions = allArbExecutions.reverse()
    let logFileStrings = logFilePath.split("\\");
    let logFileDay = logFileStrings[logFileStrings.length - 2]
    let logFileTime = logFileStrings[logFileStrings.length - 1]
    let logFileData = JSON.stringify(allArbExecutions, null, 2)
    
    let directoryPath;
    
    if(!chopsticks){
        directoryPath = path.join(__dirname, './liveSwapExecutionStats/allArbAttempts', logFileDay);
    } else {
        directoryPath = path.join(__dirname, './allArbAttempts', logFileDay);
    }
    let latestAttemptFolder = path.join(__dirname, './latestAttempt')

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

export async function logProfits(arbAmountOut: number, logFilePath: string, chopsticks: boolean){
    let logFileStrings = logFilePath.split("\\");
    let logFileDay = logFileStrings[logFileStrings.length - 2]
    let logFileTime = logFileStrings[logFileStrings.length - 1]
    let logDayTime = logFileDay + logFileTime





    let live = chopsticks ? 'test_' : 'live_'
    let logEntry = live + logDayTime

    let profitLogDatabase = {}
    profitLogDatabase[logEntry] = arbAmountOut
    console.log(logEntry)
    console.log(arbAmountOut)
    console.log("PROFIT LOG DATABASE")
    console.log(profitLogDatabase)

    let profitFilePath = path.join(__dirname, './liveSwapExecutionStats', 'profitStats.json')
    profitLogDatabase = JSON.parse(fs.readFileSync(profitFilePath, 'utf8'))
    profitLogDatabase[logEntry] = arbAmountOut
    fs.writeFileSync(profitFilePath, JSON.stringify(profitLogDatabase, null, 2))
    // if(!fs.existsSync(profitFilePath)){
    //     fs.writeFileSync(profitFilePath, JSON.stringify(profitLogDatabase, null, 2))
    // } else {
    //     profitLogDatabase = JSON.parse(fs.readFileSync(profitFilePath, 'utf8'))
    //     profitLogDatabase[logDayTime] = arbAmountOut
    //     fs.writeFileSync(profitFilePath, JSON.stringify(profitLogDatabase, null, 2))
    // }
}
