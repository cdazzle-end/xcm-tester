import fs from 'fs'
import * as paraspell from '@paraspell/sdk'
import { TNode } from '@paraspell/sdk'
import { getChainIdFromNode, getNode, getSigner, toFullAssetAmount } from '../utils/utils.ts'
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







export async function buildTransferExtrinsicReworked(relay: Relay, instruction: TransferInstruction, chopsticks: boolean){
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

export async function buildTransferExtrinsicDynamic(relay: Relay, instruction: TransferInstruction, chopsticks: boolean): Promise<[TransferExtrinsicContainer, TransferInstruction[]]> {
    let transferExtrinsic: TransferExtrinsicContainer;
    let remainingInstructions: TransferInstruction[] = [];
    switch(instruction.type){
        case InstructionType.TransferToHomeChain:
            transferExtrinsic = await buildTransferExtrinsicFromInstruction(relay, instruction, chopsticks);
            break;
        case InstructionType.TransferAwayFromHomeChain:
            transferExtrinsic = await buildTransferExtrinsicFromInstruction(relay, instruction, chopsticks);
            break;
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
   

    
    // const startTransferrable = getTransferrableAssetObject(relay, instruction.startAssetNode)
    // const destinationTransferrable = getTransferrableAssetObject(relay, instruction.destinationAssetNode)
    const startAsset: AssetNode = instruction.startAsset
    const destinationAsset: AssetNode = instruction.destinationAsset
    const inputAssetId = JSON.stringify(startAsset.getLocalId()).replace(/\\|"/g, "")
    const assetSymbol = startAsset.getAssetSymbol()
    const assetDecimals = startAsset.getDecimals()

    if(!inputAssetId){
        throw new Error("Transfer Tx: currencyInput undefined")
    }

    const transferFeeAmount: bn = new bn(instruction.startTransferFee)
    const transferReserveAmount: bn = new bn(instruction.startTransferReserve)
    const depositFeeAmount: bn = new bn(instruction.destinationDepositFee)
    const depositReserveAmount: bn = new bn(instruction.destinationDepositReserve)
    // If transfer native token and there are no reserves, deduct the estimated fee from the input


    const startApi = await getApiForNode(startAsset.chain, chopsticks)
    const destinationApi = await getApiForNode(destinationAsset.chain, chopsticks)

    let transferAmount: bn = toFullAssetAmount(startAsset.pathValue, assetDecimals)

    console.log("**************************************")
    console.log(`${startAsset.chain} -> ${destinationAsset.chain} (${assetSymbol}) | Currency: ${inputAssetId}  | Amount: ${transferAmount.toString()})`)
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

    if(startAsset.chain == "Moonriver" || destinationAsset.chain == "Moonbeam"){
        signer = await getSigner(chopsticks, true);
    } else {
        signer = await getSigner(chopsticks, false);
    }
    let destinationAddress = signer.address

    let xcmTx: paraspell.Extrinsic;
    if((startAsset.chain == "Kusama" || startAsset.chain == "Polkadot")  && (destinationAsset.chain != "Kusama" && destinationAsset.chain != "Polkadot")) {
        xcmTx = paraspell.Builder(startApi).to(destinationAsset.chain).amount(transferAmount.toString()).address(destinationAddress).build()
    } else if((destinationAsset.chain == "Kusama" || destinationAsset.chain == "Polkadot") && (startAsset.chain != "Kusama" && startAsset.chain != "Polkadot")) {
        // console.log("Transfer to relay chain")
        xcmTx = paraspell.Builder(startApi).from(startAsset.chain).amount(transferAmount.toString()).address(destinationAddress).build()
    } else if((startAsset.chain != "Kusama" && startAsset.chain != "Polkadot") && (destinationAsset.chain != "Kusama" && destinationAsset.chain != "Polkadot")) {
        // console.log("Transfer between parachains")
        xcmTx = paraspell.Builder(startApi).from(startAsset.chain).to(destinationAsset.chain).currency(inputAssetId).amount(transferAmount.toString()).address(destinationAddress).build()
    } else {
        throw new Error("Invalid transfer instruction")
    }


    let txContainer: TransferExtrinsicContainer = {
        relay: relay,
        type: "Transfer",
        startAsset: startAsset,
        destinationAsset: destinationAsset,
        startChain: startAsset.chain,
        destinationChain: destinationAsset.chain,
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
async function buildDoubleTransferExtrinsic(relay: Relay, instruction: TransferToHomeThenDestInstruction, chopsticks: boolean): Promise<[TransferExtrinsicContainer, TransferExtrinsicContainer]> {
    let splitInstructions = splitDoubleTransferInstruction(instruction)
    let firstExtrinsic = await buildTransferExtrinsicFromInstruction(relay, splitInstructions[0], chopsticks)
    let secondExtrinsic = await buildTransferExtrinsicFromInstruction(relay, splitInstructions[1], chopsticks)
    return [firstExtrinsic, secondExtrinsic]
}

// This split Instruction is only used to create two separate transfer extrinsics ^^^ and is not used for the actual instruction
function splitDoubleTransferInstruction(instruction: TransferToHomeThenDestInstruction): [TransferInstruction, TransferInstruction] {
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
    console.log(`${startInstruction.startAsset} -> ${startInstruction.destinationAsset} | ${startInstruction.startAsset.getAssetSymbol()}`)
    console.log(`${destinationInstruction.startAsset} -> ${destinationInstruction.destinationAsset} | ${destinationInstruction.startAsset.getAssetSymbol()}`)
    return [startInstruction, destinationInstruction]
}



export async function buildSwapExtrinsicDynamic(
    relay: Relay, 
    instructions: SwapInstruction[], 
    chopsticks: boolean
): Promise<[SwapExtrinsicContainer, SwapInstruction[]]> {
    let chainId = instructions[0].chain
    let swapType: PathType = instructions[0].pathType
    let startAsset = instructions[0].assetNodes[0].getAssetSymbol()
    let destAsset = instructions[instructions.length - 1].assetNodes[1].getAssetSymbol()    
    let amountIn = instructions[0].assetNodes[0].pathValue;
    instructions[0].assetInAmount = amountIn
    let expectedAmountOut = instructions[instructions.length - 1].assetNodes[1].pathValue;

    let swapContainer: SwapExtrinsicContainer, remainingInstructions: SwapInstruction[]
    if(relay == 'kusama'){
        [swapContainer, remainingInstructions] = await buildKusamaSwapExtrinsics(instructions, chainId, swapType, startAsset, destAsset, amountIn, expectedAmountOut, chopsticks)
    } else if (relay == 'polkadot'){
        [swapContainer, remainingInstructions] = await buildPolkadotSwapExtrinsic(instructions, chainId, swapType, startAsset, destAsset, amountIn, expectedAmountOut, chopsticks)
    } else {
        throw new Error("Invalid relay")
    }
    return [swapContainer, remainingInstructions]
}

async function buildKusamaSwapExtrinsics(
    instructions: SwapInstruction[], 
    chainId: number, 
    swapType: PathType, 
    startAssetSymbol: string, destAssetSymbol: string, 
    amountIn: string, 
    expectedAmountOut: string, 
    chopsticks: boolean
): Promise<[SwapExtrinsicContainer, SwapInstruction[]]> {
    if(chainId == 2000){
        let [swapTxContainer, remainingInstructions] = await getKarSwapExtrinsicDynamic(swapType, startAssetSymbol, amountIn, instructions, chopsticks)
        // let swapAssetNodes = swapTxContainer.assetNodes
        let startAssetDynamic = swapTxContainer.assetIn.getAssetSymbol()
        let destAssetDynamic = swapTxContainer.assetOut.getAssetSymbol()
        const descriptorString = `KAR ${startAssetDynamic} -> ${destAssetDynamic}`
        console.log("**************************************")
        console.log(descriptorString)
        console.log("**************************************")
        swapTxContainer.txString = descriptorString
        return [swapTxContainer, remainingInstructions]
    } else if(chainId == 2001){
        // console.log(`BNC ${startAsset} -> ${destAsset}`)
        const descriptorString = `BNC ${startAssetSymbol} -> ${destAssetSymbol}`
        console.log("**************************************")
        console.log(descriptorString)
        console.log("**************************************")
        let [swapTxContainer, remainingInstructions] = await getBncSwapExtrinsicDynamic(swapType, instructions, chopsticks)
        swapTxContainer.txString = descriptorString
        return [swapTxContainer, remainingInstructions]
    } else if(chainId == 2023){
        const descriptorString = `MOVR ${startAssetSymbol} -> ${destAssetSymbol}`
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
        const descriptorString = `BSX ${startAssetSymbol} -> ${destAssetSymbol}`
        console.log("**************************************")
        console.log(descriptorString)
        console.log("**************************************")
        let [swapTxContainer, remainingInstructions] = await getBsxSwapExtrinsicDynamic(swapType, startAssetSymbol, amountIn, instructions, chopsticks)
        swapTxContainer.txString = descriptorString
        return [swapTxContainer, remainingInstructions]
    } else if(chainId == 2110){
        const descriptorString = `MGX ${startAssetSymbol} -> ${destAssetSymbol}`
        console.log("**************************************")
        console.log(descriptorString)
        console.log("**************************************")
        let swapTxContainer = await getMgxSwapExtrinsic(swapType, startAssetSymbol, destAssetSymbol, amountIn, expectedAmountOut, instructions, chopsticks)
        swapTxContainer.txString = descriptorString
        let remainingInstructions: SwapInstruction[] = []
        return [swapTxContainer, remainingInstructions]
    } else if(chainId == 2085){
        const descriptorString = `HKO ${startAssetSymbol} -> ${destAssetSymbol}`
        console.log("**************************************")
        console.log(descriptorString)
        console.log("**************************************")
        let swapTxContainer = await getHkoSwapExtrinsic(swapType, startAssetSymbol, destAssetSymbol, amountIn, expectedAmountOut, instructions, chopsticks)
        swapTxContainer.txString = descriptorString
        let remainingInstructions: SwapInstruction[] = []
        return [swapTxContainer, remainingInstructions]
    } else {
        throw new Error("Chain not supported")
    }
}

async function buildPolkadotSwapExtrinsic(
    instructions: SwapInstruction[], 
    chainId: number, 
    swapType: PathType,
    startAssetSymbol: string, 
    destAssetSymbol: string, 
    amountIn: string, 
    expectedAmountOut: string, 
    chopsticks: boolean
): Promise<[SwapExtrinsicContainer, SwapInstruction[]]> {
    console.log("**************************************")
    console.log("Building Polkadot Swap Extrinsic")
    if(chainId == 2000){
        let [swapTxContainer, remainingInstructions] = await getAcaSwapExtrinsicDynamic(swapType, startAssetSymbol, amountIn, instructions, chopsticks)
        let startAssetDynamic = swapTxContainer.assetIn.getAssetSymbol()
        let destAssetDynamic = swapTxContainer.assetOut.getAssetSymbol()
        const descriptorString = `Acala ${startAssetDynamic} -> ${destAssetDynamic}`

        console.log(descriptorString)
        console.log("**************************************")
        swapTxContainer.txString = descriptorString
        return [swapTxContainer, remainingInstructions]

    } else if (chainId == 2030) {
        //bnc
            // console.log(`BNC ${startAsset} -> ${destAsset}`)
            const descriptorString = `BifrostPolkadot ${startAssetSymbol} -> ${destAssetSymbol}`
            console.log(descriptorString)
            console.log("**************************************")
            let [swapTxContainer, remainingInstructions] = await getBncPolkadotSwapExtrinsicDynamic(swapType, instructions, chopsticks)
            swapTxContainer.txString = descriptorString
            return [swapTxContainer, remainingInstructions]

    }else if (chainId == 2004){
        //glmr
        const descriptorString = `Moonbeam ${startAssetSymbol} -> ${destAssetSymbol}`
        console.log(descriptorString)
        console.log("**************************************")
        let remainingInstructions: SwapInstruction[] = []

        let testnet = false
        let swapTxContainer = await getGlmrSwapTx(instructions, testnet)
        swapTxContainer.txString = descriptorString
        return [swapTxContainer, remainingInstructions]
    } else if (chainId == 2012){
        //para
        const descriptorString = `Parallel ${startAssetSymbol} -> ${destAssetSymbol}`
        console.log(descriptorString)
        console.log("**************************************")
        let swapTxContainer = await getParaSwapExtrinsic(swapType, startAssetSymbol, destAssetSymbol, amountIn, expectedAmountOut, instructions, chopsticks)
        swapTxContainer.txString = descriptorString
        let remainingInstructions: SwapInstruction[] = []
        return [swapTxContainer, remainingInstructions]
    } else if(chainId == 2034){
        //hdx
        const descriptorString = `HydraDX ${startAssetSymbol} -> ${destAssetSymbol}`
        console.log(descriptorString)
        console.log("**************************************")
        let [swapTxContainer, remainingInstructions] = await getHdxSwapExtrinsicDynamic(swapType, startAssetSymbol, destAssetSymbol, amountIn, expectedAmountOut, instructions, chopsticks)
        swapTxContainer.txString = descriptorString
        return [swapTxContainer, remainingInstructions]
    }  else {
        throw new Error("Chain not supported")
    }
}

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