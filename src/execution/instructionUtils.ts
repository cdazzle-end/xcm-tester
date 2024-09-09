import * as paraspell from "@paraspell/sdk";
import { AssetNode } from "../core/AssetNode.ts";
import { IndexObject, PathType, InstructionType, IMyAsset, RelayTokenBalances, Relay, ArbFinderNode, SwapInstruction, TransferInstruction, TransferToHomeThenDestInstruction, PNode, RelayTokenSymbol } from "./../types/types.ts";
import { getNode, getAssetRegistryObjectBySymbol, constructRouteFromFile, constructAssetNodesFromPath, findValueByKey, printInstructionSet, readLogData, getRelayTokenSymbol, getRelayMinimum } from "../utils/utils.ts";
import fs from 'fs'
import path from 'path'
import { FixedPointNumber, Token } from "@acala-network/sdk-core";
import { fileURLToPath } from 'url';
import { getBalance, getBalanceChainAsset} from "../utils/balanceUtils.ts";
import { getApiForNode } from "../utils/apiUtils.ts";
import bn from "bignumber.js";
import { buildAndExecuteTransferExtrinsic } from "./arbExecutor.ts";
import { stateSetTracking } from "./../utils/globalStateUtils.ts";
import { MyAsset } from "../core/index.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Build instructions from arb result log
export function buildInstructionSet(relay: Relay, assetPath: AssetNode[]) {
    let instructions: (SwapInstruction | TransferInstruction)[] = [];
    for (let i = 0; i < assetPath.length - 1; i++) {
        let assetNodes = [assetPath[i], assetPath[i + 1]]
        let newInstructions = buildInstructions(relay, assetNodes)
        newInstructions.forEach((instruction) => {
            instructions.push(instruction)
        })
    }
    printInstructionSet(instructions)
    return instructions
}

// Build instructions from arb result log
export function buildInstructionSetTest(relay: Relay, assetPath: AssetNode[]) {
    let instructions: (SwapInstruction | TransferInstruction)[] = [];
    for (let i = 0; i < assetPath.length - 1; i++) {
        let assetNodes = [assetPath[i], assetPath[i + 1]]
        let newInstructions = buildInstructions(relay, assetNodes)
        newInstructions.forEach((instruction) => {
            instructions.push(instruction)
        })
    }
    return instructions
}

// Determine instructions between two nodes
export function buildInstructions(
    relay: Relay, 
    assetNodes: AssetNode[], 
): (SwapInstruction | TransferInstruction)[] {
    let instructions: (SwapInstruction | TransferInstruction)[] = [];
    if (assetNodes[0].getChainId() == assetNodes[1].getChainId()) {
        let swapInstructions = buildSwapInstruction(assetNodes)
        instructions.push(swapInstructions)
    } else{
        let assetOriginChainId = assetNodes[0].getOriginChainId()

        // - Node's origin chain === start/current node chain -> transfer away from home instruction
        if(assetOriginChainId == assetNodes[0].getChainId()){
            let transferInstructions = buildTransferInstruction(relay, assetNodes, InstructionType.TransferAwayFromHomeChain)
            transferInstructions.forEach((instruction) => {
                instructions.push(instruction)
            })
        }
        // - Node's origin chain === dest node chain -> transfer to home instruction
        else if(assetOriginChainId == assetNodes[1].getChainId()){
            let transferInstructions = buildTransferInstruction(relay, assetNodes, InstructionType.TransferToHomeChain)
            transferInstructions.forEach((instruction) => {
                instructions.push(instruction)
            })
        }
        // - Node's origin chain !== (start node chain || dest node chain) -> transfer to home then transfer to dest instruction
        else{
            let transferInstructions = buildTransferInstruction(relay, assetNodes, InstructionType.TransferToHomeThenDestination)
            transferInstructions.forEach((instruction) => {
                instructions.push(instruction)
            })
        }


    }

    return instructions
    
}

