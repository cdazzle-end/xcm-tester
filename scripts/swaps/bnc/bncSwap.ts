// import * as fs from 'fs';
// import path from 'path';
// import { MyJunction, MyAsset, MyAssetRegistryObject, MyMultiLocation } from '../../assets/asset_types';
// import { MyLp } from '../lp_types';
// const axios = require('axios').default;
// import axios from 'axios';
// const axios = await import('axios');
// const axios = await import('axios');
// import * from 'axios';
// import { WsProvider, Keyring, ApiPromise } from '@polkadot/api';

// import { firstValueFrom } from 'rxjs';;
// import { cryptoWaitReady } from '@polkadot/util-crypto';
// import { SmartRouterV2 } from '@zenlink-dex/sdk-router';
// import { FixedPointNumber } from '@acala-network/sdk-core';
// import { SwapInstruction } from './../../instructions/types';
// const SwapInstruction = require('./../../instructions/types');
// import { ModuleBApi, BifrostConfig } from '@zenlink-dex/sdk-api';
// import { Percent, Token, TokenAmount,  StablePair } from '@zenlink-dex/sdk-core';
const firstValueFrom = require('rxjs').firstValueFrom;
const { SmartRouterV2 } = require('@zenlink-dex/sdk-router');
const { FixedPointNumber } = require('@acala-network/sdk-core');
const { ModuleBApi, BifrostConfig } = require('@zenlink-dex/sdk-api');
const { Percent, Token, TokenAmount,  StablePair, Currency } = require('@zenlink-dex/sdk-core');
const { cryptoWaitReady } = require('@polkadot/util-crypto');
const { WsProvider, Keyring, ApiPromise } = require('@polkadot/api');






// import { Token } from '@zenlink-dex/sdk-core';
// import sdkRouter from '@zenlink-dex/sdk-router';
// import sdkCore from '@zenlink-dex/sdk-core';
// import sdkApi from '@zenlink-dex/sdk-api';
// const { ModuleBApi, BifrostConfig } = await import ('@zenlink-dex/sdk-api');
// const { ModuleBApi, BifrostConfig } = sdkApi;
// const { Percent, Token, TokenAmount,  StablePair, Currency } = await import('@zenlink-dex/sdk-core')
// const { SmartRouterV2 } = await import ('@zenlink-dex/sdk-router');

const wsLocalChain = "ws://172.26.130.75:8009"
const axios = require('axios').default;
async function getBncSwapExtrinsic(startAssetSymbol: string, endAssetSymbol: string, amountIn: number, expectedAmountOut: number, swapInstructions: any): Promise<any> {
    // const axios = await import('axios');
    const response = await axios.get('https://raw.githubusercontent.com/zenlinkpro/token-list/main/tokens/bifrost-kusama.json');
    const tokensMeta = response.data.tokens;
    await cryptoWaitReady();

    // prepare wallet
    const keyring = new Keyring({ type: 'sr25519', ss58Format: 6 });
    const PHRASE = 'YOUR SEEDS';
    const accountPair = keyring.addFromUri("//Alice");

    console.log(`account address ${accountPair.address}`);

    // generate Tokens
    const tokens = tokensMeta.map((item: any) => {
      return new Token(item);
    });

    const token0 = tokens.find((item) => item.symbol === startAssetSymbol);
    const token1 = tokens.find((item) => item.symbol === endAssetSymbol);
    console.log('token0', token0);
    console.log('token1', token1);

    const tokensMap: Record<string, typeof Token> = {};
    tokens.reduce((total: any, cur: any) => {
      total[cur.assetId] = cur;
      return total;
    }, tokensMap);

    // generate the dex api
    const provider = new WsProvider(wsLocalChain);
    const dexApi = new ModuleBApi(
      provider,
      BifrostConfig
    );

    await provider.isReady;
    await dexApi.initApi(); // init the api;

    const account = accountPair.address;
    const standardPairs = await firstValueFrom(dexApi.standardPairOfTokens(tokens));
    const standardPools: any = await firstValueFrom(dexApi.standardPoolOfPairs(standardPairs));
    const stablePairs = await firstValueFrom(dexApi.stablePairOf());
    const stablePools = await firstValueFrom(dexApi.stablePoolOfPairs(stablePairs));

    let token0AmountFN = new FixedPointNumber(amountIn, token0.decimals);
    const token0Amount = new TokenAmount(token0, token0AmountFN.toChainData());
    // use smart router to get the best trade;
    const result = SmartRouterV2.swapExactTokensForTokens(
      token0Amount,
      token1,
      standardPools,
      stablePools
    );
  
    const trade = result.trade;
    if (!trade) {
      console.log('There is no match for this trade');
      return;
    }
  
    console.log(
      'The match trade is swap', `${
        trade.inputAmount.toPrecision(8)} ${trade.inputAmount.token.symbol
        } to ${trade.outputAmount.toPrecision(8)} ${trade.outputAmount.token.symbol}`
    );
    console.log('The executionPrice is',
    `1 ${trade.inputAmount.token.symbol} = ${trade.executionPrice.toPrecision(8)} ${trade.outputAmount.token.symbol}`
    );
    console.log('The route path is ', trade.route.tokenPath.map((item) => item.symbol).join(' -> '));
  
    console.log('The route path is ', trade.route.routePath.map((item) => item.stable));
  
    // set slippage of 5%
    const slippageTolerance = new Percent(5, 100);
    if (!dexApi.api) return;
  
    const blockNumber = await dexApi.api.query.system.number();
  
    const deadline = Number(blockNumber.toString()) + 20; // deadline is block height
  
    console.log('deadline', deadline);
  
    // get the extrinsics of this swap
    const extrinsics = dexApi.swapExactTokensForTokens(
      trade.route.routePath, // path
      trade.inputAmount, // input token and amount
      trade.minimumAmountOut(slippageTolerance), // min amount out
      account, // recipient
      deadline // deadline
    );
  
    if (!extrinsics) return;
    return extrinsics

}

