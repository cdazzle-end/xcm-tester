
import { firstValueFrom, combineLatest, map, Observable, race, EMPTY, timeout } from "rxjs";
import * as paraspell from "@paraspell/sdk";
import { ApiSet } from './types.ts'
import { ApiPromise, ApiRx, WsProvider } from '@polkadot/api';
import { options } from '@acala-network/api/dist/index.js';
import { prodParasKusama, prodParasKusamaCommon, prodRelayKusama } from '@polkadot/apps-config/endpoints';
import { TNode } from "@paraspell/sdk";
import { dotRpc, ksmRpc, localRpcs } from "./txConsts.ts";
// import { apiMap } from "./liveTest.ts";

const apiMap: Map<TNode | "Kusama" | "Polkadot", ApiPromise> = new Map<TNode, ApiPromise>();
const allConnectionPromises = new Map<string, Promise<ApiPromise>>();
const allConnections = new Map<string, ApiPromise>();
const promiseApis: Record<number, ApiPromise> = {};
const observableApis: Record<number, ApiRx> = {};

// Keep a map of all connections. If a connection to a chain already exists, return it
// POLKADOT_ASSETS HAS THE SAME FUNCTION
export async function getApiForNode(node: TNode | "Kusama" | "Polkadot", chopsticks: boolean): Promise<ApiPromise>{
    let map = apiMap

    console.log("**********************************************")
    console.log("Checking for existing api for node: ", node)
    if(map.has(node)){
        console.log("Returning existing api for node: ", node)
        return map.get(node) as ApiPromise
    }

    console.log("No existing api for node: ", node)
    console.log("**********************************************")

    let apiEndpoint: string[];
    console.log("Get api for node: ", node)
    if(node == "Kusama"){
        apiEndpoint = [ksmRpc]
        // throw new Error("Trying to transfer kusama away from home chain to kusama")
    } else if (node == "Polkadot") {
        apiEndpoint = [dotRpc]
    } else if(node == "CrustShadow"){
        apiEndpoint = ["wss://rpc2-shadow.crust.network"]
    } else if (node == "Parallel") {
        // apiEndpoint = ['wss://rpc.parallel.fi']
        // apiEndpoint = ["wss://parallel.api.onfinality.io/public-ws"]
        apiEndpoint = ["wss://parallel-rpc.dwellir.com"]
    } else{
        apiEndpoint = paraspell.getAllNodeProviders(node)
    }
    
    // -- But initialize test endpoints until real
    if(chopsticks){
        let localRpc = localRpcs[node]
        if(localRpc){
            apiEndpoint = [localRpc]
        }
    }
    console.log("Node RPC: ", apiEndpoint[0])
    let api: ApiPromise | undefined;
    let apiConnected = false;
    if(node == "Mangata"){
        try{
            const MangataSDK = await import('@mangata-finance/sdk')
            api = await MangataSDK.Mangata.instance([apiEndpoint[0]]).api()
            await api.isReady
            if(api.isConnected) {
                console.log("API is connected: TRUE")
            } else {
                console.log("API is connected: FALSE")
                await api.connect()
                console.log("API now connected")
            }
            apiConnected = true;
            
        } catch(e){
            console.log(`Error connecting mangata api ${apiEndpoint[0]}, trying next endpoint`)
            const MangataSDK = await import('@mangata-finance/sdk')
            api = await MangataSDK.Mangata.instance([apiEndpoint[1]]).api()
            await api.isReady
            if(api.isConnected) {
                console.log("API is connected: TRUE")
            } else {
                console.log("API is connected: FALSE")
                await api.connect()
                console.log("API now connected")
            }
            apiConnected = true;
        }
    } else {
        let endpointIndex = 0;
        if(node == "Moonbeam" && !chopsticks){
            endpointIndex = 1 // Currently the working endpoint for moonbeam
        }
        while(endpointIndex < apiEndpoint.length && !apiConnected){
            console.log("Connecting to api: ", apiEndpoint[endpointIndex])
            try{
                console.log("Trying connect")
                let provider = new WsProvider(apiEndpoint[endpointIndex])
                console.log("Provider set")
                api = await ApiPromise.create({ provider: provider });
                console.log("Api initialized")
                await api.isReady
                
                console.log("API is ready: TRUE")
                if(api.isConnected) {
                    console.log("API is connected: TRUE")
                } else {
                    console.log("API is connected: FALSE")
                    await api.connect()
                    console.log("API now connected")
                }
                apiConnected = true;
            } catch (e) {
                console.log(`Error connecting api ${apiEndpoint[endpointIndex]}, trying next endpoint`)  
            }
            endpointIndex++
        }
    }

    if(!apiConnected || !api){
        throw new Error("Could not connect to api")
    }

    map.set(node, api)
    console.log("Returning api for node: ", node)
    return api
}

export async function closeApis(){
    console.log("Close out all APIs")
    let apiClosePromises: Promise<void>[] = [];
    apiMap.forEach((api, node) => {
        console.log("Disconnecting from node: ", node)
        apiClosePromises.push(api.disconnect())
    })
    await Promise.all(apiClosePromises)
}

export function getEndpointsForChain( chainId: number ) {
    let nodes: string[] = []

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