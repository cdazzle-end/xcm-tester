import fs from 'fs'
import * as paraspell from '@paraspell/sdk'
import { TNode } from '@paraspell/sdk'
import { getParaspellChainName, getSigner, increaseIndex } from './utils.ts'
import { InstructionType, SwapInstruction, TransferInstruction, TransferToHomeThenDestInstruction, TransferrableAssetObject, SwapExtrinsicContainer, ExtrinsicObject, ChainNonces, TransferExtrinsicContainer, IndexObject, PreExecutionTransfer, Relay } from './types.ts'
import { AssetNode } from './AssetNode.ts'
import { getTransferrableAssetObject } from './instructionUtils.ts';
import { fileURLToPath } from 'url';
import {  getKarSwapExtrinsicDynamic } from './../swaps/karSwap.ts';
import { formatMovrTx, getMovrSwapTx } from './../swaps/movr/movrSwap.ts';
import { getBncSwapExtrinsicDynamic } from './../swaps/bncSwap.ts';
import { getBsxSwapExtrinsicDynamic } from './../swaps/bsxSwap.ts';
import { getMgxSwapExtrinsic } from './../swaps/mgxSwap.ts';
import { getHkoSwapExtrinsic } from './../swaps/hkoSwap.ts';
import { FixedPointNumber } from "@acala-network/sdk-core";
import { getApiForNode } from './apiUtils.ts';
import { getAcaSwapExtrinsicDynamic } from './../swaps/acaSwap.ts';
import { getBncPolkadotSwapExtrinsicDynamic } from './../swaps/bncPolkadot.ts';
import { getParaSwapExtrinsic } from './../swaps/paraSwap.ts';
import { getHdxSwapExtrinsicDynamic } from './../swaps/hdxSwap.ts';
import { getGlmrSwapTx } from './../swaps/glmr/glmrSwap.ts';






export async function buildTransferExtrinsicReworked(relay: Relay, instruction: TransferInstruction, extrinsicIndex: IndexObject, chopsticks: boolean){
    let transferExtrinsics: TransferExtrinsicContainer[] = []
    switch(instruction.type){
        case InstructionType.TransferToHomeChain:
            transferExtrinsics.push(await buildTransferExtrinsicFromInstruction(relay, instruction, extrinsicIndex, chopsticks))
            break;
        case InstructionType.TransferAwayFromHomeChain:
            transferExtrinsics.push(await buildTransferExtrinsicFromInstruction(relay, instruction, extrinsicIndex, chopsticks))
            break;
        case InstructionType.TransferToHomeThenDestination:
            console.log("TRANSFERS")
            let transfers = await buildDoubleTransferExtrinsic(relay, instruction, extrinsicIndex, chopsticks)
            transfers.forEach((transfer) => {
                // console.log(JSON.stringify(transfer.extrinsic, null, 2))
                transferExtrinsics.push(transfer)
            })
            break;
    }
    return transferExtrinsics
}

export async function buildTransferExtrinsicDynamic(relay: Relay, instruction: TransferInstruction, extrinsicIndex: IndexObject, chopsticks: boolean): Promise<[TransferExtrinsicContainer, TransferInstruction[]]> {
    let transferExtrinsic: TransferExtrinsicContainer;
    let remainingInstructions: TransferInstruction[] = [];
    // console.log("**************************************")
    switch(instruction.type){
        case InstructionType.TransferToHomeChain:
            transferExtrinsic = await buildTransferExtrinsicFromInstruction(relay, instruction, extrinsicIndex, chopsticks);
            break;
        case InstructionType.TransferAwayFromHomeChain:
            transferExtrinsic = await buildTransferExtrinsicFromInstruction(relay, instruction, extrinsicIndex, chopsticks);
            break;
        case InstructionType.TransferToHomeThenDestination:
            console.log("TRANSFERS")
            let [transferOne, transferTwo] = splitDoubleTransferInstruction(instruction)
            transferExtrinsic = await buildTransferExtrinsicFromInstruction(relay, transferOne, extrinsicIndex, chopsticks)
            remainingInstructions.push(transferTwo)
            break;
    }
    // console.log("**************************************")
    return [transferExtrinsic, remainingInstructions]
}

// export async function buildReverseTransferExtrinsicFromExtrinsic(transferTxContainer: TransferExtrinsicContainer){
//     let firstNode = transferTxContainer.secondNode
//     let firstApi = transferTxContainer.destinationApi
//     let firstTransferrable = transferTxContainer.destinationTransferrable
    
