import axios from 'axios';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { FixedPointNumber } from '@acala-network/sdk-core';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import { BifrostConfig, ModuleBApi } from '@zenlink-dex/sdk-api';
import { SmartRouterV2 } from '@zenlink-dex/sdk-router';
import { firstValueFrom } from 'rxjs';
import { IndexObject, PathType, SwapExtrinsicContainer, SwapInstruction } from '../types/types.ts';
import { Token, TokenAmount } from '@zenlink-dex/sdk-core';
import { getSigner } from '../utils/utils.ts';
import bn from 'bignumber.js'
import { getBalanceFromDisplay } from '../utils/index.ts';

const wsLocalChain = "ws://172.26.130.75:8009"
const bncRpc = "wss://bifrost-parachain.api.onfinality.io/public-ws"

export async function getBncSwapExtrinsicDynamic( 
  swapType: PathType,
  swapInstructions: SwapInstruction[], 
  chopsticks: boolean = true, 
  priceDeviationPercent: number = 2
  ): Promise<[SwapExtrinsicContainer, SwapInstruction[]]> {
  const response = await axios.get('https://raw.githubusercontent.com/zenlinkpro/token-list/main/tokens/bifrost-kusama.json');
  const tokensMeta = response.data.tokens;
  await cryptoWaitReady();

  const assetIn = swapInstructions[0].assetNodes[0]
  const startAssetSymbol = assetIn.getAssetSymbol()
  const assetOut = swapInstructions[swapInstructions.length - 1].assetNodes[1]
  const destAssetSymbol = assetOut.getAssetSymbol()
  
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

  if (!dexApi.api) throw new Error("bnc dex api npt inititalized");

  const account = accountPair.address;
  const standardPairs = await firstValueFrom(dexApi.standardPairOfTokens(tokens));
  const standardPools: any = await firstValueFrom(dexApi.standardPoolOfPairs(standardPairs));
  const stablePairs = await firstValueFrom(dexApi.stablePairOf());
  const stablePools = await firstValueFrom(dexApi.stablePoolOfPairs(stablePairs));

  let tokenInAmountFN = getBalanceFromDisplay(amountIn, tokenIn.decimals);
  const tokenInAmount = new TokenAmount(tokenIn, tokenInAmountFN.toString());
  const tokenOutAmountBn = getBalanceFromDisplay(expectedAmountOut, tokenOut.decimals);
  
  

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
    throw new Error("Cant find trade for bnc kusama swap params")
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
  if (!extrinsics) throw new Error("Cant create bnc kusama extrinsic");

  let swapTxContainer: SwapExtrinsicContainer = {
    relay: 'kusama',
    chainId: 2001,
    type: "Swap",
    chain: "BifrostKusama",
    assetNodes: assetNodes,
    extrinsic: extrinsics,
    assetAmountIn: new bn(tokenInAmountFN.toString()),
    assetIn: assetIn,
    assetOut: assetOut,
    pathType: swapType,
    pathAmount: amountIn,
    expectedAmountOut: new bn(tokenOutAmountBn.toString()),
    // REVIEW does api conversion from 10.10 to 12.1 work properly
    api: dexApi.api as unknown as ApiPromise,
  }
  let remainingInstructions: SwapInstruction[] = []
  return [swapTxContainer, remainingInstructions]

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