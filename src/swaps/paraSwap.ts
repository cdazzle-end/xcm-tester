import { FixedPointNumber } from "@acala-network/sdk-core"
import { ApiPromise, Keyring, options, WsProvider } from "@parallel-finance/api"
import path from 'path'
import { fileURLToPath } from 'url'
import { localRpcs } from "../config/index.ts"
import { getApiForNode, getAssetRegistry, getSigner } from './../utils/index.ts'
import { IndexObject, PathType, Relay, SwapExtrinsicContainer } from "./../types/types.ts"
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
  swapInstructions: any[], 
  chopsticks: boolean = true,
  extrinsicIndex: IndexObject, 
  instructionIndex: number[],
  priceDeviationPercent: number = 2
  ) {
  // let rpc = chopsticks ? wsLocalChain : paraWs  
  // console.log("RPC: ", rpc)
  // const api = await ApiPromise.create(options({
  //       provider: new WsProvider(rpc)
  //     }))

  const api = await getApiForNode("Parallel", chopsticks)
  console.log("Connected to api")
  let assetNodes = [swapInstructions[0].assetNodes[0]]
    swapInstructions.forEach((instruction) => {
      assetNodes.push(instruction.assetNodes[1])
    })

      let signer = await getSigner(chopsticks, false)
      console.log("Signer: ", signer.address)

      console.log("Swap instructions: ", swapInstructions.length)
      let assetIn = getAssetBySymbol(relay, startAssetSymbol)
      console.log("Asset in: ", assetIn)
      let assetInLocalId = assetIn.tokenData.localId
      let assetInDecimals = assetIn.tokenData.decimals
      let assetInAmountFn = new FixedPointNumber(assetInAmount, Number.parseInt(assetInDecimals))

      let assetOut = getAssetBySymbol(relay, destAssetSymbol)
      let assetOutLocalId = assetOut.tokenData.localId
      let assetOutDecimals = assetOut.tokenData.decimals
      let assetOutAmountFn = new FixedPointNumber(assetOutAmount, Number.parseInt(assetOutDecimals))

      console.log(`Asset in ${assetIn} -- AssetOut ${assetOutLocalId}`)

      let priceDeviation = assetOutAmountFn.mul(new FixedPointNumber(priceDeviationPercent)).div(new FixedPointNumber(100))
      let expectedOutMinusDeviation = assetOutAmountFn.sub(priceDeviation)

      let tokenPathSymbols = [startAssetSymbol]
      swapInstructions.forEach((instruction) => {
        tokenPathSymbols.push(instruction.assetNodes[1].getAssetRegistrySymbol())
      })
      
      let tokenPathIds = tokenPathSymbols.map((symbol) => {
        let asset = getAssetBySymbol(relay, symbol)
        return Number.parseInt(asset.tokenData.localId)
      })
      console.log("Create swap tx:")
      let swapTx = await api.tx.ammRoute.swapExactTokensForTokens(tokenPathIds,assetInAmountFn.toChainData(), expectedOutMinusDeviation.toChainData())

      console.log("Swap tx: ", JSON.stringify(swapTx, null, 2))

      let swapTxContainer: SwapExtrinsicContainer = {
        relay: 'polkadot',
        chainId: 2012,
        chain: "Parallel",
        assetNodes: assetNodes,
        pathAmount: assetInAmount,
        pathType: swapType,
        extrinsic: swapTx,
        extrinsicIndex: extrinsicIndex.i,
        instructionIndex: instructionIndex,
        assetSymbolIn: startAssetSymbol,
        assetSymbolOut: destAssetSymbol,
        assetAmountIn: assetInAmountFn,
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
    let allAssets = getAssetRegistry(relay)
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
    let allAssets = getAssetRegistry(relay)
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