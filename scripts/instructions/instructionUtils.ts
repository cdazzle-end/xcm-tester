import * as paraspell from "@paraspell/sdk";
import { AssetNode } from "./AssetNode.ts";
import { IndexObject, InstructionType, JsonPathNode, MyAssetRegistryObject, Relay, ResultDataObject, SwapInstruction, TransferInstruction, TransferrableAssetObject, TransferToHomeThenDestInstruction } from "./types.ts";
import { getParaspellChainName, getAssetRegistryObjectBySymbol, getAssetBySymbolOrId, increaseIndex, constructRouteFromFile, constructRouteFromJson, getAssetKeyFromChainAndSymbol, printAllocations } from "./utils.ts";
import fs from 'fs'
import path from 'path'
import { FixedPointNumber, Token } from "@acala-network/sdk-core";
import { fileURLToPath } from 'url';
import { getBalanceChainAsset } from "./balanceUtils.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Build instructions from arb result log
export function buildInstructionSet(relay: Relay, assetPath: AssetNode[]) {
    let instructions: (SwapInstruction | TransferInstruction)[] = [];
    let instructionIndex: IndexObject = {i: 0}
    for (let i = 0; i < assetPath.length - 1; i++) {
        let assetNodes = [assetPath[i], assetPath[i + 1]]
        let newInstructions = buildInstructions(relay, assetNodes, instructionIndex)
        newInstructions.forEach((instruction) => {
            instructions.push(instruction)
        })
    }
    return instructions
}

// Determine instructions between two nodes
export function buildInstructions(relay: Relay, assetNodes: AssetNode[], instructionIndex: IndexObject): (SwapInstruction | TransferInstruction)[] {
    let instructions: (SwapInstruction | TransferInstruction)[] = [];
    // let instructionIndex = 0
    // - Nodes on same chain === swap instructions
    if (assetNodes[0].getChainId() == assetNodes[1].getChainId()) {
        let swapInstructions = buildSwapInstruction(assetNodes, instructionIndex)
        instructions.push(swapInstructions)
    } else{
        let assetOriginChainId = assetNodes[0].getAssetOriginChainId()

        // - Node's origin chain === start/current node chain -> transfer away from home instruction
        if(assetOriginChainId == assetNodes[0].getChainId()){
            let transferInstructions = buildTransferInstruction(relay, assetNodes, InstructionType.TransferAwayFromHomeChain, instructionIndex)
            transferInstructions.forEach((instruction) => {
                instructions.push(instruction)
            })
        }
        // - Node's origin chain === dest node chain -> transfer to home instruction
        else if(assetOriginChainId == assetNodes[1].getChainId()){
            let transferInstructions = buildTransferInstruction(relay, assetNodes, InstructionType.TransferToHomeChain, instructionIndex)
            transferInstructions.forEach((instruction) => {
                instructions.push(instruction)
            })
        }
        // - Node's origin chain !== (start node chain || dest node chain) -> transfer to home then transfer to dest instruction
        else{
            let transferInstructions = buildTransferInstruction(relay, assetNodes, InstructionType.TransferToHomeThenDestination, instructionIndex)
            transferInstructions.forEach((instruction) => {
                instructions.push(instruction)
            })
        }


    }

    return instructions
    
}

export function buildSwapInstruction(assetNodes: AssetNode[], index: IndexObject): SwapInstruction {
    //Path type is important for distinguishing between swap types like stable and standard dex.
    //Path type is stored in each node of arb log results, and the path type of the next node is the type of swap between them.
    //When reverse, its the path type of this node that
    // let pathTypeIndex = reverse ? 0 : 1
    // let chainId = assetNodes[0].getChainId()
    // if(chainId == 2000){

    // }

  let swapInstruction: SwapInstruction = {
    type: InstructionType.Swap,
    chain: assetNodes[0].getChainId(),
    pathType: assetNodes[1].pathType,
    pathData: assetNodes[1].pathData,
    instructionIndex: index.i,
    assetInLocalId: assetNodes[0].assetRegistryObject.tokenData.localId,
    assetInAmount: assetNodes[0].pathValue,
    assetInAmountFixed: assetNodes[0].pathValueFixed,
    assetOutLocalId: assetNodes[1].assetRegistryObject.tokenData.localId,
    assetOutTargetAmount: assetNodes[1].pathValue,
    assetOutTargetAmountFixed: assetNodes[1].pathValueFixed,
    assetNodes: assetNodes,
  };
  increaseIndex(index)
  return swapInstruction;
}

