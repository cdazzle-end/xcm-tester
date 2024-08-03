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
import { IndexObject, PathNodeValues, PathType, SwapExtrinsicContainer, SwapInstruction } from '../instructions/types.ts';
import { ModuleBApi, ModuleBChainOption, BifrostConfig } from '@zenlink-dex/sdk-api';
// const sdkApi = await import('@zenlink-dex/sdk-api');
// const { ModuleBApi } = sdkApi;

// import { BifrostConfig } from '@zenlink-dex/sdk-api/chain/config';
import { Percent, Token, TokenAmount,  StablePair } from '@zenlink-dex/sdk-core';
import { SubmittableExtrinsic } from '@polkadot/api/submittable/types'
import { ISubmittableResult, IU8a } from '@polkadot/types/types'
import { increaseIndex } from './../instructions/utils.ts';
import { getSigner } from './../instructions/utils.ts';
import { localRpcs } from './../instructions/txConsts.ts';
import { getApiForNode } from './../instructions/apiUtils.ts'

const wsLocalChain = localRpcs["BifrostPolkadot"]
const bncRpc = "wss://hk.p.bifrost-rpc.liebi.com/ws"

export async function getBncPolkadotSwapExtrinsicDynamic( 
  swapType: PathType,
  swapInstructions: SwapInstruction[], 
  chopsticks: boolean = true, 
  txIndex: number, 
  extrinsicIndex: IndexObject, 
  instructionIndex: number[], 
  priceDeviationPercent: number = 2
  ): Promise<[SwapExtrinsicContainer, SwapInstruction[]]> {
  const response = await axios.get('https://raw.githubusercontent.com/zenlinkpro/token-list/main/tokens/bifrost-polkadot.json');
  const tokensMeta = response.data.tokens;
  await cryptoWaitReady();

  let startAsset = swapInstructions[0].assetNodes[0].getAssetRegistrySymbol()
  let destAsset = swapInstructions[swapInstructions.length - 1].assetNodes[1].getAssetRegistrySymbol()
  let amountIn = swapInstructions[0].assetNodes[0].pathValue;
  let expectedAmountOut = swapInstructions[swapInstructions.length - 1].assetNodes[1].pathValue;

  let rpc = chopsticks ? wsLocalChain : bncRpc

  let accountPair = await getSigner(chopsticks, false);


  let assetNodes = [swapInstructions[0].assetNodes[0]]
  swapInstructions.forEach((instruction) => {
    assetNodes.push(instruction.assetNodes[1])
  })

  // console.log(`account address ${accountPair.address}`);

  // generate Tokens
  const tokens = tokensMeta.map((item: any) => {
    return new Token(item);
  });

  let tokenInSymbol, tokenOutSymbol;
  if(startAsset.toLowerCase() == 'aseed' || startAsset.toLowerCase() == 'kusd' ){
    tokenInSymbol = 'aUSD'
  } else{
    tokenInSymbol = startAsset
  }
  if(destAsset.toLowerCase() == 'aseed' || destAsset.toLowerCase() == 'kusd' ){
    tokenOutSymbol = 'aUSD'
  } else{
    tokenOutSymbol = destAsset
  }

  const tokenIn = tokens.find((item) => item.symbol.toLowerCase() === tokenInSymbol.toLowerCase());
  const tokenOut = tokens.find((item) => item.symbol.toLowerCase() === tokenOutSymbol.toLowerCase());
  // console.log('token0', tokenIn);
  // console.log('token1', tokenOut);

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

  if(!dexApi.api){
    throw new Error("BNC Polkadot dexApi.api is undefined")
  }

  let accountNonce = await dexApi.api.query.system.account(accountPair.address)
  // let accountNonce = await api.query.system.account(signer.address)
  let nonce = accountNonce.nonce.toNumber()
  nonce += txIndex
  // console.log("BNC Nonce: " + nonce)

  const account = accountPair.address;
  const standardPairs = await firstValueFrom(dexApi.standardPairOfTokens(tokens));
  const standardPools: any = await firstValueFrom(dexApi.standardPoolOfPairs(standardPairs));
  // const stablePairs = await firstValueFrom(dexApi.stablePairOf());
  // const stablePools = await firstValueFrom(dexApi.stablePoolOfPairs(stablePairs));
  let stablePools = []
  let tokenInAmountFN = new FixedPointNumber(amountIn, tokenIn.decimals);
  const tokenInAmount = new TokenAmount(tokenIn, tokenInAmountFN.toChainData());
  const tokenOutAmountFn = new FixedPointNumber(expectedAmountOut, tokenOut.decimals);
  

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
    throw new Error("BNC Polkadot swap tx builder error")
  }
  
  // Allow for 2% price deviation from expected value,should probably be tighter
  let slipAmount = tokenOutAmountFn.mul(new FixedPointNumber(priceDeviationPercent)).div(new FixedPointNumber(100))
  let amountOutFnMinusSlip = tokenOutAmountFn.sub(slipAmount)

  console.log(`Token out amount: ${tokenOutAmountFn.toChainData()} Minus slip: ${amountOutFnMinusSlip.toChainData()}`)
  console.log(`Slip amount: ${slipAmount.toChainData()}`)

  const tokenOutAmount = new TokenAmount(tokenOut, amountOutFnMinusSlip.toChainData());
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

  if (!extrinsics) {
    throw new Error("BNC Polkadot swap tx builder error")
  };

  let swapTxContainer: SwapExtrinsicContainer = {
    relay: 'polkadot',
    chainId: 2030,
    chain: "BifrostPolkadot",
    assetNodes: assetNodes,
    extrinsic: extrinsics,
    extrinsicIndex: extrinsicIndex.i,
    instructionIndex: instructionIndex,
    nonce: nonce,
    assetAmountIn: tokenInAmountFN,
    assetSymbolIn: startAsset,
    // pathInLocalId: tokenIn.assetId,
    assetSymbolOut: destAsset,
    // pathOutLocalId: tokenOut.assetId,
    // pathInLocalId: pathNodeValues.pathInLocalId,
    // pathOutLocalId: pathNodeValues.pathOutLocalId,
    pathType: swapType,
    pathAmount: amountIn,
    expectedAmountOut: tokenOutAmountFn,
    api: dexApi.api,
    // reverseTx: reverseExtrinsic
  }

  increaseIndex(extrinsicIndex)
  let remainingInstructions: SwapInstruction[] = []
  return [swapTxContainer, remainingInstructions]

}

async function run(){
  // get("KSM", "BNC", 1)
}
// run()