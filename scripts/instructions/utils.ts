import fs from 'fs'
import * as paraspell from '@paraspell/sdk'
import { BalanceData, getAdapter } from '@polkawallet/bridge';
import { TNode, getAssetsObject, getNode } from '@paraspell/sdk'
import path from 'path';
import { firstValueFrom, combineLatest, map, Observable, race, EMPTY, timeout } from "rxjs";
import { cryptoWaitReady } from "@polkadot/util-crypto"
import { MyAssetRegistryObject, MyAsset, ResultDataObject, ApiSet, IndexObject, SingleSwapResultData, SingleTransferResultData, ExtrinsicSetResultDynamic, LastNode, ExecutionState, ArbExecutionResult } from './types.ts'
import { AssetNode } from './AssetNode.ts'
import { allConnectionPromises, allConnections, observableApis, promiseApis } from './liveTest.ts';
import { ApiPromise, ApiRx, WsProvider } from '@polkadot/api';
import { options } from '@acala-network/api/dist/index.js';
import { prodParasKusama, prodParasKusamaCommon, prodRelayKusama } from '@polkadot/apps-config/endpoints';
import { fileURLToPath } from 'url';
// import fs from 'fs'
// import { Observable, timeout } from 'rxjs'
// import { options } from "@acala-network/api";
// import * as paraspell from '@paraspell/sdk'
import { Keyring } from '@polkadot/api'
import {KeyringPair} from '@polkadot/keyring/types'
// import { TNode, getAssetsObject, getNode, getNodeEndpointOption, getAllNodeProviders, getTNode } from '@paraspell/sdk'
// import path from 'path';
// import { cryptoWaitReady } from "@polkadot/util-crypto"
import { wsLocalFrom, wsLocalDestination, assetSymbol, fromChain, toChain } from '../xcm_tests/testParams.ts'
import { BN, compactStripLength, u8aToHex } from '@polkadot/util'
// import { getAssetBySymbolOrId, getParaspellChainName, getAssetRegistryObject, readLogData, getEndpointsForChain, connectFirstApi, getAssetRegistryObjectBySymbol, watchTokenDeposit, getBalanceChange } from './utils.ts'
import {AssetNodeData, InstructionType, SwapInstruction, TransferInstruction, TransferToHomeThenDestInstruction, TxDetails, TransferToHomeChainInstruction, TransferParams, TransferAwayFromHomeChainInstruction, TransferrableAssetObject, TransferTxStats, BalanceChangeStats, SwapTxStats, SwapExtrinsicContainer, ExtrinsicObject, ChainNonces, TransferExtrinsicContainer } from './types.ts'
// import { AssetNode } from './AssetNode.ts'
// import { prodRelayPolkadot, prodRelayKusama, createWsEndpoints, prodParasKusamaCommon, prodParasKusama } from '@polkadot/apps-config/endpoints'
import { buildInstructions, getTransferrableAssetObject } from './instructionUtils.ts';
// import { fileURLToPath } from 'url';
import { getKarSwapExtrinsicBestPath } from './../swaps/karSwap.ts';
import { getMovrSwapTx } from './../swaps/movr/movrSwap.ts';
// import { getBncSwapExtrinsic } from './../swaps/bnc/bncSwap.ts';
import { getBncSwapExtrinsic } from './../swaps/bncSwap.ts';
import { getBsxSwapExtrinsic } from './../swaps/bsxSwap.ts';
// const bncSwap = await import('./../swaps/bnc/bncSwap.ts');
// const { getBncSwapExtrinsic } = bncSwap;
// import bnc from './../swaps/bnc/bncSwap.ts';
// import { getBsxSwapExtrinsic } from './../swaps/bsxSwap.ts';
// const bsxSwap = await import('./../swaps/bsx/bsxSwap.ts');
// const { getBsxSwapExtrinsic } = bsxSwap;
// import { getMgxSwapExtrinsic } from './../swaps/mgxSwap.ts';
// import { getHkoSwapExtrinsic } from './../swaps/hkoSwap.ts';
// import { checkAndApproveToken } from 'scripts/swaps/movr/utils/utils.ts';
// import { SubmittableExtrinsic } from '@polkadot/api/submittable/types'
// import { EventRecord } from '@polkadot/types/interfaces/index';

import { FixedPointNumber, Token } from "@acala-network/sdk-core";
import { ISubmittableResult } from '@polkadot/types/types/extrinsic';
// import { BalanceData, getAdapter } from '@polkawallet/bridge';
import { alithPk, arb_wallet, karRpc, ksmRpc, live_wallet_3, localRpcs, testNets } from './txConsts.ts';
import {EvmRpcProvider} from '@acala-network/eth-providers';
import { Wallet } from '@acala-network/sdk/wallet/wallet.js';
import { WalletConfigs } from '@acala-network/sdk/wallet/index.js';
import { liveWallet3Pk } from './../swaps/movr/utils/const.ts';
import { globalState } from './liveTest.ts';
import { getApiForNode } from './apiUtils.ts';

