import { FixedPointNumber } from "@acala-network/sdk-core";
import { Mangata, MangataInstance } from "@mangata-finance/sdk";
import { BN } from '@polkadot/util';
import { IndexObject, PathType, SwapExtrinsicContainer, SwapInstruction } from '../types/types.ts';
import { getSigner } from '../utils/index.ts';
const wsLocalChain = "ws://172.26.130.75:8011"
const mgxRpc = "wss://kusama-rpc.mangata.online"


export async function getMgxSwapExtrinsic(
  swapType: PathType,
  assetInSymbol: string,
  assetOutSymbol: string, 
  amountIn: string, 
  expectedAmountOut: string, 
  swapInstructions: SwapInstruction[], 
  chopsticks: boolean = false,
  extrinsicIndex: IndexObject, 
  instructionIndex: number[],
  priceDeviationPercent: number = 2
  ) {
  // Connect to the mainet (also testnet, mainnet)
  console.log("Getting mgx swap extrinsic")
  console.log(`assetInSymbol: ${assetInSymbol} assetOutSymbol: ${assetOutSymbol} amountIn: ${amountIn} assetOutAmount: ${expectedAmountOut}`)
  let rpc = chopsticks ? wsLocalChain : mgxRpc
  const mangata: MangataInstance = Mangata.instance([rpc]);
  let assetNodes = [swapInstructions[0].assetNodes[0]]
    swapInstructions.forEach((instruction) => {
      assetNodes.push(instruction.assetNodes[1])
    })
  // await apiStandard.isReady;
  let signer = await getSigner(chopsticks, false)

  // apiStandard.tx.xyk.
  // mangata.xyk.
  // Retrieve the chainName, nodeName & nodeVersion information
  const [chain, nodeName, nodeVersion] = await Promise.all([
    mangata.rpc.getChain(),
    mangata.rpc.getNodeName(),
    mangata.rpc.getNodeVersion()
  ]);

  console.log(
    `You are connected to chain ${chain} using ${nodeName} v${nodeVersion}`
  );
    let assets = await mangata.query.getAssetsInfo()
    let tokenPathSymbols = [assetInSymbol]
    swapInstructions.forEach((instruction) => {
      tokenPathSymbols.push(instruction.assetNodes[1].getAssetRegistrySymbol())
    })
    let tokenPath = tokenPathSymbols.map((symbol) => {
      for(let asset of Object.keys(assets)){
        if(assets[asset].symbol === symbol){
          return assets[asset]
        }
      }
    })
    let startTokenDecimals = tokenPath[0]!.decimals
    let endTokenDecimals = tokenPath[tokenPath.length - 1]!.decimals

    let inputFixedPoint = new FixedPointNumber(amountIn, startTokenDecimals).toChainData()
    let expectedOutFixedPoint = new FixedPointNumber(expectedAmountOut, endTokenDecimals)

    let priceDeviation = expectedOutFixedPoint.mul(new FixedPointNumber(priceDeviationPercent)).div(new FixedPointNumber(100))
    let expectedOutMinusDeviation = expectedOutFixedPoint.sub(priceDeviation)

    let inputBn = new BN(inputFixedPoint)
    let expectedOutBn = new BN(expectedOutMinusDeviation.toChainData())
    console.log(`inputAmount: ${inputBn} expectedOutAmount: ${expectedOutBn}`)
    let tokenPathIds = tokenPath.map((token) => token!.id)

    const args = {
      account: signer,
      tokenIds: tokenPathIds,
      amount: inputBn,
      minAmountOut: expectedOutBn,
    }
  let mgxTx = await mangata.submitableExtrinsic.multiswapSellAsset(args)

  let mgxTxContainer: SwapExtrinsicContainer = {
    relay: 'kusama',
    chainId: 2110,
    chain: "Mangata",
    assetNodes: assetNodes,
    extrinsic: mgxTx,
    extrinsicIndex: extrinsicIndex.i,
    instructionIndex: instructionIndex,
    assetSymbolIn: assetInSymbol,
    assetSymbolOut: assetOutSymbol,
    assetAmountIn: new FixedPointNumber(amountIn, startTokenDecimals),
    expectedAmountOut: expectedOutFixedPoint,
    pathType: swapType,
    pathAmount: amountIn,
    api: await mangata.api()
  }
  return mgxTxContainer
}
async function run(){
    // main("KSM", "MGX", 1000000000000)
  // getMgxSwapExtrinsic("KSM", "MGX", 1000000000000, 160000000000, [])

}

// run()

// const getSigner = async () => {
//     await cryptoWaitReady()
//     const keyring = new Keyring({
//       type: "sr25519",
//     });
  
//     // Add Alice to our keyring with a hard-deived path (empty phrase, so uses dev)
//     return keyring.addFromUri("//Alice");
//   };