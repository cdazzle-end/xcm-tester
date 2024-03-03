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

const wsLocalChain = "ws://172.26.130.75:8008"
// const wsLocalDestination = "ws://172.26.130.75:8008" 
const karRpc = "wss://karura-rpc-0.aca-api.network"

async function karuraSwap() {
    const provider = new WsProvider(wsLocalChain);
    const api = new ApiPromise(options({ provider }));
    await api.isReady;

    const keyring = new Keyring({ type: 'sr25519' });
    const newPair = keyring.addFromUri('//Alice');
    const address = newPair.address;
    console.log(newPair.address); // you need to get test tokens
  	
    // DOT -> aUSD
  	
    // Set Supply Amount
    const supply = 1
    
    // Query Dex Pool
    // const pool = await api.derive.dex.pool('KSM');
    api.query.dex.liquidityPool('KSM');
    // Query Exchange Fee
    const exchangeFee = api.consts.dex.getExchangeFee;
    
    // Calculate Target Currency Amount
    // const target = calcSwapTargetAmount(
    //     supply,
    //     convertToFixed18(pool.base),
    //     convertToFixed18(pool.other),
    //     convertToFixed18(exchangeFee),
    //     Fixed18.fromNature(0.005)
    // );
  
    // // Exec Exchange
    // await api.tx.dex.swapCurrency(
    //     'DOT',
    //     Fixed18.fromNatural(supply).innerToString(),
    //     'AUSD',
    //     Fixed18.fromNatural(target).innerToString()
    // ).signAndSend(newPair);

    // Ensure Amount
    const dotAccount = await api.query.tokens.accounts(address, 'DOT');
    console.log(dotAccount.toHuman());
  
    const aUSDAccount = await api.query.tokens.accounts(address, 'AUSD');
    console.log(aUSDAccount.toHuman());
}

async function testErrorCodes(){
    const provider = new WsProvider(karRpc);
    const api = new ApiPromise(options({ provider }));
    await api.isReady;

    let errorModule = {index:"91",error:"0x09000000"}

    const moduleIndex = parseInt(errorModule.index, 10);

    const errorIndexHex = errorModule.error.substring(2, 4); // "09"
    const errorIndexParsed = parseInt(errorIndexHex, 16); 
    let index = new BN(moduleIndex)
    let errorIndex = new BN(errorIndexParsed)

    let error = await api.registry.findMetaError({index: index, error: errorIndex} )
    console.log(JSON.stringify(error, null, 2))
    // // console.log(JSON.stringify(api.errors, null, 2))
    // const { docs, name, section } = error
    // console.log(JSON.stringify(error, null, 2))
    // console.log(`Error: ${name} Section: ${section} Docs: ${docs}`)
    // console.log("Error Index Array: " + u8aToHex(errorIndexArray))
}
// export async function getKarSwapExtrinsicBestPath(
//     swapType: number, 
//     startAsset: any, 
//     destAsset: any, 
//     amountIn: number, 
//     expectedAmountOut: number, 
//     swapInstructions: SwapInstruction[], 
//     chopsticks: boolean = false, 
//     txIndex: number, 
//     extrinsicIndex: IndexObject, 
//     instructionIndex: number[], 
//     pathNodeValues: PathNodeValues,
//     priceDeviationPercent: number = 2
//     ): Promise<SwapExtrinsicContainer[]>{
//     let rpc = chopsticks ? wsLocalChain : karRpc
//     const provider = new WsProvider(rpc);
//     const api = new ApiPromise(options({ provider }));
//     await api.isReady;

//     // console.log(`SWAP INSTRUCTION ${JSON.stringify(swapInstructions, null, 2)}`)

//     const signer = await getSigner(chopsticks, false);
  
//     let accountNonce = await api.query.system.account(signer.address)
//     let nonce = accountNonce.nonce.toNumber()
//     nonce += txIndex

//     const wallet = new Wallet(api)
//     await wallet.isReady
    
//     // This is what we return for data needed to construct reverse tx
//     // let assetNodes: AssetNode[] = [swapInstructions[0].assetNodes[0]]

//     const startToken = wallet.getToken(startAsset);
//     const destToken = wallet.getToken(destAsset);

//     let [tokenPaths, extrinsicNodes] = buildTokenPaths(startAsset, swapInstructions)
//     // let extrinsicNodesIndex = 0;
//     let swapTxsPromise = tokenPaths.map(async (tokenPath, index) => {
//         // console.log("EXTRINSIC NODE INDEX: " + extrinsicNodesIndex)
//         // console.log("MAP FUNCTION INDEX: " + index)
//         let path = tokenPath.map((token)=> {
//             return wallet.getToken(token).toChainData()
//         })
//         const supplyAmount = new FixedPointNumber(amountIn, startToken.decimals);
//         const expectedOutAmountFixed = new FixedPointNumber(expectedAmountOut, destToken.decimals);
    
//         const priceDeviation = expectedOutAmountFixed.mul(new FixedPointNumber(priceDeviationPercent)).div(new FixedPointNumber(100));
//         let expectedAmountOutWithDeviation = expectedOutAmountFixed.sub(priceDeviation);
        
