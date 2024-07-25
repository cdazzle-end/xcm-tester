
import {cryptoWaitReady} from "@polkadot/util-crypto"
import { FixedPointNumber, Token } from "@acala-network/sdk-core";
import { ApiPromise, Keyring, WsProvider } from '@polkadot/api';

import '@galacticcouncil/api-augment/hydradx';
import '@galacticcouncil/api-augment/basilisk';

import { SubmittableExtrinsic } from '@polkadot/api/promise/types';
// import { ZERO, INFINITY, ONE, TradeRouter, PoolService, Router, BigNumber, Asset } from '@galacticcouncil/sdk';
import { ZERO, INFINITY, ONE, TradeRouter, PoolService, Router, BigNumber, Asset } from 'hydra-sdk';
import { IndexObject, PathData, PathNodeValues, SwapExtrinsicContainer, SwapInstruction } from "./../instructions/types.ts";
import { increaseIndex } from './../instructions/utils.ts';
import { getSigner } from './../instructions/utils.ts';
import { getAllNodeProviders } from "@paraspell/sdk";
import { localRpcs } from "./../instructions/txConsts.ts";
import { getApiForNode } from './../instructions/apiUtils.ts'

// const gSdk = await import('@galacticcouncil/sdk');
// const { ZERO, INFINITY, ONE, TradeRouter, PoolService, Router, BigNumber } = await import('@galacticcouncil/sdk');
// import gSdk from '@galacticcouncil/sdk';
// const { ZERO, INFINITY, ONE, TradeRouter, PoolService, Router, BigNumber } = gSdk;

const niceEndpoint = "wss://hydradx-rpc.dwellir.com"
const wsLocalChain = localRpcs["HydraDX"]


export async function getHdxSwapExtrinsicDynamic(
  swapType: number,
  swapData: PathData,
  startAssetSymbol: string, 
  destAssetSymbol: string, 
  assetInAmount: string, 
  assetOutAmount: string, 
  swapInstructions: SwapInstruction[], 
  chopsticks: boolean = true, 
  txIndex: number = 0, 
  extrinsicIndex: IndexObject, 
  instructionIndex: number[],
  priceDeviationPercent: number = 2
  ): Promise<[SwapExtrinsicContainer, SwapInstruction[]]>{
    console.log(`HDX (${startAssetSymbol}) -> (${destAssetSymbol}) assetInAmount: ${assetInAmount} assetOutAmount: ${assetOutAmount}`)

    const api = await getApiForNode("HydraDX", chopsticks)
    await api.isReady;
    const poolService = new PoolService(api);
    const router = new TradeRouter(poolService);

    let signer = await getSigner(chopsticks, false)
    let accountNonce = await api.query.system.account(signer.address)
    let nonce = accountNonce.nonce.toNumber()
    nonce += txIndex

    let startAssetId = swapInstructions[0].assetInLocalId

    
    // Suppress unexpected console.log output from the SDK. This is a temporary workaround, because i cant turn it back on for the sdk, but normal console.log messages will resturn
    const originalConsoleLog = console.log;
    console.log = () => {};
    let allAssets: Asset[] = await router.getAllAssets() // This prints sdk logs
    console.log = originalConsoleLog;
  
    let assetPathSymbols = [startAssetSymbol]
    let assetPathIds = [startAssetId]

    // CHANGING to ID's
    swapInstructions.forEach((instruction) => {
      assetPathIds.push(instruction.assetNodes[1].getAssetLocalId())
    })

    // let pathsAndInstructions = splitPathAndInstructions(assetPathSymbols, swapInstructions)
    let pathsAndInstructions = splitPathAndInstructions(assetPathIds, swapInstructions)
    let assetPathToExecute = pathsAndInstructions.assetPath
    let instructionsToExecute = pathsAndInstructions.instructionsToExecute
    let remainingInstructions = pathsAndInstructions.remainingInstructions
    let assetNodes = [swapInstructions[0].assetNodes[0]]
    instructionsToExecute.forEach((instruction) => {
      assetNodes.push(instruction.assetNodes[1])
    })

    

    let destAssetSymbolDynamic = assetNodes[assetNodes.length - 1].getAssetRegistrySymbol()
    let expectedOutDynamic = instructionsToExecute[instructionsToExecute.length - 1].assetNodes[1].pathValue

    let path: Asset[] = assetPathToExecute.map((assetId) => {
      const assetInPath =  allAssets.find((asset) => asset.id == assetId)
      // console.log(`Asset ${assetInPath.symbol} ${assetInPath.id} ->`)
      return assetInPath
    })
    const assetIn = path[0]
    const assetOut = path[path.length - 1]

    let number = new BigNumber(ZERO)
    let fnInputAmount = new FixedPointNumber(assetInAmount.toString(), assetIn.decimals)
    let fnOutputAmount = new FixedPointNumber(expectedOutDynamic.toString(), assetOut.decimals)

    //2% acceptable price deviation 2 / 100
    let priceDeviation = fnOutputAmount.mul(new FixedPointNumber(priceDeviationPercent)).div(new FixedPointNumber(100))
    let expectedOutMinusDeviation = fnOutputAmount.sub(priceDeviation)

    let bestBuy = await router.getBestSell(assetIn.id, assetOut.id, assetInAmount.toString())
    // console.log("Created best buy")
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
    let pathAmount = fnInputAmount.toChainData()
    let pathSwapType = swapType
    let swapTxContainer: SwapExtrinsicContainer = {
      relay: 'polkadot',
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
      pathType: pathSwapType,
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