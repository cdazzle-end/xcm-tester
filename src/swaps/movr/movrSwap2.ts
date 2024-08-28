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
import { contract } from 'web3/lib/commonjs/eth.exports';
import BN from 'bn.js';
import {toBigInt} from 'ethers'
import { BigNumberish } from 'ethers';
import { getAssetRegistry } from 'src/utils/utils';
import { MyAsset } from 'src/types/types';
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

const altDexContractAbi = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function getReserves() view returns (uint, uint)",
    "function token0() view returns (address)",
    "function token1() view returns (address)"
]
const dexContractAbi = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function getReserves() view returns (uint, uint, uint)",
    "function token0() view returns (address)",
    "function token1() view returns (address)"
]
const tokenContractAbi = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "event Transfer(address indexed src, address indexed dst, uint val)"
]

async function testWeb3(){
    let web3 = await new Web3(defaultWebsocket);
    let abiPath = path.join('./../testContractAbi.json')
    let contractAbi = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
    
    // // web3.Contract
    // const contractABI = contractAbi;
    const contract = new web3.eth.Contract(contractAbi, wmovrUsdcDexAddress);
    console.log(contract)
    const callAbi = contract.methods.getReserves().encodeABI()
    console.log(callAbi)
    // const inputData = contract.methods.yourFunctionName(param1, param2).encodeABI();
    // console.log(JSON.stringify(contract, null, 2))
    // contract.methods.getReserves().call().then((res: any) => {
    //     console.log(res)
    // })
    console.log("TEST")

    const provider = new WsProvider(wsLocalChain);
    const api = await ApiPromise.create({ provider });
  

    const source = addressFrom;
    const target = wmovrUsdcDexAddress;
    const input = callAbi; // From step 2
    const value = 0; // Adjust if you need to send value
    const gasLimit = 373650
    const maxFeePerGas = 3207000000
    const maxPriorityFeePerGas = 0
    const nonce = 0
    // const index = await web3.eth.getTransactionCount(addressFrom)
    // console.log(index)
    const accessList = []; // If needed
    // const signedTx = await web3.eth.accounts.signTransaction({/* transaction data */}, privateKey);
    // const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    const call = api.tx.evm.call(source, target, input, value, gasLimit, maxFeePerGas, maxPriorityFeePerGas, nonce, accessList)
    // api.rpc.evm.call
    console.log(call.toHuman())

    // let privateKey = "0x5fb92d6e98884f76de468fa3f6278f8807c48bebc13595d45af5bdc4da702133"
    const keyring = new Keyring({ type: 'ethereum' });
    const index = 0;
    let ethDerPath = `m/44'/60'/0'/0/${index}`;
    const alice = keyring.addFromUri(`${privateKey}/${ethDerPath}`)
    let result = await call.signAndSend(alice)
    console.log(result)
    // api.tx.evm.call(target, input, value, gasLimit, maxFeePerGas, maxPriorityFeePerGas, nonce, accessList)


}
async function ethersTest(){
    let testContractPath = path.join('./../testContractAbi.json')
    let contractAbi = JSON.parse(fs.readFileSync(testContractPath, 'utf8'));

    let movrContractPath = path.join('./../movrContract.json')
    let movrContractAbi = JSON.parse(fs.readFileSync(testContractPath, 'utf8'));

    // Use the LoggingProvider instead of the standard provider
    const loggingProvider = new LoggingProvider(localRpc);
    const poolLogger = new ethers.Contract(wmovrUsdcDexAddress, contractAbi, loggingProvider);

    const movrToken = new ethers.Contract(movrContractAddress, movrContractAbi, loggingProvider);

    // Now calling getReserves will log the transaction data
    let reserves = await poolLogger.getReserves();
    console.log("Reserves: ", reserves)
    // let reserves = await pool.getReserves();
}

async function wrapMovr(){
    const loggingProvider = new LoggingProvider(localRpc);
    const wallet = await new ethers.Wallet(test_account_pk, loggingProvider)
    let movrContractPath = path.join('./../movrContract.json')
    let movrContractAbi = JSON.parse(fs.readFileSync(movrContractPath, 'utf8'));

    const movrToken = new ethers.Contract(movrContractAddress, movrContractAbi, wallet);

    console.log(JSON.stringify(movrToken, null, 2))

    const movrAmount = ethers.parseUnits("100", 18); // 10 Token A

    const depositTransaction = {
        to: movrContractAddress, // The address of the WMOVR contract
        value: movrAmount // The amount of MOVR to deposit
    };
    
    let tx = await wallet.sendTransaction(depositTransaction);
    let receipt = await tx.wait();
    console.log(receipt);
}

async function checkMovrBalance(){
    const loggingProvider = new LoggingProvider(localRpc);
    const wallet = await new ethers.Wallet(test_account_pk, loggingProvider)
    let movrContractPath = path.join('./../movrContract.json')
    let movrContractAbi = JSON.parse(fs.readFileSync(movrContractPath, 'utf8'));

    const movrToken = new ethers.Contract(movrContractAddress, movrContractAbi, wallet);

    const balance = await movrToken.balanceOf(wallet.address);
    console.log("Balance: ", balance.toString())
}

async function solarRouterWmovrUsdc(){
    const loggingProvider = new LoggingProvider(localRpc);
    const wallet = await new ethers.Wallet(test_account_pk, loggingProvider)

    let testDexContractPath = path.join('./../testContractAbi.json')
    let movrUsdcDexContractAbi = JSON.parse(fs.readFileSync(testDexContractPath, 'utf8'));

    let movrContractPath = path.join('./../movrContract.json')
    let movrContractAbi = JSON.parse(fs.readFileSync(movrContractPath, 'utf8'));

    let solarContractPath = path.join('./../solarRouterContract.json')
    let solarContractAbi = JSON.parse(fs.readFileSync(solarContractPath, 'utf8'));
    
    const wmovrUsdcDexContract = new ethers.Contract(wmovrUsdcDexAddress, movrUsdcDexContractAbi, wallet);
    const movrToken = new ethers.Contract(movrContractAddress, movrContractAbi, wallet);
    const solarRouter = new ethers.Contract(solarDexRouterAddress, solarContractAbi, wallet);

    let [reserve0, reserve1, timestamp] = await wmovrUsdcDexContract.getReserves()
    const reserve0BigInt = ethers.toBigInt(reserve0.toString())
    const reserve1BigInt = ethers.toBigInt(reserve1.toString())
    console.log("Reserve 0: ", reserve0.toString())
    console.log("Reserve 1: ", reserve1.toString())

    const amountInBigInt = ethers.parseUnits("0.01", 18); // 10 Token A

    console.log("Amount in BigInt: ", amountInBigInt)
    console.log("Reserve 0 BigInt: ", reserve0BigInt)
    console.log("Reserve 1 BigInt: ", reserve1BigInt)
    const calculatedAmountOutBigInt = calculateSwapAmountBigInt(amountInBigInt, toBigInt(reserve0), toBigInt(reserve1), 0.01)
    console.log("Calculated amount out BigInt: ", calculatedAmountOutBigInt)
    const addy: ethers.AddressLike = wallet.address
    
    let approved = await checkApproval(movrToken, addy, solarDexRouterAddress)
    console.log("Approved: ", approved)

    const dexPath: ethers.AddressLike[] = ["0x98878B06940aE243284CA214f92Bb71a2b032B8A", "0xE3F5a90F9cb311505cd691a46596599aA1A0AD7D" ] // MOVR -> USDC -> RMRK"0xffffffFF893264794d9d57E1E0E21E0042aF5A0A"
    const deadline = Math.floor(Date.now() / 1000) + 900;

    // amountIn, amountOutMin, path, to, deadline
    // const swapWmovrForUsdcTx = await solarRouter.swapExactTokensForTokens(amountInBigInt, calculatedAmountOutBigInt, dexPath, addy, deadline, {gasLimit: 10000000, maxPriorityFeePerGas: 853687807, maxFeePerGas: ethers.parseUnits("100", "gwei")})

    const swapEthForTokensTx = await solarRouter.swapExactETHForTokens(calculatedAmountOutBigInt, dexPath, addy, deadline, {gasLimit: 10000000, maxPriorityFeePerGas: 853687807, maxFeePerGas: ethers.parseUnits("100", "gwei"), value: amountInBigInt })
    const receipt = await swapEthForTokensTx.wait()
    console.log(receipt)
}
async function swapWmovrUsdc(){
    const loggingProvider = new LoggingProvider(localRpc);
    const wallet = await new ethers.Wallet(test_account_pk, loggingProvider)

    let wmovrUsdcDexContractPath = path.join('./../testContractAbi.json')
    let wmovrUsdcDexContractAbi = JSON.parse(fs.readFileSync(wmovrUsdcDexContractPath, 'utf8'));

    let movrContractPath = path.join('./../movrContract.json')
    let movrContractAbi = JSON.parse(fs.readFileSync(movrContractPath, 'utf8'));

    
    const wmovrUsdcDexContract = new ethers.Contract(wmovrUsdcDexAddress, wmovrUsdcDexContractAbi, wallet);
    const wmovrToken = new ethers.Contract(movrContractAddress, movrContractAbi, wallet);

    let [reserve0, reserve1, timestamp] = await wmovrUsdcDexContract.getReserves()
    const reserve0BigInt = ethers.toBigInt(reserve0.toString())
    const reserve1BigInt = ethers.toBigInt(reserve1.toString())
    console.log("Reserve 0: ", reserve0.toString())
    console.log("Reserve 1: ", reserve1.toString())

    const amountInBigInt = ethers.parseUnits("0.01", 18); // 10 Token A
    // The spender address 0xe537f70a8b62204832b8ba91940b77d3f79aeb81 is approved to spend tokens for the user 0x70997970C51812dc3A010C7d01b50e0d17dc79C8.
    // The spender address 0xe537f70a8b62204832b8ba91940b77d3f79aeb81 is not approved to spend tokens for the user 0x70997970C51812dc3A010C7d01b50e0d17dc79C8.
    console.log("Amount in BigInt: ", amountInBigInt)
    console.log("Reserve 0 BigInt: ", reserve0BigInt)
    console.log("Reserve 1 BigInt: ", reserve1BigInt)
    const calculatedAmountOutBigInt = calculateSwapAmountBigInt(amountInBigInt, toBigInt(reserve0), toBigInt(reserve1), 0.01)
    console.log("Calculated amount out BigInt: ", calculatedAmountOutBigInt)
    const addy: ethers.AddressLike = wallet.address
    
    let approved = await checkApproval(wmovrToken, addy, wmovrUsdcDexAddress)
    console.log("Approved: ", approved)

    // amountIn, amountOutMin, path, to, deadline
    // const swapWmovrForUsdcTx = await solarRouter.swapExactTokensForTokens(amountInBigInt, calculatedAmountOutBigInt, dexPath, addy, deadline, {gasLimit: 10000000, maxPriorityFeePerGas: 853687807, maxFeePerGas: ethers.parseUnits("100", "gwei")})
    const currentMovrBalance = await checkWMOVRBalance()
    const currentUsdcBalance = await checkUSDCBalance()
    console.log(`Current MOVR balance: ${currentMovrBalance} --- Current USDC balance: ${currentUsdcBalance}`)

    const transferTx = await wmovrToken.transfer(wmovrUsdcDexAddress, amountInBigInt)
    const transferReceipt = await transferTx.wait()
    console.log(transferReceipt)
    const receipt = await wmovrUsdcDexContract.swap(0, calculatedAmountOutBigInt, addy, '0x',)
    // const swapEthForTokensTx = await solarRouter.swapExactETHForTokens(calculatedAmountOutBigInt, dexPath, addy, deadline, {gasLimit: 10000000, maxPriorityFeePerGas: 853687807, maxFeePerGas: ethers.parseUnits("100", "gwei"), value: amountInBigInt })
    // const receipt = await swapEthForTokensTx.wait()
    const postMovrBalance = await checkWMOVRBalance()
    const postUsdcBalance = await checkUSDCBalance()
    console.log(`Post MOVR balance: ${postMovrBalance} --- Post USDC balance: ${postUsdcBalance}`)
    console.log(receipt)
}
async function testDex(){
    const loggingProvider = new LoggingProvider(localRpc);
    const wallet = await new ethers.Wallet(test_account_pk, loggingProvider)

    let testDexContractPath = path.join('./../testContractAbi.json')
    let testDexContractAbi = JSON.parse(fs.readFileSync(testDexContractPath, 'utf8'));

    let movrContractPath = path.join('./../movrContract.json')
    let movrContractAbi = JSON.parse(fs.readFileSync(movrContractPath, 'utf8'));

    let solarContractPath = path.join('./../solarRouterContract.json')
    let solarContractAbi = JSON.parse(fs.readFileSync(solarContractPath, 'utf8'));
    
    const testDexContract = new ethers.Contract(wmovrRmrkDexAddress, testDexContractAbi, wallet);
    const movrToken = new ethers.Contract(movrContractAddress, movrContractAbi, wallet);
    const solarRouter = new ethers.Contract(solarDexRouterAddress, solarContractAbi, wallet);

    let [reserve0, reserve1, timestamp] = await testDexContract.getReserves()
    let reserve0BN = new BN(reserve0.toString())
    let reserve1BN = new BN(reserve1.toString())
    console.log("Reserve 0: ", reserve0.toString())
    console.log("Reserve 1: ", reserve1.toString())
    // Define the parameters
    const amountInTokenASwap = ethers.parseUnits("1", 18); // 10 Token A
    const amountInBN = new BN(amountInTokenASwap.toString())
    // const amountInBigInt = new BigInt(amountInt)
    const amountOutTokenSwap = calculateSwapAmount(amountInBN, reserve0BN, reserve1BN)

    const outBigInt = ethers.toBigInt(amountOutTokenSwap.toString())
    const amountOutTest = ethers.toBigInt(100)

    console.log("Amount in: ", amountInTokenASwap.toString())
    console.log("Amount out: ", amountOutTokenSwap.toString())

    console.log("Out Big Int: ", outBigInt)

    const amountInBigInt = ethers.parseUnits("1", 18); // 10 Token A
    const amountOut0 = ethers.toBigInt(0)
    const amountOut1 = amountOutTest
    const to = wallet.address
    const data = '0x'

    const quote = await solarRouter.quote(amountInBigInt, reserve0, reserve1)
    console.log("Quote: ", quote)
    const reserve0BigInt = ethers.toBigInt(reserve0.toString())
    const reserve1BigInt = ethers.toBigInt(reserve1.toString())
    console.log("Amount in BigInt: ", amountInBigInt)
    console.log("Reserve 0 BigInt: ", reserve0BigInt)
    console.log("Reserve 1 BigInt: ", reserve1BigInt)
    const calculatedAmountOut = calculateSwapAmount(amountInBN, reserve0BN, reserve1BN)
    const calculatedAmountOutBigInt = calculateSwapAmountBigInt(amountInBigInt, toBigInt(reserve0), toBigInt(reserve1), 0.01)
    console.log("Calculated amount out: ", calculatedAmountOut.toString())
    console.log("Calculated amount out BigInt: ", calculatedAmountOutBigInt)
    // const tx = await dexContract.swap(amountOut0, amountOut1, to, data)
    // const receipt = await tx.wait()
    const addy: ethers.AddressLike = wallet.address
    
    const amountOutMinQuote = quote;
    const dexPath: ethers.AddressLike[] = [movrToken.getAddress(), wmovrRmrkDexAddress]
    const deadline = Math.floor(Date.now() / 1000) + 900;
    console.log("DEADLINE: ", deadline)

    // console.log(JSON.stringify(solarRouter, null, 2))

    const value = ethers.parseUnits("1", 18)
    // const tx = await solarRouter.swapExactETHForTokens(calculatedAmountOutBigInt, dexPath, wallet.address, deadline, {gasLimit: 10000000, maxPriorityFeePerGas: 853687807, maxFeePerGas: ethers.parseUnits("100", "gwei"), value: value })
    const tx = await testDexContract.swap(amountOut1, quote, wallet.address, data, {value: value, gasLimit: 10000000, maxPriorityFeePerGas: 853687807, maxFeePerGas: ethers.parseUnits("100", "gwei")})
    const receipt = await tx.wait()
    console.log(receipt)
    // const amountTokenBReceive = ethers.parseUnits("5.0", 6); // Expecting 5 Token B
    // const recipientAddress = wallet.address; // Your address to receive Token B
}

