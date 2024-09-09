import fs from 'fs'
import { AcalaAdapter, AltairAdapter, AstarAdapter, BalanceData, BasiliskAdapter, BifrostAdapter, BifrostPolkadotAdapter, CalamariAdapter, CentrifugeAdapter, CrabAdapter, CrustAdapter, DarwiniaAdapter, HeikoAdapter, HydraDxAdapter, IntegriteeAdapter, InterlayAdapter, InvarchAdapter, KaruraAdapter, KhalaAdapter, KicoAdapter, KiltAdapter, KintsugiAdapter, KusamaAdapter, ListenAdapter, MangataAdapter, MantaAdapter, MoonbeamAdapter, MoonriverAdapter, NodleAdapter, OakAdapter, ParallelAdapter, PendulumAdapter, PhalaAdapter, PichiuAdapter, PolkadotAdapter, QuartzAdapter, RobonomicsAdapter, ShadowAdapter, ShidenAdapter, StatemineAdapter, StatemintAdapter, SubsocialAdapter, TinkernetAdapter, TuringAdapter, UniqueAdapter, ZeitgeistAdapter, getAdapter } from '@polkawallet/bridge';
import { TNode } from '@paraspell/sdk'
import { firstValueFrom, Observable, timeout } from "rxjs";
import { BalanceChange, IMyAsset, RelayTokenBalances, Relay, PNode, BalanceDataBN  } from './../types/types.ts'
import { ApiPromise, WsProvider } from '@polkadot/api';
// import { TransferrableAssetObject, BalanceChangeStats } from './../types/types.ts'
import { FixedPointNumber} from "@acala-network/sdk-core";
import { acaRpc, karRpc, localRpcs } from '../config/txConsts.ts';
import {EvmRpcProvider} from '@acala-network/eth-providers';
import { Wallet } from '@acala-network/sdk/wallet/wallet.js';
import { WalletConfigs } from '@acala-network/sdk/wallet/index.js';
import { getSigner, getNodeFromChainId, delay, getMyAssetBySymbol } from './utils.ts';
import { getApiForNode } from './apiUtils.ts';
// import { balanceAdapterMap } from './liveTest.ts';
import bn from "bignumber.js"
import { MyAsset } from '../core/index.ts';
import { getChainIdFromNode, getRelayTokenSymbol, stateGetRelayTokenBalances, stateSetRelayTokenBalances } from './index.ts';
bn.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 }) // Set to max precision

const balanceAdapterMap: Map<PNode, BalanceAdapter> = new Map<TNode, BalanceAdapter>();

export type BalanceAdapter = StatemintAdapter | StatemineAdapter | AcalaAdapter | KaruraAdapter | AstarAdapter | ShidenAdapter | BifrostAdapter | BifrostPolkadotAdapter | CrabAdapter | DarwiniaAdapter | AltairAdapter | CentrifugeAdapter | ShadowAdapter | CrustAdapter | BasiliskAdapter | HydraDxAdapter | PolkadotAdapter | KusamaAdapter | IntegriteeAdapter | InterlayAdapter | KintsugiAdapter | KicoAdapter | PichiuAdapter | ListenAdapter | MangataAdapter | CalamariAdapter | MantaAdapter | MoonbeamAdapter | MoonriverAdapter | KhalaAdapter | PhalaAdapter | TuringAdapter | OakAdapter | HeikoAdapter | ParallelAdapter | RobonomicsAdapter | TinkernetAdapter | InvarchAdapter | QuartzAdapter | UniqueAdapter | ZeitgeistAdapter | SubsocialAdapter | NodleAdapter | PendulumAdapter | KiltAdapter;

/**
 * Query the balance of an asset, confirm balance change
 * 
 * If balance has not changed, return null
 * 
 * return BalanceChange
 * 
 * @param startBalance 
 * @param paraId 
 * @param relay 
 * @param chopsticks 
 * @param api 
 * @param asset 
 * @param address 
 * @returns 
 */
