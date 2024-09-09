import fs from 'fs'
import * as paraspell from '@paraspell/sdk'
import { TNode } from '@paraspell/sdk'
import { getNode, getSigner, toFullAssetAmount } from '../utils/utils.ts'
import { InstructionType, SwapInstruction, TransferInstruction, TransferToHomeThenDestInstruction, SwapExtrinsicContainer, ExtrinsicObject, ChainNonces, TransferExtrinsicContainer, IndexObject, PreExecutionTransfer, Relay, PathType, PNode } from './../types/types.ts'
import { AssetNode } from '../core/AssetNode.ts'
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







export async function buildTransferExtrinsicReworked(
    relay: Relay, 
    instruction: TransferInstruction, 
    chopsticks: boolean
){
    let transferExtrinsics: TransferExtrinsicContainer[] = []
    switch(instruction.type){
        case InstructionType.TransferToHomeChain:
            transferExtrinsics.push(await buildTransferExtrinsicFromInstruction(relay, instruction, chopsticks))
            break;
        case InstructionType.TransferAwayFromHomeChain:
            transferExtrinsics.push(await buildTransferExtrinsicFromInstruction(relay, instruction, chopsticks))
            break;
        case InstructionType.TransferToHomeThenDestination:
            console.log("TRANSFERS")
            let transfers = await buildDoubleTransferExtrinsic(relay, instruction, chopsticks)
            transfers.forEach((transfer) => {
                // console.log(JSON.stringify(transfer.extrinsic, null, 2))
                transferExtrinsics.push(transfer)
            })
            break;
    }
    return transferExtrinsics
}

/**
 * Build transfer extrinsic from instruction
 * - If instruction requires 2 transfers, will build 1 extrinsic and return an instruction to build the second
 * 
 * @param relay 
 * @param instruction 
 * @param chopsticks 
 * @returns [extrinsic, remainingInstructions] - If there are no remaining instructions, then will return an empty array
 */
export async function buildTransferExtrinsicDynamic(
    relay: Relay, 
    instruction: TransferInstruction, 
    chopsticks: boolean
): Promise<[TransferExtrinsicContainer, TransferInstruction[]]> {
    let transferExtrinsic: TransferExtrinsicContainer;
    let remainingInstructions: TransferInstruction[] = [];
    switch(instruction.type){
        case InstructionType.TransferToHomeChain:
            transferExtrinsic = await buildTransferExtrinsicFromInstruction(relay, instruction, chopsticks);
            break;
        case InstructionType.TransferAwayFromHomeChain:
            transferExtrinsic = await buildTransferExtrinsicFromInstruction(relay, instruction, chopsticks);
            break;

        // Build 1 extrinsic and an instruction for a second extrinsic
        case InstructionType.TransferToHomeThenDestination:
            console.log("TRANSFERS")
            let [transferOne, transferTwo] = splitDoubleTransferInstruction(instruction)
            transferExtrinsic = await buildTransferExtrinsicFromInstruction(relay, transferOne, chopsticks)
            remainingInstructions.push(transferTwo)
            break;
    }
    // console.log("**************************************")
    return [transferExtrinsic, remainingInstructions]
}


