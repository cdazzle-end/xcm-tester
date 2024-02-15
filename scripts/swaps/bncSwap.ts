import * as fs from 'fs';
import path from 'path';
// import { MyJunction, MyAsset, MyAssetRegistryObject, MyMultiLocation } from '../../assets/asset_types';
// import { MyLp } from '../lp_types';
// const axios = require('axios').default;
import axios from 'axios';
// const axios = await import('axios');
// import * from 'axios';
import { WsProvider, Keyring, ApiPromise } from '@polkadot/api';

import { firstValueFrom } from 'rxjs';;
import { cryptoWaitReady } from '@polkadot/util-crypto';
import { SmartRouterV2 } from '@zenlink-dex/sdk-router';
import { FixedPointNumber } from '@acala-network/sdk-core';
import { IndexObject, PathNodeValues, ReverseSwapExtrinsicParams, SwapExtrinsicContainer, SwapInstruction } from '../instructions/types.ts';
import { ModuleBApi, ModuleBChainOption, BifrostConfig } from '@zenlink-dex/sdk-api';
// const sdkApi = await import('@zenlink-dex/sdk-api');
// const { ModuleBApi } = sdkApi;

// import { BifrostConfig } from '@zenlink-dex/sdk-api/chain/config';
import { Percent, Token, TokenAmount,  StablePair } from '@zenlink-dex/sdk-core';
import { SubmittableExtrinsic } from '@polkadot/api/submittable/types'
import { ISubmittableResult, IU8a } from '@polkadot/types/types'
import { increaseIndex } from './../instructions/utils.ts';
// import { Token } from '@zenlink-dex/sdk-core';
// import sdkRouter from '@zenlink-dex/sdk-router';
// import sdkCore from '@zenlink-dex/sdk-core';
// import sdkApi from '@zenlink-dex/sdk-api';
// const { ModuleBApi, BifrostConfig } = await import ('@zenlink-dex/sdk-api');
// const { ModuleBApi, BifrostConfig } = sdkApi;
// const { Percent, Token, TokenAmount,  StablePair, Currency } = await import('@zenlink-dex/sdk-core')
// const { SmartRouterV2 } = await import ('@zenlink-dex/sdk-router');