export function buildSwapInstruction(
    assetNodes: AssetNode[], 
): SwapInstruction {
    //Path type is important for distinguishing between swap types like stable and standard dex.
    //Path type is stored in each node of arb log results, and the path type of the next node is the type of swap between them.

  let swapInstruction: SwapInstruction = {
    type: InstructionType.Swap,
    chain: assetNodes[0].getChainId(),
    pathType: assetNodes[1].pathType,
    pathData: assetNodes[1].pathData,
    assetInLocalId: assetNodes[0].asset.tokenData.localId,
    assetInAmount: assetNodes[0].pathValue,
    assetOutLocalId: assetNodes[1].asset.tokenData.localId,
    assetOutTargetAmount: assetNodes[1].pathValue,
    assetNodes: assetNodes,
  };
//   console.log(JSON.stringify(swapInstruction, null, 2))
  return swapInstruction;
}

function createInstructionTransferToHome(
    relay: Relay, 
    assetNodes: AssetNode[], 
) {
    let transferInstruction = createInstructionTransfer(relay, assetNodes, InstructionType.TransferToHomeChain)
    return transferInstruction
}
function createInstructionTransferAwayFromHome(
    relay: Relay, 
    assetNodes: AssetNode[]
) {
    let transferInstruction = createInstructionTransfer(relay, assetNodes, InstructionType.TransferAwayFromHomeChain)
    return transferInstruction
}
// Creates transfer for to home then destination, which is two transfers and creates a middle node
function createInstructionTransferToHomeThenDestination(
    relay: Relay, 
    assetNodes: AssetNode[]
) {
    let startAssetNode = assetNodes[0]
    let destinationAssetNode = assetNodes[1]
    let middleAssetNode = createMiddleNode(relay, startAssetNode)

    let xcmTransferReserves = assetNodes[1].pathData.xcmTransferReserveAmounts
    let xcmTransferFees = assetNodes[1].pathData.xcmTransferFeeAmounts
    let xcmDepositReserves = assetNodes[1].pathData.xcmDepositReserveAmounts
    let xcmDepositFees = assetNodes[1].pathData.xcmDepositFeeAmounts
    

    let transferInstruction: TransferToHomeThenDestInstruction = {
        type: InstructionType.TransferToHomeThenDestination,
        
        // startNode: getNode(relay, startAssetNode.getChainId()),
        // startNodeLocalId: startAssetNode.asset.tokenData.localId,
        // startAssetNode,
        startAsset: startAssetNode,
        startTransferFee: xcmTransferFees![0],
        startTransferReserve: xcmTransferReserves![0],

        // middleNode: getNode(relay, middleAssetNode.getChainId()),
        // middleNodeLocalId: middleAssetNode.asset.tokenData.localId,
        middleAsset: middleAssetNode,
        middleTransferFee: xcmTransferFees![1],
        middleTransferReserve: xcmTransferReserves![1],
        middleDepositFee: xcmDepositFees![0],
        middleDepositReserve: xcmDepositReserves![0],

        // destinationNode: getNode(relay, destinationAssetNode.getChainId()),
        // destinationNodeLocalId: destinationAssetNode.asset.tokenData.localId,
        destinationAsset: destinationAssetNode,
        destinationDepositFee: xcmDepositFees![1],
        destinationDepositReserve: xcmDepositReserves![1],

        assetNodes,
    };
    console.log(`New Transfer Instruction ${transferInstruction.startAsset.chain} -> ${transferInstruction.destinationAsset.chain} (${assetNodes[0].getAssetSymbol()}) Xcm Fee: ${xcmTransferFees}`)
    return transferInstruction
}

/**
 * Creating middle node when transferring an asset to origin chain then to desination
 * 
 * @param relay 
 * @param startAssetNode 
 * @param destinationAssetNode 
 * @returns 
 */
