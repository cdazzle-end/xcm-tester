
import {cryptoWaitReady} from "@polkadot/util-crypto"
import { FixedPointNumber, Token } from "@acala-network/sdk-core";
import { ApiPromise, Keyring, WsProvider } from '@polkadot/api';

import '@galacticcouncil/api-augment/hydradx';
import '@galacticcouncil/api-augment/basilisk';

import { SubmittableExtrinsic } from '@polkadot/api/promise/types';
import { ZERO, INFINITY, ONE, TradeRouter, PoolService, Router, BigNumber, Asset } from '@galacticcouncil/sdk';
import { IndexObject, PathNodeValues, ReverseSwapExtrinsicParams, SwapExtrinsicContainer, SwapInstruction } from "./../instructions/types.ts";
import { increaseIndex } from './../instructions/utils.ts';
import { getSigner } from './../instructions/utils.ts';
import { getAllNodeProviders } from "@paraspell/sdk";
import { localRpcs } from "./../instructions/txConsts.ts";

// const gSdk = await import('@galacticcouncil/sdk');
// const { ZERO, INFINITY, ONE, TradeRouter, PoolService, Router, BigNumber } = await import('@galacticcouncil/sdk');
// import gSdk from '@galacticcouncil/sdk';
// const { ZERO, INFINITY, ONE, TradeRouter, PoolService, Router, BigNumber } = gSdk;

const niceEndpoint = "wss://hydradx-rpc.dwellir.com"
const wsLocalChain = localRpcs["HydraDX"]


export async function getHdxSwapExtrinsicDynamic(
  swapType: number,
  startAssetSymbol: string, 
  destAssetSymbol: string, 
  assetInAmount: number, 
  assetOutAmount: number, 
  swapInstructions: any[], 
  chopsticks: boolean = true, 
  txIndex: number = 0, 
  extrinsicIndex: IndexObject, 
  instructionIndex: number[],
  priceDeviationPercent: number = 2
  ): Promise<[SwapExtrinsicContainer, SwapInstruction[]]>{
    // console.log(`BSX (${startAssetSymbol}) -> (${destAssetSymbol}) assetInAmount: ${assetInAmount} assetOutAmount: ${assetOutAmount}`)
    let endpoints = getAllNodeProviders("HydraDX");
    let rpc = chopsticks ? wsLocalChain : endpoints[0]

    const provider = new WsProvider(rpc);
    const api = new ApiPromise({ provider });
    await api.isReady;
    const poolService = new PoolService(api);
    const router = new TradeRouter(poolService);
    let signer = await getSigner(chopsticks, false)
    let accountNonce = await api.query.system.account(signer.address)
    let nonce = accountNonce.nonce.toNumber()
    nonce += txIndex


    let allAssets: Asset[] = await router.getAllAssets()

    let assetPathSymbols = [startAssetSymbol]
    swapInstructions.forEach((instruction) => {
      assetPathSymbols.push(instruction.assetNodes[1].getAssetRegistrySymbol())
    })

    let pathsAndInstructions = splitPathAndInstructions(assetPathSymbols, swapInstructions)
    let assetPathToExecute = pathsAndInstructions.assetPath
    let instructionsToExecute = pathsAndInstructions.instructionsToExecute
    let remainingInstructions = pathsAndInstructions.remainingInstructions
    let assetNodes = [swapInstructions[0].assetNodes[0]]
    instructionsToExecute.forEach((instruction) => {
      assetNodes.push(instruction.assetNodes[1])
    })

    

    let destAssetSymbolDynamic = assetNodes[assetNodes.length - 1].getAssetRegistrySymbol()
    let expectedOutDynamic = instructionsToExecute[instructionsToExecute.length - 1].assetNodes[1].pathValue

    let path: Asset[] = assetPathToExecute.map((symbol) => {
      const assetInPath =  allAssets.find((asset) => asset.symbol === symbol)
      // console.log(`Asset ${assetInPath.symbol} ${assetInPath.id} ->`)
      return assetInPath
    })
    // let tradeRoute = path.map((asset) => asset.id)
    const assetIn = path[0]
    const assetOut = path[path.length - 1]

    let number = new BigNumber(ZERO)
    let fnInputAmount = new FixedPointNumber(assetInAmount.toString(), assetIn.decimals)
    let fnOutputAmount = new FixedPointNumber(expectedOutDynamic.toString(), assetOut.decimals)

    //2% acceptable price deviation 2 / 100
    let priceDeviation = fnOutputAmount.mul(new FixedPointNumber(priceDeviationPercent)).div(new FixedPointNumber(100))
    let expectedOutMinusDeviation = fnOutputAmount.sub(priceDeviation)

    let bestBuy = await router.getBestSell(assetIn.id, assetOut.id, assetInAmount.toString())
    let swapZero = bestBuy.toTx(number)
    let tx: SubmittableExtrinsic = swapZero.get()
    
    const route = tx.toHuman()["method"]["args"]["route"]

    // console.log(` FN INput amount: ${fnInputAmount.toChainData()}`)
    const txFormatted = await api.tx.router
      .sell(
        assetIn.id, 
        assetOut.id, 
        fnInputAmount.toChainData(), 
        expectedOutMinusDeviation.toChainData(), 
        route
        )

    let pathInId = assetIn.id
    let pathOutId = assetOut.id
    let pathAmount = fnInputAmount.toNumber()
    let pathSwapType = swapType
    let swapTxContainer: SwapExtrinsicContainer = {
      chainId: 2034,
      chain: "HydraDX",
      assetNodes: assetNodes,
      extrinsic: txFormatted,
      extrinsicIndex: extrinsicIndex.i,
      instructionIndex: instructionIndex,
      nonce: nonce,
      assetSymbolIn: startAssetSymbol,
      assetSymbolOut: destAssetSymbolDynamic,
      assetAmountIn: fnInputAmount,
      expectedAmountOut: fnOutputAmount,
      pathSwapType: pathSwapType,
      pathAmount: pathAmount,
      api: api,
    }
    increaseIndex(extrinsicIndex)
    return [swapTxContainer, remainingInstructions]
}

