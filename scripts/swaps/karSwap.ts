import fs from 'fs'
import * as paraspell from '@paraspell/sdk'
import { Observable, firstValueFrom } from 'rxjs'
import { timeout } from 'rxjs/operators'
import { WsProvider, ApiPromise, Keyring } from '@polkadot/api'
import { History } from '@acala-network/sdk'
import { u8aToHex } from '@polkadot/util'
import { EventRecord, Phase, Event, Hash } from '@polkadot/types/interfaces'
import { ISubmittableResult, IU8a } from '@polkadot/types/types'
import { TNode, getAssetsObject, getNode } from '@paraspell/sdk'
import { BalanceData, getAdapter } from '@polkawallet/bridge'
import { exec, execSync, spawn, ChildProcess } from 'child_process';
import path from 'path';
// import { getAdapter } from './adapters'

import { RegistryError } from '@polkadot/types/types/registry';
// import * as s from 'json-stringify-safe';
import flatted from 'flatted';
import { encodeAddress, decodeAddress } from "@polkadot/keyring";
import { BalanceChangeStatue } from '../../src/types';
import {Mangata} from '@mangata-finance/sdk'
import { wsLocalFrom, wsLocalDestination, assetSymbol, fromChain, toChain } from '../xcm_tests/testParams'
// import { u8aToHex } from '@polkadot/util';
import { mnemonicToLegacySeed, hdEthereum } from '@polkadot/util-crypto';
// const { ApiPromise } = require('@polkadot/api');
// const { WsProvider } = require('@polkadot/rpc-provider');
import { options } from '@acala-network/api';
// import { SwapPromise } from "@acala-network/sdk-swap";
import { WalletPromise } from "@acala-network/sdk-wallet";
import {cryptoWaitReady} from "@polkadot/util-crypto"
import { FixedPointNumber, Token } from "@acala-network/sdk-core";
import { Wallet,  } from "@acala-network/sdk"
import { AcalaDex, AggregateDex } from "@acala-network/sdk-swap"
import { AggregateDexSwapParams } from '@acala-network/sdk-swap/types'
// const { options } = require('@acala-network/api');
// import { Fixed18, convertToFixed18, calcSwapTargetAmount } from '@acala-network/api';

const wsLocalChain = "ws://172.26.130.75:8008"
// const wsLocalDestination = "ws://172.26.130.75:8008" 

async function karuraSwap() {
    const provider = new WsProvider(wsLocalChain);
    const api = new ApiPromise(options({ provider }));
    await api.isReady;

    const keyring = new Keyring({ type: 'sr25519' });
    const newPair = keyring.addFromUri('//Alice');
    const address = newPair.address;
    console.log(newPair.address); // you need to get test tokens
  	
    // DOT -> aUSD
  	
    // Set Supply Amount
    const supply = 1
    
    // Query Dex Pool
    // const pool = await api.derive.dex.pool('KSM');
    api.query.dex.liquidityPool('KSM');
    // Query Exchange Fee
    const exchangeFee = api.consts.dex.getExchangeFee;
    
    // Calculate Target Currency Amount
    // const target = calcSwapTargetAmount(
    //     supply,
    //     convertToFixed18(pool.base),
    //     convertToFixed18(pool.other),
    //     convertToFixed18(exchangeFee),
    //     Fixed18.fromNature(0.005)
    // );
  
    // // Exec Exchange
    // await api.tx.dex.swapCurrency(
    //     'DOT',
    //     Fixed18.fromNatural(supply).innerToString(),
    //     'AUSD',
    //     Fixed18.fromNatural(target).innerToString()
    // ).signAndSend(newPair);

    // Ensure Amount
    const dotAccount = await api.query.tokens.accounts(address, 'DOT');
    console.log(dotAccount.toHuman());
  
    const aUSDAccount = await api.query.tokens.accounts(address, 'AUSD');
    console.log(aUSDAccount.toHuman());
}
export async function getKarSwapExtrinsicBestPath(startAsset: any, destAsset: any, amountIn: number, expectedAmountOut: number){
    const provider = new WsProvider(wsLocalChain);
    const api = new ApiPromise(options({ provider }));
    await api.isReady;

    const signer = await getSigner();
  
    // const wallet = new WalletPromise(api);
    const wallet = await new Wallet(api)
    await wallet.isReady
    const allTokens = await wallet.getTokens()

    for( let key in allTokens){
        if(allTokens.hasOwnProperty(key)){
            console.log(allTokens[key].name)
        }
    }


    const startToken = wallet.getToken(startAsset);
    const destToken = wallet.getToken(destAsset);

    const path = [startToken, destToken] as [Token, Token];
    const supplyAmount = new FixedPointNumber(amountIn, startToken.decimal);
    const expectedOutAmountFixed = new FixedPointNumber(expectedAmountOut, destToken.decimal);
    let supplyConverted = supplyAmount.toChainData();
    console.log("Supply amount: " + supplyConverted)
    // set slippage 1%
    const slippage = new FixedPointNumber(0.01);
    const configs = {
        api: api,
        wallet: wallet,
    }
    const dex = new AcalaDex(configs)
    const dexConfigs = {
        api: api,
        wallet: wallet,
        providers: [dex]
    }
    const aDex = new AggregateDex(dexConfigs);
    const swapParams: AggregateDexSwapParams = {
        source: "aggregate",
        mode: "EXACT_INPUT",
        path: path,
        input: supplyAmount,
        acceptiveSlippage: slippage.toNumber(),
    }
    let swapResults = await firstValueFrom(aDex.swap(swapParams))
    console.log(swapResults.result)
    console.log(JSON.stringify(swapResults.tracker[0], null, 2))
    let tradingTx = aDex.getTradingTx(swapResults)
    console.log(JSON.stringify(tradingTx.toHuman(), null, 2))
    
    console.log("Expected amount out: " + expectedOutAmountFixed.toChainData())
    
    let accuracy = isWithinPercentage(expectedOutAmountFixed, swapResults.result.output.amount, 1)
    console.log("Actual output amount is within 1% of expected amount: " + accuracy)
    await api.disconnect()
    return {tradingTx, accuracy}
}