// import { buildTransferExtrinsic } from './extrinsicUtils.ts';
// Get the __dirname equivalent in ES module
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const aliceAddress = "HNZata7iMYWmk5RvZRTiAsSDhV8366zq2YGb3tLH5Upf74F"

export function setLastNode(node: LastNode){
    globalState.lastNode = node
    fs.writeFileSync(path.join(__dirname, './lastNode.json'), JSON.stringify(node, null, 2), 'utf8')
}
export function setLastFile(filePath: string){
    globalState.lastFilePath = filePath;
    fs.writeFileSync(path.join(__dirname, './lastAttemptFile.json'), JSON.stringify(filePath, null, 2), 'utf8')
}
export function setLastExtrinsicSet(extrinsicSet: ExtrinsicSetResultDynamic){
    globalState.extrinsicSetResults = extrinsicSet
    fs.writeFileSync(path.join(__dirname, './lastExtrinsicSet.json'), JSON.stringify(extrinsicSet, null, 2), 'utf8')
}

export function getLastExecutionState(){
    let lastNode = JSON.parse(fs.readFileSync(path.join(__dirname, './lastNode.json'), 'utf8'));
    let lastFilePath = JSON.parse(fs.readFileSync(path.join(__dirname, './lastAttemptFile.json'), 'utf8'));
    let allExtrinsicResults: ExtrinsicSetResultDynamic = JSON.parse(fs.readFileSync(path.join(__dirname, './lastExtrinsicSet.json'), 'utf8'));
    let lastExecutionState: ExecutionState = {
        lastNode,
        lastFilePath,
        extrinsicSetResults: allExtrinsicResults
    }
    return lastExecutionState
}

export function getNodeFromChainId(chainId: number): TNode{
    let node = paraspell.NODE_NAMES.find((node) => {
        return paraspell.getParaId(node) == chainId
    })
    return node as TNode

}



export function getParaspellChainName(chainId: number): TNode | "Kusama"{
    if(chainId == 0){
        return "Kusama"
    }
    let chain = paraspell.NODE_NAMES.find((node) => {
      return paraspell.getParaId(node) == chainId && paraspell.getRelayChainSymbol(node) == "KSM"  
    })
    return chain as TNode
}



export const getAssetBySymbolOrId = (
    node: TNode,
    symbolOrId: string | number
  ): { symbol?: string; assetId?: string } | null => {
    const { otherAssets, nativeAssets, relayChainAssetSymbol } = getAssetsObject(node)
    console.log("Getting asset symbol or ID: " + JSON.stringify(symbolOrId))
    
    const asset = [...otherAssets, ...nativeAssets].find(
      ({ symbol, assetId }) => {
        // console.log("Asset symobl or id " + JSON.stringify(symbolOrId) + " --- " + symbol + " --- " + assetId)
        if(typeof symbolOrId === 'string'){
            return symbol?.toLowerCase() === symbolOrId.toLowerCase() || assetId?.toLowerCase() === symbolOrId.toLowerCase()
        }
        else{
            return symbol === symbolOrId.toString() || assetId === symbolOrId.toString()
        }
    })
  
    if (asset !== undefined) {
      const { symbol, assetId } = asset
      return { symbol, assetId }
    }
    // For xc asset chains, account for the 'xc' prefix when sending to or receiving from
    if(node == "Moonriver" || node == "Shiden"){
        
        const asset = [...otherAssets, ...nativeAssets].find(
            ({ symbol, assetId }) => {
              // console.log("Asset symobl or id " + JSON.stringify(symbolOrId) + " --- " + symbol + " --- " + assetId)
              if(typeof symbolOrId === 'string'){
                let prefixedSymbolOrId = "xc" + symbolOrId
                return symbol?.toLowerCase() === prefixedSymbolOrId.toLowerCase() || assetId?.toLowerCase() === prefixedSymbolOrId.toLowerCase()
              }
              else{
                  return symbol === symbolOrId.toString() || assetId === symbolOrId.toString()
              }
          })
    // Check if asset is coming from an xc chain, and remove the 'xc' prefix
    } else {
        const asset = [...otherAssets, ...nativeAssets].find(
            ({ symbol, assetId }) => {
              // console.log("Asset symobl or id " + JSON.stringify(symbolOrId) + " --- " + symbol + " --- " + assetId)
              if(typeof symbolOrId === 'string'){
                let noPrefixSymbolOrId = symbolOrId.toLowerCase().startsWith("xc") ? symbolOrId.slice(2) : symbolOrId
                return symbol?.toLowerCase() === noPrefixSymbolOrId.toLowerCase() || assetId?.toLowerCase() === noPrefixSymbolOrId.toLowerCase()
              }
              else{
                  return symbol === symbolOrId.toString() || assetId === symbolOrId.toString()
              }
          })
    }
  
    if (relayChainAssetSymbol === symbolOrId) return { symbol: relayChainAssetSymbol }
  
    return null
}

