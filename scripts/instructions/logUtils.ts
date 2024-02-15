import { ExtrinsicObject, SwapInstruction, TransferInstruction, InstructionType, TransferTxStats, SwapTxStats } from "./types.ts";
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
    if(!fs.existsSync(filePath)){
        fs.writeFileSync(filePath, logFileData);
    } else {
        fs.appendFileSync(filePath, logFileData);
    }

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
    if(!fs.existsSync(filePath)){
        fs.writeFileSync(filePath, logFileData);
    } else {
        fs.appendFileSync(filePath, logFileData);
    }

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
    if(!fs.existsSync(filePath)){
        fs.writeFileSync(filePath, logFileData);
    } else {
        fs.appendFileSync(filePath, logFileData);
    }

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
    if(!fs.existsSync(filePath)){
        fs.writeFileSync(filePath, logFileData);
    } else {
        fs.appendFileSync(filePath, logFileData);
    }

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
    if(!fs.existsSync(filePath)){
        fs.writeFileSync(filePath, logFileData);
    } else {
        fs.appendFileSync(filePath, logFileData);
    }
    

    console.log(`Data written to file: ${filePath}`);
}
