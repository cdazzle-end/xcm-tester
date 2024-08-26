import '@moonbeam-network/api-augment/moonriver';
import { algebraFactoryContract, algebraPoolDeployer, algebraPoolInitHash, batchArtifact, batchContractAddress2, defaultRpc, dexAbiMap, dexAbis, glmrLpsPath, localRpc, solarFee, swapManagerContractLive, swapManagerContractLocal, test_account, test_account_pk, uniFactoryContract, uniPoolInitHash, usdcContractAddress, wGlmrContractAddress } from './utils/const.ts';
import { approveMax, calculateAlgebraSwap, calculateSwapAmountRouterFormula, checkAndApproveToken, getContractAbiIndex, getGlmrPoolData, getTokenContractData, isV3Pool, wrapGlmr } from './utils/utils.ts';
// import * as mutex from 'mutexify'
// import { ApiPromise, Keyring, WsProvider } from '@polkadot/api';
// import { MangataInstance, Mangata, MultiswapBuyAsset, MultiswapSellAsset } from "@mangata-finance/sdk"
// import { BN } from '@polkadot/util';
import { ethers, getAddress } from 'ethers';
import * as fs from 'fs';
import path from 'path';
import { erc20Abi } from 'viem';
// import { contract } from 'web3/lib/commonjs/eth.exports';
// import BN from 'bn.js';
import { FixedPointNumber } from '@acala-network/sdk-core';
import { concat } from '@ethersproject/bytes';
import { keccak256 as epKeccak } from '@ethersproject/solidity';
import { Token } from '@uniswap/sdk-core';
import { TickMath } from '@uniswap/v3-sdk';
import { dataSlice } from 'ethers';
import { fileURLToPath } from 'url';
import { live_wallet_3 } from '../../config/index.ts';
import { IndexObject, MyAssetRegistryObject, PathType, SwapExtrinsicContainer, SwapInstruction } from '../../types/types.ts';
import { getApiForNode } from '../../utils/index.ts';
import { ManagerSwapParams, SwapData, SwapSingleParams } from './utils/types.ts';
import { getAssetRegistry } from './../../utils/index.ts'
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// console.log(__dirname)
// Patch BigInt for JSON serialization
declare global {
    interface BigInt {
        toJSON(): string;
    }
}

BigInt.prototype.toJSON = function() {
    return this.toString();
};
const allAssets: MyAssetRegistryObject[] = getAssetRegistry('polkadot')
const routerFees = [
    solarFee,
    // zenFee
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
    glmrWrapAmount: bigint
    
}

