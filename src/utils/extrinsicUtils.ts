import fs from 'fs'
import * as paraspell from '@paraspell/sdk'
import { TNode } from '@paraspell/sdk'
import { getParaspellChainName, getSigner, increaseIndex } from '../utils/utils.ts'
import { InstructionType, SwapInstruction, TransferInstruction, TransferToHomeThenDestInstruction, TransferrableAssetObject, SwapExtrinsicContainer, ExtrinsicObject, ChainNonces, TransferExtrinsicContainer, IndexObject, PreExecutionTransfer, Relay, PathType } from './../types/types.ts'
import { AssetNode } from '../core/AssetNode.ts'
import { getTransferrableAssetObject } from './../execution/instructionUtils.ts';
import { fileURLToPath } from 'url';
import {  getKarSwapExtrinsicDynamic } from '../swaps/karSwap.ts';
import { formatMovrTx, getMovrSwapTx } from '../swaps/movr/movrSwap.ts';
import { getBncSwapExtrinsicDynamic } from '../swaps/bncSwap.ts';
import { getBsxSwapExtrinsicDynamic } from '../swaps/bsxSwap.ts';
import { getMgxSwapExtrinsic } from '../swaps/mgxSwap.ts';
import { getHkoSwapExtrinsic } from '../swaps/hkoSwap.ts';
import { FixedPointNumber } from "@acala-network/sdk-core";
import { getApiForNode } from '../utils/apiUtils.ts';
import { getAcaSwapExtrinsicDynamic } from '../swaps/acaSwap.ts';
import { getBncPolkadotSwapExtrinsicDynamic } from '../swaps/bncPolkadot.ts';
import { getParaSwapExtrinsic } from '../swaps/paraSwap.ts';
import { getHdxSwapExtrinsicDynamic } from '../swaps/hdxSwap.ts';
import { getGlmrSwapTx } from '../swaps/glmr/glmrSwap.ts';
import bn from 'bignumber.js'







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