//     let secondNode = transferTxContainer.firstNode
//     let secondApi = transferTxContainer.startApi
//     let secondTransferrable = transferTxContainer.startTransferrable

//     let currencyInput = firstTransferrable.paraspellAssetSymbol.assetId? firstTransferrable.paraspellAssetSymbol.assetId : firstTransferrable.paraspellAssetSymbol.symbol

//     let assetDecimals = getAssetDecimalsForNode(firstNode, firstTransferrable)
//     let firstParaId = transferTxContainer.destinationChainId
//     let secondParaId = transferTxContainer.startChainId
//     let transferAmount = new FixedPointNumber(transferTxContainer.pathValue, Number.parseInt(assetDecimals.toString())).toChainData()


//     let signer = await getSigner();
//     let destinationAddress = signer.address
//     if(secondNode == "Moonriver"){
//         destinationAddress = alithAddress

//     }


//     let xcmTx: paraspell.Extrinsic;
//     if(firstNode == "Kusama" && secondNode != "Kusama") {
//         xcmTx = paraspell.Builder(firstApi).to(secondNode).amount(transferAmount).address(destinationAddress).build()
//     } else if(secondNode == "Kusama" && firstNode != "Kusama") {
//         xcmTx = paraspell.Builder(firstApi).from(firstNode).amount(transferAmount).address(destinationAddress).build()
//     } else if(firstNode != "Kusama" && secondNode != "Kusama") {
//         xcmTx = paraspell.Builder(firstApi).from(firstNode).to(secondNode).currency(currencyInput).amount(transferAmount).address(destinationAddress).build()
//     } else {
//         throw new Error("Invalid transfer instruction")
//     }


//     let reverseExtrinsic: TransferExtrinsicContainer = {
//         firstNode: firstNode,
//         secondNode: secondNode,
//         assetSymbol: firstTransferrable.paraspellAssetSymbol.symbol,
//         assetIdStart: transferTxContainer.assetIdEnd,
//         assetIdEnd: transferTxContainer.assetIdStart,
//         extrinsic: xcmTx,
//         startApi: firstApi,
//         destinationApi: secondApi,
//         startChainId: firstParaId,
//         destinationChainId: secondParaId,
//         startTransferrable: firstTransferrable,
//         destinationTransferrable: secondTransferrable,
//         pathValue: transferTxContainer.pathValue
//     }
//     return reverseExtrinsic
// }