function isWithinPercentage(expected: FixedPointNumber, actual: FixedPointNumber, thresholdPercentage: number) {
    let difference = expected.minus(actual).abs()
    let percentageDifference = difference.div(expected).times(new FixedPointNumber(100))

    return percentageDifference.isLessOrEqualTo(new FixedPointNumber(thresholdPercentage));
}
async function swapWithSDK(){
    // const api = await getPolkadotApi();
    const provider = new WsProvider(wsLocalChain);
    const api = new ApiPromise(options({ provider }));
    await api.isReady;

    const signer = await getSigner();
  
    // const wallet = new WalletPromise(api);
    const wallet = await new Wallet(api)
    await wallet.isReady
    const allTokens = await wallet.getTokens()

    for( let key in allTokens){
        if(allTokens.hasOwnProperty(key)){
            console.log(allTokens[key].name)
        }
    }


    const karToken = wallet.getToken("KAR");
    const kusdToken = wallet.getToken("KUSD");

    const path = [karToken, kusdToken] as [Token, Token];
    const supplyAmount = new FixedPointNumber(10, karToken.decimal);
    let supplyConverted = supplyAmount.toChainData();
    console.log("Supply amount: " + supplyConverted)
    // set slippage 1%
    const slippage = new FixedPointNumber(0.01);
    const configs = {
        api: api,
        wallet: wallet,
    }
    const dex = new AcalaDex(configs)
    const dexConfigs = {
        api: api,
        wallet: wallet,
        providers: [dex]
    }
    const aDex = new AggregateDex(dexConfigs);
    const swapParams: AggregateDexSwapParams = {
        source: "aggregate",
        mode: "EXACT_INPUT",
        path: path,
        input: supplyAmount,
        acceptiveSlippage: slippage.toNumber(),
    }
    let swapResults = await firstValueFrom(aDex.swap(swapParams))
    console.log(swapResults.result)
    console.log(JSON.stringify(swapResults.tracker[0], null, 2))
    let tradingTx = aDex.getTradingTx(swapResults)
    console.log(JSON.stringify(tradingTx.toHuman(), null, 2))
    let txResult = await tradingTx.signAndSend(signer)
    
    console.log(txResult.toString())
    await api.disconnect()
}

