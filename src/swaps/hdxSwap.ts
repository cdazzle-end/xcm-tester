import { FixedPointNumber } from "@acala-network/sdk-core";
import { ApiPromise } from "@polkadot/api";
import bn from 'bignumber.js'

import "@galacticcouncil/api-augment/basilisk";
import "@galacticcouncil/api-augment/hydradx";

import { SubmittableExtrinsic } from "@polkadot/api/promise/types";
import {
    Asset as HdxAsset,
    BigNumber,
    PoolService,
    TradeRouter,
    ZERO
} from "hydra-sdk";
import { localRpcs } from "../config/txConsts.ts";
import { getApiForNode, getBalanceFromDisplay, getSigner } from "./../utils/index.ts";
import {
    IndexObject,
    PathData,
    PathType,
    SwapExtrinsicContainer,
    SwapInstruction,
} from "./../types/types.ts";

const niceEndpoint = "wss://hydradx-rpc.dwellir.com";
const wsLocalChain = localRpcs["HydraDX"];

export async function getHdxSwapExtrinsicDynamic(
    swapType: PathType,
    startAssetSymbol: string,
    destAssetSymbol: string,
    assetInAmount: string,
    assetOutAmount: string,
    swapInstructions: SwapInstruction[],
    chopsticks: boolean = true,
    priceDeviationPercent: number = 2
): Promise<[SwapExtrinsicContainer, SwapInstruction[]]> {
    console.log(
        `HDX (${startAssetSymbol}) -> (${destAssetSymbol}) assetInAmount: ${assetInAmount} assetOutAmount: ${assetOutAmount}`
    );

    const api = await getApiForNode("HydraDX", chopsticks);
    await api.isReady;
    const poolService = new PoolService(api);
    const router = new TradeRouter(poolService);

    let signer = await getSigner(chopsticks, swapInstructions[0].assetNodes[0].chain);

    let startAssetId = swapInstructions[0].assetInLocalId;

    // Suppress unexpected console.log output from the SDK. This is a temporary workaround, because i cant turn it back on for the sdk, but normal console.log messages will resturn
    const originalConsoleLog = console.log;
    console.log = () => {};
    let allAssets: HdxAsset[] = await router.getAllAssets(); // This prints sdk logs
    console.log = originalConsoleLog;

    let assetPathIds = [startAssetId];

    // CHANGING to ID's
    swapInstructions.forEach((instruction) => {
        assetPathIds.push(instruction.assetNodes[1].getLocalId());
    });

    // let pathsAndInstructions = splitPathAndInstructions(assetPathSymbols, swapInstructions)
    let pathsAndInstructions = splitPathAndInstructions(
        assetPathIds,
        swapInstructions
    );
    let assetPathToExecute = pathsAndInstructions.assetPath;
    let instructionsToExecute = pathsAndInstructions.instructionsToExecute;
    let remainingInstructions = pathsAndInstructions.remainingInstructions;
    let assetNodes = [swapInstructions[0].assetNodes[0]];
    instructionsToExecute.forEach((instruction) => {
        assetNodes.push(instruction.assetNodes[1]);
    });

    const assetIn = assetNodes[0]
    const assetOut = assetNodes[assetNodes.length - 1] 

    let expectedOutDynamic = assetOut.pathValue;

    let path: HdxAsset[] = assetPathToExecute.map((assetId) => {
        const assetInPath = allAssets.find((asset) => asset.id == assetId);
        // console.log(`Asset ${assetInPath.symbol} ${assetInPath.id} ->`)
        return assetInPath!;
    });
    const hdxAssetIn: HdxAsset = path[0];
    const hdxAssetOut: HdxAsset = path[path.length - 1];

    let number = new BigNumber(ZERO);
    // let fnInputAmount = new FixedPointNumber(
    //     assetInAmount.toString(),
    //     hdxAssetIn.decimals
    // );
    // let fnOutputAmount = new FixedPointNumber(
    //     expectedOutDynamic.toString(),
    //     hdxAssetOut.decimals
    // );
    let inputAmount: bn = getBalanceFromDisplay(assetInAmount, hdxAssetIn.decimals)
    let outputAmount: bn = getBalanceFromDisplay(expectedOutDynamic, hdxAssetOut.decimals)

    //2% acceptable price deviation 2 / 100
    let priceDeviation = outputAmount
        .times(new bn(priceDeviationPercent))
        .div(new bn(100))
        .integerValue(bn.ROUND_DOWN);
    let expectedOutMinusDeviation: bn = outputAmount.minus(priceDeviation);

    let bestBuy = await router.getBestSell(
        hdxAssetIn.id,
        hdxAssetOut.id,
        assetInAmount.toString()
    );
    console.log(`Best buy for in: ${hdxAssetIn.id} -> out: ${hdxAssetOut.id} (${assetInAmount.toString()})`)
    console.log(`${JSON.stringify(bestBuy, null, 2)}`)
    // console.log("Created best buy")
    let swapZero = bestBuy.toTx(number);
    console.log(`Swap Zero of best buy. bestBuy.toTx(number): ${JSON.stringify(swapZero)}`)

    let tx: SubmittableExtrinsic = swapZero.get();
    console.log(`SubmittableExtrinsic (swapZero.get()):  ${JSON.stringify(tx.toHuman(), null,2 )}`)

    let route = tx.toHuman()!["method"]["args"]["route"];
    console.log(`Route from submittable extrinsic: ${JSON.stringify(route, null, 2)}`)

    if(route !== undefined){
        route = removeCommasFromRoute(route)
    }
    console.log(`Removed commas from route: ${JSON.stringify(route, null)}`)

    console.log(`Asset in id: ${hdxAssetIn.id} | Asset out id: ${hdxAssetOut.id} | Aset amount in: ${inputAmount.toString} | expected out: ${expectedOutMinusDeviation.toString()}`);
    // console.log(` FN INput amount: ${fnInputAmount.toChainData()}`)
    let txFormatted
    try {
        txFormatted = await api.tx.router.sell(
            hdxAssetIn.id,
            hdxAssetOut.id,
            inputAmount.toString(),
            expectedOutMinusDeviation.toString(),
            route
        );
    } catch (e) {
        throw new Error(
            `Failed to construct Hydra swap. AssetIn ${JSON.stringify(
                hdxAssetIn
            )} | AssetOut: ${JSON.stringify(
                hdxAssetOut
            )} | Input amount: ${inputAmount.toString()} | Expected amount out: ${expectedOutMinusDeviation.toString()} | Route: ${JSON.stringify(
                route
            )} | Error: ${JSON.stringify(e, null, 2)}`
        );
    }

    let pathAmount = inputAmount.toString();
    let pathSwapType = swapType;
    let swapTxContainer: SwapExtrinsicContainer = {
        relay: "polkadot",
        chainId: 2034,
        chain: "HydraDX",
        type: "Swap",
        assetNodes: assetNodes,
        extrinsic: txFormatted,
        assetIn: assetIn,
        assetOut: assetOut,
        assetAmountIn: inputAmount,
        expectedAmountOut: outputAmount,
        pathType: pathSwapType,
        pathAmount: pathAmount,
        api: api,
    };
    return [swapTxContainer, remainingInstructions];
}