export async function manualCheckBalanceChange(
    startBalance: bn,
    relay: Relay, 
    chopsticks: boolean, 
    api: ApiPromise, 
    asset: MyAsset, 
    address: string
): Promise<BalanceChange | null>{
    console.log("Manual Check Balance Change. Querying balance...")
    let currentBalance: bn = await getBalance(relay, chopsticks, api, asset, address)
    console.log(`Current Balance: ${currentBalance.toString()}`)

    let changeInBalance = currentBalance.minus(startBalance).abs()
    if(changeInBalance.gt(new bn(0))){
        console.log("Queried balance and found change. Returning balance change...")

        let balanceChange: BalanceChange = {
            startBalance: startBalance,
            endBalance: currentBalance,
            changeInBalance: changeInBalance,
            decimals: asset.getDecimals()
        }
        return balanceChange
        
    }  else {
        console.log("BALANCE QUERIED AND NO CHANGE IN BALANCE, returning null...")
        return null
    }
}

/**
 * Initiate observable to watch balance of asset on specified chain (watchTokenBalanceChange)
 * 
 * Make observable into promise that will resolve when balance changes
 * 
 * @return Promise (BalanceChange) absolute value
 * 
 * @param relay 
 * @param chopsticks 
 * @param destChainApi 
 * @param asset 
 * @param depositAddress 
 * @param setUnsubscribeCallback 
 * @returns 
 */
export async function transferWatchBalanceChange(
    relay: Relay, 
    chopsticks: boolean, 
    destChainApi: ApiPromise, 
    asset: MyAsset, 
    depositAddress: string,
    setUnsubscribeCallback: (unsubscribe: () => void) => void // New parameter
): Promise<BalanceChange> {
    let paraId = asset.getChainId()
    let balanceObservable$ = await watchTokenBalanceChange(relay, paraId, chopsticks, destChainApi, asset, depositAddress);
    let balanceChange = getBalanceChange(balanceObservable$, (unsubscribe) => {
        setUnsubscribeCallback(unsubscribe); // Set the unsubscribe function
    });
    return balanceChange
}

// ***
/**
 * Used for transfer extrinsic to setup observable to watch balance change on specified chain for given asset
 * - Watch token withdraw or deposit
 * - Observable will output current balance, and the next available balance after updating, then complete
 * 
 * @param relay 
 * @param paraId 
 * @param chopsticks 
 * @param chainApi 
 * @param asset 
 * @param address 
 * @returns 
 */