const wsLocalChain = "ws://172.26.130.75:8009"
const bncRpc = "wss://bifrost-parachain.api.onfinality.io/public-ws"
// const BifrostConfig = {
//   chainName: 'Bifrost',
//   networkId: 200,
//   chainId: 2001,
//   dexType: 'moduleB',
//   wss: ['wss://bifrost-parachain.api.onfinality.io/public-ws']
// };
export async function getBncSwapExtrinsic(
    startAssetSymbol: string, 
    endAssetSymbol: string, 
    amountIn: number, 
    expectedAmountOut: number, 
    swapInstructions: SwapInstruction[], 
    test: boolean = false, 
    txIndex: number, 
    extrinsicIndex: IndexObject, 
    instructionIndex: number[], 
    pathNodeValues: PathNodeValues,
    priceDeviationPercent: number = 2
    ): Promise<SwapExtrinsicContainer> {
    const response = await axios.get('https://raw.githubusercontent.com/zenlinkpro/token-list/main/tokens/bifrost-kusama.json');
    const tokensMeta = response.data.tokens;
    await cryptoWaitReady();

    let rpc = test ? wsLocalChain : bncRpc
    // prepare wallet
    const keyring = new Keyring({ type: 'sr25519', ss58Format: 6 });
    const PHRASE = 'YOUR SEEDS';
    const accountPair = keyring.addFromUri("//Alice");


    let assetNodes = [swapInstructions[0].assetNodes[0]]
    swapInstructions.forEach((instruction) => {
      assetNodes.push(instruction.assetNodes[1])
    })

    console.log(`account address ${accountPair.address}`);

    // generate Tokens
    const tokens = tokensMeta.map((item: any) => {
      return new Token(item);
    });

    let tokenInSymbol, tokenOutSymbol;
    if(startAssetSymbol.toLowerCase() == 'aseed' || startAssetSymbol.toLowerCase() == 'kusd' ){
      tokenInSymbol = 'aUSD'
    } else{
      tokenInSymbol = startAssetSymbol
    }
    if(endAssetSymbol.toLowerCase() == 'aseed' || endAssetSymbol.toLowerCase() == 'kusd' ){
      tokenOutSymbol = 'aUSD'
    } else{
      tokenOutSymbol = endAssetSymbol
    }

    const tokenIn = tokens.find((item) => item.symbol.toLowerCase() === tokenInSymbol.toLowerCase());
    const tokenOut = tokens.find((item) => item.symbol.toLowerCase() === tokenOutSymbol.toLowerCase());
    console.log('token0', tokenIn);
    console.log('token1', tokenOut);

    const tokensMap: Record<string, typeof Token> = {};
    tokens.reduce((total: any, cur: any) => {
      total[cur.assetId] = cur;
      return total;
    }, tokensMap);

    // generate the dex api
    const provider = new WsProvider(rpc);
    const dexApi = new ModuleBApi(
      provider,
      BifrostConfig
    );



    await provider.isReady;
    await dexApi.initApi(); // init the api;

    let accountNonce = await dexApi.api.query.system.account(accountPair.address)
    // let accountNonce = await api.query.system.account(signer.address)
    let nonce = accountNonce.nonce.toNumber()
    nonce += txIndex
    // console.log("BNC Nonce: " + nonce)

    const account = accountPair.address;
    const standardPairs = await firstValueFrom(dexApi.standardPairOfTokens(tokens));
    const standardPools: any = await firstValueFrom(dexApi.standardPoolOfPairs(standardPairs));
    const stablePairs = await firstValueFrom(dexApi.stablePairOf());
    const stablePools = await firstValueFrom(dexApi.stablePoolOfPairs(stablePairs));

    let tokenInAmountFN = new FixedPointNumber(amountIn, tokenIn.decimals);
    const tokenInAmount = new TokenAmount(tokenIn, tokenInAmountFN.toChainData());
    const tokenOutAmountFn = new FixedPointNumber(expectedAmountOut, tokenOut.decimals);
    
    let reversePriceDev = tokenInAmountFN.mul(new FixedPointNumber(5)).div(new FixedPointNumber(100))
    let reverseExpectedAmountOut = tokenInAmountFN.sub(reversePriceDev)
    let reverseOut = new TokenAmount(tokenIn, reverseExpectedAmountOut.toChainData());
    

    // use smart router to get the best trade;
    const result = SmartRouterV2.swapExactTokensForTokens(
      tokenInAmount,
      tokenOut,
      standardPools,
      stablePools
    );
  
    const trade = result.trade;
    // trade.minimumAmountOut(new Percent(5, 100));
    if (!trade) {
      console.log('There is no match for this trade');
      return;
    }
    
    // Allow for 2% price deviation from expected value,should probably be tighter
    let slipAmount = tokenOutAmountFn.mul(new FixedPointNumber(priceDeviationPercent)).div(new FixedPointNumber(100))
    let amountOutFnMinusSlip = tokenOutAmountFn.sub(slipAmount)

    console.log(`Token out amount: ${tokenOutAmountFn.toChainData()} Minus slip: ${amountOutFnMinusSlip.toChainData()}`)
    console.log(`Slip amount: ${slipAmount.toChainData()}`)

    const tokenOutAmount = new TokenAmount(tokenOut, amountOutFnMinusSlip.toChainData());
    if (!dexApi.api) return;
  
    const blockNumber = await dexApi.api.query.system.number();
  
    const deadline = Number(blockNumber.toString()) + 40; // deadline is block height
  
    // console.log('deadline', deadline);
  
    // get the extrinsics of this swap
    const extrinsics = dexApi.swapExactTokensForTokens(
      trade.route.routePath, // path
      trade.inputAmount, // input token and amount
      tokenOutAmount, // min amount out
      account, // recipient
      deadline // deadline
    ); 

    let reverseInAmount = tokenOutAmount
    let reverseTokenOut = tokenIn;
    const reverseResult = SmartRouterV2.swapExactTokensForTokens(
      reverseInAmount,
      reverseTokenOut,
      standardPools,
      stablePools
    );
    const reverseTrade = reverseResult.trade;
    if(!reverseTrade){
      throw new Error("Cant construct reverse trade BNC")
    }
    let reversePath = reverseTrade.route.routePath
    let reverseExtrinsic: ReverseSwapExtrinsicParams = {
      chainId: 2001,
      chain: "BifrostKusama",
      path: trade.route.routePath.reverse(),
      supply: reverseInAmount,
      supplyFn: amountOutFnMinusSlip,
      target: reverseOut,
      targetFn: reverseExpectedAmountOut,
      recipient: account,
      deadline: deadline,
      call: "swapExactTokensForTokens",
      moduleBApi: dexApi,
      supplyAssetId: startAssetSymbol,
      targetAssetId: endAssetSymbol
    }
  
    if (!extrinsics) return;
    // console.log(JSON.stringify(extrinsics, null, 2));
    // let assetNodes 
    let swapTxContainer: SwapExtrinsicContainer = {
      chainId: 2001,
      chain: "BifrostKusama",
      assetNodes: assetNodes,
      extrinsic: extrinsics,
      extrinsicIndex: extrinsicIndex.i,
      instructionIndex: instructionIndex,
      nonce: nonce,
      assetAmountIn: tokenInAmountFN,
      assetSymbolIn: startAssetSymbol,
      // pathInLocalId: tokenIn.assetId,
      assetSymbolOut: endAssetSymbol,
      // pathOutLocalId: tokenOut.assetId,
      pathInLocalId: pathNodeValues.pathInLocalId,
      pathOutLocalId: pathNodeValues.pathOutLocalId,
      pathSwapType: pathNodeValues.pathSwapType,
      pathAmount: amountIn,
      expectedAmountOut: tokenOutAmountFn,
      api: dexApi.api,
      reverseTx: reverseExtrinsic
    }

    increaseIndex(extrinsicIndex)

    return swapTxContainer

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
  // get("KSM", "BNC", 1)
}
// run()