export async function buildTransferExtrinsicFromInstruction(relay: Relay, instruction: TransferInstruction, extrinsicIndex: IndexObject, chopsticks: boolean): Promise<TransferExtrinsicContainer> {
   
    console.log("Creating transfer extrinsic")
    
    let startTransferrable = getTransferrableAssetObject(relay, instruction.startAssetNode)
    let destinationTransferrable = getTransferrableAssetObject(relay, instruction.destinationAssetNode)
    let currencyInput = startTransferrable.paraspellAsset.assetId? startTransferrable.paraspellAsset.assetId : startTransferrable.paraspellAsset.symbol
    
    let assetDecimals = getAssetDecimalsForNode(instruction.startNode, startTransferrable)
    let startParaId = getParaIdFromAssetNode(instruction.startNode, instruction.startAssetNode)
    let destinationParaId = getParaIdFromAssetNode(instruction.destinationNode, instruction.destinationAssetNode)
    let transferAmount = new FixedPointNumber(instruction.assetNodes[0].pathValue, Number.parseInt(assetDecimals.toString())).toChainData()

    let startApi = await getApiForNode(instruction.startNode, chopsticks)
    let destinationApi = await getApiForNode(instruction.destinationNode, chopsticks)


    console.log(`Transfer: ${instruction.startNode} -> ${instruction.destinationNode}  (${currencyInput} ${transferAmount.toString()})`)

    let signer;

    if(instruction.destinationNode == "Moonriver" || instruction.destinationNode == "Moonbeam"){
        signer = await getSigner(chopsticks, true);
    } else {
        signer = await getSigner(chopsticks, false);
    }
    let destinationAddress = signer.address

    // console.log("Building with parasepll")
    let xcmTx: paraspell.Extrinsic;
    if((instruction.startNode == "Kusama" || instruction.startNode == "Polkadot")  && (instruction.destinationNode != "Kusama" && instruction.destinationNode != "Polkadot")) {
        xcmTx = paraspell.Builder(startApi).to(instruction.destinationNode).amount(transferAmount).address(destinationAddress).build()
    } else if((instruction.destinationNode == "Kusama" || instruction.destinationNode == "Polkadot") && (instruction.startNode != "Kusama" && instruction.startNode != "Polkadot")) {
        // console.log("Transfer to relay chain")
        xcmTx = paraspell.Builder(startApi).from(instruction.startNode).amount(transferAmount).address(destinationAddress).build()
    } else if((instruction.startNode != "Kusama" && instruction.startNode != "Polkadot") && (instruction.destinationNode != "Kusama" && instruction.destinationNode != "Polkadot")) {
        // console.log("Transfer between parachains")
        xcmTx = paraspell.Builder(startApi).from(instruction.startNode).to(instruction.destinationNode).currency(currencyInput).amount(transferAmount).address(destinationAddress).build()
    } else {
        throw new Error("Invalid transfer instruction")
    }

    // console.log(`xcmTx ${JSON.stringify(xcmTx, null, 2)}`)

    let instructionIndex = instruction.instructionIndex
    let txContainer: TransferExtrinsicContainer = {
        relay: relay,
        firstNode: instruction.startNode,
        secondNode: instruction.destinationNode,
        assetSymbol: startTransferrable.paraspellAsset.symbol,
        assetIdStart: instruction.startAssetNode.getAssetLocalId(),
        assetIdEnd: instruction.destinationAssetNode.getAssetLocalId(),
        extrinsic: xcmTx,
        extrinsicIndex: extrinsicIndex.i,
        instructionIndex: [instructionIndex],
        startApi: startApi,
        destinationApi: destinationApi,
        startChainId: startParaId,
        destinationChainId: destinationParaId,
        startTransferrable: startTransferrable,
        destinationTransferrable: destinationTransferrable,
        pathInLocalId: instruction.startNodeLocalId,
        pathOutLocalId: instruction.destinationNodeLocalId,
        pathSwapType: 0,
        pathAmount: instruction.assetNodes[0].pathValue
    }
    increaseIndex(extrinsicIndex)
    console.log("Created transfer extrinsic")
    return txContainer
}
async function buildDoubleTransferExtrinsic(relay: Relay, instruction: TransferToHomeThenDestInstruction, extrinsicIndex: IndexObject, chopsticks: boolean): Promise<[TransferExtrinsicContainer, TransferExtrinsicContainer]> {
    let splitInstructions = splitDoubleTransferInstruction(instruction)
    let firstExtrinsic = await buildTransferExtrinsicFromInstruction(relay, splitInstructions[0], extrinsicIndex, chopsticks)
    let secondExtrinsic = await buildTransferExtrinsicFromInstruction(relay, splitInstructions[1], extrinsicIndex, chopsticks)
    return [firstExtrinsic, secondExtrinsic]
}

// This split Instruction is only used to create two separate transfer extrinsics ^^^ and is not used for the actual instruction
function splitDoubleTransferInstruction(instruction: TransferToHomeThenDestInstruction): [TransferInstruction, TransferInstruction] {
    let middleNodeChainId = instruction.middleAssetNode.getChainId()
    let startInstruction: TransferInstruction = {
        type: InstructionType.TransferToHomeChain,
        instructionIndex: instruction.instructionIndex,
        fromChainId: instruction.fromChainId,
        toChainId: middleNodeChainId,

        startNode: instruction.startNode,
        destinationNode: instruction.middleNode,

        startNodeLocalId: instruction.startNodeLocalId,
        destinationNodeLocalId: instruction.middleNodeLocalId,

        startAssetNode: instruction.startAssetNode,
        destinationAssetNode: instruction.middleAssetNode,

        assetNodes: instruction.assetNodes.slice(0,2)
    }
    let destinationInstruction: TransferInstruction = {
        type: InstructionType.TransferAwayFromHomeChain,
        instructionIndex: instruction.instructionIndex,
        fromChainId: middleNodeChainId,
        toChainId: instruction.toChainId,

        startNode: instruction.middleNode,
        destinationNode: instruction.destinationNode,

        startNodeLocalId: instruction.middleNodeLocalId,
        destinationNodeLocalId: instruction.destinationNodeLocalId,

        startAssetNode: instruction.middleAssetNode,
        destinationAssetNode: instruction.destinationAssetNode,

        assetNodes: instruction.assetNodes.slice(1)
    }
    return [startInstruction, destinationInstruction]
}