function createMiddleNode(relay: Relay, startAssetNode: AssetNode) {  

    let middleChainId = startAssetNode.getOriginChainId()
    let middleNode: PNode = getNode(relay, middleChainId)
    let middleAsset: MyAsset;
    if(middleNode == "Kusama" || middleNode == "Polkadot"){
        let assetSymbol = middleNode == "Kusama" ? "KSM" : "DOT"
        middleAsset = new MyAsset(getAssetRegistryObjectBySymbol(0, assetSymbol, relay))
    } else {
        middleAsset = startAssetNode.getAssetOriginRegistryObject()
    }
    let middleAssetNode = new AssetNode({
        chain: middleNode,
        asset: middleAsset,
        pathValue: startAssetNode.pathValue, 
        pathType: startAssetNode.pathType,
        pathData: startAssetNode.pathData
    })
    return middleAssetNode
}

// Creates instruction for to home chain or away from home chain
function createInstructionTransfer(
    relay: Relay, 
    assetNodes: AssetNode[], 
    transferType: InstructionType.TransferToHomeChain | InstructionType.TransferAwayFromHomeChain, 
) {
    let startAsset: AssetNode = assetNodes[0]
    let destinationAsset: AssetNode = assetNodes[1]
    let xcmTransferFees = assetNodes[1].pathData.xcmTransferFeeAmounts
    let xcmTransferReserves = assetNodes[1].pathData.xcmTransferReserveAmounts
    let xcmDepositFees = assetNodes[1].pathData.xcmDepositFeeAmounts
    let xcmDepositReserves = assetNodes[1].pathData.xcmDepositReserveAmounts
    let transferInstruction: TransferInstruction = {
        type: transferType,
        startAsset: startAsset,
        startTransferFee: xcmTransferFees![0],
        startTransferReserve: xcmTransferReserves![0],
        destinationAsset: destinationAsset,
        destinationDepositFee: xcmDepositFees![0],
        destinationDepositReserve: xcmDepositReserves![0],
        assetNodes,
    };

    console.log(`New Transfer Instruction ${startAsset.chain} -> ${destinationAsset.chain} (${startAsset.getAssetSymbol()}) Xcm Fees: ${transferInstruction.startTransferFee}`)
    
    return transferInstruction
    
}
function buildTransferInstruction(
    relay: Relay, 
    assetNodes: AssetNode[], 
    transferType: InstructionType, 
): TransferInstruction[] {
    let transferInstructions: TransferInstruction[] = []

    let transferInstruction: TransferInstruction;
    switch(transferType){
        case InstructionType.TransferToHomeChain:
            transferInstruction = createInstructionTransferToHome(relay, assetNodes)
            transferInstructions.push(transferInstruction)
            break;
        case InstructionType.TransferAwayFromHomeChain:
            transferInstruction = createInstructionTransferAwayFromHome(relay, assetNodes)
            transferInstructions.push(transferInstruction)
            break;
        case InstructionType.TransferToHomeThenDestination:
            transferInstruction = createInstructionTransferToHomeThenDestination(relay, assetNodes)
            transferInstructions.push(transferInstruction)
            break;
    }
    return transferInstructions
}
/**
 * Parse parachain value from asset location to get origin/home chain
 * 
 * @param asset MyAssetRegistryObject
 * @returns Para ID
 */
function getAssetOriginChainId(asset: IMyAsset): number{
    // Check if relay chain/kusama
    if(asset.tokenLocation == "here"){
        return 0
    }
    let parachain = findValueByKey(asset.tokenLocation, "Parachain")
    if(!parachain){
        throw new Error("Can't find origin chain for asset: " + JSON.stringify(asset, null, 2))
    }
    return parseInt(parachain)
}

/**
 * Create transferrable asset object from asset object
 * 
 * @param relay 
 */
