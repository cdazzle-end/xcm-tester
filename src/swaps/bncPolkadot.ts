import { ApiPromise, WsProvider } from '@polkadot/api';
import * as fs from 'fs';
import path from 'path';

import { FixedPointNumber } from '@acala-network/sdk-core';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import { BifrostConfig, ModuleBApi } from '@zenlink-dex/sdk-api';
import { Token, TokenAmount } from '@zenlink-dex/sdk-core';
import { SmartRouterV2 } from '@zenlink-dex/sdk-router';
import { firstValueFrom } from 'rxjs';
import { fileURLToPath } from 'url';
import { localRpcs } from '../config/txConsts.ts';
import { IndexObject, PathType, SwapExtrinsicContainer, SwapInstruction } from '../types/types.ts';
import { getSigner } from '../utils/utils.ts';
import bn from 'bignumber.js'
import { getBalanceFromDisplay, getBifrostDexApi } from '../utils/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const wsLocalChain = localRpcs["BifrostPolkadot"]
const bncRpc = "wss://hk.p.bifrost-rpc.liebi.com/ws"

export async function getBncPolkadotSwapExtrinsicDynamic( 
  swapType: PathType,
  swapInstructions: SwapInstruction[], 
  chopsticks: boolean = true, 
  priceDeviationPercent: number = 2
  ): Promise<[SwapExtrinsicContainer, SwapInstruction[]]> {
  // const response = await axios.get('https://raw.githubusercontent.com/zenlinkpro/token-listlist/main/tokens/bifrost-polkadot.json');
  // const tokensMeta = response.data.tokens;
  let tokensData: any = JSON.parse(fs.readFileSync(path.join(__dirname, './bnc_polkadot_zen_assets.json'), 'utf8'));
  const tokensMeta = tokensData.tokens;
  await cryptoWaitReady();

  const assetIn = swapInstructions[0].assetNodes[0]
  const assetOut = swapInstructions[swapInstructions.length - 1].assetNodes[1]
  let startAssetSymbol = assetIn.getAssetSymbol()
  let destAssetSymbol = assetOut.getAssetSymbol()
  let amountIn = swapInstructions[0].assetNodes[0].pathValue;
  let expectedAmountOut = swapInstructions[swapInstructions.length - 1].assetNodes[1].pathValue;



  let accountPair = await getSigner(chopsticks, swapInstructions[0].assetNodes[0].chain);


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
  if(startAssetSymbol.toLowerCase() == 'aseed' || startAssetSymbol.toLowerCase() == 'kusd' ){
    tokenInSymbol = 'aUSD'
  } else{
    tokenInSymbol = startAssetSymbol
  }
  if(destAssetSymbol.toLowerCase() == 'aseed' || destAssetSymbol.toLowerCase() == 'kusd' ){
    tokenOutSymbol = 'aUSD'
  } else{
    tokenOutSymbol = destAssetSymbol
  }

  const tokenIn = tokens.find((item) => item.symbol.toLowerCase() === tokenInSymbol.toLowerCase());
  const tokenOut = tokens.find((item) => item.symbol.toLowerCase() === tokenOutSymbol.toLowerCase());

  const tokensMap: Record<string, typeof Token> = {};
  tokens.reduce((total: any, cur: any) => {
    total[cur.assetId] = cur;
    return total;
  }, tokensMap);

  // generate the dex api
  // let rpc = chopsticks ? wsLocalChain : bncRpc
  // const provider = new WsProvider(rpc);
  // const dexApi = new ModuleBApi(
  //   provider,
  //   BifrostConfig
  // );



  // await provider.isReady;
  // await dexApi.initApi(); // init the api;
  const dexApi = await getBifrostDexApi('polkadot', chopsticks)

  if(!dexApi.api){
    throw new Error("BNC Polkadot dexApi.api is undefined")
  }

  const account = accountPair.address;
  const standardPairs = await firstValueFrom(dexApi.standardPairOfTokens(tokens));
  const standardPools: any = await firstValueFrom(dexApi.standardPoolOfPairs(standardPairs));
  // const stablePairs = await firstValueFrom(dexApi.stablePairOf());
  // const stablePools = await firstValueFrom(dexApi.stablePoolOfPairs(stablePairs));
  let stablePools = []
  // let tokenInAmountFN = new FixedPointNumber(amountIn, tokenIn.decimals);
  let tokenInAmountBn: bn = getBalanceFromDisplay(amountIn, tokenIn.decimals);
  const tokenInAmount: TokenAmount = new TokenAmount(tokenIn, tokenInAmountBn.toString());
  const tokenOutAmountBn: bn = getBalanceFromDisplay(expectedAmountOut, tokenOut.decimals);
  

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
  let slipAmount = tokenOutAmountBn.times(new bn(priceDeviationPercent)).div(new bn(100)).integerValue(bn.ROUND_DOWN)
  let amountOutFnMinusSlip = tokenOutAmountBn.minus(slipAmount)

  console.log(`Token out amount: ${tokenOutAmountBn.toString()} Minus slip: ${amountOutFnMinusSlip.toString()}`)
  console.log(`Slip amount: ${slipAmount.toString()}`)

  const tokenOutAmount = new TokenAmount(tokenOut, amountOutFnMinusSlip.toString());
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
    type: "Swap",
    chain: "BifrostPolkadot",
    assetNodes: assetNodes,
    extrinsic: extrinsics,
    assetAmountIn: tokenInAmountBn,
    assetIn: assetIn,
    assetOut: assetOut,
    pathType: swapType,
    pathAmount: amountIn,
    expectedAmountOut: tokenOutAmountBn,
    // REVIEW api
    api: dexApi.api as unknown as ApiPromise,
    // reverseTx: reverseExtrinsic
  }

  let remainingInstructions: SwapInstruction[] = []
  return [swapTxContainer, remainingInstructions]

}

async function run(){
  // get("KSM", "BNC", 1)
}
// run()