function createInstructionTransferToHome(relay: Relay, assetNodes: AssetNode[], index: IndexObject) {
    let transferInstruction = createInstructionTransfer(relay, assetNodes, InstructionType.TransferToHomeChain, index)
    return transferInstruction
}
function createInstructionTransferAwayFromHome(relay: Relay, assetNodes: AssetNode[], index: IndexObject) {
    let transferInstruction = createInstructionTransfer(relay, assetNodes, InstructionType.TransferAwayFromHomeChain, index)
    return transferInstruction
}
// Creates transfer for to home then destination, which is two transfers and creates a middle node
function createInstructionTransferToHomeThenDestination(relay: Relay, assetNodes: AssetNode[], index: IndexObject) {
    let startAssetNode = assetNodes[0]
    let destinationAssetNode = assetNodes[1]
    let instructionIndexOne = index.i;
    // increaseIndex(index)
    let instructionIndexTwo = index.i;
    let middleAssetNode = createMiddleNode(relay, startAssetNode, destinationAssetNode)

    let relayNode: 'Kusama' | 'Polkadot' = relay === 'kusama' ? 'Kusama' : 'Polkadot'

    let transferInstruction: TransferToHomeThenDestInstruction = {
        type: InstructionType.TransferToHomeThenDestination,
        instructionIndex: instructionIndexOne,
        secondInstructionIndex: instructionIndexTwo,
        fromChainId: startAssetNode.getChainId(),
        startNode: getParaspellChainNameByParaId(relay, startAssetNode.getChainId()) || relayNode,
        startNodeLocalId: startAssetNode.assetRegistryObject.tokenData.localId,
        startAssetNode,
        toChainId: destinationAssetNode.getChainId(),
        destinationNode: getParaspellChainNameByParaId(relay, destinationAssetNode.getChainId()) || relayNode,
        destinationNodeLocalId: destinationAssetNode.assetRegistryObject.tokenData.localId,
        destinationAssetNode,
        middleNode: getParaspellChainNameByParaId(relay, middleAssetNode.getChainId()) || relayNode,
        middleNodeLocalId: middleAssetNode.assetRegistryObject.tokenData.localId,
        middleAssetNode,
        assetNodes,
    };
    increaseIndex(index)
    return transferInstruction
}

