import { ISubmittableResult } from '@polkadot/types/types'
import bn from 'bignumber.js'
import fs from 'fs'
import path from 'path'
import { FixedPointNumber } from "@acala-network/sdk-core"
import { Wallet } from "@acala-network/sdk/wallet/wallet.js"
import { SubmittableExtrinsic } from '@polkadot/api/submittable/types'
import { IndexObject, PathType, SwapExtrinsicContainer, SwapInstruction } from './../types/types.ts'
import { AssetNode } from '../core/AssetNode.ts'
import { getApiForNode, getSigner, getAssetRegistry, increaseIndex } from '../utils/index.ts'
// import {  } from '../utils/utils.ts'
// import {  } from './../utils/apiUtils.ts'
import { localRpcs } from '../config/txConsts.ts'

import { fileURLToPath } from 'url'
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const wsLocalChain = localRpcs["Acala"]
// const wsLocalDestination = "ws://172.26.130.75:8008" 
const acaRpc = "ws://acala-rpc-0.aca-api.network"


export async function getAcaSwapExtrinsicDynamic(    
    swapType: PathType, 
    startAssetSymbol: string, 
    amountIn: string,  
    swapInstructions: SwapInstruction[], 
    chopsticks: boolean = true,
    priceDeviationPercent: number = 2
): Promise<[SwapExtrinsicContainer, SwapInstruction[]]>{

    const api = await getApiForNode("Acala", chopsticks)
    await api.isReady;

    console.log("Acala api is ready")
    
    const signer = await getSigner(chopsticks, false);

    const wallet = new Wallet(api)
    await wallet.isReady
    let [swapInstructionsToExecute, remainingInstructions] = truncateSwapInstructions(startAssetSymbol, swapInstructions)
    const assetIn = swapInstructionsToExecute[0].assetNodes[0]
    const assetOut = swapInstructionsToExecute[swapInstructionsToExecute.length - 1].assetNodes[1]
    // let startAssetSymbol = assetIn.getAssetSymbol()
    let destAssetSymbol = assetOut.getAssetSymbol()

    const startToken = wallet.getToken(startAssetSymbol);
    const destToken = wallet.getToken(destAssetSymbol);

    let tokenPathSymbols: string[] = [startAssetSymbol];
    let extrinsicNodes: AssetNode[] = [swapInstructionsToExecute[0].assetNodes[0]]
    swapInstructionsToExecute.forEach((swapInstruction) => {
        tokenPathSymbols.push(swapInstruction.assetNodes[1].getAssetSymbol())
        extrinsicNodes.push(swapInstruction.assetNodes[1])
    })

    let tokenPath = tokenPathSymbols.map((token)=> {
        return wallet.getToken(token).toChainData()
    })

    let amountInDynamic = swapInstructionsToExecute[0].assetNodes[0].pathValue;
    let expectedAmountOutDynamic = swapInstructionsToExecute[swapInstructionsToExecute.length - 1].assetNodes[1].pathValue;
    const supplyAmount = new FixedPointNumber(amountInDynamic, startToken.decimals);
    const expectedOutAmountFixed = new FixedPointNumber(expectedAmountOutDynamic, destToken.decimals);

    const priceDeviation = expectedOutAmountFixed.mul(new FixedPointNumber(priceDeviationPercent)).div(new FixedPointNumber(100));
    let expectedAmountOutWithDeviation = expectedOutAmountFixed.sub(priceDeviation);
    let swapTx: SubmittableExtrinsic<"promise", ISubmittableResult> | SubmittableExtrinsic<"rxjs", ISubmittableResult>;

    console.log(`*** Acala swap PathType: ${swapType}`)

    if(swapType == PathType.DexV2){
        // Dex swap
        swapTx = await api.tx.dex
            .swapWithExactSupply(
                tokenPath,
                supplyAmount.toChainData(),
                expectedAmountOutWithDeviation.toChainData()
            )
    } else {
        // For DOT/LDOT stable pair, need to convert shares to balance
        // In order to not calculate the swap again, we can calculate the share percent after the fact
        // If DOT -> LDOT: Take output balance. Get the output as a percent of the total pool balance. output amount / total pool balance.
        // This will be the percent of total share in the pool.
        // If LDOT -> DOT: Need to convert the input. The input param is for shares. Our instruction input is in actual balance. 
        // **********
        // UPDATE to stable pool
        // Extrinsic input needs to be in shares
        // arb finder returns amount in balance
        // need to convert to shares, add fee amount

        // Since there is only one stable pool, dont need to worry about multiple swaps.
        // So just get the swap instruction pool id
        bn.set({ DECIMAL_PLACES: 40});
        let poolId = swapInstructions[0].pathData.lpId
        let assetRegistry = getAssetRegistry('polkadot');

        console.log("Pool ID: " + poolId)
        console.log("Swap instruction path data: - " + JSON.stringify(swapInstructions[0].pathData, null, 2))
        let targetStablePool = getAcalaStablePoolData(Number.parseInt(poolId))
        
        let stablePoolAssets = targetStablePool.poolAssets
        const assetLength = stablePoolAssets.length

        let token0Data = assetRegistry.find((asset) => {
            return JSON.stringify(asset.tokenData.localId) == JSON.stringify(stablePoolAssets[0])
        })
        let token1Data = assetRegistry.find((asset) => {
            return JSON.stringify(asset.tokenData.localId) == JSON.stringify(stablePoolAssets[1])
        })

        if(!token0Data || !token1Data ){
            throw new Error("ACA swap builder error getting token data from registry")
        }

        let inputIndex;
        let outputIndex;
        if(tokenPathSymbols[0].toUpperCase() == token0Data.tokenData.symbol.toUpperCase()){
            inputIndex = 0
            outputIndex = 1
        } else if (tokenPathSymbols[0].toUpperCase() == token1Data.tokenData.symbol.toUpperCase()){
            inputIndex = 1
            outputIndex = 0
        } else {
            throw new Error("Cant get input/output indexs for stable pool")
        }
    

        let tokenReserves = targetStablePool.liquidityStats.map((stat) => new bn(stat))
        let tokenShares = targetStablePool.tokenShares.map((share) => new bn(share))

        let inputAmountFormatted = new bn(amountInDynamic).times(new bn(10).pow(new bn(startToken.decimals)))
        let outputAmountFormatted = new bn(expectedAmountOutDynamic).times(new bn(10).pow(new bn(destToken.decimals)))

        let extrsinsicInputDx = tokenShares[inputIndex].times(inputAmountFormatted.dividedBy(tokenReserves[inputIndex])).integerValue(bn.ROUND_DOWN)
        let extrinsicOutputDy = tokenShares[outputIndex].times((outputAmountFormatted.div(tokenReserves[outputIndex]))).integerValue(bn.ROUND_DOWN)

        swapTx = await api.tx.stableAsset
        .swap(
            poolId,
            inputIndex, 
            outputIndex, 
            extrsinsicInputDx.integerValue().toFixed(), 
            extrinsicOutputDy.integerValue().toFixed(), 
            assetLength
        )
    }
    // let assetNodes = extrinsicNodes[index]
        let swapTxContainer: SwapExtrinsicContainer = {
            relay: 'polkadot',
            chainId: 2000,
            type: "Swap",
            chain: "Acala",
            assetNodes: extrinsicNodes,
            extrinsic: swapTx,
            assetAmountIn: supplyAmount,
            expectedAmountOut: expectedOutAmountFixed,
            assetIn: assetIn,
            assetOut: assetOut,
            pathType: swapType,
            pathAmount: amountIn,
            api: api,
        }
        return [swapTxContainer, remainingInstructions]

}


