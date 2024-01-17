import '@moonbeam-network/api-augment/moonriver'

import { ApiPromise, Keyring, WsProvider } from '@polkadot/api';
// import { MangataInstance, Mangata, MultiswapBuyAsset, MultiswapSellAsset } from "@mangata-finance/sdk"
// import { BN } from '@polkadot/util';
import { createPublicClient, http, createWalletClient, formatEther, webSocket } from 'viem';
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
// import { calculateSwapAmountRouterFormula } from './utils/utils';
// import __dirname from './dirname.js';

const mnemonic = 'bottom drive obey lake curtain smoke basket hold race lonely fit walk';
let privateKey = "0x5fb92d6e98884f76de468fa3f6278f8807c48bebc13595d45af5bdc4da702133"
let noPrefixPrivateKey = privateKey.slice(2)

const wsLocalChain = "ws://172.26.130.75:8000"
const defaultWebsocket = "wss://moonriver.public.blastapi.io"
const defaultRpc = "https://moonriver.public.blastapi.io"
const localRpc = "http://127.0.0.1:8545/"

const rpcUrl = wsLocalChain
const account = privateKeyToAccount(`0x${noPrefixPrivateKey}`);
// const rpcUrl = 'INSERT_RPC_API_ENDPOINT'

let dazzlePolk = "0xAe8Da4A9792503f1eC97eD035e35133A9E65a61f"
const liveWallet = "0x13E8ABE5BE7E43A8a2c3B4C3Ff9752D665c9719E"
const liveWalletPk = "0xb7ee929656517d31fcd447ef58132dee0643960c288987451a217ff6c38d77dd"
const addressFrom = '0xf24FF3a9CF04c71Dbc94D0b566f7A27B94566cac'; //Alith
const addressTo = '0x3Cd0A705a2DC65e5b1E1205896BaA2be8A07c6e0'; //Baltathazar
const xTokensContract = "0x0000000000000000000000000000000000000804"
const wmovrUsdcDexAddress = "0xe537f70a8b62204832b8ba91940b77d3f79aeb81"
const movrContractAddress = "0x98878B06940aE243284CA214f92Bb71a2b032B8A"
const usdcContractAddress = "0xE3F5a90F9cb311505cd691a46596599aA1A0AD7D"
const solarDexRouterAddress = "0xAA30eF758139ae4a7f798112902Bf6d65612045f"
const zenlinkDexRouterAddress = "0x2f84b9713a96FB356683de7B44dd2d37658b189d"
const wmovrRmrkDexAddress = "0xdfeefa89639125d22ca86e28ce87b164f41afae6"
const wmovrRmrkZenlinkAddress = "0x24336393742050233B8eCF873454F724D4083356"
const xcKsmContractAddress = "0xFfFFfFff1FcaCBd218EDc0EbA20Fc2308C778080"
const wmovrKsmDexAddress = "0xea3d1e9e69addfa1ee5bbb89778decd862f1f7c5"

const test_account = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
const test_account_pk = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"

const dexAbis = [
    JSON.parse(fs.readFileSync('./abi/solarDexAbi.json', 'utf8')),
    JSON.parse(fs.readFileSync('./abi/zenlinkDexAbi.json', 'utf8')),
    JSON.parse(fs.readFileSync('./abi/uniswapDexV2Abi.json', 'utf8'))
]
const routerAbis = [
    JSON.parse(fs.readFileSync('./abi/solarRouterAbi.json', 'utf8')),
    JSON.parse(fs.readFileSync('./abi/zenRouterAbi.json', 'utf8')),
    JSON.parse(fs.readFileSync('./abi/huckleberryRouterAbi.json', 'utf8'))
]
const solarRouterAddress = "0xAA30eF758139ae4a7f798112902Bf6d65612045f"
const zenlinkRouterAddress = "0x2f84b9713a96FB356683de7B44dd2d37658b189d"
const huckleberryRouterAddress = "0x2d4e873f9Ab279da9f1bb2c532d4F06f67755b77"
const routerContracts = [
    solarRouterAddress,
    zenlinkRouterAddress,
    huckleberryRouterAddress
]

const movrContractAbi = JSON.parse(fs.readFileSync('./abi/movrContractAbi.json', 'utf8'));
const solarFee = 25 // 0.25%
const zenFee = 30 // 0.3%
const routerFees = [
    solarFee,
    zenFee
]
function calculateSwapAmountRouterFormula(input: bigint, inputReserve: bigint, outputReserve: bigint, slippageTolerance: number, fee: number): bigint{
    // console.log(`Input: ${input}`)
    // const testFee = 25
    // const testSlip = 100
    
    const feeMultiplier = BigInt(10000) - BigInt(fee)
    const slipMultiplier = BigInt(10000) - BigInt(slippageTolerance)

    const amountInWithFee = input * feeMultiplier
    const numerator = amountInWithFee * outputReserve
    const denominator = (inputReserve * BigInt(10000)) + amountInWithFee

    const formulatAmountOut = numerator / denominator
    // console.log(`Formula Amount Out: ${formulatAmountOut}`)

    const amountInWithSlippage = input * slipMultiplier
    const slipNumerator = amountInWithSlippage * outputReserve
    const slipDenominator = (inputReserve * BigInt(10000)) + amountInWithSlippage

    const slippageAmountOut = slipNumerator / slipDenominator
    // console.log(`Slippage Amount Out: ${slippageAmountOut}`)

    const slippageToleranceTest = 0.01
    const slippageNumerator = BigInt(Math.round(slippageToleranceTest * 100))
    const slippageDenominator = BigInt(100)
    let amountOutIdeal: bigint = (outputReserve * input) / (inputReserve + input)
    // console.log(`Amount out ideal: ${amountOutIdeal}`)

    let slippageAmount = (amountOutIdeal * slippageNumerator) / slippageDenominator;
    // console.log(`Slippage Amount: ${slippageAmount}`)

    let amountOutMinusSlippage = amountOutIdeal  - slippageAmount
    // console.log(`Original Calculated Amount Out: ${amountOutMinusSlippage}`)
    // if(amountOutMinusSlippage != slippageAmountOut){
    //     throw new Error("Calculated amount out and Router formula amount out do not match (slippage)")
    // }
    return slippageAmountOut
}