function getAssetDecimalsForNode(node: TNode | "Kusama" | "Polkadot", transferObject: TransferrableAssetObject){
    if(node == "Kusama"){
        return 12
    } else if (node == "Polkadot"){
        return 10
    } else {
        return paraspell.getAssetDecimals(node, transferObject.paraspellAsset.symbol)
    }
}
function getParaIdFromAssetNode(node: TNode | "Kusama" | "Polkadot", assetNode: AssetNode){
    if(node == "Kusama" || node == "Polkadot"){
        return 0
    } else {
        return assetNode.getChainId()
    }
}


// Takes array of swap instructions. Builds extrinsics start asset in instruction 1, to destination asset in the final instruction
// export async function buildSwapExtrinsic(instructions: SwapInstruction[], chainNonces: ChainNonces, extrinsicIndex: IndexObject, chopsticks: boolean): Promise<SwapExtrinsicContainer[]> {
//     let chainId = instructions[0].chain
//     let swapType = instructions[0].pathType
//     let startAsset = instructions[0].assetNodes[0].getAssetRegistrySymbol()
//     let destAsset = instructions[instructions.length - 1].assetNodes[1].getAssetRegistrySymbol()
//     let amountIn = instructions[0].assetNodes[0].pathValue;
//     let expectedAmountOut = instructions[instructions.length - 1].assetNodes[1].pathValue;
//     let pathStartLocalId = instructions[0].assetInLocalId
//     let pathDestLocalId = instructions[instructions.length - 1].assetOutLocalId
//     let signer = await getSigner(chopsticks, false);
//     let instructionIndex: number[] = []
//     instructionIndex: instructions.forEach((instruction) => {
//         instructionIndex.push(instruction.instructionIndex)
//     })

//     let pathNodeValues : PathNodeValues = {
//         pathInSymbol: "TEST Symbol in",
//         pathOutSymbol: "TEST Symbol out",
//         pathInLocalId: pathStartLocalId,
//         pathOutLocalId: pathDestLocalId,
//         pathSwapType: swapType,
//         pathValue: amountIn
//     }
//     // Kar dex can handle swap pathing in single extrinsic
//     let test = true;
//     if(chainId == 2000){
//         // Can use symbol or local id
//         const descriptorString = `KAR ${startAsset} -> ${destAsset}`
//         console.log(descriptorString)
//         let swapTxContainers = await getKarSwapExtrinsicBestPath(swapType, startAsset, destAsset, amountIn, expectedAmountOut, instructions, test, chainNonces[2000], extrinsicIndex, instructionIndex, pathNodeValues)
//         // console.log(JSON.stringify(swapTxContainer))
//         swapTxContainers.forEach((swapTxContainer) => {
//             swapTxContainer.txString = descriptorString
//         })
//         chainNonces[2000]++
//         return swapTxContainers
//     // Movr needs explicit pathing
//     } else if(chainId == 2001){
//         // CAN CONSOLIDATE SWAP INSTRUCTIONS INTO SINGLE EXTRINSIC
//         console.log(`BNC ${startAsset} -> ${destAsset}`)
//         const descriptorString = `BNC ${startAsset} -> ${destAsset}`
//         let swapTxContainer = await getBncSwapExtrinsic(startAsset, destAsset, amountIn, expectedAmountOut, instructions, test, chainNonces[2001], extrinsicIndex, instructionIndex, pathNodeValues)
//         swapTxContainer.txString = descriptorString
//         chainNonces[2001]++
//         return [swapTxContainer]
//     } else if(chainId == 2023){
//         console.log(`MOV ${startAsset} -> ${destAsset}`)
//         const descriptorString = `MOV ${startAsset} -> ${destAsset}`
//         let movrBatchSwapParams = await getMovrSwapTx(instructions, false)
//         let reverseMovrBatchSwapParams = movrBatchSwapParams.reverseSwapParams
//         let liveWallet = movrBatchSwapParams.wallet;
//         let batchContract = movrBatchSwapParams.batchContract;
        
