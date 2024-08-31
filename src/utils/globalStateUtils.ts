/**
 * @fileoverview Functions to access and set GlobalState properties. 
 * 
 * Every time a value is set, the state is saved to file.
 */


import path from "path";
import fs from 'fs'
import { LastNode, Relay, ExtrinsicSetResultDynamic, TransactionState, TransferProperties, SwapProperties, ExecutionSuccess, ExecutionState, SingleSwapResultData, SingleTransferResultData, FeeData, FeeTracker, FeeTrackerEntry, ReserveFeeData, AccumulatedFeeData, RelayTokenBalances } from "./../types/types.ts";
import { fileURLToPath } from 'url';
import bn from "bignumber.js"
import { GlobalState } from "./../core/GlobalState.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Functions to set global state
// Every time global state is set, it should be written to a file
/**
 * 
 */
/**
 * Updates globalState.xcmFeeReserves: ReserveFeeData[]
 * - Adds ReserveFeeData fom latest xcm transfer
 * 
 * NOT USED YET Need to implement function to pay back reserves
 * 
 * @param reserveFees - ReserveFeeData
 * @param relay Which relay to use
 */
// export function updateXcmFeeReserves(reserveFees: ReserveFeeData[], relay: Relay){
//     const { globalState } = await import("./liveTest.ts");
//     console.log("******** WRITE XCM FEE RESERVES *********")
//     // console.log(`Fee data: ${JSON.stringify(feeData, null, 2)}`)

//     if (globalState.xcmFeeReserves == null) {
//         globalState.xcmFeeReserves = []
//     }

//     reserveFees.forEach((reserveFeeData) => globalState.xcmFeeReserves!.push(reserveFeeData))

//     if(globalState.tracking == true){
//         if(relay == 'kusama'){
//             fs.writeFileSync(path.join(__dirname, './executionState/kusama.json'), JSON.stringify(globalState, null, 2), 'utf8')
//         } else {
//             fs.writeFileSync(path.join(__dirname, './executionState/polkadot.json'), JSON.stringify(globalState, null, 2), 'utf8')
//         }
//     }

// }

export function resetGlobalState(relay: Relay) {
    const globalState = GlobalState.getInstance(relay);
    globalState.resetState();
  }

export function stateSetExecutionRelay(relay: Relay){
    const globalState = GlobalState.getInstance(relay);
    globalState.setExecutionRelay(relay)
}
export function stateSetExecutionSuccess(success: boolean){
    const globalState = GlobalState.getInstance();
    globalState.setExecutionSuccess(success)

}
/**
 * Last successful node we reached in arb execution. Set as soon as we confirm transaction success.
 * 
 * If LastNode hasn't been set, then we can't retry the arb and will throw an error
 * 
 * @param node - Formatted node data (LastNode)
 */
export function stateSetLastNode(node: LastNode) {
    const globalState = GlobalState.getInstance();
    globalState.setLastNode(node)
}

/**
 * When running a new arb, set last file path after successfully setting first LastNode.
 * 
 * Currently we need last file path to retry the arb execution, and for that we need LastNode to be set.
 * 
 * May be beneficial to set last file path as soon as we find a new arb instead
 * 
 * @param filePath - Path to arb-finder result data that is being used to execute the arb
 */
export function stateSetLastFile(filePath: string) {
    const globalState = GlobalState.getInstance();
    globalState.setLastFile(filePath)
}

export function stateSetLastExtrinsicSet(extrinsicSet: ExtrinsicSetResultDynamic) {
    const globalState = GlobalState.getInstance();
    globalState.setLastExtrinsicSet(extrinsicSet)
}

export function stateSetResultData(resultData: SingleSwapResultData | SingleTransferResultData) {
    const globalState = GlobalState.getInstance();
    globalState.setResultData(resultData)
}

export function stateSetTransactionState(transactionState: TransactionState) {
    const globalState = GlobalState.getInstance();
    globalState.setTransactionState(transactionState)
}