function truncateSwapInstructions(startAsset: string, swapInstructions: SwapInstruction[]){
    let instructionsToExecute = swapInstructions.slice(0, 3)
    let remainingInstructions = swapInstructions.slice(3)
    return [instructionsToExecute, remainingInstructions]
}

function getAcalaStablePoolData(poolId: number){
    let acalaStableLps = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../polkadot_assets/lps/lp_registry/aca_stable_lps.json'), 'utf8'))
    // console.log("Acala Stable LPs: " + JSON.stringify(acalaStableLps, null, 2))
    let poolData = acalaStableLps.find((pool) => {
        return pool["poolId"] == poolId
    })
    // console.log("Pool Data: " + JSON.stringify(poolData, null, 2))
    return poolData
}






function getAssetIndex(stablePoolAssets: any[], targetAsset: any){
    let assetType = Object.keys(targetAsset)[0];
    let assetId = targetAsset[assetType];
    let assetIndex = stablePoolAssets.findIndex((asset) => {
        const poolAssetKey = Object.keys(asset)[0]
        const poolAssetId = asset[poolAssetKey]
        return poolAssetKey.toLowerCase() == assetType.toLowerCase() && poolAssetId.toString().toLowerCase() == assetId.toString().toLowerCase()
        
    })
    return assetIndex;
}