export function buildTransferrableAssetObject(relay: Relay, asset: IMyAsset){
    const startChain = getNode(relay, asset.tokenData.chain)
    const homeChainId = getAssetOriginChainId(asset)
    const homeChain = getNode(relay, homeChainId)

    return {
        sourceParaspellChainName: startChain,
        assetRegistryObject: asset,
        originChainParaId: homeChainId,
        originParaspellChainName: homeChain
    }
}

// BUILD paths to allocate relay token. all chains -> relay chain && relay chain -> start chain 
// If running allocation function, then the relay chain should already have enough funds. So likely just relay chain -> start chain
// maintain atleast a 0.01 Relay Token balance on Relay chain
// Dont allocate from asset hub because ksm is needed to transactions
// export async function getPreTransferPath(
//     relay: Relay, 
//     startChainId: number, 
//     inputAmount: number, 
//     nativeBalances: any
// ): Promise<AssetNode[][]>{
//     let nativeAssetSymbol = relay == 'kusama' ? "KSM" : "DOT"
//     let minimumRelayBalance = relay == 'kusama' ? 0.01 : 1

//     // Finds a chain with sufficient funds to allocate from
//     // If we run relay allocation function, then the relay chain should have the funds to transfer for swap
//     let startChainBalance = nativeBalances[startChainId]
//     let sufficientChainAndBalance = Object.entries(nativeBalances).find(([chainId, balance]) => {
//         let transferrableRelayTokenBalance = balance as number
//         if(Number.parseInt(chainId) == 0){
//             transferrableRelayTokenBalance = transferrableRelayTokenBalance - minimumRelayBalance // Need to leave a 0.01 KSM balance on kusama
//         }
//         let combinedBalance = startChainBalance + transferrableRelayTokenBalance
//         console.log(`Comparing chain ${chainId} : (${transferrableRelayTokenBalance}) -> Combined Balance ${combinedBalance} | Required amount: ${inputAmount}`)
//         return Number.parseInt(chainId) != Number.parseInt(startChainId.toString()) && combinedBalance > inputAmount
//     })
    

//     // Dynamically allocate from multiple chains. Returns multiple AssetNode[] paths
//     if(!sufficientChainAndBalance){
//         console.log("No SINGLE chain with sufficient funds. Need to allocate from multiple.")
//         // First make sure there is enough KSM/DOT to allocate
//         let totalBalance = 0;
//         Object.values(nativeBalances).forEach((balance) => {
//             totalBalance += balance as number
//         })
//         if(totalBalance < inputAmount){
//             throw new Error("Insufficient KSM/DOT to allocate")
//         }
//         // Count start + relay balance and allocate to that
//         let accumulatedBalance = nativeBalances[startChainId] + nativeBalances[0];

//         // Add 5% more allocation to account for fees
//         let remainingRelayTokenToAllocate = inputAmount - accumulatedBalance
//         remainingRelayTokenToAllocate = remainingRelayTokenToAllocate + (remainingRelayTokenToAllocate * 0.05)
//         let nodesToAllocateFrom: any[] = []
//         let allocationSufficient = false
//         Object.entries(nativeBalances).forEach(([chainId, balance]) => {
//             let chainBalance = balance as number
//             if(Number.parseInt(chainId) != 0 && Number.parseInt(chainId) != startChainId && !allocationSufficient && chainBalance > 0){
//                 if(chainBalance > remainingRelayTokenToAllocate){
//                     let chainAllocationData = {chainId: Number.parseInt(chainId), balance: remainingRelayTokenToAllocate}
//                     accumulatedBalance += remainingRelayTokenToAllocate
//                     remainingRelayTokenToAllocate = 0;
//                     allocationSufficient = true
//                     nodesToAllocateFrom.push(chainAllocationData)
//                 } else {
//                     let chainAllocationData = {chainId: Number.parseInt(chainId), balance: chainBalance}
//                     accumulatedBalance += chainBalance
//                     remainingRelayTokenToAllocate -= chainBalance
//                     nodesToAllocateFrom.push(chainAllocationData)
//                 }
//             }
//         })