// async function example () {
//     const response = await axios.get('https://raw.githubusercontent.com/zenlinkpro/token-list/main/tokens/bifrost-kusama.json');
//     const tokensMeta = response.data.tokens;
//     await cryptoWaitReady();
  
//     // prepare wallet
//     const keyring = new Keyring({ type: 'sr25519', ss58Format: 6 });
//     const PHRASE = 'YOUR SEEDS';
//     const accountPair = keyring.addFromUri("//Alice");
  
//     console.log(`account address ${accountPair.address}`);
  
//     // generate Tokens
//     const tokens = tokensMeta.map((item: any) => {
//       return new Token(item);
//     });
  
//     const tokensMap: Record<string, Token> = {};
//     tokens.reduce((total: any, cur: any) => {
//       total[cur.assetId] = cur;
//       return total;
//     }, tokensMap);
  
//     // generate the dex api
//     const provider = new WsProvider(wsLocalChain);
//     const dexApi = new ModuleBApi(
//       provider,
//       BifrostConfig
//     );
  
//     await provider.isReady;
//     await dexApi.initApi(); // init the api;
  
//     const account = accountPair.address;
  
//     // query the tokens balance of acoount
//     const tokenBalances = await firstValueFrom(dexApi.balanceOfTokens(tokens, account));
//     console.log('tokenBalances', tokenBalances);
  
//     // query the standard pair of tokens
//     const standardPairs = await firstValueFrom(dexApi.standardPairOfTokens(tokens));
//     console.log('standardPairs', standardPairs);
  
//     // query the standardPools of standard pairs;
//     const standardPools: any = await firstValueFrom(dexApi.standardPoolOfPairs(standardPairs));
//     console.log('standardPools', standardPools);
  
//     // query the stable pair;
//     const stablePairs = await firstValueFrom(dexApi.stablePairOf());
//     console.log('stablePairs', stablePairs);
  
//     // query the stable pool of stable pair;
//     const stablePools = await firstValueFrom(dexApi.stablePoolOfPairs(stablePairs));
//     console.log('stablePairs', stablePools);
  
//     // swap 10 bnc to another token
//     const bncToken = tokensMap['200-2001-0-0'];
//     const kusdToken = tokensMap['200-2001-2-770'];
//     const vsKSMToken = tokensMap['200-2001-2-1028'];
//     const usdtToken = tokensMap['200-2001-2-2048'];
//     const bncAmount = new TokenAmount(bncToken, (10_000_000_000_000).toString());
//     // use smart router to get the best trade;
//     const result = SmartRouterV2.swapExactTokensForTokens(
//       bncAmount,
//       usdtToken,
//       standardPools,
//       stablePools
//     );
  
//     const trade = result.trade;
//     if (!trade) {
//       console.log('There is no match for this trade');
//       return;
//     }
  
//     console.log(
//       'The match trade is swap', `${
//         trade.inputAmount.toPrecision(8)} ${trade.inputAmount.token.symbol
//         } to ${trade.outputAmount.toPrecision(8)} ${trade.outputAmount.token.symbol}`
//     );
//     console.log('The executionPrice is',
//     `1 ${trade.inputAmount.token.symbol} = ${trade.executionPrice.toPrecision(8)} ${trade.outputAmount.token.symbol}`
//     );
//     console.log('The route path is ', trade.route.tokenPath.map((item) => item.symbol).join(' -> '));
  
//     console.log('The route path is ', trade.route.routePath.map((item) => item.stable));
  
//     // set slippage of 5%
//     const slippageTolerance = new Percent(5, 100);
//     if (!dexApi.api) return;
  
//     const blockNumber = await dexApi.api.query.system.number();
  
//     const deadline = Number(blockNumber.toString()) + 20; // deadline is block height
  
//     console.log('deadline', deadline);
  
//     // get the extrinsics of this swap
//     const extrinsics = dexApi.swapExactTokensForTokens(
//       trade.route.routePath, // path
//       trade.inputAmount, // input token and amount
//       trade.minimumAmountOut(slippageTolerance), // min amount out
//       account, // recipient
//       deadline // deadline
//     );
  
//     if (!extrinsics) return;
  
//     const unsub = await extrinsics.signAndSend(accountPair, (status: any) => {
//       if (status.isInBlock) {
//         console.log('extrinsics submit in block');
//       }
//       if (status.isError) {
//         console.log('extrinsics submit error');
//       }
//       if (status.isFinalized) {
//         console.log('extrinsics submit is finalized');
//         unsub();
//       }
//     });
  
//   // use api
//   }

async function run(){
  getBncSwapExtrinsic("KSM", "BNC", 1, 0, [])
}
// run()

// module.exports = {
//     getBncSwapExtrinsic
// };
module.exports = {
    getBncSwapExtrinsic
};