export async function buildTransferExtrinsicFromInstruction(relay: Relay, instruction: TransferInstruction, extrinsicIndex: IndexObject, chopsticks: boolean): Promise<TransferExtrinsicContainer> {
   

    
    const startTransferrable = getTransferrableAssetObject(relay, instruction.startAssetNode)
    const destinationTransferrable = getTransferrableAssetObject(relay, instruction.destinationAssetNode)
    const currencyInput = JSON.stringify(startTransferrable.assetRegistryObject.tokenData.localId).replace(/\\|"/g, "")
    const assetSymbol = startTransferrable.assetRegistryObject.tokenData.symbol

    if(!currencyInput){
        throw new Error("Transfer Tx: currencyInput undefined")
    }
    
    // let assetDecimals = getAssetDecimalsForNode(instruction.startNode, startTransferrable)

    let assetDecimals = startTransferrable.assetRegistryObject.tokenData.decimals

    let startParaId = getParaIdFromAssetNode(instruction.startNode, instruction.startAssetNode)
    let destinationParaId = getParaIdFromAssetNode(instruction.destinationNode, instruction.destinationAssetNode)
    let transferAmountString = new FixedPointNumber(instruction.assetNodes[0].pathValue, Number.parseInt(assetDecimals.toString())).toChainData()
    let transferAmount = new bn(transferAmountString)
    let transferFeeAmount = new bn(instruction.startTransferFee)
    let transferReserveAmount = new bn(instruction.startTransferReserve)
    let depositFeeAmount = new bn(instruction.destinationDepositFee)
    let depositReserveAmount = new bn(instruction.destinationDepositReserve)
    // If transfer native token and there are no reserves, deduct the estimated fee from the input


    let startApi = await getApiForNode(instruction.startNode, chopsticks)
    let destinationApi = await getApiForNode(instruction.destinationNode, chopsticks)

    console.log("**************************************")
    console.log(`${instruction.startNode} -> ${instruction.destinationNode} (${startTransferrable.assetRegistryObject.tokenData.symbol}) | Currency: ${currencyInput}  | Amount: ${transferAmountString.toString()})`)
    console.log("**************************************")
    console.log(`Transfer Amount: ${transferAmount.toString()}`)
    console.log(`Reserve amount: ${transferReserveAmount.toString()}`)
    console.log(`Fee amount: ${transferFeeAmount.toString()}`)
    if(!transferReserveAmount.isZero() && transferFeeAmount.isZero()){
        console.log(`*** Reserve amount but not fee should be an ERROR`)
        throw new Error("Reserve amount but no fee")
    }
    //
    // Transfer currency asset A -> B
    // Remove transfer fee from input on A | Remove reserve fee from input on A
    // Is deposit fee from native token?
    // 

    if(transferReserveAmount.isZero() && transferFeeAmount.isZero()){
        console.log(`*** No fee or reserve amount | Fee book not updated`)
    } else if(transferReserveAmount.isZero() && !transferFeeAmount.isZero()){
        // REVIEW Subtracting estimated fee amount from transfer amount. Why? Because transfer fee is deducted from account seperately, not from the transfer amount. So we deduct it from our transfer amount to cover it on the sending chain.
        // Can consider fee paid for in our execution once we deduct it from transfer amount
        console.log(`*** Should be transferring native token so dont need to convert fee to reserve`)
        transferAmount = transferAmount.minus(transferFeeAmount)
    } else {
        // REVIEW Subtracting reserve amount from transfer amount. Transfer fee is paid seperately, and we need to reserve an amount of the transferred token in order to cover the fee at a later point.
        console.log(`*** Fee amount and reserve amount detected. | Fee amount converted to reserve. Reserve amount deducted from transfer amount`)
        transferAmount = transferAmount.minus(transferReserveAmount)
    }

    // If deposit reserves > 0, deduct that from transfer amount as well to cover fees
    // Else deposit fees are taken out of deposited amount
    if(depositFeeAmount.isZero() && depositReserveAmount.isGreaterThan(new bn(0))){
        throw new Error(`Deposit reserve amount > 0 but deposit fee amount == 0`)
    } else if(depositReserveAmount.isGreaterThan(new bn(0))){
        // REVIEW Does it matter if we deduct from start node transfer amount vs destination node deposit amount? Assuming no for now
        console.log(`*** Removing deposit reserve amount from transfer amount`)
        transferAmount = transferAmount.minus(depositReserveAmount)
    }

    console.log(`Adjusted transfer amount: ${transferAmount.toString()}`)

    let signer;

    if(instruction.destinationNode == "Moonriver" || instruction.destinationNode == "Moonbeam"){
        signer = await getSigner(chopsticks, true);
    } else {
        signer = await getSigner(chopsticks, false);
    }
    let destinationAddress = signer.address

    let xcmTx: paraspell.Extrinsic;
    if((instruction.startNode == "Kusama" || instruction.startNode == "Polkadot")  && (instruction.destinationNode != "Kusama" && instruction.destinationNode != "Polkadot")) {
        xcmTx = paraspell.Builder(startApi).to(instruction.destinationNode).amount(transferAmount.toString()).address(destinationAddress).build()
    } else if((instruction.destinationNode == "Kusama" || instruction.destinationNode == "Polkadot") && (instruction.startNode != "Kusama" && instruction.startNode != "Polkadot")) {
        // console.log("Transfer to relay chain")
        xcmTx = paraspell.Builder(startApi).from(instruction.startNode).amount(transferAmount.toString()).address(destinationAddress).build()
    } else if((instruction.startNode != "Kusama" && instruction.startNode != "Polkadot") && (instruction.destinationNode != "Kusama" && instruction.destinationNode != "Polkadot")) {
        // console.log("Transfer between parachains")
        xcmTx = paraspell.Builder(startApi).from(instruction.startNode).to(instruction.destinationNode).currency(currencyInput).amount(transferAmount.toString()).address(destinationAddress).build()
    } else {
        throw new Error("Invalid transfer instruction")
    }

    // console.log(`xcmTx ${JSON.stringify(xcmTx, null, 2)}`)

    let instructionIndex = instruction.instructionIndex

    let txContainer: TransferExtrinsicContainer = {
        relay: relay,
        firstNode: instruction.startNode,
        secondNode: instruction.destinationNode,
        assetSymbol: assetSymbol,
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
        pathAmount: transferAmount.toString(),
        transferReserveAmount: transferReserveAmount.toString(),
        depositReserveAmount: depositReserveAmount.toString(),
    }
    console.log(`Transfer tx container pathAmount set to final input transfer amount: ${txContainer.pathAmount}`)
    increaseIndex(extrinsicIndex)
    console.log("Created transfer extrinsic")
    console.log("**************************************")
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

        startTransferFee: instruction.startTransferFee,
        startTransferReserve: instruction.startTransferReserve,

        destinationDepositFee: instruction.middleDepositFee,
        destinationDepositReserve: instruction.middleDepositReserve,

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

        startTransferFee: instruction.middleTransferFee,
        startTransferReserve: instruction.middleTransferReserve,

        destinationDepositFee: instruction.destinationDepositFee,
        destinationDepositReserve: instruction.destinationDepositReserve,
        
        assetNodes: instruction.assetNodes.slice(1)
    }
    console.log("**************************************")
    console.log(`Splitting transfer instruction`)
    console.log(`${startInstruction.startNode} -> ${startInstruction.destinationNode} | ${startInstruction.startAssetNode.getAssetRegistrySymbol()}`)
    console.log(`${destinationInstruction.startNode} -> ${destinationInstruction.destinationNode} | ${destinationInstruction.startAssetNode.getAssetRegistrySymbol()}`)
    return [startInstruction, destinationInstruction]
}