//         if(accumulatedBalance < inputAmount){
//             throw new Error("Insufficient funds to allocate")
//         }

//         // Create allocations to relay chain
//         let allocationPaths: ArbFinderNode[][] = []
//         for(let allocationNode of nodesToAllocateFrom){
//             let allocationNodeAssetObject = getAssetRegistryObjectBySymbol(allocationNode.chainId, nativeAssetSymbol, relay)
//             let pathNodes = await createAllocationPath(relay, allocationNodeAssetObject, allocationNode.balance)
//             allocationPaths.push(pathNodes)
//             console.log(`Allocating ${allocationNode.balance} from chain ${allocationNode.chainId}`)
//         }

//         // Create allocation to start chain
//         let startNodeAssetObject = getAssetRegistryObjectBySymbol(startChainId, nativeAssetSymbol, relay)
//         let ksmAmountToTransfer = inputAmount - startChainBalance
//         let kusamaToStartPath = await createAllocationKusamaToStartPath(relay, startNodeAssetObject, ksmAmountToTransfer)
//         allocationPaths.push(kusamaToStartPath)

//         // Allocation Paths now ready
//         let allocationAssetNodePaths: AssetNode[][] = allocationPaths.map((path) => constructRouteFromJson(relay, path))
//         console.log("Construction allocation paths")
//         allocationAssetNodePaths.forEach((path) => {
//             console.log("PATH")
//             path.forEach((node) => {
//                 console.log(`${node.asset.tokenData.symbol} from ${node.chain} with value ${node.pathValue} ->`)
//             })
//             console.log("*********************************************************")

//         })
//         return allocationAssetNodePaths

//     } else { 
//         //Allocate sufficient ksm from a single chain. Returns a single AssetNode[] path
//         let [firstChainWithSufficientFunds, returnBalance] = sufficientChainAndBalance
//         let jsonPathNodes: ArbFinderNode[] = []

//         //Allocate ksm from a parachain node
//         if(Number.parseInt(firstChainWithSufficientFunds) != 0) {
//             let firstAssetObject = getAssetRegistryObjectBySymbol(Number.parseInt(firstChainWithSufficientFunds), nativeAssetSymbol, relay)            
//             let secondAssetObject = getAssetRegistryObjectBySymbol(0, nativeAssetSymbol, relay)

//             let firstAssetKey = JSON.stringify(firstAssetObject.tokenData.chain) + JSON.stringify(firstAssetObject.tokenData.localId)
//             let secondAssetKey = JSON.stringify(secondAssetObject.tokenData.chain) + JSON.stringify(secondAssetObject.tokenData.localId)
//             let keys = [firstAssetKey, secondAssetKey]

//             let amountRelayTokenToTransfer = inputAmount - startChainBalance
//             let pathNodesPromise = keys.map((key) => {
//                 return createXcmPathNode(relay, key, amountRelayTokenToTransfer)
//             })
//             jsonPathNodes = await Promise.all(pathNodesPromise)
//             fs.writeFileSync(path.join(__dirname, './preTransferNodes.json'), JSON.stringify(jsonPathNodes, null, 2))
//         } else {

//             //Allocate ksm from Kusama only
//             let secondAssetKey = getAssetKeyFromChainAndSymbol(0, nativeAssetSymbol, relay)
//             let amountRelayTokenToTransfer = inputAmount - nativeBalances[startChainId]
//             amountRelayTokenToTransfer = amountRelayTokenToTransfer + (amountRelayTokenToTransfer * 0.05)

//             if(amountRelayTokenToTransfer > nativeBalances[0]){
//                 console.log("Insufficient KSM to allocate")
//                 throw new Error("Insufficient KSM to allocate")

//             }
//             let relayTokenPathNode = await createXcmPathNode(relay, secondAssetKey, amountRelayTokenToTransfer)
//             jsonPathNodes = [relayTokenPathNode]
//             fs.writeFileSync(path.join(__dirname, './preTransferNodes.json'), JSON.stringify(jsonPathNodes))
//         }