async function executeBatchSwapContract(){
    // let wallets = JSON.parse(fs.readFileSync('./wallets.json', 'utf8'));
    const loggingProvider = new LoggingProvider(localRpc);
    let walletProvider = new ethers.Wallet(test_account_pk, loggingProvider)
    const customContractAbi = JSON.parse(fs.readFileSync('./abi/customSwapContractAbi.json', 'utf8'));
    const solarDexAbi = JSON.parse(fs.readFileSync('./abi/solarDexAbi.json', 'utf8'));

    const customContract = new ethers.Contract(deployedContractAddress, customContractAbi, walletProvider)
    // console.log(JSON.stringify(customContract, null, 2))

    const movrTokenContract = new ethers.Contract(movrContractAddress, movrContractAbi, walletProvider)
    const movrUsdcDexContract = new ethers.Contract(wmovrUsdcDexAddress,solarDexAbi, walletProvider )
    const [reserves0, reserves1, timestamp] = await movrUsdcDexContract.getReserves()
    const amountIn = ethers.parseUnits("0.01", 18);

    const tokens = [movrContractAddress]
    const dex = [wmovrUsdcDexAddress]
    const amounts = [amountIn]
    
    
    const amountOutMin = calculateSwapAmountRouterFormula(amountIn, reserves0, reserves1, 100, 25)
    const amount0Out = 0;
    const amount1Out = amountOutMin;
    const to = walletProvider.address;
    const data = '0x'

    const swapFunction = "swap(uint, uint, address, bytes)"; // Replace with actual function
    const swapParams = [
        amount0Out, // Amount out token 0
        amount1Out, // Amount out token 1
        to, // Recipient address
        data // Transaction deadline
    ];

    const swapCallData = movrUsdcDexContract.interface.encodeFunctionData(swapFunction, swapParams);
    // console.log(JSON.stringify(swapCallData, null, 2))
    
    const movrBalance = await movrTokenContract.balanceOf(walletProvider.address)
    const dexMovrBalance = await movrTokenContract.balanceOf(wmovrUsdcDexAddress)
    console.log(`Wallet Address: ${walletProvider.address} Movr Balance: ${movrBalance}`)
    console.log(`Dex Address: ${wmovrUsdcDexAddress} Movr Balance: ${dexMovrBalance}`)

    const approval = await checkApproval(movrTokenContract, walletProvider.address, deployedContractAddress)
    if(!approval){
        console.log("Approving tokens")
        const approveResults = await movrTokenContract.approve(deployedContractAddress, ethers.MaxUint256)
        const approveReceipt = await approveResults.wait()
        // console.log(JSON.stringify(approveReceipt, null, 2))
    }

    // let callResults = await customContract.transferToken(movrContractAddress,wmovrUsdcDexAddress, amountIn)
    // let callResults = await customContract.getAllowance(movrContractAddress, walletProvider.address)   
    let testData = await customContract.data()
    console.log(JSON.stringify(testData, null, 2))
    // console.log(JSON.stringify(callResults, null, 2))
    // let callResult = await customContract.batchTransferAndSwap(tokens, dex, amounts, [swapCallData])
    // let receipt = await callResults.wait()

    // console.log(JSON.stringify(receipt, null, 2))

    const movrBalanceAfter = await movrTokenContract.balanceOf(walletProvider.address)
    const dexBalanceAfter = await movrTokenContract.balanceOf(wmovrUsdcDexAddress)
    console.log(`Wallet Address: ${walletProvider.address} Movr Balance: ${movrBalanceAfter}`)
    console.log(`Dex Address: ${wmovrUsdcDexAddress} Movr Balance: ${dexBalanceAfter}`)
    // customContract.batchTransferAndSwap()
}
async function checkApproval(tokenContract: ethers.Contract, walletAddress: string, spenderAddress: string) {
    const allowance = await tokenContract.allowance(walletAddress, spenderAddress);
    if (allowance) {
        console.log(`The spender address ${spenderAddress} is approved to spend tokens for the user ${walletAddress}.`);
        return true
    } else {
        console.log(`The spender address ${spenderAddress} is NOT approved to spend tokens for the user ${walletAddress}.`);
        return false
    }
}

const deployedContractAddress = "0x2bdCC0de6bE1f7D2ee689a0342D76F52E8EFABa3"
class LoggingProvider extends ethers.JsonRpcProvider {
    async call(transaction) {
      // Log the transaction data
      console.log("eth_call transaction data:", transaction);
      return super.call(transaction);
    }
  }


  async function main(){
    await executeBatchSwapContract()
  }

    main()