function removeCommasRecursively(value: any): any {
    if (typeof value === 'string') {
      return value.replace(/,/g, '');
    } else if (Array.isArray(value)) {
      return value.map(removeCommasRecursively);
    } else if (typeof value === 'object' && value !== null) {
      const newObj: { [key: string]: any } = {};
      for (const [key, val] of Object.entries(value)) {
        newObj[key] = removeCommasRecursively(val);
      }
      return newObj;
    }
    return value;
  }
  
  function removeCommasFromRoute(route: any[]): any[] {
    return removeCommasRecursively(route);
  }
//   function removeCommasFromRoute(route: Array<{ [key: string]: string }>): Array<{ [key: string]: string }> {
//     return route.map(item => {
//         const cleanedItem: { [key: string]: string } = {};
//         for (const key in item) {
//             if (item.hasOwnProperty(key)) {
//                 cleanedItem[key] = item[key].replace(/,/g, '');
//             }
//         }
//         return cleanedItem;
//     });
// }

function splitAssetPaths(assetPathSymbols: string[]) {
    let assetPaths: [string[]] = [[]];
    let assetCounter = {};
    let previousIndex;
    let remainingInstructions: SwapInstruction[] = [];
    assetPathSymbols.forEach((symbol, index) => {
        if (!assetCounter[symbol]) {
            assetCounter[symbol] = 1;
        } else {
            assetCounter[symbol] += 1;
        }
        if (assetCounter[symbol] > 1) {
            let newPath = assetPathSymbols.slice(0, index);
            assetPaths.push(newPath);
            assetCounter = {};
            previousIndex = index - 1;
        } else if (index == assetPathSymbols.length - 1) {
            let finalPath = assetPathSymbols.slice(previousIndex);
            assetPaths.push(finalPath);
        }
    });
    return assetPaths;
}
interface BsxPathAndInstructions {
    assetPath: string[];
    instructionsToExecute: SwapInstruction[];
    remainingInstructions: SwapInstruction[];
}

function splitPathAndInstructions(
    assetPathSymbols: string[],
    swapInstructions: SwapInstruction[]
): BsxPathAndInstructions {
    // let assetPaths = []
    let assetCounter = {};
    let previousIndex;
    // let remainingInstructions: SwapInstruction[] = []
    assetPathSymbols.forEach((symbol, index) => {
        if (!assetCounter[symbol]) {
            assetCounter[symbol] = 1;
        } else {
            assetCounter[symbol] += 1;
        }
        if (assetCounter[symbol] > 1) {
            let newPath = assetPathSymbols.slice(0, index);
            let instructionsToExecute: SwapInstruction[] =
                swapInstructions.slice(0, index);
            let remainingInstructions: SwapInstruction[] =
                swapInstructions.slice(index);
            let pathAndInstructions: BsxPathAndInstructions = {
                assetPath: newPath,
                instructionsToExecute: instructionsToExecute,
                remainingInstructions: remainingInstructions,
            };

            return pathAndInstructions;
        }
    });
    // return assetPaths
    let pathsAndInstructions: BsxPathAndInstructions = {
        assetPath: assetPathSymbols,
        instructionsToExecute: swapInstructions,
        remainingInstructions: [],
    };
    return pathsAndInstructions;
}

class GetAllAssetsExample {
    async script(api: ApiPromise): Promise<any> {
        const poolService = new PoolService(api);
        const router = new TradeRouter(poolService);
        return router.getAllAssets();
    }
}

//   new GetAllAssetsExample(ApiUrl.Nice, 'Get all assets').run()

async function run() {
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