export async function watchTokenBalanceChange(relay: Relay, paraId: number, chopsticks: boolean, chainApi: ApiPromise, asset: MyAsset, address: string){
    // let tokenSymbol: string = transferrableAssetObject.assetRegistryObject.tokenData.symbol 
    let tokenSymbol = asset.getSymbol()

    let chain = getNodeFromChainId(paraId, relay)

    console.log(`Watch Token Balance Change: Chain ${asset.getChainNode()} | Symbol ${tokenSymbol} | Address ${address} `)

    // Make sure api is conencted
    if(!chainApi.isConnected){
        console.log("Watch Token Balance Change: API not connected. Connecting...")
        await chainApi.connect()
        console.log("Watch Token Balance Change: API connected: " + chainApi.isConnected)
    }

    let balanceAdapter = getAdapter(relay, paraId)
    let currentBalance: BalanceData;
    if(chain === "Karura" || chain === "Acala"){
        // let evmProvider: EvmRpcProvider = new EvmRpcProvider("ws://172.26.130.75:8008")
        let rpcEndpoint = chopsticks ? localRpcs[chain]
            : relay == 'kusama' ? karRpc : acaRpc

        // let rpcEndpoint = chopsticks ? localRpcs["Karura"] : karRpc
        let walletConfigs: WalletConfigs = {
            evmProvider: EvmRpcProvider.from(rpcEndpoint),
            wsProvider: new WsProvider(rpcEndpoint)
        }
        let adapterWallet = new Wallet(chainApi, walletConfigs);
        await balanceAdapter.init(chainApi, adapterWallet);
    } else {
        await balanceAdapter.init(chainApi);
    }

    //REVIEW Since using our asset regigstry, symbol will be properly formatted
    
    // If chain is movr, make sure tokens have xc prefix
    // if(destinationChain == "Moonriver" && !tokenSymbol.toUpperCase().startsWith("XC") && tokenSymbol.toUpperCase() != "MOVR"
    // || destinationChain == "Moonbeam" && !tokenSymbol.toUpperCase().startsWith("XC") && tokenSymbol.toUpperCase() != "GLMR"){
    //     // console.log("Adding XC from token symbol")
    //     tokenSymbol = "xc" + tokenSymbol
    // // if chain isnt movr, no prefix
    // } else if(relay == 'kusama' && paraId != 2023 && tokenSymbol.toUpperCase().startsWith("XC")
    // || relay == 'polkadot' && paraId != 2004 && tokenSymbol.toUpperCase().startsWith("XC")){
    //     // console.log("Removing XC from token symbol")
    //     tokenSymbol = tokenSymbol.slice(2)
    // }

    const balanceObservable = balanceAdapter.subscribeTokenBalance(tokenSymbol, address, asset.getLocalId());
    return new Observable<BalanceData>((subscriber) => {
        const subscription = balanceObservable.subscribe({
            next(balance) {
                if(currentBalance){
                    subscriber.next(balance);
                    subscriber.complete();
                    console.log(`Watch Token Balance Change: ${asset.getChainNode()} ${tokenSymbol} Observable completed `)
                    // destAdapter.getApi().disconnect()
                } else {
                    currentBalance = balance;
                    subscriber.next(balance);
                }
            },
            error(err) {
                subscriber.error(new Error(err));
                subscriber.complete(); // Complete the outer Observable on error
                // destAdapter.getApi().disconnect()
            },
            complete() {
                subscriber.complete(); // Complete the outer Observable when the inner one completes
                // destAdapter.getApi().disconnect()
            }
        });
        return () => {
            subscription.unsubscribe();
            // destAdapter.getApi().disconnect()
        };
    })
}
// ***
// Used in executeSingleSwapExtrinsicMovr, executeSingleSwapExtrinsicGlmr, executeSingleSwapExtrinsic, execitPreTransfers
export async function watchTokenBalance(
    relay: Relay, 
    paraId: number, 
    chopsticks: boolean, 
    chainApi: ApiPromise, 
    asset: MyAsset,
    accountAddress: string
): Promise<Observable<BalanceData>>{
    // printAndLogToFile("Initiating balance adapter for destination chain " + paraId + " on port " + destPort )
    let chain = getNodeFromChainId(paraId, relay)
    let tokenSymbol;
    if(paraId == 0){
        tokenSymbol = relay == 'kusama' ? "KSM" : "DOT"
    } else {
        tokenSymbol = asset.getSymbol()
    }

    console.log(`Watch Token Balance: Watching chain ${chain} | Token ${tokenSymbol} | Address ${accountAddress}`)

    // Make sure api is connected
    console.log(`Watch Token Balance: API connected: ${chainApi.isConnected}`)
    if(!chainApi.isConnected){
        console.log("Watch Token Balance: API not connected. Connecting...")
        await chainApi.connect()
        console.log("Watch Token Balance: API connected: " + chainApi.isConnected)
    }

    let destAdapter = getAdapter(relay, paraId)
    let currentBalance: BalanceData;

    
    if(relay == 'kusama' && paraId == 2000 || relay == 'polkadot' && paraId == 2000){
        let rpcEndpoint
        if(relay == 'kusama'){
            rpcEndpoint = chopsticks ? localRpcs[chain] : karRpc
        } else [
            rpcEndpoint = chopsticks ? localRpcs[chain] : acaRpc
        ]
        
        let walletConfigs: WalletConfigs = {
            evmProvider: EvmRpcProvider.from(rpcEndpoint),
            wsProvider: new WsProvider(rpcEndpoint)
        }
        let adapterWallet = new Wallet(chainApi, walletConfigs);
        await destAdapter.init(chainApi, adapterWallet);
    } else {
        await destAdapter.init(chainApi);
    }
    
    if(relay == 'kusama' && paraId == 2023 && !tokenSymbol.toUpperCase().startsWith("XC") && tokenSymbol.toUpperCase() != "MOVR"
    || relay == 'polkadot' && paraId == 2004 && !tokenSymbol.toUpperCase().startsWith("XC") && tokenSymbol.toUpperCase() != "GLMR"){
        console.log("Adding XC from token symbol")
        tokenSymbol = "xc" + tokenSymbol
    // if chain isnt movr, no prefix
    } else if(relay == 'kusama' && paraId != 2023 && tokenSymbol.toUpperCase().startsWith("XC")
    || relay == 'polkadot' && paraId != 2004 && tokenSymbol.toUpperCase().startsWith("XC")){
        console.log("Removing XC from token symbol")
        tokenSymbol = tokenSymbol.slice(2)
    }

    let validatedTokenSymbol = getBalanceAdapterSymbol(paraId, tokenSymbol, asset, relay)
    const assetId = asset.getLocalId()
    const balanceObservable = destAdapter.subscribeTokenBalance(validatedTokenSymbol, accountAddress, assetId);
    console.log("Watch Token Balance: Subscribed to balance")
    // console.log(chainApi.registry.chainTokens)
    // console.log(destAdapter.getTokens())
    return new Observable<BalanceData>((subscriber) => {
        const subscription = balanceObservable.subscribe({
            next(balance) {
                if(currentBalance){
                    subscriber.next(balance);
                    subscriber.complete();
                    // destAdapter.getApi().disconnect()
                    console.log("Watch Token Balance: Observable complete")
                } else {
                    currentBalance = balance;
                    subscriber.next(balance);
                }
            },
            error(err) {
                subscriber.error(new Error(err));
                subscriber.complete(); // Complete the outer Observable on error
                // destAdapter.getApi().disconnect()
            },
            complete() {
                subscriber.complete(); // Complete the outer Observable when the inner one completes
                // destAdapter.getApi().disconnect()
            }
        });
        return () => {
            subscription.unsubscribe();
            // destAdapter.getApi().disconnect()
        };
    })

    
}