function findObjectWithEntry(stablePools, targetAsset) {
    let assetType = Object.keys(targetAsset)[0];
    let assetId = targetAsset[assetType];
    // console.log("Asset Type: " + assetType + " Asset Id: " + assetId)
    let matchingStablePool = stablePools.find(([poolKey, poolData]) => {
        let poolAssets = poolData.toJSON()["assets"]
        // console.log("Pool Assets: " + JSON.stringify(poolAssets, null, 2))
        let matchedPool = false;
        poolAssets.forEach((asset) => {
            const poolAssetKey = Object.keys(asset)[0]
            const poolAssetId = asset[poolAssetKey]
            // console.log("Pool Asset Key: " + poolAssetKey + " Pool Asset Id: " + poolAssetId)
            if(poolAssetKey.toLowerCase() == assetType.toLowerCase() && poolAssetId.toString().toLowerCase() == assetId.toString().toLowerCase()){
                // console.log("FOUND MATCH")
                matchedPool = true;
            }
        })
        return matchedPool;
    })
    // console.log("Matching Stable Pool: " + JSON.stringify(matchingStablePool, null, 2))
    return matchingStablePool;

}

function isWithinPercentage(expected: FixedPointNumber, actual: FixedPointNumber, thresholdPercentage: number) {
    let difference = expected.minus(actual).abs()
    let percentageDifference = difference.div(expected).times(new FixedPointNumber(100))

    return percentageDifference.isLessOrEqualTo(new FixedPointNumber(thresholdPercentage));
}

async function testStablePool(){
    let poolId = "0"
    let poolData = getAcalaStablePoolData(Number.parseInt(poolId))
    let inputAssetSymbol = "LDOT"
    let outputAssetSymbol = "DOT"

    console.log("Pool Data: " + JSON.stringify(poolData, null, 2))

    // let poolId = swapInstructions[0].pathData.lpId
    let assetRegistry = getAssetRegistry('polkadot');

    let targetStablePool = getAcalaStablePoolData(Number.parseInt(poolId))
    let stablePoolAssets = targetStablePool.poolAssets
    let token0Data = assetRegistry.find((asset) => {
        return JSON.stringify(asset.tokenData.localId) == JSON.stringify(stablePoolAssets[0])
    })
    let token1Data = assetRegistry.find((asset) => {
        return JSON.stringify(asset.tokenData.localId) == JSON.stringify(stablePoolAssets[1])
    })
    if(!token0Data || !token1Data ){
        throw new Error("ACA swap builder error getting token data from registry")
    }

    if(inputAssetSymbol == token0Data.tokenData.symbol){
        console.log("Input Asset is Token 0")
    } else if (inputAssetSymbol == token1Data.tokenData.symbol){
        console.log("Input Asset is Token 1")
    } else {
        console.log("Input Asset not found in pool")
    }

    if(outputAssetSymbol == token0Data.tokenData.symbol){
        console.log("Output Asset is Token 0")
    } else if (outputAssetSymbol == token1Data.tokenData.symbol){
        console.log("Output Asset is Token 1")
    } else {
        console.log("Output Asset not found in pool")
    }

}

// async function swapWithSDK(){
//     // const api = await getPolkadotApi();
//     const provider = new WsProvider(wsLocalChain);
//     const api = new ApiPromise(options({ provider }));
//     await api.isReady;

//     const signer = await getSigner();
  
//     // const wallet = new WalletPromise(api);
//     const wallet = await new Wallet(api)
//     await wallet.isReady
//     const allTokens = await wallet.getTokens()

//     for( let key in allTokens){
//         if(allTokens.hasOwnProperty(key)){
//             console.log(allTokens[key].name)
//         }
//     }


//     const karToken = wallet.getToken("KAR");
//     const kusdToken = wallet.getToken("KUSD");

