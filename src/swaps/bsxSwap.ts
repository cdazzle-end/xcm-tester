
import { FixedPointNumber } from "@acala-network/sdk-core";
import { ApiPromise } from '@polkadot/api';

import '@galacticcouncil/api-augment/basilisk';
import '@galacticcouncil/api-augment/hydradx';

import { Asset, BigNumber, PoolService, TradeRouter, ZERO } from '@galacticcouncil/sdk';
import { SubmittableExtrinsic } from '@polkadot/api/promise/types';
import { getApiForNode } from './../utils/index.ts';
import { IndexObject, PathType, SwapExtrinsicContainer, SwapInstruction } from "./../types/types.ts";

const niceEndpoint = 'wss://rpc.nice.hydration.cloud'
const wsLocalChain = "ws://172.26.130.75:8010"

export async function getBsxSwapExtrinsicDynamic(
  swapType: PathType,
  startAssetSymbol: string, 
  destAssetSymbol: string, 
  assetInAmount: string, 
  assetOutAmount: string, 
  swapInstructions: any[], 
  chopsticks: boolean = true,
  extrinsicIndex: IndexObject, 
  instructionIndex: number[],
  priceDeviationPercent: number = 2
  ): Promise<[SwapExtrinsicContainer, SwapInstruction[]]>{

    const api = await getApiForNode("Basilisk", chopsticks)
    await api.isReady;
    const poolService = new PoolService(api);
    const router = new TradeRouter(poolService);

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
      return assetInPath!
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
    
    const route = tx.toHuman()!["method"]["args"]["route"]

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
      relay: 'kusama',
      chainId: 2090,
      chain: "Basilisk",
      assetNodes: assetNodes,
      extrinsic: txFormatted,
      extrinsicIndex: extrinsicIndex.i,
      instructionIndex: instructionIndex,
      assetSymbolIn: startAssetSymbol,
      assetSymbolOut: destAssetSymbolDynamic,
      assetAmountIn: fnInputAmount,
      expectedAmountOut: fnOutputAmount,
      pathType: pathSwapType,
      pathAmount: pathAmount,
      api: api,
    }
    return [swapTxContainer, remainingInstructions]
}

function splitAssetPaths(assetPathSymbols: string[]){
  let assetPaths: [string[]] = [[]]
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