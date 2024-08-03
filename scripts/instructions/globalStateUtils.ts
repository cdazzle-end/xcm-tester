import path from "path";
import fs from 'fs'
import { LastNode, Relay, ExtrinsicSetResultDynamic, TransactionState, TransferProperties, SwapProperties, ExecutionSuccess, ExecutionState, SingleSwapResultData, SingleTransferResultData, FeeData, FeeTracker, FeeTrackerEntry, ReserveFeeData } from "./types.ts";
import { fileURLToPath } from 'url';
import {BigNumber as bn } from "bignumber.js"

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Functions to set global state
// Every time global state is set, it should be written to a file

export async function setLastNode(node: LastNode, relay: Relay){
    const { globalState } = await import("./liveTest.ts");
    globalState.lastNode = node
    if(globalState.tracking == true){
        if(relay == 'kusama'){
            // fs.writeFileSync(path.join(__dirname, './lastNode.json'), JSON.stringify(node, null, 2), 'utf8')
            fs.writeFileSync(path.join(__dirname, './executionState/kusama.json'), JSON.stringify(globalState, null, 2), 'utf8')
        } else {
            // globalState.lastNode = node
            fs.writeFileSync(path.join(__dirname, './executionState/polkadot.json'), JSON.stringify(globalState, null, 2), 'utf8')
        }

    }

}
export async function setLastFile(filePath: string, relay: Relay){
    const { globalState } = await import("./liveTest.ts");
    console.log("Setting LAST FILE PATH")
    console.log(filePath)
    globalState.lastFilePath = filePath;
    if(globalState.tracking == true){
        if(relay == 'kusama'){
            // fs.writeFileSync(path.join(__dirname, './lastAttemptFile.json'), JSON.stringify(filePath, null, 2), 'utf8')
            fs.writeFileSync(path.join(__dirname, './executionState/kusama.json'), JSON.stringify(globalState, null, 2), 'utf8')
        } else {
            fs.writeFileSync(path.join(__dirname, './executionState/polkadot.json'), JSON.stringify(globalState, null, 2), 'utf8')
        }
        
    }

}
export async function setLastExtrinsicSet(extrinsicSet: ExtrinsicSetResultDynamic, relay: Relay){
    const { globalState } = await import("./liveTest.ts");
    globalState.extrinsicSetResults = extrinsicSet
    if(globalState.tracking == true){
        if(relay == 'kusama'){
            // fs.writeFileSync(path.join(__dirname, './executionState/lastExtrinsicSet.json'), JSON.stringify(extrinsicSet, null, 2), 'utf8')
            fs.writeFileSync(path.join(__dirname, './executionState/kusama.json'), JSON.stringify(globalState, null, 2), 'utf8')
        } else {
            // globalState.extrinsicSetResults = extrinsicSet
            fs.writeFileSync(path.join(__dirname, './executionState/polkadot.json'), JSON.stringify(globalState, null, 2), 'utf8')
        }
    }
}

export async function setResultData(resultData: SingleSwapResultData | SingleTransferResultData, relay: Relay){
    const { globalState } = await import("./liveTest.ts");
    if(globalState.extrinsicSetResults == null){
        globalState.extrinsicSetResults = {
            allExtrinsicResults: [],
            success: false,
            lastSuccessfulNode: null
        }
    }
    globalState.extrinsicSetResults.allExtrinsicResults.push(resultData);
    globalState.extrinsicSetResults.success = resultData.success
    globalState.extrinsicSetResults.lastSuccessfulNode = globalState.lastNode
    if(globalState.tracking == true){
        if(relay == 'kusama'){
            fs.writeFileSync(path.join(__dirname, './executionState/kusama.json'), JSON.stringify(globalState, null, 2), 'utf8')
        } else {
            fs.writeFileSync(path.join(__dirname, './executionState/polkadot.json'), JSON.stringify(globalState, null, 2), 'utf8')
        }
    }

}
export async function setTransactionState(transactionState: TransactionState, relay: Relay){
    const { globalState } = await import("./liveTest.ts");
    globalState.transactionState = transactionState;
    if(globalState.tracking == true){
        if(relay == 'kusama'){
            // fs.writeFileSync(path.join(__dirname, './lastTransactionState.json'), JSON.stringify(transactionState, null, 2), 'utf8')
            fs.writeFileSync(path.join(__dirname, './executionState/kusama.json'), JSON.stringify(globalState, null, 2), 'utf8')
        } else {
            // globalState.transactionState = transactionState;
            fs.writeFileSync(path.join(__dirname, './executionState/polkadot.json'), JSON.stringify(globalState, null, 2), 'utf8')
        }
        
    }
}
export async function setTransctionProperties(properties: TransferProperties | SwapProperties, relay: Relay){
    const { globalState } = await import("./liveTest.ts");
    globalState.transactionProperties = properties;
    if(globalState.tracking == true){
        if(relay == 'kusama'){
            // fs.writeFileSync(path.join(__dirname, './lastTransactionProperties.json'), JSON.stringify(properties, null, 2), 'utf8')
            fs.writeFileSync(path.join(__dirname, './executionState/kusama.json'), JSON.stringify(globalState, null, 2), 'utf8')
        } else {
            // globalState.transactionProperties = properties;
            fs.writeFileSync(path.join(__dirname, './executionState/polkadot.json'), JSON.stringify(globalState, null, 2), 'utf8')
        }
        
    }

}