// Used  on balance adapter observable
// Used in executeSingleTransferExtrinsic, executeSingleSwapExtrinsicMovr, executeSingleSwapExtrinsicGlmr, executeSingleSwapExtrinsic, execitPreTransfers
/**
 * Create promise that will resolve when balance changes
 * - Observable outputs balance data
 * - When observable outputs second balance data, create BalanceChange 
 * - Takes absolute value of difference between 2 balances
 * - On error, resolve with 0 balance change. Start balance will be set to first balance data if recieved
 * 
 * Returns Promise<BalanceChange> which resolves when BalanceChange is created
 * 
 * @param balanceObservable$ 
 * @param setUnsubscribeCallback 
 * @returns Promise <BalanceChange>
 */
export async function getBalanceChange(
    balanceObservable$: Observable<BalanceData>,
    setUnsubscribeCallback: (unsubscribe: () => void) => void
  ): Promise<BalanceChange> {
    console.log("Get Balance Change: waiting for balance change")
    let currentBalance: BalanceData;
    let balanceChange: BalanceChange = {
        startBalance: new bn(0),
        endBalance: new bn(0),
        changeInBalance: new bn(0),
        decimals: 0
    }
    const balanceChangePromise = new Promise<BalanceChange>((resolve, reject) => {
        const subscription = balanceObservable$.pipe(timeout(120000)).subscribe({
            next(newBalance) {
                
                // Set current balance, or create balance change object
                if(!currentBalance){
                    currentBalance = newBalance;
                    balanceChange.startBalance = currentBalance.free._getInner();
                    console.log(`Get Balance Change: Current Balance: ${newBalance.free}`);
                } else {

                    // Take difference between 2 balances (absolute value)
                    balanceChange = {
                        startBalance: currentBalance.free._getInner(),
                        endBalance: newBalance.free._getInner(),
                        changeInBalance: newBalance.free._getInner().minus(currentBalance.free._getInner()).abs(),
                        decimals: newBalance.free.getPrecision()
                    }
                    subscription.unsubscribe();
                    resolve(balanceChange)
                }
            },
            
            error(err) {
                if(err.name == 'TimeoutError'){
                    console.log('Get Balance Change: No balance change reported within 120 seconds');
                    // logError(err, "No balance change reported within 120 seconds")
                    subscription.unsubscribe();
                    resolve(balanceChange)
                } else {
                    console.log("Get Balance Change: ERROR")
                    console.log(err)
                    subscription.unsubscribe()
                    resolve(balanceChange)
                }
                
            },
            complete(){
                console.log('Get Balance Change: Balance change subscription completed for some reason');
                subscription.unsubscribe();
                resolve(balanceChange)
            }
        });
        // Providing a way to unsubscribe from outside this function
        setUnsubscribeCallback(() => {
            console.log("Get Balance Change: Something went wrong. Unsubscribing from balance change observable")
            subscription.unsubscribe();
            resolve(balanceChange)
        });
    });
    return balanceChangePromise
}

