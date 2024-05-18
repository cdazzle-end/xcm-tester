import fs from 'fs'
import * as paraspell from '@paraspell/sdk'
import { Observable, firstValueFrom } from 'rxjs'
import { timeout } from 'rxjs/operators'
import { WsProvider, ApiPromise, Keyring } from '@polkadot/api'
import { History } from '@acala-network/sdk'
import { BN, u8aToHex } from '@polkadot/util'
import { EventRecord, Phase, Event, Hash } from '@polkadot/types/interfaces'
import { ISubmittableResult, IU8a } from '@polkadot/types/types'
import { TNode, getAssetsObject, getNode } from '@paraspell/sdk'
import { BalanceData, getAdapter } from '@polkawallet/bridge'
import { exec, execSync, spawn, ChildProcess } from 'child_process';
import path from 'path';
import bn, { BigNumber } from 'bignumber.js'
// import { getAdapter } from './adapters'

import { RegistryError } from '@polkadot/types/types/registry';
// import * as s from 'json-stringify-safe';
// import flatted from 'flatted';
// import { encodeAddress, decodeAddress } from "@polkadot/keyring";
// import { BalanceChangeStatue } from '../../src/types';
// import {Mangata} from '@mangata-finance/sdk'
// import { wsLocalFrom, wsLocalDestination, assetSymbol, fromChain, toChain } from '../xcm_tests/testParams'
// import { u8aToHex } from '@polkadot/util';
// import { mnemonicToLegacySeed, hdEthereum } from '@polkadot/util-crypto';
// const { ApiPromise } = require('@polkadot/api');
// const { WsProvider } = require('@polkadot/rpc-provider');
import { options } from '@acala-network/api';
// import { SwapPromise } from "@acala-network/sdk-swap";
import { WalletPromise } from "@acala-network/sdk-wallet";
import {cryptoWaitReady} from "@polkadot/util-crypto"
import { FixedPointNumber, Token } from "@acala-network/sdk-core";
import { Wallet } from "@acala-network/sdk/wallet/wallet.js"
import { AcalaDex, AggregateDex } from "@acala-network/sdk-swap"
import { AggregateDexSwapParams, TradingPath } from '@acala-network/sdk-swap/types.js'
// import { AggregateDexSwapParams } from '../../node_modules/.pnpm/@acala-network+sdk-swap@4.1.9-13_@acala-network+api@5.1.2_@acala-network+eth-providers@2.7.19_7m57xuskb5lxcqt46rnn4nnyhe/node_modules/@acala-network/sdk-swap/index.ts'
import { IndexObject, PathNodeValues, ReverseSwapExtrinsicParams, SwapExtrinsicContainer, SwapInstruction } from '../instructions/types.ts'
import { SubmittableExtrinsic } from '@polkadot/api/submittable/types'
import { increaseIndex } from './../instructions/utils.ts'
import { AssetNode } from './../instructions/AssetNode.ts'
// import { SubmittableExtrinsic } from '@polkadot/api/promise/types'
// const { options } = require('@acala-network/api');
// import { Fixed18, convertToFixed18, calcSwapTargetAmount } from '@acala-network/api';
import { getSigner } from '../instructions/utils.ts'
import { localRpcs } from './../instructions/txConsts.ts'
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const wsLocalChain = localRpcs["Acala"]
// const wsLocalDestination = "ws://172.26.130.75:8008" 
const acaRpc = "'wss://acala-rpc-0.aca-api.network'"


