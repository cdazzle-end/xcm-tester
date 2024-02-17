// import { RegistryError } from '@polkadot/types/types/registry';
// // import * as s from 'json-stringify-safe';
// // import flatted from 'flatted';
// // import { encodeAddress, decodeAddress } from "@polkadot/keyring";
// import { BalanceChangeStatue } from '../../src/types';
// import {Mangata} from '@mangata-finance/sdk'
// import { wsLocalFrom, wsLocalDestination, assetSymbol, fromChain, toChain } from '../xcm_tests/testParams'
// // import { u8aToHex } from '@polkadot/util';
// import { mnemonicToLegacySeed, hdEthereum } from '@polkadot/util-crypto';
// const { ApiPromise } = require('@polkadot/api');
// // const { WsProvider } = require('@polkadot/rpc-provider');
// import { options } from '@acala-network/api';
// // import { SwapPromise } from "@acala-network/sdk-swap";
// import { WalletPromise } from "@acala-network/sdk-wallet";
import {cryptoWaitReady} from "@polkadot/util-crypto"
import { FixedPointNumber, Token } from "@acala-network/sdk-core";
// import { Wallet,  } from "@acala-network/sdk"
// import { AcalaDex, AggregateDex } from "@acala-network/sdk-swap"
// import { AggregateDexSwapParams } from '@acala-network/sdk-swap/types'
// import { TradeRouter, PoolService, Router, BigNumber } from "@galacticcouncil/sdk"
import { ApiPromise, Keyring, WsProvider } from '@polkadot/api';

import '@galacticcouncil/api-augment/hydradx';
import '@galacticcouncil/api-augment/basilisk';

import { SubmittableExtrinsic } from '@polkadot/api/promise/types';
import { ZERO, INFINITY, ONE, TradeRouter, PoolService, Router, BigNumber, Asset } from '@galacticcouncil/sdk';
import { IndexObject, PathNodeValues, ReverseSwapExtrinsicParams, SwapExtrinsicContainer, SwapInstruction } from "./../instructions/types.ts";
import { increaseIndex } from './../instructions/utils.ts';
import { getSigner } from './../instructions/utils.ts';

// const gSdk = await import('@galacticcouncil/sdk');
// const { ZERO, INFINITY, ONE, TradeRouter, PoolService, Router, BigNumber } = await import('@galacticcouncil/sdk');
// import gSdk from '@galacticcouncil/sdk';
// const { ZERO, INFINITY, ONE, TradeRouter, PoolService, Router, BigNumber } = gSdk;

const niceEndpoint = 'wss://rpc.nice.hydration.cloud'
const wsLocalChain = "ws://172.26.130.75:8010"