//         let batchContractAddress = await batchContract.getAddress()
//         console.log(`Wallet: ${liveWallet.address} | Batch Contract: ${batchContractAddress}`)
//         let tokens = movrBatchSwapParams.inputTokens

//         // //WHEN we execute the tx, we need to approve batch contract to spend tokens first
//         for(let i = 0; i < tokens.length; i++){
//             let tokenInput = movrBatchSwapParams.amount0Ins[i] > 0 ? movrBatchSwapParams.amount0Ins[i] : movrBatchSwapParams.amount1Ins[i]
//             let approval = await checkAndApproveToken(tokens[i], liveWallet, batchContractAddress, tokenInput)
//         }
//         let wrapMovrAmount = movrBatchSwapParams.movrWrapAmounts[0]

//         let assetInNode = instructions[0].assetNodes[0]
//         let assetOutNode = instructions[instructions.length - 1].assetNodes[1]
//         let assetInDecimals = assetInNode.assetRegistryObject.tokenData.decimals
//         let assetOutDecimals = assetOutNode.assetRegistryObject.tokenData.decimals
//         let inputAmount = instructions[0].assetInAmount
//         let outputAmount = instructions[instructions.length - 1].assetOutTargetAmount
        
//         let inputFixedPoint = new FixedPointNumber(inputAmount, Number.parseInt(assetInDecimals))
//         let outputFixedPoint = new FixedPointNumber(outputAmount, Number.parseInt(assetOutDecimals))
//         // let inputFixedPoint = new FixedPointNumber(inputAmount.toString(), 18)

//         let movrTx = async function executeSwapTx() {
//             return await batchContract.executeSwaps(
//                 movrBatchSwapParams.dexAddresses, 
//                 movrBatchSwapParams.abiIndexes, 
//                 movrBatchSwapParams.inputTokens,
//                 movrBatchSwapParams.outputTokens, 
//                 movrBatchSwapParams.amount0Ins, 
//                 movrBatchSwapParams.amount1Ins, 
//                 movrBatchSwapParams.amount0Outs, 
//                 movrBatchSwapParams.amount1Outs, 
//                 movrBatchSwapParams.movrWrapAmounts, 
//                 movrBatchSwapParams.data, 
//                 {value: wrapMovrAmount}
//             );
//         };
//         let assetNodes: AssetNode[] = [instructions[0].assetNodes[0]]
//         instructions.forEach((swapInstruction) => {
//             assetNodes.push(swapInstruction.assetNodes[1])
//         })
//         // let assetNodes = instructions[0].assetNodes
//         let swapTxContainer: SwapExtrinsicContainer = {
//             chainId: 2023,
//             chain: "Moonriver",
//             assetNodes: assetNodes,
//             extrinsic: movrTx,
//             extrinsicIndex: extrinsicIndex.i,
//             instructionIndex: instructionIndex,
//             txString: descriptorString,
//             nonce: chainNonces[2023],
//             assetSymbolIn: startAsset,
//             assetSymbolOut: destAsset,
//             assetAmountIn: inputFixedPoint,
//             expectedAmountOut: outputFixedPoint,
//             // pathInLocalId: pathStartLocalId,
//             // pathOutLocalId: pathDestLocalId,
//             pathSwapType: swapType,
//             pathAmount: amountIn,
//             reverseTx: reverseMovrBatchSwapParams,
//             movrBatchSwapParams: movrBatchSwapParams
//         }
//         increaseIndex(extrinsicIndex)
//         return [swapTxContainer]

//     // Basilisk will return array of extrinsics
//     } else if(chainId == 2090){
    
//         console.log(`BSX ${startAsset} -> ${destAsset}`)
//         const descriptorString = `BSX ${startAsset} -> ${destAsset}`
//         let swapTxContainers = await getBsxSwapExtrinsic(startAsset, destAsset, amountIn, expectedAmountOut, instructions, test, chainNonces[2090], extrinsicIndex, instructionIndex, pathNodeValues)
//         swapTxContainers.forEach((swapTxContainer) => {
//             swapTxContainer.txString = descriptorString
//         })
//         chainNonces[2090]++
//         return swapTxContainers
//     } else if (chainId == 2110){
//         console.log(`MGX ${startAsset} -> ${destAsset}`)
//         const descriptorString = `MGX ${startAsset} -> ${destAsset}`
//         let swapTxContainer = await getMgxSwapExtrinsic(startAsset, destAsset, amountIn, expectedAmountOut, instructions, test, chainNonces[2110], extrinsicIndex,instructionIndex, pathNodeValues)
//         swapTxContainer.txString = descriptorString
//         chainNonces[2110]++
//         return [swapTxContainer]
//     } else if(chainId == 2085){
//         console.log(`HKO ${startAsset} -> ${destAsset}`)
//         const descriptorString = `HKO ${startAsset} -> ${destAsset}`
//         let swapTxContainer = await getHkoSwapExtrinsic(startAsset, destAsset, amountIn, expectedAmountOut, instructions, test, chainNonces[2085], extrinsicIndex, instructionIndex, pathNodeValues)
//         swapTxContainer.txString = descriptorString
//         chainNonces[2085]++
//         return [swapTxContainer]
//     } else {
//         throw new Error("Chain not supported")
//     }
// }