export function getAssetRegistryObject(chainId: number, localId: string): MyAssetRegistryObject{
    console.log("Getting asset registry object: " + chainId + " --- " + localId)
    let assetRegistry: MyAssetRegistryObject[] = JSON.parse(fs.readFileSync(path.join(__dirname, '../../allAssets.json'), 'utf8'));
    let asset = assetRegistry.find((assetRegistryObject: MyAssetRegistryObject) => {
        if(chainId == 0 && assetRegistryObject.tokenData.chain == 0){
            return true
        }
        return assetRegistryObject.tokenData.chain == chainId && JSON.stringify(assetRegistryObject.tokenData.localId).replace(/\\|"/g, "") == localId
    })
    if(asset == undefined){
        throw new Error(`Asset not found in registry: chainId: ${chainId}, localId: ${localId}`)
    }
    return asset
}
export function getAssetRegistryObjectBySymbol(chainId: number, symbol: string): MyAssetRegistryObject{
    let assetRegistry: MyAssetRegistryObject[] = JSON.parse(fs.readFileSync(path.join(__dirname, '../../allAssets.json'), 'utf8'));
    let asset = assetRegistry.find((assetRegistryObject: MyAssetRegistryObject) => {
        return assetRegistryObject.tokenData.chain == chainId && JSON.stringify(assetRegistryObject.tokenData.symbol).toLowerCase() == JSON.stringify(symbol).toLowerCase()
    })
    if(asset){
        return asset
    }
    // Try again but account for xc
    if(symbol.toLowerCase().startsWith("xc")){
        let symbolNoPrefix = symbol.slice(2)
        asset = assetRegistry.find((assetRegistryObject: MyAssetRegistryObject) => {
            return assetRegistryObject.tokenData.chain == chainId && JSON.stringify(assetRegistryObject.tokenData.symbol).toLowerCase() == symbolNoPrefix.toLowerCase()
        })
    } else {
        let symbolYesPrefix = "xc" + symbol
        asset = assetRegistry.find((assetRegistryObject: MyAssetRegistryObject) => {
            return assetRegistryObject.tokenData.chain == chainId && JSON.stringify(assetRegistryObject.tokenData.symbol).toLowerCase() == symbolYesPrefix.toLowerCase()
        })
    }

    if(asset == undefined){
        throw new Error(`Asset not found in registry: chainId: ${chainId}, symbol: ${symbol}`)
    }
    return asset
}

// Reads a json object from the arbitrage result log and returns the corresponding paraspell asset and amount
export function readLogData(jsonObject: ResultDataObject){
    console.log("Reading log data: " + JSON.stringify(jsonObject))
    let chainId;
    let assetLocalId;
    let nodeKey = jsonObject.node_key.replace(/\\|"/g, "");
    // nodeKey = jsonObject.node_key.replace(/\\/g, "");
    // nodeKey = jsonObject.node_key.replace(/\//g, "");
    // console.log("NODE KEY: " + nodeKey)
    if(nodeKey.startsWith("0")){
        // console.log("STARTS WITH 0")
        // chainId = jsonObject.node_key.slice(0,1)
        chainId = "0"
        // assetLocalId = jsonObject.node_key.slice(1)
        assetLocalId = "KSM"
    } else {
        // chainId = jsonObject.node_key.slice(0,4)
        // assetLocalId = jsonObject.node_key.slice(4)
        chainId = nodeKey.slice(0,4)
        assetLocalId = nodeKey.slice(4)
    }
    // chainId = chainId.toString().replace(/[^0-9]/g, '')
    // console.log("READING LOG DATA: " + chainId + " --- " + assetLocalId)
    let assetRegistryObject = getAssetRegistryObject(parseInt(chainId), assetLocalId)
    let assetSymbol = assetRegistryObject.tokenData.symbol

    let paraspellChainName = getParaspellChainName(parseInt(chainId))
    if(paraspellChainName == "Kusama"){
        let assetNode = new AssetNode({
            paraspellAsset: {symbol: assetSymbol},
            paraspellChain: paraspellChainName,
            assetRegistryObject: assetRegistryObject,
            pathValue: jsonObject.path_value,
            pathType: jsonObject.path_identifier
        });
        return assetNode
    } else {
        let paraspellAsset = getAssetBySymbolOrId(paraspellChainName, assetSymbol)

        if(paraspellChainName == undefined){
            throw new Error("Paraspell chain name not found for chain id " + chainId)
        }
        if(paraspellAsset == null){
            throw new Error("Paraspell asset not found for chain " + paraspellChainName + " and asset id " + assetLocalId)
        }
        
        let assetNode = new AssetNode({
            paraspellAsset: paraspellAsset,
            paraspellChain: paraspellChainName,
            assetRegistryObject: assetRegistryObject,
            pathValue: jsonObject.path_value,
            pathType: jsonObject.path_identifier
        });
        // console.log(JSON.stringify(assetNode))
        return assetNode
    }
    
}

export function findValueByKey(obj: any, targetKey: any): any {
    if (typeof obj !== 'object' || obj === null) {
        return null;
    }
    for (let key in obj) {
        if (key === targetKey) {
            return obj[key];
        }

        let foundValue: any = findValueByKey(obj[key], targetKey);
        if (foundValue !== null) {
            return foundValue;
        }
    }
    return null;
}



export async function watchTokenDeposit(paraId: number, chopsticks: boolean, destChainApi: ApiPromise, transferrableAssetObject: TransferrableAssetObject, depositAddress: string){
    let tokenSymbol: string;
    if(paraId == 0){
        tokenSymbol = "KSM"
    }
    else if(!transferrableAssetObject.paraspellAsset.symbol){
        // throw logError(new Error("Asset symbol is null. Cant subscribe to token balance"))
        throw Error("Asset symbol is null. Cant subscribe to token balance")
    } else {
        tokenSymbol = transferrableAssetObject.paraspellAsset.symbol;
    }

    console.log(`Watch Token Deposit: Source Chain Name ${transferrableAssetObject.sourceParaspellChainName} | Token Symbol ${tokenSymbol} | Deposit Address ${depositAddress} `)

    // Make sure api is conencted
    console.log(`Watch Token Deposit: API connected: ${destChainApi.isConnected}`)
    if(!destChainApi.isConnected){
        console.log("Watch Token Deposit: API not connected. Connecting...")
        await destChainApi.connect()
        console.log("Watch Token Deposit: API connected: " + destChainApi.isConnected)
    }

    let destAdapter = getAdapter(paraId)
    let currentBalance: BalanceData;
    if(paraId == 2000){
        // let evmProvider: EvmRpcProvider = new EvmRpcProvider("ws://172.26.130.75:8008")
        let rpcEndpoint = chopsticks ? localRpcs["Karura"] : karRpc
        let walletConfigs: WalletConfigs = {
            evmProvider: EvmRpcProvider.from(rpcEndpoint),
            wsProvider: new WsProvider(rpcEndpoint)
        }
        let adapterWallet = new Wallet(destChainApi, walletConfigs);
        await destAdapter.init(destChainApi, adapterWallet);
    } else {
        await destAdapter.init(destChainApi);
    }
    
    // If chain is movr, make sure tokens have xc prefix
    if(paraId == 2023 && !tokenSymbol.toUpperCase().startsWith("XC") && tokenSymbol.toUpperCase() != "MOVR"){
        // console.log("Adding XC from token symbol")
        tokenSymbol = "xc" + tokenSymbol
    // if chain isnt movr, no prefix
    } else if(paraId != 2023 && tokenSymbol.toUpperCase().startsWith("XC")){
        // console.log("Removing XC from token symbol")
        tokenSymbol = tokenSymbol.slice(2)
    }
    const balanceObservable = destAdapter.subscribeTokenBalance(tokenSymbol, depositAddress);
    console.log("Watch Token Deposit: Subscribed to balance")
    return new Observable<BalanceData>((subscriber) => {
        const subscription = balanceObservable.subscribe({
            next(balance) {
                if(currentBalance){
                    subscriber.next(balance);
                    subscriber.complete();
                    console.log("Watch Token Deposit: Token deposit complete")
                } else {
                    currentBalance = balance;
                    subscriber.next(balance);
                }
            },
            error(err) {
                subscriber.error(new Error(err));
                subscriber.complete(); // Complete the outer Observable on error
            },
            complete() {
                subscriber.complete(); // Complete the outer Observable when the inner one completes
            }
        });
        return () => {
            subscription.unsubscribe();
        };
    })
}
export async function watchTokenBalance(paraId: number, chopsticks: boolean, chainApi: ApiPromise, assetSymbol: string, node: string, accountAddress: string){
    // printAndLogToFile("Initiating balance adapter for destination chain " + paraId + " on port " + destPort )
    let tokenSymbol;
    if(paraId == 0){
        tokenSymbol = "KSM"
    } else {
        tokenSymbol = assetSymbol
    }

    console.log(`Watch Token Balance: Watching chain ${node} | Token ${tokenSymbol} | Address ${accountAddress}`)

    // Make sure api is connected
    console.log(`Watch Token Balance: API connected: ${chainApi.isConnected}`)
    if(!chainApi.isConnected){
        console.log("Watch Token Balance: API not connected. Connecting...")
        await chainApi.connect()
        console.log("Watch Token Balance: API connected: " + chainApi.isConnected)
    }

    let destAdapter = getAdapter(paraId)
    let currentBalance: BalanceData;

    
    if(paraId == 2000){
        let rpcEndpoint = chopsticks ? localRpcs[node] : karRpc
        let walletConfigs: WalletConfigs = {
            evmProvider: EvmRpcProvider.from(rpcEndpoint),
            wsProvider: new WsProvider(rpcEndpoint)
        }
        let adapterWallet = new Wallet(chainApi, walletConfigs);
        await destAdapter.init(chainApi, adapterWallet);
    } else {
        await destAdapter.init(chainApi);
    }
    
    // printAndLogToFile("Subscribing to balance for destination chain " + paraId + " for asset " + transferrableAssetObject.paraspellAssetSymbol.symbol + " for address " + aliceAddress)
    
    // if(node == "Moonriver" && tokenSymbol.toUpperCase().startsWith("XC")){
    //     console.log("Removing XC from token symbol")
    //     tokenSymbol = tokenSymbol.slice(2)
    // }
    if(paraId == 2023 && !tokenSymbol.toUpperCase().startsWith("XC") && tokenSymbol.toUpperCase() != "MOVR"){
        console.log("Adding XC from token symbol")
        tokenSymbol = "xc" + tokenSymbol
    // if chain isnt movr, no prefix
    } else if(paraId != 2023 && tokenSymbol.toUpperCase().startsWith("XC")){
        console.log("Removing XC from token symbol")
        tokenSymbol = tokenSymbol.slice(2)
    }
    const balanceObservable = destAdapter.subscribeTokenBalance(tokenSymbol, accountAddress);
    console.log("Watch Token Balance: Subscribed to balance")
    // console.log(chainApi.registry.chainTokens)
    // console.log(destAdapter.getTokens())
    return new Observable<BalanceData>((subscriber) => {
        const subscription = balanceObservable.subscribe({
            next(balance) {
                if(currentBalance){
                    subscriber.next(balance);
                    subscriber.complete();
                    console.log("Watch Token Balance: Observable complete")
                } else {
                    currentBalance = balance;
                    subscriber.next(balance);
                }
            },
            error(err) {
                subscriber.error(new Error(err));
                subscriber.complete(); // Complete the outer Observable on error
            },
            complete() {
                subscriber.complete(); // Complete the outer Observable when the inner one completes
            }
        });
        return () => {
            subscription.unsubscribe();
        };
    })
}
export async function getBalanceChange(
    balanceObservable$: Observable<BalanceData>,
    setUnsubscribeCallback: (unsubscribe: () => void) => void
  ): Promise<BalanceChangeStats> {
    console.log("Get Balance Change: waiting for balance change")
    let currentBalance: BalanceData;
    let balanceChangeStats: BalanceChangeStats = {
        startBalance: new FixedPointNumber(0),
        endBalance: new FixedPointNumber(0),
        changeInBalance: new FixedPointNumber(0),
        startBalanceString: "0",
        endBalanceString: "0",
        changeInBalanceString: "0"
    }
    const balanceChangePromise = new Promise<BalanceChangeStats>((resolve, reject) => {
        const subscription = balanceObservable$.pipe(timeout(120000)).subscribe({
            next(balance) {
                
                if(currentBalance){
                    console.log("Get Balance Change: Balance changed")
                    let changeInBalance = balance.free.sub(currentBalance.free);
                    // currentBalance = balance;
                    console.log(`Get Balance Change: Previous Balance: ${currentBalance.free} | New Balance: ${balance.free} | Change in Balance: ${changeInBalance}`)

                    subscription.unsubscribe();
                    let startBalance = currentBalance.free
                    let endBalance = balance.free
                    balanceChangeStats = {
                        startBalance,
                        endBalance,
                        changeInBalance,
                        startBalanceString: startBalance.toString(),
                        endBalanceString: endBalance.toString(),
                        changeInBalanceString: changeInBalance.toString()
                    }
                    resolve(balanceChangeStats)
                } else {
                    balanceChangeStats.startBalance = balance.free
                    currentBalance = balance;
                    console.log(`Get Balance Change: Current Balance: ${balance.free}`);
                }
            },
            
            error(err) {
                if(err.name == 'TimeoutError'){
                    console.log('Get Balance Change: No balance change reported within 120 seconds');
                    // logError(err, "No balance change reported within 120 seconds")
                    subscription.unsubscribe();
                    resolve(balanceChangeStats)
                } else {
                    console.log("Get Balance Change: ERROR")
                    console.log(err)
                    subscription.unsubscribe()
                    resolve(balanceChangeStats)
                }
                
            },
            complete(){
                console.log('Get Balance Change: Balance change subscription completed for some reason');
                subscription.unsubscribe();
                resolve(balanceChangeStats)
            }
        });
        // Providing a way to unsubscribe from outside this function
        setUnsubscribeCallback(() => {
            console.log("Get Balance Change: Something went wrong. Unsubscribing from balance change observable")
            subscription.unsubscribe();
            resolve(balanceChangeStats)
        });
    });
    return balanceChangePromise
}
export async function getKsmBalancesAcrossChains(chopsticks: boolean){
    let ksmBalances = {
        0: 0,
        2000: 0,
        2001: 0,
        2023: 0,
        2085: 0,
        2090: 0,
        2110: 0
    }

    let asyncAdapters = []
    let chainIds = [0, 2000, 2001, 2023, 2085, 2090, 2110]
    let ksmBalancesPromise = chainIds.map(async (chainId) => {
        let account;
        if(chainId == 2023){
            account = await getSigner(chopsticks, true)
        } else {
            account = await getSigner(chopsticks, false)
        }
        console.log("Account Address: " + account.address)
        let chainNode: TNode | "Kusama" = chainId == 0 ? "Kusama" : getNodeFromChainId(chainId)
        let destAdapter = getAdapter(chainId)

        if(chainId == 2000){
            let rpc = chopsticks ? localRpcs["Karura"] : karRpc
            let provider = new WsProvider(rpc)
            let walletConfigs: WalletConfigs = {
                evmProvider: EvmRpcProvider.from(rpc),
                wsProvider: provider
            }
            let karApi = await ApiPromise.create({provider: provider})
            let adapterWallet = new Wallet(karApi, walletConfigs);
            await destAdapter.init(karApi, adapterWallet);
        } else {
            let api = await getApiForNode(chainNode, chopsticks)
            await destAdapter.init(api);
        }

        let tokenSymbol = "KSM"
        if(chainId == 2023 && !tokenSymbol.toUpperCase().startsWith("XC") && tokenSymbol.toUpperCase() != "MOVR"){
            console.log("Adding XC from token symbol")
            tokenSymbol = "xc" + tokenSymbol
        // if chain isnt movr, no prefix
        } else if(chainId != 2023 && tokenSymbol.toUpperCase().startsWith("XC")){
            console.log("Removing XC from token symbol")
            tokenSymbol = tokenSymbol.slice(2)
        }
        const balanceObservable = destAdapter.subscribeTokenBalance(tokenSymbol, account.address);
        let balance = await firstValueFrom(balanceObservable)
        ksmBalances[chainId] = balance.available.toNumber()
        asyncAdapters.push(destAdapter)
        return ksmBalances
    })
    await Promise.all(ksmBalancesPromise)
    let adapters = await Promise.all(asyncAdapters)

    // console.log("Disconnecting ksm balance adapters...")
    // await delay(3000)
    // for(let adapter of adapters){
    //     await adapter.getApi().disconnect()
    // }
    // console.log("Disconnected ksm balance adapters")
    // await delay(3000)
    return ksmBalances

}
export function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
export async function getBalance(paraId: number, chopsticks: boolean, chainApi: ApiPromise, assetSymbol: string, node: string, accountAddress: string): Promise<BalanceData>{


    console.log(`Get Token Balance for chain ${node} | Token ${assetSymbol}`)

    let destAdapter = getAdapter(paraId)
    let currentBalance: BalanceData;
    
    // Make sure api is connected
    console.log(`Get Token Balance: API connected: ${chainApi.isConnected}`)
    if(!chainApi.isConnected){
        console.log("Get Token Balance: API not connected. Connecting...")
        await chainApi.connect()
        console.log("Get Token Balance: API connected: " + chainApi.isConnected)
    }

    if(paraId == 2000){
        let rpcEndpoint = chopsticks ? localRpcs[node] : karRpc
        let walletConfigs: WalletConfigs = {
            evmProvider: EvmRpcProvider.from(rpcEndpoint),
            wsProvider: new WsProvider(rpcEndpoint)
        }
        let adapterWallet = new Wallet(chainApi, walletConfigs);
        await destAdapter.init(chainApi, adapterWallet);
    } else {
        await destAdapter.init(chainApi);
    }
    
    let tokenSymbol;
    if(paraId == 0){
        tokenSymbol = "KSM"
    } else {
        tokenSymbol = assetSymbol
    }

    console.log(`Get Token Balance: Watching chain ${node} | Token ${tokenSymbol} | Address ${accountAddress}`)

    if(paraId == 2023 && !tokenSymbol.toUpperCase().startsWith("XC") && tokenSymbol.toUpperCase() != "MOVR"){
        // console.log("Adding XC from token symbol")
        tokenSymbol = "xc" + tokenSymbol
    // if chain isnt movr, no prefix
    } else if(paraId != 2023 && tokenSymbol.toUpperCase().startsWith("XC")){
        // console.log("Removing XC from token symbol")
        tokenSymbol = tokenSymbol.slice(2)
    }

    const balanceObservable = destAdapter.subscribeTokenBalance(tokenSymbol, accountAddress);
    console.log("Get Token Balance: Subscribed to balance")
    let balance = await firstValueFrom(balanceObservable)
    console.log("Balance: " + JSON.stringify(balance.available.toNumber()))
    return balance
}

export async function getSigner(chopsticks: boolean, eth: boolean): Promise<KeyringPair>{
    let keyring;
    let key;

    
    if(chopsticks){
        // Get test accounts
        if(eth){
            const index = 0;
            let ethDerPath = `m/44'/60'/0'/0/${index}`;
            keyring = new Keyring({ type: 'ethereum' });
            return keyring.addFromUri(`${live_wallet_3}/${ethDerPath}`);
        } else {
            await cryptoWaitReady()
            keyring = new Keyring({
                type: "sr25519",
            });
            return keyring.addFromUri("//Alice");
        }
    } else {
        // Get live accounts
        if(eth){
            const index = 0;
            let ethDerPath = `m/44'/60'/0'/0/${index}`;
            keyring = new Keyring({ type: 'ethereum' });
            return keyring.addFromUri(`${live_wallet_3}/${ethDerPath}`);
        } else {
            await cryptoWaitReady()
            keyring = new Keyring({ type: 'sr25519' });
            return keyring.addFromMnemonic(arb_wallet)
        }


    }

    
    
}

export function increaseIndex(index: IndexObject) {
    index.i += 1;
}

export function printInstruction(instruction: SwapInstruction | TransferInstruction){
    if(instruction.type == InstructionType.Swap){
        // console.log("Swap Instruction: " + JSON.stringify(instruction))
        console.log(`${instruction.instructionIndex} SWAP chain: ${instruction.chain} ${JSON.stringify(instruction.assetInLocalId)} -> ${JSON.stringify(instruction.assetOutLocalId)}`)
    } else if(instruction.type == InstructionType.TransferToHomeThenDestination){
        // console.log("Transfer instruction")
        const nodes = instruction.assetNodes
        console.log(`${instruction.instructionIndex} TRANSFER ${instruction.startAssetNode.getAssetRegistrySymbol()} --- ${instruction.startNode} -> ${instruction.middleNode} -> ${instruction.destinationNode}`)
    } else {
        console.log(`${instruction.instructionIndex} TRANSFER ${instruction.startAssetNode.getAssetRegistrySymbol()} --- ${instruction.startNode} -> ${instruction.destinationNode}`)
    }
}

export function printExtrinsicSetResults(extrinsicSetResults: (SingleSwapResultData | SingleTransferResultData) []){
    extrinsicSetResults.forEach((resultData) => {
        console.log(resultData.success)
        console.log(JSON.stringify(resultData.arbExecutionResult, null, 2))
    })
}

export async function getLastSuccessfulNodeFromResultData(allExtrinsicResultData: (SingleSwapResultData | SingleTransferResultData) []){
    let lastSuccessfulResultData = allExtrinsicResultData[allExtrinsicResultData.length - 1]
    if(!lastSuccessfulResultData.success){
        if(allExtrinsicResultData.length > 1){
            lastSuccessfulResultData = allExtrinsicResultData[allExtrinsicResultData.length - 2]
            if(!lastSuccessfulResultData.success){
                console.log("No successful extrinsics")
            }
        } else {
            console.log("No successful extrinsics")
        }
    }
    return lastSuccessfulResultData.lastNode
}
export async function getLastNodeFromResultData(allExtrinsicResultData: (SingleSwapResultData | SingleTransferResultData) []){
    let lastSuccessfulResultData = allExtrinsicResultData[allExtrinsicResultData.length - 1]
    // if(!lastSuccessfulResultData.success){
    //     console.log("No successful extrinsics")
    // }
    return lastSuccessfulResultData.lastNode
}
export async function getLastSuccessfulNodeFromAllExtrinsics(allExtrinsicResultData: ExtrinsicSetResultDynamic []){
    let resultData: (SingleSwapResultData | SingleTransferResultData) [] = [];
    allExtrinsicResultData.forEach((extrinsicSetResult) => {
        extrinsicSetResult.extrinsicData.forEach((extrinsicData) => {
            resultData.push(extrinsicData)
        })
    })
    let lastSuccessfulResultData = resultData[resultData.length - 1]
    if(!lastSuccessfulResultData.success){
        if(resultData.length > 1){
            lastSuccessfulResultData = resultData[resultData.length - 2]
            if(!lastSuccessfulResultData.success){
                console.log("No successful extrinsics")
            }
        } else {
            console.log("No successful extrinsics")
        }
    }

    return lastSuccessfulResultData.lastNode
}
export function getLatestFileFromLatestDay(small: boolean) {
    
    const resultsDirPath = path.join(__dirname, '/../../../test2/arb-dot-2/arb_handler/result_log_data');
    try {
        let sortedDays
        let latestDayDir;
        let latestDayPath
        let days;
        if(small){
        // Get list of directories (days)
            days = fs.readdirSync(resultsDirPath, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name)
                .filter((day) => day.includes("_small"))
            sortedDays = days.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
            latestDayDir = sortedDays[sortedDays.length - 1]
            latestDayPath = path.join(resultsDirPath, latestDayDir);
        } else {
            days = fs.readdirSync(resultsDirPath, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name)
                .filter((day) => !day.includes("_small"))
            sortedDays = days.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
            // Get the latest day's directory
            console.log("Sorted days: ", JSON.stringify(days, null, 2))
    
            latestDayDir = sortedDays[0]
            latestDayPath = path.join(resultsDirPath, latestDayDir);
        }

        console.log("Days: ", JSON.stringify(days, null, 2))
        // Sort directories by date
        // const sortedDays = days.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
        // // Get the latest day's directory
        // console.log("Sorted days: ", JSON.stringify(days, null, 2))

        // const latestDayDir = sortedDays[sortedDays.length - 1]
        // const latestDayPath = path.join(resultsDirPath, latestDayDir);
        console.log("Latest Day Path: ", latestDayPath)
        // Get list of files in the latest day's directory
        const files = fs.readdirSync(latestDayPath);

        // Sort files by timestamp in filename
        const sortedFiles = files.sort((a, b) => {
            const timeA = a.match(/\d{2}-\d{2}-\d{2}/)[0].replace(/-/g, ':');
            const timeB = b.match(/\d{2}-\d{2}-\d{2}/)[0].replace(/-/g, ':');
            return new Date(`${latestDayDir}T${timeA}`).getTime() - new Date(`${latestDayDir}T${timeB}`).getTime();
        });

        // Get the latest file
        const latestFile = sortedFiles[sortedFiles.length - 1];
        const latestFilePath = path.join(latestDayPath, latestFile);

        return latestFilePath;
    } catch (error) {
        console.error('Error:', error);
        return null;
    }
}
export function getLatestTargetFile(){
      
    const resultsDirPath = path.join(__dirname, '/../../../test2/arb-dot-2/arb_handler/target_log_data');
    try {
        let sortedDays
        let latestDayDir;
        let latestDayPath
        let days;

        days = fs.readdirSync(resultsDirPath, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name)
            .filter((day) => !day.includes("_small"))
        sortedDays = days.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
        // Get the latest day's directory
        console.log("Sorted days: ", JSON.stringify(days, null, 2))

        latestDayDir = sortedDays[0]
        latestDayPath = path.join(resultsDirPath, latestDayDir);

        console.log("Days: ", JSON.stringify(days, null, 2))
        // Sort directories by date
        console.log("Latest Target Day Path: ", latestDayPath)
        // Get list of files in the latest day's directory
        const files = fs.readdirSync(latestDayPath);

        // Sort files by timestamp in filename
        const sortedFiles = files.sort((a, b) => {
            const timeA = a.match(/\d{2}-\d{2}-\d{2}/)[0].replace(/-/g, ':');
            const timeB = b.match(/\d{2}-\d{2}-\d{2}/)[0].replace(/-/g, ':');
            return new Date(`${latestDayDir}T${timeA}`).getTime() - new Date(`${latestDayDir}T${timeB}`).getTime();
        });

        // Get the latest file
        const latestFile = sortedFiles[sortedFiles.length - 1];
        const latestFilePath = path.join(latestDayPath, latestFile);

        return latestFilePath;
    } catch (error) {
        console.error('Error:', error);
        return null;
    }
}
export function constructRoute(logFilePath: string) {
    console.log("LatestFile: ", logFilePath)
    const testResults: ResultDataObject[] = JSON.parse(fs.readFileSync(logFilePath, 'utf8'));
    console.log(JSON.stringify(testResults))
    let assetPath: AssetNode[] = testResults.map(result => readLogData(result))
    return assetPath
}

// How much profit we got for latest arb
export async function getTotalArbResultAmount(lastSuccessfulNode: LastNode){
    let latestFilePath = path.join(__dirname, './latestAttempt/arbExecutionResults.json')
    let latestArbResults: ArbExecutionResult[] = JSON.parse(fs.readFileSync(latestFilePath, 'utf8'))
    let assetOut = latestArbResults[latestArbResults.length - 1].assetSymbolOut
    let arbAmountOut = 0;
    let arbAmountIn = latestArbResults[0].assetAmountIn;
    // if(assetOut == "KSM"){
    //     arbAmountOut = latestArbResults[latestArbResults.length - 1].assetAmountOut - arbAmountIn
    // }
    if(lastSuccessfulNode.assetSymbol == "KSM"){
        arbAmountOut = Number.parseFloat(lastSuccessfulNode.assetValue) - arbAmountIn
    }
    // getLastSuccessfulNodeFromResultData

    return arbAmountOut
}