function getParaIdFromAssetNode(node: TNode | "Kusama" | "Polkadot", assetNode: AssetNode){
    if(node == "Kusama" || node == "Polkadot"){
        return 0
    } else {
        return assetNode.getChainId()
    }
}


export async function buildSwapExtrinsicDynamic(
    relay: Relay, 
    instructions: SwapInstruction[],
    extrinsicIndex: IndexObject, 
    chopsticks: boolean
): Promise<[SwapExtrinsicContainer, SwapInstruction[]]> {
    let chainId = instructions[0].chain
    let swapType: PathType = instructions[0].pathType
    let swapData = instructions[0].pathData
    let startAsset = instructions[0].assetNodes[0].getAssetRegistrySymbol()
    let destAsset = instructions[instructions.length - 1].assetNodes[1].getAssetRegistrySymbol()    
    let amountIn = instructions[0].assetNodes[0].pathValue;
    instructions[0].assetInAmount = amountIn
    instructions[0].assetInAmountFixed = new FixedPointNumber(amountIn)
    let expectedAmountOut = instructions[instructions.length - 1].assetNodes[1].pathValue;

    
    let instructionIndex: number[] = []
    instructionIndex: instructions.forEach((instruction) => {
        instructionIndex.push(instruction.instructionIndex)
    })
    let swapContainer, remainingInstructions
    if(relay == 'kusama'){
        [swapContainer, remainingInstructions] = await buildKusamaSwapExtrinsics(instructions, chainId, swapType, startAsset, destAsset, amountIn, expectedAmountOut, chopsticks, extrinsicIndex, instructionIndex)
    } else if (relay == 'polkadot'){
        [swapContainer, remainingInstructions] = await buildPolkadotSwapExtrinsic(instructions, chainId, swapType, swapData, startAsset, destAsset, amountIn, expectedAmountOut, chopsticks, extrinsicIndex, instructionIndex)
    } else {
        throw new Error("Invalid relay")
    }
    return [swapContainer, remainingInstructions]
}

async function buildKusamaSwapExtrinsics(instructions, chainId, swapType: PathType, startAsset, destAsset, amountIn,expectedAmountOut, chopsticks, extrinsicIndex, instructionIndex){
    if(chainId == 2000){
        let [swapTxContainer, remainingInstructions] = await getKarSwapExtrinsicDynamic(swapType, startAsset, destAsset, amountIn, expectedAmountOut, instructions, chopsticks, extrinsicIndex, instructionIndex)
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
        let [swapTxContainer, remainingInstructions] = await getBncSwapExtrinsicDynamic(swapType, instructions, chopsticks, extrinsicIndex, instructionIndex)
        swapTxContainer.txString = descriptorString
        return [swapTxContainer, remainingInstructions]
    } else if(chainId == 2023){
        const descriptorString = `MOVR ${startAsset} -> ${destAsset}`
        console.log("**************************************")
        console.log(descriptorString)
        console.log("**************************************")
        let remainingInstructions: SwapInstruction[] = []
        let testnet = false
        let movrBatchSwapParams = await getMovrSwapTx(instructions, testnet)
        let swapTxContainer = await formatMovrTx(movrBatchSwapParams, instructions, extrinsicIndex, instructionIndex, chopsticks)
        swapTxContainer.txString = descriptorString
        return [swapTxContainer, remainingInstructions]
    } else if(chainId == 2090){
        const descriptorString = `BSX ${startAsset} -> ${destAsset}`
        console.log("**************************************")
        console.log(descriptorString)
        console.log("**************************************")
        let [swapTxContainer, remainingInstructions] = await getBsxSwapExtrinsicDynamic(swapType, startAsset, destAsset, amountIn, expectedAmountOut, instructions, chopsticks, extrinsicIndex, instructionIndex)
        swapTxContainer.txString = descriptorString
        return [swapTxContainer, remainingInstructions]
    } else if(chainId == 2110){
        const descriptorString = `MGX ${startAsset} -> ${destAsset}`
        console.log("**************************************")
        console.log(descriptorString)
        console.log("**************************************")
        let swapTxContainer = await getMgxSwapExtrinsic(swapType, startAsset, destAsset, amountIn, expectedAmountOut, instructions, chopsticks, extrinsicIndex,instructionIndex)
        swapTxContainer.txString = descriptorString
        let remainingInstructions: SwapInstruction[] = []
        return [swapTxContainer, remainingInstructions]
    } else if(chainId == 2085){
        const descriptorString = `HKO ${startAsset} -> ${destAsset}`
        console.log("**************************************")
        console.log(descriptorString)
        console.log("**************************************")
        let swapTxContainer = await getHkoSwapExtrinsic(swapType, startAsset, destAsset, amountIn, expectedAmountOut, instructions, chopsticks, extrinsicIndex, instructionIndex)
        swapTxContainer.txString = descriptorString
        let remainingInstructions: SwapInstruction[] = []
        return [swapTxContainer, remainingInstructions]
    } else {
        throw new Error("Chain not supported")
    }
}