export async function buildSwapExtrinsicDynamic(relay: Relay, instructions: SwapInstruction[], chainNonces: ChainNonces, extrinsicIndex: IndexObject, chopsticks: boolean): Promise<[SwapExtrinsicContainer, SwapInstruction[]]> {
    let chainId = instructions[0].chain
    let swapType = instructions[0].pathType
    let swapData = instructions[0].pathData
    let startAsset = instructions[0].assetNodes[0].getAssetRegistrySymbol()
    let destAsset = instructions[instructions.length - 1].assetNodes[1].getAssetRegistrySymbol()
    let amountIn = instructions[0].assetNodes[0].pathValue;
    let expectedAmountOut = instructions[instructions.length - 1].assetNodes[1].pathValue;
    let pathStartLocalId = instructions[0].assetInLocalId
    let pathDestLocalId = instructions[instructions.length - 1].assetOutLocalId
    let instructionIndex: number[] = []
    instructionIndex: instructions.forEach((instruction) => {
        instructionIndex.push(instruction.instructionIndex)
    })
    let swapContainer, remainingInstructions
    if(relay == 'kusama'){
        [swapContainer, remainingInstructions] = await buildKusamaSwapExtrinsics(instructions, chainId, swapType, startAsset, destAsset, amountIn, expectedAmountOut, chopsticks, chainNonces, extrinsicIndex, instructionIndex)
    } else if (relay == 'polkadot'){
        [swapContainer, remainingInstructions] = await buildPolkadotSwapExtrinsic(instructions, chainId, swapType, swapData, startAsset, destAsset, amountIn, expectedAmountOut, chopsticks, chainNonces, extrinsicIndex, instructionIndex)
    } else {
        throw new Error("Invalid relay")
    }
    return [swapContainer, remainingInstructions]
}