// USED to track execution attempts until successful, then resets
export async function setExecutionSuccess(success: boolean, relay: Relay){
    const { globalState } = await import("./liveTest.ts");
    if(globalState.tracking == true){
        if(success){
            globalState.executionSuccess = true
            globalState.executionAttempts = 0
        } else {
            globalState.executionAttempts! += 1
        }
        // let executionSuccess: ExecutionSuccess = {success, executionAttempts: globalState.executionAttempts}
        if(relay == 'kusama'){
            // fs.writeFileSync(path.join(__dirname, './lastExecutionSuccess.json'), JSON.stringify(executionSuccess, null, 2), 'utf8')
            fs.writeFileSync(path.join(__dirname, './executionState/kusama.json'), JSON.stringify(globalState, null, 2), 'utf8')
        } else {
            fs.writeFileSync(path.join(__dirname, './executionState/polkadot.json'), JSON.stringify(globalState, null, 2), 'utf8')
        }
        
    }

}
export async function setExecutionRelay(relay: Relay) {
    const { globalState } = await import("./liveTest.ts");
    if(globalState.tracking == true){
        globalState.relay = relay
        if(relay == 'kusama'){
            // fs.writeFileSync(path.join(__dirname, './lastExecutionRelay.json'), JSON.stringify(relay, null, 2), 'utf8')
            fs.writeFileSync(path.join(__dirname, './executionState/kusama.json'), JSON.stringify(globalState, null, 2), 'utf8')
        } else {
            fs.writeFileSync(path.join(__dirname, './executionState/polkadot.json'), JSON.stringify(globalState, null, 2), 'utf8')
        }
        
    }
}

export async function resetExecutionState() {
    const { globalState } = await import("./liveTest.ts");
    globalState.relay = null,
    globalState.lastNode = null
    globalState.lastFilePath = null
    globalState.extrinsicSetResults = null
    globalState.transactionState = null
    globalState.transactionProperties = null
    globalState.executionSuccess = false
    globalState.executionAttempts = 0
    globalState.accumulatedFeeData = null
    globalState.xcmFeeReserves = null

}

export function getExecutionState(relay: Relay): ExecutionState{
    if(relay == 'kusama'){
        // return getLastExecutionState(relay)
        let kusamaExecutionState: ExecutionState = JSON.parse(fs.readFileSync(path.join(__dirname, './executionState/kusama.json'), 'utf8'))
        return kusamaExecutionState
    } else {
        let polkadotExecutionState: ExecutionState = JSON.parse(fs.readFileSync(path.join(__dirname, './executionState/polkadot.json'), 'utf8'))
        return polkadotExecutionState
    }
    
}

export function getLastExecutionState(relay: Relay){
    if(relay == 'kusama'){
        let kusamaExecutionState: ExecutionState = JSON.parse(fs.readFileSync(path.join(__dirname, './executionState/kusama.json'), 'utf8'))
        return kusamaExecutionState
    } else {
        let polkadotExecutionState: ExecutionState = JSON.parse(fs.readFileSync(path.join(__dirname, './executionState/polkadot.json'), 'utf8'))
        return polkadotExecutionState
    }

}