// Used in getRelayTokenBalanceAcrossChains, getRelayTokenBalances, allocateKsmFromPreTransferPaths
export async function getBalanceChainAsset(chopsticks: boolean, relay: Relay, node: PNode, chainId: number, assetSymbol: string, assetId: string): Promise<BalanceData>{
    // let evm = node == "Moonbeam" || node == "Moonriver" ? true : false
    let account = await getSigner(chopsticks, node)

    console.log(`Get balance chain asset: ${chainId} ${assetSymbol} ${assetSymbol}`)

    if(chainId == 0){
        let relayBalance = await getRelayChainBalance(chopsticks, relay)
        let tokenDecimals = relay == 'kusama' ? 12 : 10
        let relayBalanceData: BalanceData = {
            available: new FixedPointNumber(relayBalance, tokenDecimals),
            reserved: new FixedPointNumber("0", tokenDecimals),
            free: new FixedPointNumber(relayBalance, tokenDecimals),
            locked: new FixedPointNumber("0", tokenDecimals)
        }
        return relayBalanceData
    }

    let chainNode: PNode;
    if(relay === "kusama"){
        chainNode = chainId == 0 ? "Kusama" : getNodeFromChainId(chainId, relay)
    } else if (relay === "polkadot"){
        chainNode = chainId == 0 ? "Polkadot" : getNodeFromChainId(chainId, relay)
    } else {
        throw new Error("Invalid relay")
    }
    let chainAdapter = getAdapter(relay, chainId)

    if(chainId == 2000){
        let rpc;
        if(relay === 'kusama'){
            rpc = chopsticks ? localRpcs["Karura"] : karRpc
        } else {
            rpc = chopsticks ? localRpcs["Acala"] : karRpc
        }
        let provider = new WsProvider(rpc)
        let walletConfigs: WalletConfigs = {
            evmProvider: EvmRpcProvider.from(rpc),
            wsProvider: provider
        }
        let karApi = await ApiPromise.create({provider: provider})
        let adapterWallet = new Wallet(karApi, walletConfigs);
        await chainAdapter.init(karApi, adapterWallet);
    } else {
        console.log(`Get Balance Chain Asset -- getApiForNode ${chainNode} -- ${chopsticks}`)
        let api = await getApiForNode(chainNode, chopsticks)
        await chainAdapter.init(api);
    }

    let tokenSymbol = assetSymbol
    if(chainId == 2023 && !tokenSymbol.toUpperCase().startsWith("XC") && tokenSymbol.toUpperCase() != "MOVR"){
        console.log("Adding XC from token symbol")
        tokenSymbol = "xc" + tokenSymbol
    // if chain isnt movr, no prefix
    } else if(chainId != 2023 && tokenSymbol.toUpperCase().startsWith("XC")){
        console.log("Removing XC from token symbol")
        tokenSymbol = tokenSymbol.slice(2)
    }

    if(chainId == 2004 && !tokenSymbol.toUpperCase().startsWith("XC") && tokenSymbol.toUpperCase() != "GLMR"){
        console.log("Adding XC from token symbol")
        tokenSymbol = "xc" + tokenSymbol
    // if chain isnt movr, no prefix
    } else if(chainId != 2023 && tokenSymbol.toUpperCase().startsWith("XC")){
        console.log("Removing XC from token symbol")
        tokenSymbol = tokenSymbol.slice(2)
    }
    const balanceObservable = chainAdapter.subscribeTokenBalance(tokenSymbol, account.address, assetId);
    let balance = await firstValueFrom(balanceObservable)

    
    return balance

}

// Used in checkAndAllocateRelayToken, allocateFundsForSwap
/**
 * Query each chain for balance of relay token
 * 
 * @param chopsticks 
 * @param relay 
 * @returns 
 */