interface DexInfo {
    contractAddress: string,
    token0: string,
    token1: string,
    abiIndex: number
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
        // REVIEW Glmr evm eccxecution error types
    } catch (e: any) {
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
// async function testBatchSwap(tokenPath: string[], inputAmountNumber: number, slippage = 100){
//     console.log("TestBatchSwap")
//     const provider = new ethers.JsonRpcProvider(localRpc)
//     const wallet = new ethers.Wallet(test_account_pk, provider)
//     const batchContract = await new ethers.Contract(batchContractAddress2, batchArtifact.abi, wallet)

//     const firstTokenContract = new ethers.Contract(tokenPath[0], erc20Abi, wallet)
//     const firstTokenDecimals = await firstTokenContract.decimals()
//     let inputAmount = ethers.parseUnits(inputAmountNumber.toString(), firstTokenDecimals)

//     let unwrapMovr = tokenPath[tokenPath.length - 1] == wGlmrContractAddress
//     console.log(`Unwrapping movr at the end: ${unwrapMovr}`)
//     // Construct test parameters for swaps:
//     // usdc -> movr -> frax
//     // movr -> usdc -> frax
//     let swapParams = [];
//     for(let i = 0; i < tokenPath.length - 1; i++){
//         let wrapMovrAmount = BigInt(0);
//         if(i == 0 && tokenPath[i] == wGlmrContractAddress){
//             wrapMovrAmount = inputAmount;
//         }
//         const tokenIn = tokenPath[i]
//         const tokenOut = tokenPath[i+1]
//         if(i > 0){
//             inputAmount = swapParams[i-1].calculatedAmountOut
//         }
//         const [dexAddress, calculatedAmountOut] = await getBestSwapRoute(tokenIn, tokenOut, inputAmount, localRpc)
//         let swapParam = {
//             tokenIn: tokenIn,
//             tokenOut: tokenOut,
//             inputAmount: inputAmount,
//             calculatedAmountOut: calculatedAmountOut,
//             dexAddress: dexAddress,
//             wrapMovrAmount: wrapMovrAmount
//         }
//         swapParams.push(swapParam)

        
//         // console.log(`Token In: ${tokenIn} Token Out: ${tokenOut} Dex Address: ${dexAddress}`)
//         let tokenInContract = new ethers.Contract(tokenIn, erc20Abi, wallet)
//         const approved = await checkAndApproveToken(tokenIn, wallet, batchContractAddress2, inputAmount)
//         const balance = await tokenInContract.balanceOf(wallet.address)
//         console.log("Balance: ", balance.toString())
//         console.log("Approved new tokens: ", approved)
//         let allowance = await tokenInContract.allowance(wallet.address, batchContractAddress2)
//         console.log("Allowance: ", allowance.toString())
//     }
//     let dexAddresses: string[] = [];
//     let abiIndexes: bigint[] = [];
//     let inputTokens: string[] = [];
//     let outputTokens: string[] = [];
//     let amount0Ins: bigint[] = [];
//     let amount1Ins: bigint[] = [];
//     let amount0Outs: bigint[] = [];
//     let amount1Outs: bigint[] = [];
//     let movrWrapAmounts: bigint[] = [];
//     let data: string[] = [];
//     swapParams.forEach((swapParam: any) => {
//         let dexInfo = getDexInfo(swapParam.dexAddress)
//         if(swapParam.tokenIn == dexInfo.token0){
//             amount0Ins.push(swapParam.inputAmount)
//             amount1Ins.push(BigInt(0))
//             amount0Outs.push(BigInt(0))
//             amount1Outs.push(swapParam.calculatedAmountOut)
//         } else {
//             amount0Ins.push(BigInt(0))
//             amount1Ins.push(swapParam.inputAmount)
//             amount0Outs.push(swapParam.calculatedAmountOut)
//             amount1Outs.push(BigInt(0))
//         }
//         dexAddresses.push(swapParam.dexAddress)
//         abiIndexes.push(BigInt(dexInfo.abiIndex))
//         inputTokens.push(swapParam.tokenIn)
//         outputTokens.push(swapParam.tokenOut)
//         movrWrapAmounts.push(swapParam.wrapMovrAmount)
//         data.push("0x")
//     })

//     // let batchContractAllowance = wm

//     if(unwrapMovr){
//         let unwrapAmount = swapParams[swapParams.length - 1].calculatedAmountOut;
//         console.log(`Approving batch contract to spend ${unwrapAmount} wmovr`)
//         await checkAndApproveToken(wGlmrContractAddress, wallet, batchContractAddress2, unwrapAmount)
//     }

//     // let movrContract = new ethers.Contract(movrContractAddress, erc20Abi, wallet)

//     const tokenContract = new ethers.Contract(wGlmrContractAddress, erc20Abi, wallet)
//     const allowance = await tokenContract.allowance(wallet.address, batchContractAddress2);
//     console.log(`ALLOWANCE CHECK 2: Batch contract address: ${batchContractAddress2} -- Wallet address: ${wallet.address} -- Allowance: ${allowance}`)

//     const outContract = new ethers.Contract(tokenPath[tokenPath.length - 1], erc20Abi, wallet)
//     const balanceInBefore = await firstTokenContract.balanceOf(wallet.address)
//     const balanceOutBefore = await outContract.balanceOf(wallet.address)
//     console.log(`Balance In Before: ${balanceInBefore} Balance Out Before: ${balanceOutBefore}`)
//     const wrapMovrAmount = swapParams[0].wrapMovrAmount
//     console.log(`Parameters: Dex Addresses: ${dexAddresses} Abi Indexes: ${abiIndexes} Input Tokens: ${inputTokens} Output Tokens: ${outputTokens} Amount 0 Ins: ${amount0Ins} Amount 1 Ins: ${amount1Ins} Amount 0 Outs: ${amount0Outs} Amount 1 Outs: ${amount1Outs} Movr Wrap Amounts: ${movrWrapAmounts} Data: ${data} Wrap Movr Amount: ${wrapMovrAmount}`)
//     const swapTx = await batchContract.executeSwaps(dexAddresses, abiIndexes, inputTokens, outputTokens, amount0Ins, amount1Ins, amount0Outs, amount1Outs, movrWrapAmounts, data, {value: wrapMovrAmount})
//     await swapTx.wait()

//     const balanceInAfter = await firstTokenContract.balanceOf(wallet.address)
//     const balanceOutAfter = await outContract.balanceOf(wallet.address)
//     console.log(`Balance In After: ${balanceInAfter} Balance Out After: ${balanceOutAfter}`)

// }
// async function testXcTokensMoonbase(){
//     let rpc = "https://moonbase-alpha.public.blastapi.io"
//     let provider = new ethers.JsonRpcProvider(localRpc)
//     let wallet = new ethers.Wallet(test_account_pk, provider)

//     let xcCsmAddress = "0xFFFFFFFF519811215e05efa24830eebe9c43acd7";

//     // const tokenContract = new ethers.Contract("0xffFfFFFf519811215E05eFA24830Eebe9c43aCD7", erc20Abi, wallet)
//     // const tokenContract = new ethers.Contract(xcCsmAddress.toLowerCase(), erc20Abi, wallet)
//     // let symbol = await tokenContract.symbol()
//     // console.log(symbol)
//     let xcTokens = getXcTokens()
//     let xcAlphaTokens = []
//     for(const xcToken of xcTokens){
//         try{
//             const tokenContract = new ethers.Contract(xcToken.tokenData.contractAddress.toLowerCase(), erc20Abi, wallet)
//             let symbol = await tokenContract.symbol()
//             console.log(`${xcToken.tokenData.contractAddress}: ${symbol}: true`)
//             let alphaToken = {
//                 contractAddress: xcToken.tokenData.contractAddress,
//                 localId: xcToken.tokenData.localId,
//                 symbol: xcToken.tokenData.symbol,
//                 alpha: true
//             }
//             xcAlphaTokens.push(alphaToken)
//         } catch(e){
//             console.log(`${xcToken.tokenData.contractAddress}: ${xcToken.tokenData.symbol}: false`)
//             let alphaToken = {
//                 contractAddress: xcToken.tokenData.contractAddress,
//                 localId: xcToken.tokenData.localId,
//                 symbol: xcToken.tokenData.symbol,
//                 alpha: false
//             }
//             xcAlphaTokens.push(alphaToken)
//         }

//     }
//     // fs.writeFileSync('./xcAlphaTokens.json', JSON.stringify(xcAlphaTokens, null, 2))
//     // xcTokens.forEach(async (xcToken: any) => {

//     // })
// }



// async function cleanXcTokenAddresses(){
//     // let dexes = JSON.parse(fs.readFileSync('./dexInfo.json', 'utf8'));
//     let xcTokens = getXcTokens()
//     console.log(xcTokens)

//     let contracts = xcTokens.map((asset) => asset.tokenData.contractAddress)
//     console.log(contracts)

//     let provider = new ethers.JsonRpcProvider(defaultRpc)
//     let ksmContract = new ethers.Contract(xcDotContractAddress, erc20Abi, provider)
//     let address = await ksmContract.getAddress()
//     console.log(address)
//     contracts.forEach(async (contract) => {
//         let tokenContract = new ethers.Contract(contract.toLowerCase(), erc20Abi, provider)
//         let symbol = await tokenContract.symbol()
//         console.log(symbol)

//         let address = await tokenContract.getAddress()
//         console.log(contract)
//         console.log(address)
//     })

// }

// async function getAllAbis(){
//     // const provider = new ethers.JsonRpcProvider(defaultRpc)
//     const provider = new ethers.JsonRpcProvider(localRpc)
//     const wallet = new ethers.Wallet(test_account_pk, provider)

//     let lps = JSON.parse(fs.readFileSync('./lpsCleaned.json', 'utf8'));
//     let dexInfos = []
//     for(const lp of lps){
//         console.log(`${lp.contractAddress}`)
//         try{
//             const contract = new ethers.Contract(lp.contractAddress, dexAbis[0], wallet)
//             const token0 = await contract.token0()
//             const token1 = await contract.token1()
//             const abiIndex = 0;
//             // const token0Contract = new ethers.Contract(token0, erc20Abi, wallet)
//             // const token1Contract = new ethers.Contract(token1, erc20Abi, wallet)
//             // const symbol0 = await token0Contract.symbol()
//             // const symbol1 = await token1Contract.symbol()
//             const [reserves0, reserves1, timestamp] = await contract.getReserves()
//             console.log(`Dex: ${lp.contractAddress} Token0: ${token0} Token1: ${token1}  Reserves0: ${reserves0} Reserves1: ${reserves1} Timestamp: ${timestamp}`)
//             let dexInfo = {
//                 contractAddress: lp.contractAddress,
//                 token0: token0,
//                 token1: token1,
//                 abiIndex: abiIndex,
//                 // symbol0: symbol0,
//                 // symbol1: symbol1,
//             }
//             dexInfos.push(dexInfo)
//         } catch (e){
//             const contract = new ethers.Contract(lp.contractAddress, dexAbis[1], wallet)
//             const token0 = await contract.token0()
//             const token1 = await contract.token1()
//             const abiIndex = 1;
//             // const token0Contract = new ethers.Contract(token0, erc20Abi, wallet)
//             // const token1Contract = new ethers.Contract(token1, erc20Abi, wallet)
//             // const symbol0 = await token0Contract.symbol()
//             // const symbol1 = await token1Contract.symbol()
//             const [reserves0, reserves1, timestamp] = await contract.getReserves()
//             console.log(`Dex: ${lp.contractAddress} Token0: ${token0} Token1: ${token1}  Reserves0: ${reserves0} Reserves1: ${reserves1} Timestamp: ${timestamp}`)
//             let dexInfo = {
//                 contractAddress: lp.contractAddress,
//                 token0: token0,
//                 token1: token1,
//                 abiIndex: abiIndex,
//                 // symbol0: symbol0,
//                 // symbol1: symbol1,
//             }
//             dexInfos.push(dexInfo)
//         }
        
//     }

//     fs.writeFileSync('./dexInfoUpdated.json', JSON.stringify(dexInfos, null, 2))

//     let oldDexInfo = JSON.parse(fs.readFileSync('./dexInfo.json', 'utf8'));
    
//     dexInfos.forEach((dexInfo: any) => {
//         let oldDex = oldDexInfo.find((oldDex: any) => oldDex.contractAddress == dexInfo.contractAddress)
//         if(!oldDex){
//             oldDexInfo.push(dexInfo)
//         }
//     })

//     fs.writeFileSync('./dexInfoCombined.json', JSON.stringify(oldDexInfo, null, 2))
//     // lps.forEach((lp: any) => {
//     //     console.log(`${lp.contractAddress}`)
//     //     const contract = new ethers.Contract(lp.contractAddress, dexAbis[0], wallet)
//     //     const token0 = await contract.token0()
//     //     const token1 = await contract.token1()
//     //     const [reserves0, reserves1, timestamp] = await contract.getReserves()
//     //     console.log(`Dex: ${lp.contractAddress} Token0: ${token0} Token1: ${token1} Reserves0: ${reserves0} Reserves1: ${reserves1} Timestamp: ${timestamp}`)
//     // })
// }
// async function readDexes(){
//     const dexInfos = JSON.parse(fs.readFileSync('./dexInfo.json', 'utf8'));
//     const dexInfosUpdated = JSON.parse(fs.readFileSync('./dexInfoUpdated.json', 'utf8'));
//     const provider = new ethers.JsonRpcProvider(localRpc)
//     const wallet = new ethers.Wallet(test_account_pk, provider)

//     dexInfos.forEach((dexInfo: any) => {
//         let matches = 0
//         let match;
//         dexInfosUpdated.forEach((dexInfoUpdated: any) => {
//             if(dexInfo.contractAddress == dexInfoUpdated.contractAddress){
//                 if(dexInfo.abiIndex != dexInfoUpdated.abiIndex){
//                     console.log("ABI index mismatch: ", dexInfo.contractAddress)
//                 }
//                 matches++
//             }
//         })
//         if(matches == 0){
//             console.log("Dex not found: ", dexInfo.contractAddress)
//         } else if (matches > 1){
//             console.log("Multiple dexes found: ", dexInfo.contractAddress)
//         }
//     })

// }
// async function testBatchUnwrap(){

//     let provider = new ethers.JsonRpcProvider(localRpc)
//     let wallet = new ethers.Wallet(test_account_pk, provider)

//     let movrContract = new ethers.Contract(wGlmrContractAddress, erc20Abi, wallet)
//     let usdcContract = new ethers.Contract(wormUsdcContractAddress, erc20Abi, wallet)
    
//     let movrBalance = await wallet.provider.getBalance(wallet.address)
//     let wrappedBalance = await movrContract.balanceOf(wallet.address)

//     // console.log(`MOVR Balance: ${movrBalance} Wrapped Balance: ${wrappedBalance}`)

//     let wrapAmount = ethers.parseUnits("10", 18);

//     let tokenPath = [ wormUsdcContractAddress, wGlmrContractAddress,]
//     // await wrapMovr(wallet, wrapAmount)
    
//     movrBalance = await wallet.provider.getBalance(wallet.address)
//     wrappedBalance = await movrContract.balanceOf(wallet.address)
//     let usdcBalance = await usdcContract.balanceOf(wallet.address)
//     console.log(`MOVR Balance: ${movrBalance} Wrapped Balance: ${wrappedBalance} USDC Balance: ${usdcBalance}`)

//     // let swapAmount = ethers.parseUnits("1", 18);
//     await testBatchSwap(tokenPath, 10)

//     movrBalance = await wallet.provider.getBalance(wallet.address)
//     wrappedBalance = await movrContract.balanceOf(wallet.address)
//     usdcBalance = await usdcContract.balanceOf(wallet.address)
//     console.log(`MOVR Balance: ${movrBalance} Wrapped Balance: ${wrappedBalance} USDC Balance: ${usdcBalance}`)
// }

async function getDexAbis(){
    let rpcProvider = new ethers.JsonRpcProvider(localRpc)
    let wallet = new ethers.Wallet(test_account_pk, rpcProvider)
    const lpContractAddresses = JSON.parse(fs.readFileSync(glmrLpsPath, 'utf8'))
    const lps = await Promise.all(lpContractAddresses.map(async (lpContract: any) => {
        // console.log(lpContract)
        const pool = await new ethers.Contract(lpContract, dexAbis[0], wallet);
        let reserves = await pool.getReserves();
        const token0 = await pool.token0();
        const token1 = await pool.token1();

        // pool.interface.
        // console.log(reserves)
        // // let reserve_0 = await hexToDec(reserves[0]["_hex"]);
        // // let reserve_1 = await hexToDec(reserves[1]["_hex"]);
        // let reserve_0 = reserves[0].toString();
        // let reserve_1 = reserves[1].toString();
        // let newliquidityStats = [reserve_0, reserve_1];
        // const newPool: MyLp = {
        //     chainId: 2004,
        //     contractAddress: lpContract,
        //     poolAssets: [token0, token1],
        //     liquidityStats: newliquidityStats
        // }
        // return newPool;
    }))
    // console.log(lps)
    // fs.writeFileSync(path.join(__dirname, './glmr_holders/lps_base.json'), JSON.stringify(lps, null, 2))
}
// async function saveLps() {
//     const lpContractAddresses = JSON.parse(fs.readFileSync(path.join(__dirname, './glmr_holders/confirmed_lps.json'), 'utf8'))
//     const lps = await Promise.all(lpContractAddresses.map(async (lpContract: any) => {
//         // console.log(lpContract)
//         const pool = await new ethers.Contract(lpContract, altDexContractAbi, provider);
//         let reserves = await pool.getReserves();
//         const token0 = await pool.token0();
//         const token1 = await pool.token1();
//         console.log(reserves)
//         // let reserve_0 = await hexToDec(reserves[0]["_hex"]);
//         // let reserve_1 = await hexToDec(reserves[1]["_hex"]);
//         let reserve_0 = reserves[0].toString();
//         let reserve_1 = reserves[1].toString();
//         let newliquidityStats = [reserve_0, reserve_1];
//         const newPool: MyLp = {
//             chainId: 2004,
//             contractAddress: lpContract,
//             poolAssets: [token0, token1],
//             liquidityStats: newliquidityStats
//         }
//         return newPool;
//     }))
//     console.log(lps)
//     fs.writeFileSync(path.join(__dirname, './glmr_holders/lps_base.json'), JSON.stringify(lps, null, 2))
// }

class LoggingProvider extends ethers.JsonRpcProvider {
    async call(transaction) {
      // Log the transaction data
      console.log("eth_call transaction data:", transaction);
      return super.call(transaction);
    }
  }

type PoolType = "Algebra" | "Uni" | "Solar";

export function getV3PoolAddress(token0: string, token1: string,  deployer: string, initHash: string, poolType: PoolType, fee?: number){
    console.log("Getting pool address")
    let coder = ethers.AbiCoder.defaultAbiCoder()
    console.log("got coder")
    let packedOne;
    let deployerContract;
    if(poolType == "Uni"){ // Uniswap
        console.log("UNI")
        console.log("Fee: ", fee)
        console.log("Token 0: ", token0)
        console.log("Token 1: ", token1)
        packedOne = coder.encode(['address', 'address', 'uint24'], [token0, token1, fee])
        console.log("Packed One: ", packedOne)
        deployerContract = uniFactoryContract
    } else { // Algebra
        console.log("ALGEBRA")
        packedOne = coder.encode(['address', 'address'], [token0, token1])
        console.log("Packed One: ", packedOne)
        deployerContract = algebraFactoryContract
    }
    console.log("Pool type")
    // let packedOneHex = ethers.hexlify(packedOne)
    let poolKeyHash = epKeccak(['bytes'], [packedOne])

    let packedTwo = concat([ "0xff", ethers.getAddress(deployerContract), poolKeyHash, initHash ])
    // let packedTwoHex = ethers.hexlify(packedTwo)
    let poolAddressHash = epKeccak(['bytes'], [packedTwo])
    console.log("getAddress()")
    let poolAddress = getAddress(dataSlice(poolAddressHash, 12))

    console.log("Token 0: ", token0)
    console.log("Token 1: ", token1)
    console.log("Init Hash: ", initHash)
    console.log("Packed One:", packedOne)
    // console.log("Packed One Hex: ", packedOneHex)
    console.log("Pool Key Hash: ", poolKeyHash)
    console.log("Packed Two: ", packedTwo)
    // console.log("Packed Two Hex: ", packedTwoHex)
    console.log("Pool Address Hash: ", poolAddressHash)
    console.log("Pool Address: ", poolAddress)
    return poolAddress
}

export async function getGlmrSwapTx(
    swapInstructions: SwapInstruction[], 
    chopsticks: boolean,
    extrinsicIndex: IndexObject, 
    instructionIndex: number[]
): Promise<SwapExtrinsicContainer>{
    let rpcProvider;
    let wallet;
    let swapManagerContractAddress;
    if (chopsticks) {
        //Local testnet and test account
        rpcProvider = new ethers.JsonRpcProvider(localRpc)
        wallet = new ethers.Wallet(test_account_pk, rpcProvider)
        swapManagerContractAddress = swapManagerContractLocal
    } else {
        //Live network and live wallet
        rpcProvider = new ethers.JsonRpcProvider(defaultRpc)
        wallet = new ethers.Wallet(live_wallet_3, rpcProvider)
        swapManagerContractAddress = swapManagerContractLive
    }
    const managerArtifactPath = path.join(__dirname, './contractArtifacts/DexManager.json');
    const managerArtifact = JSON.parse(fs.readFileSync(managerArtifactPath, 'utf8')) as any;
    let managerContract = new ethers.Contract(swapManagerContractAddress, managerArtifact.abi, wallet)
    let glmrWrapAmount = BigInt(0)

    // If first token is GLMR, send glmr to manager. Else approve token for manager contract
    let initialTokenIn = swapInstructions[0].assetNodes[0].assetRegistryObject.tokenData.contractAddress!.toLowerCase()
    let initialInputAmount = new FixedPointNumber(swapInstructions[0].assetNodes[0].pathValue, Number.parseInt(swapInstructions[0].assetNodes[0].assetRegistryObject.tokenData.decimals))
    if (initialTokenIn == wGlmrContractAddress.toLowerCase()) {
        glmrWrapAmount = BigInt(initialInputAmount.toChainData())
    } else {
        await checkAndApproveToken(initialTokenIn, wallet, swapManagerContractAddress, BigInt(initialInputAmount.toChainData()))
    }

    // Loop through swap instructions and get swap params. Contract takes array of ManagerSwapParms
    let swapParams: ManagerSwapParams[] = swapInstructions.map((swapInstruction: SwapInstruction, index: number) => {
        let swapType, abiIndex;
        console.log("SWAP INSTRUCTION PATH DATA DEX TYPE: ", swapInstruction.pathData.dexType)

        // FIXME
        // NEED TO FIX DEX TYPE IN ARB FINDER
        // For now just query the dex type from lp registry
        let poolData = getGlmrPoolData(swapInstruction.pathData.lpId)
        let poolDexType = poolData.dexType

        switch (poolDexType) { 
            case "solar":
                swapType = 0;
                abiIndex = 0;
                break;
            case "zenlink":
                swapType = 0;
                abiIndex = 1;
                break;
            case "uni":
                swapType = 1;
                abiIndex = 2;
                break;
            case "algebra":
                swapType = 1;
                abiIndex = 3;
                break;
        }
        console.log("SWAP TYPE: ", swapType)

        console.log(JSON.stringify(swapInstruction.pathData.lpId, null, 2))
        
        let tokenIn, tokenOut, inputTokenIndex, zeroForOne, poolAddress, feeRate, sqrtPriceLimitX96: bigint, data;

        [tokenIn, tokenOut] = [swapInstruction.assetNodes[0].assetRegistryObject.tokenData.contractAddress!.toLowerCase(), swapInstruction.assetNodes[1].assetRegistryObject.tokenData.contractAddress!.toLowerCase()]
        inputTokenIndex = tokenIn.toLowerCase() < tokenOut.toLowerCase() ? 0 : 1;
        let inputAmount = BigInt(ethers.parseUnits(swapInstruction.assetInAmount.toString(), Number.parseInt(swapInstruction.assetNodes[0].assetRegistryObject.tokenData.decimals)))
        let outputAmount = BigInt(ethers.parseUnits(swapInstruction.assetOutTargetAmount.toString(), Number.parseInt(swapInstruction.assetNodes[1].assetRegistryObject.tokenData.decimals)))

        poolAddress = swapInstruction.pathData.lpId;
        data = "0x" // Maybe unecessary
        if (swapType == 0) { // V2
            if(isV3Pool(poolData)) throw new Error("Pool is not V2")
            zeroForOne = false;
            feeRate = 0;
            sqrtPriceLimitX96 = BigInt(0)
        } else { // V3
            if(!isV3Pool(poolData)) throw new Error("Pool is not V3")
            zeroForOne = inputTokenIndex == 0 ? true : false;
            feeRate = Number.parseInt(poolData.feeRate!)
            sqrtPriceLimitX96 = zeroForOne ? BigInt(TickMath.MIN_SQRT_RATIO.toString()) + BigInt(1) : BigInt(TickMath.MAX_SQRT_RATIO.toString()) - BigInt(1) // *** PRICE SET TO MAX, MAYBE CHANGE TO ACCURATE
        }
        let managerSwapParams: ManagerSwapParams = {
            swapType: swapType,
            dexAddress: poolAddress,
            abiIndex: abiIndex,
            inputTokenIndex: inputTokenIndex,
            inputToken: tokenIn,
            outputToken: tokenOut,
            amountIn: inputAmount,
            amountOut: outputAmount,
            glmrWrapAmount: glmrWrapAmount,
            fee: feeRate,
            sqrtPriceLimitX96: sqrtPriceLimitX96,
            data: data
        }
        let token0, token1;
        if (inputTokenIndex == 0) {
            token0 = tokenIn;
            token1 = tokenOut;
        } else {
            token0 = tokenOut;
            token1 = tokenIn;
        }

        let poolType: PoolType;
        let poolInitHash;
        if (swapInstruction.pathData.dexType == "algebra"){
            poolType = "Algebra"
            poolInitHash = algebraPoolInitHash
        } else if(swapInstruction.pathData.dexType == "uni"){
            poolType = "Uni"
            poolInitHash = uniPoolInitHash
        } else {
            poolType = "Solar";
            
        }
        // let calculatedPoolAddress = getV3PoolAddress(token0, token1, deployer, poolInitHash, poolType, feeRate)
        // console.log(`Calculated Pool Address: ${calculatedPoolAddress}`)
        console.log("MANAGER SWAP PARAMS")
        console.log(JSON.stringify(managerSwapParams, null, 2))
        return managerSwapParams

    })

    let glmrTx = async function executeSwaps() {
        return await managerContract.executeSwaps(
            swapParams,
            { value: glmrWrapAmount }
        );
        // return swapParams
    }

    let firstAssetNode = swapInstructions[0].assetNodes[0]
    let assetNodes = [firstAssetNode]
    swapInstructions.forEach((swapInstruction: SwapInstruction) => {
        assetNodes.push(swapInstruction.assetNodes[1])
    })
    let startAsset = swapInstructions[0].assetNodes[0].getAssetRegistrySymbol()
    let destAsset = swapInstructions[swapInstructions.length - 1].assetNodes[1].getAssetRegistrySymbol()
    const descriptorString = `GLMR ${startAsset} -> ${destAsset}`

    let finalOutputAmount = new FixedPointNumber(swapParams[swapParams.length - 1].amountOut.toString(), Number.parseInt(swapInstructions[swapInstructions.length - 1].assetNodes[1].assetRegistryObject.tokenData.decimals))

    let api = await getApiForNode("Moonbeam", chopsticks)

    let swapTxContainer: SwapExtrinsicContainer = {
        relay: 'polkadot',
        chainId: 2004,
        chain: "Moonbeam",
        assetNodes: assetNodes,
        extrinsic: glmrTx,
        extrinsicIndex: extrinsicIndex.i,
        instructionIndex: instructionIndex,
        txString: descriptorString,
        assetSymbolIn: startAsset,
        assetSymbolOut: destAsset,
        assetAmountIn: initialInputAmount,
        expectedAmountOut: finalOutputAmount,
        // REVIEW Glmr path type for swaps
        pathType: PathType.DexV2, // glmr swap can have multiple types (V2, V3, stable?) so this property wont be used
        pathAmount: swapInstructions[0].assetNodes[0].pathValue,
        api: api,
        glmrSwapParams: swapParams
    }
    return swapTxContainer
}

export async function executeSingleGlmrSwap(){
    let testNetProvider = new ethers.JsonRpcProvider(localRpc)
    let testNetWallet = new ethers.Wallet(test_account_pk, testNetProvider)
    let swapManagerContractAddress = swapManagerContractLocal
    const managerArtifactPath = path.join(__dirname, './contractArtifacts/DexManager.json');
    const managerArtifact = JSON.parse(fs.readFileSync(managerArtifactPath, 'utf8')) as any;
    let managerContract = new ethers.Contract(swapManagerContractAddress, managerArtifact.abi, testNetWallet)
    let glmrWrapAmount = BigInt(500000000000000000)

    // 331103678929765886n
    500000000000000000
    517018394648829474836n
    let inputAmount = BigInt(500000000000000000)
    let inputReserve = BigInt(1000000000000000000)
    let outputReserve = BigInt(1561500000000000000000)
    let swapAmount = calculateSwapAmountRouterFormula(inputAmount, inputReserve, outputReserve, 100, 30)

    console.log("Swap Amount: ", swapAmount)

    
    let glmrBalance = await testNetWallet.provider!.getBalance(testNetWallet.address)
    console.log("GLMR Balance: ", glmrBalance.toString())

    let swapType = 0; //v2
    // let dexAddress = 



    let swapOne: ManagerSwapParams = {
        "swapType": 0,
        "dexAddress": "0xd4f1931f818e60b084fe13a40c31a05a44ed70cf",
        "abiIndex": 0,
        "inputTokenIndex": 1,
        "inputToken": "0xacc15dc74880c9944775448304b263d191c6077f",
        "outputToken": "0x322E86852e492a7Ee17f28a78c663da38FB33bfb",
        "amountIn": "500000000000000000",
        "amountOut": "507018394648829474836",
        "glmrWrapAmount": "500000000000000000",
        "fee": 0,
        "sqrtPriceLimitX96": "0",
        "data": "0x"
      }

      console.log("Executing")
    let txReceipt = await managerContract.executeSwaps([swapOne], { value: glmrWrapAmount })

    // let glmrTx = async function executeSwaps() {
    //     return await managerContract.executeSwaps(
    //         [swapOne],
    //         { value: glmrWrapAmount }
    //     );
    // }

    // let txReceipt = await glmrTx()
    console.log("GLMR swap tx receipt: " + JSON.stringify(txReceipt))
    let txHash = await txReceipt.wait()
    console.log("GLMR swap tx hash: " + txHash)
} 

export async function testGlmrRpc(){
    let rpcProvider = new ethers.JsonRpcProvider(localRpc)
    let wallet = new ethers.Wallet(test_account_pk, rpcProvider)
    let glmrLpRegistry = JSON.parse(fs.readFileSync(glmrLpsPath, 'utf8'))
    let dexContractAddress = "0xd4f1931f818e60b084fe13a40c31a05a44ed70cf"
    let registryDexInfo = glmrLpRegistry.find((lp: any) => lp.contractAddress == dexContractAddress)
    let [token0, token1] = [registryDexInfo.poolAssets[0], registryDexInfo.poolAssets[1]]

    let wrapReceipt = await wrapGlmr(wallet, BigInt(10000000000000000000))

    let glmrBalance = await rpcProvider.getBalance(test_account)
    console.log(glmrBalance.toString())

    let fraxDexContractAddress = "0xd4f1931f818e60b084fe13a40c31a05a44ed70cf"
    let fraxAbi = JSON.parse(fs.readFileSync(path.join(__dirname, './abi/fraxDexAbi.json'), 'utf8'))
    let fraxDexContract = new ethers.Contract(fraxDexContractAddress, fraxAbi, wallet)

    let inputToken = wGlmrContractAddress
    let inputIndex = registryDexInfo.poolAssets.findIndex((asset: any) => asset == "GLMR")
    

    let [reserve0, reserve1] = await fraxDexContract.getReserves()
    console.log(`Reserves: ${reserve0}, ${reserve1}`)

    let inputReserve = inputIndex == 0 ? reserve0 : reserve1
    let outputReserve = inputIndex == 0 ? reserve1 : reserve0

    let inputAmount = BigInt(1000000000000000000)
    
    let wGlmrContract = new ethers.Contract(wGlmrContractAddress, erc20Abi, wallet)
    let dexGlmrBalance = await wGlmrContract.balanceOf(wallet.address)
    console.log('dex glmr Balance: ', dexGlmrBalance.toString())

    let transferReceipt = await wGlmrContract.transfer(fraxDexContractAddress, inputAmount)

    let dexGlmrBalanceAfter = await wGlmrContract.balanceOf(wallet.address)
    console.log('dex glmr Balance After: ', dexGlmrBalanceAfter.toString())

    let swapAmount = calculateSwapAmountRouterFormula(inputAmount, inputReserve, outputReserve, 100, 30)

    let amount0Out = inputIndex == 0 ? BigInt(0) : swapAmount
    let amount1Out = inputIndex == 1 ? BigInt(0) : swapAmount
    let to = test_account
    let data = '0x'

    await checkAndApproveToken(wGlmrContractAddress, wallet, fraxDexContractAddress, BigInt(5000000000000000000))

    let fraxTokenContract = new ethers.Contract("0x322E86852e492a7Ee17f28a78c663da38FB33bfb", erc20Abi, wallet)
    let fraxBalance = await fraxTokenContract.balanceOf(wallet.address)
    console.log(`Frax Balance: ${fraxBalance}`)

    console.log(`Input index: ${inputIndex} | Token 0: ${token0} ${amount0Out} | Token 1: ${token1} ${amount1Out} To: ${to} Data: ${data}`)
    let swapTx = await fraxDexContract.swap(BigInt(amount0Out), BigInt(amount1Out), to, data)
    let receipt = await swapTx.wait()
    console.log(receipt)

    // let glmrBalanceAfter = await rpcProvider.getBalance(test_account)
    let fraxBalanceAfter = await fraxTokenContract.balanceOf(wallet.address)

    console.log(`Frax Balance After: ${fraxBalanceAfter}`)
    // let wallet = new ethers.Wallet(test_account_pk, rpcProvider)
    // let wrapReceipt = await wrapGlmr(wallet, BigInt(1000000000000000000))
    // console.log(wrapReceipt)
}

async function testAlgebraSwapContract(){
    console.log("TestAlgebraSwap")
    let rpcProvider = new ethers.JsonRpcProvider(localRpc)
    let wallet = new ethers.Wallet(test_account_pk, rpcProvider)
    let tokenOutAddress = wGlmrContractAddress
    let tokenInAddress = usdcContractAddress
    let glmrUsdcAlgebraPool = "0xaB8C35164a8e3EF302d18DA953923eA31f0Fe393"
    let swapContract = swapManagerContractLocal
    const fee = 2877;

    let algebraDexAbi = dexAbiMap['algebra']
    let managerAbi = dexAbiMap['manager']

    let tokenInContract = await new ethers.Contract(tokenInAddress, erc20Abi, wallet)
    let tokenOutContract = await new ethers.Contract(tokenOutAddress, erc20Abi, wallet)
    let algebraDexContract = await new ethers.Contract(glmrUsdcAlgebraPool, algebraDexAbi, wallet)
    let managerContract = await new ethers.Contract(swapContract, managerAbi, wallet)
    
    let tokenInBalance = await tokenInContract.balanceOf(wallet.address)
    let tokenOutBalance = await tokenOutContract.balanceOf(wallet.address)

    const WGLMR_TOKEN = new Token(
        1284,
        wGlmrContractAddress.toLowerCase(),
        18,
        'WGLMR',
        'Wrapped GLMR'
      )
      
    const USDC_TOKEN = new Token(
        1284,
        usdcContractAddress.toLowerCase(),
        6,
        'USDC',
        'USD Coin (Wormhole)'
      )

    const initHash = algebraPoolInitHash;
  
    let [tokenA, tokenB] = [USDC_TOKEN, WGLMR_TOKEN]
    const [token0, token1] = tokenA.sortsBefore(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA] // does safety checks

    console.log(`Token 0: ${token0.address} Token 1: ${token1.address} Fee: ${fee} Factory: ${algebraFactoryContract} Deployer: ${algebraPoolDeployer}`)

    let poolAddress = getV3PoolAddress(token0.address, token1.address, algebraPoolDeployer, initHash, "Algebra", fee)

    let wrapGlmrAmount = ethers.parseUnits("1000", 18)


    // console.log("Wrapping glmr")
    // let wrapReceipt = await wrapGlmr(wallet, wrapGlmrAmount)
    // tokenInBalance = await tokenInContract.balanceOf(wallet.address)

    let walletNativeTokenBalance = await wallet.provider!.getBalance(wallet.address)

    // let tokenInAmount = ethers.parseUnits("1", 18)
    
    let tokenInAmount = ethers.parseUnits("0.01", 6)

    let calcResult = await calculateAlgebraSwap(tokenInAddress, tokenOutAddress, 1, glmrUsdcAlgebraPool)
    console.log(calcResult)

    let priceLimit = calcResult.targetPrice

    let oneGlmr = ethers.parseUnits("1", 18)
    let tenGlmr = ethers.parseUnits("10", 18)
    
    let allowance = await tokenInContract.allowance(wallet.address, swapManagerContractLocal)

    console.log(`6 MANAGER | Token in Allowance: ${allowance}`)

    let approved = await approveMax(tokenInAddress, wallet, swapManagerContractLocal)
    let approvedOut = await approveMax(tokenOutAddress, wallet, swapManagerContractLocal)
    
    tokenInBalance = await tokenInContract.balanceOf(wallet.address)
    tokenOutBalance = await tokenOutContract.balanceOf(wallet.address)

    console.log(`7 WALLET | Token In Balance: ${tokenInBalance} Token Out Balance: ${tokenOutBalance}`)

    // let payer = recipient
    // let poolAddress: ethers.AddressLike = glmrEthUniDex
    let zeroForOne: boolean = false
    let amountSpecified = BigInt(tokenInAmount)
    let sqrtPriceLimit: bigint = BigInt(TickMath.MIN_SQRT_RATIO.toString()) + BigInt(1)

    let coder = ethers.AbiCoder.defaultAbiCoder()
    let recipient: ethers.AddressLike = wallet.address
    let swapCalldata = coder.encode(
        ["address", "address", "address"],
        [tokenInAddress, tokenOutAddress, recipient]
      );

    console.log(`manager swap params: ${poolAddress} | ${zeroForOne} | ${amountSpecified} | ${sqrtPriceLimit} | ${swapCalldata}`)

    let singleSwapParams: SwapSingleParams = {
        tokenIn: tokenInAddress,
        tokenOut: tokenOutAddress,
        fee: BigInt(3000),
        amountIn: amountSpecified,
        sqrtPriceLimitX96: BigInt(priceLimit.toFixed()),
        poolAddress: poolAddress,
    }

    // managerTokenInBalance = await tokenInContract.balanceOf(swapManagerContract)
    // console.log(`8 MANAGER | Token In Balance ${managerTokenInBalance}`)

    // let testTransferTx = await managerContract.transferToContract(oneGlmr, tokenInAddress);
    // let testTransferReceipt = await testTransferTx.wait()

    // managerTokenInBalance = await tokenInContract.balanceOf(swapManagerContract)
    // console.log(`9 MANAGER | Token In Balance ${managerTokenInBalance}`)

    tokenInBalance = await tokenInContract.balanceOf(wallet.address)
    tokenOutBalance = await tokenOutContract.balanceOf(wallet.address)

    console.log(`Token In Balance: ${tokenInBalance} Token Out Balance: ${tokenOutBalance}`)

    console.log(JSON.stringify(singleSwapParams))
    // let  swapTx = await managerContract.swap(poolAddress, zeroForOne, amountSpecified, sqrtPriceLimit, swapCalldata)
    let swapTx = await managerContract.swapSingle(singleSwapParams);
    let swapTxReceipt = swapTx.wait()

    console.log(`Swap Tx Receipt: ${JSON.stringify(swapTxReceipt, null, 2)}`)

    // const deadline = Math.floor(Date.now() / 1000) + 900;
    //   let swapTx = await uniDexContract.swap(recipient, zeroForOne, amountSpecified.toString(), sqrtPriceLimit, '0x', {value: oneGlmr, deadline: deadline, gasLimit: 10000000, maxPriorityFeePerGas: 853687807, maxFeePerGas: ethers.parseUnits("100", "gwei")})

  
      
    tokenInBalance = await tokenInContract.balanceOf(wallet.address)
    tokenOutBalance = await tokenOutContract.balanceOf(wallet.address)

    console.log(`Token In Balance: ${tokenInBalance} Token Out Balance: ${tokenOutBalance}`)
    
}

// async function testUniV3SwapContract(){
//     let rpcProvider = new ethers.JsonRpcProvider(localRpc)
//     let wallet = new ethers.Wallet(test_account_pk, rpcProvider)
//     let tokenInAddress = wGlmrContractAddress
//     let tokenOutAddress = wEthContractAddress
//     let glmrEthUniDex = "0xBa66370D96a9D61AfA66283900b78C1F6Ed02782"
//     let swapContract = swapManagerContractLocal

//     let uniDexAbi = dexAbiMap['uni3']
//     let managerAbi = dexAbiMap['manager']

//     let tokenInContract = await new ethers.Contract(tokenInAddress, erc20Abi, wallet)
//     let tokenOutContract = await new ethers.Contract(tokenOutAddress, erc20Abi, wallet)
//     let uniDexContract = await new ethers.Contract(glmrEthUniDex, uniDexAbi, wallet)
//     let managerContract = await new ethers.Contract(swapContract, managerAbi, wallet)

//     let tickSpacing = await uniDexContract.tickSpacing()

//     let tokenInBalance = await tokenInContract.balanceOf(wallet.address)
//     let tokenOutBalance = await tokenOutContract.balanceOf(wallet.address)

//     const WGLMR_TOKEN = new Token(
//         1284,
//         wGlmrContractAddress.toLowerCase(),
//         18,
//         'WGLMR',
//         'Wrapped GLMR'
//       )
      
//     const WETH_TOKEN = new Token(
//         1284,
//         wEthContractAddress.toLowerCase(),
//         18,
//         'WETH',
//         'Wrapped Ether'
//       )
    
//     let fee = 3000
//     const initHash = '0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54';

//     console.log(`Token 0: ${WETH_TOKEN.address}`)
//     console.log(`Token 1: ${WGLMR_TOKEN.address}`)
//     console.log(`Fee: ${fee}`)
//     console.log(`Factory: ${uniFactoryContract}`)

//     let [tokenA, tokenB] = [WETH_TOKEN, WGLMR_TOKEN]
//     const [token0, token1] = tokenA.sortsBefore(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA] // does safety checks

//     console.log(`Token 0: ${token0.address} Token 1: ${token1.address} Fee: ${fee} Factory: ${uniFactoryContract}`)

//     let coder = ethers.AbiCoder.defaultAbiCoder()
//     // let codeBytes = ethers.solidityPacked(['address', 'address', 'uint24'], [WETH_TOKEN.address, WGLMR_TOKEN.address, 3000])
//     let packedOne = coder.encode(['address', 'address', 'uint24'], [token0.address, token1.address, 3000])
//     // let epPackedOne = defaultAbiCoder.encode(['address', 'address', 'uint24'], [token0.address, token1.address, 3000])
//     console.log(`Packed One: ${packedOne}`)
//     // console.log(`EP Packed One: ${epPackedOne}`)

//     let poolKeyHash = epKeccak(['bytes'], [packedOne])
//     console.log(`Pool Key Hash: ${poolKeyHash}`)
//     console.log('---------------------------------')

//     // let packedTwo = coder.encode(['bytes', 'address', 'bytes32', 'bytes32'], ['0xff', uniFactoryContract, poolKeyHash, initHash])
//     let packedTwo = concat([ "0xff", ethers.getAddress(uniFactoryContract), poolKeyHash, initHash ])
//     console.log(`Packed Two: ${packedTwo}`)

//     let packedTwoHex = ethers.hexlify(packedTwo)
//     console.log(`Packed Two Hex: ${packedTwoHex}`)

//     let poolAddressHash = epKeccak(['bytes'], [packedTwo])
//     console.log(`EP Pool Address Hash: ${poolAddressHash}`)
//     console.log('---------------------------------')
//     let epPoolAddress = getAddress(dataSlice(poolAddressHash, 12))
//     // let epPoolAddressSliced = ethers.getAddress()
//     console.log(`EP Pool Address Hex: ${epPoolAddress}`)

//     let poolParams = {
//         factoryAddress: uniFactoryContract,
//         tokenA: token0,
//         tokenB: token1,
//         fee: fee,
//         initCodeHashManualOverride: initHash
//     }

//     let computedPoolAddress = computePoolAddress(poolParams)
//     console.log(`Computed address: ${computedPoolAddress}`)

//     const poolAddressCalculated = Pool.getAddress(WETH_TOKEN, WGLMR_TOKEN, 3000, initHash, uniFactoryContract)

//     console.log(`Pool Address Calculated: ${poolAddressCalculated}`)


//     let wrapGlmrAmount = ethers.parseUnits("1000", 18)


//     // console.log("Wrapping glmr")
//     // let wrapReceipt = await wrapGlmr(wallet, wrapGlmrAmount)
//     // tokenInBalance = await tokenInContract.balanceOf(wallet.address)

//     let walletNativeTokenBalance = await wallet.provider.getBalance(wallet.address)

//     console.log(`1 WALLET | Token In Balance: ${tokenInBalance} Token Out Balance: ${tokenOutBalance}`)
//     console.log(`- WALLET | Native Token Balance: ${walletNativeTokenBalance}`)

//     let tokenInAmount = ethers.parseUnits("1", 18)

//     let calcResult = await calculateUni3Swap(tokenInAddress, tokenOutAddress, 1, glmrEthUniDex)

//     console.log(calcResult)

//     // let amountSpecifiedMinusSlip = BigInt(calcResult.outputAmount.minus(calcResult.outputAmount.times(new bn(0.02))).integerValue().toFixed())

//     let gasLimit = BigInt(30000000)

//     let managerNativeTokenBalance = await wallet.provider.getBalance(swapManagerContractLocal)
//     console.log(`2 MANAGER | Native Token Balance: ${(managerNativeTokenBalance)}`)

//     let oneGlmr = ethers.parseUnits("1", 18)
//     let tenGlmr = ethers.parseUnits("10", 18)




//     let managerTokenInBalance = await tokenInContract.balanceOf(swapManagerContractLocal)
//     console.log(`4 MANAGER | Token In Balance: ${(managerTokenInBalance)}`)

//     let transferTx = await tokenInContract.transfer(swapManagerContractLocal, oneGlmr);
//     let transferReceipt = await transferTx.wait()

//     managerTokenInBalance = await tokenInContract.balanceOf(swapManagerContractLocal)
//     console.log(`5 MANAGER | Token In Balance ${managerTokenInBalance}`)
    
//     let allowance = await tokenInContract.allowance(wallet.address, swapManagerContractLocal)

//     console.log(`6 MANAGER | Token in Allowance: ${allowance}`)

//     let approved = await approveMax(tokenInAddress, wallet, swapManagerContractLocal)
//     let approvedOut = await approveMax(tokenOutAddress, wallet, swapManagerContractLocal)
    
//     tokenInBalance = await tokenInContract.balanceOf(wallet.address)
//     tokenOutBalance = await tokenOutContract.balanceOf(wallet.address)

//     console.log(`7 WALLET | Token In Balance: ${tokenInBalance} Token Out Balance: ${tokenOutBalance}`)

//     // let payer = recipient
//     let poolAddress: ethers.AddressLike = glmrEthUniDex
//     let zeroForOne: boolean = false
//     let amountSpecified = BigInt(tokenInAmount)
//     let sqrtPriceLimit: bigint = BigInt(TickMath.MAX_SQRT_RATIO.toString()) - BigInt(1)

    
//     let recipient: ethers.AddressLike = wallet.address
//     // let swapCalldata = coder.encode(
//     //     ["address", "address", "address"],
//     //     [tokenInAddress, tokenOutAddress, recipient]
//     //   );

//     // console.log(`manager swap params: ${poolAddress} | ${zeroForOne} | ${amountSpecified} | ${sqrtPriceLimit} | ${swapCalldata}`)

//     let singleSwapParams: SwapSingleParams = {
//         tokenIn: tokenInAddress,
//         tokenOut: tokenOutAddress,
//         fee: BigInt(fee),
//         amountIn: amountSpecified,
//         sqrtPriceLimitX96: sqrtPriceLimit,
//         poolAddress: poolAddress,
//     } 

//     managerTokenInBalance = await tokenInContract.balanceOf(swapManagerContractLocal)
//     console.log(`8 MANAGER | Token In Balance ${managerTokenInBalance}`)

//     let testTransferTx = await managerContract.transferToContract(oneGlmr, tokenInAddress);
//     let testTransferReceipt = await testTransferTx.wait()

//     managerTokenInBalance = await tokenInContract.balanceOf(swapManagerContractLocal)
//     console.log(`9 MANAGER | Token In Balance ${managerTokenInBalance}`)

//     console.log(JSON.stringify(singleSwapParams))
//     // let  swapTx = await managerContract.swap(poolAddress, zeroForOne, amountSpecified, sqrtPriceLimit, swapCalldata)
//     let swapTx = await managerContract.swapSingle(singleSwapParams);
//     let swapTxReceipt = swapTx.wait()

//     console.log(`Swap Tx Receipt: ${swapTxReceipt}`)

//     // const deadline = Math.floor(Date.now() / 1000) + 900;
//     //   let swapTx = await uniDexContract.swap(recipient, zeroForOne, amountSpecified.toString(), sqrtPriceLimit, '0x', {value: oneGlmr, deadline: deadline, gasLimit: 10000000, maxPriorityFeePerGas: 853687807, maxFeePerGas: ethers.parseUnits("100", "gwei")})

  
      
//     tokenInBalance = await tokenInContract.balanceOf(wallet.address)
//     tokenOutBalance = await tokenOutContract.balanceOf(wallet.address)

//     console.log(`Token In Balance: ${tokenInBalance} Token Out Balance: ${tokenOutBalance}`)
// }

// async function testUniV3Swap(){
//     let rpcProvider = new ethers.JsonRpcProvider(localRpc)
//     let wallet = new ethers.Wallet(test_account_pk, rpcProvider)
//     let tokenIn = wGlmrContractAddress
//     let tokenOut = wEthContractAddress
//     let glmrEthUniDex = "0xBa66370D96a9D61AfA66283900b78C1F6Ed02782".toLowerCase()

//     let uniDexAbi = dexAbiMap['uni3']

//     let tokenInContract = await new ethers.Contract(tokenIn, erc20Abi, wallet)
//     let tokenOutContract = await new ethers.Contract(tokenOut, erc20Abi, wallet)
//     let uniDexContract = await new ethers.Contract(glmrEthUniDex, uniDexAbi, wallet)

//     let tokenInBalance = await tokenInContract.balanceOf(wallet.address)
//     let tokenOutBalance = await tokenOutContract.balanceOf(wallet.address)

//     console.log(`Token In Balance: ${tokenInBalance} Token Out Balance: ${tokenOutBalance}`)

//     let tokenInAmount = ethers.parseUnits("1", 18)

//     let calcResult = await calculateUni3Swap(tokenIn, tokenOut, 1, glmrEthUniDex)

//     console.log(calcResult)

//     // let amountSpecifiedMinusSlip = BigInt(calcResult.outputAmount.minus(calcResult.outputAmount.times(new bn(0.02))).integerValue().toFixed())
//     let amountSpecified = BigInt(tokenInAmount)
//     let recipient: ethers.AddressLike = wallet.address
//     let zeroForOne = false
//     // let sqrtPriceLimit = BigInt(calcResult.targetPrice.toFixed())
//     let sqrtPriceLimit = BigInt(TickMath.MAX_SQRT_RATIO.toString()) - BigInt(1)
//     let gasLimit = BigInt(30000000)
    
//     // let sqrtPriceLimit = BigInt(0)

//     let dexTokenInBalance = await tokenInContract.balanceOf(glmrEthUniDex)
//     console.log(`Dex token In Balance ${(dexTokenInBalance)}`)

//     let oneGlmr = ethers.parseUnits("1", 18)
//     let transferTx = await tokenInContract.transfer(glmrEthUniDex, oneGlmr);
//     let transferReceipt = await transferTx.wait()

//     dexTokenInBalance = await tokenInContract.balanceOf(glmrEthUniDex)
//     console.log(`Dex token In Balance ${dexTokenInBalance}`)
    
//     let approved = await checkAndApproveToken(tokenIn, wallet, glmrEthUniDex, oneGlmr)
//     let approvedOut = await checkAndApproveToken(tokenOut, wallet, glmrEthUniDex, BigInt(calcResult.outputAmount.toFixed()))

    
//     tokenInBalance = await tokenInContract.balanceOf(wallet.address)
//     tokenOutBalance = await tokenOutContract.balanceOf(wallet.address)

//     console.log(`Token In Balance: ${tokenInBalance} Token Out Balance: ${tokenOutBalance}`)

//     console.log(`Swao params: ${recipient} ${zeroForOne} ${amountSpecified} ${sqrtPriceLimit} 0x`)
//     const deadline = Math.floor(Date.now() / 1000) + 900;
//     let swapTx = await uniDexContract.swap(glmrEthUniDex, zeroForOne, amountSpecified.toString(), sqrtPriceLimit, '0x', {value: oneGlmr, deadline: deadline, gasLimit: 10000000, maxPriorityFeePerGas: 853687807, maxFeePerGas: ethers.parseUnits("100", "gwei")})
//     let swapTxReceipt = swapTx.wait()

    
//     tokenInBalance = await tokenInContract.balanceOf(wallet.address)
//     tokenOutBalance = await tokenOutContract.balanceOf(wallet.address)

//     console.log(`Token In Balance: ${tokenInBalance} Token Out Balance: ${tokenOutBalance}`)


// }
// async function liveUniV3Swap(){
//     //Live network and live wallet
//     let rpcProvider = new ethers.JsonRpcProvider(defaultRpc)
//     let wallet = new ethers.Wallet(live_wallet_3, rpcProvider)
//     // let rpcProvider = new ethers.JsonRpcProvider(localRpc)
//     // let wallet = new ethers.Wallet(test_account_pk, rpcProvider)
//     let tokenIn = wGlmrContractAddress
//     let tokenOut = wEthContractAddress
//     let glmrEthUniDex = "0xBa66370D96a9D61AfA66283900b78C1F6Ed02782"

//     let uniDexAbi = dexAbiMap['uni3']

//     let tokenInContract = await new ethers.Contract(tokenIn, erc20Abi, wallet)
//     let tokenOutContract = await new ethers.Contract(tokenOut, erc20Abi, wallet)
//     let uniDexContract = await new ethers.Contract(glmrEthUniDex, uniDexAbi, wallet)

//     let tokenInBalance = await tokenInContract.balanceOf(wallet.address)
//     let tokenOutBalance = await tokenOutContract.balanceOf(wallet.address)

//     console.log(`Token In Balance: ${tokenInBalance} Token Out Balance: ${tokenOutBalance}`)

//     let wrapGlmrAmount = ethers.parseUnits("4", 18)

//     console.log("Wrapping glmr")
//     let wrapReceipt = await wrapGlmr(wallet, wrapGlmrAmount)
//     tokenInBalance = await tokenInContract.balanceOf(wallet.address)

//     console.log(`Token In Balance: ${tokenInBalance} Token Out Balance: ${tokenOutBalance}`)


//     let tokenInAmount = ethers.parseUnits("0.1", 18)

//     let calcResult = await calculateUni3Swap(tokenIn, tokenOut, 1, glmrEthUniDex)

//     console.log(calcResult)

//     // let amountSpecifiedMinusSlip = BigInt(calcResult.outputAmount.minus(calcResult.outputAmount.times(new bn(0.02))).integerValue().toFixed())
//     let amountSpecified = tokenInAmount
//     let recipient: ethers.AddressLike = wallet.address
//     let zeroForOne = false
//     let sqrtPriceLimit = BigInt(calcResult.targetPrice.toFixed())
//     let gasLimit = BigInt(30000000)
    
//     // let sqrtPriceLimit = BigInt(0)

//     let dexTokenInBalance = await tokenInContract.balanceOf(glmrEthUniDex)
//     console.log(`Dex token In Balance ${(dexTokenInBalance)}`)

//     // let oneGlmr = ethers.parseUnits("1", 18)
//     // let transferTx = await tokenInContract.transfer(glmrEthUniDex, tokenInAmount);
//     // let transferReceipt = await transferTx.wait()

//     dexTokenInBalance = await tokenInContract.balanceOf(glmrEthUniDex)
//     console.log(`Dex token In Balance ${dexTokenInBalance}`)
    
//     let approved = await checkAndApproveToken(tokenIn, wallet, glmrEthUniDex, tokenInAmount)

    
//     tokenInBalance = await tokenInContract.balanceOf(wallet.address)
//     tokenOutBalance = await tokenOutContract.balanceOf(wallet.address)

//     console.log(`Token In Balance: ${tokenInBalance} Token Out Balance: ${tokenOutBalance}`)

//     let swapTx = await uniDexContract.swap(recipient, zeroForOne, amountSpecified, sqrtPriceLimit, '0x')
//     let swapTxReceipt = swapTx.wait()

    
//     tokenInBalance = await tokenInContract.balanceOf(wallet.address)
//     tokenOutBalance = await tokenOutContract.balanceOf(wallet.address)

//     console.log(`Token In Balance: ${tokenInBalance} Token Out Balance: ${tokenOutBalance}`)


// }


// async function testV3Swaps(){
    
//     // let rpcProvider = new LoggingProvider(localRpc)
//     let rpcProvider = new ethers.JsonRpcProvider(localRpc)
//     let wallet = new ethers.Wallet(test_account_pk, rpcProvider)
//     let algebraGlmrTracDex = "0xfd6f6e8ab476151d5fda98c62f70f1085a329fc2"
//     let algebraGlmrStellaDex = "0x1b11D991f32FB59Ec4EE744de68aD65d9e85b2d2"
//     let glmrContractAddress = "0xAcc15dC74880C9944775448304B263D191c6077F"
//     let tracContractAddress = "0xed80FEf95392bB8c0e29cF75BE356E491d0d7661"
//     let stellaContractAddress = "0x0E358838ce72d5e61E0018a2ffaC4bEC5F4c88d2"

    
//     let tokenOut = stellaContractAddress;
//     let tokenOutContract = new ethers.Contract(tokenOut, erc20Abi, wallet)
//     let tokenIn = glmrContractAddress;
//     let tokenInContract = new ethers.Contract(tokenIn, erc20Abi, wallet)

//     let algebraDex = algebraGlmrStellaDex
//     let wrapAmount = ethers.parseUnits("100", 18)
//     // let wrapReceipt = await wrapGlmr(wallet, wrapAmount)

//     let glmrContract = new ethers.Contract(glmrContractAddress, erc20Abi, wallet)
//     // let stellaContract = new ethers.Contract(tracContractAddress, erc20Abi, wallet)

//     let wrappedGlmrBalance = await glmrContract.balanceOf(wallet.address)
//     let nativeGlmrBalance = await wallet.provider.getBalance(wallet.address)
//     console.log(`Wrapped GLMR Balance: ${wrappedGlmrBalance}`)
//     console.log(`Native GLMR Balance: ${nativeGlmrBalance}`)

//     // let inputAmount
//     let calcResult = await calculateAlgebraSwap(tokenIn, tokenOut, 1, algebraDex)
//     console.log(calcResult)
//     let oneGlmr = ethers.parseUnits("1", 18)
//     let tenGlmr = ethers.parseUnits("10", 18)
//     console.log(`Min sqrt ratio: ${TickMath.MIN_SQRT_RATIO}`)
//     console.log(`Max sqrt ratio: ${TickMath.MAX_SQRT_RATIO}`)
//     let amountRequiredMinusSlip = calcResult.outputAmount.minus(calcResult.outputAmount.times(new bn(0.02))).integerValue()
//     // let rpcProvider = new ethers.JsonRpcProvider(localRpc)
//     // let wallet = new ethers.Wallet(test_account_pk, rpcProvider)
//     let testOutputAmount = BigInt(1887401983561990843)
//     let testPriceLimit = BigInt(4295128740)
//     let recipient: ethers.AddressLike = wallet.address
//     let zeroToOne = true
//     let amountRequired = BigInt(amountRequiredMinusSlip.toFixed())
//     // let amountRequired = testOutputAmount
//     // let sqrtPriceLimit = BigInt(calcResult.targetPrice.toFixed())
//     // let lowestSqrtPriceLimit = BigInt(TickMath.MIN_SQRT_RATIO.toString())
//     // let sqrtPriceLimit = BigInt(TickMath.MIN_SQRT_RATIO.toString())
//     // let sqrtPriceLimit = testPriceLimit
//     let sqrtPriceLimit = BigInt(calcResult.targetPrice.toFixed())
//     let data = '0x'


//     let algebraDexAbi = dexAbiMap['algebra'];

//     let outputTokenBalance = await tokenOutContract.balanceOf(wallet.address)
//     console.log(`Output Token Balance: ${outputTokenBalance}`)

//     let approved = await checkAndApproveToken(glmrContractAddress, wallet, algebraDex, oneGlmr)
//     let checkedApproval = await checkApproval(glmrContract, wallet.address, algebraDex)

//     let dexInBalance = await tokenInContract.balanceOf(algebraDex)
//     let dexOutBalance = await tokenOutContract.balanceOf(algebraDex)
//     console.log(`Dex In Balance: ${dexInBalance} Dex Out Balance: ${dexOutBalance}`)

//     let transferTx = await glmrContract.transfer(algebraDex, oneGlmr)
//     let transferReceipt = await transferTx.wait()

//     dexInBalance = await tokenInContract.balanceOf(algebraDex)
//     console.log(`Dex In Balance: ${dexInBalance}`)

//     let dexContract = new ethers.Contract(algebraDex, algebraDexAbi, wallet)
//     let swapTx = await dexContract.swap(recipient, zeroToOne, amountRequired, sqrtPriceLimit, data)
//     let receipt = swapTx.wait()

//     console.log(receipt)


//     outputTokenBalance = await tokenOutContract.balanceOf(wallet.address)
//     wrappedGlmrBalance = await glmrContract.balanceOf(wallet.address)

//     console.log(`Output Token Balance: ${outputTokenBalance}`)
//     console.log(`Wrapped GLMR Balance: ${wrappedGlmrBalance}`)

//     process.exit(0)


// }

async function run(){
    // writeDexInfo()
    // const inputTokens = [usdcContractAddress, movrContractAddress, fraxContractAddress, usdcContractAddress]
    // const inputAmount = 100
    // testBatchSwap(inputTokens, inputAmount)
    // getXcTokens()
    // testXcTokensMoonbase()
    // cleanXcTokenAddresses()
    // let tokenPath = [xcDotContractAddress, wGlmrContractAddress, xcAcaContractAddress ]
    // testXcTokensMoonriver(tokenPath, 0.3, 50)
    // getAllAbis()
    // readDexes()
    // testBatchUnwrap()
    // await testV3Swaps()
    // await testUniV3Swap()
    // await testUniV3SwapContract()
    await testAlgebraSwapContract()
    // await liveUniV3Swap()
}
// 8045943121732945468
// 24124090793978129408
// run()