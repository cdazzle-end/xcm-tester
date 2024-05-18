import path from "path";
import fs from 'fs'
import { LastNode, Relay, ExtrinsicSetResultDynamic, TransactionState, TransferProperties, SwapProperties, ExecutionSuccess, ExecutionState } from "./types.ts";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Functions to set global state
// Every time global state is set, it should be written to a file

export async function setLastNode(node: LastNode, relay: Relay){
    const { globalState } = await import("./liveTest.ts");
    if(globalState.tracking == true){
        if(relay == 'kusama'){
            globalState.lastNode = node
            fs.writeFileSync(path.join(__dirname, './lastNode.json'), JSON.stringify(node, null, 2), 'utf8')
        } else {
            globalState.lastNode = node
            fs.writeFileSync(path.join(__dirname, './executionState/polkadot.json'), JSON.stringify(globalState, null, 2), 'utf8')
        }

    }

}
export async function setLastFile(filePath: string, relay: Relay){
    const { globalState } = await import("./liveTest.ts");
    if(globalState.tracking == true){
        if(relay == 'kusama'){
            globalState.lastFilePath = filePath;
            fs.writeFileSync(path.join(__dirname, './lastAttemptFile.json'), JSON.stringify(filePath, null, 2), 'utf8')
        } else {
            globalState.lastFilePath = filePath;
            fs.writeFileSync(path.join(__dirname, './executionState/polkadot.json'), JSON.stringify(globalState, null, 2), 'utf8')
        }
        
    }

}
export async function setLastExtrinsicSet(extrinsicSet: ExtrinsicSetResultDynamic, relay: Relay){
    const { globalState } = await import("./liveTest.ts");
    if(globalState.tracking == true){
        if(relay == 'kusama'){
            globalState.extrinsicSetResults = extrinsicSet
            fs.writeFileSync(path.join(__dirname, './executionState/lastExtrinsicSet.json'), JSON.stringify(extrinsicSet, null, 2), 'utf8')
        } else {
            globalState.extrinsicSetResults = extrinsicSet
            fs.writeFileSync(path.join(__dirname, './executionState/polkadot.json'), JSON.stringify(globalState, null, 2), 'utf8')
        }
        
    }

}
export async function setTransactionState(transactionState: TransactionState, relay: Relay){
    const { globalState } = await import("./liveTest.ts");
    if(globalState.tracking == true){
        if(relay == 'kusama'){
            globalState.transactionState = transactionState;
            fs.writeFileSync(path.join(__dirname, './lastTransactionState.json'), JSON.stringify(transactionState, null, 2), 'utf8')
        } else {
            globalState.transactionState = transactionState;
            fs.writeFileSync(path.join(__dirname, './executionState/polkadot.json'), JSON.stringify(globalState, null, 2), 'utf8')
        }
        
    }
}
export async function setTransctionProperties(properties: TransferProperties | SwapProperties, relay: Relay){
    const { globalState } = await import("./liveTest.ts");
    if(globalState.tracking == true){
        if(relay == 'kusama'){
            globalState.transactionProperties = properties;
            fs.writeFileSync(path.join(__dirname, './lastTransactionProperties.json'), JSON.stringify(properties, null, 2), 'utf8')
        } else {
            globalState.transactionProperties = properties;
            fs.writeFileSync(path.join(__dirname, './executionState/polkadot.json'), JSON.stringify(globalState, null, 2), 'utf8')
        }
        
    }

}

export async function setExecutionSuccess(success: boolean, relay: Relay){
    const { globalState } = await import("./liveTest.ts");
    if(globalState.tracking == true){
        if(success){
            globalState.executionSuccess = true
            globalState.executionAttempts = 0
        } else {
            globalState.executionAttempts += 1
        }
        let executionSuccess: ExecutionSuccess = {success, executionAttempts: globalState.executionAttempts}
        if(relay == 'kusama'){
            fs.writeFileSync(path.join(__dirname, './lastExecutionSuccess.json'), JSON.stringify(executionSuccess, null, 2), 'utf8')
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
            fs.writeFileSync(path.join(__dirname, './lastExecutionRelay.json'), JSON.stringify(relay, null, 2), 'utf8')
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

}

export function getExecutionState(relay: Relay): ExecutionState{
    if(relay == 'kusama'){
        return getLastExecutionState(relay)
    } else {
        let polkadotExecutionState: ExecutionState = JSON.parse(fs.readFileSync(path.join(__dirname, './executionState/polkadot.json'), 'utf8'))
        return polkadotExecutionState
    }
    
}

export function getLastExecutionState(relay: Relay){
    if(relay == 'kusama'){
        let lastNode = JSON.parse(fs.readFileSync(path.join(__dirname, './lastNode.json'), 'utf8'));
        let lastFilePath = JSON.parse(fs.readFileSync(path.join(__dirname, './lastAttemptFile.json'), 'utf8'));
        let allExtrinsicResults: ExtrinsicSetResultDynamic = JSON.parse(fs.readFileSync(path.join(__dirname, './executionState/lastExtrinsicSet.json'), 'utf8'));
        let transactionState: TransactionState = JSON.parse(fs.readFileSync(path.join(__dirname, './lastTransactionState.json'), 'utf8'))
        let transactionProperties: TransferProperties | SwapProperties = JSON.parse(fs.readFileSync(path.join(__dirname, './lastTransactionProperties.json'), 'utf8'))
        let lastExecution: ExecutionSuccess = JSON.parse(fs.readFileSync(path.join(__dirname, './lastExecutionSuccess.json'), 'utf8'))
        let lastExecutionRelay: Relay = JSON.parse(fs.readFileSync(path.join(__dirname, './lastExecutionRelay.json'), 'utf8'))
        let lastExecutionState: ExecutionState = {
            tracking: true,
            relay: lastExecutionRelay,
            lastNode,
            lastFilePath,
            extrinsicSetResults: allExtrinsicResults,
            transactionState: transactionState,
            transactionProperties: transactionProperties,
            executionSuccess: lastExecution.success,
            executionAttempts: lastExecution.executionAttempts
        }
        return lastExecutionState
    } else {
        let polkadotExecutionState: ExecutionState = JSON.parse(fs.readFileSync(path.join(__dirname, './executionState/polkadot.json'), 'utf8'))
        return polkadotExecutionState
    }

}