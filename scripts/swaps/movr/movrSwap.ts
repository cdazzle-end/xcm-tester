import '@moonbeam-network/api-augment/moonriver'
import { calculateSwapAmountRouterFormula, checkForSubstrateToken, getBestSwapRoute, logBatchContractResults, getContractAbi, checkApproval, getTokenContractData, logDoubleSwapResults, getContractAbiIndex, checkAndApproveToken, wrapMovr, logLiveWalletTransaction } from './utils/utils.ts';
import { batchArtifact, batchContractAddress2, boxContractAddress, defaultRpc, dexAbis, fraxContractAddress, ignoreList, liveBatchContract, liveWallet3Pk, localRpc, movrContractAbi, movrContractAddress, solarFee, test_account_pk, usdcContractAbi, usdcContractAddress, wmovrFraxDexAddress, wmovrUsdcDexAddress, xcCsmContractAddress, xcKarContractAddress, xcKintContractAddress, xcKsmContractAddress, xcRmrkContractAddress, xcXrtContractAddress, zenFee } from './utils/const.ts';
import * as mutex from 'mutexify'
import { ApiPromise, Keyring, WsProvider } from '@polkadot/api';
// import { MangataInstance, Mangata, MultiswapBuyAsset, MultiswapSellAsset } from "@mangata-finance/sdk"
// import { BN } from '@polkadot/util';
import { createPublicClient, http, createWalletClient, formatEther, webSocket, erc20Abi } from 'viem';
import { moonriver } from 'viem/chains';
import { ethers } from 'ethers'
import * as fs from 'fs';
import { WebSocketProvider, Web3} from 'web3'
import { privateKeyToAccount } from 'viem/accounts';
import path from 'path';
// import { contract } from 'web3/lib/commonjs/eth.exports';
import BN from 'bn.js';
import {toBigInt} from 'ethers'
import { BigNumberish } from 'ethers';
import { BatchSwapParams, SwapData } from './utils/types.ts';
import {ChainNonces, IndexObject, SwapExtrinsicContainer, SwapInstruction} from '../../instructions/types.ts'
import { fileURLToPath } from 'url';
import { AssetNode } from '../../instructions/AssetNode.ts';
import { increaseIndex } from '../../instructions/utils.ts';
import { FixedPointNumber } from '@acala-network/sdk-core';
import { getApiForNode } from '../../instructions/apiUtils.ts';
import { live_wallet_3 } from '../../instructions/txConsts.ts';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
console.log(__dirname)
// Patch BigInt for JSON serialization
declare global {
    interface BigInt {
        toJSON(): string;
    }
}

BigInt.prototype.toJSON = function() {
    return this.toString();
};
const allAssets = JSON.parse(fs.readFileSync(path.join(__dirname, './allAssets.json'), 'utf8'));
const routerFees = [
    solarFee,
    zenFee
]
function getAssetFromSymbol(symbol: string){
    const asset = allAssets.find((asset: any) => asset.tokenData.chain == "2023" && asset.tokenData.symbol.toLowerCase() == symbol.toLowerCase())
    if(!asset){
        throw new Error(`Asset not found for symbol ${symbol}`)
    }
    return asset
}
function getAssetFromLocalId(localId: string){
    const asset = allAssets.find((asset: any) => asset.tokenData.chain == 2023 && asset.tokenData.localId.toLowerCase() == localId.toLowerCase())
    if(!asset){
        throw new Error(`Asset not found for symbol ${localId}`)
    }
    return asset
}
interface BatchSwapParamsTest{
    dexAddress: string,
    abiIndex: bigint,
    inputToken: string,
    outputToken: string,
    amount0In: bigint,
    amount1In: bigint,
    amount0Out: bigint,
    amount1Out: bigint,
    movrWrapAmount: bigint
    
}
async function getMovrSwapBestPath(startAssetSymbol: string, endAssetSymbol: string, swapInstructions: SwapInstruction[], inputAmount: bigint){
    const provider = new ethers.JsonRpcProvider(localRpc)
    const wallet = new ethers.Wallet(test_account_pk, provider)
    const batchContract = await new ethers.Contract(batchContractAddress2, batchArtifact.abi, wallet)

    let swapsPromise = swapInstructions.map(async (instruction) => {
        const startAsset = getAssetFromLocalId(instruction.assetInLocalId)
        const endAsset = getAssetFromLocalId(instruction.assetOutLocalId)

        const startAssetAddress = startAsset.tokenData.contractAddress
        const endAssetAddress = endAsset.tokenData.contractAddress
        checkAndApproveToken(startAssetAddress, wallet, batchContractAddress2, inputAmount)
    
        const startAssetContract = new ethers.Contract(startAssetAddress, erc20Abi, wallet)
        const endAssetContract = new ethers.Contract(endAssetAddress, erc20Abi, wallet)
    
        let startAssetBalance = await startAssetContract.balanceOf(wallet.address)

        let movrWrapAmount = BigInt(0);
        if(startAssetAddress == movrContractAddress){
            const nativeMovrBalance = await wallet.provider.getBalance(wallet.address)
            if(startAssetBalance < BigInt(inputAmount) && nativeMovrBalance < BigInt(inputAmount)){
                throw new Error("Not enough movr or wmovr for input amount")
            } else if (startAssetBalance < BigInt(inputAmount)){
                // await wrapMovr(wallet, inputAmount) //Need add wrap to batch contract, add WRAP parameter to swap function
                movrWrapAmount = BigInt(inputAmount)
            }
        } else if (startAssetBalance < inputAmount){
            throw new Error("Not enough balance for input amount")
        }
        const assetOutTargetAmount = BigInt(instruction.assetOutTargetAmount);
        const [dexAddress, calculatedOutput] = await getBestSwapRoute(startAssetAddress, endAssetSymbol, inputAmount, localRpc)
        if(calculatedOutput == 0 || dexAddress == ""){
            throw new Error("No swap route found")
        }
        if(!isWithinPercentage(assetOutTargetAmount, BigInt(calculatedOutput), 1n)){
            throw new Error("Calculated output does not match path output")
        }
        let dexInfo = getDexInfo(dexAddress.toString())
        const inputTokenIndex = startAssetAddress == dexInfo.token0 ? 0 : 1;
        let amount0In, amount1In, amount0Out, amount1Out;
        if(inputTokenIndex == 0){
            amount0In = inputAmount;
            amount1In = 0;
            amount0Out = 0;
            amount1Out = BigInt(calculatedOutput);
        } else {
            amount0In = 0;
            amount1In = inputAmount;
            amount0Out = BigInt(calculatedOutput);
            amount1Out = 0;
        }
        const swapParams: BatchSwapParamsTest = {
            dexAddress: dexAddress.toString(),
            abiIndex: BigInt(dexInfo.abiIndex),
            inputToken: startAssetAddress,
            outputToken: endAssetAddress,
            amount0In: amount0In,
            amount1In: amount1In,
            amount0Out: amount0Out,
            amount1Out: amount1Out,
            movrWrapAmount: movrWrapAmount
        }
        return swapParams
    })
    let swaps = await Promise.all(swapsPromise)
    
    
    let dexes, abiIndexes, inputTokens, outputTokens, amount0Ins, amount1Ins, amount0Outs, amount1Outs, movrWrapAmounts;
    swaps.forEach((swap: BatchSwapParamsTest) => {

        dexes.push(swap.dexAddress)
        abiIndexes.push(swap.abiIndex)
        inputTokens.push(swap.inputToken)
        outputTokens.push(swap.outputToken)
        amount0Ins.push(swap.amount0In)
        amount1Ins.push(swap.amount1In)
        amount0Outs.push(swap.amount0Out)
        amount1Outs.push(swap.amount1Out)
        movrWrapAmounts.push(swap.movrWrapAmount)
    })
    

    const nonce = wallet.getNonce()
    batchContract.executeSwaps(dexes, abiIndexes, inputTokens, outputTokens, amount0Ins, amount1Ins, amount0Outs, amount1Outs, movrWrapAmounts, {nonce: nonce})

}
interface DexInfo {
    contractAddress: string,
    token0: string,
    token1: string,
    abiIndex: number
}
async function writeDexInfo(){
    const swapResults = JSON.parse(fs.readFileSync('./batchResults/double_swap_results.json', 'utf8'));
    let dexes = swapResults.map((swapResult: any) => {
        console.log(swapResult)
        const dexAddress = swapResult.contractAddress
        const token0 = swapResult.token0
        const token1 = swapResult.token1
        const abiIndex = swapResult.abiIndex
        const dexInfo: DexInfo = {
            contractAddress: dexAddress,
            token0: token0,
            token1: token1,
            abiIndex: abiIndex
        }
        return dexInfo
    })

    fs.writeFileSync('./dexInfo.json', JSON.stringify(dexes, null, 2))

}
function getDexInfo(dexAddress: string): DexInfo{
    const allDexes: DexInfo[] = JSON.parse(fs.readFileSync(path.join(__dirname, './dexInfo.json'), 'utf8'));
    let dexInfo = allDexes.find((dex: DexInfo) => dex.contractAddress == dexAddress)
    if(!dexInfo){
        throw new Error("Dex info not found")
    }
    return dexInfo
}
function isWithinPercentage(expected: bigint, actual: bigint, thresholdPercentage: bigint) {
    const abs = (n) => (n < 0n) ? -n : n;
    const acceptableOutput = expected - (expected * thresholdPercentage / 100n)

    return actual >= acceptableOutput
    // let difference: bigint =  abs(expected - actual)
    // let percentageDifference = difference / expected * 100n
    // let percentageDifference = difference.div(expected).times(new FixedPointNumber(100))

    // return percentageDifference.isLessOrEqualTo(new FixedPointNumber(thresholdPercentage));
}