//     const path = [karToken, kusdToken] as [Token, Token];
//     const supplyAmount = new FixedPointNumber(10, karToken.decimal);
//     let supplyConverted = supplyAmount.toChainData();
//     console.log("Supply amount: " + supplyConverted)
//     // set slippage 1%
//     const slippage = new FixedPointNumber(0.01);
//     const configs = {
//         api: api,
//         wallet: wallet,
//     }
//     const dex = new AcalaDex(configs)
//     const dexConfigs = {
//         api: api,
//         wallet: wallet,
//         providers: [dex]
//     }
//     const aDex = new AggregateDex(dexConfigs);
//     const swapParams: AggregateDexSwapParams = {
//         source: "aggregate",
//         mode: "EXACT_INPUT",
//         path: path,
//         input: supplyAmount,
//         acceptiveSlippage: slippage.toNumber(),
//     }
//     // const swapParams = {
//     //     source: "aggregate",
//     //     mode: "EXACT_INPUT",
//     //     path: path,
//     //     input: supplyAmount,
//     //     acceptiveSlippage: slippage.toNumber(),
//     // }
//     let swapResults = await firstValueFrom(aDex.swap(swapParams))
//     console.log(swapResults.result)
//     console.log(JSON.stringify(swapResults.tracker[0], null, 2))
//     let tradingTx = aDex.getTradingTx(swapResults)
//     console.log(JSON.stringify(tradingTx.toHuman(), null, 2))
//     let txResult = await tradingTx.signAndSend(signer)
    
//     console.log(txResult.toString())
//     await api.disconnect()
// }

// async function tradingPaths(){
//     const provider = new WsProvider(wsLocalChain);
//     const api = new ApiPromise(options({ provider }));
//     await api.isReady;

//     const signer = await getSigner();
  
//     // const wallet = new WalletPromise(api);
//     const wallet = new Wallet(api)
//     await wallet.isReady

//     const dex = new AcalaDex({api, wallet})
//     const dexConfigs = {
//         api: api,
//         wallet: wallet,
//         providers: [dex]
//     }

//     const karToken = wallet.getToken("KAR");
//     const kusdToken = wallet.getToken("KUSD");
//     const path = [karToken, kusdToken] as [Token, Token];

//     const supplyAmount = new FixedPointNumber(10, karToken.decimal);
//     const slippage = new FixedPointNumber(0.01);

//     const aDex = new AggregateDex(dexConfigs);

//     let tradingPaths = aDex.getTradingPaths(path[0], path[1], dex.source)
//     console.log(JSON.stringify(tradingPaths, null, 2))

//     // let useablePaths = this.getTradingPaths(path[0], path[1]);


//       // remove include other source path when source is not aggregate
//       tradingPaths = tradingPaths.filter((path) => {
//         console.log("Path: " + JSON.stringify(path, null, 2))
//         return path.reduce((acc, item) => {
//             console.log("Item: " + JSON.stringify(item, null, 2) + " Source: " + item[0] + " Acc: " + acc)
//           return acc && dex.source === item[0];
//         }, true as boolean);
//       });
// }

// async function swapWithDex(){
//         // const api = await getPolkadotApi();
//         const provider = new WsProvider(wsLocalChain);
//         const api = new ApiPromise(options({ provider }));
//         await api.isReady;
    
//     const signer = await getSigner(true, false);
//     const wallet = new Wallet(api);
//     await wallet.isReady
//     const allTokens = await wallet.getTokens()

//     for( let key in allTokens){
//         if(allTokens.hasOwnProperty(key)){
//             console.log(allTokens[key].name)
//         }
//     }

//     const karToken = wallet.getToken("KAR");
//     const karCurrencyId = await karToken.toCurrencyId(api)
//     const kusdToken = wallet.getToken("KUSD");
//     const kusdCurrencyId = await kusdToken.toCurrencyId(api)

//     const path = [karCurrencyId, kusdCurrencyId]
//     const supplyAmount = new FixedPointNumber(10, karToken.decimal);
//     let supplyConverted = supplyAmount.toChainData();
//     console.log("Supply amount: " + supplyConverted)
//     // set slippage 1%
//     const slippage = new FixedPointNumber(0.01);
  
//     const swapTx = api.tx.dex.swapWithExactSupply(path, supplyConverted, "0x0");
//     console.log(swapTx.toHuman())
//     let tx = await swapTx.signAndSend(signer);  
//     console.log(tx.toHuman())
//     await api.disconnect()
// }

// const getSigner = async () => {
//     await cryptoWaitReady()
//     const keyring = new Keyring({
//       type: "sr25519",
//     });
  
//     // Add Alice to our keyring with a hard-deived path (empty phrase, so uses dev)
//     return keyring.addFromUri("//Alice");
//   };

async function run(){
    // await karuraSwap();
    // await swapWithSDK();
    // await swapWithDex();
    // await tradingPaths();
    // let karTx = await getKarSwapExtrinsicBestPath(2, "USDT", "KUSD", 1, 1.6, [])
    // await getSwapExtrinsicBestPath("KSM", "KUSD", 1, 43.194656695628)
    // await testErrorCodes()
    // getAcalaStablePoolData(0)
    await testStablePool()
    process.exit(0)
}

// run()