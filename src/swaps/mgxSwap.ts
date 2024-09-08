import { FixedPointNumber } from "@acala-network/sdk-core";
import { Mangata, MangataInstance } from "@mangata-finance/sdk";
import { BN } from '@polkadot/util';
import BigNumber from 'bignumber.js'
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

  const assetIn = assetNodes[0]
  const assetOut = assetNodes[assetNodes.length - 1]
  

  // await apiStandard.isReady;
  let signer = await getSigner(chopsticks, swapInstructions[0].assetNodes[0].chain)

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
      tokenPathSymbols.push(instruction.assetNodes[1].getAssetSymbol())
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

    // let inputFixedPoint = new FixedPointNumber(amountIn, startTokenDecimals).toChainData()
    // let expectedOutFixedPoint = new FixedPointNumber(expectedAmountOut, endTokenDecimals)
    let inputAmount = assetIn.getChainBalance()
    let outputAmount = assetOut.getChainBalance()
    let priceDeviation = outputAmount.times(new BigNumber(priceDeviationPercent)).div(new BigNumber(100)).integerValue(BigNumber.ROUND_DOWN)
    let expectedOutMinusDeviation = outputAmount.minus(priceDeviation)

    // let inputBn = new bn(inputFixedPoint)
    let expectedOutBn = new BigNumber(expectedOutMinusDeviation.toString())
    // console.log(`inputAmount: ${inputBn} expectedOutAmount: ${expectedOutBn}`)
    let tokenPathIds = tokenPath.map((token) => token!.id)

    const args = {
      account: signer,
      tokenIds: tokenPathIds,
      amount: new BN(inputAmount.toString()),
      minAmountOut: new BN(expectedOutBn.toString()),
    }
  let mgxTx = await mangata.submitableExtrinsic.multiswapSellAsset(args)

  let mgxTxContainer: SwapExtrinsicContainer = {
    relay: 'kusama',
    chainId: 2110,
    chain: "Mangata",
    type: "Swap",
    assetNodes: assetNodes,
    extrinsic: mgxTx,
    assetIn: assetIn,
    assetOut: assetOut,
    assetAmountIn: inputAmount,
    expectedAmountOut: expectedOutBn,
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