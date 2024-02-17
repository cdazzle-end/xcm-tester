import fs from 'fs'
import { Observable, timeout } from 'rxjs'
import { options } from "@acala-network/api/dist";
import * as paraspell from '@paraspell/sdk'
import { WsProvider, ApiPromise, Keyring, ApiRx } from '@polkadot/api'
import { TNode, getAssetsObject, getNode, getNodeEndpointOption, getAllNodeProviders, getTNode } from '@paraspell/sdk'
import path from 'path';
import { cryptoWaitReady } from "@polkadot/util-crypto"
// import { wsLocalFrom, wsLocalDestination, assetSymbol, fromChain, toChain } from '../xcm_tests/testParams.ts'
import { BN, compactStripLength, u8aToHex } from '@polkadot/util'
import { getAssetBySymbolOrId, getParaspellChainName, getAssetRegistryObject, readLogData, getEndpointsForChain, connectFirstApi, getAssetRegistryObjectBySymbol, watchTokenDeposit, getBalanceChange, getSigner, increaseIndex } from './utils.ts'
import { ResultDataObject, MyAssetRegistryObject, MyAsset, AssetNodeData, InstructionType, SwapInstruction, TransferInstruction, TransferToHomeThenDestInstruction, TxDetails, TransferToHomeChainInstruction, TransferParams, TransferAwayFromHomeChainInstruction, TransferrableAssetObject, TransferTxStats, BalanceChangeStats, SwapTxStats, SwapExtrinsicContainer, ExtrinsicObject, ChainNonces, TransferExtrinsicContainer, ReverseSwapExtrinsicParams, IndexObject, PathNodeValues } from './types.ts'
import { AssetNode } from './AssetNode.ts'
import { prodRelayPolkadot, prodRelayKusama, createWsEndpoints, prodParasKusamaCommon, prodParasKusama } from '@polkadot/apps-config/endpoints'
import { buildInstructions, getTransferrableAssetObject } from './instructionUtils.ts';
import { fileURLToPath } from 'url';
import { getKarSwapExtrinsicBestPath, getKarSwapExtrinsicDynamic } from './../swaps/karSwap.ts';
import { getMovrSwapTx } from './../swaps/movr/movrSwap.ts';
// import { getBncSwapExtrinsic } from './../swaps/bnc/bncSwap.ts';
import { getBncSwapExtrinsic, getBncSwapExtrinsicDynamic } from './../swaps/bncSwap.ts';
import { getBsxSwapExtrinsic, getBsxSwapExtrinsicDynamic } from './../swaps/bsxSwap.ts';
// const bncSwap = await import('./../swaps/bnc/bncSwap.ts');
// const { getBncSwapExtrinsic } = bncSwap;
// import bnc from './../swaps/bnc/bncSwap.ts';
// import { getBsxSwapExtrinsic } from './../swaps/bsxSwap.ts';
// const bsxSwap = await import('./../swaps/bsx/bsxSwap.ts');
// const { getBsxSwapExtrinsic } = bsxSwap;
import { getMgxSwapExtrinsic } from './../swaps/mgxSwap.ts';
import { getHkoSwapExtrinsic } from './../swaps/hkoSwap.ts';
import { checkAndApproveToken } from './../swaps/movr/utils/utils.ts';
import { SubmittableExtrinsic } from '@polkadot/api/submittable/types'
import { EventRecord } from '@polkadot/types/interfaces/index';

import { FixedPointNumber, Token } from "@acala-network/sdk-core";
import { ISubmittableResult } from '@polkadot/types/types/extrinsic';
// import { BalanceData, getAdapter } from '@polkawallet/bridge';
import { alithAddress, ksmRpc, localRpcs, testNets } from './txConsts.ts';
import { MultiswapSellAsset } from '@mangata-finance/sdk';
import { TokenAmount } from '@zenlink-dex/sdk-core';
import { BatchSwapParams } from './../swaps/movr/utils/types.ts';






