import fs from 'fs'
import * as paraspell from '@paraspell/sdk'
// import { Observable } from 'rxjs'
// import { timeout } from 'rxjs/operators'
// import { WsProvider, ApiPromise, Keyring } from '@polkadot/api'
// import { FixedPointNumber } from '@acala-network/sdk-core'
// import { u8aToHex } from '@polkadot/util'
// import { EventRecord, Phase, Event, Hash } from '@polkadot/types/interfaces'
// import { ISubmittableResult, IU8a } from '@polkadot/types/types'
import { TNode, getAssetsObject, getNode } from '@paraspell/sdk'
// import { BalanceData, getAdapter } from '@polkawallet/bridge'
// import { exec, execSync, spawn, ChildProcess } from 'child_process';
import path from 'path';
// import { getAdapter } from './adapters'
import { firstValueFrom, combineLatest, map, Observable, race, EMPTY } from "rxjs";
// import { RegistryError } from '@polkadot/types/types/registry';
// import * as s from 'json-stringify-safe';
// import flatted from 'flatted';
// import { encodeAddress, decodeAddress } from "@polkadot/keyring";
// import { BalanceChangeStatue } from '../src/types';
// import {Mangata} from '@mangata-finance/sdk'
// import { wsLocalFrom, wsLocalDestination, assetSymbol, fromChain, toChain } from './testParams'
// import { u8aToHex } from '@polkadot/util';
// import { mnemonicToLegacySeed, hdEthereum } from '@polkadot/util-crypto';

import { MyAssetRegistryObject, MyAsset, ResultDataObject, ApiSet } from './types'
import { AssetNode } from './AssetNode'
import { allConnectionPromises, allConnections, observableApis, promiseApis } from './liveTest';
import { ApiPromise, ApiRx, WsProvider } from '@polkadot/api';
import { options } from '@acala-network/api';
import { prodParasKusama, prodParasKusamaCommon, prodRelayKusama } from '@polkadot/apps-config/endpoints';
// import { prodRelayKusama } from '@polkadot/apps-config'

const aliceAddress = "HNZata7iMYWmk5RvZRTiAsSDhV8366zq2YGb3tLH5Upf74F"



export function getParaspellChainName(chainId: number): TNode | "Kusama"{
    if(chainId == 0){
        return "Kusama"
    }
    let chain = paraspell.NODE_NAMES.find((node) => {
      return paraspell.getParaId(node) == chainId && paraspell.getRelayChainSymbol(node) == "KSM"  
    })
    return chain as TNode
}

export function getEndpointsForChain( chainId: number ) {
    let nodes = []

    if (chainId == 0) {
        nodes = Object.values(prodRelayKusama.providers).filter((e) =>
            e.startsWith("wss://")
        );
    } 
    else if (chainId == 1000) {
        nodes = Object.values(
            prodParasKusamaCommon.find((e) => e.paraId === chainId)?.providers ||
            {}
        ).filter((e) => e.startsWith("wss://"));
    } 
    else {
        nodes = Object.values(
            [...prodParasKusama].find(
            (e) => e.paraId === chainId
            )?.providers || {}
        ).filter((e) => e.startsWith("wss://"));
    }
    // nodes.push("wss://karura-rpc-0.aca-api.network")
    return nodes    
}