export async function getAcaSwapExtrinsicDynamic(    
    swapType: number, 
    startAsset: any, 
    destAsset: any, 
    amountIn: number, 
    expectedAmountOut: number, 
    swapInstructions: SwapInstruction[], 
    chopsticks: boolean = true, 
    txIndex: number, 
    extrinsicIndex: IndexObject, 
    instructionIndex: number[], 
    // pathNodeValues: PathNodeValues,
    priceDeviationPercent: number = 2
): Promise<[SwapExtrinsicContainer, SwapInstruction[]]>{
    let rpc = chopsticks ? wsLocalChain : acaRpc
    const provider = new WsProvider(rpc);
    const api = new ApiPromise(options({ provider }));
    await api.isReady;

    
    const signer = await getSigner(chopsticks, false);
  
    let accountNonce = await api.query.system.account(signer.address)
    let nonce = accountNonce.nonce.toNumber()
    nonce += txIndex

    const wallet = new Wallet(api)
    await wallet.isReady
    let [swapInstructionsToExecute, remainingInstructions] = truncateSwapInstructions(startAsset, swapInstructions)
    let startAssetDynamic = swapInstructionsToExecute[0].assetNodes[0].getAssetRegistrySymbol()
    let destAssetDynamic = swapInstructionsToExecute[swapInstructionsToExecute.length - 1].assetNodes[1].getAssetRegistrySymbol()

    const startToken = wallet.getToken(startAssetDynamic);
    const destToken = wallet.getToken(destAssetDynamic);

    let tokenPathSymbols: string[] = [startAssetDynamic];
    let extrinsicNodes: AssetNode[] = [swapInstructionsToExecute[0].assetNodes[0]]
    swapInstructionsToExecute.forEach((swapInstruction) => {
        tokenPathSymbols.push(swapInstruction.assetNodes[1].getAssetRegistrySymbol())
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

    if(swapType == 1){
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

        let stablePools = await api.query.stableAsset.pools.entries()
            const matchingStablePool = findObjectWithEntry(stablePools, tokenPath[0])
            if(!matchingStablePool){
                throw new Error("No matching stable pool found for asset: " + JSON.stringify(tokenPath[0], null, 2))
            }

            const poolData = matchingStablePool[1].toJSON()
            const poolAssets = poolData["assets"]
            const stablePoolIndex = poolData["poolAsset"]["stableAssetPoolToken"]
            const startAssetIndex = getAssetIndex(poolAssets, tokenPath[0])
            const endAssetIndex = getAssetIndex(poolAssets, tokenPath[1])
            const assetLength = poolAssets.length

            let acalaStablePoolData = getAcalaStablePoolData(stablePoolIndex)
            let inputAmount = new bn(supplyAmount.toChainData())
            let dotReserveBalance = new bn(acalaStablePoolData.liquidityStats[0]) // shares and balance are the same for DOT
            let ldotReserveShares = new bn(acalaStablePoolData.liquidityStats[1])
            let ldotReserveBalance = new bn(acalaStablePoolData.liquidityStats[3])
            //if lksm or ksm, adjust parameters
            if(startAssetDynamic == "LDOT"){
                // let lksmSupply = supplyAmount.times(new FixedPointNumber(6.587))
                console.log("Supply Amount: " + inputAmount)
                console.log("LDOT Reserve Balance: " + ldotReserveBalance)
                let ldotInputPercent = inputAmount.div(ldotReserveBalance) // Percent of output balance / total balance
                let ldotInputShares = ldotReserveShares.times(ldotInputPercent)

                console.log("LDOT Input Percent: " + ldotInputPercent)
                console.log("LDOT Input Shares: " + ldotInputShares)
                swapTx = await api.tx.stableAsset
                .swap(
                    stablePoolIndex,
                    startAssetIndex, 
                    endAssetIndex, 
                    ldotInputShares.integerValue().toFixed(), 
                    // Temporary value for minDy
                    expectedAmountOutWithDeviation.toChainData(), 
                    assetLength
                )
            } else if (startAssetDynamic == "DOT"){
                let amountOut = new bn(expectedAmountOutWithDeviation.toChainData())
                let ldotOutputPercent = amountOut.div(ldotReserveBalance)
                let ldotOutputShares = ldotOutputPercent.times(ldotReserveShares)

                swapTx = await api.tx.stableAsset
                .swap(
                    stablePoolIndex,
                    startAssetIndex, 
                    endAssetIndex, 
                    supplyAmount.toChainData(), 
                    // Temporary value for minDy
                    ldotOutputShares.integerValue().toFixed(), 
                    assetLength
                )
            // Other stables can be calculated normally
            } else {
                swapTx = await api.tx.stableAsset
                    .swap(
                        stablePoolIndex,
                        startAssetIndex, 
                        endAssetIndex, 
                        supplyAmount.toChainData(), 
                        // Temporary value for minDy
                        expectedAmountOutWithDeviation.toChainData(), 
                        assetLength
                    )
            }
    }
    // let assetNodes = extrinsicNodes[index]
        let swapTxContainer: SwapExtrinsicContainer = {
            relay: 'polkadot',
            chainId: 2000,
            chain: "Acala",
            assetNodes: extrinsicNodes,
            extrinsic: swapTx,
            extrinsicIndex: extrinsicIndex.i,
            instructionIndex: instructionIndex,
            nonce: nonce,
            assetAmountIn: supplyAmount,
            expectedAmountOut: expectedOutAmountFixed,
            assetSymbolIn: startAssetDynamic,
            assetSymbolOut: destAssetDynamic,
            // pathInLocalId: pathNodeValues.pathInLocalId,
            // pathOutLocalId: pathNodeValues.pathOutLocalId,
            pathType: swapType,
            pathAmount: amountIn,
            api: api,
            // reverseTx: reverseTx
        }

        // extrinsicNodesIndex += 1;
        increaseIndex(extrinsicIndex)
        return [swapTxContainer, remainingInstructions]

}


function truncateSwapInstructions(startAsset: string, swapInstructions: SwapInstruction[]){
    let instructionsToExecute = swapInstructions.slice(0, 3)
    let remainingInstructions = swapInstructions.slice(3)
    return [instructionsToExecute, remainingInstructions]
}

function getAcalaStablePoolData(poolId: number){
    let acalaStableLps = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../polkadot_assets/lps/lp_registry/aca_stable_lps.json'), 'utf8'))
    let poolData = acalaStableLps.find((pool) => {
        return pool["poolId"] == poolId
    })
    console.log("Pool Data: " + JSON.stringify(poolData, null, 2))
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
    getAcalaStablePoolData(0)
    process.exit(0)
}

// run()