// Swap sdk doesn't allow us to specifiy a min amount out, but we can use it to contruct the swap TX then just modify the minAmount out parameter
export async function getBsxSwapExtrinsic(
  startAssetSymbol: string, 
  destAssetSymbol: string, 
  assetInAmount: number, 
  assetOutAmount: number, 
  swapInstructions: any[], 
  chopsticks: boolean = false, 
  txIndex: number = 0, 
  extrinsicIndex: IndexObject, 
  instructionIndex: number[],
  pathNodeValues: PathNodeValues,
  priceDeviationPercent: number = 2
  ) {
  console.log("GETTING BSX SWAP EXTRINSIC")
  console.log(`startAssetSymbol: ${startAssetSymbol} destAssetSymbol: ${destAssetSymbol} assetInAmount: ${assetInAmount} assetOutAmount: ${assetOutAmount}`)
  let rpc = chopsticks ? wsLocalChain : niceEndpoint
    const provider = new WsProvider(rpc);
    const api = new ApiPromise({ provider });
    await api.isReady;
    const poolService = new PoolService(api);
    const router = new TradeRouter(poolService);
    let signer = await getSigner(chopsticks, false)
    let accountNonce = await api.query.system.account(signer.address)
    let nonce = accountNonce.nonce.toNumber()
    nonce += txIndex

    let assetNodes = [swapInstructions[0].assetNodes[0]]
    swapInstructions.forEach((instruction) => {
      assetNodes.push(instruction.assetNodes[1])
    })

    let allAssets: Asset[] = await router.getAllAssets()

    let assetPathSymbols = [startAssetSymbol]
    swapInstructions.forEach((instruction) => {
      assetPathSymbols.push(instruction.assetNodes[1].getAssetRegistrySymbol())
    })

    // Need to split paths so that there is no duplicate symbol in a single route
    let assetPaths = splitAssetPaths(assetPathSymbols)
    let routerSwapExtrinsicsPromise = assetPaths.map(async(assetPathSymbols) => {
      let path: Asset[] = assetPathSymbols.map((symbol) => {
        const assetInPath =  allAssets.find((asset) => asset.symbol === symbol)
        console.log(`Asset ${assetInPath.symbol} ${assetInPath.id} ->`)
        return assetInPath
      })
      let tradeRoute = path.map((asset) => asset.id)
      const assetIn = path[0]
      const assetOut = path[path.length - 1]

      const reverseIn = path[path.length - 1]
      const reverseOut = path[0]

      let number = new BigNumber(ZERO)
      let fnInputAmount = new FixedPointNumber(assetInAmount.toString(), assetIn.decimals)
      let fnOutputAmount = new FixedPointNumber(assetOutAmount.toString(), assetOut.decimals)

      
  
      //2% acceptable price deviation 2 / 100
      let priceDeviation = fnOutputAmount.mul(new FixedPointNumber(priceDeviationPercent)).div(new FixedPointNumber(100))
      let expectedOutMinusDeviation = fnOutputAmount.sub(priceDeviation)

      const reverseSupply = expectedOutMinusDeviation

      let reversePriceDev = fnInputAmount.mul(new FixedPointNumber(5)).div(new FixedPointNumber(100));
      const reverseTarget = fnInputAmount.sub(reversePriceDev)
  
      let bestBuy = await router.getBestSell(assetIn.id, assetOut.id, assetInAmount.toString())
      let swapZero = bestBuy.toTx(number)
      let tx: SubmittableExtrinsic = swapZero.get()
      
      const route = tx.toHuman()["method"]["args"]["route"]
  
      console.log(` FN INput amount: ${fnInputAmount.toChainData()}`)
      const txFormatted = await api.tx.router
        .sell(
          assetIn.id, 
          assetOut.id, 
          fnInputAmount.toChainData(), 
          expectedOutMinusDeviation.toChainData(), 
          route
          )

      let reverseTxParams: ReverseSwapExtrinsicParams = {
        chainId: 2090,
        chain: "Basilisk",
        supplyAssetId: reverseIn.id,
        targetAssetId: reverseOut.id,
        supplySymbol: destAssetSymbol,
        targetSymbol: startAssetSymbol,
        supply: reverseSupply,
        target: reverseTarget,
        module: "router",
        call: "sell",
        path: route,
        // api: api
      }

      let pathInId = assetIn.id
      let pathOutId = assetOut.id
      let pathAmount = fnInputAmount.toNumber()
      let pathSwapType = pathNodeValues.pathSwapType
      // await api.disconnect()
      let swapTxContainer: SwapExtrinsicContainer = {
        chainId: 2090,
        chain: "Basilisk",
        assetNodes: assetNodes,
        extrinsic: txFormatted,
        extrinsicIndex: extrinsicIndex.i,
        instructionIndex: instructionIndex,
        nonce: nonce,
        assetSymbolIn: startAssetSymbol,
        assetSymbolOut: destAssetSymbol,
        assetAmountIn: fnInputAmount,
        expectedAmountOut: fnOutputAmount,
        pathInLocalId: pathInId,
        pathOutLocalId: pathOutId,
        pathSwapType: pathSwapType,
        pathAmount: pathAmount,
        api: api,
        reverseTx: reverseTxParams
      }
      increaseIndex(extrinsicIndex)
      return swapTxContainer
    })

    let routerSwapExtrinsics = await Promise.all(routerSwapExtrinsicsPromise)
    return routerSwapExtrinsics
    // // assetPathSymbols.forEach((symbol) => console.log(`${symbol} ->`))
    // let assetPath = assetPathSymbols.map((symbol) => {
    //   const assetInPath =  allAssets.find((asset) => asset.symbol === symbol)
    //   console.log(`Asset ${assetInPath.symbol} ${assetInPath.id} ->`)
    //   return assetInPath
    // })
    // let tradeRoute = assetPath.map((asset) => asset.id)
    // const assetIn = assetPath[0]
    // const assetOut = assetPath[assetPath.length - 1]
    // // console.log(`ASSET IN ${JSON.stringify(assetIn, null, 2)}`)
    // // console.log(`ASSET OUT ${JSON.stringify(assetOut, null, 2)}`)
    // // if(!assetIn || !assetOut){
    // //   throw new Error("Cant find BSX asset from symbol")
    // // }
    // let number = new BigNumber(ZERO)
    // let fnInputAmount = new FixedPointNumber(assetInAmount.toString(), assetIn.decimals)
    // let fnOutputAmount = new FixedPointNumber(assetOutAmount.toString(), assetOut.decimals)

    // //2% acceptable price deviation 2 / 100
    // let priceDeviation = fnOutputAmount.mul(new FixedPointNumber(priceDeviationPercent)).div(new FixedPointNumber(100))
    // let expectedOutMinusDeviation = fnOutputAmount.sub(priceDeviation)

    // let bestBuy = await router.getBestSell(assetIn.id, assetOut.id, assetInAmount.toString())
    // let swapZero = bestBuy.toTx(number)
    // let key = await getSigner()
    // let tx: SubmittableExtrinsic = swapZero.get()
    
    // const route = tx.toHuman()["method"]["args"]["route"]

    // console.log(` FN INput amount: ${fnInputAmount.toChainData()}`)
    // const txFormatted = await api.tx.router.sell(assetIn.id, assetOut.id, fnInputAmount.toChainData(), expectedOutMinusDeviation.toChainData(), route)
    // // await api.disconnect()
    // let swapTxContainer: SwapExtrinsicContainer = {
    //   chainId: 2090,
    //   chain: "Basilisk",
    //   extrinsic: txFormatted,
    //   nonce: nonce,
    //   assetSymbolIn: startAssetSymbol,
    //   assetSymbolOut: destAssetSymbol,
    //   assetAmountIn: fnInputAmount,
    //   expectedAmountOut: fnOutputAmount,
    //   api: api
    // }
    // return swapTxContainer
}