function splitAssetPaths(assetPathSymbols: string[]){
  let assetPaths = []
  let assetCounter = {}
  let previousIndex
  let remainingInstructions: SwapInstruction[] = []
  assetPathSymbols.forEach((symbol, index) => {
    if(!assetCounter[symbol]){
      assetCounter[symbol] = 1
    } else {
      assetCounter[symbol] += 1
    }
    if(assetCounter[symbol] > 1){
      let newPath = assetPathSymbols.slice(0, index)
      assetPaths.push(newPath)
      assetCounter = {}
      previousIndex = index - 1
    } else if(index == assetPathSymbols.length - 1){
      let finalPath = assetPathSymbols.slice(previousIndex)
      assetPaths.push(finalPath)
    }
  })
  return assetPaths
}
interface BsxPathAndInstructions {
  assetPath: string[],
  instructionsToExecute: SwapInstruction[]
  remainingInstructions: SwapInstruction[]
}

function splitPathAndInstructions(assetPathSymbols: string[], swapInstructions: SwapInstruction[]): BsxPathAndInstructions{
  // let assetPaths = []
  let assetCounter = {}
  let previousIndex
  // let remainingInstructions: SwapInstruction[] = []
  assetPathSymbols.forEach((symbol, index) => {
    if(!assetCounter[symbol]){
      assetCounter[symbol] = 1
    } else {
      assetCounter[symbol] += 1
    }
    if(assetCounter[symbol] > 1){

      let newPath = assetPathSymbols.slice(0, index)
      let instructionsToExecute:SwapInstruction[] = swapInstructions.slice(0, index)
      let remainingInstructions:SwapInstruction[] = swapInstructions.slice(index)
      let pathAndInstructions: BsxPathAndInstructions = {
        assetPath: newPath,
        instructionsToExecute: instructionsToExecute,
        remainingInstructions: remainingInstructions
      }

      return pathAndInstructions
    }
  })
  // return assetPaths
  let pathsAndInstructions: BsxPathAndInstructions = {
    assetPath: assetPathSymbols,
    instructionsToExecute: swapInstructions,
    remainingInstructions: []
  }
  return pathsAndInstructions
}



class GetAllAssetsExample {
    async script(api: ApiPromise): Promise<any> {
      const poolService = new PoolService(api);
      const router = new TradeRouter(poolService);
      return router.getAllAssets();
    }
  }
  
//   new GetAllAssetsExample(ApiUrl.Nice, 'Get all assets').run()


async function run(){
    // await getSwapTx("KSM", "BSX", 1)
    // let assets = await getSwapTx("KSM", "BSX", 1)
    // console.log(JSON.stringify(assets, null, 2))

}

// run()

// const getSigner = async () => {
//   await cryptoWaitReady()
//   const keyring = new Keyring({
//     type: "sr25519",
//   });

//   // Add Alice to our keyring with a hard-deived path (empty phrase, so uses dev)
//   return keyring.addFromUri("//Alice");
// };