export function stateSetTransactionProperties(properties: TransferProperties | SwapProperties) {
    const globalState = GlobalState.getInstance();
    globalState.setTransactionProperties(properties)
}
export function stateSetTracking(tracking: boolean){
    const globalState = GlobalState.getInstance();
    globalState.setTracking(tracking)

}
export function stateSetRelayTokenBalances(balances: RelayTokenBalances) {
    const globalState = GlobalState.getInstance()
    globalState.setRelayTokenBalances(balances)
}
export function stateSetNextInputValue(nextInputValue: string){
    const globalState = GlobalState.getInstance()
    globalState.setNextInputValue(nextInputValue)
}
export async function updateXcmFeeReserves(reserveFees: ReserveFeeData[]){
    const globalState = GlobalState.getInstance();
    globalState.updateXcmFeeReserves(reserveFees)
}
// --------------------------- GET -----------------------------
export function stateGetExecutionState(): Readonly<ExecutionState>{
    const globalState = GlobalState.getInstance();
    return globalState.getState()
}
export function stateGetTransactionState(): Readonly<TransactionState>{
    return stateGetExecutionState().transactionState!
}
export function stateGetLastNode(): Readonly<LastNode | null>{
    const globalState = GlobalState.getInstance();
    return globalState.getState().lastNode
}
export function stateGetLastFilePath(): Readonly<string | null>{
    const globalState = GlobalState.getInstance();
    return globalState.getState().lastFilePath
}
export function stateGetRelay(): Readonly<Relay | null>{
    const globalState = GlobalState.getInstance();
    return globalState.getState().relay
}

export function stateGetExecutionSuccess(): Readonly<boolean>{
    const globalState = GlobalState.getInstance();
    return globalState.getState().executionSuccess
}
export function stateGetExtrinsicSetResults(): Readonly<ExtrinsicSetResultDynamic | null>{
    const globalState = GlobalState.getInstance();
    return globalState.getState().extrinsicSetResults
}
export function stateGetAccumulatedFeeData(): Readonly<AccumulatedFeeData | null>{
    const globalState = GlobalState.getInstance();
    return globalState.getState().accumulatedFeeData
}
export function stateGetXcmFeeReserves(): Readonly<ReserveFeeData[] | null>{
    const globalState = GlobalState.getInstance();
    return globalState.getState().xcmFeeReserves
}
export function stateGetTransactionProperties(): Readonly<SwapProperties | TransferProperties | null>{
    const globalState = GlobalState.getInstance();
    return globalState.getState().transactionProperties
}
export function stateGetExecutionAttempts(): Readonly<number>{
    const globalState = GlobalState.getInstance();
    return globalState.getState().executionAttempts
}
export function stateGetTracking(): Readonly<boolean>{
    const globalState = GlobalState.getInstance();
    return globalState.getState().tracking
}
export function stateGetRelayTokenBalances(): Readonly<RelayTokenBalances | null> {
    const globalState = GlobalState.getInstance()
    return globalState.getState().relayTokenBalances
}

export function stateGetNextInputValue(): Readonly<string> {
    const globalState = GlobalState.getInstance()
    return globalState.getState().nextInputValue
}

export function getLastExtrinsicResults(): SingleTransferResultData | SingleSwapResultData{
    const extrinsicResults: (SingleTransferResultData | SingleSwapResultData)[] = stateGetExtrinsicSetResults()!.allExtrinsicResults
    return extrinsicResults[extrinsicResults.length - 1]
}

export function wasLastExtrinsicSuccessful(): boolean{
    return getLastExtrinsicResults().success
}
/**
 * If GlobalState has not been initialized yet, then reads global state file for last used state
 * 
 * If GlobalState has been initialized, then just return that instance
 * @param relay 
 * 
 * @returns ExecutionState of initialized GlobalState (Readonly)
 */
export function initializeLastGlobalState(relay: Relay): Readonly<ExecutionState>{
    const globalState = GlobalState.getInstance(relay)
    return globalState.getState()
}