//         // CONSTRUCT nodes from paths
//         let assetPath = constructRouteFromJson(relay, jsonPathNodes)
//         return [assetPath]
//     }

 
//     // BUILD ASSET NODE ROUTE
// }
// export async function getBalance(paraId: number, relay: Relay, chopsticks: boolean, chainApi: ApiPromise, assetSymbol: string, assetObject: MyAssetRegistryObject, node: string, accountAddress: string): Promise<BalanceData>{

/**
 * Prepend arb path with a transfer node from the relay to start chain
 * - Only if start chain has less than the required balance for swap
 * - Relay chain must have sufficient balance
 * - Writes path node to file (./preTransferNodes.json)
 * 
 * @param relay 
 * @param startChainId 
 * @param inputAmount 
 * @param nativeBalances 
 * @returns 
 */
export function getStartChainAllocationPath(
    relay: Relay, 
    startChainId: number, 
    inputAmount: number, 
    nativeBalances: any
): AssetNode[]{
    const relayTokenSymbol: RelayTokenSymbol = getRelayTokenSymbol(relay)
    const relayTokenBalance: bn = new bn(nativeBalances[0])
    const startTokenBalance: bn = new bn(nativeBalances[startChainId])

    const requiredInputAmount = new bn(inputAmount)

    const minimumRelayBalance = new bn(getRelayMinimum(relay))
    const transferAmountPadding = relay == 'kusama' ? new bn(0.01) : new bn(0.1) // Pad transfer amount to account for fees, so we have enough to start swaps with intended amount. Theres a better way to do this
    const amountNeededToTransfer = requiredInputAmount.minus(startTokenBalance)
    const actualAmountToTransfer = amountNeededToTransfer.plus(transferAmountPadding)
    
    let transferPathNodes: ArbFinderNode[] = []

    const requiredRelayBalance: bn = amountNeededToTransfer.plus(minimumRelayBalance).plus(transferAmountPadding)

    if(startTokenBalance.lt(requiredInputAmount)){
        console.log(`Start chain: ${startChainId} has insufficient funds to allocate. Need to allocate from relay`)
        if (relayTokenBalance.lt(requiredRelayBalance)) throw new Error("Relay does not have enough funds to allocate for swap")

        let relayAsset = new MyAsset(getAssetRegistryObjectBySymbol(0, relayTokenSymbol, relay))
        let relayPathNode: ArbFinderNode = createXcmPathNode(relay, relayAsset, actualAmountToTransfer.toNumber())
        transferPathNodes = [relayPathNode]
        fs.writeFileSync(path.join(__dirname, './preTransferNodes.json'), JSON.stringify(transferPathNodes))
    }

    // CONSTRUCT nodes from paths
    let assetPath: AssetNode[] = constructAssetNodesFromPath(relay, transferPathNodes)
    return assetPath
}

/**
 * Create xcm node paths from each chain to relay, depending on chain balances
 * - Will keep a minimum amount of token on each chain
 * 
 * 
 * @param relay 
 * @param nativeBalances - Balance of relay token on each chain
 * @param startChainId - First swap chain, skip allocation from here
 * @returns 
 */