export async function queryRelayTokenBalances(chopsticks: boolean, relay: Relay): Promise<RelayTokenBalances>{
    console.log("Getting native balances")
    let nativeBalances: RelayTokenBalances = relay === 'kusama' ? 
    {
        0: "0",
        2000: "0",
        2001: "0",
        2023: "0",
        2085: "0",
        2090: "0",
        2110: "0"
    } : {
        0: "0",
        2000: "0",
        2030: "0",
        2034: "0",
        2004: "0",
        2012: "0"
    }

    let relayToken = getRelayTokenSymbol(relay)
    


    let chainIds = Object.keys(nativeBalances)
    let nativeBalancesPromise = chainIds.map(async (chainKey) => {
        let chainId = Number.parseInt(chainKey)
        // if (chainId != 0){
            let node = getNodeFromChainId(Number.parseInt(chainKey), relay)
            // REVIEW Getting asset object by symbol, might cause issues? Chains like moonbeam might have other assets w the symbol of DOT or KSM
            let relayAsset: MyAsset = new MyAsset(getMyAssetBySymbol(chainId, relayToken, relay))
            // let chainBalance = await getBalanceChainAsset(chopsticks, relay, node, chainId, relayToken, relayAssetId)
            let signer = await getSigner(chopsticks, node)

            let api = await getApiForNode(node, chopsticks);
            let chainBalance: bn = await getBalance(relay, chopsticks, api, relayAsset, signer.address)
            nativeBalances[chainId] = chainBalance.toString()    
        // }
    })
    await Promise.all(nativeBalancesPromise)
    return nativeBalances
}

// export function getRelayAssetOnChain(chain: PNode, ): MyAsset{
//     let chainId = getChainIdFromNode(chain);
//     getMyAssetBySymbol(chainId)
// }

/**
 * Makes multiple attempts to call getRelayTokenBalances()
 * - Query may fail, so we can try multiple times
 * 
 * @param chopsticks 
 * @param relay 
 */
export async function attemptQueryRelayTokenBalances(chopsticks: boolean, relay: Relay): Promise<RelayTokenBalances>{
    let attempts = 0;
    while(attempts < 5){
        try{
            const nativeBalances = await queryRelayTokenBalances(chopsticks, relay)
            console.log(`Queried balances successfully. Returning balances: ${JSON.stringify(nativeBalances, null, 2)}`)
            stateSetRelayTokenBalances(nativeBalances)
            return nativeBalances
        } catch (e){
            attempts++
            console.log(`Relay Token balances query failed. Trying again. | ${JSON.stringify(e, null, 2)}`)
        }
    }
    throw new Error("Failed to query relay token balances.")
}

/**
 * Return relayTokenBalances, or query if not set yet
 * 
 * @param chopsticks 
 * @param relay 
 */
export async function getRelayTokenBalances(chopsticks: boolean, relay: Relay): Promise<RelayTokenBalances> {
    const relayTokenBalances: Readonly<RelayTokenBalances | null> = stateGetRelayTokenBalances()

    return relayTokenBalances === null ? attemptQueryRelayTokenBalances(chopsticks, relay) : relayTokenBalances
}

// Used in getBalanceChainAsset
export async function getRelayChainBalance(chopsticks: boolean, relay: Relay){
    let relayNode = getNodeFromChainId(0, relay)
    let relayApi = await getApiForNode(relayNode, chopsticks)
    let relayTokenDecimals = relay === 'kusama' ? 12 : 10

    let signer = await getSigner(chopsticks, relayNode)

    let balance = await relayApi.query.system.account(signer.address)
    let balanceBn: bn = new bn(balance.data.free.toString())
    let balanceFormatted = balanceBn.div(new bn(10).pow(relayTokenDecimals)).toString()

    return balanceFormatted
}

// *** Not used
export async function getBalanceAdapter(relay: Relay, api: ApiPromise, chainId: number, node: PNode){
    // let map = balanceAdapterMap
    if(balanceAdapterMap.has(node)){
        console.log(`Adapter for ${node} already exists`)
        return balanceAdapterMap.get(node)
    }

    console.log(`Creating adapter for ${node}`)
    let chainAdapter = getAdapter(relay, chainId)
    await chainAdapter.init(api)
    balanceAdapterMap.set(node, chainAdapter)
    return chainAdapter
}

// Gets current balance
// Used in executeSingleTransferExtrinsic, executeSingleSwapExtrinsicMovr, executeSingleSwapExtrinsicGlmr, executeSingleSwapExtrinsic, execitPreTransfers
/**
 * Query current balance of an asset for address on specified chain
 * 
 * Main balance query function
 * 
 * Use balance adapter
 * 
 * @param relay 
 * @param chopsticks 
 * @param chainApi 
 * @param asset 
 * @param accountAddress 
 * @returns 
 */