// REVIEW This may be unecessary and could be removed. Replace with fee reserve structure
/**
 * NOT USED. DATA IS JUST COLLECTED
 * 
 * Tracks fees by asset location
 * - Updates globalState.accumulatedFees - tracks all fees for execution run
 * - Updates accumulatedFees.json file (test file) - tracks all fees for every run accumulated
 * - Updates feeTracker.json/chopsticksFeeTracker.json - tracks every fee for each run as a new entry with FeeData and payment status. Also tracks total unpaid fees
 * 
 * globalState.accumulatedFees used in logAccumulatedFees()
 * - Tracks total fees accrued for each run, Transfer and Deposit (FeeData objects)
 * - FEE AMOUNT ADDED TO EXISTING ASSET ENTRY
 * - Fees are tracked according to the asset location of the fee asset
 * 
 * @param transferFeeData - FeeData from transfer event listener
 * @param depositFeeData - FeeData from deposit event listener
 * @param relay - Which relay to run on
 * @param chopsticks - True if running on chopsticks testnet
 */
// export async function updateAccumulatedFeeData(transferFeeData: FeeData, depositFeeData: FeeData, relay: Relay, chopsticks: boolean){
//     const { globalState } = await import("./liveTest.ts");
//     console.log("******** WRITE ACCUMULATED FEE DATA *********")
//     let transferFeeAssetLocationkey = JSON.stringify(transferFeeData.assetLocation)
//     let depositFeeAssetLocationKey = JSON.stringify(depositFeeData.assetLocation)

//     // ************** Update globalState accumulatedFeeData **************
//     if(globalState.accumulatedFeeData == null){
//         globalState.accumulatedFeeData = {}
//     }

//     // Create new entry for transfer fee asset, or add to existing amount
//     if(!globalState.accumulatedFeeData[transferFeeAssetLocationkey]){
//         globalState.accumulatedFeeData[transferFeeAssetLocationkey] = {
//             assetSymbol: transferFeeData.feeAssetSymbol,
//             assetDecimals: transferFeeData.feeAssetDecimals,
//             feeAmount: transferFeeData.feeAmount
//         }
//     } else {
//         globalState.accumulatedFeeData[transferFeeAssetLocationkey].feeAmount = new bn(transferFeeData.feeAmount).plus(new bn(globalState.accumulatedFeeData[transferFeeAssetLocationkey].feeAmount)).toString()
//     }

//     // Create new entry for deposit fee asset, or add to existing amount
//     if(!globalState.accumulatedFeeData[depositFeeAssetLocationKey]){
//         globalState.accumulatedFeeData[depositFeeAssetLocationKey] = {
//             assetSymbol: depositFeeData.feeAssetSymbol,
//             assetDecimals: depositFeeData.feeAssetDecimals,
//             feeAmount: depositFeeData.feeAmount
//         }
//     } else {
//         globalState.accumulatedFeeData[depositFeeAssetLocationKey].feeAmount = new bn(depositFeeData.feeAmount).plus(new bn(globalState.accumulatedFeeData[depositFeeAssetLocationKey].feeAmount)).toString()
//     }

//     if(globalState.tracking == true){
//         if(relay == 'kusama'){
//             fs.writeFileSync(path.join(__dirname, './executionState/kusama.json'), JSON.stringify(globalState, null, 2), 'utf8')
//         } else {
//             fs.writeFileSync(path.join(__dirname, './executionState/polkadot.json'), JSON.stringify(globalState, null, 2), 'utf8')
//         }
//     }
//     // ************** Update accumulatedFees.json accumulatedFeeData **************
//     // Same as previous section