//         let swapTx: SubmittableExtrinsic<"promise", ISubmittableResult> | SubmittableExtrinsic<"rxjs", ISubmittableResult>;
//         if(swapType == 1){
//             // Dex swap
//             swapTx = await api.tx.dex
//                 .swapWithExactSupply(
//                     path,
//                     supplyAmount.toChainData(),
//                     expectedAmountOutWithDeviation.toChainData()
//                 )
//         } else {
//             let stablePools = await api.query.stableAsset.pools.entries()
//             const matchingStablePool = findObjectWithEntry(stablePools, path[0])
//             if(!matchingStablePool){
//                 throw new Error("No matching stable pool found for asset: " + JSON.stringify(path[0], null, 2))
//             }

//             const poolData = matchingStablePool[1].toJSON()
//             const poolAssets = poolData["assets"]
//             const stablePoolIndex = poolData["poolAsset"]["stableAssetPoolToken"]
//             const startAssetIndex = getAssetIndex(poolAssets, path[0])
//             const endAssetIndex = getAssetIndex(poolAssets, path[1])
//             const assetLength = poolAssets.length
//             swapTx = await api.tx.stableAsset
//                 .swap(
//                     stablePoolIndex,
//                     startAssetIndex, 
//                     endAssetIndex, 
//                     supplyAmount.toChainData(), 
//                     expectedAmountOutWithDeviation.toChainData(), 
//                     assetLength
//                 )
//         }
//         let assetNodes = extrinsicNodes[index]
//         let swapTxContainer: SwapExtrinsicContainer = {
//             chainId: 2000,
//             chain: "Karura",
//             assetNodes: assetNodes,
//             extrinsic: swapTx,
//             extrinsicIndex: extrinsicIndex.i,
//             instructionIndex: instructionIndex,
//             nonce: nonce,
//             assetAmountIn: supplyAmount,
//             expectedAmountOut: expectedOutAmountFixed,
//             assetSymbolIn: startAsset,
//             assetSymbolOut: destAsset,
//             pathInLocalId: pathNodeValues.pathInLocalId,
//             pathOutLocalId: pathNodeValues.pathOutLocalId,
//             pathSwapType: swapType,
//             pathAmount: amountIn,
//             api: api,
//             // reverseTx: reverseTx
//         }

//         // extrinsicNodesIndex += 1;
//         increaseIndex(extrinsicIndex)
//         return swapTxContainer
//     })

//     let swapTxContainers = await Promise.all(swapTxsPromise)
    
//     return swapTxContainers
// }
function buildTokenPaths(startAsset: string, swapInstructions: any[]): [string[][], AssetNode[][]] {
    let tokenPaths: string[][] = [];
    let tokenPath: string[] = [startAsset];
    let extrinsicNodes: AssetNode[][] = [];
    let assetNodes: AssetNode[] = [swapInstructions[0].assetNodes[0]];
    let swapLength = 0; // To track the number of swaps added to the current tokenPath

    for (let i = 0; i < swapInstructions.length; i++) {
        // Add the current asset to the tokenPath
        tokenPath.push(swapInstructions[i].assetNodes[1].getAssetRegistrySymbol());
        assetNodes.push(swapInstructions[i].assetNodes[1])
        swapLength += 1;

        // Check if the tokenPath reached its maximum length or it's the last instruction
        if (swapLength === 3 || i === swapInstructions.length - 1) {
            // Add the current tokenPath to tokenPaths
            tokenPaths.push(tokenPath);
            extrinsicNodes.push(assetNodes)
            // If it's not the last instruction, prepare for the next tokenPath
            if (i !== swapInstructions.length - 1) {
                // Start a new tokenPath with the last item of the current tokenPath
                tokenPath = [tokenPath[tokenPath.length - 1]];
                assetNodes = [assetNodes[assetNodes.length - 1]];
                // Reset swapLength for the new tokenPath
                swapLength = 0;
            }
        }
    }

    return [tokenPaths, extrinsicNodes];
}
export async function getKarSwapExtrinsicDynamic(    
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
    let rpc = chopsticks ? wsLocalChain : karRpc
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
        // Need to figure out how to calc minDy, if KSM input, output can just equal supply
        // If LKSM input, multiply supply by 6.587, and output can be normal expected amount
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

            //if lksm or ksm, adjust parameters
            if(startAssetDynamic == "LKSM"){
                let lksmSupply = supplyAmount.times(new FixedPointNumber(6.587))

                swapTx = await api.tx.stableAsset
                .swap(
                    stablePoolIndex,
                    startAssetIndex, 
                    endAssetIndex, 
                    lksmSupply.toChainData(), 
                    // Temporary value for minDy
                    expectedAmountOutWithDeviation.toChainData(), 
                    assetLength
                )
            } else if (startAssetDynamic == "KSM"){
                swapTx = await api.tx.stableAsset
                .swap(
                    stablePoolIndex,
                    startAssetIndex, 
                    endAssetIndex, 
                    supplyAmount.toChainData(), 
                    // Temporary value for minDy
                    supplyAmount.toChainData(), 
                    assetLength
                )
            // Other stables can be calculated normally
            } else {
                console.log(`KAR Stable Swap: ${startAssetDynamic} to ${destAssetDynamic}: ${supplyAmount.toNumber()} to ${expectedAmountOutWithDeviation.toNumber()}`)
                console.log("Reducing expected by 5%")
                expectedAmountOutWithDeviation = expectedAmountOutWithDeviation.times(new FixedPointNumber(0.95))
                console.log(`KAR Stable Swap: ${startAssetDynamic} to ${destAssetDynamic}: ${supplyAmount.toNumber()} to ${expectedAmountOutWithDeviation.toNumber()}`)
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
            chainId: 2000,
            chain: "Karura",
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
            pathSwapType: swapType,
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
    process.exit(0)
}

// run()