async function buildKusamaSwapExtrinsics(instructions, chainId, swapType, startAsset, destAsset, amountIn,expectedAmountOut, chopsticks, chainNonces, extrinsicIndex, instructionIndex){
    if(chainId == 2000){
        let [swapTxContainer, remainingInstructions] = await getKarSwapExtrinsicDynamic(swapType, startAsset, destAsset, amountIn, expectedAmountOut, instructions, chopsticks, chainNonces[2000], extrinsicIndex, instructionIndex)
        let swapAssetNodes = swapTxContainer.assetNodes
        let startAssetDynamic = swapAssetNodes[0].getAssetRegistrySymbol()
        let destAssetDynamic = swapAssetNodes[swapAssetNodes.length - 1].getAssetRegistrySymbol()
        const descriptorString = `KAR ${startAssetDynamic} -> ${destAssetDynamic}`
        console.log("**************************************")
        console.log(descriptorString)
        console.log("**************************************")
        swapTxContainer.txString = descriptorString
        return [swapTxContainer, remainingInstructions]
    } else if(chainId == 2001){
        // console.log(`BNC ${startAsset} -> ${destAsset}`)
        const descriptorString = `BNC ${startAsset} -> ${destAsset}`
        console.log("**************************************")
        console.log(descriptorString)
        console.log("**************************************")
        let [swapTxContainer, remainingInstructions] = await getBncSwapExtrinsicDynamic(swapType, instructions, chopsticks, chainNonces[2001], extrinsicIndex, instructionIndex)
        swapTxContainer.txString = descriptorString
        chainNonces[2001]++
        return [swapTxContainer, remainingInstructions]
    } else if(chainId == 2023){
        const descriptorString = `MOVR ${startAsset} -> ${destAsset}`
        console.log("**************************************")
        console.log(descriptorString)
        console.log("**************************************")
        let remainingInstructions: SwapInstruction[] = []

        let testnet = false
        let movrBatchSwapParams = await getMovrSwapTx(instructions, testnet)
        let swapTxContainer = await formatMovrTx(movrBatchSwapParams, instructions, chainNonces, extrinsicIndex, instructionIndex, chopsticks)
        swapTxContainer.txString = descriptorString
        return [swapTxContainer, remainingInstructions]
    } else if(chainId == 2090){
        const descriptorString = `BSX ${startAsset} -> ${destAsset}`
        console.log("**************************************")
        console.log(descriptorString)
        console.log("**************************************")
        let [swapTxContainer, remainingInstructions] = await getBsxSwapExtrinsicDynamic(swapType, startAsset, destAsset, amountIn, expectedAmountOut, instructions, chopsticks, chainNonces[2090], extrinsicIndex, instructionIndex)
        swapTxContainer.txString = descriptorString
        chainNonces[2090]++
        return [swapTxContainer, remainingInstructions]
    } else if(chainId == 2110){
        const descriptorString = `MGX ${startAsset} -> ${destAsset}`
        console.log("**************************************")
        console.log(descriptorString)
        console.log("**************************************")
        let swapTxContainer = await getMgxSwapExtrinsic(swapType, startAsset, destAsset, amountIn, expectedAmountOut, instructions, chopsticks, chainNonces[2110], extrinsicIndex,instructionIndex)
        swapTxContainer.txString = descriptorString
        chainNonces[2110]++
        let remainingInstructions: SwapInstruction[] = []
        return [swapTxContainer, remainingInstructions]
    } else if(chainId == 2085){
        const descriptorString = `HKO ${startAsset} -> ${destAsset}`
        console.log("**************************************")
        console.log(descriptorString)
        console.log("**************************************")
        let swapTxContainer = await getHkoSwapExtrinsic(swapType, startAsset, destAsset, amountIn, expectedAmountOut, instructions, chopsticks, chainNonces[2085], extrinsicIndex, instructionIndex)
        swapTxContainer.txString = descriptorString
        chainNonces[2085]++
        let remainingInstructions: SwapInstruction[] = []
        return [swapTxContainer, remainingInstructions]
    } else {
        throw new Error("Chain not supported")
    }
}

async function buildPolkadotSwapExtrinsic(instructions, chainId, swapType, swapData, startAsset, destAsset, amountIn,expectedAmountOut, chopsticks, chainNonces, extrinsicIndex, instructionIndex){
    console.log("Building Polkadot Swap Extrinsic")
    if(chainId == 2000){
        //aca
        let [swapTxContainer, remainingInstructions] = await getAcaSwapExtrinsicDynamic(swapType, startAsset, destAsset, amountIn, expectedAmountOut, instructions, chopsticks, chainNonces[2000], extrinsicIndex, instructionIndex)
        let swapAssetNodes = swapTxContainer.assetNodes
        let startAssetDynamic = swapAssetNodes[0].getAssetRegistrySymbol()
        let destAssetDynamic = swapAssetNodes[swapAssetNodes.length - 1].getAssetRegistrySymbol()
        const descriptorString = `ACA ${startAssetDynamic} -> ${destAssetDynamic}`
        console.log("**************************************")
        console.log(descriptorString)
        console.log("**************************************")
        swapTxContainer.txString = descriptorString
        return [swapTxContainer, remainingInstructions]

    } else if (chainId == 2030) {
        //bnc
            // console.log(`BNC ${startAsset} -> ${destAsset}`)
            const descriptorString = `BNC ${startAsset} -> ${destAsset}`
            console.log("**************************************")
            console.log(descriptorString)
            console.log("**************************************")
            let [swapTxContainer, remainingInstructions] = await getBncPolkadotSwapExtrinsicDynamic(swapType, instructions, chopsticks, chainNonces[2001], extrinsicIndex, instructionIndex)
            swapTxContainer.txString = descriptorString
            chainNonces[2001]++
            return [swapTxContainer, remainingInstructions]

    }else if (chainId == 2004){
        //glmr
        const descriptorString = `GLMR ${startAsset} -> ${destAsset}`
        console.log("**************************************")
        console.log(descriptorString)
        console.log("**************************************")
        let remainingInstructions: SwapInstruction[] = []

        let testnet = false
        let swapTxContainer = await getGlmrSwapTx(instructions, testnet, chainNonces, extrinsicIndex, instructionIndex)
        swapTxContainer.txString = descriptorString
        return [swapTxContainer, remainingInstructions]
    } else if (chainId == 2012){
        //para
        const descriptorString = `PARA ${startAsset} -> ${destAsset}`
        console.log("**************************************")
        console.log(descriptorString)
        console.log("**************************************")
        let swapTxContainer = await getParaSwapExtrinsic(swapType, startAsset, destAsset, amountIn, expectedAmountOut, instructions, chopsticks, chainNonces[2085], extrinsicIndex, instructionIndex)
        swapTxContainer.txString = descriptorString
        chainNonces[2085]++
        let remainingInstructions: SwapInstruction[] = []
        return [swapTxContainer, remainingInstructions]
    } else if(chainId == 2034){
        //hdx
        const descriptorString = `HDX ${startAsset} -> ${destAsset}`
        console.log("**************************************")
        console.log(descriptorString)
        console.log("**************************************")
        let [swapTxContainer, remainingInstructions] = await getHdxSwapExtrinsicDynamic(swapType, swapData, startAsset, destAsset, amountIn, expectedAmountOut, instructions, chopsticks, chainNonces[2090], extrinsicIndex, instructionIndex)
        swapTxContainer.txString = descriptorString
        chainNonces[2090]++
        return [swapTxContainer, remainingInstructions]
    }  else {
        throw new Error("Chain not supported")
    }
}

