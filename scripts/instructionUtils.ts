import { getTNode, TNode } from "@paraspell/sdk";
import { AssetNode } from "./AssetNode";
import { InstructionType, SwapInstruction, TransferInstruction, TransferToHomeThenDestInstruction } from "./types";
import { getParaspellChainName, getAssetRegistryObjectBySymbol, getAssetBySymbolOrId } from "./utils";

// Determine instructions between two nodes
export function buildInstructions(assetNodes: AssetNode[]): (SwapInstruction | TransferInstruction)[] {
    let instructions: (SwapInstruction | TransferInstruction)[] = [];
    let assetOriginChainId = assetNodes[0].getAssetOriginChainId()
    // - Nodes on same chain === swap instructions
    if (assetNodes[0].getChainId() == assetNodes[1].getChainId()) {
        let swapInstructions = buildSwapInstruction(assetNodes)
        instructions.push(swapInstructions)
    }
    // - Node's origin chain === start/current node chain -> transfer away from home instruction
    else if(assetOriginChainId == assetNodes[0].getChainId()){
        let transferInstructions = buildTransferInstruction(assetNodes, InstructionType.TransferAwayFromHomeChain)
        transferInstructions.forEach((instruction) => {
            instructions.push(instruction)
        })
    }
    // - Node's origin chain === dest node chain -> transfer to home instruction
    else if(assetOriginChainId == assetNodes[1].getChainId()){
        let transferInstructions = buildTransferInstruction(assetNodes, InstructionType.TransferToHomeChain)
        transferInstructions.forEach((instruction) => {
            instructions.push(instruction)
        })
    }
    // - Node's origin chain !== (start node chain || dest node chain) -> transfer to home then transfer to dest instruction
    else{
        let transferInstructions = buildTransferInstruction(assetNodes, InstructionType.TransferToHomeThenDestination)
        transferInstructions.forEach((instruction) => {
            instructions.push(instruction)
        })
    }
    return instructions
    
}

function buildSwapInstruction(assetNodes: AssetNode[]): SwapInstruction {
  let swapInstruction: SwapInstruction = {
    type: InstructionType.Swap,
    chain: assetNodes[0].getChainId(),
    assetInLocalId: assetNodes[0].assetRegistryObject.tokenData.localId,
    assetInAmount: assetNodes[0].pathValue,
    assetOutLocalId: assetNodes[1].assetRegistryObject.tokenData.localId,
    assetOutTargetAmount: assetNodes[1].pathValue,
    assetNodes: assetNodes,
  };
  return swapInstruction;
}

function createInstructionTransferToHome(assetNodes: AssetNode[]) {
    let transferInstruction = createInstructionTransfer(assetNodes, InstructionType.TransferToHomeChain)
    return transferInstruction
}
function createInstructionTransferAwayFromHome(assetNodes: AssetNode[]) {
    let transferInstruction = createInstructionTransfer(assetNodes, InstructionType.TransferAwayFromHomeChain)
    return transferInstruction
}
// Creates transfer for to home then destination, which is two transfers and creates a middle node
function createInstructionTransferToHomeThenDestination(assetNodes: AssetNode[]) {
    let startAssetNode = assetNodes[0]
    let destinationAssetNode = assetNodes[1]

    let middleAssetNode = createMiddleNode(startAssetNode, destinationAssetNode)

    let transferInstruction: TransferToHomeThenDestInstruction = {
        type: InstructionType.TransferToHomeThenDestination,
        fromChainId: startAssetNode.getChainId(),
        startNode: getTNode(startAssetNode.getChainId()) || "Kusama",
        startNodeLocalId: startAssetNode.assetRegistryObject.tokenData.localId,
        startAssetNode,
        toChainId: destinationAssetNode.getChainId(),
        destinationNode: getTNode(destinationAssetNode.getChainId()) || "Kusama",
        destinationNodeLocalId: destinationAssetNode.assetRegistryObject.tokenData.localId,
        destinationAssetNode,
        middleNode: getTNode(middleAssetNode.getChainId()) || "Kusama",
        middleNodeLocalId: middleAssetNode.assetRegistryObject.tokenData.localId,
        middleAssetNode,
        assetNodes,
    };
    return transferInstruction
}

function createMiddleNode(startAssetNode: AssetNode, destinationAssetNode: AssetNode) {  
    // let startAssetNode = assetNodes[0]
    // let destinationAssetNode = assetNodes[1]
    let middleChainId = startAssetNode.getAssetOriginChainId()
    let middleNode:TNode | "Kusama" = getTNode(middleChainId) || "Kusama"
    let paraspellChain = getParaspellChainName(middleChainId)
    let paraspellAsset;
    let assetRegistryObject;
    if(paraspellChain == "Kusama"){
        paraspellAsset = null;
        assetRegistryObject = getAssetRegistryObjectBySymbol(0, "KSM")
    } else {
        let assetSymbol = startAssetNode.assetRegistryObject.tokenData.symbol
        paraspellAsset = getAssetBySymbolOrId(paraspellChain, assetSymbol)
        assetRegistryObject = startAssetNode.getAssetOriginRegistryObject()
    }
    let middleAssetNode = new AssetNode({
        paraspellChain: middleNode, 
        paraspellAsset: paraspellAsset,
        assetRegistryObject: assetRegistryObject,
        pathValue: startAssetNode.pathValue, 
    })
    return middleAssetNode
}

// Creates instruction for to home chain or away from home chain
function createInstructionTransfer(assetNodes: AssetNode[], transferType: InstructionType.TransferToHomeChain | InstructionType.TransferAwayFromHomeChain) {
    let startAssetNode = assetNodes[0]
    let destinationAssetNode = assetNodes[1]
    let transferInstruction: TransferInstruction = {
        type: transferType,
        fromChainId: startAssetNode.getChainId(),
        startNode: getTNode(startAssetNode.getChainId()) || "Kusama",
        startNodeLocalId: startAssetNode.assetRegistryObject.tokenData.localId,
        startAssetNode,
        toChainId: destinationAssetNode.getChainId(),
        destinationNode: getTNode(destinationAssetNode.getChainId()) || "Kusama",
        destinationNodeLocalId: destinationAssetNode.assetRegistryObject.tokenData.localId,
        destinationAssetNode,
        assetNodes,
    };
    return transferInstruction
    
}
function buildTransferInstruction(assetNodes: AssetNode[], transferType: InstructionType): TransferInstruction[] {
    let transferInstructions: TransferInstruction[] = []

    let transferInstruction: TransferInstruction;
    switch(transferType){
        case InstructionType.TransferToHomeChain:
            transferInstruction = createInstructionTransferToHome(assetNodes)
            transferInstructions.push(transferInstruction)
            break;
        case InstructionType.TransferAwayFromHomeChain:
            transferInstruction = createInstructionTransferAwayFromHome(assetNodes)
            transferInstructions.push(transferInstruction)
            break;
        case InstructionType.TransferToHomeThenDestination:
            transferInstruction = createInstructionTransferToHomeThenDestination(assetNodes)
            transferInstructions.push(transferInstruction)
            break;
    }
    return transferInstructions
}