function createMiddleNode(relay: Relay, startAssetNode: AssetNode, destinationAssetNode: AssetNode) {  
    
    let relayNode: 'Kusama' | 'Polkadot' = relay === 'kusama' ? 'Kusama' : 'Polkadot'


    let middleChainId = startAssetNode.getAssetOriginChainId()
    let middleNode: paraspell.TNode | "Kusama" | "Polkadot" = paraspell.getTNode(middleChainId) || relayNode
    // let middleNode: paraspell.TNode | "Kusama" | "Polkadot" = relayNode
    let paraspellChain = getParaspellChainName(relay, middleChainId)
    let paraspellAsset;
    let assetRegistryObject;
    if(paraspellChain == "Kusama" || paraspellChain == "Polkadot"){
        paraspellAsset = null;
        let assetSymbol = paraspellChain == "Kusama" ? "KSM" : "DOT"
        assetRegistryObject = getAssetRegistryObjectBySymbol(0, assetSymbol, relay)
    } else {
        let assetSymbol = startAssetNode.assetRegistryObject.tokenData.symbol
        let assetId = JSON.stringify(startAssetNode.assetRegistryObject.tokenData.localId).replace(/\\|"/g, "")
        paraspellAsset = getAssetBySymbolOrId(paraspellChain, assetId, assetSymbol)
        assetRegistryObject = startAssetNode.getAssetOriginRegistryObject()
    }
    let middleAssetNode = new AssetNode({
        paraspellChain: middleNode, 
        paraspellAsset: paraspellAsset,
        assetRegistryObject: assetRegistryObject,
        pathValue: startAssetNode.pathValue, 
        pathType: startAssetNode.pathType,
        pathData: startAssetNode.pathData
    })
    return middleAssetNode
}

// Creates instruction for to home chain or away from home chain
function createInstructionTransfer(relay: Relay, assetNodes: AssetNode[], transferType: InstructionType.TransferToHomeChain | InstructionType.TransferAwayFromHomeChain, index: IndexObject) {
    let startAssetNode = assetNodes[0]
    let destinationAssetNode = assetNodes[1]
    let relayNode: 'Kusama' | 'Polkadot' = relay === 'kusama' ? 'Kusama' : 'Polkadot'
    let transferInstruction: TransferInstruction = {
        type: transferType,
        instructionIndex: index.i,
        fromChainId: startAssetNode.getChainId(),
        startNode: getParaspellChainNameByParaId(relay, startAssetNode.getChainId()) || relayNode,
        startNodeLocalId: startAssetNode.assetRegistryObject.tokenData.localId,
        startAssetNode,
        toChainId: destinationAssetNode.getChainId(),
        destinationNode: getParaspellChainNameByParaId(relay, destinationAssetNode.getChainId()) || relayNode,
        destinationNodeLocalId: destinationAssetNode.assetRegistryObject.tokenData.localId,
        destinationAssetNode,
        assetNodes,
    };
    increaseIndex(index)
    return transferInstruction
    
}
function buildTransferInstruction(relay: Relay, assetNodes: AssetNode[], transferType: InstructionType, index: IndexObject): TransferInstruction[] {
    let transferInstructions: TransferInstruction[] = []

    let transferInstruction: TransferInstruction;
    switch(transferType){
        case InstructionType.TransferToHomeChain:
            transferInstruction = createInstructionTransferToHome(relay, assetNodes, index)
            transferInstructions.push(transferInstruction)
            break;
        case InstructionType.TransferAwayFromHomeChain:
            transferInstruction = createInstructionTransferAwayFromHome(relay, assetNodes, index)
            transferInstructions.push(transferInstruction)
            break;
        case InstructionType.TransferToHomeThenDestination:
            transferInstruction = createInstructionTransferToHomeThenDestination(relay, assetNodes, index)
            transferInstructions.push(transferInstruction)
            break;
    }
    return transferInstructions
}

export function getTransferrableAssetObject(relay: Relay, assetNode: AssetNode): TransferrableAssetObject {
    let sourceChainParaspell = getParaspellChainName(relay, assetNode.getChainId())
    let assetParaspell;
    if(sourceChainParaspell == "Kusama"){
        assetParaspell = "KSM"
    } else if (sourceChainParaspell == "Polkadot") {
        assetParaspell = "DOT"
    } else {
        let assetId = JSON.stringify(assetNode.assetRegistryObject.tokenData.localId).replace(/\\|"/g, "")
        assetParaspell = getAssetBySymbolOrId(sourceChainParaspell, assetId, assetNode.getAssetRegistrySymbol())
    }
    if(!assetParaspell){
        throw new Error("Can't find asset paraspell object for asset node: " + JSON.stringify(assetNode, null, 2))
    }
    let originChainParaspell = getParaspellChainName(relay, assetNode.getAssetOriginChainId())

    let transferrableAssetObject: TransferrableAssetObject = {
        sourceParaspellChainName: sourceChainParaspell,
        assetRegistryObject: assetNode.assetRegistryObject,
        paraspellAsset: assetParaspell,
        originChainParaId: assetNode.getAssetOriginChainId(),
        originParaspellChainName: originChainParaspell
    }
    return transferrableAssetObject
}

export function getTransferParams(transferrableAssetObject: TransferrableAssetObject, transferInstruction: TransferInstruction){
    if(!transferrableAssetObject.paraspellAsset.symbol){
        console.log("Transferrable Asset Object: " + JSON.stringify(transferrableAssetObject))
        throw new Error("Asset symbol is null. Cant find asset registry object from allAssets in paraspell assets list")
    }
    let assetDecimals;
    if(transferrableAssetObject.sourceParaspellChainName == "Kusama"){
        assetDecimals = 12
    } else if (transferrableAssetObject.sourceParaspellChainName == "Polkadot") {
        assetDecimals = 10
    } else {
        assetDecimals = paraspell.getAssetDecimals(transferrableAssetObject.sourceParaspellChainName, transferrableAssetObject.paraspellAsset.symbol)
    }
    let transferAmount = transferInstruction.assetNodes[0].pathValue
    let transferAmountFormatted = new FixedPointNumber(transferInstruction.assetNodes[0].pathValue, assetDecimals).toChainData()
}

export function getParaspellKsmChainNameByParaId(chainId: number): paraspell.TNode{
    let chain =  paraspell.NODE_NAMES.find((node) => {
      return paraspell.getParaId(node) == chainId && paraspell.getRelayChainSymbol(node) == "KSM"  
    })
    return chain as paraspell.TNode
}
export function getParaspellChainNameByParaId(relay: Relay, chainId: number): paraspell.TNode{
    let relaySymbol = relay == 'kusama' ? "KSM" : "DOT"
    let chain =  paraspell.NODE_NAMES.find((node) => {
      return paraspell.getParaId(node) == chainId && paraspell.getRelayChainSymbol(node) == relaySymbol
    })
    return chain as paraspell.TNode
}

// BUILD paths to allocate relay token. all chains -> relay chain && relay chain -> start chain 
// maintain atleast a 0.01 Relay Token balance on Relay chain
// Dont allocate from asset hub because ksm is needed to transactions
export async function getPreTransferPath(relay: Relay, startChainId: number, inputAmount: number, chopsticks: boolean, nativeBalances: any): Promise<AssetNode[][]>{
    let nativeAssetSymbol = relay == 'kusama' ? "KSM" : "DOT"
    let minimumRelayBalance = relay == 'kusama' ? 0.01 : 1

    // Finds a chain with sufficient funds to allocate from
    let startChainBalance = nativeBalances[startChainId]
    let sufficientChainAndBalance = Object.entries(nativeBalances).find(([chainId, balance]) => {
        let transferrableRelayTokenBalance = balance as number
        if(Number.parseInt(chainId) == 0){
            transferrableRelayTokenBalance = transferrableRelayTokenBalance - minimumRelayBalance // Need to leave a 0.01 KSM balance on kusama
        }
        let combinedBalance = startChainBalance + transferrableRelayTokenBalance
        console.log(`Comparing chain ${chainId} : (${transferrableRelayTokenBalance}) -> Combined Balance ${combinedBalance} | Required amount: ${inputAmount}`)
        return Number.parseInt(chainId) != Number.parseInt(startChainId.toString()) && combinedBalance > inputAmount
    })
    

    // Dynamically allocate from multiple chains. Returns multiple AssetNode[] paths
    if(!sufficientChainAndBalance){
        console.log("No SINGLE chain with sufficient funds. Need to allocate from multiple.")
        // First make sure there is enough KSM to allocate
        let totalBalance = 0;
        Object.values(nativeBalances).forEach((balance) => {
            totalBalance += balance as number
        })
        if(totalBalance < inputAmount){
            throw new Error("Insufficient KSM to allocate")
        }
        // Count start + relay balance and allocate to that
        let accumulatedBalance = nativeBalances[startChainId] + nativeBalances[0];

        // Add 5% more allocation to account for fees
        let remainingRelayTokenToAllocate = inputAmount - accumulatedBalance
        remainingRelayTokenToAllocate = remainingRelayTokenToAllocate + (remainingRelayTokenToAllocate * 0.05)
        let nodesToAllocateFrom = []
        let allocationSufficient = false
        Object.entries(nativeBalances).forEach(([chainId, balance]) => {
            let chainBalance = balance as number
            if(Number.parseInt(chainId) != 0 && Number.parseInt(chainId) != startChainId && !allocationSufficient && chainBalance > 0){
                if(chainBalance > remainingRelayTokenToAllocate){
                    let chainAllocationData = {chainId: Number.parseInt(chainId), balance: remainingRelayTokenToAllocate}
                    accumulatedBalance += remainingRelayTokenToAllocate
                    remainingRelayTokenToAllocate = 0;
                    allocationSufficient = true
                    nodesToAllocateFrom.push(chainAllocationData)
                } else {
                    let chainAllocationData = {chainId: Number.parseInt(chainId), balance: chainBalance}
                    accumulatedBalance += chainBalance
                    remainingRelayTokenToAllocate -= chainBalance
                    nodesToAllocateFrom.push(chainAllocationData)
                }
            }
        })

        if(accumulatedBalance < inputAmount){
            throw new Error("Insufficient funds to allocate")
        }

        // Create allocations to relay chain
        let allocationPaths: JsonPathNode[][] = []
        for(let allocationNode of nodesToAllocateFrom){
            let allocationNodeAssetObject = getAssetRegistryObjectBySymbol(allocationNode.chainId, nativeAssetSymbol, relay)
            let pathNodes = await createAllocationToKusamaPath(relay, allocationNodeAssetObject, allocationNode.balance)
            allocationPaths.push(pathNodes)
            console.log(`Allocating ${allocationNode.balance} from chain ${allocationNode.chainId}`)
        }

        // Create allocation to start chain
        let startNodeAssetObject = getAssetRegistryObjectBySymbol(startChainId, nativeAssetSymbol, relay)
        let ksmAmountToTransfer = inputAmount - startChainBalance
        let kusamaToStartPath = await createAllocationKusamaToStartPath(relay, startNodeAssetObject, ksmAmountToTransfer)
        allocationPaths.push(kusamaToStartPath)

        // Allocation Paths now ready
        let allocationAssetNodePaths: AssetNode[][] = allocationPaths.map((path) => constructRouteFromJson(relay, path))
        console.log("Construction allocation paths")
        allocationAssetNodePaths.forEach((path) => {
            console.log("PATH")
            path.forEach((node) => {
                console.log(`${node.assetRegistryObject.tokenData.symbol} from ${node.paraspellChain} with value ${node.pathValue} ->`)
            })
            console.log("*********************************************************")

        })
        return allocationAssetNodePaths

    } else { 
        //Allocate sufficient ksm from a single chain. Returns a single AssetNode[] path
        let [firstChainWithSufficientFunds, returnBalance] = sufficientChainAndBalance
        let jsonPathNodes: JsonPathNode[] = []

        //Allocate ksm from a parachain node
        if(Number.parseInt(firstChainWithSufficientFunds) != 0) {
            let firstAssetObject = getAssetRegistryObjectBySymbol(Number.parseInt(firstChainWithSufficientFunds), nativeAssetSymbol, relay)            
            let secondAssetObject = getAssetRegistryObjectBySymbol(0, nativeAssetSymbol, relay)

            let firstAssetKey = JSON.stringify(firstAssetObject.tokenData.chain) + JSON.stringify(firstAssetObject.tokenData.localId)
            let secondAssetKey = JSON.stringify(secondAssetObject.tokenData.chain) + JSON.stringify(secondAssetObject.tokenData.localId)
            let keys = [firstAssetKey, secondAssetKey]

            let amountRelayTokenToTransfer = inputAmount - startChainBalance
            let pathNodesPromise = keys.map((key) => {
                return createTransferPathNode(relay, key, amountRelayTokenToTransfer)
            })
            jsonPathNodes = await Promise.all(pathNodesPromise)
            fs.writeFileSync(path.join(__dirname, './preTransferNodes.json'), JSON.stringify(jsonPathNodes, null, 2))
        } else {

            //Allocate ksm from Kusama only
            let secondAssetKey = getAssetKeyFromChainAndSymbol(0, nativeAssetSymbol, relay)
            let amountRelayTokenToTransfer = inputAmount - nativeBalances[startChainId]
            amountRelayTokenToTransfer = amountRelayTokenToTransfer + (amountRelayTokenToTransfer * 0.05)

            if(amountRelayTokenToTransfer > nativeBalances[0]){
                console.log("Insufficient KSM to allocate")
                throw new Error("Insufficient KSM to allocate")

            }
            let relayTokenPathNode = await createTransferPathNode(relay, secondAssetKey, amountRelayTokenToTransfer)
            jsonPathNodes = [relayTokenPathNode]
            fs.writeFileSync(path.join(__dirname, './preTransferNodes.json'), JSON.stringify(jsonPathNodes))
        }

        // CONSTRUCT nodes from paths
        let assetPath = constructRouteFromJson(relay, jsonPathNodes)
        return [assetPath]
    }

 
    // BUILD ASSET NODE ROUTE
}

// This is helpful just to collect all the native asset occasionally
export async function collectKsmToRelayPaths(relay: Relay, nativeBalances: any){
    let nodesToAllocateFrom = []
    Object.entries(nativeBalances).forEach(([chainId, balance]) => {
        if(Number.parseInt(chainId) != 0){
            let chainBalance = balance as number
            let chainAllocationData = {chainId: Number.parseInt(chainId), balance: chainBalance}
            nodesToAllocateFrom.push(chainAllocationData)
        }
    })
    let nativeAssetSymbol = relay == 'kusama' ? "KSM" : "DOT"
    
    // Create allocations to kusama
    let allocationPaths: JsonPathNode[][] = []
    for(let allocationNode of nodesToAllocateFrom){
        let allocationNodeAssetObject = getAssetRegistryObjectBySymbol(allocationNode.chainId, nativeAssetSymbol, relay)
        let pathNodes = await createAllocationToKusamaPath(relay, allocationNodeAssetObject, allocationNode.balance)
        allocationPaths.push(pathNodes)
        console.log(`Allocating ${allocationNode.balance} from chain ${allocationNode.chainId}`)
    }

    // Allocation Paths now ready
    let allocationAssetNodePaths: AssetNode[][] = allocationPaths.map((path) => constructRouteFromJson(relay, path))
    allocationAssetNodePaths.forEach((path) => {
        console.log("PATH")
        path.forEach((node) => {
            console.log(`${node.assetRegistryObject.tokenData.symbol} from ${node.paraspellChain} with value ${node.pathValue} ->`)
        })
        console.log("*********************************************************")
    })
        return allocationAssetNodePaths
}


export async function createTransferPathNode(relay: Relay, assetKey: string, pathValue: number, pathData?: any){
    let nativeAssetName = relay == 'kusama' ? "KSM" : "DOT"
    let pathNode: JsonPathNode = {
        node_key: assetKey,
        asset_name: nativeAssetName,
        path_value: pathValue,
        path_identifier: 0,
        path_data: pathData
    }
    return pathNode
}


export async function createAllocationToKusamaPath(relay: Relay, allocationAssetRegistryObject: MyAssetRegistryObject, pathValue: number, pathData?: any){
    let nativeAssetName = relay == 'kusama' ? "KSM" : "DOT"
    let assetKeyOne= JSON.stringify(allocationAssetRegistryObject.tokenData.chain) + JSON.stringify(allocationAssetRegistryObject.tokenData.localId)
    let pathNodeOne: JsonPathNode ={
        node_key: assetKeyOne,
        asset_name: nativeAssetName,
        path_value: pathValue,
        path_identifier: 0,
        path_data: pathData
    }
    let relayAssetRegistryObject = getAssetRegistryObjectBySymbol(0, nativeAssetName, relay)
    let assetKeyTwo = JSON.stringify(relayAssetRegistryObject.tokenData.chain) + JSON.stringify(relayAssetRegistryObject.tokenData.localId)
    let pathNodeTwo: JsonPathNode ={
        node_key: assetKeyTwo,
        asset_name: nativeAssetName,
        path_value: pathValue,
        path_identifier: 0,
        path_data: pathData
    }
    return [pathNodeOne, pathNodeTwo] 
}
export async function createAllocationKusamaToStartPath(relay: Relay, startAssetRegistryObject: MyAssetRegistryObject, pathValue: number, pathData?: any){
    let nativeAssetName = relay == 'kusama' ? "KSM" : "DOT"
    let relayAssetRegistryObject = getAssetRegistryObjectBySymbol(0, nativeAssetName, relay)
    let relayAssetKey = JSON.stringify(relayAssetRegistryObject.tokenData.chain) + JSON.stringify(relayAssetRegistryObject.tokenData.localId)
    let relayNode: JsonPathNode ={
        node_key: relayAssetKey,
        asset_name: nativeAssetName,
        path_value: pathValue,
        path_identifier: pathValue,
        path_data: pathData
    }
    let startAssetKey = JSON.stringify(startAssetRegistryObject.tokenData.chain) + JSON.stringify(startAssetRegistryObject.tokenData.localId)
    let startNode: JsonPathNode ={
        node_key: startAssetKey,
        asset_name: nativeAssetName,
        path_value: pathValue,
        path_identifier: pathValue,
        path_data: pathData
    }
    return [relayNode, startNode] 
}

export async function allocateKsmFromPreTransferPaths(relay: Relay, allocationPaths: AssetNode[][], chopsticks: boolean, executeMovr: boolean){
    //Dynamic allocation from multiple chains. Execute allocations first
    let allocationInstructions = await Promise.all(allocationPaths.map(async (path) => await buildInstructionSet(relay, path)))
    await printAllocations(allocationInstructions)

    // Remove KSM -> start allocation so it can be executed last
    let ksmToStartAllocationInstruction = allocationInstructions.pop()

    console.log("Executing allocations from chains to Kusama")
    //Turn tracking off for async executions
    const { globalState } = await import("./liveTest.ts");
    globalState.tracking = false;
    let allocationExecutionResultsPromise = allocationInstructions.map(async (instructionSet) => {
        let transferInstructions: TransferInstruction[] = instructionSet as TransferInstruction[]
        const { buildAndExecuteAllocationExtrinsics } = await import("./liveTest.ts");
        let allocationExecution = buildAndExecuteAllocationExtrinsics(relay, transferInstructions, chopsticks, executeMovr, 100)
        return allocationExecution
    })
    let allocationExecutionResults = await Promise.all(allocationExecutionResultsPromise)
    globalState.tracking = true;

    allocationExecutionResults.forEach((result) => {
        console.log("ALLOCATION SUCCESS: " + result.success)
        console.log(JSON.stringify(result.arbExecutionResult, null, 2))
    })

    let ksmBalance = await getBalanceChainAsset(chopsticks, relay, 0, "KSM")
    let ksmBalanceToTransfer = ksmBalance.free.toNumber() - 0.01

    console.log("Executing Kusama to start allocation")
    console.log(`${ksmToStartAllocationInstruction[0].assetNodes[0].getChainId()} -> ${ksmToStartAllocationInstruction[0].assetNodes[1].getChainId()} | ${ksmToStartAllocationInstruction[0].assetNodes[0].pathValue} -> ${ksmToStartAllocationInstruction[0].assetNodes[1].pathValue}`)
    //Execute Kusama to start chain
    let ksmTransferInstructions: TransferInstruction[] = ksmToStartAllocationInstruction as TransferInstruction[]

    // Set input Amount to full ksm balance
    ksmTransferInstructions[0].assetNodes[0].pathValue = ksmBalanceToTransfer
    const { buildAndExecuteAllocationExtrinsics } = await import("./liveTest.ts");
    let ksmExecution = await buildAndExecuteAllocationExtrinsics(relay, ksmTransferInstructions, chopsticks, executeMovr, 100)

    console.log("ALLOCATION SUCCESS: " + ksmExecution.success)
    console.log(JSON.stringify(ksmExecution.arbExecutionResult, null, 2))
}