export async function buildTransferExtrinsicReworked(instruction: TransferInstruction, extrinsicIndex: IndexObject, chopsticks: boolean){
    let transferExtrinsics: TransferExtrinsicContainer[] = []
    switch(instruction.type){
        case InstructionType.TransferToHomeChain:
            transferExtrinsics.push(await buildTransferExtrinsicFromInstruction(instruction, extrinsicIndex, chopsticks))
            break;
        case InstructionType.TransferAwayFromHomeChain:
            transferExtrinsics.push(await buildTransferExtrinsicFromInstruction(instruction, extrinsicIndex, chopsticks))
            break;
        case InstructionType.TransferToHomeThenDestination:
            console.log("TRANSFERS")
            let transfers = await buildDoubleTransferExtrinsic(instruction, extrinsicIndex, chopsticks)
            transfers.forEach((transfer) => {
                // console.log(JSON.stringify(transfer.extrinsic, null, 2))
                transferExtrinsics.push(transfer)
            })
            break;
    }
    return transferExtrinsics
}

export async function buildTransferExtrinsicDynamic(instruction: TransferInstruction, extrinsicIndex: IndexObject, chopsticks: boolean): Promise<[TransferExtrinsicContainer, TransferInstruction[]]> {
    let transferExtrinsic: TransferExtrinsicContainer;
    let remainingInstructions: TransferInstruction[] = [];
    switch(instruction.type){
        case InstructionType.TransferToHomeChain:
            transferExtrinsic = await buildTransferExtrinsicFromInstruction(instruction, extrinsicIndex, chopsticks);
            break;
        case InstructionType.TransferAwayFromHomeChain:
            transferExtrinsic = await buildTransferExtrinsicFromInstruction(instruction, extrinsicIndex, chopsticks);
            break;
        case InstructionType.TransferToHomeThenDestination:
            console.log("TRANSFERS")
            let [transferOne, transferTwo] = splitDoubleTransferInstruction(instruction)
            transferExtrinsic = await buildTransferExtrinsicFromInstruction(transferOne, extrinsicIndex, chopsticks)
            remainingInstructions.push(transferTwo)
            break;
    }
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

export async function buildTransferExtrinsicFromInstruction(instruction: TransferInstruction, extrinsicIndex: IndexObject, chopsticks: boolean): Promise<TransferExtrinsicContainer> {
    let startApi = await getApiForNode(instruction.startNode, chopsticks)
    let destinationApi = await getApiForNode(instruction.destinationNode, chopsticks)

    
    let startTransferrable = getTransferrableAssetObject(instruction.startAssetNode)
    let destinationTransferrable = getTransferrableAssetObject(instruction.destinationAssetNode)
    let currencyInput = startTransferrable.paraspellAsset.assetId? startTransferrable.paraspellAsset.assetId : startTransferrable.paraspellAsset.symbol
    
    let assetDecimals = getAssetDecimalsForNode(instruction.startNode, startTransferrable)
    let startParaId = getParaIdForNode(instruction.startNode, instruction.startAssetNode)
    let destinationParaId = getParaIdForNode(instruction.destinationNode, instruction.destinationAssetNode)
    let transferAmount = new FixedPointNumber(instruction.assetNodes[0].pathValue, Number.parseInt(assetDecimals.toString())).toChainData()

    let signer = await getSigner(chopsticks, false);
    let destinationAddress = signer.address
    if(instruction.destinationNode == "Moonriver"){
        destinationAddress = alithAddress

    }


    let xcmTx: paraspell.Extrinsic;
    if(instruction.startNode == "Kusama" && instruction.destinationNode != "Kusama") {
        xcmTx = paraspell.Builder(startApi).to(instruction.destinationNode).amount(transferAmount).address(destinationAddress).build()
    } else if(instruction.destinationNode == "Kusama" && instruction.startNode != "Kusama") {
        xcmTx = paraspell.Builder(startApi).from(instruction.startNode).amount(transferAmount).address(destinationAddress).build()
    } else if(instruction.startNode != "Kusama" && instruction.destinationNode != "Kusama") {
        xcmTx = paraspell.Builder(startApi).from(instruction.startNode).to(instruction.destinationNode).currency(currencyInput).amount(transferAmount).address(destinationAddress).build()
    } else {
        throw new Error("Invalid transfer instruction")
    }

    let instructionIndex = instruction.instructionIndex
    let txContainer: TransferExtrinsicContainer = {
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
    return txContainer
}
async function buildDoubleTransferExtrinsic(instruction: TransferToHomeThenDestInstruction, extrinsicIndex: IndexObject, chopsticks: boolean): Promise<[TransferExtrinsicContainer, TransferExtrinsicContainer]> {
    let splitInstructions = splitDoubleTransferInstruction(instruction)
    let firstExtrinsic = await buildTransferExtrinsicFromInstruction(splitInstructions[0], extrinsicIndex, chopsticks)
    let secondExtrinsic = await buildTransferExtrinsicFromInstruction(splitInstructions[1], extrinsicIndex, chopsticks)
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

async function getApiForNode(node: TNode | "Kusama", chopsticks: boolean){
    let apiEndpoint;
    if(node == "Kusama"){
        apiEndpoint = ksmRpc
        // throw new Error("Trying to transfer kusama away from home chain to kusama")
    } else{
        apiEndpoint = paraspell.getAllNodeProviders(node)
    }
    
    // -- But initialize test endpoints until real
    if(chopsticks){
        let localRpc = localRpcs[node]
        if(localRpc){
            apiEndpoint = localRpc
        }
    }

    if(node == "Mangata"){
        const MangataSDK = await import('@mangata-finance/sdk')
        return await MangataSDK.Mangata.instance([apiEndpoint]).api()
    } else {
        let provider = new WsProvider(apiEndpoint)
        return await ApiPromise.create({ provider: provider });
    }
}
function getAssetDecimalsForNode(node: TNode | "Kusama", transferObject: TransferrableAssetObject){
    if(node == "Kusama"){
        return 12
    } else {
        return paraspell.getAssetDecimals(node, transferObject.paraspellAsset.symbol)
    }
}
function getParaIdForNode(node: TNode | "Kusama", assetNode: AssetNode){
    if(node == "Kusama"){
        return 0
    } else {
        return assetNode.getChainId()
    }
}

// export async function buildReverseTransferExtrinsic(transfers: TransferExtrinsicContainer[]){


// export async function buildReverseSwapExtrinsic(reverseExtrinsic: ReverseSwapExtrinsicParams | BatchSwapParams, api: ApiPromise){
//     let reverseTx;
//     let reverseExtrinsicParams = reverseExtrinsic as ReverseSwapExtrinsicParams
//     switch (reverseExtrinsic.chainId){
//         case 2000:
            
//             reverseExtrinsicParams as ReverseSwapExtrinsicParams
//             let karSupply = reverseExtrinsicParams.supply as FixedPointNumber
//             let karTarget = reverseExtrinsicParams.target as FixedPointNumber
//             if(reverseExtrinsicParams.type == 1){
//                 // console.log(reverseExtrinsicParams.module)
//                 // console.log(reverseExtrinsicParams.call)
//                 reverseTx = await api.tx[reverseExtrinsicParams.module][reverseExtrinsicParams.call](reverseExtrinsicParams.path, karSupply.toChainData(), karTarget.toChainData())
//             } else {
//                 reverseTx = await api.tx[reverseExtrinsicParams.module][reverseExtrinsicParams.call](reverseExtrinsicParams.poolIndex, reverseExtrinsicParams.startAssetIndex, reverseExtrinsicParams.endAssetIndex, karSupply.toChainData(), karTarget.toChainData(), reverseExtrinsicParams.assetLength)
//             }
//             let karSwapContainer: SwapExtrinsicContainer = {
//                 chainId: reverseExtrinsicParams.chainId,
//                 chain: reverseExtrinsicParams.chain,
//                 extrinsic: reverseTx,
//                 assetAmountIn: karSupply,
//                 assetSymbolIn: reverseExtrinsicParams.supplyAssetId,
//                 assetSymbolOut: reverseExtrinsicParams.targetAssetId,
//                 expectedAmountOut: karTarget,
//                 api: api
//             }
//             return karSwapContainer
//             break;
//         case 2001:
//             // let reverseExtrinsicParams = reverseExtrinsic as ReverseSwapExtrinsicParams
//             let blockNumber = await reverseExtrinsicParams.moduleBApi.api.query.system.number();
//             let deadline = blockNumber.toNumber() + 200;
//             let bncSupply = reverseExtrinsicParams.supply as TokenAmount
//             let bncTarget = reverseExtrinsicParams.target as TokenAmount
//             reverseTx = await reverseExtrinsicParams.moduleBApi.swapExactTokensForTokens(reverseExtrinsicParams.path, bncSupply, bncTarget, reverseExtrinsicParams.recipient, deadline)        
//             // [reverseExtrinsicParams.call](reverseExtrinsicParams.path, bncSupply, bncTarget, reverseExtrinsicParams.recipient, deadline)
            
//             let bncSwapContainer: SwapExtrinsicContainer = {
//                 chainId: reverseExtrinsicParams.chainId,
//                 chain: reverseExtrinsicParams.chain,
//                 extrinsic: reverseTx,
//                 assetAmountIn: reverseExtrinsicParams.supplyFn,
//                 assetSymbolIn: reverseExtrinsicParams.supplyAssetId,
//                 assetSymbolOut: reverseExtrinsicParams.targetAssetId,
//                 expectedAmountOut: reverseExtrinsicParams.targetFn,
//                 api: api
//             }
//             return bncSwapContainer
//             break;
//         case 2023:
//             let reverseSwapParams = reverseExtrinsic as BatchSwapParams
//             let liveWallet = reverseSwapParams.wallet;
//             let batchContract = reverseSwapParams.batchContract;
//             let movrTx = async function executeSwapTx(){
//                 return await batchContract.executeSwaps(
//                     reverseSwapParams.dexAddresses, 
//                     reverseSwapParams.abiIndexes, 
//                     reverseSwapParams.inputTokens,
//                     reverseSwapParams.outputTokens, 
//                     reverseSwapParams.amount0Ins, 
//                     reverseSwapParams.amount1Ins, 
//                     reverseSwapParams.amount0Outs, 
//                     reverseSwapParams.amount1Outs, 
//                     reverseSwapParams.movrWrapAmounts, 
//                     reverseSwapParams.data, 
//                     {value: reverseSwapParams.movrWrapAmounts[0]}
//                 );
//             }
//             let movrSwapTxContainer: SwapExtrinsicContainer = {
//                 chainId: 2023,
//                 chain: "Moonriver",
//                 extrinsic: movrTx,
//                 assetAmountIn: reverseExtrinsicParams.supplyFn,
//                 assetSymbolIn: reverseExtrinsicParams.supplyAssetId,
//                 assetSymbolOut: reverseExtrinsicParams.targetAssetId,
//                 expectedAmountOut: reverseExtrinsicParams.targetFn,
//                 api: api
//             }
//             return movrSwapTxContainer
         
//             break;
//         case 2085:
//             let hkoSupply = reverseExtrinsicParams.supply as FixedPointNumber
//             let hkoTarget = reverseExtrinsicParams.target as FixedPointNumber
//             reverseTx = await api.tx[reverseExtrinsicParams.module][reverseExtrinsicParams.call](reverseExtrinsicParams.path, hkoSupply.toChainData(), hkoTarget.toChainData())

//             let hkoSwapContainer: SwapExtrinsicContainer = {
//                 chainId: reverseExtrinsicParams.chainId,
//                 chain: reverseExtrinsicParams.chain,
//                 extrinsic: reverseTx,
//                 assetAmountIn: hkoSupply,
//                 assetSymbolIn: reverseExtrinsicParams.supplyAssetId,
//                 assetSymbolOut: reverseExtrinsicParams.targetAssetId,
//                 expectedAmountOut: hkoTarget,
//                 api: api
//             }
//             return hkoSwapContainer
//             break;
//         case 2090:
//             let bsxSupply = reverseExtrinsicParams.supply as FixedPointNumber
//             let bsxTarget = reverseExtrinsicParams.target as FixedPointNumber
//             reverseTx = await api.tx[reverseExtrinsicParams.module][reverseExtrinsicParams.call](reverseExtrinsicParams.supplyAssetId, reverseExtrinsicParams.targetAssetId, bsxSupply.toChainData(), bsxTarget.toChainData(), reverseExtrinsicParams.path)
            
//             let bsxSwapContainer: SwapExtrinsicContainer = {
//                 chainId: reverseExtrinsicParams.chainId,
//                 chain: reverseExtrinsicParams.chain,
//                 extrinsic: reverseTx,
//                 assetAmountIn: bsxSupply,
//                 assetSymbolIn: reverseExtrinsicParams.supplyAssetId,
//                 assetSymbolOut: reverseExtrinsicParams.targetAssetId,
//                 expectedAmountOut: bsxTarget,
//                 api: api
//             }
//             return bsxSwapContainer
//             break;
//         case 2110:
//             let instance = reverseExtrinsicParams.mangataInstance
//             let args: MultiswapSellAsset = {
//                 tokenIds: reverseExtrinsicParams.path,
//                 amount: reverseExtrinsicParams.supply as BN,
//                 minAmountOut: reverseExtrinsicParams.target as BN
//             }
//             reverseTx = await instance[reverseExtrinsicParams.module][reverseExtrinsicParams.call](args)
             
//             let mgxSwapContainer: SwapExtrinsicContainer = {
//                 chainId: reverseExtrinsicParams.chainId,
//                 chain: reverseExtrinsicParams.chain,
//                 extrinsic: reverseTx,
//                 assetAmountIn: reverseExtrinsicParams.supplyFn,
//                 assetSymbolIn: reverseExtrinsicParams.supplyAssetId,
//                 assetSymbolOut: reverseExtrinsicParams.targetAssetId,
//                 expectedAmountOut: reverseExtrinsicParams.targetFn,
//                 api: api
//             }
//             return mgxSwapContainer
//             break;
//     }
// }

// Takes array of swap instructions. Builds extrinsics start asset in instruction 1, to destination asset in the final instruction
export async function buildSwapExtrinsic(instructions: SwapInstruction[], chainNonces: ChainNonces, extrinsicIndex: IndexObject, chopsticks: boolean): Promise<SwapExtrinsicContainer[]> {
    let chainId = instructions[0].chain
    let swapType = instructions[0].pathType
    let startAsset = instructions[0].assetNodes[0].getAssetRegistrySymbol()
    let destAsset = instructions[instructions.length - 1].assetNodes[1].getAssetRegistrySymbol()
    let amountIn = instructions[0].assetNodes[0].pathValue;
    let expectedAmountOut = instructions[instructions.length - 1].assetNodes[1].pathValue;
    let pathStartLocalId = instructions[0].assetInLocalId
    let pathDestLocalId = instructions[instructions.length - 1].assetOutLocalId
    let signer = await getSigner(chopsticks, false);
    let instructionIndex: number[] = []
    instructionIndex: instructions.forEach((instruction) => {
        instructionIndex.push(instruction.instructionIndex)
    })

    let pathNodeValues : PathNodeValues = {
        pathInSymbol: "TEST Symbol in",
        pathOutSymbol: "TEST Symbol out",
        pathInLocalId: pathStartLocalId,
        pathOutLocalId: pathDestLocalId,
        pathSwapType: swapType,
        pathValue: amountIn
    }
    // Kar dex can handle swap pathing in single extrinsic
    let test = true;
    if(chainId == 2000){
        // Can use symbol or local id
        const descriptorString = `KAR ${startAsset} -> ${destAsset}`
        console.log(descriptorString)
        let swapTxContainers = await getKarSwapExtrinsicBestPath(swapType, startAsset, destAsset, amountIn, expectedAmountOut, instructions, test, chainNonces[2000], extrinsicIndex, instructionIndex, pathNodeValues)
        // console.log(JSON.stringify(swapTxContainer))
        swapTxContainers.forEach((swapTxContainer) => {
            swapTxContainer.txString = descriptorString
        })
        // swapTxContainer.txString = descriptorString
        // swapTxContainer.nonce = chainNonces[2000]
        // swapTxContainer.
        // swapTxContainer.pathInLocalId = pathStartLocalId
        // swapTxContainer.pathOutLocalId = pathDestLocalId
        // swapTxContainer.chainId = 2000
        chainNonces[2000]++
        return swapTxContainers
    // Movr needs explicit pathing
    } else if(chainId == 2001){
        // CAN CONSOLIDATE SWAP INSTRUCTIONS INTO SINGLE EXTRINSIC
        console.log(`BNC ${startAsset} -> ${destAsset}`)
        const descriptorString = `BNC ${startAsset} -> ${destAsset}`
        let swapTxContainer = await getBncSwapExtrinsic(startAsset, destAsset, amountIn, expectedAmountOut, instructions, test, chainNonces[2001], extrinsicIndex, instructionIndex, pathNodeValues)
        swapTxContainer.txString = descriptorString
        chainNonces[2001]++
        return [swapTxContainer]
    } else if(chainId == 2023){
        console.log(`MOV ${startAsset} -> ${destAsset}`)
        const descriptorString = `MOV ${startAsset} -> ${destAsset}`
        let movrBatchSwapParams = await getMovrSwapTx(instructions, false)
        let reverseMovrBatchSwapParams = movrBatchSwapParams.reverseSwapParams
        let liveWallet = movrBatchSwapParams.wallet;
        let batchContract = movrBatchSwapParams.batchContract;
        
        let batchContractAddress = await batchContract.getAddress()
        console.log(`Wallet: ${liveWallet.address} | Batch Contract: ${batchContractAddress}`)
        let tokens = movrBatchSwapParams.inputTokens

        // //WHEN we execute the tx, we need to approve batch contract to spend tokens first
        for(let i = 0; i < tokens.length; i++){
            let tokenInput = movrBatchSwapParams.amount0Ins[i] > 0 ? movrBatchSwapParams.amount0Ins[i] : movrBatchSwapParams.amount1Ins[i]
            let approval = await checkAndApproveToken(tokens[i], liveWallet, batchContractAddress, tokenInput)
        }
        let wrapMovrAmount = movrBatchSwapParams.movrWrapAmounts[0]

        let assetInNode = instructions[0].assetNodes[0]
        let assetOutNode = instructions[instructions.length - 1].assetNodes[1]
        let assetInDecimals = assetInNode.assetRegistryObject.tokenData.decimals
        let assetOutDecimals = assetOutNode.assetRegistryObject.tokenData.decimals
        let inputAmount = instructions[0].assetInAmount
        let outputAmount = instructions[instructions.length - 1].assetOutTargetAmount
        
        let inputFixedPoint = new FixedPointNumber(inputAmount, Number.parseInt(assetInDecimals))
        let outputFixedPoint = new FixedPointNumber(outputAmount, Number.parseInt(assetOutDecimals))
        // let inputFixedPoint = new FixedPointNumber(inputAmount.toString(), 18)

        let movrTx = async function executeSwapTx() {
            return await batchContract.executeSwaps(
                movrBatchSwapParams.dexAddresses, 
                movrBatchSwapParams.abiIndexes, 
                movrBatchSwapParams.inputTokens,
                movrBatchSwapParams.outputTokens, 
                movrBatchSwapParams.amount0Ins, 
                movrBatchSwapParams.amount1Ins, 
                movrBatchSwapParams.amount0Outs, 
                movrBatchSwapParams.amount1Outs, 
                movrBatchSwapParams.movrWrapAmounts, 
                movrBatchSwapParams.data, 
                {value: wrapMovrAmount}
            );
        };
        let assetNodes = instructions[0].assetNodes
        let swapTxContainer: SwapExtrinsicContainer = {
            chainId: 2023,
            chain: "Moonriver",
            assetNodes: assetNodes,
            extrinsic: movrTx,
            extrinsicIndex: extrinsicIndex.i,
            instructionIndex: instructionIndex,
            txString: descriptorString,
            nonce: chainNonces[2023],
            assetSymbolIn: startAsset,
            assetSymbolOut: destAsset,
            assetAmountIn: inputFixedPoint,
            expectedAmountOut: outputFixedPoint,
            pathInLocalId: pathStartLocalId,
            pathOutLocalId: pathDestLocalId,
            pathSwapType: swapType,
            pathAmount: amountIn,
            reverseTx: reverseMovrBatchSwapParams,
            movrBatchSwapParams: movrBatchSwapParams
        }
        increaseIndex(extrinsicIndex)
        return [swapTxContainer]

    // Basilisk will return array of extrinsics
    } else if(chainId == 2090){
    
        console.log(`BSX ${startAsset} -> ${destAsset}`)
        const descriptorString = `BSX ${startAsset} -> ${destAsset}`
        let swapTxContainers = await getBsxSwapExtrinsic(startAsset, destAsset, amountIn, expectedAmountOut, instructions, test, chainNonces[2090], extrinsicIndex, instructionIndex, pathNodeValues)
        swapTxContainers.forEach((swapTxContainer) => {
            swapTxContainer.txString = descriptorString
        })
        chainNonces[2090]++
        return swapTxContainers
    } else if (chainId == 2110){
        console.log(`MGX ${startAsset} -> ${destAsset}`)
        const descriptorString = `MGX ${startAsset} -> ${destAsset}`
        let swapTxContainer = await getMgxSwapExtrinsic(startAsset, destAsset, amountIn, expectedAmountOut, instructions, test, chainNonces[2110], extrinsicIndex,instructionIndex, pathNodeValues)
        swapTxContainer.txString = descriptorString
        chainNonces[2110]++
        return [swapTxContainer]
    } else if(chainId == 2085){
        console.log(`HKO ${startAsset} -> ${destAsset}`)
        const descriptorString = `HKO ${startAsset} -> ${destAsset}`
        let swapTxContainer = await getHkoSwapExtrinsic(startAsset, destAsset, amountIn, expectedAmountOut, instructions, test, chainNonces[2085], extrinsicIndex, instructionIndex, pathNodeValues)
        swapTxContainer.txString = descriptorString
        chainNonces[2085]++
        return [swapTxContainer]
    } else {
        throw new Error("Chain not supported")
    }
}

export async function buildSwapExtrinsicDynamic(instructions: SwapInstruction[], chainNonces: ChainNonces, extrinsicIndex: IndexObject, chopsticks: boolean): Promise<[SwapExtrinsicContainer, SwapInstruction[]]> {
    let chainId = instructions[0].chain
    let swapType = instructions[0].pathType
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
    let pathNodeValues : PathNodeValues = {
        pathInSymbol: "TEST Symbol in",
        pathOutSymbol: "TEST Symbol out",
        pathInLocalId: pathStartLocalId,
        pathOutLocalId: pathDestLocalId,
        pathSwapType: swapType,
        pathValue: amountIn
    }

    if(chainId == 2000){
        let [swapTxContainer, remainingInstructions] = await getKarSwapExtrinsicDynamic(swapType, startAsset, destAsset, amountIn, expectedAmountOut, instructions, chopsticks, chainNonces[2000], extrinsicIndex, instructionIndex, pathNodeValues)
        let swapAssetNodes = swapTxContainer.assetNodes
        let startAssetDynamic = swapAssetNodes[0].getAssetRegistrySymbol()
        let destAssetDynamic = swapAssetNodes[swapAssetNodes.length - 1].getAssetRegistrySymbol()
        const descriptorString = `KAR ${startAssetDynamic} -> ${destAssetDynamic}`
        console.log(descriptorString)
        swapTxContainer.txString = descriptorString
        return [swapTxContainer, remainingInstructions]
    } else if(chainId == 2001){
        console.log(`BNC ${startAsset} -> ${destAsset}`)
        const descriptorString = `BNC ${startAsset} -> ${destAsset}`
        let [swapTxContainer, remainingInstructions] = await getBncSwapExtrinsicDynamic(instructions, chopsticks, chainNonces[2001], extrinsicIndex, instructionIndex, pathNodeValues)
        swapTxContainer.txString = descriptorString
        chainNonces[2001]++
        return [swapTxContainer, remainingInstructions]
    } else if(chainId == 2023){
        console.log(`MOV ${startAsset} -> ${destAsset}`)
        const descriptorString = `MOV ${startAsset} -> ${destAsset}`
        let remainingInstructions: SwapInstruction[] = []
        let movrBatchSwapParams = await getMovrSwapTx(instructions, false)
        let swapTxContainer = await formatMovrTx(movrBatchSwapParams, instructions, chainNonces, extrinsicIndex, instructionIndex)
        return [swapTxContainer, remainingInstructions]
    } else if(chainId == 2090){
        console.log(`BSX ${startAsset} -> ${destAsset}`)
        const descriptorString = `BSX ${startAsset} -> ${destAsset}`
        let [swapTxContainer, remainingInstructions] = await getBsxSwapExtrinsicDynamic(startAsset, destAsset, amountIn, expectedAmountOut, instructions, chopsticks, chainNonces[2090], extrinsicIndex, instructionIndex, pathNodeValues)
        swapTxContainer.txString = descriptorString
        chainNonces[2090]++
        return [swapTxContainer, remainingInstructions]
    } else if(chainId == 2110){
        console.log(`MGX ${startAsset} -> ${destAsset}`)
        const descriptorString = `MGX ${startAsset} -> ${destAsset}`
        let swapTxContainer = await getMgxSwapExtrinsic(startAsset, destAsset, amountIn, expectedAmountOut, instructions, chopsticks, chainNonces[2110], extrinsicIndex,instructionIndex, pathNodeValues)
        swapTxContainer.txString = descriptorString
        chainNonces[2110]++
        let remainingInstructions: SwapInstruction[] = []
        return [swapTxContainer, remainingInstructions]
    } else if(chainId == 2085){
        console.log(`HKO ${startAsset} -> ${destAsset}`)
        const descriptorString = `HKO ${startAsset} -> ${destAsset}`
        let swapTxContainer = await getHkoSwapExtrinsic(startAsset, destAsset, amountIn, expectedAmountOut, instructions, chopsticks, chainNonces[2085], extrinsicIndex, instructionIndex, pathNodeValues)
        swapTxContainer.txString = descriptorString
        chainNonces[2085]++
        let remainingInstructions: SwapInstruction[] = []
        return [swapTxContainer, remainingInstructions]
    } else {
        throw new Error("Chain not supported")
    }
}

async function formatMovrTx(movrBatchSwapParams: BatchSwapParams, swapInstructions: SwapInstruction[], chainNonces: ChainNonces, extrinsicIndex: IndexObject, instructionIndex: number[]) {
    let liveWallet = movrBatchSwapParams.wallet;
    let batchContract = movrBatchSwapParams.batchContract;
    
    let batchContractAddress = await batchContract.getAddress()
    console.log(`Wallet: ${liveWallet.address} | Batch Contract: ${batchContractAddress}`)
    let tokens = movrBatchSwapParams.inputTokens

    // //WHEN we execute the tx, we need to approve batch contract to spend tokens first
    for(let i = 0; i < tokens.length; i++){
        let tokenInput = movrBatchSwapParams.amount0Ins[i] > 0 ? movrBatchSwapParams.amount0Ins[i] : movrBatchSwapParams.amount1Ins[i]
        let approval = await checkAndApproveToken(tokens[i], liveWallet, batchContractAddress, tokenInput)
    }
    let wrapMovrAmount = movrBatchSwapParams.movrWrapAmounts[0]

    let assetInNode = swapInstructions[0].assetNodes[0]
    let assetOutNode = swapInstructions[swapInstructions.length - 1].assetNodes[1]
    let assetInDecimals = assetInNode.assetRegistryObject.tokenData.decimals
    let assetOutDecimals = assetOutNode.assetRegistryObject.tokenData.decimals
    let inputAmount = swapInstructions[0].assetInAmount
    let outputAmount = swapInstructions[swapInstructions.length - 1].assetOutTargetAmount
    
    let inputFixedPoint = new FixedPointNumber(inputAmount, Number.parseInt(assetInDecimals))
    let outputFixedPoint = new FixedPointNumber(outputAmount, Number.parseInt(assetOutDecimals))
    // let inputFixedPoint = new FixedPointNumber(inputAmount.toString(), 18)

    let movrTx = async function executeSwapTx() {
        return await batchContract.executeSwaps(
            movrBatchSwapParams.dexAddresses, 
            movrBatchSwapParams.abiIndexes, 
            movrBatchSwapParams.inputTokens,
            movrBatchSwapParams.outputTokens, 
            movrBatchSwapParams.amount0Ins, 
            movrBatchSwapParams.amount1Ins, 
            movrBatchSwapParams.amount0Outs, 
            movrBatchSwapParams.amount1Outs, 
            movrBatchSwapParams.movrWrapAmounts, 
            movrBatchSwapParams.data, 
            {value: wrapMovrAmount}
        );
    };
    let startAsset = swapInstructions[0].assetNodes[0].getAssetRegistrySymbol()
    let destAsset = swapInstructions[swapInstructions.length - 1].assetNodes[1].getAssetRegistrySymbol()
    const descriptorString = `MOVR ${startAsset} -> ${destAsset}`
    let pathStartLocalId = swapInstructions[0].assetInLocalId
    let pathDestLocalId = swapInstructions[swapInstructions.length - 1].assetOutLocalId
    let amountIn = swapInstructions[0].assetNodes[0].pathValue;
    let swapType = swapInstructions[0].pathType

    let assetNodes = swapInstructions[0].assetNodes
    let swapTxContainer: SwapExtrinsicContainer = {
        chainId: 2023,
        chain: "Moonriver",
        assetNodes: assetNodes,
        extrinsic: movrTx,
        extrinsicIndex: extrinsicIndex.i,
        instructionIndex: instructionIndex,
        txString: descriptorString,
        nonce: chainNonces[2023],
        assetSymbolIn: startAsset,
        assetSymbolOut: destAsset,
        assetAmountIn: inputFixedPoint,
        expectedAmountOut: outputFixedPoint,
        pathInLocalId: pathStartLocalId,
        pathOutLocalId: pathDestLocalId,
        pathSwapType: swapType,
        pathAmount: amountIn,
        // reverseTx: reverseMovrBatchSwapParams,
        movrBatchSwapParams: movrBatchSwapParams
    }
    increaseIndex(extrinsicIndex)
    return swapTxContainer
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