async function swapAForB(tokenInContract: string, tokenOutContract:string, dexAddress:string, inputAmount: bigint, wallet: ethers.Wallet, inputNonce: any, slippage = 100): Promise<[SwapData, any]>{

    const tokenAData = await getTokenContractData(tokenInContract, wallet.address)
    const tokenBData = await getTokenContractData(tokenOutContract, wallet.address)

    const dexAbiIndex = getContractAbiIndex(dexAddress.toString())
    const dexAbi = dexAbis[dexAbiIndex]

    let dexContract = new ethers.Contract(dexAddress.toString(), dexAbi, wallet);
    let reserves0, reserves1, timestamp;
    let token0, token1, symbol0, symbol1, tokenInIndex, token0In, token1In;
    
    let tokenInReserves: bigint, tokenOutReserves: bigint;
    try{
        [reserves0, reserves1, timestamp] = await dexContract.getReserves()
        token0 = await dexContract.token0()
        token1 = await dexContract.token1()
        if(token0 == tokenInContract){
            tokenInReserves = reserves0;
            tokenOutReserves = reserves1;
            tokenInIndex = 0;
            token0In = inputAmount;
            token1In = 0;
        } else {
            tokenInReserves = reserves1;
            tokenOutReserves = reserves0;
            tokenInIndex = 1;
            token0In = 0;
            token1In = inputAmount;
        }

    } catch (e){
        throw new Error("Dex contract failed getting reserves or tokens")
    }

    const batchContract = await new ethers.Contract(batchContractAddress2, batchArtifact.abi, wallet)
    let calculatedAmountOut, swapParams, swapFunction, swapCallData, swapTx;
    if(dexAbiIndex == 0){
        if(tokenInContract == token0){
            calculatedAmountOut = calculateSwapAmountRouterFormula(inputAmount, tokenInReserves, tokenOutReserves, slippage, 25) 
            swapParams = [0, calculatedAmountOut, wallet.address, '0x'];
            
        } else {
            calculatedAmountOut = calculateSwapAmountRouterFormula(inputAmount, tokenInReserves, tokenOutReserves, slippage, 25)
            swapParams = [calculatedAmountOut, 0, wallet.address, '0x'];
        }

        swapFunction = "swap(uint, uint, address, bytes)";
        swapCallData = dexContract.interface.encodeFunctionData(swapFunction, swapParams);
        
        
    } else if (dexAbiIndex == 1){
        if(tokenInContract == token0){
            calculatedAmountOut = calculateSwapAmountRouterFormula(inputAmount, tokenInReserves, tokenOutReserves, slippage, 30)
            swapParams = [0, calculatedAmountOut, wallet.address];
            
        } else {
            calculatedAmountOut = calculateSwapAmountRouterFormula(inputAmount, tokenInReserves, tokenOutReserves, slippage, 30)
            swapParams = [calculatedAmountOut, 0, wallet.address];
            
        }
        swapFunction = "swap(uint, uint, address)";
        swapCallData = dexContract.interface.encodeFunctionData(swapFunction, swapParams);
    } else if (dexAbiIndex == 2){
        console.log("WRONG ABI INDEX")
        throw new Error("Huckleberry Dex Abi (2) not implemented")
    }
    const amount0Out: bigint = swapParams[0]
    const amount1Out: bigint = swapParams[1]
    const to: string = swapParams[2]
    const data: string = swapParams[3]

    try{
        console.log("Executing batch swap contract")
        if(dexAbiIndex == 0){
            swapTx = await batchContract.transferAndSwapHigh(tokenInContract, tokenOutContract, dexAddress, inputAmount, calculatedAmountOut, amount0Out, amount1Out, to, data, {nonce: inputNonce})
    
        } else if (dexAbiIndex == 1){
            swapTx = await batchContract.zenlinkTransferAndSwap(tokenInContract, tokenOutContract, dexAddress, inputAmount, calculatedAmountOut, token0In, token1In, amount0Out, amount1Out, to, reserves0, reserves1, {nonce: inputNonce})
        }
    } catch (e) {
        // console.log(dexAddress)\
        console.log(`Token A: ${tokenInContract} Token B: ${tokenOutContract} Dex Address: ${dexAddress} Input Amount: ${inputAmount} Calculated Amount Out: ${calculatedAmountOut} Amount 0 Out: ${amount0Out} Amount 1 Out: ${amount1Out} To: ${to} Data: ${data}`)
        console.log("EEEEEEEEEEEEEEEEEEEEEEEEE")
        console.log(e)
        throw new Error(e)
    }
    // console.log("Swap tx: ", swapTx)
    const swapTxReceipt = await swapTx.wait()
    // console.log(swapTxReceipt)
    const tokenADataAfter = await getTokenContractData(tokenInContract, wallet.address)
    const tokenBDataAfter = await getTokenContractData(tokenOutContract, wallet.address)

    const tokenInBalanceChange = tokenAData.tokenBalance - tokenADataAfter.tokenBalance
    const tokenOutBalanceChange = tokenBDataAfter.tokenBalance - tokenBData.tokenBalance

    let swapData: SwapData = {
        swapTx: swapTx,
        calculatedAmountOut: calculatedAmountOut,
        dexAddress: dexAddress.toString(),
        tokenIn: tokenInContract,
        tokenInSymbol: tokenAData.symbol,
        tokenInBalanceBefore: tokenAData.tokenBalance,
        tokenInBalanceAfter: tokenADataAfter.tokenBalance,
        tokenOut: tokenOutContract,
        tokenOutSymbol: tokenBData.symbol,
        tokenOutBalanceBefore: tokenBData.tokenBalance,
        tokenOutBalanceAfter: tokenBDataAfter.tokenBalance,
        tokenInBalanceChange: tokenInBalanceChange,
        tokenOutBalanceChange: tokenOutBalanceChange,
        // swapTxReceipt: swapTxReceipt
    }
    return [swapData, swapTxReceipt]
}
async function testBatchSwap(tokenPath: string[], inputAmountNumber: number, slippage = 100){
    const provider = new ethers.JsonRpcProvider(localRpc)
    const wallet = new ethers.Wallet(test_account_pk, provider)
    const batchContract = await new ethers.Contract(batchContractAddress2, batchArtifact.abi, wallet)

    const firstTokenContract = new ethers.Contract(tokenPath[0], erc20Abi, wallet)
    const firstTokenDecimals = await firstTokenContract.decimals()
    let inputAmount = ethers.parseUnits(inputAmountNumber.toString(), firstTokenDecimals)

    let unwrapMovr = tokenPath[tokenPath.length - 1] == movrContractAddress
    console.log(`Unwrapping movr at the end: ${unwrapMovr}`)
    // Construct test parameters for swaps:
    // usdc -> movr -> frax
    // movr -> usdc -> frax
    let swapParams = [];
    for(let i = 0; i < tokenPath.length - 1; i++){
        let wrapMovrAmount = BigInt(0);
        if(i == 0 && tokenPath[i] == movrContractAddress){
            wrapMovrAmount = inputAmount;
        }
        const tokenIn = tokenPath[i]
        const tokenOut = tokenPath[i+1]
        if(i > 0){
            inputAmount = swapParams[i-1].calculatedAmountOut
        }
        const [dexAddress, calculatedAmountOut] = await getBestSwapRoute(tokenIn, tokenOut, inputAmount, localRpc)
        let swapParam = {
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            inputAmount: inputAmount,
            calculatedAmountOut: calculatedAmountOut,
            dexAddress: dexAddress,
            wrapMovrAmount: wrapMovrAmount
        }
        swapParams.push(swapParam)

        
        // console.log(`Token In: ${tokenIn} Token Out: ${tokenOut} Dex Address: ${dexAddress}`)
        let tokenInContract = new ethers.Contract(tokenIn, erc20Abi, wallet)
        const approved = await checkAndApproveToken(tokenIn, wallet, batchContractAddress2, inputAmount)
        const balance = await tokenInContract.balanceOf(wallet.address)
        console.log("Balance: ", balance.toString())
        console.log("Approved new tokens: ", approved)
        let allowance = await tokenInContract.allowance(wallet.address, batchContractAddress2)
        console.log("Allowance: ", allowance.toString())
    }
    let dexAddresses: string[] = [];
    let abiIndexes: bigint[] = [];
    let inputTokens: string[] = [];
    let outputTokens: string[] = [];
    let amount0Ins: bigint[] = [];
    let amount1Ins: bigint[] = [];
    let amount0Outs: bigint[] = [];
    let amount1Outs: bigint[] = [];
    let movrWrapAmounts: bigint[] = [];
    let data: string[] = [];
    swapParams.forEach((swapParam: any) => {
        let dexInfo = getDexInfo(swapParam.dexAddress)
        if(swapParam.tokenIn == dexInfo.token0){
            amount0Ins.push(swapParam.inputAmount)
            amount1Ins.push(BigInt(0))
            amount0Outs.push(BigInt(0))
            amount1Outs.push(swapParam.calculatedAmountOut)
        } else {
            amount0Ins.push(BigInt(0))
            amount1Ins.push(swapParam.inputAmount)
            amount0Outs.push(swapParam.calculatedAmountOut)
            amount1Outs.push(BigInt(0))
        }
        dexAddresses.push(swapParam.dexAddress)
        abiIndexes.push(BigInt(dexInfo.abiIndex))
        inputTokens.push(swapParam.tokenIn)
        outputTokens.push(swapParam.tokenOut)
        movrWrapAmounts.push(swapParam.wrapMovrAmount)
        data.push("0x")
    })

    // let batchContractAllowance = wm

    if(unwrapMovr){
        let unwrapAmount = swapParams[swapParams.length - 1].calculatedAmountOut;
        console.log(`Approving batch contract to spend ${unwrapAmount} wmovr`)
        await checkAndApproveToken(movrContractAddress, wallet, batchContractAddress2, unwrapAmount)
    }

    // let movrContract = new ethers.Contract(movrContractAddress, erc20Abi, wallet)

    const tokenContract = new ethers.Contract(movrContractAddress, erc20Abi, wallet)
    const allowance = await tokenContract.allowance(wallet.address, batchContractAddress2);
    console.log(`ALLOWANCE CHECK 2: Batch contract address: ${batchContractAddress2} -- Wallet address: ${wallet.address} -- Allowance: ${allowance}`)

    const outContract = new ethers.Contract(tokenPath[tokenPath.length - 1], erc20Abi, wallet)
    const balanceInBefore = await firstTokenContract.balanceOf(wallet.address)
    const balanceOutBefore = await outContract.balanceOf(wallet.address)
    console.log(`Balance In Before: ${balanceInBefore} Balance Out Before: ${balanceOutBefore}`)
    const wrapMovrAmount = swapParams[0].wrapMovrAmount
    console.log(`Parameters: Dex Addresses: ${dexAddresses} Abi Indexes: ${abiIndexes} Input Tokens: ${inputTokens} Output Tokens: ${outputTokens} Amount 0 Ins: ${amount0Ins} Amount 1 Ins: ${amount1Ins} Amount 0 Outs: ${amount0Outs} Amount 1 Outs: ${amount1Outs} Movr Wrap Amounts: ${movrWrapAmounts} Data: ${data} Wrap Movr Amount: ${wrapMovrAmount}`)
    const swapTx = await batchContract.executeSwaps(dexAddresses, abiIndexes, inputTokens, outputTokens, amount0Ins, amount1Ins, amount0Outs, amount1Outs, movrWrapAmounts, data, {value: wrapMovrAmount})
    await swapTx.wait()

    const balanceInAfter = await firstTokenContract.balanceOf(wallet.address)
    const balanceOutAfter = await outContract.balanceOf(wallet.address)
    console.log(`Balance In After: ${balanceInAfter} Balance Out After: ${balanceOutAfter}`)

}
async function testXcTokensMoonbase(){
    let rpc = "https://moonbase-alpha.public.blastapi.io"
    let provider = new ethers.JsonRpcProvider(localRpc)
    let wallet = new ethers.Wallet(test_account_pk, provider)

    let xcCsmAddress = "0xFFFFFFFF519811215e05efa24830eebe9c43acd7";

    // const tokenContract = new ethers.Contract("0xffFfFFFf519811215E05eFA24830Eebe9c43aCD7", erc20Abi, wallet)
    // const tokenContract = new ethers.Contract(xcCsmAddress.toLowerCase(), erc20Abi, wallet)
    // let symbol = await tokenContract.symbol()
    // console.log(symbol)
    let xcTokens = getXcTokens()
    let xcAlphaTokens = []
    for(const xcToken of xcTokens){
        try{
            const tokenContract = new ethers.Contract(xcToken.tokenData.contractAddress.toLowerCase(), erc20Abi, wallet)
            let symbol = await tokenContract.symbol()
            console.log(`${xcToken.tokenData.contractAddress}: ${symbol}: true`)
            let alphaToken = {
                contractAddress: xcToken.tokenData.contractAddress,
                localId: xcToken.tokenData.localId,
                symbol: xcToken.tokenData.symbol,
                alpha: true
            }
            xcAlphaTokens.push(alphaToken)
        } catch(e){
            console.log(`${xcToken.tokenData.contractAddress}: ${xcToken.tokenData.symbol}: false`)
            let alphaToken = {
                contractAddress: xcToken.tokenData.contractAddress,
                localId: xcToken.tokenData.localId,
                symbol: xcToken.tokenData.symbol,
                alpha: false
            }
            xcAlphaTokens.push(alphaToken)
        }

    }
    // fs.writeFileSync('./xcAlphaTokens.json', JSON.stringify(xcAlphaTokens, null, 2))
    // xcTokens.forEach(async (xcToken: any) => {

    // })
}
export async function getMovrSwapTx(swapInstructions: SwapInstruction[], chopsticks: boolean): Promise<BatchSwapParams>{
    let rpcProvider;
    // let testProvider = new ethers.JsonRpcProvider(localRpc)
    let wallet;
    let batchContractAddress;
    if(chopsticks){
        //Local testnet and test account
        rpcProvider = new ethers.JsonRpcProvider(localRpc)
        wallet = new ethers.Wallet(test_account_pk, rpcProvider)
        batchContractAddress = batchContractAddress2
    } else {
        //Live network and live wallet
        rpcProvider = new ethers.JsonRpcProvider(defaultRpc)
        wallet = new ethers.Wallet(live_wallet_3, rpcProvider)
        batchContractAddress = liveBatchContract
    }


    let movrContract = new ethers.Contract(movrContractAddress, erc20Abi, wallet)
    const batchContract = await new ethers.Contract(batchContractAddress, batchArtifact.abi, wallet)
    let tokenPathLocalId = [];
    let tokenPathAssetNodes: AssetNode[] = []
    let tokenPathAddresses = []
    let tokenPathAssetObjects = []
    swapInstructions.forEach((swapInstruction: SwapInstruction, index: number) => {
        if(index == 0){
            tokenPathLocalId.push(swapInstruction.assetInLocalId)
            tokenPathAssetNodes.push(swapInstruction.assetNodes[0])
            tokenPathAddresses.push(swapInstruction.assetNodes[0].assetRegistryObject.tokenData.contractAddress.toLowerCase())
            tokenPathAssetObjects.push(swapInstruction.assetNodes[0].assetRegistryObject)
        }
        tokenPathLocalId.push(swapInstruction.assetOutLocalId)
        tokenPathAssetNodes.push(swapInstruction.assetNodes[1])
        tokenPathAddresses.push(swapInstruction.assetNodes[1].assetRegistryObject.tokenData.contractAddress.toLowerCase())
        tokenPathAssetObjects.push(swapInstruction.assetNodes[1].assetRegistryObject)
    })

    let swapParams = [];
    for(let i = 0; i < tokenPathAddresses.length - 1; i++){
        let wrapMovrAmount = BigInt(0);
        const inputAmount = ethers.parseUnits(swapInstructions[i].assetInAmount.toString(), Number.parseInt(tokenPathAssetObjects[i].tokenData.decimals))
        const outputAmount = ethers.parseUnits(swapInstructions[i].assetOutTargetAmount.toString(), Number.parseInt(tokenPathAssetObjects[i+1].tokenData.decimals))

        // console.log("WRAP MOVR HERE:")
        // If first token is MOVR, check if we need to wrap first
        // console.log(`I is: ${i}, Token Path Address: ${tokenPathAddresses[i]}, Movr Contract Address: ${movrContractAddress}`)
        if(i == 0 && tokenPathAddresses[i].toString().toLowerCase() == movrContractAddress.toString().toLowerCase()){
            // console.log("WRAP MOVR CHECK")
            let wmovrBalance = await movrContract.balanceOf(wallet.address)
            let nativeMovrBalance = await wallet.provider.getBalance(wallet.address)
            if(wmovrBalance < inputAmount && nativeMovrBalance < inputAmount){
                throw new Error("Not enough movr or wmovr for input amount")
            } else if (wmovrBalance < inputAmount){
                wrapMovrAmount = inputAmount;
            }
        }
        // console.log(wrapMovrAmount)
        const tokenIn = tokenPathAddresses[i]
        const tokenOut = tokenPathAddresses[i+1]
        // console.log("Token In: ", tokenIn)
        // console.log("Token Out: ", tokenOut)
        // Get dex offering the best price for the swap, but dont use given calculate output yet
        console.log("GETTING BEST SWAP ROUTE")
        let [dexAddress, sampleOutput] = await getBestSwapRoute(tokenIn, tokenOut, inputAmount, defaultRpc)
        if(sampleOutput == 0 || dexAddress == ""){
            throw new Error("No swap route found")
        }

        let swapParam = {
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            inputAmount: inputAmount,
            calculatedAmountOut: outputAmount,
            dexAddress: dexAddress,
            wrapMovrAmount: wrapMovrAmount
        }
        swapParams.push(swapParam)
    }

    let dexAddresses: string[] = [];
    let abiIndexes: bigint[] = [];
    let inputTokens: string[] = [];
    let outputTokens: string[] = [];
    let amount0Ins: bigint[] = [];
    let amount1Ins: bigint[] = [];
    let amount0Outs: bigint[] = [];
    let amount1Outs: bigint[] = [];
    let movrWrapAmounts: bigint[] = [];
    let data: string[] = [];
    swapParams.forEach((swapParam: any) => {
        let dexInfo = getDexInfo(swapParam.dexAddress)
        // console.log("TOKEN IN: ", swapParam.tokenIn)
        // console.log("TOKEN OUT:", swapParam.tokenOut)
        // console.log("DEX TOKEN 0:", dexInfo.token0)
        // console.log("DEX TOKEN 1: ", dexInfo.token1)
        if(swapParam.tokenIn.toLowerCase() == dexInfo.token0.toLowerCase()){
            amount0Ins.push(swapParam.inputAmount)
            amount1Ins.push(BigInt(0))
            amount0Outs.push(BigInt(0))
            amount1Outs.push(swapParam.calculatedAmountOut)
        } else {
            amount0Ins.push(BigInt(0))
            amount1Ins.push(swapParam.inputAmount)
            amount0Outs.push(swapParam.calculatedAmountOut)
            amount1Outs.push(BigInt(0))
        }
        dexAddresses.push(swapParam.dexAddress)
        abiIndexes.push(BigInt(dexInfo.abiIndex))
        inputTokens.push(swapParam.tokenIn)
        outputTokens.push(swapParam.tokenOut)
        movrWrapAmounts.push(swapParam.wrapMovrAmount)
        data.push("0x")
    })


    let batchSwapParams: BatchSwapParams = {
        chainId: 2023,
        batchContract: batchContract,
        wallet: wallet,
        dexAddresses: dexAddresses,
        abiIndexes: abiIndexes,
        inputTokens: inputTokens,
        outputTokens: outputTokens,
        amount0Ins: amount0Ins,
        amount1Ins: amount1Ins,
        amount0Outs: amount0Outs,
        amount1Outs: amount1Outs,
        movrWrapAmounts: movrWrapAmounts,
        data: data,
        // reverseSwapParams: reverseSwapParams,
    }
    return batchSwapParams
    // console.log(`Parameters: Dex Addresses: ${dexAddresses} Abi Indexes: ${abiIndexes} Input Tokens: ${inputTokens} Output Tokens: ${outputTokens} Amount 0 Ins: ${amount0Ins} Amount 1 Ins: ${amount1Ins} Amount 0 Outs: ${amount0Outs} Amount 1 Outs: ${amount1Outs} Movr Wrap Amounts: ${movrWrapAmounts} Data: ${data} Wrap Movr Amount: ${wrapMovrAmount}`)
    // const swapTx = await batchContract.executeSwaps(dexAddresses, abiIndexes, inputTokens, outputTokens, amount0Ins, amount1Ins, amount0Outs, amount1Outs, movrWrapAmounts, data, {value: wrapMovrAmount})
    // let swapReceipt = await swapTx.wait()
    // logLiveWalletTransaction(swapReceipt, "Execute Swaps")
}
export async function formatMovrTx(movrBatchSwapParams: BatchSwapParams, swapInstructions: SwapInstruction[], chainNonces: ChainNonces, extrinsicIndex: IndexObject, instructionIndex: number[], chopsticks: boolean) {
    let liveWallet = movrBatchSwapParams.wallet;
    let batchContract = movrBatchSwapParams.batchContract;
    let api = await getApiForNode("Moonriver", chopsticks)

    let batchContractAddress = await batchContract.getAddress()
    console.log(`Wallet: ${liveWallet.address} | Batch Contract: ${batchContractAddress}`)
    let tokens = movrBatchSwapParams.inputTokens

    // //WHEN we execute the tx, we need to approve batch contract to spend tokens first
    for(let i = 0; i < tokens.length; i++){
        console.log("Token number ", i)
        console.log("Token: ", tokens[i])
        let tokenInput = movrBatchSwapParams.amount0Ins[i] > 0 ? movrBatchSwapParams.amount0Ins[i] : movrBatchSwapParams.amount1Ins[i]
        let approval = await checkAndApproveToken(tokens[i], liveWallet, batchContractAddress, tokenInput)
    }
    let wrapMovrAmount = movrBatchSwapParams.movrWrapAmounts[0]

    let tokenOutput = movrBatchSwapParams.outputTokens[movrBatchSwapParams.outputTokens.length - 1]
    

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

    // If movr out, make sure approve to unwrap
    if(destAsset == "MOVR"){
        console.log("APPROVING UNWRAP MOVR AMOUNT")
        let unwrapMovrAmount = movrBatchSwapParams.amount0Outs[movrBatchSwapParams.amount0Outs.length - 1] > 0 ? movrBatchSwapParams.amount0Outs[movrBatchSwapParams.amount0Outs.length - 1] : movrBatchSwapParams.amount1Outs[movrBatchSwapParams.amount1Outs.length - 1]
        let approval = await checkAndApproveToken(movrContractAddress, liveWallet, batchContractAddress, unwrapMovrAmount)
    }

    let firstAssetNode = swapInstructions[0].assetNodes[0]
    let assetNodes = [firstAssetNode]
    swapInstructions.forEach((swapInstruction: SwapInstruction) => {
        assetNodes.push(swapInstruction.assetNodes[1])
    })
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
        // pathInLocalId: pathStartLocalId,
        // pathOutLocalId: pathDestLocalId,
        pathSwapType: swapType,
        pathAmount: amountIn,
        // reverseTx: reverseMovrBatchSwapParams,
        api: api,
        movrBatchSwapParams: movrBatchSwapParams
    }
    increaseIndex(extrinsicIndex)
    return swapTxContainer
}
async function buildReverseSwapParams(swapParams: BatchSwapParams){

}
export async function testXcTokensMoonriver(tokenPath: string[], inputAmountNumber: number, slippage = 50){
    console.log("INITIALIZING API")
    let rpc = defaultRpc
    let liveProvider = new ethers.JsonRpcProvider(rpc)
    // let testProvider = new ethers.JsonRpcProvider(localRpc)
    // let testWallet = new ethers.Wallet(test_account_pk, testProvider)
    let liveWallet = new ethers.Wallet(liveWallet3Pk, liveProvider)

    let movrContract = new ethers.Contract(movrContractAddress, erc20Abi, liveWallet)
    let ksmContract = new ethers.Contract(xcKsmContractAddress, erc20Abi, liveWallet)
    let fraxContract = new ethers.Contract(fraxContractAddress, erc20Abi, liveWallet)
    console.log("INITIALIZING BATCH CONTRACT")
    const batchContract = await new ethers.Contract(liveBatchContract, batchArtifact.abi, liveWallet)

// -----------------------------------------------------------------------------
    // EXECUTE SWAP PARAMS
    // let dexAddresses: string[] = [bestDex.toString()]
    // let abiIndexes: bigint[] = [BigInt(dexInfo.abiIndex)]
    // let inputTokens: string[] = [movrContractAddress]
    // let outputTokens: string[] = [xcKsmContractAddress]
    // let amount0Ins: bigint[] = [inputMovrAmount]
    // let amount1Ins: bigint[] = [BigInt(0)]
    // let amount0Outs: bigint[] = [BigInt(0)]
    // let amount1Outs: bigint[] = [calculatedOut]
    // let movrWrapAmounts: bigint[] = [BigInt(0)]
    // let data: string[] = ["0x"]


    const firstTokenContract = new ethers.Contract(tokenPath[0], erc20Abi, liveWallet)
    const firstTokenDecimals = await firstTokenContract.decimals()

    // If token to swap is movr, take input
    // if(tokenPath[0] == movrContractAddress){

    // } else {

    // }
    let inputAmount = ethers.parseUnits(inputAmountNumber.toString(), firstTokenDecimals)
    // Construct test parameters for swaps:
    // usdc -> movr -> frax
    // movr -> usdc -> frax
    let swapParams = [];
    for(let i = 0; i < tokenPath.length - 1; i++){
        let wrapMovrAmount = BigInt(0);

        // If first token is MOVR, check if we need to wrap first
        if(i == 0 && tokenPath[i] == movrContractAddress){
            let wmovrBalance = await movrContract.balanceOf(liveWallet.address)
            let nativeMovrBalance = await liveWallet.provider.getBalance(liveWallet.address)
            if(wmovrBalance < inputAmount && nativeMovrBalance < inputAmount){
                throw new Error("Not enough movr or wmovr for input amount")
            } else if (wmovrBalance < inputAmount){
                wrapMovrAmount = inputAmount;
            }
        }
        const tokenIn = tokenPath[i]
        const tokenOut = tokenPath[i+1]

        // If not first token swap, use output amount from previous swap as input amount
        if(i > 0){
            inputAmount = swapParams[i-1].calculatedAmountOut
        }

        // Get dex offering the best price for the swap, but dont use given calculate output yet
        let [dexAddress, sampleOutput] = await getBestSwapRoute(tokenIn, tokenOut, inputAmount, rpc)
        if(sampleOutput == 0 || dexAddress == ""){
            throw new Error("No swap route found")
        }

        let dexInfo = getDexInfo(dexAddress.toString())
        let dexContract = new ethers.Contract(dexAddress.toString(), dexAbis[dexInfo.abiIndex], liveWallet)

        // Get reserves for dex
        let [reserves0, reserves1, timestamp] = await dexContract.getReserves()
        let inputReserves = tokenIn == dexInfo.token0 ? reserves0 : reserves1
        let outputReserves = tokenIn == dexInfo.token0 ? reserves1 : reserves0

        // Use low levels of slippage as possible
        let calculatedAmountOut = calculateSwapAmountRouterFormula(inputAmount, inputReserves, outputReserves, slippage, 25)

        let swapParam = {
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            inputAmount: inputAmount,
            calculatedAmountOut: calculatedAmountOut,
            dexAddress: dexAddress,
            wrapMovrAmount: wrapMovrAmount
        }
        swapParams.push(swapParam)
        console.log(`Token In: ${tokenIn} Token Out: ${tokenOut} Dex Address: ${dexAddress}`)
        let tokenInContract = new ethers.Contract(tokenIn, erc20Abi, liveWallet)

        // check and approve returns receipt or false
        const approvedReceipt = await checkAndApproveToken(tokenIn, liveWallet, liveBatchContract, inputAmount)
        if(approvedReceipt){
            logLiveWalletTransaction(approvedReceipt, "Approve Token")
        }
        

        const balance = await tokenInContract.balanceOf(liveWallet.address)
        console.log("Balance: ", balance.toString())
        // console.log("Approved new tokens: ", approved)
        let allowance = await tokenInContract.allowance(liveWallet.address, liveBatchContract)
        console.log("Allowance: ", allowance.toString())
    }
    let dexAddresses: string[] = [];
    let abiIndexes: bigint[] = [];
    let inputTokens: string[] = [];
    let outputTokens: string[] = [];
    let amount0Ins: bigint[] = [];
    let amount1Ins: bigint[] = [];
    let amount0Outs: bigint[] = [];
    let amount1Outs: bigint[] = [];
    let movrWrapAmounts: bigint[] = [];
    let data: string[] = [];
    swapParams.forEach((swapParam: any) => {
        let dexInfo = getDexInfo(swapParam.dexAddress)
        if(swapParam.tokenIn == dexInfo.token0){
            amount0Ins.push(swapParam.inputAmount)
            amount1Ins.push(BigInt(0))
            amount0Outs.push(BigInt(0))
            amount1Outs.push(swapParam.calculatedAmountOut)
        } else {
            amount0Ins.push(BigInt(0))
            amount1Ins.push(swapParam.inputAmount)
            amount0Outs.push(swapParam.calculatedAmountOut)
            amount1Outs.push(BigInt(0))
        }
        dexAddresses.push(swapParam.dexAddress)
        abiIndexes.push(BigInt(dexInfo.abiIndex))
        inputTokens.push(swapParam.tokenIn)
        outputTokens.push(swapParam.tokenOut)
        movrWrapAmounts.push(swapParam.wrapMovrAmount)
        data.push("0x")
    })
    const outContract = new ethers.Contract(tokenPath[tokenPath.length - 1], erc20Abi, liveWallet)
    const balanceInBefore = await firstTokenContract.balanceOf(liveWallet.address)
    const balanceOutBefore = await outContract.balanceOf(liveWallet.address)
    console.log(`Balance In Before: ${balanceInBefore} Balance Out Before: ${balanceOutBefore}`)

    const wrapMovrAmount = swapParams[0].wrapMovrAmount
    console.log(`Parameters: Dex Addresses: ${dexAddresses} Abi Indexes: ${abiIndexes} Input Tokens: ${inputTokens} Output Tokens: ${outputTokens} Amount 0 Ins: ${amount0Ins} Amount 1 Ins: ${amount1Ins} Amount 0 Outs: ${amount0Outs} Amount 1 Outs: ${amount1Outs} Movr Wrap Amounts: ${movrWrapAmounts} Data: ${data} Wrap Movr Amount: ${wrapMovrAmount}`)
    const swapTx = await batchContract.executeSwaps(dexAddresses, abiIndexes, inputTokens, outputTokens, amount0Ins, amount1Ins, amount0Outs, amount1Outs, movrWrapAmounts, data, {value: wrapMovrAmount})
    let swapReceipt = await swapTx.wait()
    logLiveWalletTransaction(swapReceipt, "Execute Swaps")

    const balanceInAfter = await firstTokenContract.balanceOf(liveWallet.address)
    const balanceOutAfter = await outContract.balanceOf(liveWallet.address)
    console.log(`Balance In After: ${balanceInAfter} Balance Out After: ${balanceOutAfter}`)

    // let fraxBalanceAfter = await fraxContract.balanceOf(testWallet.address)
    // let movrBalanceAfter = await movrContract.balanceOf(testWallet.address)
    // console.log(`FRAX Balance After: ${fraxBalanceAfter} MOVR Balance After: ${movrBalanceAfter}`)

    // const fraxOutputActual = fraxBalanceAfter - fraxBalanceBefore
    // console.log(`FRAX Output Actual: ${fraxOutputActual} FRAX Output Expected: ${calculatedOut}`)

    
    // let test = liveWallet2Pk
    // console.log("TEST: ", test)
    // let xcTokens = getXcTokens()
    // let xcAlphaTokens = []
    // for(const xcToken of xcTokens){
    //     try{
    //         const tokenContract = new ethers.Contract(xcToken.tokenData.contractAddress.toLowerCase(), erc20Abi, wallet)
    //         let symbol = await tokenContract.symbol()
    //         console.log(`${xcToken.tokenData.contractAddress}: ${symbol}: true`)
    //         let alphaToken = {
    //             contractAddress: xcToken.tokenData.contractAddress,
    //             localId: xcToken.tokenData.localId,
    //             symbol: xcToken.tokenData.symbol,
    //             alpha: true
    //         }
    //         xcAlphaTokens.push(alphaToken)
    //     } catch(e){
    //         console.log(`${xcToken.tokenData.contractAddress}: ${xcToken.tokenData.symbol}: false`)
    //         let alphaToken = {
    //             contractAddress: xcToken.tokenData.contractAddress,
    //             localId: xcToken.tokenData.localId,
    //             symbol: xcToken.tokenData.symbol,
    //             alpha: false
    //         }
    //         xcAlphaTokens.push(alphaToken)
    //     }
    // }
}
async function cleanXcTokenAddresses(){
    // let dexes = JSON.parse(fs.readFileSync('./dexInfo.json', 'utf8'));
    let xcTokens = getXcTokens()
    console.log(xcTokens)

    let contracts = xcTokens.map((asset) => asset.tokenData.contractAddress)
    console.log(contracts)

    let provider = new ethers.JsonRpcProvider(defaultRpc)
    let ksmContract = new ethers.Contract(xcKsmContractAddress, erc20Abi, provider)
    let address = await ksmContract.getAddress()
    console.log(address)
    contracts.forEach(async (contract) => {
        let tokenContract = new ethers.Contract(contract.toLowerCase(), erc20Abi, provider)
        let symbol = await tokenContract.symbol()
        console.log(symbol)

        let address = await tokenContract.getAddress()
        console.log(contract)
        console.log(address)
    })

}
function getXcTokens(){
    const allAssets = JSON.parse(fs.readFileSync(path.join(__dirname, './allAssets.json'), 'utf8'));
    let xcAssets = allAssets.filter((asset: any) => asset.tokenData.chain == "2023" && asset.tokenData.symbol.toLowerCase().includes("xc"))
    return xcAssets
}
async function getAllAbis(){
    // const provider = new ethers.JsonRpcProvider(defaultRpc)
    const provider = new ethers.JsonRpcProvider(localRpc)
    const wallet = new ethers.Wallet(test_account_pk, provider)

    let lps = JSON.parse(fs.readFileSync('./lpsCleaned.json', 'utf8'));
    let dexInfos = []
    for(const lp of lps){
        console.log(`${lp.contractAddress}`)
        try{
            const contract = new ethers.Contract(lp.contractAddress, dexAbis[0], wallet)
            const token0 = await contract.token0()
            const token1 = await contract.token1()
            const abiIndex = 0;
            // const token0Contract = new ethers.Contract(token0, erc20Abi, wallet)
            // const token1Contract = new ethers.Contract(token1, erc20Abi, wallet)
            // const symbol0 = await token0Contract.symbol()
            // const symbol1 = await token1Contract.symbol()
            const [reserves0, reserves1, timestamp] = await contract.getReserves()
            console.log(`Dex: ${lp.contractAddress} Token0: ${token0} Token1: ${token1}  Reserves0: ${reserves0} Reserves1: ${reserves1} Timestamp: ${timestamp}`)
            let dexInfo = {
                contractAddress: lp.contractAddress,
                token0: token0,
                token1: token1,
                abiIndex: abiIndex,
                // symbol0: symbol0,
                // symbol1: symbol1,
            }
            dexInfos.push(dexInfo)
        } catch (e){
            const contract = new ethers.Contract(lp.contractAddress, dexAbis[1], wallet)
            const token0 = await contract.token0()
            const token1 = await contract.token1()
            const abiIndex = 1;
            // const token0Contract = new ethers.Contract(token0, erc20Abi, wallet)
            // const token1Contract = new ethers.Contract(token1, erc20Abi, wallet)
            // const symbol0 = await token0Contract.symbol()
            // const symbol1 = await token1Contract.symbol()
            const [reserves0, reserves1, timestamp] = await contract.getReserves()
            console.log(`Dex: ${lp.contractAddress} Token0: ${token0} Token1: ${token1}  Reserves0: ${reserves0} Reserves1: ${reserves1} Timestamp: ${timestamp}`)
            let dexInfo = {
                contractAddress: lp.contractAddress,
                token0: token0,
                token1: token1,
                abiIndex: abiIndex,
                // symbol0: symbol0,
                // symbol1: symbol1,
            }
            dexInfos.push(dexInfo)
        }
        
    }

    fs.writeFileSync('./dexInfoUpdated.json', JSON.stringify(dexInfos, null, 2))

    let oldDexInfo = JSON.parse(fs.readFileSync('./dexInfo.json', 'utf8'));
    
    dexInfos.forEach((dexInfo: any) => {
        let oldDex = oldDexInfo.find((oldDex: any) => oldDex.contractAddress == dexInfo.contractAddress)
        if(!oldDex){
            oldDexInfo.push(dexInfo)
        }
    })

    fs.writeFileSync('./dexInfoCombined.json', JSON.stringify(oldDexInfo, null, 2))
    // lps.forEach((lp: any) => {
    //     console.log(`${lp.contractAddress}`)
    //     const contract = new ethers.Contract(lp.contractAddress, dexAbis[0], wallet)
    //     const token0 = await contract.token0()
    //     const token1 = await contract.token1()
    //     const [reserves0, reserves1, timestamp] = await contract.getReserves()
    //     console.log(`Dex: ${lp.contractAddress} Token0: ${token0} Token1: ${token1} Reserves0: ${reserves0} Reserves1: ${reserves1} Timestamp: ${timestamp}`)
    // })
}
async function readDexes(){
    const dexInfos = JSON.parse(fs.readFileSync('./dexInfo.json', 'utf8'));
    const dexInfosUpdated = JSON.parse(fs.readFileSync('./dexInfoUpdated.json', 'utf8'));
    const provider = new ethers.JsonRpcProvider(localRpc)
    const wallet = new ethers.Wallet(test_account_pk, provider)

    dexInfos.forEach((dexInfo: any) => {
        let matches = 0
        let match;
        dexInfosUpdated.forEach((dexInfoUpdated: any) => {
            if(dexInfo.contractAddress == dexInfoUpdated.contractAddress){
                if(dexInfo.abiIndex != dexInfoUpdated.abiIndex){
                    console.log("ABI index mismatch: ", dexInfo.contractAddress)
                }
                matches++
            }
        })
        if(matches == 0){
            console.log("Dex not found: ", dexInfo.contractAddress)
        } else if (matches > 1){
            console.log("Multiple dexes found: ", dexInfo.contractAddress)
        }
    })

}
async function testBatchUnwrap(){

    let provider = new ethers.JsonRpcProvider(localRpc)
    let wallet = new ethers.Wallet(test_account_pk, provider)

    let movrContract = new ethers.Contract(movrContractAddress, erc20Abi, wallet)
    let usdcContract = new ethers.Contract(usdcContractAddress, erc20Abi, wallet)
    
    let movrBalance = await wallet.provider.getBalance(wallet.address)
    let wrappedBalance = await movrContract.balanceOf(wallet.address)

    // console.log(`MOVR Balance: ${movrBalance} Wrapped Balance: ${wrappedBalance}`)

    let wrapAmount = ethers.parseUnits("10", 18);

    let tokenPath = [ usdcContractAddress, movrContractAddress,]
    // await wrapMovr(wallet, wrapAmount)
    
    movrBalance = await wallet.provider.getBalance(wallet.address)
    wrappedBalance = await movrContract.balanceOf(wallet.address)
    let usdcBalance = await usdcContract.balanceOf(wallet.address)
    console.log(`MOVR Balance: ${movrBalance} Wrapped Balance: ${wrappedBalance} USDC Balance: ${usdcBalance}`)

    // let swapAmount = ethers.parseUnits("1", 18);
    await testBatchSwap(tokenPath, 10)

    movrBalance = await wallet.provider.getBalance(wallet.address)
    wrappedBalance = await movrContract.balanceOf(wallet.address)
    usdcBalance = await usdcContract.balanceOf(wallet.address)
    console.log(`MOVR Balance: ${movrBalance} Wrapped Balance: ${wrappedBalance} USDC Balance: ${usdcBalance}`)
}

async function run(){
    // writeDexInfo()
    // const inputTokens = [usdcContractAddress, movrContractAddress, fraxContractAddress, usdcContractAddress]
    // const inputAmount = 100
    // testBatchSwap(inputTokens, inputAmount)
    // getXcTokens()
    // testXcTokensMoonbase()
    // cleanXcTokenAddresses()
    let tokenPath = [xcKarContractAddress, movrContractAddress, xcXrtContractAddress ]
    testXcTokensMoonriver(tokenPath, 0.3, 50)
    // getAllAbis()
    // readDexes()
    // testBatchUnwrap()
}
// 8045943121732945468
// 24124090793978129408
// run()