//     let testFile = path.join(__dirname, './../../testAccumulatedFees.json')
//     if (fs.existsSync(testFile)) {
//         // File exists, read the data
//         let accumulatedFeeData = JSON.parse(fs.readFileSync(testFile, 'utf8'))
//         if(!accumulatedFeeData[transferFeeAssetLocationkey]){
//             accumulatedFeeData[transferFeeAssetLocationkey] = {
//                 assetSymbol: transferFeeData.feeAssetSymbol,
//                 assetDecimals: transferFeeData.feeAssetDecimals,
//                 feeAmount: transferFeeData.feeAmount
//             }
//         } else {
//             accumulatedFeeData[transferFeeAssetLocationkey].feeAmount = new bn(transferFeeData.feeAmount).plus(new bn(globalState.accumulatedFeeData[transferFeeAssetLocationkey].feeAmount)).toString()
//         }
    
//         if(!accumulatedFeeData[depositFeeAssetLocationKey]){
//             accumulatedFeeData[depositFeeAssetLocationKey] = {
//                 assetSymbol: depositFeeData.feeAssetSymbol,
//                 assetDecimals: depositFeeData.feeAssetDecimals,
//                 feeAmount: depositFeeData.feeAmount
//             }
//         } else {
//             accumulatedFeeData[depositFeeAssetLocationKey].feeAmount = new bn(depositFeeData.feeAmount).plus(new bn(globalState.accumulatedFeeData[depositFeeAssetLocationKey].feeAmount)).toString()
//         }
    
//         // Write the updated data back to the file
//         fs.writeFileSync(testFile, JSON.stringify(accumulatedFeeData, null, 2), 'utf8');
//     } else {
//         // File does not exist, write new data
//         fs.writeFileSync(testFile, JSON.stringify(globalState.accumulatedFeeData, null, 2), 'utf8');
//     }


// }

/**
 * NOT FULLY IMPLEMENTED YET
 * 
 * Need to rework to use ReserveFeeData
 * 
 * Updates FeeTracker with new FeeEntries
 * 
 * @param transferFeeData 
 * @param depositFeeData 
 * @param relay 
 * @param chopsticks 
 */
async function logFeeEntries(transferFeeData: FeeData, depositFeeData: FeeData, relay: Relay, chopsticks: boolean) {
    // ************** Update feeTracker.json/chopsticksFeeTracker.json **************

    // FEE TRACKER. Will be used to track fees that are not taken from the swap inputs.
    // 1. An array of each transfer fee. FeeData object (chain, symbol, id, amount, decimals, asset location, paid: boolean)
    // 2. (TODO) An array of something tracking reimbursements
    // 3. (DONT NEED, but provides a visual aid) A dictionary of unpaid fees. Key: asset location, Value: asset symbol, decimals, fee amount to be paid.
    // -- When adding a new fee, add it to allFees array.
    // -- Look up the asset location of the new fee in the unpaidFees dictionary. Add it to the total amount.
    // 4. When reimbursing fees, will go through the the array of fees, and pay the ones that have not been marked as paid 
    // DEPOSIT FEES ARE ALREADY PAID FOR, because they are taken from the swap inputs
    // TRANSFER FEES need to be paid for 

    let transferFeeAssetLocationkey = JSON.stringify(transferFeeData.assetLocation)
    let depositFeeAssetLocationKey = JSON.stringify(depositFeeData.assetLocation)

    console.log("WRITING TO FEE TRACKER")
    let feeTrackerFile = chopsticks ? 
    path.join(__dirname, './../../chopsticksFeeTracker.json') :
    path.join(__dirname, './../../feeTracker.json')
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
            assetSymbol: transferFeeData.feeAssetSymbol,
            assetDecimals: transferFeeData.feeAssetDecimals,
            feeAmount: transferFeeData.feeAmount
        }
    } else {
        feeTrackerData.unpaidFees[transferFeeAssetLocationkey].feeAmount = new bn(transferFeeData.feeAmount).plus(new bn(feeTrackerData.unpaidFees[transferFeeAssetLocationkey].feeAmount)).toString()
    }

    // Write the updated data back to the file
    fs.writeFileSync(feeTrackerFile, JSON.stringify(feeTrackerData, null, 2), 'utf8');
    
}