export async function getBalance(
    relay: Relay, 
    chopsticks: boolean, 
    chainApi: ApiPromise, 
    asset: MyAsset,  
    accountAddress: string
): Promise<bn>{
    let paraId = asset.getChainId()
    let chain = getNodeFromChainId(paraId, relay)
    console.log(`Get Token Balance for chain ${chain} | Token ${asset.getSymbol()}`)

    let destAdapter = getAdapter(relay, paraId)
    
    // Make sure api is connected
    if(!chainApi.isConnected){
        await chainApi.connect()
    }

    if(relay == 'kusama' && paraId == 2000){
        let rpcEndpoint = chopsticks ? localRpcs[chain] : karRpc
        let walletConfigs: WalletConfigs = {
            evmProvider: EvmRpcProvider.from(rpcEndpoint),
            wsProvider: new WsProvider(rpcEndpoint)
        }
        let adapterWallet = new Wallet(chainApi, walletConfigs);
        await destAdapter.init(chainApi, adapterWallet);
    } else if(relay == 'polkadot' && paraId == 2000){
        let rpcEndpoint = chopsticks ? localRpcs[chain] : acaRpc
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
        tokenSymbol = relay === 'kusama' ? "KSM" : "DOT"
    } else {
        tokenSymbol = asset.getSymbol()
    }
    console.log(`Get Token Balance: Watching chain ${chain} | Token ${tokenSymbol} | Address ${accountAddress}`)

    if(relay == "kusama" && paraId == 2023 && !tokenSymbol.toUpperCase().startsWith("XC") && tokenSymbol.toUpperCase() != "MOVR"
    || relay == "polkadot" && paraId == 2004 && !tokenSymbol.toUpperCase().startsWith("XC") && tokenSymbol.toUpperCase() != "GLMR"){
        tokenSymbol = "xc" + tokenSymbol
    // if chain isnt movr, no prefix
    } else if(relay == 'kusama' && paraId != 2023 && tokenSymbol.toUpperCase().startsWith("XC")
    || relay == 'polkadot' && paraId != 2004 && tokenSymbol.toUpperCase().startsWith("XC")){
        tokenSymbol = tokenSymbol.slice(2)
    }

    let validatedTokenSymbol = getBalanceAdapterSymbol(paraId, tokenSymbol, asset, relay)
    const tokenId = asset.getLocalId()
    const balanceObservable = destAdapter.subscribeTokenBalance(validatedTokenSymbol, accountAddress, tokenId);
    console.log("Get Token Balance: Subscribed to balance")
    let balance = await firstValueFrom(balanceObservable)
    console.log("Balance: " + JSON.stringify(balance.available.toNumber()))

    return formatBalanceData(balance)
}

function formatBalanceData(data: BalanceData): bn{
    let balance = (data.free as any).inner
    return new bn(balance)
}