async function buildPolkadotSwapExtrinsic(instructions, chainId, swapType: PathType, swapData, startAsset, destAsset, amountIn,expectedAmountOut, chopsticks, extrinsicIndex, instructionIndex){
    console.log("**************************************")
    console.log("Building Polkadot Swap Extrinsic")
    if(chainId == 2000){
        let [swapTxContainer, remainingInstructions] = await getAcaSwapExtrinsicDynamic(swapType, startAsset, destAsset, amountIn, expectedAmountOut, instructions, chopsticks, extrinsicIndex, instructionIndex)
        let swapAssetNodes = swapTxContainer.assetNodes
        let startAssetDynamic = swapAssetNodes[0].getAssetRegistrySymbol()
        let destAssetDynamic = swapAssetNodes[swapAssetNodes.length - 1].getAssetRegistrySymbol()
        const descriptorString = `Acala ${startAssetDynamic} -> ${destAssetDynamic}`

        console.log(descriptorString)
        console.log("**************************************")
        swapTxContainer.txString = descriptorString
        return [swapTxContainer, remainingInstructions]

    } else if (chainId == 2030) {
        //bnc
            // console.log(`BNC ${startAsset} -> ${destAsset}`)
            const descriptorString = `BifrostPolkadot ${startAsset} -> ${destAsset}`
            console.log(descriptorString)
            console.log("**************************************")
            let [swapTxContainer, remainingInstructions] = await getBncPolkadotSwapExtrinsicDynamic(swapType, instructions, chopsticks, extrinsicIndex, instructionIndex)
            swapTxContainer.txString = descriptorString
            return [swapTxContainer, remainingInstructions]

    }else if (chainId == 2004){
        //glmr
        const descriptorString = `Moonbeam ${startAsset} -> ${destAsset}`
        console.log(descriptorString)
        console.log("**************************************")
        let remainingInstructions: SwapInstruction[] = []

        let testnet = false
        let swapTxContainer = await getGlmrSwapTx(instructions, testnet, extrinsicIndex, instructionIndex)
        swapTxContainer.txString = descriptorString
        return [swapTxContainer, remainingInstructions]
    } else if (chainId == 2012){
        //para
        const descriptorString = `Parallel ${startAsset} -> ${destAsset}`
        console.log(descriptorString)
        console.log("**************************************")
        let swapTxContainer = await getParaSwapExtrinsic(swapType, startAsset, destAsset, amountIn, expectedAmountOut, instructions, chopsticks, extrinsicIndex, instructionIndex)
        swapTxContainer.txString = descriptorString
        let remainingInstructions: SwapInstruction[] = []
        return [swapTxContainer, remainingInstructions]
    } else if(chainId == 2034){
        //hdx
        const descriptorString = `HydraDX ${startAsset} -> ${destAsset}`
        console.log(descriptorString)
        console.log("**************************************")
        let [swapTxContainer, remainingInstructions] = await getHdxSwapExtrinsicDynamic(swapType, swapData, startAsset, destAsset, amountIn, expectedAmountOut, instructions, chopsticks, extrinsicIndex, instructionIndex)
        swapTxContainer.txString = descriptorString
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