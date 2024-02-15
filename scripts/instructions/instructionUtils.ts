import * as paraspell from "@paraspell/sdk";
import { AssetNode } from "./AssetNode.ts";
import { IndexObject, InstructionType, SwapInstruction, TransferInstruction, TransferrableAssetObject, TransferToHomeThenDestInstruction } from "./types.ts";
import { getParaspellChainName, getAssetRegistryObjectBySymbol, getAssetBySymbolOrId, increaseIndex } from "./utils.ts";

import { FixedPointNumber, Token } from "@acala-network/sdk-core";

// Determine instructions between two nodes
export function buildInstructions(assetNodes: AssetNode[], instructionIndex: IndexObject): (SwapInstruction | TransferInstruction)[] {
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
            let transferInstructions = buildTransferInstruction(assetNodes, InstructionType.TransferAwayFromHomeChain, instructionIndex)
            transferInstructions.forEach((instruction) => {
                instructions.push(instruction)
            })
        }
        // - Node's origin chain === dest node chain -> transfer to home instruction
        else if(assetOriginChainId == assetNodes[1].getChainId()){
            let transferInstructions = buildTransferInstruction(assetNodes, InstructionType.TransferToHomeChain, instructionIndex)
            transferInstructions.forEach((instruction) => {
                instructions.push(instruction)
            })
        }
        // - Node's origin chain !== (start node chain || dest node chain) -> transfer to home then transfer to dest instruction
        else{
            let transferInstructions = buildTransferInstruction(assetNodes, InstructionType.TransferToHomeThenDestination, instructionIndex)
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
  let swapInstruction: SwapInstruction = {
    type: InstructionType.Swap,
    chain: assetNodes[0].getChainId(),
    pathType: assetNodes[1].pathType,
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

function createInstructionTransferToHome(assetNodes: AssetNode[], index: IndexObject) {
    let transferInstruction = createInstructionTransfer(assetNodes, InstructionType.TransferToHomeChain, index)
    return transferInstruction
}
function createInstructionTransferAwayFromHome(assetNodes: AssetNode[], index: IndexObject) {
    let transferInstruction = createInstructionTransfer(assetNodes, InstructionType.TransferAwayFromHomeChain, index)
    return transferInstruction
}
// Creates transfer for to home then destination, which is two transfers and creates a middle node
function createInstructionTransferToHomeThenDestination(assetNodes: AssetNode[], index: IndexObject) {
    let startAssetNode = assetNodes[0]
    let destinationAssetNode = assetNodes[1]
    let instructionIndexOne = index.i;
    // increaseIndex(index)
    let instructionIndexTwo = index.i;
    let middleAssetNode = createMiddleNode(startAssetNode, destinationAssetNode)

    let transferInstruction: TransferToHomeThenDestInstruction = {
        type: InstructionType.TransferToHomeThenDestination,
        instructionIndex: instructionIndexOne,
        secondInstructionIndex: instructionIndexTwo,
        fromChainId: startAssetNode.getChainId(),
        startNode: getParaspellKsmChainNameByParaId(startAssetNode.getChainId()) || "Kusama",
        startNodeLocalId: startAssetNode.assetRegistryObject.tokenData.localId,
        startAssetNode,
        toChainId: destinationAssetNode.getChainId(),
        destinationNode: getParaspellKsmChainNameByParaId(destinationAssetNode.getChainId()) || "Kusama",
        destinationNodeLocalId: destinationAssetNode.assetRegistryObject.tokenData.localId,
        destinationAssetNode,
        middleNode: getParaspellKsmChainNameByParaId(middleAssetNode.getChainId()) || "Kusama",
        middleNodeLocalId: middleAssetNode.assetRegistryObject.tokenData.localId,
        middleAssetNode,
        assetNodes,
    };
    increaseIndex(index)
    return transferInstruction
}

function createMiddleNode(startAssetNode: AssetNode, destinationAssetNode: AssetNode) {  
    // let startAssetNode = assetNodes[0]
    // let destinationAssetNode = assetNodes[1]
    let middleChainId = startAssetNode.getAssetOriginChainId()
    let middleNode: paraspell.TNode | "Kusama" = paraspell.getTNode(middleChainId) || "Kusama"
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
        pathType: startAssetNode.pathType
    })
    return middleAssetNode
}

// Creates instruction for to home chain or away from home chain
function createInstructionTransfer(assetNodes: AssetNode[], transferType: InstructionType.TransferToHomeChain | InstructionType.TransferAwayFromHomeChain, index: IndexObject) {
    let startAssetNode = assetNodes[0]
    let destinationAssetNode = assetNodes[1]
    let transferInstruction: TransferInstruction = {
        type: transferType,
        instructionIndex: index.i,
        fromChainId: startAssetNode.getChainId(),
        startNode: getParaspellKsmChainNameByParaId(startAssetNode.getChainId()) || "Kusama",
        startNodeLocalId: startAssetNode.assetRegistryObject.tokenData.localId,
        startAssetNode,
        toChainId: destinationAssetNode.getChainId(),
        destinationNode: getParaspellKsmChainNameByParaId(destinationAssetNode.getChainId()) || "Kusama",
        destinationNodeLocalId: destinationAssetNode.assetRegistryObject.tokenData.localId,
        destinationAssetNode,
        assetNodes,
    };
    increaseIndex(index)
    return transferInstruction
    
}
function buildTransferInstruction(assetNodes: AssetNode[], transferType: InstructionType, index: IndexObject): TransferInstruction[] {
    let transferInstructions: TransferInstruction[] = []

    let transferInstruction: TransferInstruction;
    switch(transferType){
        case InstructionType.TransferToHomeChain:
            transferInstruction = createInstructionTransferToHome(assetNodes, index)
            transferInstructions.push(transferInstruction)
            break;
        case InstructionType.TransferAwayFromHomeChain:
            transferInstruction = createInstructionTransferAwayFromHome(assetNodes, index)
            transferInstructions.push(transferInstruction)
            break;
        case InstructionType.TransferToHomeThenDestination:
            transferInstruction = createInstructionTransferToHomeThenDestination(assetNodes, index)
            transferInstructions.push(transferInstruction)
            break;
    }
    return transferInstructions
}

export function getTransferrableAssetObject(assetNode: AssetNode): TransferrableAssetObject {
    let sourceChainParaspell = getParaspellChainName(assetNode.getChainId())
    let assetParaspell;
    if(sourceChainParaspell == "Kusama"){
        assetParaspell = "KSM"
    } else {
        assetParaspell = getAssetBySymbolOrId(sourceChainParaspell, assetNode.getAssetRegistrySymbol())
    }
    if(!assetParaspell){
        throw new Error("Can't find asset paraspell object for asset node: " + JSON.stringify(assetNode, null, 2))
    }
    let originChainParaspell = getParaspellChainName(assetNode.getAssetOriginChainId())

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