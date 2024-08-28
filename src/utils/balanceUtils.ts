import fs from 'fs'
import { AcalaAdapter, AltairAdapter, AstarAdapter, BalanceData, BasiliskAdapter, BifrostAdapter, BifrostPolkadotAdapter, CalamariAdapter, CentrifugeAdapter, CrabAdapter, CrustAdapter, DarwiniaAdapter, HeikoAdapter, HydraDxAdapter, IntegriteeAdapter, InterlayAdapter, InvarchAdapter, KaruraAdapter, KhalaAdapter, KicoAdapter, KiltAdapter, KintsugiAdapter, KusamaAdapter, ListenAdapter, MangataAdapter, MantaAdapter, MoonbeamAdapter, MoonriverAdapter, NodleAdapter, OakAdapter, ParallelAdapter, PendulumAdapter, PhalaAdapter, PichiuAdapter, PolkadotAdapter, QuartzAdapter, RobonomicsAdapter, ShadowAdapter, ShidenAdapter, StatemineAdapter, StatemintAdapter, SubsocialAdapter, TinkernetAdapter, TuringAdapter, UniqueAdapter, ZeitgeistAdapter, getAdapter } from '@polkawallet/bridge';
import { TNode } from '@paraspell/sdk'
import { firstValueFrom, Observable, timeout } from "rxjs";
import { BalanceChangeStatsBn, IMyAsset, NativeBalancesType, Relay, BalanceChangeStats, PNode  } from './../types/types.ts'
import { ApiPromise, WsProvider } from '@polkadot/api';
// import { TransferrableAssetObject, BalanceChangeStats } from './../types/types.ts'
import { FixedPointNumber} from "@acala-network/sdk-core";
import { acaRpc, karRpc, localRpcs } from '../config/txConsts.ts';
import {EvmRpcProvider} from '@acala-network/eth-providers';
import { Wallet } from '@acala-network/sdk/wallet/wallet.js';
import { WalletConfigs } from '@acala-network/sdk/wallet/index.js';
import { getSigner, getNodeFromChainId, delay, getAssetRegistryObjectBySymbol } from './utils.ts';
import { getApiForNode } from './apiUtils.ts';
// import { balanceAdapterMap } from './liveTest.ts';
import bn from "bignumber.js"
import { MyAsset } from '../core/index.ts';
bn.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 }) // Set to max precision

const balanceAdapterMap: Map<PNode, BalanceAdapter> = new Map<TNode, BalanceAdapter>();