export async function getBsxSwapExtrinsicDynamic(
  startAssetSymbol: string, 
  destAssetSymbol: string, 
  assetInAmount: number, 
  assetOutAmount: number, 
  swapInstructions: any[], 
  chopsticks: boolean = true, 
  txIndex: number = 0, 
  extrinsicIndex: IndexObject, 
  instructionIndex: number[],
  pathNodeValues: PathNodeValues,
  priceDeviationPercent: number = 2
  ): Promise<[SwapExtrinsicContainer, SwapInstruction[]]>{
    console.log("GETTING BSX SWAP EXTRINSIC")
    console.log(`startAssetSymbol: ${startAssetSymbol} destAssetSymbol: ${destAssetSymbol} assetInAmount: ${assetInAmount} assetOutAmount: ${assetOutAmount}`)
    let rpc = chopsticks ? wsLocalChain : niceEndpoint
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

    let path: Asset[] = assetPathToExecute.map((symbol) => {
      const assetInPath =  allAssets.find((asset) => asset.symbol === symbol)
      console.log(`Asset ${assetInPath.symbol} ${assetInPath.id} ->`)
      return assetInPath
    })
    // let tradeRoute = path.map((asset) => asset.id)
    const assetIn = path[0]
    const assetOut = path[path.length - 1]

    let number = new BigNumber(ZERO)
    let fnInputAmount = new FixedPointNumber(assetInAmount.toString(), assetIn.decimals)
    let fnOutputAmount = new FixedPointNumber(assetOutAmount.toString(), assetOut.decimals)

    //2% acceptable price deviation 2 / 100
    let priceDeviation = fnOutputAmount.mul(new FixedPointNumber(priceDeviationPercent)).div(new FixedPointNumber(100))
    let expectedOutMinusDeviation = fnOutputAmount.sub(priceDeviation)

    let bestBuy = await router.getBestSell(assetIn.id, assetOut.id, assetInAmount.toString())
    let swapZero = bestBuy.toTx(number)
    let tx: SubmittableExtrinsic = swapZero.get()
    
    const route = tx.toHuman()["method"]["args"]["route"]

    console.log(` FN INput amount: ${fnInputAmount.toChainData()}`)
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
    let pathSwapType = pathNodeValues.pathSwapType
    let swapTxContainer: SwapExtrinsicContainer = {
      chainId: 2090,
      chain: "Basilisk",
      assetNodes: assetNodes,
      extrinsic: txFormatted,
      extrinsicIndex: extrinsicIndex.i,
      instructionIndex: instructionIndex,
      nonce: nonce,
      assetSymbolIn: startAssetSymbol,
      assetSymbolOut: destAssetSymbol,
      assetAmountIn: fnInputAmount,
      expectedAmountOut: fnOutputAmount,
      pathInLocalId: pathInId,
      pathOutLocalId: pathOutId,
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