// Call this where ever calling getBalance()
export async function getBalanceFromId(
    paraId: number, 
    relay: Relay, 
    chopsticks: boolean, 
    chainApi: ApiPromise,
    asset: MyAsset, 
    node: string, 
    accountAddress: string
){
    console.log(`Get Token Balance for chain ${node} | Token ${asset.getSymbol()}`)

    let destAdapter = getAdapter(relay, paraId)
    
    // Make sure api is connected
    if(!chainApi.isConnected){
        await chainApi.connect()
    }

    // Acala/Karura have unique balance utils
    if(relay == 'kusama' && paraId == 2000){
        let rpcEndpoint = chopsticks ? localRpcs[node] : karRpc
        let walletConfigs: WalletConfigs = {
            evmProvider: EvmRpcProvider.from(rpcEndpoint),
            wsProvider: new WsProvider(rpcEndpoint)
        }
        let adapterWallet = new Wallet(chainApi, walletConfigs);
        await destAdapter.init(chainApi, adapterWallet);
    } else if(relay == 'polkadot' && paraId == 2000){
        let rpcEndpoint = chopsticks ? localRpcs[node] : acaRpc
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
        tokenSymbol = relay === 'kusama' ? "KSM" : "DOT"
    } else {
        tokenSymbol = asset.getSymbol()
    }

    console.log(`Get Token Balance: Watching chain ${node} | Token ${tokenSymbol} | Address ${accountAddress}`)

    if(relay == "kusama" && paraId == 2023 && !tokenSymbol.toUpperCase().startsWith("XC") && tokenSymbol.toUpperCase() != "MOVR"
    || relay == "polkadot" && paraId == 2004 && !tokenSymbol.toUpperCase().startsWith("XC") && tokenSymbol.toUpperCase() != "GLMR"){
        // console.log("Adding XC from token symbol")
        tokenSymbol = "xc" + tokenSymbol
    // if chain isnt movr, no prefix
    } else if(relay == 'kusama' && paraId != 2023 && tokenSymbol.toUpperCase().startsWith("XC")
    || relay == 'polkadot' && paraId != 2004 && tokenSymbol.toUpperCase().startsWith("XC")){
        // console.log("Removing XC from token symbol")
        tokenSymbol = tokenSymbol.slice(2)
    }

    let validatedTokenSymbol = getBalanceAdapterSymbol(paraId, tokenSymbol, asset, relay)
    const balanceObservable = destAdapter.subscribeTokenBalance(validatedTokenSymbol, accountAddress, asset.getLocalId());
    console.log("Get Token Balance: Subscribed to balance")
    let balance = await firstValueFrom(balanceObservable)
    console.log("Balance: " + JSON.stringify(balance.available.toNumber()))

    // await destAdapter.getApi().disconnect()
    return balance
}

// REMOVE
// TEMP until we smooth out paraspell and balance adapter indexes
// VALIDATE symbol used for balance adapter, adjust for know symbol collisions
function getBalanceAdapterSymbol(chainId: number, tokenSymbol: string, asset: MyAsset, relay: Relay){
    let localId = asset.getLocalId()
    let validatedSymbol = tokenSymbol
    if(relay == 'kusama'){
    } else {
        if(chainId == 2034) { // HydraDx
            if(localId == "4") {
                return "AWWETH" // acala worm weth
            }
            if(localId == "20"){
                return "MWWETH"
            }
            if(localId == "20"){
                return "MWWETH"
            }
            if(localId == "19"){
                return "MWWBTC"
            }
            if(localId == "3"){
                return "AWWBTC"
            }
            if(localId == "10"){
                return "SUSDT"
            }
            if(localId == "23"){
                return "MWUSDT"
            }
            if(localId == "7"){
                return "AWUSDC"
            }
            if(localId == "21"){
                return "MWUSDC"
            }
            if(localId == "2"){
                return "AWDAI"
            }
            if(localId == "18"){
                return "MWDAI"
            }
            if(localId == "10"){
                return "SUSDT"
            }
            if(localId == "22"){
                return "SUSDC"
            }
            if(localId == "10"){
                return "SUSDT"
            }
            if(localId == "100"){
                return "100"
            }
            if(localId == "101"){
                return "101"
            }
            if(localId == "102"){
                return "102"
            }

        }

    }
    return validatedSymbol
}

/**
 *  Take balance in chain format, convert to display format
 * - Input balance can be bn or string
 * 
 * Will shift decimal places to the left by specified decimals parameter
 * 
 * @param balance 
 * @param decimals 
 * @returns 
 */
export function getDisplayBalance(balance: bn | string, decimals: number): string {
    let balanceBN: bn = new bn(balance)
    

    return balanceBN.shiftedBy(-decimals).toFixed(decimals);
}

export function balanceChangeDisplay(balanceChange: BalanceChange){
    return getDisplayBalance(balanceChange.changeInBalance, balanceChange.decimals)
}

/**
 * Takes an amount in display format and converts it to chain format
 * - if amount is passed in as a string, it will be converted to a bn
 * 
 * Shifts decimal place over by specified decimals parameter
 * 
 * @param displayBalance 
 * @param decimals 
 * @returns 
 */
export function getBalanceFromDisplay(displayBalance: bn | string, decimals: number): bn {
    let balanceBN: bn;
    
    if (typeof displayBalance === 'string') {
        balanceBN = new bn(displayBalance);
    } else if (displayBalance instanceof bn) {
        balanceBN = displayBalance;
    } else {
        throw new Error('Invalid input type for displayBalance');
    }

    return balanceBN.shiftedBy(decimals).integerValue();
}