export function createAllocationPaths(relay: Relay, nativeBalances: RelayTokenBalances, startChainId: number){
    let nodesToAllocateFrom: any[] = []
    let minimumTokenBalance = relay == 'kusama' ? 0.01 : 0.02
    Object.entries(nativeBalances).forEach(([chainId, balance]) => {
        if(Number.parseInt(chainId) != 0 && Number.parseInt(chainId) != startChainId){
            let chainBalance = new bn(balance)
            let amountToTransfer: bn;
            if(chainBalance.gt(minimumTokenBalance)){
                amountToTransfer = chainBalance.minus(minimumTokenBalance)
            } else {
                amountToTransfer = new bn(0)
            }
            let chainAllocationData = {chainId: Number.parseInt(chainId), balance: amountToTransfer}
            nodesToAllocateFrom.push(chainAllocationData)
        }
    })
    let nativeAssetSymbol = relay == 'kusama' ? "KSM" : "DOT"
    
    // Create node paths from each chain to relay
    let allocationPaths: ArbFinderNode[][] = []
    for(let allocationNode of nodesToAllocateFrom){
        let relayAsset = new MyAsset(getAssetRegistryObjectBySymbol(allocationNode.chainId, nativeAssetSymbol, relay))
        let pathNodes: ArbFinderNode[] = createAllocationPath(relay, relayAsset, allocationNode.balance)
        allocationPaths.push(pathNodes)
        console.log(`Allocating ${allocationNode.balance} from chain ${allocationNode.chainId}`)
    }

    // Allocation Paths now ready
    // let allocationAssetNodePaths: AssetNode[][] = allocationPaths.map((path) => constructRouteFromJson(relay, path))
    const allocationAssetNodePaths: AssetNode[][] = allocationPaths.map((allocationPath) => {
        return allocationPath.map((pathNode) => readLogData(pathNode, relay))
    })

    allocationAssetNodePaths.forEach((path) => {
        console.log("PATH")
        path.forEach((node) => {
            console.log(`${node.asset.tokenData.symbol} from ${node.chain} with value ${node.pathValue} ->`)
        })
        console.log("*********************************************************")
    })
        return allocationAssetNodePaths
}

/**
 * Create a xcm path node for a given asset and path value
 * 
 * @param relay 
 * @param assetKey 
 * @param pathValue 
 * @returns 
 */
export function createXcmPathNode(
    relay: Relay, 
    asset: MyAsset,
    pathValue: number
): ArbFinderNode {
    let pathNode: ArbFinderNode = {
        node_key: asset.getAssetKey(),
        asset_name: asset.getSymbol(),
        path_value: pathValue,
        path_type: "Xcm",
        path_data: {
            "path_type": "Xcm",
            "lp_id": null
        }
    }
    return pathNode
}

/**
 * Create 2 ArbFinderNode path nodes from specified chain -> relay for the given value
 * 
 * @param relay 
 * @param relayAsset - relay asset from the chain to be allocated from 
 * @param pathValue 
 * @returns [nodeOne, nodeTwo]
 */
export function createAllocationPath(relay: Relay, relayAsset: MyAsset, pathValue: number): [ArbFinderNode, ArbFinderNode]{
    let nativeAssetName = relay == 'kusama' ? "KSM" : "DOT"
    let assetKeyOne = relayAsset.getAssetKey()
    let pathNodeOne: ArbFinderNode ={
        node_key: assetKeyOne,
        asset_name: nativeAssetName,
        path_value: pathValue,
        path_type: "Xcm",
        path_data: {
            "path_type": "Xcm",
            "lp_id": null
        }
    }
    let relayAssetRegistryObject = new MyAsset(getAssetRegistryObjectBySymbol(0, nativeAssetName, relay))
    let assetKeyTwo = relayAssetRegistryObject.getAssetKey()
    let pathNodeTwo: ArbFinderNode ={
        node_key: assetKeyTwo,
        asset_name: nativeAssetName,
        path_value: pathValue,
        path_type: "Xcm",
        path_data: {
            "path_type": "Xcm",
            "lp_id": null
        }
    }
    return [pathNodeOne, pathNodeTwo] 
}
export async function createAllocationKusamaToStartPath(relay: Relay, startAssetRegistryObject: IMyAsset, pathValue: number){
    let nativeAssetName = relay == 'kusama' ? "KSM" : "DOT"
    let relayAssetRegistryObject = getAssetRegistryObjectBySymbol(0, nativeAssetName, relay)
    let relayAssetKey = JSON.stringify(relayAssetRegistryObject.tokenData.chain) + JSON.stringify(relayAssetRegistryObject.tokenData.localId)
    let relayNode: ArbFinderNode ={
        node_key: relayAssetKey,
        asset_name: nativeAssetName,
        path_value: pathValue,
        path_type: "Xcm",
        path_data: {
            "path_type": "Xcm",
            "lp_id": null
        }
    }
    let startAssetKey = JSON.stringify(startAssetRegistryObject.tokenData.chain) + JSON.stringify(startAssetRegistryObject.tokenData.localId)
    let startNode: ArbFinderNode ={
        node_key: startAssetKey,
        asset_name: nativeAssetName,
        path_value: pathValue,
        path_type:"Xcm",
        path_data: {
            "path_type": "Xcm",
            "lp_id": null
        }
    }
    return [relayNode, startNode] 
}