export type BalanceAdapter = StatemintAdapter | StatemineAdapter | AcalaAdapter | KaruraAdapter | AstarAdapter | ShidenAdapter | BifrostAdapter | BifrostPolkadotAdapter | CrabAdapter | DarwiniaAdapter | AltairAdapter | CentrifugeAdapter | ShadowAdapter | CrustAdapter | BasiliskAdapter | HydraDxAdapter | PolkadotAdapter | KusamaAdapter | IntegriteeAdapter | InterlayAdapter | KintsugiAdapter | KicoAdapter | PichiuAdapter | ListenAdapter | MangataAdapter | CalamariAdapter | MantaAdapter | MoonbeamAdapter | MoonriverAdapter | KhalaAdapter | PhalaAdapter | TuringAdapter | OakAdapter | HeikoAdapter | ParallelAdapter | RobonomicsAdapter | TinkernetAdapter | InvarchAdapter | QuartzAdapter | UniqueAdapter | ZeitgeistAdapter | SubsocialAdapter | NodleAdapter | PendulumAdapter | KiltAdapter;
// ***
// Used in executeSingleTransferExtrinsic
export async function watchTokenDeposit(relay: Relay, paraId: number, chopsticks: boolean, destChainApi: ApiPromise, asset: MyAsset, depositAddress: string){
    // let tokenSymbol: string = transferrableAssetObject.assetRegistryObject.tokenData.symbol 
    let tokenSymbol = asset.getSymbol()

    console.log(`Watch Token Deposit: Source Chain Name ${asset.getChainNode()} | Token Symbol ${tokenSymbol} | Deposit Address ${depositAddress} `)

    // Make sure api is conencted
    console.log(`Watch Token Deposit: API connected: ${destChainApi.isConnected}`)
    if(!destChainApi.isConnected){
        console.log("Watch Token Deposit: API not connected. Connecting...")
        await destChainApi.connect()
        console.log("Watch Token Deposit: API connected: " + destChainApi.isConnected)
    }

    let destAdapter = getAdapter(relay, paraId)
    let currentBalance: BalanceData;
    if(paraId == 2000){
        // let evmProvider: EvmRpcProvider = new EvmRpcProvider("ws://172.26.130.75:8008")
        let rpcEndpoint = chopsticks ?
            relay == 'kusama' ? localRpcs["Karura"] : localRpcs["Acala"]
            : relay == 'kusama' ? karRpc : acaRpc

        // let rpcEndpoint = chopsticks ? localRpcs["Karura"] : karRpc
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
    const assetId = asset.getLocalId()
    const balanceObservable = destAdapter.subscribeTokenBalance(validatedTokenSymbol, depositAddress, assetId);
    console.log("Watch Token Deposit: Subscribed to balance")
    return new Observable<BalanceData>((subscriber) => {
        const subscription = balanceObservable.subscribe({
            next(balance) {
                if(currentBalance){
                    subscriber.next(balance);
                    subscriber.complete();
                    console.log("Watch Token Deposit: Token deposit complete")
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
    node: string, 
    accountAddress: string
): Promise<Observable<BalanceData>>{
    // printAndLogToFile("Initiating balance adapter for destination chain " + paraId + " on port " + destPort )
    let tokenSymbol;
    if(paraId == 0){
        tokenSymbol = relay == 'kusama' ? "KSM" : "DOT"
    } else {
        tokenSymbol = asset.getSymbol()
    }

    console.log(`Watch Token Balance: Watching chain ${node} | Token ${tokenSymbol} | Address ${accountAddress}`)

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
            rpcEndpoint = chopsticks ? localRpcs[node] : karRpc
        } else [
            rpcEndpoint = chopsticks ? localRpcs[node] : acaRpc
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
export async function getBalanceChange(
    balanceObservable$: Observable<BalanceData>,
    setUnsubscribeCallback: (unsubscribe: () => void) => void
  ): Promise<BalanceChangeStatsBn> {
    console.log("Get Balance Change: waiting for balance change")
    let currentBalance: BalanceData;
    let balanceChangeStats: BalanceChangeStatsBn = {
        startBalance: new bn(0),
        endBalance: new bn(0),
        changeInBalance: new bn(0),
        startBalanceDisplay: "0",
        endBalanceDisplay: "0",
        changeInBalanceDisplay: "0"
    }
    const balanceChangePromise = new Promise<BalanceChangeStatsBn>((resolve, reject) => {
        const subscription = balanceObservable$.pipe(timeout(120000)).subscribe({
            next(balance) {
                if(currentBalance){
                    let decimals = balance.free.getPrecision()
                    let startBalance = currentBalance.free._getInner()
                    let endBalance = balance.free._getInner()        
                    let changeInBalance = endBalance.minus(startBalance).abs()
            
                    let startBalanceDisplay = getDisplayBalance(startBalance, decimals)
                    let endBalanceDisplay = getDisplayBalance(endBalance, decimals)
                    let changeInBalanceDisplay = getDisplayBalance(changeInBalance, decimals)
                    // console.log(`Get Balance Change: Previous Balance: ${currentBalance.free} | New Balance: ${balance.free} | Change in Balance: ${changeInBalance}`)
                    // console.log(`Asset decimals: ${decimals}`)
                    // console.log(`Start Balance: ${startBalance.toString()} | End Balance: ${endBalance.toString()} | Change in Balance: ${changeInBalance.toString()}`)
                    console.log(`Start Balance Display: ${startBalanceDisplay.toString()} | End Balance Display: ${endBalanceDisplay.toString()} | Change in Balance Display: ${changeInBalanceDisplay.toString()}`)
                    balanceChangeStats = {
                        startBalance,
                        endBalance,
                        changeInBalance,
                        startBalanceDisplay: startBalanceDisplay.toString(),
                        endBalanceDisplay: endBalanceDisplay.toString(),
                        changeInBalanceDisplay: changeInBalanceDisplay.toString(),
                        decimals
                    }
                    subscription.unsubscribe();
                    resolve(balanceChangeStats)
                } else {
                    balanceChangeStats.startBalance = balance.free._getInner()
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

// Used in getRelayTokenBalanceAcrossChains, getRelayTokenBalances, allocateKsmFromPreTransferPaths
export async function getBalanceChainAsset(chopsticks: boolean, relay: Relay, node: PNode, chainId: number, assetSymbol: string, assetId: string): Promise<BalanceData>{
    let evm = node == "Moonbeam" || node == "Moonriver" ? true : false
    let account = await getSigner(chopsticks, evm)

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

// *** Not used
export async function getRelayTokenBalanceAcrossChains(chopsticks: boolean, relay: Relay){
    let nativeBalances: NativeBalancesType = relay === 'kusama' ? 
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

    let chainIds = Object.keys(nativeBalances)
    let asyncAdapters = []

    // Something errs when querying the relay chain at the same time
    let nativeBalancesPromise = chainIds.map(async (chainKey) => {
        let account;
        let chainId = Number.parseInt(chainKey)
        if (chainId != 0){
            if(relay == 'kusama' && chainId == 2023 || relay == 'polkadot' && chainId == 2004){ // MOVR or GLMR
                account = await getSigner(chopsticks, true)
            } else {
                account = await getSigner(chopsticks, false)
            }
            console.log("Account Address: " + account.address)
            let chainNode: PNode;
            if(relay === "kusama"){
                chainNode = chainId == 0 ? "Kusama" : getNodeFromChainId(chainId, relay)
            } else if (relay === "polkadot"){
                chainNode = chainId == 0 ? "Polkadot" : getNodeFromChainId(chainId, relay)
            } else {
                throw new Error("Invalid relay")
            }
    
            let destAdapter = getAdapter(relay, chainId)
    
            if(chainId == 2000){
                let rpc;
                if(relay === 'kusama'){
                    rpc = chopsticks ? localRpcs["Karura"] : karRpc
                } else {
                    rpc = chopsticks ? localRpcs["Acala"] : acaRpc
                }
                let provider = new WsProvider(rpc)
                let walletConfigs: WalletConfigs = {
                    evmProvider: EvmRpcProvider.from(rpc),
                    wsProvider: provider
                }
                // let karApi = await ApiPromise.create({provider: provider})
                let karApi = await getApiForNode(chainNode, chopsticks)
                let adapterWallet = new Wallet(karApi, walletConfigs);
                await destAdapter.init(karApi, adapterWallet);
            } else {
                let api = await getApiForNode(chainNode, chopsticks)
                await destAdapter.init(api);
            }
    
    
            let tokenSymbol = relay === "kusama" ? "KSM" : "DOT"
    
            if(relay == 'kusama' && chainId == 2023 || relay == 'polkadot' && chainId == 2004){
                // console.log("Adding XC to token symbol")
                tokenSymbol = "xc" + tokenSymbol
            }
    
            // REVIEW Getting relay asset object by symbol, might cause issues? Chains like moonbeam might have other assets w the symbol of DOT or KSM
            const assetId = getAssetRegistryObjectBySymbol(chainId, tokenSymbol, relay).tokenData.localId
            const balanceObservable = destAdapter.subscribeTokenBalance(tokenSymbol, account.address, assetId);
            console.log("Delaying for 5")
            await delay(5000)
            let balance = await firstValueFrom(balanceObservable)
            nativeBalances[chainId] = balance.available.toString()
            console.log(`Balance for chain ${chainId}: ${balance.available.toString()}`)
            // asyncAdapters.push(destAdapter)
    
            console.log("Closing balance adapter for: " + chainId)
            // await destAdapter.getApi().disconnect()
            
            return nativeBalances
        }

    })
    // console.log("Delaying for 10 seconds")
    // await delay(10000)
    await Promise.all(nativeBalancesPromise)

    // REVIEW Getting relay asset 

    let dotBalance = await getBalanceChainAsset(chopsticks, relay, "Polkadot", 0, "DOT", "DOT")
    console.log("relay chain dot balance: " + dotBalance.available.toString())
    nativeBalances[0] = dotBalance.available.toString()

    return nativeBalances

}

// Used in checkAndAllocateRelayToken, allocateFundsForSwap
export async function getRelayTokenBalances(chopsticks: boolean, relay: Relay){
    console.log("Getting native balances")
    let nativeBalances: NativeBalancesType = relay === 'kusama' ? 
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

    let relayToken = relay === 'kusama' ? "KSM" : "DOT"



    let chainIds = Object.keys(nativeBalances)
    let nativeBalancesPromise = chainIds.map(async (chainKey) => {
        let chainId = Number.parseInt(chainKey)
        // if (chainId != 0){
            let node = getNodeFromChainId(Number.parseInt(chainKey), relay)
            // REVIEW Getting asset object by symbol, might cause issues? Chains like moonbeam might have other assets w the symbol of DOT or KSM
            let relayAssetId = getAssetRegistryObjectBySymbol(chainId, relayToken, relay).tokenData.localId
            let chainBalance = await getBalanceChainAsset(chopsticks, relay, node, chainId, relayToken, relayAssetId)
            nativeBalances[chainId] = chainBalance.available.toString()    
        // }
    })
    await Promise.all(nativeBalancesPromise)
    return nativeBalances
        
}

// Used in getBalanceChainAsset
export async function getRelayChainBalance(chopsticks: boolean, relay: Relay){
    let relayNode = getNodeFromChainId(0, relay)
    let relayApi = await getApiForNode(relayNode, chopsticks)
    let relayTokenDecimals = relay === 'kusama' ? 12 : 10

    let signer = await getSigner(chopsticks, false)

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
export async function getBalance(paraId: number, relay: Relay, chopsticks: boolean, chainApi: ApiPromise, asset: MyAsset, node: string, accountAddress: string): Promise<BalanceData>{


    console.log(`Get Token Balance for chain ${node} | Token ${asset.getSymbol()}`)

    let destAdapter = getAdapter(relay, paraId)
    
    // Make sure api is connected
    if(!chainApi.isConnected){
        await chainApi.connect()
    }

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

    return balance
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

// Take balance and decimals, return displayable balance
export function getDisplayBalance(balance: bn, decimals: number): string {
    return balance.shiftedBy(-decimals).toFixed(decimals);
}

export function getBalanceFromDisplay(displayBalance: bn, decimals: number): bn {
    return displayBalance.shiftedBy(decimals)
}