export async function buildTransferExtrinsicFromInstruction(
    relay: Relay, 
    instruction: TransferInstruction, 
    chopsticks: boolean
): Promise<TransferExtrinsicContainer> {
   

    
    const startAsset: AssetNode = instruction.startAsset
    const startNode: PNode = startAsset.chain

    const destinationAsset: AssetNode = instruction.destinationAsset
    const destinationNode: PNode = destinationAsset.chain
    const currencyInput = JSON.stringify(startAsset.getLocalId()).replace(/\\|"/g, "")
    const assetSymbol = startAsset.getAssetSymbol()

    if(!currencyInput){
        throw new Error("Transfer Tx: currencyInput undefined")
    }

    let assetDecimals = startAsset.getDecimals()
    let transferAmount: bn = toFullAssetAmount(startAsset.pathValue, assetDecimals)
    let transferFeeAmount: bn = new bn(instruction.startTransferFee)
    let transferReserveAmount: bn = new bn(instruction.startTransferReserve)
    let depositFeeAmount: bn = new bn(instruction.destinationDepositFee)
    let depositReserveAmount: bn = new bn(instruction.destinationDepositReserve)
    // If transfer native token and there are no reserves, deduct the estimated fee from the input


    let startApi = await getApiForNode(startNode, chopsticks)
    let destinationApi = await getApiForNode(destinationNode, chopsticks)

    console.log("**************************************")
    console.log(`${startNode} -> ${destinationNode} (${assetSymbol}) | Currency: ${currencyInput}  | Amount: ${transferAmount.toString()})`)
    console.log("**************************************")
    console.log(`Transfer Amount: ${transferAmount.toString()}`)
    console.log(`Reserve amount: ${transferReserveAmount.toString()}`)
    console.log(`Fee amount: ${transferFeeAmount.toString()}`)
    if(!transferReserveAmount.isZero() && transferFeeAmount.isZero()){
        throw new Error("Reserve amount but no fee")
    }
    //
    // Transfer currency asset A -> B
    // Remove transfer fee from input on A | Remove reserve fee from input on A
    // Is deposit fee from native token?
    // 

    if(transferReserveAmount.isZero() && transferFeeAmount.isZero()){
    } else if(transferReserveAmount.isZero() && !transferFeeAmount.isZero()){
        // REVIEW Subtracting estimated fee amount from transfer amount. Why? Because transfer fee is deducted from account seperately, not from the transfer amount. So we deduct it from our transfer amount to cover it on the sending chain.
        // Can consider fee paid for in our execution once we deduct it from transfer amount
        transferAmount = transferAmount.minus(transferFeeAmount)
    } else {
        // REVIEW Subtracting reserve amount from transfer amount. Transfer fee is paid seperately, and we need to reserve an amount of the transferred token in order to cover the fee at a later point.
        transferAmount = transferAmount.minus(transferReserveAmount)
    }

    // If deposit reserves > 0, deduct that from transfer amount as well to cover fees
    // Else deposit fees are taken out of deposited amount
    if(depositFeeAmount.isZero() && depositReserveAmount.isGreaterThan(new bn(0))){
        throw new Error(`Deposit reserve amount > 0 but deposit fee amount == 0`)
    } else if(depositReserveAmount.isGreaterThan(new bn(0))){
        // REVIEW Does it matter if we deduct from start node transfer amount vs destination node deposit amount? Assuming no for now
        transferAmount = transferAmount.minus(depositReserveAmount)
    }

    console.log(`Adjusted transfer amount: ${transferAmount.toString()}`)

    let destinationSigner = await getSigner(chopsticks, destinationNode)

    let xcmTx: paraspell.Extrinsic;
    if((startNode == "Kusama" || startNode == "Polkadot")) {
        xcmTx = paraspell.Builder(startApi).to(destinationNode as TNode).amount(transferAmount.toString()).address(destinationSigner.address).build()
    } else if((destinationNode == "Kusama" || destinationNode == "Polkadot")) {
        // console.log("Transfer to relay chain")
        xcmTx = paraspell.Builder(startApi).from(startNode).amount(transferAmount.toString()).address(destinationSigner.address).build()
    } else {
        // console.log("Transfer between parachains")
        xcmTx = paraspell.Builder(startApi).from(startNode).to(destinationNode).currency(currencyInput).amount(transferAmount.toString()).address(destinationSigner.address).build()
    }

    let txContainer: TransferExtrinsicContainer = {
        relay: relay,
        type: "Transfer",
        startChain: startNode,
        destinationChain: destinationNode,
        // assetSymbol: assetSymbol,
        startAsset: startAsset,
        destinationAsset: destinationAsset,
        extrinsic: xcmTx,
        startApi: startApi,
        destinationApi: destinationApi,
        pathSwapType: 0,
        pathAmount: transferAmount.toString(),
        transferReserveAmount: transferReserveAmount.toString(),
        depositReserveAmount: depositReserveAmount.toString(),
    }
    console.log(`Transfer tx container pathAmount set to final input transfer amount: ${txContainer.pathAmount}`)
    console.log("Created transfer extrinsic")
    console.log("**************************************")
    return txContainer
}
async function buildDoubleTransferExtrinsic(
    relay: Relay, 
    instruction: TransferToHomeThenDestInstruction, 
    chopsticks: boolean
): Promise<[TransferExtrinsicContainer, TransferExtrinsicContainer]> {
    let splitInstructions = splitDoubleTransferInstruction(instruction)
    let firstExtrinsic = await buildTransferExtrinsicFromInstruction(relay, splitInstructions[0], chopsticks)
    let secondExtrinsic = await buildTransferExtrinsicFromInstruction(relay, splitInstructions[1], chopsticks)
    return [firstExtrinsic, secondExtrinsic]
}

// This split Instruction is only used to create two separate transfer extrinsics ^^^ and is not used for the actual instruction
function splitDoubleTransferInstruction(instruction: TransferToHomeThenDestInstruction): [TransferInstruction, TransferInstruction] {
    let middleNodeChainId = instruction.middleAsset.getChainId()
    
    let startInstruction: TransferInstruction = {
        type: InstructionType.TransferToHomeChain,

        startAsset: instruction.startAsset,
        destinationAsset: instruction.middleAsset,

        startTransferFee: instruction.startTransferFee,
        startTransferReserve: instruction.startTransferReserve,

        destinationDepositFee: instruction.middleDepositFee,
        destinationDepositReserve: instruction.middleDepositReserve,

        assetNodes: instruction.assetNodes.slice(0,2)
    }
    let destinationInstruction: TransferInstruction = {
        type: InstructionType.TransferAwayFromHomeChain,
        
        startAsset: instruction.middleAsset,
        destinationAsset: instruction.destinationAsset,

        startTransferFee: instruction.middleTransferFee,
        startTransferReserve: instruction.middleTransferReserve,

        destinationDepositFee: instruction.destinationDepositFee,
        destinationDepositReserve: instruction.destinationDepositReserve,
        
        assetNodes: instruction.assetNodes.slice(1)
    }
    console.log("**************************************")
    console.log(`Splitting transfer instruction`)
    console.log(`${instruction.startAsset.chain} -> ${instruction.middleAsset.chain} | ${startInstruction.startAsset.getAssetSymbol()}`)
    console.log(`${instruction.middleAsset.chain} -> ${instruction.destinationAsset.chain} | ${destinationInstruction.startAsset.getAssetSymbol()}`)
    return [startInstruction, destinationInstruction]
}

function getParaIdFromAssetNode(node: PNode, assetNode: AssetNode){
    if(node == "Kusama" || node == "Polkadot"){
        return 0
    } else {
        return assetNode.getChainId()
    }
}


export async function buildSwapExtrinsicDynamic(
    relay: Relay, 
    instructions: SwapInstruction[], 
    chopsticks: boolean
): Promise<[SwapExtrinsicContainer, SwapInstruction[]]> {
    let chainId = instructions[0].chain
    let swapType: PathType = instructions[0].pathType
    let swapData = instructions[0].pathData
    let startAsset = instructions[0].assetNodes[0].getAssetSymbol()
    let destAsset = instructions[instructions.length - 1].assetNodes[1].getAssetSymbol()    
    let amountIn = instructions[0].assetNodes[0].pathValue;
    instructions[0].assetInAmount = amountIn
    let expectedAmountOut = instructions[instructions.length - 1].assetNodes[1].pathValue;

    let swapContainer, remainingInstructions
    if(relay == 'kusama'){
        [swapContainer, remainingInstructions] = await buildKusamaSwapExtrinsics(instructions, chainId, swapType, startAsset, destAsset, amountIn, expectedAmountOut, chopsticks)
    } else if (relay == 'polkadot'){
        [swapContainer, remainingInstructions] = await buildPolkadotSwapExtrinsic(instructions, chainId, swapType, swapData, startAsset, destAsset, amountIn, expectedAmountOut, chopsticks)
    } else {
        throw new Error("Invalid relay")
    }
    return [swapContainer, remainingInstructions]
}

async function buildKusamaSwapExtrinsics(
    instructions: SwapInstruction[], 
    chainId: number, 
    swapType: PathType, 
    startAssetSymbol: string, 
    destinationAssetSymbol: string, 
    amountIn: string, 
    expectedAmountOut: string, 
    chopsticks: boolean
){
    if(chainId == 2000){
        let [swapTxContainer, remainingInstructions] = await getKarSwapExtrinsicDynamic(swapType, startAssetSymbol, amountIn, instructions, chopsticks)
        let swapAssetNodes = swapTxContainer.assetNodes
        let startAssetDynamic = swapAssetNodes[0].getAssetSymbol()
        let destAssetDynamic = swapAssetNodes[swapAssetNodes.length - 1].getAssetSymbol()
        const descriptorString = `KAR ${startAssetDynamic} -> ${destAssetDynamic}`
        console.log("**************************************")
        console.log(descriptorString)
        console.log("**************************************")
        swapTxContainer.txString = descriptorString
        return [swapTxContainer, remainingInstructions]
    } else if(chainId == 2001){
        // console.log(`BNC ${startAsset} -> ${destAsset}`)
        const descriptorString = `BNC ${startAssetSymbol} -> ${destinationAssetSymbol}`
        console.log("**************************************")
        console.log(descriptorString)
        console.log("**************************************")
        let [swapTxContainer, remainingInstructions] = await getBncSwapExtrinsicDynamic(swapType, instructions, chopsticks)
        swapTxContainer.txString = descriptorString
        return [swapTxContainer, remainingInstructions]
    } else if(chainId == 2023){
        const descriptorString = `MOVR ${startAssetSymbol} -> ${destinationAssetSymbol}`
        console.log("**************************************")
        console.log(descriptorString)
        console.log("**************************************")
        let remainingInstructions: SwapInstruction[] = []
        let testnet = false
        let movrBatchSwapParams = await getMovrSwapTx(instructions, testnet)
        let swapTxContainer = await formatMovrTx(movrBatchSwapParams, instructions, chopsticks)
        swapTxContainer.txString = descriptorString
        return [swapTxContainer, remainingInstructions]
    } else if(chainId == 2090){
        const descriptorString = `BSX ${startAssetSymbol} -> ${destinationAssetSymbol}`
        console.log("**************************************")
        console.log(descriptorString)
        console.log("**************************************")
        let [swapTxContainer, remainingInstructions] = await getBsxSwapExtrinsicDynamic(swapType, startAssetSymbol, amountIn, instructions, chopsticks)
        swapTxContainer.txString = descriptorString
        return [swapTxContainer, remainingInstructions]
    } else if(chainId == 2110){
        const descriptorString = `MGX ${startAssetSymbol} -> ${destinationAssetSymbol}`
        console.log("**************************************")
        console.log(descriptorString)
        console.log("**************************************")
        let swapTxContainer = await getMgxSwapExtrinsic(swapType, startAssetSymbol, destinationAssetSymbol, amountIn, expectedAmountOut, instructions, chopsticks)
        swapTxContainer.txString = descriptorString
        let remainingInstructions: SwapInstruction[] = []
        return [swapTxContainer, remainingInstructions]
    } else if(chainId == 2085){
        const descriptorString = `HKO ${startAssetSymbol} -> ${destinationAssetSymbol}`
        console.log("**************************************")
        console.log(descriptorString)
        console.log("**************************************")
        let swapTxContainer = await getHkoSwapExtrinsic(swapType, startAssetSymbol, destinationAssetSymbol, amountIn, expectedAmountOut, instructions, chopsticks)
        swapTxContainer.txString = descriptorString
        let remainingInstructions: SwapInstruction[] = []
        return [swapTxContainer, remainingInstructions]
    } else {
        throw new Error("Chain not supported")
    }
}

async function buildPolkadotSwapExtrinsic(instructions, chainId, swapType: PathType, swapData, startAsset, destAsset, amountIn,expectedAmountOut, chopsticks){
    console.log("**************************************")
    console.log("Building Polkadot Swap Extrinsic")
    if(chainId == 2000){
        let [swapTxContainer, remainingInstructions] = await getAcaSwapExtrinsicDynamic(swapType, startAsset, amountIn, instructions, chopsticks)
        let swapAssetNodes = swapTxContainer.assetNodes
        let startAssetDynamic = swapAssetNodes[0].getAssetSymbol()
        let destAssetDynamic = swapAssetNodes[swapAssetNodes.length - 1].getAssetSymbol()
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
            let [swapTxContainer, remainingInstructions] = await getBncPolkadotSwapExtrinsicDynamic(swapType, instructions, chopsticks)
            swapTxContainer.txString = descriptorString
            return [swapTxContainer, remainingInstructions]

    }else if (chainId == 2004){
        //glmr
        const descriptorString = `Moonbeam ${startAsset} -> ${destAsset}`
        console.log(descriptorString)
        console.log("**************************************")
        let remainingInstructions: SwapInstruction[] = []

        let testnet = false
        let swapTxContainer = await getGlmrSwapTx(instructions, testnet)
        swapTxContainer.txString = descriptorString
        return [swapTxContainer, remainingInstructions]
    } else if (chainId == 2012){
        //para
        const descriptorString = `Parallel ${startAsset} -> ${destAsset}`
        console.log(descriptorString)
        console.log("**************************************")
        let swapTxContainer = await getParaSwapExtrinsic(swapType, startAsset, destAsset, amountIn, expectedAmountOut, instructions, chopsticks)
        swapTxContainer.txString = descriptorString
        let remainingInstructions: SwapInstruction[] = []
        return [swapTxContainer, remainingInstructions]
    } else if(chainId == 2034){
        //hdx
        const descriptorString = `HydraDX ${startAsset} -> ${destAsset}`
        console.log(descriptorString)
        console.log("**************************************")
        let [swapTxContainer, remainingInstructions] = await getHdxSwapExtrinsicDynamic(swapType, startAsset, destAsset, amountIn, expectedAmountOut, instructions, chopsticks)
        swapTxContainer.txString = descriptorString
        return [swapTxContainer, remainingInstructions]
    }  else {
        throw new Error("Chain not supported")
    }
}

// export async function createTransferExtrinsicObject(transferContainer: TransferExtrinsicContainer){
//     let extrinsicObj: ExtrinsicObject = {
//         type: "Transfer",
//         transferExtrinsicContainer: transferContainer
//     }
//     return extrinsicObj
// }
// export async function createSwapExtrinsicObject(swapContainer: SwapExtrinsicContainer){
//     let extrinsicObj: ExtrinsicObject = {
//         type: "Swap",
//         swapExtrinsicContainer: swapContainer
//     }
//     return extrinsicObj
// }

// export async function buildTransferToKsm(relay: Relay, fromChainId: number, amount: FixedPointNumber, chopsticks: boolean){
//     if(fromChainId == 0){
//         throw new Error("Trying to transfer kusama away from home chain to kusama")
//     }
//     let fromNode = getNode(relay, fromChainId) as TNode
//     let fromApi = await getApiForNode(fromNode, false)
//     let fromAccount = fromNode == "Moonriver" ? await getSigner(chopsticks, true) : await getSigner(chopsticks, false);
//     let ksmAccount = await getSigner(chopsticks, false)

//     let transferTx = paraspell.Builder(fromApi).from(fromNode).amount(amount.toChainData()).address(ksmAccount.address).build()
//     let transfer: PreExecutionTransfer = {
//         fromChainId: fromChainId,
//         fromChainNode: fromNode,
//         fromChainAccount: fromAccount,
//         toChainNode: "Kusama",
//         toChainAccount: ksmAccount,
//         toChainId: 0,
//         transferAmount: amount,
//         extrinsic: transferTx
//     }
//     return transfer
// }

// export async function buildTransferKsmToChain(relay: Relay, toChainId: number, amount: FixedPointNumber, chopsticks: boolean){
//     if(toChainId == 0){
//         throw new Error("Trying to transfer kusama to non kusama chain")
//     }

//     let toNode: TNode = getNode(relay, toChainId) as TNode
//     let toApi = await getApiForNode(toNode, false)
//     let toAccount = toNode == "Moonriver" ? await getSigner(chopsticks, true) : await getSigner(chopsticks, false);
//     let fromAccount = await getSigner(chopsticks, false)

//     let transferTx = paraspell.Builder(toApi).to(toNode).amount(amount.toChainData()).address(toAccount.address).build()
//     let transfer: PreExecutionTransfer = {
//         fromChainId: 0,
//         fromChainNode: "Kusama",
//         fromChainAccount: fromAccount,
//         toChainNode: toNode,
//         toChainAccount: toAccount,
//         toChainId: toChainId,
//         transferAmount: amount,
//         extrinsic: transferTx
//     }
//     return transfer
// }