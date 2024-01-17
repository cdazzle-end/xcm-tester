import '@moonbeam-network/api-augment/moonriver'
// import { RegistryError } from '@polkadot/types/types/registry';
// // import * as s from 'json-stringify-safe';
// import { encodeAddress, decodeAddress } from "@polkadot/keyring";
// import { BalanceChangeStatue } from '../../src/types';
// // import {Account, Mangata, MultiswapBuyAsset, TokenAmount, TokenId, TxOptions} from '@mangata-finance/sdk'
// import { wsLocalFrom, wsLocalDestination, assetSymbol, fromChain, toChain } from '../xcm_tests/testParams'
// // import { u8aToHex } from '@polkadot/util';
// import { mnemonicToLegacySeed, hdEthereum } from '@polkadot/util-crypto';
// // const { ApiPromise } = require('@polkadot/api');
// // const { WsProvider } = require('@polkadot/rpc-provider');
// import { options } from '@acala-network/api';
// // import { SwapPromise } from "@acala-network/sdk-swap";
// import { WalletPromise } from "@acala-network/sdk-wallet";
// import {cryptoWaitReady} from "@polkadot/util-crypto"
// import { FixedPointNumber, Token } from "@acala-network/sdk-core";
// import { Wallet,  } from "@acala-network/sdk"
// // import { AcalaDex, AggregateDex } from "@acala-network/sdk-swap"
// // import { AggregateDexSwapParams } from '@acala-network/sdk-swap/types'
// import { TradeRouter, PoolService, Router, BigNumber } from "@galacticcouncil/sdk"
import { ApiPromise, Keyring, WsProvider } from '@polkadot/api';
// import { MangataInstance, Mangata, MultiswapBuyAsset, MultiswapSellAsset } from "@mangata-finance/sdk"
// import { BN } from '@polkadot/util';
import { createPublicClient, http, createWalletClient, formatEther, webSocket } from 'viem';
import { moonriver } from 'viem/chains';
import { ethers } from 'ethers'
import * as fs from 'fs';
import { WebSocketProvider, Web3} from 'web3'
import { privateKeyToAccount } from 'viem/accounts';

const mnemonic = 'bottom drive obey lake curtain smoke basket hold race lonely fit walk';
let privateKey = "0x5fb92d6e98884f76de468fa3f6278f8807c48bebc13595d45af5bdc4da702133"
let noPrefixPrivateKey = privateKey.slice(2)

const wsLocalChain = "ws://172.26.130.75:8000"
const defaultWebsocket = "wss://moonriver.public.blastapi.io"

const rpcUrl = wsLocalChain
const account = privateKeyToAccount(`0x${noPrefixPrivateKey}`);
// const rpcUrl = 'INSERT_RPC_API_ENDPOINT'

let dazzlePolk = "0xAe8Da4A9792503f1eC97eD035e35133A9E65a61f"
const liveWallet = "0x13E8ABE5BE7E43A8a2c3B4C3Ff9752D665c9719E"
const addressFrom = '0xf24FF3a9CF04c71Dbc94D0b566f7A27B94566cac'; //Alith
const addressTo = '0x3Cd0A705a2DC65e5b1E1205896BaA2be8A07c6e0'; //Baltathazar
const xTokensContract = "0x0000000000000000000000000000000000000804"
const testContract = "0xe537f70a8b62204832b8ba91940b77d3f79aeb81"
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
    let contractAbi = JSON.parse(fs.readFileSync('./scripts/swaps/testContractAbi.json', 'utf8'));
    
    // // web3.Contract
    // const contractABI = contractAbi;
    const contract = new web3.eth.Contract(contractAbi, testContract);
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
    const target = testContract;
    const input = callAbi; // From step 2
    const value = 0; // Adjust if you need to send value
    const gasLimit = 373650
    const maxFeePerGas = 3207000000
    const maxPriorityFeePerGas = 0
    const nonce = 0
    // const index = await web3.eth.getTransactionCount(addressFrom)
    // console.log(index)
    // const accessList = []; // If needed
    // const signedTx = await web3.eth.accounts.signTransaction({/* transaction data */}, privateKey);
    // const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    const call = api.tx.evm.call()
    api.rpc.evm.call
    console.log(call)
    // api.tx.evm.call(target, input, value, gasLimit, maxFeePerGas, maxPriorityFeePerGas, nonce, accessList)


}
async function ethersTest(){
    const providerRPC = {
        moonriver: {
            name: 'moonriver',
            rpc: wsLocalChain, // Insert your RPC URL here
            chainId: 1285, // 0x505 in hex,
        },
    };
    const provider = new ethers.WebSocketProvider(defaultWebsocket);
    // const token0 = asseRegistry.find((asset: any) => asset.tokenData.contractAddress.toLowerCase() == lp.poolAssets[0].toLowerCase() )
    // const token1 = asseRegistry.find((asset: any) => asset.tokenData.contractAddress.toLowerCase() == lp.poolAssets[1].toLowerCase() )
    // lp.poolAssets = [token0? token0.tokenData.localId : lp.poolAssets[0], token1? token1.tokenData.localId : lp.poolAssets[1]]

    const pool = await new ethers.Contract(testContract, altDexContractAbi, provider);
    let reserves = await pool.getReserves();
    console.log(reserves)
    // console.log(lp)
    // console.log(reserves)
    // let reserve_0 = await hexToDec(reserves[0]["_hex"]);
    // let reserve_1 = await hexToDec(reserves[1]["_hex"]);
    // let reserve_0 = removeLastChar(reserves[0].toString());
    // let reserve_1 = removeLastChar(reserves[1].toString());
}

async function viemBalances(){
    console.log("Viem balances")
    const publicClient = createPublicClient({
        chain: moonriver,
        transport: webSocket(wsLocalChain),
      });

      console.log("Public client created")
      console.log(JSON.stringify(publicClient, null, 2))

      // 3. Create address variables


      // 4. Create balances function
    const balances = async () => {
        // 5. Fetch balances
        const balanceFrom = formatEther(
        await publicClient.getBalance({ address: addressFrom })
        );
        const balanceTo = formatEther(
        await publicClient.getBalance({ address: addressTo })
        );
    
        console.log(`The balance of ${addressFrom} is: ${balanceFrom} DEV`);
        console.log(`The balance of ${addressTo} is: ${balanceTo} DEV`);
    }
    console.log("Fething Balances")
    let query = await balances()
}   

async function getSwapTx(assetInSymbol: string, assetOutSymbol: string, amount: number){

}

async function run(){
    // await viemBalances()
    // await ethersTest()
    await testWeb3()
}


run()