async function tradingPaths(){
    const provider = new WsProvider(wsLocalChain);
    const api = new ApiPromise(options({ provider }));
    await api.isReady;

    const signer = await getSigner();
  
    // const wallet = new WalletPromise(api);
    const wallet = new Wallet(api)
    await wallet.isReady

    const dex = new AcalaDex({api, wallet})
    const dexConfigs = {
        api: api,
        wallet: wallet,
        providers: [dex]
    }

    const karToken = wallet.getToken("KAR");
    const kusdToken = wallet.getToken("KUSD");
    const path = [karToken, kusdToken] as [Token, Token];

    const supplyAmount = new FixedPointNumber(10, karToken.decimal);
    const slippage = new FixedPointNumber(0.01);

    const aDex = new AggregateDex(dexConfigs);

    let tradingPaths = aDex.getTradingPaths(path[0], path[1], dex.source)
    console.log(JSON.stringify(tradingPaths, null, 2))

    // let useablePaths = this.getTradingPaths(path[0], path[1]);


      // remove include other source path when source is not aggregate
      tradingPaths = tradingPaths.filter((path) => {
        console.log("Path: " + JSON.stringify(path, null, 2))
        return path.reduce((acc, item) => {
            console.log("Item: " + JSON.stringify(item, null, 2) + " Source: " + item[0] + " Acc: " + acc)
          return acc && dex.source === item[0];
        }, true as boolean);
      });
}

async function swapWithADex(){
    const provider = new WsProvider(wsLocalChain);
    const api = new ApiPromise(options({ provider }));
    await api.isReady;

    const signer = await getSigner();
  
    // const wallet = new WalletPromise(api);
    const wallet = new Wallet(api)
    await wallet.isReady

    const dex = new AcalaDex({api, wallet})
    const dexConfigs = {
        api: api,
        wallet: wallet,
        providers: [dex]
    }

    const karToken = wallet.getToken("KAR");
    const kusdToken = wallet.getToken("KUSD");
    const path = [karToken, kusdToken] as [Token, Token];

    const supplyAmount = new FixedPointNumber(10, karToken.decimal);
    const slippage = new FixedPointNumber(0.01);

    const aDex = new AggregateDex(dexConfigs);
    const swapParams: AggregateDexSwapParams = {
        source: "aggregate",
        mode: "EXACT_INPUT",
        path: path,
        input: supplyAmount,
        acceptiveSlippage: slippage.toNumber(),
    }
    let swapResults = await firstValueFrom(aDex.swap(swapParams))
    let tradingTx = aDex.getTradingTx(swapResults)
    let txResult = await tradingTx.signAndSend(signer)

    console.log(JSON.stringify(swapResults.tracker[0], null, 2))
    console.log(JSON.stringify(tradingTx.toHuman(), null, 2))
    
    
    console.log(txResult.toString())
    await api.disconnect()
}

async function swapWithDex(){
        // const api = await getPolkadotApi();
        const provider = new WsProvider(wsLocalChain);
        const api = new ApiPromise(options({ provider }));
        await api.isReady;
    
    const signer = await getSigner();
    const wallet = new Wallet(api);
    await wallet.isReady
    const allTokens = await wallet.getTokens()

    for( let key in allTokens){
        if(allTokens.hasOwnProperty(key)){
            console.log(allTokens[key].name)
        }
    }

    const karToken = wallet.getToken("KAR");
    const karCurrencyId = await karToken.toCurrencyId(api)
    const kusdToken = wallet.getToken("KUSD");
    const kusdCurrencyId = await kusdToken.toCurrencyId(api)

    const path = [karCurrencyId, kusdCurrencyId]
    const supplyAmount = new FixedPointNumber(10, karToken.decimal);
    let supplyConverted = supplyAmount.toChainData();
    console.log("Supply amount: " + supplyConverted)
    // set slippage 1%
    const slippage = new FixedPointNumber(0.01);
  
    const swapTx = api.tx.dex.swapWithExactSupply(path, supplyConverted, "0x0");
    console.log(swapTx.toHuman())
    let tx = await swapTx.signAndSend(signer);  
    console.log(tx.toHuman())
    await api.disconnect()
}

const getSigner = async () => {
    await cryptoWaitReady()
    const keyring = new Keyring({
      type: "sr25519",
    });
  
    // Add Alice to our keyring with a hard-deived path (empty phrase, so uses dev)
    return keyring.addFromUri("//Alice");
  };

async function run(){
    // await karuraSwap();
    // await swapWithSDK();
    // await swapWithDex();
    // await tradingPaths();
    // await getSwapExtrinsicBestPath("KSM", "KUSD", 1, 43.194656695628)
    // await getSwapExtrinsicBestPath("KSM", "KUSD", 1, 43.194656695628)
    process.exit(0)
}

run()