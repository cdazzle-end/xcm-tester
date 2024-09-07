import { FixedPointNumber } from "@acala-network/sdk-core"
import { ApiPromise, Keyring, options, WsProvider } from "@parallel-finance/api"
import path from 'path'
import { fileURLToPath } from 'url'
import { localRpcs } from "../config/index.ts"
import { getApiForNode, getAssetMapAssets, getAssetRegistry, getSigner } from './../utils/index.ts'
import { IndexObject, PathType, Relay, SwapExtrinsicContainer, SwapInstruction } from "./../types/types.ts"
import bn from 'bignumber.js'
const wsLocalChain = localRpcs["Parallel"]
const paraWs = "wss://parallel-rpc.dwellir.com"
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const relay: Relay = 'polkadot'

export async function getParaSwapExtrinsic(
  swapType: PathType,
  startAssetSymbol: string, 
  destAssetSymbol: string, 
  assetInAmount: string, 
  assetOutAmount: string, 
  swapInstructions: SwapInstruction[], 
  chopsticks: boolean = true,
  priceDeviationPercent: number = 2
  ) {

  const api = await getApiForNode("Parallel", chopsticks)
  console.log("Connected to api")
  let assetNodes = [swapInstructions[0].assetNodes[0]]
    swapInstructions.forEach((instruction) => {
      assetNodes.push(instruction.assetNodes[1])
    })

  const assetIn = assetNodes[0]
  const assetOut = assetNodes[assetNodes.length - 1]

      let signer = await getSigner(chopsticks, false)
      console.log("Signer: ", signer.address)

      console.log("Swap instructions: ", swapInstructions.length)
      // let assetIn = getAssetBySymbol(relay, startAssetSymbol)
      console.log("Asset in: ", assetIn)
      let assetInLocalId = assetIn.getLocalId()
      let assetInDecimals = assetIn.getDecimals()
      // let assetInAmountFn = new FixedPointNumber(assetInAmount, assetInDecimals)
      console.log(`Input: ${assetIn.pathValue}`)
      console.log(`Output: ${assetOut.pathValue}`)
      let inputAmount = assetIn.getChainBalance()
      let outputAmount = assetOut.getChainBalance()

      console.log(`Input formatted: ${inputAmount.toString()}`)
      console.log(`Output formatted: ${outputAmount.toString()}`)

      // let assetOut = getAssetBySymbol(relay, destAssetSymbol)
      let assetOutLocalId = assetOut.getLocalId()
      let assetOutDecimals = assetOut.getDecimals()
      // let outputAmount = new FixedPointNumber(assetOutAmount,assetOutDecimals)

      console.log(`Asset in ${assetInLocalId} -- AssetOut ${assetOutLocalId}`)

      let priceDeviation = outputAmount.times(new bn(priceDeviationPercent)).div(new bn(100)).integerValue(bn.ROUND_DOWN)
      let expectedOutMinusDeviation = outputAmount.minus(priceDeviation)

      let tokenPathSymbols = [startAssetSymbol]
      swapInstructions.forEach((instruction) => {
        tokenPathSymbols.push(instruction.assetNodes[1].getAssetSymbol())
      })
      
      let tokenPathIds = tokenPathSymbols.map((symbol) => {
        let asset = getAssetBySymbol(relay, symbol)
        return Number.parseInt(asset.tokenData.localId)
      })
      console.log("Create swap tx:")
      console.log(`Para swap params: ${JSON.stringify(tokenPathIds)} | ${JSON.stringify(inputAmount.toString())} | ${JSON.stringify(expectedOutMinusDeviation.toString())}`)
      let swapTx = await api.tx.ammRoute.swapExactTokensForTokens(tokenPathIds, inputAmount.toString(), expectedOutMinusDeviation.toString())

      console.log("Swap tx: ", JSON.stringify(swapTx, null, 2))

      let swapTxContainer: SwapExtrinsicContainer = {
        relay: 'polkadot',
        chainId: 2012,
        chain: "Parallel",
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
        // reverseTx: reverseTxParams

      }
      return swapTxContainer
}

const main = async () => {
  const api = await ApiPromise.create(options({
    provider: new WsProvider(wsLocalChain)
  }))

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


}

function getAssetBySymbol(relay: Relay, symbol: string){
    let allAssets = getAssetMapAssets(relay)
    // console.log(JSON.stringify(allAssets, null, 2))
    let matchedAsset = allAssets.find((asset: any) => {
        return asset.tokenData.network == 'polkadot' && asset.tokenData.chain == 2012 && asset.tokenData.symbol == symbol
    })
    if(!matchedAsset){
        throw new Error("Can't find asset with symbol: " + symbol)
    }
    return matchedAsset
}

function getAssetById(relay: Relay, id: number){
    let allAssets = getAssetMapAssets(relay)
    // console.log(JSON.stringify(allAssets, null, 2))
    let matchedAsset = allAssets.find((asset: any) => {
        return asset.tokenData.network == 'polkadot' && asset.tokenData.chain == 2012 && asset.tokenData.localId == id
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