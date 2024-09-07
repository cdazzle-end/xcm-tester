import { FixedPointNumber } from "@acala-network/sdk-core"
// import { ApiPromise, options, WsProvider, Keyring } from "@parallel-finance/api" 
import { ApiPromise, WsProvider, Keyring } from "@polkadot/api"
import { IMyAsset, IndexObject, PathType, SwapExtrinsicContainer, SwapInstruction } from "./../types/types"
const wsLocalChain = "ws://172.26.130.75:8012"
const hkoWs = "wss://heiko-rpc.parallel.fi"
import path from 'path'
import { fileURLToPath } from 'url';
import { getApiForNode, getAssetMapAssets, getAssetRegistry, getBalanceFromDisplay } from './../utils/index.ts'
import bn from 'bignumber.js'
// import { MyAsset } from "../core/index.ts"
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function getHkoSwapExtrinsic(
  swapType: PathType,
  startAssetSymbol: string, 
  destAssetSymbol: string, 
  assetInAmount: string, 
  assetOutAmount: string, 
  swapInstructions: SwapInstruction[], 
  chopsticks: boolean = true,
  priceDeviationPercent: number = 2
  ) {
    // REVIEW Changing api. Create without options, use getApiForNode()

    const api = await getApiForNode('ParallelHeiko', chopsticks)
      let assetNodes = [swapInstructions[0].assetNodes[0]]
    swapInstructions.forEach((instruction) => {
      assetNodes.push(instruction.assetNodes[1])
    })

      const assetIn = assetNodes[0]
      const assetOut = assetNodes[assetNodes.length - 1]

      // let assetIn = getAssetBySymbol(startAssetSymbol)
      // let assetInDecimals = assetIn.getDecimals()
      // let assetInAmountFn = new FixedPointNumber(assetInAmount, assetInDecimals)
      let inputAmount: bn = assetIn.getChainBalance()
      let outputAmount: bn = assetOut.getChainBalance()
      // let assetOut = getAssetBySymbol(destAssetSymbol)
      // let assetOutDecimals = assetOut.getDecimals()
      // let outputAmount = new FixedPointNumber(assetOutAmount,assetOutDecimals)

      let priceDeviation = outputAmount.times(new bn(priceDeviationPercent)).div(new bn(100)).integerValue(bn.ROUND_DOWN)
      let expectedOutMinusDeviation = outputAmount.minus(priceDeviation)

      let tokenPathSymbols = [startAssetSymbol]
      swapInstructions.forEach((instruction) => {
        tokenPathSymbols.push(instruction.assetNodes[1].getAssetSymbol())
      })
      
      let tokenPathIds = tokenPathSymbols.map((symbol) => {
        let asset = getAssetBySymbol(symbol)
        return Number.parseInt(asset.tokenData.localId)
      })
      let swapTx = await api.tx.ammRoute.swapExactTokensForTokens(tokenPathIds, inputAmount.toString(), expectedOutMinusDeviation.toString())

      let swapTxContainer: SwapExtrinsicContainer = {
        relay: 'kusama',
        chainId: 2085,
        chain: "ParallelHeiko",
        type: "Swap",
        assetNodes: assetNodes,
        pathAmount: assetInAmount,
        pathType: swapType,
        extrinsic: swapTx,
        assetIn: assetIn,
        assetOut: assetOut,
        assetAmountIn: inputAmount,
        expectedAmountOut: expectedOutMinusDeviation,
        api: api,

      }
      return swapTxContainer
}

const main = async () => {
  // const api = await ApiPromise.create(options({
  //   provider: new WsProvider(wsLocalChain)
  // }))
  const chopsticks = true
  const api = await getApiForNode('ParallelHeiko', chopsticks) 

  const lpEntries = await api.query.amm.pools.entries();
  lpEntries.forEach(([assetData, lpData]) => {
    console.log(`AssetData: ${assetData.toHuman()}, lpData: ${lpData.toHuman()}`)
  })


//   console.log(JSON.stringify(lpEntries, null, 2))
// let assets: MyAsset[] = JSON.parse(fs.readFileSync('../assets/hko/asset_registry.json', 'utf8')).map((asset: any) => {
//     return asset.tokenData
// })

  const keyring = new Keyring({ type: "sr25519" });
  const signer = keyring.addFromUri("//Alice")

  // HKO -> KSM
  const tokenPath = ["0", "100"]

  let ksmAsset = getAssetById(100)
  let ksmDecimals = ksmAsset.tokenData.decimals
  let ksmOutput = new FixedPointNumber(1, Number.parseInt(ksmDecimals)).toChainData()

  let hkoAsset = getAssetById(0)
let hkoDecimals = hkoAsset.tokenData.decimals
  let maxHkoInput = new FixedPointNumber(4000, Number.parseInt(hkoDecimals)).toChainData()

  // Token route, output amount, max input amount
  let swapTx = await api.tx.ammRoute.swapTokensForExactTokens(tokenPath,ksmOutput, maxHkoInput).signAndSend(signer)
  console.log(`Swap tx: ${JSON.stringify(swapTx, null, 2)}`)
//   await api.tx.system.remark("hello").signAndSend(signer);
  
//   const [route, amount] = await api.rpc.router.getBestRoute("10000000", 100, 1, true);
api.disconnect();
}

function getAssetBySymbol(symbol: string){
    let allAssets: IMyAsset[] = getAssetMapAssets('kusama')
    // console.log(JSON.stringify(allAssets, null, 2))
    let matchedAsset = allAssets.find((asset: any) => {
        return asset.tokenData.chain == 2085 && asset.tokenData.symbol == symbol
    })
    if(!matchedAsset){
        throw new Error("Can't find asset with symbol: " + symbol)
    }
    return matchedAsset
}

function getAssetById(id: number){
  let allAssets: IMyAsset[] = getAssetMapAssets('kusama')
    // console.log(JSON.stringify(allAssets, null, 2))
    let matchedAsset = allAssets.find((asset: any) => {
        return asset.tokenData.chain == 2085 && asset.tokenData.localId == id
    })
    if(!matchedAsset){
        throw new Error("Can't find asset with id: " + id)
    }
    return matchedAsset
}

// const getSigner = async () => {
//     await cryptoWaitReady()
//     const keyring = new Keyring({
//       type: "sr25519",
//     });
  
//     // Add Alice to our keyring with a hard-deived path (empty phrase, so uses dev)
//     return keyring.addFromUri("//Alice");
//   };

// main()
// getHkoSwapExtrinsic("KSM", "USDT", 1, 1, [])