export async function createTransferExtrinsicObject(transferContainer: TransferExtrinsicContainer){
    let extrinsicObj: ExtrinsicObject = {
        type: "Transfer",
        instructionIndex: transferContainer.instructionIndex,
        extrinsicIndex: transferContainer.extrinsicIndex,
        transferExtrinsicContainer: transferContainer
    }
    return extrinsicObj
}
export async function createSwapExtrinsicObject(swapContainer: SwapExtrinsicContainer){
    let extrinsicObj: ExtrinsicObject = {
        type: "Swap",
        instructionIndex: swapContainer.instructionIndex,
        extrinsicIndex: swapContainer.extrinsicIndex,
        swapExtrinsicContainer: swapContainer
    }
    return extrinsicObj
}

export async function buildTransferToKsm(relay: Relay, fromChainId: number, amount: FixedPointNumber, chopsticks: boolean){
    if(fromChainId == 0){
        throw new Error("Trying to transfer kusama away from home chain to kusama")
    }
    let fromNode = getParaspellChainName(relay, fromChainId) as TNode
    let fromApi = await getApiForNode(fromNode, false)
    let fromAccount = fromNode == "Moonriver" ? await getSigner(chopsticks, true) : await getSigner(chopsticks, false);
    let ksmAccount = await getSigner(chopsticks, false)

    let transferTx = paraspell.Builder(fromApi).from(fromNode).amount(amount.toChainData()).address(ksmAccount.address).build()
    let transfer: PreExecutionTransfer = {
        fromChainId: fromChainId,
        fromChainNode: fromNode,
        fromChainAccount: fromAccount,
        toChainNode: "Kusama",
        toChainAccount: ksmAccount,
        toChainId: 0,
        transferAmount: amount,
        extrinsic: transferTx
    }
    return transfer
}

export async function buildTransferKsmToChain(relay: Relay, toChainId: number, amount: FixedPointNumber, chopsticks: boolean){
    if(toChainId == 0){
        throw new Error("Trying to transfer kusama to non kusama chain")
    }

    let toNode: TNode = getParaspellChainName(relay, toChainId) as TNode
    let toApi = await getApiForNode(toNode, false)
    let toAccount = toNode == "Moonriver" ? await getSigner(chopsticks, true) : await getSigner(chopsticks, false);
    let fromAccount = await getSigner(chopsticks, false)

    let transferTx = paraspell.Builder(toApi).to(toNode).amount(amount.toChainData()).address(toAccount.address).build()
    let transfer: PreExecutionTransfer = {
        fromChainId: 0,
        fromChainNode: "Kusama",
        fromChainAccount: fromAccount,
        toChainNode: toNode,
        toChainAccount: toAccount,
        toChainId: toChainId,
        transferAmount: amount,
        extrinsic: transferTx
    }
    return transfer
}