import { FixedPointNumber } from "@acala-network/sdk-core"
import { ApiPromise, options, WsProvider, Keyring } from "@parallel-finance/api" 
import { cryptoWaitReady } from "@polkadot/util-crypto"
import fs from 'fs'
import { IndexObject, PathNodeValues, PathType, SwapExtrinsicContainer } from "./../instructions/types"
const wsLocalChain = "ws://172.26.130.75:8012"
const hkoWs = "wss://heiko-rpc.parallel.fi"
import path from 'path'
import { fileURLToPath } from 'url';
import { increaseIndex, getSigner } from './../instructions/utils.ts'
import { getApiForNode } from './../instructions/apiUtils.ts'
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function getHkoSwapExtrinsic(
  swapType: PathType,
  startAssetSymbol: string, 
  destAssetSymbol: string, 
  assetInAmount: string, 
  assetOutAmount: string, 
  swapInstructions: any[], 
  chopsticks: boolean = true, 
  txIndex: number, 
  extrinsicIndex: IndexObject, 
  instructionIndex: number[],
  priceDeviationPercent: number = 2
  ) {
  let rpc = chopsticks ? wsLocalChain : hkoWs  
  const api = await ApiPromise.create(options({
        provider: new WsProvider(rpc)
      }))

      let assetNodes = [swapInstructions[0].assetNodes[0]]
    swapInstructions.forEach((instruction) => {
      assetNodes.push(instruction.assetNodes[1])
    })

      let signer = await getSigner(chopsticks, false)

      let accountNonce = await api.query.system.account(signer.address)
      let nonce = accountNonce.nonce.toNumber()
      nonce += txIndex

      let assetIn = getAssetBySymbol(startAssetSymbol)
      let assetInLocalId = assetIn.tokenData.localId
      let assetInDecimals = assetIn.tokenData.decimals
      let assetInAmountFn = new FixedPointNumber(assetInAmount, Number.parseInt(assetInDecimals))

      let assetOut = getAssetBySymbol(destAssetSymbol)
      let assetOutLocalId = assetOut.tokenData.localId
      let assetOutDecimals = assetOut.tokenData.decimals
      let assetOutAmountFn = new FixedPointNumber(assetOutAmount, Number.parseInt(assetOutDecimals))

      let priceDeviation = assetOutAmountFn.mul(new FixedPointNumber(priceDeviationPercent)).div(new FixedPointNumber(100))
      let expectedOutMinusDeviation = assetOutAmountFn.sub(priceDeviation)

      let tokenPathSymbols = [startAssetSymbol]
      swapInstructions.forEach((instruction) => {
        tokenPathSymbols.push(instruction.assetNodes[1].getAssetRegistrySymbol())
      })
      
      let tokenPathIds = tokenPathSymbols.map((symbol) => {
        let asset = getAssetBySymbol(symbol)
        return Number.parseInt(asset.tokenData.localId)
      })
      // const route = [119, 0, 100]
      // const amount = 840868780473
      let swapTx = await api.tx.ammRoute.swapExactTokensForTokens(tokenPathIds,assetInAmountFn.toChainData(), expectedOutMinusDeviation.toChainData())

      let reverseTokenPathIds = tokenPathSymbols.reverse().map((symbol) => {
        let asset = getAssetBySymbol(symbol)
        return Number.parseInt(asset.tokenData.localId)
      })
      let reverseSupply = expectedOutMinusDeviation
      let reversePriceDev = assetInAmountFn.mul(new FixedPointNumber(5)).div(new FixedPointNumber(100))
      let reverseTarget = assetInAmountFn.sub(reversePriceDev)

      let swapTxContainer: SwapExtrinsicContainer = {
        relay: 'kusama',
        chainId: 2085,
        chain: "ParallelHeiko",
        assetNodes: assetNodes,
        pathAmount: assetInAmount,
        pathType: swapType,
        extrinsic: swapTx,
        extrinsicIndex: extrinsicIndex.i,
        instructionIndex: instructionIndex,
        nonce: nonce,
        assetSymbolIn: startAssetSymbol,
        assetSymbolOut: destAssetSymbol,
        assetAmountIn: assetInAmountFn,
        expectedAmountOut: expectedOutMinusDeviation,
        api: api,

      }
      // return [swapTx, nonce]
      increaseIndex(extrinsicIndex)
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

//   let allAssets = JSON.parse(fs.readFileSync('../../allAssets.json', 'utf8'))
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
    let allAssets = JSON.parse(fs.readFileSync(path.join(__dirname,'../../allAssets.json'), 'utf8'))
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
    let allAssets = JSON.parse(fs.readFileSync('../../allAssets.json', 'utf8'))
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