export async function updateXcmFeeReserves(feeData: ReserveFeeData, relay: Relay){
    const { globalState } = await import("./liveTest.ts");
    console.log("******** WRITE XCM FEE RESERVES *********")
    // console.log(`Fee data: ${JSON.stringify(feeData, null, 2)}`)

    if (globalState.xcmFeeReserves == null) {
        globalState.xcmFeeReserves = []
    }

    globalState.xcmFeeReserves.push(feeData)

    if(globalState.tracking == true){
        if(relay == 'kusama'){
            fs.writeFileSync(path.join(__dirname, './executionState/kusama.json'), JSON.stringify(globalState, null, 2), 'utf8')
        } else {
            fs.writeFileSync(path.join(__dirname, './executionState/polkadot.json'), JSON.stringify(globalState, null, 2), 'utf8')
        }
    }

}

export async function updateAccumulatedFeeData(transferFeeData: FeeData, depositFeeData: FeeData, relay: Relay, chopsticks: boolean){
    const { globalState } = await import("./liveTest.ts");
    console.log("******** WRITE ACCUMULATED FEE DATA *********")
    // console.log(`Transfer fee data: ${JSON.stringify(transferFeeData, null, 2)}`)
    // console.log(`Deposit fee data: ${JSON.stringify(depositFeeData, null, 2)}`)
    let transferFeeAssetLocationkey = JSON.stringify(transferFeeData.assetLocation)
    let depositFeeAssetLocationKey = JSON.stringify(depositFeeData.assetLocation)

    if(globalState.accumulatedFeeData == null){
        globalState.accumulatedFeeData = {}
    }
    // console.log(`Transfer fee asset location: ${transferFeeAssetLocationkey}`)
    if(!globalState.accumulatedFeeData[transferFeeAssetLocationkey]){
        globalState.accumulatedFeeData[transferFeeAssetLocationkey] = {
            assetSymbol: transferFeeData.assetSymbol,
            assetDecimals: transferFeeData.assetDecimals,
            feeAmount: transferFeeData.feeAmount
        }
    } else {
        let transferFeeAmount: bn = new bn(transferFeeData.feeAmount)
        let currentFeeAmount: bn = new bn(globalState.accumulatedFeeData[transferFeeAssetLocationkey].feeAmount)
        let totalFeeAmount: bn = transferFeeAmount.plus(currentFeeAmount)
        globalState.accumulatedFeeData[transferFeeAssetLocationkey].feeAmount = totalFeeAmount.toString()
    }

    if(!globalState.accumulatedFeeData[depositFeeAssetLocationKey]){
        globalState.accumulatedFeeData[depositFeeAssetLocationKey] = {
            assetSymbol: depositFeeData.assetSymbol,
            assetDecimals: depositFeeData.assetDecimals,
            feeAmount: depositFeeData.feeAmount
        }
    } else {
        let depositFee: bn = new bn(depositFeeData.feeAmount)
        let currentFeeAmount: bn = new bn(globalState.accumulatedFeeData[depositFeeAssetLocationKey].feeAmount)
        let totalFeeAmount: bn = depositFee.plus(currentFeeAmount)
        globalState.accumulatedFeeData[depositFeeAssetLocationKey].feeAmount = totalFeeAmount.toString()
    }

    if(globalState.tracking == true){
        if(relay == 'kusama'){
            fs.writeFileSync(path.join(__dirname, './executionState/kusama.json'), JSON.stringify(globalState, null, 2), 'utf8')
        } else {
            fs.writeFileSync(path.join(__dirname, './executionState/polkadot.json'), JSON.stringify(globalState, null, 2), 'utf8')
        }
    }

    
    let testFile = path.join(__dirname, './../../accumulatedFees.json')
    if (fs.existsSync(testFile)) {
        // File exists, read the data
        let accumulatedFeeData = JSON.parse(fs.readFileSync(testFile, 'utf8'))
        if(!accumulatedFeeData[transferFeeAssetLocationkey]){
            accumulatedFeeData[transferFeeAssetLocationkey] = {
                assetSymbol: transferFeeData.assetSymbol,
                assetDecimals: transferFeeData.assetDecimals,
                feeAmount: transferFeeData.feeAmount
            }
        } else {
            let transferFeeAmount: bn = new bn(transferFeeData.feeAmount)
            let currentFeeAmount: bn = new bn(globalState.accumulatedFeeData[transferFeeAssetLocationkey].feeAmount)
            let totalFeeAmount: bn = transferFeeAmount.plus(currentFeeAmount)
            accumulatedFeeData[transferFeeAssetLocationkey].feeAmount = totalFeeAmount.toString()
        }
    
        if(!accumulatedFeeData[depositFeeAssetLocationKey]){
            accumulatedFeeData[depositFeeAssetLocationKey] = {
                assetSymbol: depositFeeData.assetSymbol,
                assetDecimals: depositFeeData.assetDecimals,
                feeAmount: depositFeeData.feeAmount
            }
        } else {
            let depositFee: bn = new bn(depositFeeData.feeAmount)
            let currentFeeAmount: bn = new bn(globalState.accumulatedFeeData[depositFeeAssetLocationKey].feeAmount)
            let totalFeeAmount: bn = depositFee.plus(currentFeeAmount)
            accumulatedFeeData[depositFeeAssetLocationKey].feeAmount = totalFeeAmount.toString()
        }
    
        // Write the updated data back to the file
        fs.writeFileSync(testFile, JSON.stringify(accumulatedFeeData, null, 2), 'utf8');
    } else {
        // File does not exist, write new data
        fs.writeFileSync(testFile, JSON.stringify(globalState.accumulatedFeeData, null, 2), 'utf8');
    }

    // FEE TRACKER. Will be used to track fees that are not taken from the swap inputs.
    // 1. An array of each transfer fee. FeeData object (chain, symbol, id, amount, decimals, asset location, paid: boolean)
    // 2. (TODO) An array of something tracking reimbursements
    // 3. (DONT NEED, but provides a visual aid) A dictionary of unpaid fees. Key: asset location, Value: asset symbol, decimals, fee amount to be paid.
    // -- When adding a new fee, add it to allFees array.
    // -- Look up the asset location of the new fee in the unpaidFees dictionary. Add it to the total amount.
    // 4. When reimbursing fees, will go through the the array of fees, and pay the ones that have not been marked as paid 
    // DEPOSIT FEES ARE ALREADY PAID FOR, because they are taken from the swap inputs
    // TRANSFER FEES need to be paid for \
    console.log("WRITING TO FEE TRACKER")
    let feeTrackerFile = chopsticks ? 
    path.join(__dirname, './../../chopsticksFeeTracker.json') :
    path.join(__dirname, './../../feeTracker.json')
    // if(!chopsticks){
        // Create a new fee tracker file
    if (!fs.existsSync(feeTrackerFile)){
        // File does not exist, write new data
        let emptyFeeTracker: FeeTracker = {
            allFees: [],
            feePayments: [],
            unpaidFees: {}
        }
        fs.writeFileSync(feeTrackerFile, JSON.stringify(emptyFeeTracker, null, 2), 'utf8');
    }
    let feeTrackerData: FeeTracker = JSON.parse(fs.readFileSync(feeTrackerFile, 'utf8'))
    let newFeeEntry: FeeTrackerEntry = {
        feeData: transferFeeData,
        paid: false
    }
    feeTrackerData.allFees.push(newFeeEntry);
    console.log("FEE TRACKER UPDATED")
    // ** Add fee to dictonary for visual aid
    // Check if the asset location is already in the unpaidFees dictionary. Create new entry or add to it
    if(!feeTrackerData.unpaidFees[transferFeeAssetLocationkey]){
        feeTrackerData.unpaidFees[transferFeeAssetLocationkey] = {
            assetSymbol: transferFeeData.assetSymbol,
            assetDecimals: transferFeeData.assetDecimals,
            feeAmount: transferFeeData.feeAmount
        }
    } else {
        let transferFeeAmount: bn = new bn(transferFeeData.feeAmount)
        let currentFeeAmount: bn = new bn(feeTrackerData.unpaidFees[transferFeeAssetLocationkey].feeAmount)
        let totalFeeAmount: bn = transferFeeAmount.plus(currentFeeAmount)
        feeTrackerData.unpaidFees[transferFeeAssetLocationkey].feeAmount = totalFeeAmount.toString()
    }

    // Write the updated data back to the file
    fs.writeFileSync(feeTrackerFile, JSON.stringify(feeTrackerData, null, 2), 'utf8');
        


}