export const getAssetBySymbolOrId = (
    node: TNode,
    symbolOrId: string | number
  ): { symbol?: string; assetId?: string } | null => {
    const { otherAssets, nativeAssets, relayChainAssetSymbol } = getAssetsObject(node)

    
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
    let assetRegistry: MyAssetRegistryObject[] = JSON.parse(fs.readFileSync(path.join(__dirname, '../../allAssets.json'), 'utf8'));
    let asset = assetRegistry.find((assetRegistryObject: MyAssetRegistryObject) => {
        return assetRegistryObject.tokenData.chain == chainId && JSON.stringify(assetRegistryObject.tokenData.localId) == localId
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
    let chainId = jsonObject.node_key.slice(0,4)
    let assetLocalId = jsonObject.node_key.slice(4)
    
    let assetRegistryObject = getAssetRegistryObject(parseInt(chainId), assetLocalId)
    let assetSymbol = assetRegistryObject.tokenData.symbol

    let paraspellChainName = getParaspellChainName(parseInt(chainId))
    if(paraspellChainName == "Kusama"){
        let assetNode = new AssetNode({
            paraspellAsset: {symbol: assetSymbol},
            paraspellChain: paraspellChainName,
            assetRegistryObject: assetRegistryObject,
            pathValue: jsonObject.path_value
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
            pathValue: jsonObject.path_value
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

export async function connectFirstApi(endpointList: string[], chainId: number): Promise<ApiSet>{
    

    const apiPromisePending = connectFirstApiPromise(endpointList, chainId, allConnectionPromises);
    let apiObservable = await firstValueFrom(race(endpointList.map((endpoint) => connectFirstObservable(endpoint, chainId))));
    let apiPromise = await apiPromisePending;

    // if(!promiseApis[chainId] || !observableApis[chainId]){
    //     throw new Error("Failed to connect to chain")
    // }
    if(!apiPromise || !apiObservable){
        throw new Error("Failed to connect to chain")
    }

    let apiSet: ApiSet = {
        promise: apiPromise.winner,
        promiseEndpoint: apiPromise.endpoint,
        observable: apiObservable.api,
        observableEndpoint: apiObservable.endpoint
    }
    return apiSet
}

export function connectFirstApiPromise(endpointList: string[], chainId: number, allConnectionPromises: Map<string, Promise<ApiPromise>>): Promise<{winner: ApiPromise, endpoint: string} | null> {
    if(promiseApis[chainId]){
        return Promise.resolve(null)
    }
    // Map each endpoint to a Promise of ApiPromise connection
    const apiPromises = endpointList.map(endpoint => {
        const provider = new WsProvider(endpoint);
        console.log("Connecting to " + provider.endpoint)
        const isAcala = chainId === 2000
        const option = isAcala
        ? options({provider: provider }) : {provider: provider};

        // Store the Promise in the Map
        const promiseApi = ApiPromise.create(option).then(api => {
            allConnectionPromises.set(endpoint, Promise.resolve(api));
            allConnections.set(endpoint, api);
            return { api, endpoint }; // Resolve to an object with both the api and the endpoint
        });
        return promiseApi
    });
    // Use Promise.race to return the first ApiPromise that connects
    return Promise.race(apiPromises).then(({ api: winner, endpoint }) => {
        if(!promiseApis[chainId]){
            console.log("Reached connection on Api Promise: " + endpoint)
            promiseApis[chainId] = winner
        }

        // Logic to handle the winner and disconnect others
        allConnectionPromises.forEach((promise, endpoint) => {
            promise.then(api => {
                if (api !== winner) {
                    console.log(`Disconnecting from ${endpoint}`);
                    api.disconnect();
                }
            });
        });
        return {winner, endpoint};
    });
}

export function connectFirstObservable(endpoint: string, chainId: number): Observable<{api: ApiRx, endpoint: string} | null>{
    // If connection to chain already exists, give up
    if(observableApis[chainId]){
        return EMPTY
    }
    const provider = new WsProvider(endpoint);
    console.log("Connecting to observable ---" + provider.endpoint)
    const isAcala = chainId === 2000
    const option = isAcala
    ? options({provider: provider }) : {provider: provider};
    // const promiseApi = ApiPromise.create(option);

    return ApiRx.create(option).pipe(
        map((api) => {
            // connect success
            if (api) {
                if (!observableApis[chainId]) {
                    console.log("Reached connection on observable" + provider.endpoint)
                    observableApis[chainId] = api;
                    return {api, endpoint};
                } else {
                    console.log("Observable already connected. Disconnecting from observable" + provider.endpoint)
                    api.disconnect();
                    return null
                }
            }
            return null;
        })
    );
}