async function checkWMOVRBalance(){ 
    let movrContractPath = path.join('./../movrContract.json')
    let movrContractAbi = JSON.parse(fs.readFileSync(movrContractPath, 'utf8'));
    return checkBalance(movrContractAddress, test_account, movrContractAbi)
}
async function checkUSDCBalance(){
    let usdcContractPath = path.join('./../usdcContractAbi.json')
    let usdcContractAbi = JSON.parse(fs.readFileSync(usdcContractPath, 'utf8'));
    return checkBalance(usdcContractAddress, test_account, usdcContractAbi)

}
async function checkBalance(tokenContractAddress:string, walletAddress:string, contractAbi: any){
    
    const loggingProvider = new LoggingProvider(localRpc);
    const wallet = await new ethers.Wallet(test_account_pk, loggingProvider)
    const tokenContract = new ethers.Contract(tokenContractAddress, contractAbi, wallet);
    const balance = await tokenContract.balanceOf(walletAddress)
    // console.log("Balance: ", balance.toString())
    return balance
}
async function checkApprovalWithRouter(){
    const loggingProvider = new LoggingProvider(localRpc);
    const wallet = await new ethers.Wallet(test_account_pk, loggingProvider)

    let testDexContractPath = path.join('./../testContractAbi.json')
    let testDexContractAbi = JSON.parse(fs.readFileSync(testDexContractPath, 'utf8'));

    let movrContractPath = path.join('./../movrContract.json')
    let movrContractAbi = JSON.parse(fs.readFileSync(movrContractPath, 'utf8'));

    let solarContractPath = path.join('./../solarRouterContract.json')
    let solarContractAbi = JSON.parse(fs.readFileSync(solarContractPath, 'utf8'));
    
    const movrToken = new ethers.Contract(movrContractAddress, movrContractAbi, wallet);
    const solarRouter = new ethers.Contract(solarDexRouterAddress, solarContractAbi, wallet);
    const testDexContract = new ethers.Contract(wmovrUsdcDexAddress, testDexContractAbi, wallet);

    const approved = await checkApproval(movrToken, test_account, wmovrUsdcDexAddress)
    if(!approved){
        console.log("Not approved")
        let approvalResult = await approve(movrToken, wmovrUsdcDexAddress)
        console.log(approvalResult)
    } else {
        console.log("Approved")
    }

}
function calculateSwapAmount(inputAmount: BN, inputReserve: BN, outputReserve: BN){
    console.log("BN")
    const slippageTolerance = 0.01
    // const number1: BigNumberish = 0.5
    // console.log("Number: ", number1.toString())
    console.log("Slippage tolerance: ", slippageTolerance.toString())
    let amountOutIdeal: BN = outputReserve.mul(inputAmount).div(inputReserve.add(inputAmount))
    console.log("Amount out ideal: ", amountOutIdeal.toString())
    const amountOutIdealNumber = amountOutIdeal.toNumber()
    const slippageAmount = amountOutIdealNumber * (slippageTolerance/1)
    console.log("Slippage amount: ", slippageAmount)
    const slipAmountBN = new BN(slippageAmount)
    const amountOutMinusSlippage = amountOutIdeal.sub(slipAmountBN)
    console.log("Amount out minus slippage: ", amountOutMinusSlippage.toString())
    // const amountOutMin = amountOutIdeal.mul(new BN(1).sub(slippageTolerance))
    // console.log("Amount out minus slippage: ", amountOutMin.toString())

    return amountOutMinusSlippage
}
function calculateSwapAmountBigInt(input: bigint, inputReserve: bigint, outputReserve: bigint, slippageTolerance: number){
    const slippageNumerator = BigInt(Math.round(slippageTolerance * 100))
    const slippageDenominator = BigInt(100)
    let amountOutIdeal: bigint = (outputReserve * input) / (inputReserve + input)
    console.log(`Amount out ideal: ${amountOutIdeal}`)

    let slippageAmount = (amountOutIdeal * slippageNumerator) / slippageDenominator;
    console.log(`Slippage Amount: ${slippageAmount}`)

    let amountOutMinusSlippage = amountOutIdeal  - slippageAmount
    console.log(`Input: ${input} -- Calculate Output: ${amountOutMinusSlippage}`)
    return amountOutMinusSlippage
}
function calculateSwapAmountRouterFormula(input: bigint, inputReserve: bigint, outputReserve: bigint, slippageTolerance: number, fee: number){
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
async function checkApproval(tokenContract: ethers.Contract, walletAddress: string, spenderAddress: string) {
    const allowance = await tokenContract.allowance(walletAddress, spenderAddress);
    // console.log("Allowance: ", allowance.toString());

    // If the allowance is greater than 0, then there is some level of approval
    if (allowance) {
        console.log(`The spender address ${spenderAddress} is approved to spend tokens for the user ${walletAddress}.`);
        return true
    } else {
        console.log(`The spender address ${spenderAddress} is NOT approved to spend tokens for the user ${walletAddress}.`);
        return false
    }
}
async function approve(tokenContractWithSigner: ethers.Contract, spenderAddress: string) {
    const maxAmount = ethers.MaxUint256;
    let approvalResult = await tokenContractWithSigner.approve(spenderAddress, maxAmount)
    return approvalResult
}
class LoggingProvider extends ethers.JsonRpcProvider {
    async call(transaction) {
      // Log the transaction data
      console.log("eth_call transaction data:", transaction);
      return super.call(transaction);
    }
  }

async function testLiveMovrRmrkSwap(){
    const loggingProvider = new LoggingProvider(defaultRpc);
    const wallet = await new ethers.Wallet(test_account_pk, loggingProvider)

    let testDexContractPath = path.join('./../testContractAbi.json')
    let testDexContractAbi = JSON.parse(fs.readFileSync(testDexContractPath, 'utf8'));

    let movrContractPath = path.join('./../movrContract.json')
    let movrContractAbi = JSON.parse(fs.readFileSync(movrContractPath, 'utf8'));

    let solarContractPath = path.join('./../solarRouterContract.json')
    let solarContractAbi = JSON.parse(fs.readFileSync(solarContractPath, 'utf8'));
    
    const testDexContract = new ethers.Contract(wmovrRmrkDexAddress, testDexContractAbi, wallet);
    const movrToken = new ethers.Contract(movrContractAddress, movrContractAbi, wallet);
    const solarRouter = new ethers.Contract(solarDexRouterAddress, solarContractAbi, wallet);

    const value = ethers.parseUnits("0.01", 18)
    console.log(value.toString())
    // 10000000000000000
    let [reserve0, reserve1, timestamp] = await testDexContract.getReserves()
    let reserve0BN = new BN(reserve0.toString())
    let reserve1BN = new BN(reserve1.toString())
    console.log("Reserve 0: ", reserve0.toString())
    console.log("Reserve 1: ", reserve1.toString())

    const calculatedAmountOutBigInt = calculateSwapAmountBigInt(value, toBigInt(reserve0), toBigInt(reserve1), 0.01)
    console.log("Calculated amount out BigInt: ", calculatedAmountOutBigInt.toString())

    const deadline = Math.floor(Date.now() / 1000) + 900;
    console.log("DEADLINE: ", deadline)
    // const tx = await testDexContract.swap(calculatedAmountOutBigInt, calculatedAmountOutBigInt, wallet.address, data, {value: value, gasLimit: 10000000, maxPriorityFeePerGas: 853687807, maxFeePerGas: ethers.parseUnits("100", "gwei")})
    // const receipt = await tx.wait()
    // console.log(receipt)
}


function checkForSubstrateToken(address: string){
    if(address.startsWith("0x") || address == "MOVR"){
        // console.log("Not a substrate token")
        return false
    } else {
        const assetRegistry: MyAsset[] = getAssetRegistry('kusama')
        const substrateToken = assetRegistry.find((asset: any) => asset.tokenData.localId == address)
        if(substrateToken){
            return true
        } else {
            throw new Error("Cant find substrate token")
        }
    }
}

interface DexResult{
    dexContractAddress: string,
    nonce: number,
    success: boolean,
    dexType?: string,
    token0: string,
    token1: string,
    token0Symbol?: string,
    token1Symbol?: string,
    preSwapBalance0?: string,
    preSwapBalance1?: string,
    postSwapBalance0?: string,
    postSwapBalance1?: string
}
async function testAllMovrPoolsWithRouter(){
    clearResultLog()
    const allLps = JSON.parse(fs.readFileSync('./lps.json', 'utf8'));
    let movrLps = allLps.filter((lp: any) => lp.poolAssets[0] == "MOVR" || lp.poolAssets[1] == "MOVR")
    let solarRouterContractPath = path.join('./../solarRouterContract.json')
    let solarRouterContractAbi = JSON.parse(fs.readFileSync(solarRouterContractPath, 'utf8'));
    let zenlinkDexContractAbi = JSON.parse(fs.readFileSync('./abi/zenlinkDexAbi.json', 'utf8'));
    let zenlinkRouterContractPath = path.join('./abi/zenRouterAbi.json')
    let zenlinkRouterContractAbi = JSON.parse(fs.readFileSync(zenlinkRouterContractPath, 'utf8'));

    // Substrate tokens are system contracts and not supported on hardhat
    movrLps = movrLps.filter((lp: any) =>{
        if(checkForSubstrateToken(lp.poolAssets[0]) || checkForSubstrateToken(lp.poolAssets[1])){
            // console.log(`Found substrate asset -- ${lp.poolAssets[0]} -- ${lp.poolAssets[1]}`)
            return false
        }
        // console.log("No substrate asset")
        return true
    })
    const loggingProvider = new LoggingProvider(localRpc);
    const wallet = await new ethers.Wallet(test_account_pk, loggingProvider)

    let dexSwapResults: DexResult[] = []
    movrLps = movrLps.slice(0, 10)
    const nonce = await wallet.getNonce()
    for (const lp of movrLps) {
        console.log(JSON.stringify(lp, null, 2));
        // let result =  await executeRouterSwap(lp, wallet, solarRouterContractAbi, "solar", nonce);
        try {
            let result =  await executeRouterSwap(lp, wallet, solarRouterContractAbi, "solar");
            dexSwapResults.push(result)
        } catch (e) {
            console.error("Error with primary ABI, trying fallback:", e);
            try {
                let result = await executeRouterSwap(lp, wallet, zenlinkRouterContractAbi, "zenlink");
                dexSwapResults.push(result)
            } catch (fallbackError) {
                console.error("Fallback also failed:", fallbackError);
                // Handle the case where both attempts fail, if necessary
                
                let result = {
                    dexContractAddress: lp.contractAddress,
                    success: false,
                    token0: lp.poolAssets[0],
                    token1: lp.poolAssets[1],
                    nonce: nonce
                }
                logRouterError(result, e)
                dexSwapResults.push(result)
            }
        }
        
    }

    fs.writeFileSync('./routerSwapResults.json', JSON.stringify(dexSwapResults, null, 2));
}
async function executeRouterSwap(lp: any, wallet: ethers.Wallet, routerAbi: any, routerType: string): Promise<DexResult>{
        
    let solarDexContractPath = path.join('./../testContractAbi.json')
    let solarDexContractAbi = JSON.parse(fs.readFileSync(solarDexContractPath, 'utf8'));
    let zenlinkDexContractAbi = JSON.parse(fs.readFileSync('./abi/zenlinkDexAbi.json', 'utf8'));

    let movrContractPath = path.join('./../movrContract.json')
    let movrContractAbi = JSON.parse(fs.readFileSync(movrContractPath, 'utf8'));
    
    const routerContract = new ethers.Contract(solarDexRouterAddress, routerAbi, wallet);
    const wmovrToken = new ethers.Contract(movrContractAddress, movrContractAbi, wallet);

    const dexContractAddress = lp.contractAddress
    const dexContract = new ethers.Contract(dexContractAddress, solarDexContractAbi, wallet);
    let [reserve0, reserve1, timestamp] = await dexContract.getReserves()

    const token0 = lp.poolAssets[0] == "MOVR" ? movrContractAddress : lp.poolAssets[0]
    const token1 = lp.poolAssets[1] == "MOVR" ? movrContractAddress : lp.poolAssets[1]
    
    const token0Contract = token0 == movrContractAddress ? new ethers.Contract(movrContractAddress, movrContractAbi, wallet) : new ethers.Contract(token0, movrContractAbi, wallet)
    const token1Contract = token1 == movrContractAddress ? new ethers.Contract(movrContractAddress, movrContractAbi, wallet) : new ethers.Contract(token1, movrContractAbi, wallet)
    const token0Decimals = await token0Contract.decimals()
    const token0Symbol = await token0Contract.symbol()
    const token1Decimals = await token1Contract.decimals()
    const token1Symbol = await token1Contract.symbol()

    console.log(`Token 0: ${token0} decimals: ${token0Decimals} symbol: ${token0Symbol}`)
    console.log(`Token 1: ${token1} decimals: ${token1Decimals} symbol: ${token1Symbol}`)

    const addy: ethers.AddressLike = wallet.address

    let approved = await checkApproval(wmovrToken, addy, solarDexRouterAddress)
    console.log("Approved: ", approved)
    if(!approved){
        let approvalResult = await approve(wmovrToken, solarDexRouterAddress)
        console.log(approvalResult)
    }

    let balance0 = await token0Contract.balanceOf(wallet.address)
    let balance1 = await token1Contract.balanceOf(wallet.address)

    let [preSwapBalance0, preSwapBalance1] = [balance0, balance1]
    let [postSwapBalance0, postSwapBalance1] = [0,0]

    const dexPath: ethers.AddressLike[] = [token0, token1 ]
    const deadline = Math.floor(Date.now() / 1000) + 900;
    const nonce = await wallet.getNonce()
    const amountIn = ethers.parseUnits("0.01", 18)
    const reserveA = lp.poolAssets[0] == "MOVR" ? reserve0 : reserve1
    const reserveB = lp.poolAssets[1] == "MOVR" ? reserve0 : reserve1
    const amountOut = routerContract.quote(amountIn, reserveA, reserveB)
    console.log(`WMOVR balance: ${balance0} --- ${token1Symbol} Balance: ${balance1}`)
    // const calculatedAmountOutBigInt = calculateSwapAmountBigInt(inputMovrValue, toBigInt(reserve0), toBigInt(reserve1), 0.01)
    const routerSwapTx = await routerContract.swapExactTokensForTokens(amountIn, amountOut, dexPath, addy, deadline, {gasLimit: 10000000, maxPriorityFeePerGas: 853687807, maxFeePerGas: ethers.parseUnits("100", "gwei")})
    const receipt = await routerSwapTx.wait()
    console.log(receipt)
    postSwapBalance0 = await token0Contract.balanceOf(wallet.address)
    postSwapBalance1 = await token1Contract.balanceOf(wallet.address)
    console.log(`Post WMOVR balance: ${postSwapBalance0} --- Post ${token1Symbol} Balance: ${postSwapBalance1}`)

    // if(token0Symbol == "WMOVR"){
    //     console.log(`WMOVR balance: ${balance0} --- ${token1Symbol} Balance: ${balance1}`)
    //     // const calculatedAmountOutBigInt = calculateSwapAmountBigInt(inputMovrValue, toBigInt(reserve0), toBigInt(reserve1), 0.01)
    //     const routerSwapTx = await routerContract.swapExactTokensForTokens(amountIn, amountOut, dexPath, addy, deadline, {gasLimit: 10000000, maxPriorityFeePerGas: 853687807, maxFeePerGas: ethers.parseUnits("100", "gwei")})
    //     const receipt = await routerSwapTx.wait()
    //     console.log(receipt)
    //     postSwapBalance0 = await token0Contract.balanceOf(wallet.address)
    //     postSwapBalance1 = await token1Contract.balanceOf(wallet.address)
    //     console.log(`Post WMOVR balance: ${postSwapBalance0} --- Post ${token1Symbol} Balance: ${postSwapBalance1}`)
    // } else {
    //     console.log(`WMOVR balance: ${balance1} --- ${token0Symbol} Balance: ${balance0}`)
    //     const calculatedAmountOutBigInt = calculateSwapAmountBigInt(inputMovrValue, toBigInt(reserve1), toBigInt(reserve0), 0.01)
    //     const tx = await routerContract.swap(calculatedAmountOutBigInt, 0, wallet.address, '0x')
    //     const receipt = await tx.wait()
    //     console.log(receipt)
    //     postSwapBalance0 = await token0Contract.balanceOf(wallet.address)
    //     postSwapBalance1 = await token1Contract.balanceOf(wallet.address)
    //     console.log(`Post WMOVR balance: ${postSwapBalance1} --- Post ${token0Symbol} Balance: ${postSwapBalance0}`)
    // }
    // logSuccess(lp.contractAddress, dexType, token0, token0Symbol, token1, token1Symbol, preSwapBalance0.toString(), preSwapBalance1.toString(), postSwapBalance0.toString(), postSwapBalance1.toString())
    let result = {
        dexContractAddress: lp.contractAddress,
        nonce: nonce,
        success: true,
        dexType: routerType,
        token0: token0,
        token1: token1,
        token0Symbol: token0Symbol,
        token1Symbol: token1Symbol,
        preSwapBalance0: preSwapBalance0.toString(),
        preSwapBalance1: preSwapBalance1.toString(),
        postSwapBalance0: postSwapBalance0.toString(),
        postSwapBalance1: postSwapBalance1.toString(),

    }
    logRouterSuccess(result)
    return result
}
async function clearResultLog(){
    fs.writeFileSync('./movrDexSwapResults.log', "")
    fs.writeFileSync('./movrDexSwapErrors.log', "")
}
async function testAllMovrPoolsAsync(){
    clearResultLog()
    const allLps = JSON.parse(fs.readFileSync('./lps.json', 'utf8'));
    let movrLps = allLps.filter((lp: any) => lp.poolAssets[0] == "MOVR" || lp.poolAssets[1] == "MOVR")
    let solarDexContractPath = path.join('./../testContractAbi.json')
    let solarDexContractAbi = JSON.parse(fs.readFileSync(solarDexContractPath, 'utf8'));
    let zenlinkDexContractAbi = JSON.parse(fs.readFileSync('./abi/zenlinkDexAbi.json', 'utf8'));

    movrLps = movrLps.filter((lp: any) =>{
        if(checkForSubstrateToken(lp.poolAssets[0]) || checkForSubstrateToken(lp.poolAssets[1])){
            return false
        }
        return true
    })
    movrLps = movrLps.slice(0,2)
    const loggingProvider = new LoggingProvider(localRpc);
    const wallet = await new ethers.Wallet(test_account_pk, loggingProvider)

    let dexSwapResults: DexResult[] = []
    let nonce = await wallet.getNonce()
    const swapPromises = movrLps.map(lp => {
        const currentNonce = nonce;
        nonce = nonce + 2;
        return testSwap(lp, wallet, solarDexContractAbi, zenlinkDexContractAbi, currentNonce)
            .then(result => dexSwapResults.push(result))
            .catch(error => {
                console.error("Error during swap with nonce", currentNonce, ":", error);
                
                let result = {
                    dexContractAddress: lp.contractAddress,
                    nonce: currentNonce,
                    success: false,
                    token0: lp.poolAssets[0],
                    token1: lp.poolAssets[1]
                };
                logErrorForPool(result, error);
                dexSwapResults.push(result);
            });
    });

    await Promise.allSettled(swapPromises);

    fs.writeFileSync('./asyncDexSwapResults.json', JSON.stringify(dexSwapResults, null, 2));
}
async function testSwap(lp, wallet, primaryAbi, fallbackAbi, nonce: number) {
    try {
        return await executeSwap(lp, wallet, primaryAbi, "solar", nonce);
    } catch (primaryError) {
        console.error("Error with primary ABI, trying fallback:", primaryError);
        return await executeSwap(lp, wallet, fallbackAbi, "zenlink", nonce);
    }
}
async function testAllMovrPools(){
    clearResultLog()
    fs.writeFileSync('./resultLogs/transactions.log', "")
    fs.writeFileSync('./resultLogs/transactionsErrors.log', JSON.stringify([]))
    fs.writeFileSync('./resultLogs/txSuccessOrFail.log', "")
    fs.writeFileSync('./resultLogs/transactions.json', JSON.stringify([]))
    fs.writeFileSync('./resultLogs/txSuccessOrFail.json', JSON.stringify([]))
    const allLps = JSON.parse(fs.readFileSync('./lps.json', 'utf8'));
    let movrLps = allLps.filter((lp: any) => lp.poolAssets[0] == "MOVR" || lp.poolAssets[1] == "MOVR")
    let solarDexContractPath = path.join('./../testContractAbi.json')
    let solarDexContractAbi = JSON.parse(fs.readFileSync(solarDexContractPath, 'utf8'));
    let zenlinkDexContractAbi = JSON.parse(fs.readFileSync('./abi/zenlinkDexAbi.json', 'utf8'));

    // Substrate tokens are system contracts and not supported on hardhat
    movrLps = movrLps.filter((lp: any) =>{
        if(checkForSubstrateToken(lp.poolAssets[0]) || checkForSubstrateToken(lp.poolAssets[1])){
            // console.log(`Found substrate asset -- ${lp.poolAssets[0]} -- ${lp.poolAssets[1]}`)
            return false
        }
        // console.log("No substrate asset")
        return true
    })
    // movrLps = movrLps.slice(7, 10)
    const loggingProvider = new LoggingProvider(localRpc);
    const wallet = await new ethers.Wallet(test_account_pk, loggingProvider)

    let dexSwapResults: DexResult[] = []
    let nonce = await wallet.getNonce()
    for (const lp of movrLps) {
        console.log(JSON.stringify(lp, null, 2));
        try {
            let result =  await executeSwap(lp, wallet, solarDexContractAbi, "solar", nonce);
            dexSwapResults.push(result)
        } catch (e) {
            console.error("Error with primary ABI, trying fallback:", e);
            // let errorObject = JSON.parse(e.message)
            logErrorCatch(e)
            try {
                let result = await executeSwap(lp, wallet, zenlinkDexContractAbi, "zenlink", nonce);
                dexSwapResults.push(result)
            } catch (error) {
                // let errorObject = JSON.parse(error.message)
                console.error("Fallback also failed:", JSON.stringify(error));
                // Handle the case where both attempts fail, if necessary
                let failedTxNonce = (await wallet.getNonce()) - 1;
                let result = {
                    dexContractAddress: lp.contractAddress,
                    success: false,
                    nonce: failedTxNonce,
                    token0: lp.poolAssets[0],
                    token1: lp.poolAssets[1],
                }
                logErrorForPool(result, e)
                logErrorCatch(error)
                dexSwapResults.push(result)
            }
        }
        nonce++
        
    }

    fs.writeFileSync('./dexSwapResults.json', JSON.stringify(dexSwapResults, null, 2));
}
function logErrorCatch(errorObject: any){
    fs.appendFileSync('./resultLogs/transactionsErrors.log', JSON.stringify(errorObject, null, 2) + "\n")
}
interface TxResult {
    txType: string,
    dexContractAddress?: string,
    txData: any,
}
async function executeSwap(lp: any, wallet: ethers.Wallet, dexAbi: any, dexType: string, nonceIn: number): Promise<DexResult>{
    
        let movrContractPath = path.join('./../movrContract.json')
        let movrContractAbi = JSON.parse(fs.readFileSync(movrContractPath, 'utf8'));
        console.log("Creating dex contract: ", lp.contractAddress)
        const dexContractAddress = lp.contractAddress
        const dexContract = new ethers.Contract(dexContractAddress, dexAbi, wallet);
        const wmovrToken = new ethers.Contract(movrContractAddress, movrContractAbi, wallet);

        const token0 = await dexContract.token0()
        const token1 = await dexContract.token1()
        
        const token0Contract = token0 == movrContractAddress ? new ethers.Contract(movrContractAddress, movrContractAbi, wallet) : new ethers.Contract(token0, movrContractAbi, wallet)
        const token1Contract = token1 == movrContractAddress ? new ethers.Contract(movrContractAddress, movrContractAbi, wallet) : new ethers.Contract(token1, movrContractAbi, wallet)
        const token0Decimals = await token0Contract.decimals()
        const token0Symbol = await token0Contract.symbol()
        const token1Decimals = await token1Contract.decimals()
        const token1Symbol = await token1Contract.symbol()

        console.log(`Token 0: ${token0} decimals: ${token0Decimals} symbol: ${token0Symbol}`)
        console.log(`Token 1: ${token1} decimals: ${token1Decimals} symbol: ${token1Symbol}`)

        const inputMovrValue = ethers.parseUnits("0.01", 18)
        let [reserve0, reserve1, timestamp] = await dexContract.getReserves()
        console.log("Reserve 0: ", reserve0.toString())
        console.log("Reserve 1: ", reserve1.toString())
        // let address = await dexContract.getAddress()
        const addy: ethers.AddressLike = wallet.address
        // Check and execute approval
        let approved = await checkApproval(wmovrToken, addy, dexContractAddress)
        console.log("Approved: ", approved)
        if(!approved){
            let approvalResult = await approve(wmovrToken, dexContractAddress)
            console.log(approvalResult)
        }

        let balance0 = await token0Contract.balanceOf(wallet.address)
        let balance1 = await token1Contract.balanceOf(wallet.address)
        
        // let transferNonce = nonce;
        // let swapNonce = nonce + 1;
        // let tokenTransfer = await wmovrToken.transfer(dexContractAddress, inputMovrValue, {nonce: transferNonce})
        let transferNonce = await wallet.getNonce()
        try{
            let tokenTransfer = await wmovrToken.transfer(dexContractAddress, inputMovrValue)
            logTransaction({txType: "transfer", txData: tokenTransfer})
            logSuccessOrFail("SUCCESS", "transfer", dexContractAddress, transferNonce)
            let tokenTransferReceipt = await tokenTransfer.wait()
            console.log(tokenTransferReceipt)
        } catch (e){
            logSuccessOrFail("FAIL", "transfer", dexContractAddress, transferNonce)
        }
        
        // nonce++
        let [preSwapBalance0, preSwapBalance1] = [balance0, balance1]
        let [postSwapBalance0, postSwapBalance1] = [0,0]
        let nonce = await wallet.getNonce()
        if(token0Symbol == "WMOVR"){
            console.log(`WMOVR balance: ${balance0} --- ${token1Symbol} Balance: ${balance1}`)
            const calculatedAmountOutBigInt = calculateSwapAmountBigInt(inputMovrValue, toBigInt(reserve0), toBigInt(reserve1), 0.01)
            try{
                const tx = await dexContract.swap(0, calculatedAmountOutBigInt, wallet.address, '0x', {nonce: nonce})
                logTransaction({txType: "swap", dexContractAddress, txData: tx})
                logSuccessOrFail("SUCCESS", "swap solar", dexContractAddress, nonce)
                // const tx = await dexContract.swap(0, calculatedAmountOutBigInt, wallet.address, '0x')
                const receipt = await tx.wait()
                // logTransaction(receipt)
                console.log(receipt)
            } catch (e ){
                // let errorMessage = `Error with nonce: ${nonce} -- ${JSON.stringify(e)}`
                let errorObject = {
                    nonce: nonce,
                    type: "Solar",
                    error: e,
                    contractAddress: dexContractAddress
                }
                let errorMessage = JSON.stringify(errorObject, null, 2)
                logErrorCatch(errorObject)
                logSuccessOrFail("FAIL", "swap solar", dexContractAddress, nonce)
                throw new Error(errorMessage)
            }
            
            postSwapBalance0 = await token0Contract.balanceOf(wallet.address)
            postSwapBalance1 = await token1Contract.balanceOf(wallet.address)
            console.log(`Post WMOVR balance: ${postSwapBalance0} --- Post ${token1Symbol} Balance: ${postSwapBalance1}`)
        } else {
            console.log(`WMOVR balance: ${balance1} --- ${token0Symbol} Balance: ${balance0}`)
            const calculatedAmountOutBigInt = calculateSwapAmountBigInt(inputMovrValue, toBigInt(reserve1), toBigInt(reserve0), 0.01)
            try{
                const tx = await dexContract.swap(calculatedAmountOutBigInt, 0, wallet.address, '0x', { nonce: nonce})
                logTransaction({txType: "swap", dexContractAddress, txData: tx})
                logSuccessOrFail("SUCCESS", "swap zen", dexContractAddress, nonce)
                // const tx = await dexContract.swap(0, calculatedAmountOutBigInt, wallet.address, '0x')
                const receipt = await tx.wait()
                // logTransaction(receipt)
                console.log(receipt)
            } catch (e ){
                // let errorMessage = `Error with nonce: ${nonce} -- ${JSON.stringify(e)}`
                let errorObject = {
                    nonce: nonce,
                    type: "Zenlink",
                    error: e,
                    contractAddress: dexContractAddress
                }
                let errorMessage = JSON.stringify(errorObject, null, 2)
                logErrorCatch(errorObject)
                logSuccessOrFail("FAIL", "swap zen", dexContractAddress, nonce)
                throw new Error(errorMessage)
            }
            postSwapBalance0 = await token0Contract.balanceOf(wallet.address)
            postSwapBalance1 = await token1Contract.balanceOf(wallet.address)
            console.log(`Post WMOVR balance: ${postSwapBalance1} --- Post ${token0Symbol} Balance: ${postSwapBalance0}`)
        }
        logSuccess(lp.contractAddress, dexType, token0, token0Symbol, token1, token1Symbol, preSwapBalance0.toString(), preSwapBalance1.toString(), postSwapBalance0.toString(), postSwapBalance1.toString(), nonce)
        let result = {
            dexContractAddress: lp.contractAddress,
            success: true,
            nonce: nonce,
            dexType: dexType,
            token0: token0,
            token1: token1,
            token0Symbol: token0Symbol,
            token1Symbol: token1Symbol,
            preSwapBalance0: preSwapBalance0.toString(),
            preSwapBalance1: preSwapBalance1.toString(),
            postSwapBalance0: postSwapBalance0.toString(),
            postSwapBalance1: postSwapBalance1.toString()
        }
        return result

}
    interface GenericTx {
        type: string, // transfer or swap
        to: string, //Contract address
        wallet: ethers.Wallet,
        walletIndex: number,
        nonce: any
    }
async function testMovrPoolsGrouped(){
    clearBatchResults()
    const allLps = JSON.parse(fs.readFileSync('./lps.json', 'utf8'));
    let movrLps = allLps.filter((lp: any) => lp.poolAssets[0] == "MOVR" || lp.poolAssets[1] == "MOVR")

    // Substrate tokens are system contracts and not supported on hardhat
    movrLps = movrLps.filter((lp: any) =>{
        if(checkForSubstrateToken(lp.poolAssets[0]) || checkForSubstrateToken(lp.poolAssets[1])){
            // console.log(`Found substrate asset -- ${lp.poolAssets[0]} -- ${lp.poolAssets[1]}`)
            return false
        }
        // console.log("No substrate asset")
        return true
    })
    // movrLps = movrLps.slice(7, 10)
    const loggingProvider = new LoggingProvider(localRpc);
    const wallet = await new ethers.Wallet(test_account_pk, loggingProvider)
    let nonce = await wallet.getNonce()
    let transactions: GenericTx[][] = []
    movrLps.forEach((lp: any) => {   
        
        let transferTx: GenericTx = {
            type: "transfer",
            to: lp.contractAddress,
            // inputAmount: ethers.parseUnits("0.01", 18),
            wallet: wallet,
            walletIndex: 0,
            nonce: nonce
        }
        nonce++
        let swapTx: GenericTx = {
            type: "swap",
            to: lp.contractAddress,
            wallet: wallet,
            walletIndex: 0,
            nonce: nonce
        }
        nonce++
        let txPair: GenericTx[] = [transferTx, swapTx]
        transactions.push(txPair)
    })
    transactions = transactions.slice(0, 10)
    executeBatchedTransactions(transactions, wallet)
}

async function executeBatchedTransactions(transactions: GenericTx[][], wallet: ethers.Wallet, batchSize = 10) {
    transactions.forEach((txPair, index) => {
        console.log(JSON.stringify(txPair, null, 2))
    })
    let wmovrContractAbi = JSON.parse(fs.readFileSync('./../movrContract.json', 'utf8'));
    let wmovrToken = new ethers.Contract(movrContractAddress, wmovrContractAbi, wallet);
    let inputMovrAmount = ethers.parseUnits("0.01", 18)
    // let nonce = await wallet.getTransactionCount();
    for (let i = 0; i < transactions.length; i += batchSize) {
        const transactionBatch = transactions.slice(i, i + batchSize);
        const batchPromises = transactionBatch.map(async (txPair, index) => {
            let txPairResults: (any | Error)[] = [];
            for(const txIndex in txPair){
                let tx = txPair[txIndex]
                try {
                    if(tx.type == "transfer"){
                        console.log(`Executing TRANSFER to ${tx.to}. NONCE: ${tx.nonce}`)
                        let tokenTransfer = await wmovrToken.transfer(tx.to, inputMovrAmount, {nonce: tx.nonce})
                        let tokenTransferReceipt = await tokenTransfer.wait()
                        console.log(`Success in transaction with nonce ${tx.nonce}, Type: ${tx.type}, Contract: ${tx.to}`)
                        txPairResults.push(tokenTransferReceipt)
                    } else {
                        console.log(`Executing SWAP to ${tx.to}. NONCE: ${tx.nonce}`)
                        let swapTxReceipt = await tryDexAbis(dexAbis, tx.to, wallet, tx.nonce, wmovrToken, inputMovrAmount, 0 )
                        txPairResults.push(swapTxReceipt)
                    }
                } catch (error) {
                    console.error(`Error in transaction with nonce ${tx.nonce}, Type: ${tx.type}, Contract: ${tx.to}. :: `, error);
                    const errorData = {
                        txType: tx.type,
                        nonce: tx.nonce,
                        contractAddress: tx.to,
                        error: error,
                        batchIndex: index,
                        errorMessage: error.message
                    }
                    txPairResults.push(new Error(JSON.stringify(errorData, null, 2)))
                }
            }
            return txPairResults
            
        });
        let batchResults = await Promise.all(batchPromises);
        batchResults.forEach((result, index) => {
            let txPairResults = batchResults[index]
            txPairResults.forEach((txResult, index) => {
                if(result instanceof Error){
                    logBatchSuccessOrFail(result)
                } else {
                    const successResult = {
                        result: "SUCCESS",
                        nonce: txResult.nonce,
                        txType: txResult.type,
                        contractAddress: txResult.to,
                        batchIndex: index,
                        success: true,
                    }
                    logBatchSuccessOrFail(successResult)
                }
            })
            
        })
    }
}

async function tryDexAbis(abis, dexContractAddress, wallet, nonce, wmovrToken, inputMovrAmount, walletIndex, index = 0, errors = []) {
    if (index >= abis.length) {
        // let allError = new Error("All operations failed");
        // errors.push(allError);
        let errorArray = JSON.stringify(errors, null, 2)
        throw new Error(errorArray)
    }
    try {
        const dexAbi = abis[index];
        const dexContract = new ethers.Contract(dexContractAddress, dexAbi, wallet)
        const token0 = await dexContract.token0()

        
        let reserve0;
        let reserve1;
        let timestamp
        try{
            [reserve0, reserve1, timestamp] = await dexContract.getReserves()
            // console.log(`${dexContractAddress} reserves: ${reserve0} -- ${reserve1}}`)
            
        } catch(e){
            const errorObject = {
                contractAddress: dexContractAddress,
                abi: index,
                nonce: nonce,
                errorType: "getReserves",
                error: e
            }
            throw new Error("Error getReserves")
        }
        // console.log(calculatedAmountOut)

        let approved = await checkApproval(wmovrToken, wallet.address, dexContractAddress)
        if(!approved){
            let approvalResult = await approve(wmovrToken, dexContractAddress)
        }
        console.log(`${dexContractAddress} Token 0: ${token0}`)
        console.log(`${dexContractAddress} reserves: ${reserve0} -- ${reserve1}}`)
        const reserve0BigInt = BigInt(reserve0.toString())
        const reserve1BigInt = BigInt(reserve1.toString())
        let swapTx;
        let calculatedAmountOut;
        if (index == 0){
            // swapTx = token0 == movrContractAddress ? await dexContract.swap(0, calculatedAmountOut, wallet.address, '0x', {nonce: nonce}) : await dexContract.swap(calculatedAmountOut, 0, wallet.address, '0x', {nonce: nonce})
            if(token0 == movrContractAddress){
                console.log("Token 0 is MOVR")
                
                calculatedAmountOut = calculateSwapAmountBigInt(inputMovrAmount, reserve0BigInt, reserve1BigInt, 0.01)
                swapTx = await dexContract.swap(0, calculatedAmountOut, wallet.address, '0x', {nonce: nonce})
            } else {
                console.log("Token 0 is NOT MOVR")
                calculatedAmountOut = calculateSwapAmountBigInt(inputMovrAmount, reserve1BigInt, reserve0BigInt, 0.01)
                swapTx = await dexContract.swap(calculatedAmountOut, 0, wallet.address, '0x', {nonce: nonce})
            }
        } else {
            // swapTx = token0 == movrContractAddress ? await dexContract.swap(0, calculatedAmountOut, wallet.address, {nonce: nonce}) : await dexContract.swap(calculatedAmountOut, 0, wallet.address, {nonce: nonce})
            if(token0 == movrContractAddress){
                console.log("Token 0 is MOVR")
                calculatedAmountOut = calculateSwapAmountBigInt(inputMovrAmount,reserve0BigInt, reserve1BigInt, 0.01)
                swapTx = await dexContract.swap(0, calculatedAmountOut, wallet.address, {nonce: nonce})
            } else {
                console.log("Token 0 is NOT MOVR")
                calculatedAmountOut = calculateSwapAmountBigInt(inputMovrAmount, reserve1BigInt,reserve0BigInt, 0.01)
                swapTx = await dexContract.swap(calculatedAmountOut, 0, wallet.address, {nonce: nonce})
            }
        }
        
        // let swapTx = token0 == movrContractAddress ? await dexContract.swap(0, calculatedAmountOut, wallet.address, '0x', {nonce: nonce}) : await dexContract.swap(calculatedAmountOut, 0, wallet.address, '0x', {nonce: nonce})
        let swapTxReceipt = await swapTx.wait()
        let resultObject = {
            wallet: wallet.address,
            walletIndex: walletIndex,
            nonce: nonce,
            contractAddress: dexContractAddress,
            abiIndex: index,
            // success: true,
            swapTxReceipt: swapTxReceipt
        }
        return resultObject
    } catch (e) {
        errors.push(e);
        console.error(`Wallet (${walletIndex}) ABI ${index} NONCE: ${JSON.stringify(nonce)} CONTRACT: ${dexContractAddress} failed:`, e);
        return await tryDexAbis(abis, dexContractAddress, wallet, nonce, wmovrToken, inputMovrAmount, walletIndex, index + 1, errors); // Try the next operation
    }
}
async function testMovrPoolsGroupedWallets(){
    clearBatchResults()
    let wallets = JSON.parse(fs.readFileSync('./wallets.json', 'utf8'));
    const loggingProvider = new LoggingProvider(localRpc);
    let walletProviders = wallets.map((wallet: any) => {
        return new ethers.Wallet(wallet.private_key, loggingProvider)
    })

    const allLps = JSON.parse(fs.readFileSync('./lps.json', 'utf8'));
    let movrLps = allLps.filter((lp: any) => lp.poolAssets[0] == "MOVR" || lp.poolAssets[1] == "MOVR")

    movrLps = movrLps.filter((lp: any) =>{
        if(checkForSubstrateToken(lp.poolAssets[0]) || checkForSubstrateToken(lp.poolAssets[1])){
            return false
        }
        return true
    })
    movrLps = movrLps.filter((lp: any) => {
        return lp.contractAddress == "0x423937ced38e44d7953098e92341dee103e945a8" ?  false : true
    })
    // let nonce = await wallet.getNonce()
    let transactions: GenericTx[][] = []
    let walletIndex = 0
    for(const lp of movrLps){
        let wallet = walletProviders[walletIndex]
        let nonce;
        let latestNonce = await wallet.getNonce();
        transactions.forEach((txPair, index) => {
            let [tx0, tx1] = txPair
            if(tx1.walletIndex == walletIndex && tx1.nonce > latestNonce){
                latestNonce = tx1.nonce + 1;
            }
        })
        nonce = latestNonce
        let transferTx: GenericTx = {
            type: "transfer",
            to: lp.contractAddress,
            wallet: wallet,
            walletIndex: walletIndex,
            nonce: nonce
            // inputAmount: ethers.parseUnits("0.01", 18),
            
        }
        nonce++
        let swapTx: GenericTx = {
            type: "swap",
            to: lp.contractAddress,
            wallet: wallet,
            walletIndex: walletIndex,
            nonce: nonce
        }
        // nonce++
        let txPair: GenericTx[] = [transferTx, swapTx]
        transactions.push(txPair)
        walletIndex < walletProviders.length - 1 ? walletIndex++ : walletIndex = 0

    }
    // transactions = transactions.slice(0, 10)
    executeBatchedWalletTransactions(transactions)
}

async function executeBatchedWalletTransactions(transactions: GenericTx[][], batchSize = 20) {
    transactions.forEach((txPair, index) => {
        console.log(JSON.stringify(txPair, null, 2))
    })
    let wmovrContractAbi = JSON.parse(fs.readFileSync('./../movrContract.json', 'utf8'));
    // let wmovrToken = new ethers.Contract(movrContractAddress, wmovrContractAbi, wallet);
    let inputMovrAmount = ethers.parseUnits("0.01", 18)
    // let nonce = await wallet.getTransactionCount();
    for (let i = 0; i < transactions.length; i += batchSize){
        const transactionBatch = transactions.slice(i, i + batchSize);
        const batchPromises = transactionBatch.map(async (txPair, index) => {
            let txPairResults: (any | Error)[] = [];
            let txPairWallet = txPair[0].wallet
            let wmovrToken = new ethers.Contract(movrContractAddress, wmovrContractAbi, txPairWallet);
            for(const txIndex in txPair){
                let tx = txPair[txIndex]
                try {
                    if(tx.type == "transfer"){
                        console.log(`EXECUTING TRANSFER to ${tx.to}:: Wallet: ${txPairWallet.address}  NONCE: ${tx.nonce}`)
                        let tokenTransfer = await wmovrToken.transfer(tx.to, inputMovrAmount, {nonce: tx.nonce})
                        let tokenTransferReceipt = await tokenTransfer.wait()
                        console.log(`Success in TRANSFER transaction:: Wallet: ${txPairWallet.address} with nonce ${tx.nonce}, Type: ${tx.type}, Contract: ${tx.to}`)
                        
                        
                        let resultData = {
                            txType: "transfer",
                            nonce: tx.nonce,
                            contractAddress: tx.to,
                            result: "SUCCESS",
                            batchIndex: index,
                            success: true,
                            walletAddress: txPairWallet.address,
                            walletIndex: tx.walletIndex,
                            txReceipt: tokenTransferReceipt
                        }
                        
                        txPairResults.push(resultData)
                    } else {
                        console.log(`EXECUTING SWAP to ${tx.to}:: Wallet: ${txPairWallet.address}  NONCE: ${tx.nonce}`)
                        let swapTxResult = await tryDexAbis(dexAbis, tx.to, txPairWallet, tx.nonce, wmovrToken, inputMovrAmount, tx.walletIndex )
                        console.log(`Success in SWAP transaction:: Wallet: ${txPairWallet.address} with nonce ${tx.nonce}, Type: ${tx.type}, Contract: ${tx.to}`)
                        
                        let resultData = {
                            txType: "swap",
                            nonce: tx.nonce,
                            contractAddress: tx.to,
                            result: "SUCCESS",
                            batchIndex: index,
                            abiIndex: swapTxResult.abiIndex,
                            success: true,
                            walletAddress: swapTxResult.wallet,
                            walletIndex: swapTxResult.walletIndex,
                            txReceipt: swapTxResult.swapTxReceipt
                        }
                        
                        txPairResults.push(resultData)
                        
                    }
                } catch (error) {
                    if(tx.type == "transfer"){
                        console.error(`Error in TRANSFER transaction:: Wallet: ${txPairWallet.address} with nonce ${tx.nonce}, Type: ${tx.type}, Contract: ${tx.to}. :: `, error);
                        const errorData = {
                            txType: tx.type,
                            nonce: tx.nonce,
                            contractAddress: tx.to,
                            error: error,
                            batchIndex: index,
                            walletAddress: txPairWallet.address,
                            errorMessages: [error.message]
                        }
                        txPairResults.push(new Error(JSON.stringify(errorData, null, 2)))
                    } else {

                    
                        console.error(`Error in SWAP transaction:: Wallet: ${txPairWallet.address} with nonce ${tx.nonce}, Type: ${tx.type}, Contract: ${tx.to}. :: `, error);
                        let errorDataArray: Error[] = JSON.parse(error.message)
                        let errorMessageArray = errorDataArray.map((error: any) => error.message)
                        
                        const errorData = {
                            txType: tx.type,
                            nonce: tx.nonce,
                            contractAddress: tx.to,
                            error: errorDataArray,
                            batchIndex: index,
                            walletAddress: txPairWallet.address,
                            errorMessages: errorMessageArray
                        }
                        txPairResults.push(new Error(JSON.stringify(errorData, null, 2)))
                    }
                }
            }
            return txPairResults
            
        });
        let batchResults = await Promise.all(batchPromises);
        batchResults.forEach((result, index) => {
            let [txResult0, txResult1] = result
            if(txResult0 instanceof Error){
                logBatchSuccessOrFail(txResult0)
            } else {
                const successResult = {
                    result: "SUCCESS",
                    nonce: txResult0.nonce,
                    txType: txResult0.txType,
                    contractAddress: txResult0.contractAddress,
                    batchIndex: index,
                    success: true,
                    abiIndex: txResult0.abiIndex,
                    txResultData: txResult0
                }
                // console.log(successResult)
                logBatchSuccessOrFail(successResult)
            }
            if(txResult1 instanceof Error){
                logBatchSuccessOrFail(txResult1)
            } else {
                const successResult = {
                    result: "SUCCESS",
                    nonce: txResult1.nonce,
                    txType: txResult1.txType,
                    contractAddress: txResult1.contractAddress,
                    batchIndex: index,
                    success: true,
                    abiIndex: txResult1.abiIndex,
                    txResultData: txResult1

                }
                // console.log(successResult)
                logBatchSuccessOrFail(successResult)
            }
        })
    }
}
interface RouterTx{
    to: string,
    nonce: number,
}
interface WalletTxHandler{
    wallet: ethers.Wallet,
    walletAddress: string,
    walletIndex: number,
    transactions: RouterTx[],
}
async function testRoutersGroupedWallets(){
    let wallets = JSON.parse(fs.readFileSync('./wallets.json', 'utf8'));
    const loggingProvider = new LoggingProvider(localRpc);
    let walletHandlers: WalletTxHandler[] = wallets.map((wallet: any) => {
        let walletProvider = new ethers.Wallet(wallet.private_key, loggingProvider)
        let walletHandler: WalletTxHandler = {
            wallet: walletProvider,
            walletAddress: walletProvider.address,
            walletIndex: wallets.indexOf(wallet),
            transactions: []
        }
        return walletHandler
    })

    const allLps = JSON.parse(fs.readFileSync('./lps.json', 'utf8'));
    let movrLps = allLps.filter((lp: any) => lp.poolAssets[0] == "MOVR" || lp.poolAssets[1] == "MOVR")

    movrLps = movrLps.filter((lp: any) =>{
        if(checkForSubstrateToken(lp.poolAssets[0]) || checkForSubstrateToken(lp.poolAssets[1])){
            return false
        }
        return true
    })
    // movrLps = movrLps.slice(0,1)
    // let transactions: GenericTx[][] = []
    let walletIndex = 0
    for(const lp of movrLps){
        let walletHandler = walletHandlers[walletIndex]
        let nonce;
        let latestNonce = await walletHandler.wallet.getNonce();
        let walletTransactions: RouterTx[] = walletHandler.transactions
        walletTransactions.forEach((tx, index) => {
            if(tx.nonce >= latestNonce){
                latestNonce = tx.nonce + 1;
            }
        })
        nonce = latestNonce
        let routerTx: RouterTx = {
            to: lp.contractAddress,
            nonce: nonce
        }
        walletHandler.transactions.push(routerTx)
        walletIndex < walletHandlers.length - 1 ? walletIndex++ : walletIndex = 0
    }
    executeBatchRouterTransactionsGroupWallets(walletHandlers)
}
async function executeBatchRouterTransactionsGroupWallets(walletHandlers: WalletTxHandler[]){
    walletHandlers.forEach((walletHandler) => {
        if(walletHandler.transactions.length > 0){
            console.log(JSON.stringify(walletHandler.transactions, null, 2))
        }
        
    })
    let wmovrContractAbi = JSON.parse(fs.readFileSync('./../movrContract.json', 'utf8'));
    // let inputMovrAmount = ethers.parseUnits("0.01", 18)

    // let walletPromises = walletHandlers.map(walletHandler=> {
    //     executeWalletTransactions(walletHandler)
    // })
    let walletHandler0 = walletHandlers[0]
    let walletTransactions = await executeWalletTransactions(walletHandler0)
    // let walletPromises = executeWalletTransactions(walletHandlers[0])
    // await Promise.all(walletPromises)

}

async function executeWalletTransactions(walletHandler: WalletTxHandler){
    let txIndex = 0
    for (const transaction of walletHandler.transactions) {
        // Execute the transaction and wait for it to finalize
        
        await executeTransaction(walletHandler, txIndex);
        txIndex++
    }
}

async function executeTransaction(walletHandler: WalletTxHandler, txIndex: number) {
    let transaction = walletHandler.transactions[txIndex]
    let abiIndex = getDexAbiForContract(transaction.to)
    let dexAbi = dexAbis[abiIndex]

    let dexContract = new ethers.Contract(transaction.to, dexAbi, walletHandler.wallet)
    let reserves0;
    let reserves1;
    let timestamp;
    if(abiIndex == 0){
        [reserves0, reserves1, timestamp] = await dexContract.getReserves()
    } else {
        [reserves0, reserves1] = await dexContract.getReserves()
    }

    let token0 = await dexContract.token0()
    let token1 = await dexContract.token1()
    let reserve0BigInt: bigint = toBigInt(reserves0.toString())
    let reserve1BigInt: bigint = toBigInt(reserves1.toString())
    let reservesIn: bigint;
    let reservesOut: bigint;
    if(token0 == movrContractAddress){
        reservesIn = reserve0BigInt
        reservesOut = reserve1BigInt
    } else {
        reservesIn = reserve1BigInt
        reservesOut = reserve0BigInt
    }
    let inputMovrAmount = ethers.parseUnits("0.01", 18)
    let calculatedAmountOut = token0 == movrContractAddress ? calculateSwapAmountRouterFormula(inputMovrAmount, reserve0BigInt, reserve1BigInt, 100, 25) : calculateSwapAmountRouterFormula(inputMovrAmount, reserve1BigInt, reserve0BigInt, 100, 25)
    // console.log(`Calculated amount out: ${calculatedAmountOut}`)

    let swapStats: SwapStats = {
        token0: token0,
        token1: token1,
        amountIn: inputMovrAmount,
        calculatedAmountOut: calculatedAmountOut,
        reservesIn: reservesIn,
        reservesOut: reservesOut,
        dexContract: transaction.to
    }
    try{
        
        let routerSwapResult = await tryExecuteRouterSwaps(walletHandler, transaction, swapStats)
        logBatchRouterSuccessOrFail(routerSwapResult)
    } catch(e) {

    }
    
}

interface SwapStats {
    token0: string,
    token1: string,
    amountIn: BigInt,
    calculatedAmountOut: BigInt,
    reservesIn: BigInt,
    reservesOut: BigInt,
    dexContract: string
}

async function tryExecuteRouterSwaps(walletHandler: WalletTxHandler, routerTx: RouterTx, swapStats: SwapStats, errors = [], routerAbiIndex = 0){
    if(routerAbiIndex >= routerAbis.length){
        let errorArray = JSON.stringify(errors, null, 2)
        throw new Error(errorArray)
        // throw new Error("All router swaps failed")
    }
    try{
        const routerAbi = routerAbis[routerAbiIndex]
        const routerContractAddress = routerContracts[routerAbiIndex]
        const routerFee = routerFees[routerAbiIndex]

        console.log(`Executing SWAP to ROUTER ${routerAbiIndex}:: Dex Contract: ${swapStats.dexContract} Wallet: ${walletHandler.wallet.address}  NONCE: ${routerTx.nonce}`)

        const movrToken = new ethers.Contract(movrContractAddress, movrContractAbi, walletHandler.wallet)
        const outToken = swapStats.token0 == movrContractAddress ? new ethers.Contract(swapStats.token1, movrContractAbi, walletHandler.wallet) : new ethers.Contract(swapStats.token0, movrContractAbi, walletHandler.wallet)

        let approved = await checkApproval(movrToken, walletHandler.wallet.address, routerContractAddress)
        if(!approved){
            let approvalResult = await approve(movrToken, routerContractAddress)
            walletHandler.transactions.forEach((tx, index) => {
                tx.nonce = tx.nonce + 1
            })
            console.log("Now approved")
        }

        const routerContract = new ethers.Contract(routerContractAddress, routerAbi, walletHandler.wallet)

        // let routerAmountOut = routerAbiIndex == 0 ? await routerContract.getAmountOut(swapStats.amountIn, swapStats.reservesIn, swapStats.reservesOut, routerFee) : await routerContract.getAmountOut(swapStats.amountIn, swapStats.reservesIn, swapStats.reservesOut)
        // console.log(`Router: ${routerAbiIndex} -- Token 0: ${swapStats.token0} -- Token 1: ${swapStats.token1}`)
        // console.log(`Reserve In: ${swapStats.reservesIn} -- Reserve Out: ${swapStats.reservesOut}`)
        // console.log(`Amount In: ${swapStats.amountIn} -- Calculated Amount Out: ${routerAmountOut}`)
        
        // let routerQuoteAmount = await routerContract.quote(swapStats.amountIn, swapStats.reservesIn, swapStats.reservesOut)
        // console.log(`Router Quote Amount: ${routerQuoteAmount}`)

        const path = [swapStats.token0, swapStats.token1]

        let movrBalance = await movrToken.balanceOf(walletHandler.wallet.address)
        let outTokenBalanceBefore = await outToken.balanceOf(walletHandler.wallet.address)
        // console.log(`MOVR Balance: ${movrBalance} -- ${swapStats.token1} Balance: ${outTokenBalanceBefore}`)

        let routerSwapTx = await routerContract.swapExactTokensForTokens(swapStats.amountIn, swapStats.calculatedAmountOut, path, walletHandler.wallet.address, Date.now() + 1000000000, { nonce: routerTx.nonce,gasLimit: 10000000 })
        let routerSwapTxReceipt = await routerSwapTx.wait()

        console.log(`SUCCESS SWAP`)

        movrBalance = await movrToken.balanceOf(walletHandler.wallet.address)
        let outTokenBalanceAfter = await outToken.balanceOf(walletHandler.wallet.address)
        // console.log(`MOVR Balance: ${movrBalance} -- ${swapStats.token1} Balance: ${outTokenBalanceAfter}`)

        const actualAmountOut = outTokenBalanceAfter - outTokenBalanceBefore
        // console.log(`Actual Amount Out: ${actualAmountOut}`)

        let routerSwapResult = {
            success: true,
            routerIndex: routerAbiIndex,
            wallet: walletHandler.wallet.address,
            nonce: routerTx.nonce,
            token0: swapStats.token0,
            token1: swapStats.token1,
            amountIn: swapStats.amountIn,
            reservesIn: swapStats.reservesIn,
            reservesOut: swapStats.reservesOut,
            calculatedAmountOut: swapStats.calculatedAmountOut,
            actualAmountOut: actualAmountOut,
            swapTxReceipt: routerSwapTxReceipt
        }
        return routerSwapResult
    } catch (e) {
        errors.push(e)
        console.error("----------------------------------------------------------------")
        console.error(`FAILURE WITH ROUTER ${routerAbiIndex}:: Error: ${e.method} ${e.message}`)
        console.error("----------------------------------------------------------------")
        if(routerAbiIndex < routerAbis.length - 1){
            increaseWalletTxNonces(walletHandler)
        }
       
        return tryExecuteRouterSwaps(walletHandler, routerTx, swapStats, errors, routerAbiIndex + 1)
    }
}

async function executeBatchSwapContract(){
    // let wallets = JSON.parse(fs.readFileSync('./wallets.json', 'utf8'));
    const loggingProvider = new LoggingProvider(localRpc);
    let walletProvider = new ethers.Wallet(privateKey, loggingProvider)
    const customContractAbi = JSON.parse(fs.readFileSync('./abi/customSwapContractAbi.json', 'utf8'));
    const solarDexAbi = JSON.parse(fs.readFileSync('./abi/solarDexAbi.json', 'utf8'));

    const customContract = new ethers.Contract(deployedContractAddress, customContractAbi, walletProvider)
    const movrTokenContract = new ethers.Contract(movrContractAddress, movrContractAbi, walletProvider)
    const movrUsdcDexContract = new ethers.Contract(wmovrUsdcDexAddress,solarDexAbi, walletProvider )
    const [reserves0, reserves1, timestamp] = await movrUsdcDexContract.getReserves()

    const tokens = [movrContractAddress]
    const dex = [wmovrUsdcDexAddress]
    const amounts = [ethers.parseUnits("0.01", 18)]
    const swapFunction = "swap(uint, uint, address, bytes)"; // Replace with actual function
    const amountIn = ethers.parseUnits("0.01", 18);
    const amountOutMin = calculateSwapAmountRouterFormula(amountIn, reserves0, reserves1, 100, 25)
    const amount0Out = 0;
    const amount1Out = amountOutMin;
    const to = walletProvider.address;
    const data = '0x'
    const swapParams = [
        amount0Out, // Amount out token 0
        amount1Out, // Amount out token 1
        to, // Recipient address
        data // Transaction deadline
    ];

    const swapCallData = movrUsdcDexContract.interface.encodeFunctionData(swapFunction, swapParams);
    console.log(JSON.stringify(swapCallData, null, 2))
    // customContract.batchTransferAndSwap()


}
const deployedContractAddress = "0x2bdCC0de6bE1f7D2ee689a0342D76F52E8EFABa3"

function increaseWalletTxNonces(walletHandler: WalletTxHandler){
    // console.log("INCREMENTING NONCES")
    walletHandler.transactions.forEach((tx, index) => {
        tx.nonce = tx.nonce + 1
    })
}
function logBatchRouterError(){

}
function logBatchRouterSuccessOrFail(batchRouterResult){
    if(batchRouterResult instanceof Error){
        let errorObjects = JSON.parse(fs.readFileSync('./resultLogs/batchRouterErrors.json', 'utf8'))
        let resultObjects = JSON.parse(fs.readFileSync('./resultLogs/batchRouterResults.json', 'utf8'))
        errorObjects.push(JSON.stringify(batchRouterResult))
        let errorObject = JSON.parse(batchRouterResult.message)
        errorObjects.push(errorObject)
        let result = {result: "FAIL", nonce: errorObject.nonce}
        resultObjects.push(result)
        fs.writeFileSync('./resultLogs/batchRouterErrors.json', JSON.stringify(errorObjects, null, 2))
        fs.writeFileSync('./resultLogs/batchRouterResults.json', JSON.stringify(resultObjects, null, 2))
    } else {
        let resultObjects = JSON.parse(fs.readFileSync('./resultLogs/batchRouterResults.json', 'utf8'))
        resultObjects.push(batchRouterResult)
        fs.writeFileSync('./resultLogs/batchRouterResults.json', JSON.stringify(resultObjects, null, 2))
    }
}
function getDexAbiForContract(contractAddress: string){
    let abiResults = JSON.parse(fs.readFileSync('./resultLogs/abiResults.json', 'utf8'))
    let result = abiResults.find((abiResult: any) => {
        if(abiResult.contractAddress == contractAddress && abiResult.txType == "swap" && abiResult.success == true){
            return true
        } else {
            return false
        }
    })
    if(!result){
        return 0
    } else {
        return result.abiIndex
    }

}

async function getWrappedMovrAllWallets(){
    let wallets = JSON.parse(fs.readFileSync('./wallets.json', 'utf8'));
    const loggingProvider = new LoggingProvider(localRpc);
    let walletProviders = wallets.map((wallet: any) => {
        return new ethers.Wallet(wallet.private_key, loggingProvider)
    })

    let movrContractAbi = JSON.parse(fs.readFileSync('./../movrContract.json', 'utf8'));
    let txReceipts = await Promise.all(walletProviders.map(async (wallet: ethers.Wallet) => {
        const movrToken = new ethers.Contract(movrContractAddress, movrContractAbi, wallet);
        const movrAmount = ethers.parseUnits("1000", 18); // 10 Token A
    
        const depositTransaction = {
            to: movrContractAddress, // The address of the WMOVR contract
            value: movrAmount // The amount of MOVR to deposit
        };
        
        let tx = await wallet.sendTransaction(depositTransaction);
        let receipt = await tx.wait();
        console.log(receipt);
        return receipt
    }))
    console.log(JSON.stringify(txReceipts, null, 2))
}

async function checkMovrBalanceAllWallets(){
    let wallets = JSON.parse(fs.readFileSync('./wallets.json', 'utf8'));
    const loggingProvider = new LoggingProvider(localRpc);
    let walletProviders = wallets.map((wallet: any) => {
        return new ethers.Wallet(wallet.private_key, loggingProvider)
    })

    let movrContractAbi = JSON.parse(fs.readFileSync('./../movrContract.json', 'utf8'));
    let allBalances = await Promise.all(walletProviders.map(async (wallet: ethers.Wallet) => {
        const movrToken = new ethers.Contract(movrContractAddress, movrContractAbi, wallet);
        const movrAmount = ethers.parseUnits("1000", 18); // 10 Token A
        const balance = await movrToken.balanceOf(wallet.address);
        return [wallet.address, balance]
    }))
   console.log(allBalances)

    
}
async function trySwapWithAbi(abi, wallet: ethers.Wallet){

}

async function executeFails(){
    const testContract = "0x042e54b2b28265a7ce171f97391334bd47fe384c"
    const zenDex2Abi = JSON.parse(fs.readFileSync('./abi/zenlinkDexAbi.json', 'utf8'));
    const loggingProvider = new LoggingProvider(localRpc);
    const wallet = await new ethers.Wallet(test_account_pk, loggingProvider)
    const dexContract = new ethers.Contract(testContract, zenDex2Abi, wallet);
    let [reserve0, reserve1, timestamp] = await dexContract.getReserves()
    console.log(`Reserve 0: ${reserve0} --- Reserve 1: ${reserve1}`)

}
function clearBatchResults(){
    fs.writeFileSync('./resultLogs/batchResults.json', JSON.stringify([]))
    fs.writeFileSync('./resultLogs/batchErrors.json', JSON.stringify([]))
}
function clearBatchRouterResults(){
    fs.writeFileSync('./resultLogs/batchRouterErrors.json', JSON.stringify([]))
    fs.writeFileSync('./resultLogs/batchRouterResults.json', JSON.stringify([]))
}
function logBatchSuccessOrFail(batchResult){
    if(batchResult instanceof Error){
        let errorObjects = JSON.parse(fs.readFileSync('./resultLogs/batchErrors.json', 'utf8'))
        let resultObjects = JSON.parse(fs.readFileSync('./resultLogs/batchResults.json', 'utf8'))
        errorObjects.push(JSON.stringify(batchResult))
        let errorObject = JSON.parse(batchResult.message)
        errorObjects.push(errorObject)
        let result = {result: "FAIL", nonce: errorObject.nonce}
        resultObjects.push(result)
        fs.writeFileSync('./resultLogs/batchErrors.json', JSON.stringify(errorObjects, null, 2))
        fs.writeFileSync('./resultLogs/batchResults.json', JSON.stringify(resultObjects, null, 2))
    } else {
        let resultObjects = JSON.parse(fs.readFileSync('./resultLogs/batchResults.json', 'utf8'))
        resultObjects.push(batchResult)
        fs.writeFileSync('./resultLogs/batchResults.json', JSON.stringify(resultObjects, null, 2))
    }
}
function logSuccessOrFail(result: string, txType: string, contractAddress: string, nonce: any, swapType?: string, data?: any){
    fs.appendFileSync('./resultLogs/txSuccessOrFail.log', JSON.stringify({result, txType, swapType, contractAddress, nonce, data}, null, 2) + "\n")
    let resultData = {
        result,
        txType,
        swapType,
        contractAddress,
        nonce,
        data
    }
    let resultDataAll = JSON.parse(fs.readFileSync('./resultLogs/txSuccessOrFail.json', 'utf8'))
    resultDataAll.push(resultData)
    fs.writeFileSync('./resultLogs/txSuccessOrFail.json', JSON.stringify(resultDataAll, null, 2))
}
async function testSubstrateToken(){
    const loggingProvider = new LoggingProvider(localRpc);
    const wallet = await new ethers.Wallet(test_account_pk, loggingProvider)

    const ksmContractAbi = JSON.parse(fs.readFileSync('./abi/substrateTokenAbi.json', 'utf8'))

    const ksmTokenContract = new ethers.Contract(xcKsmContractAddress, ksmContractAbi, wallet);
    console.log(JSON.stringify(ksmTokenContract, null, 2))

    let wmovrKsmDexContractPath = path.join('./../testContractAbi.json')
    let wmovrKsmDexContractAbi = JSON.parse(fs.readFileSync(wmovrKsmDexContractPath, 'utf8'));

    let movrContractPath = path.join('./../movrContract.json')
    let movrContractAbi = JSON.parse(fs.readFileSync(movrContractPath, 'utf8'));

    
    const wmovrKsmDexContract = new ethers.Contract(wmovrKsmDexAddress, wmovrKsmDexContractAbi, wallet);
    const wmovrToken = new ethers.Contract(movrContractAddress, movrContractAbi, wallet);

    let [reserve0, reserve1, timestamp] = await wmovrKsmDexContract.getReserves()
    const reserve0BigInt = ethers.toBigInt(reserve0.toString())
    const reserve1BigInt = ethers.toBigInt(reserve1.toString())
    console.log("Reserve 0: ", reserve0.toString())
    console.log("Reserve 1: ", reserve1.toString())

    const amountInBigInt = ethers.parseUnits("0.01", 18); // 10 Token A
    // The spender address 0xe537f70a8b62204832b8ba91940b77d3f79aeb81 is approved to spend tokens for the user 0x70997970C51812dc3A010C7d01b50e0d17dc79C8.
    // The spender address 0xe537f70a8b62204832b8ba91940b77d3f79aeb81 is not approved to spend tokens for the user 0x70997970C51812dc3A010C7d01b50e0d17dc79C8.
    console.log("Amount in BigInt: ", amountInBigInt)
    console.log("Reserve 0 BigInt: ", reserve0BigInt)
    console.log("Reserve 1 BigInt: ", reserve1BigInt)
    const calculatedAmountOutBigInt = calculateSwapAmountBigInt(amountInBigInt, toBigInt(reserve0), toBigInt(reserve1), 0.01)
    console.log("Calculated amount out BigInt: ", calculatedAmountOutBigInt)
    const addy: ethers.AddressLike = wallet.address
    
    let approved = await checkApproval(wmovrToken, addy, wmovrKsmDexAddress)
    console.log("Approved: ", approved)
    if(!approved){
        let approvalResult = await approve(wmovrToken, wmovrKsmDexAddress)
        console.log(approvalResult)
    }

    // amountIn, amountOutMin, path, to, deadline
    // const swapWmovrForUsdcTx = await solarRouter.swapExactTokensForTokens(amountInBigInt, calculatedAmountOutBigInt, dexPath, addy, deadline, {gasLimit: 10000000, maxPriorityFeePerGas: 853687807, maxFeePerGas: ethers.parseUnits("100", "gwei")})
    const currentMovrBalance = await checkWMOVRBalance()
    // const currentUsdcBalance = await checkUSDCBalance()
    console.log(`Current MOVR balance: ${currentMovrBalance} --- Current USDC balance: `)

    const receipt = await wmovrKsmDexContract.swap(0, calculatedAmountOutBigInt, addy, '0x')
    // const swapEthForTokensTx = await solarRouter.swapExactETHForTokens(calculatedAmountOutBigInt, dexPath, addy, deadline, {gasLimit: 10000000, maxPriorityFeePerGas: 853687807, maxFeePerGas: ethers.parseUnits("100", "gwei"), value: amountInBigInt })
    // const receipt = await swapEthForTokensTx.wait()
    const postMovrBalance = await checkWMOVRBalance()
    // const postUsdcBalance = await checkUSDCBalance()
    console.log(`Post MOVR balance: ${postMovrBalance} --- Post USDC balance: `)
    console.log(receipt)
}

async function getSwapTx(assetInSymbol: string, assetOutSymbol: string, amount: number){

}
function logTransaction(tx: TxResult){
    // let txJson = JSON.stringify(tx, null, 2)
    let txData = JSON.parse(fs.readFileSync('./resultLogs/transactions.json', 'utf8'))
    txData.push(tx) 
    fs.writeFileSync('./resultLogs/transactions.json', JSON.stringify(txData, null, 2));
    fs.appendFileSync('./resultLogs/transactions.log', JSON.stringify(tx, null, 2));
}
function logSuccess(contractAddress: string, dexType: string, token0: string, token0Symbol: string, token1: string, token1Symbol, balance0: string, balance1: string, postSwapBalance0: string, postSwapBalance1: string, nonce: number){
    logToFile("--------------------------------------------------")
    logToFile("SUCCESS")
    logToFile(`Dex: ${contractAddress} --- Dex Type: ${dexType}`)
    logToFile(`Token 0: ${token0} ${token0Symbol} Token 1: ${token1} ${token1Symbol}`)
    logToFile(`Pre swap balances: ${balance0} ${balance1}`)
    logToFile(`Post swap balances: ${postSwapBalance0} ${postSwapBalance1}`)
    logToFile(`Nonce: ${nonce}`)
}
function logToFile(message: string) {
    const logFilePath = path.join('./movrDexSwapResults.log');
    fs.appendFileSync(logFilePath, message + '\n', 'utf8');
}
function logRouterSuccess(result: DexResult){
    logToFile("--------------------------------------------------")
    logToFile("SUCCESS")
    logToFile(`Dex: ${result.dexContractAddress} --- Dex Type: ${result.dexType}`)
    logToFile(`Token 0: ${result.token0} ${result.token0Symbol} Token 1: ${result.token1} ${result.token1Symbol}`)
    logToFile(`Pre swap balances: ${result.preSwapBalance0} ${result.preSwapBalance1}`)
    logToFile(`Post swap balances: ${result.postSwapBalance0} ${result.postSwapBalance1}`)
}
function logRouterError(result: DexResult, error: Error){
    logToError("--------------------------------------------------")
    logToError("ERROR")
    logToError(`Dex: ${result.dexContractAddress} --- Dex Type: ${result.dexType}`)
    logToError(`Token 0: ${result.token0} ${result.token0Symbol} Token 1: ${result.token1} ${result.token1Symbol}`)
    logToError(`Pre swap balances: ${result.preSwapBalance0} ${result.preSwapBalance1}`)
    logToError(`Post swap balances: ${result.postSwapBalance0} ${result.postSwapBalance1}`)
    logToError(`Error: ${error}`)
}
function logRouterToFile(message: string) {
    const logFilePath = path.join('./movrDexSwapResults.log');
    fs.appendFileSync(logFilePath, message + '\n', 'utf8');
}
function printAndLogToFile(message: string){
    console.log(message)
    logToFile(message)
}
function logToError(message: string) {
    const logFilePath = path.join('./movrDexSwapErrors.log');
    fs.appendFileSync(logFilePath, message + '\n', 'utf8');
}
function logError(error: Error, message?: string): Error{
    const logFilePath = path.join(__dirname, 'testErrors.log');
    fs.appendFileSync(logFilePath, message + '\n' + error + '\n', 'utf8');
    return error
    
}
function logErrorForPool(result: DexResult, error?: Error){
    const logFilePath = path.join('./movrDexSwapErrors.log');
    fs.appendFileSync(logFilePath, "-------------------------------------------------- \n", 'utf8');
    fs.appendFileSync(logFilePath, `Contract Address ${result.dexContractAddress} \n`, 'utf8');
    fs.appendFileSync(logFilePath, `Token 0: ${result.token0} Token 1: ${result.token1}  \n`, 'utf8');
    fs.appendFileSync(logFilePath, `Nonce: ${result.nonce} \n`, 'utf8');
    fs.appendFileSync(logFilePath, `Error: ${error} \n`, 'utf8');
}
async function run(){
    // await wrapMovr()
    // await checkWMOVRBalance()
    // await solarRouterWmovrUsdc()
    // await swapWmovrUsdc()
    // await testAllMovrPools()
    // await executeFails()
    // await testMovrPoolsGrouped()
    // await getWrappedMovrAllWallets()
    // await checkMovrBalanceAllWallets()
    // await testMovrPoolsGroupedWallets()
    // await testAllMovrPoolsAsync()
    // await testAllMovrPoolsWithRouter()
    // await testSubstrateToken()
    // await testRoutersGroupedWallets()
    await executeBatchSwapContract()
    // await checkUSDCBalance()
}


run()