// export async function allocateKsmFromPreTransferPaths(relay: Relay, allocationPaths: AssetNode[][], chopsticks: boolean, executeMovr: boolean){
//     //Dynamic allocation from multiple chains. Execute allocations first
//     let allocationInstructions = await Promise.all(allocationPaths.map(async (path) => buildInstructionSet(relay, path)))
//     printAllocations(allocationInstructions)

//     // Remove KSM -> start allocation so it can be executed last
//     let ksmToStartAllocationInstruction = allocationInstructions.pop()

//     console.log("Executing allocations from chains to Kusama")
//     //Turn tracking off for async executions
//     stateSetTracking(false)
//     let allocationExecutionResultsPromise = allocationInstructions.map(async (instructionSet) => {
//         let transferInstructions: TransferInstruction[] = instructionSet as TransferInstruction[]
//         let allocationExecution = buildAndExecuteTransferExtrinsic(relay, transferInstructions, chopsticks, executeMovr)
//         return allocationExecution
//     })
//     let allocationExecutionResults = await Promise.all(allocationExecutionResultsPromise)
//     stateSetTracking(true)

//     allocationExecutionResults.forEach((result) => {
//         console.log("ALLOCATION SUCCESS: " + result.success)
//         console.log(JSON.stringify(result.arbExecutionResult, null, 2))
//     })

//     let ksmBalance = await getBalanceChainAsset(chopsticks, relay, "Kusama", 0, "KSM", "KSM")
//     let ksmBalanceToTransfer = ksmBalance.free.toNumber() - 0.01

//     console.log("Executing Kusama to start allocation")
//     console.log(`${ksmToStartAllocationInstruction![0].assetNodes[0].getChainId()} -> ${ksmToStartAllocationInstruction![0].assetNodes[1].getChainId()} | ${ksmToStartAllocationInstruction![0].assetNodes[0].pathValue} -> ${ksmToStartAllocationInstruction![0].assetNodes[1].pathValue}`)
//     //Execute Kusama to start chain
//     let ksmTransferInstructions: TransferInstruction[] = ksmToStartAllocationInstruction as TransferInstruction[]

//     // Set input Amount to full ksm balance
//     ksmTransferInstructions[0].assetNodes[0].pathValue = ksmBalanceToTransfer.toString()

//     let ksmExecution = await buildAndExecuteTransferExtrinsic(relay, ksmTransferInstructions, chopsticks, executeMovr)

//     console.log("ALLOCATION SUCCESS: " + ksmExecution.success)
//     console.log(JSON.stringify(ksmExecution.arbExecutionResult, null, 2))
// }

// // Skip route nodes up to ksm node to start from / first swap node
export async function getFirstSwapNodeFromInstructions(instructions: (SwapInstruction | TransferInstruction)[]){ 
    let instructionCounter = 0;   
    let firstInstruction = instructions.find((instruction, index) => {
        if(instruction.type == InstructionType.Swap){
            instructionCounter = index
            return true
        }   
    })
    if(!firstInstruction){
        throw new Error("No swap instructions found")
    }
    let instructionsToExecute = instructions.slice(instructionCounter)

    return instructionsToExecute
}