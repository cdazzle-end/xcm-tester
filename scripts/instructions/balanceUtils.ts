import fs from 'fs'
import { BalanceData, getAdapter } from '@polkawallet/bridge';
import { TNode } from '@paraspell/sdk'
import { firstValueFrom, Observable, timeout } from "rxjs";
import { MyAssetRegistryObject, Relay } from './types.ts'
import { ApiPromise, WsProvider } from '@polkadot/api';
import { TransferrableAssetObject, BalanceChangeStats } from './types.ts'
import { FixedPointNumber} from "@acala-network/sdk-core";
import { acaRpc, karRpc, localRpcs } from './txConsts.ts';
import {EvmRpcProvider} from '@acala-network/eth-providers';
import { Wallet } from '@acala-network/sdk/wallet/wallet.js';
import { WalletConfigs } from '@acala-network/sdk/wallet/index.js';
import { getSigner, getNodeFromChainId } from './utils.ts';
import { getApiForNode } from './apiUtils.ts';

export async function watchTokenDeposit(relay: Relay, paraId: number, chopsticks: boolean, destChainApi: ApiPromise, transferrableAssetObject: TransferrableAssetObject, depositAddress: string){
    let tokenSymbol: string;
    if(paraId == 0){
        tokenSymbol = relay == 'kusama' ? "KSM" : "DOT"
    } else if(!transferrableAssetObject.paraspellAsset.symbol){
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

    let validatedTokenSymbol = getBalanceAdapterSymbol(paraId, tokenSymbol, transferrableAssetObject.assetRegistryObject, relay)
    const balanceObservable = destAdapter.subscribeTokenBalance(validatedTokenSymbol, depositAddress);
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
export async function watchTokenBalance(relay: Relay, paraId: number, chopsticks: boolean, chainApi: ApiPromise, assetSymbol: string, assetObject: MyAssetRegistryObject, node: string, accountAddress: string){
    // printAndLogToFile("Initiating balance adapter for destination chain " + paraId + " on port " + destPort )
    let tokenSymbol;
    if(paraId == 0){
        tokenSymbol = relay == 'kusama' ? "KSM" : "DOT"
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
    
    // printAndLogToFile("Subscribing to balance for destination chain " + paraId + " for asset " + transferrableAssetObject.paraspellAssetSymbol.symbol + " for address " + aliceAddress)
    
    // if(node == "Moonriver" && tokenSymbol.toUpperCase().startsWith("XC")){
    //     console.log("Removing XC from token symbol")
    //     tokenSymbol = tokenSymbol.slice(2)
    // }
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

    let validatedTokenSymbol = getBalanceAdapterSymbol(paraId, tokenSymbol, assetObject, relay)
    const balanceObservable = destAdapter.subscribeTokenBalance(validatedTokenSymbol, accountAddress);
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
export async function getBalanceChainAsset(chopsticks: boolean, relay: Relay, chainId: number, assetSymbol: string){
    let account = await getSigner(chopsticks, false)

    let chainNode: TNode | "Kusama" | "Polkadot";
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
    // let validatedTokenSymbol = getBalanceAdapterSymbol(chainId, tokenSymbol, relay)
    const balanceObservable = chainAdapter.subscribeTokenBalance(tokenSymbol, account.address);
    let balance = await firstValueFrom(balanceObservable)
    
    return balance
    // nativeBalances[chainId] = balance.available.toNumber()
    // asyncAdapters.push(chainAdapter)

}
export async function getNativeBalanceAcrossChains(chopsticks: boolean, relay: Relay){
    let nativeBalances = relay === 'kusama' ? 
    {
        0: 0,
        2000: 0,
        2001: 0,
        2023: 0,
        2085: 0,
        2090: 0,
        2110: 0
    } : {
        0: 0,
        2000: 0,
        2030: 0,
        2034: 0,
        2004: 0,
        2012: 0
    }

    let asyncAdapters = []
    let chainIds = relay === "kusama" ? [0, 2000, 2001, 2023, 2085, 2090, 2110] : [0, 2000, 2030, 2034, 2004, 2012]
    let nativeBalancesPromise = chainIds.map(async (chainId) => {
        let account;
        if(relay == 'kusama' && chainId == 2023 || relay == 'polkadot' && chainId == 2004){ // MOVR or GLMR
            account = await getSigner(chopsticks, true)
        } else {
            account = await getSigner(chopsticks, false)
        }
        console.log("Account Address: " + account.address)
        let chainNode: TNode | "Kusama" | "Polkadot";
        if(relay === "kusama"){
            chainNode = chainId == 0 ? "Kusama" : getNodeFromChainId(chainId, relay)
        } else if (relay === "polkadot"){
            chainNode = chainId == 0 ? "Polkadot" : getNodeFromChainId(chainId, relay)
        } else {
            throw new Error("Invalid relay")
        }


        // let chainNode: TNode | "Kusama"  = chainId == 0 ? "Kusama" : getNodeFromChainId(chainId)
        let destAdapter = getAdapter(relay, chainId)

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
            await destAdapter.init(karApi, adapterWallet);
        } else {
            let api = await getApiForNode(chainNode, chopsticks)
            await destAdapter.init(api);
        }

        let tokenSymbol = relay === "kusama" ? "KSM" : "DOT"
        if(relay == 'kusama' && chainId == 2023 && !tokenSymbol.toUpperCase().startsWith("XC") && tokenSymbol.toUpperCase() != "MOVR"){
            console.log("Adding XC from token symbol")
            tokenSymbol = "xc" + tokenSymbol
        // if chain isnt movr, no prefix
        } else if(relay == 'kusama' && chainId != 2023 && tokenSymbol.toUpperCase().startsWith("XC")){
            console.log("Removing XC from token symbol")
            tokenSymbol = tokenSymbol.slice(2)
        }

        if(relay == 'polkadot' &&  chainId == 2004 && !tokenSymbol.toUpperCase().startsWith("XC") && tokenSymbol.toUpperCase() != "GLMR"){
            console.log("Adding XC from token symbol")
            tokenSymbol = "xc" + tokenSymbol
        // if chain isnt movr, no prefix
        } else if(relay == 'polkadot' && chainId != 2004 && tokenSymbol.toUpperCase().startsWith("XC")){
            console.log("Removing XC from token symbol")
            tokenSymbol = tokenSymbol.slice(2)
        }

        const balanceObservable = destAdapter.subscribeTokenBalance(tokenSymbol, account.address);
        let balance = await firstValueFrom(balanceObservable)
        nativeBalances[chainId] = balance.available.toNumber()
        asyncAdapters.push(destAdapter)
        return nativeBalances
    })
    await Promise.all(nativeBalancesPromise)

    return nativeBalances

}

export async function getBalance(paraId: number, relay: Relay, chopsticks: boolean, chainApi: ApiPromise, assetSymbol: string, assetObject: MyAssetRegistryObject, node: string, accountAddress: string): Promise<BalanceData>{


    console.log(`Get Token Balance for chain ${node} | Token ${assetSymbol}`)

    let destAdapter = getAdapter(relay, paraId)
    console.log('Para ID: ', paraId)
    let currentBalance: BalanceData;
    
    // Make sure api is connected
    console.log(`Get Token Balance: API connected: ${chainApi.isConnected}`)
    if(!chainApi.isConnected){
        console.log("Get Token Balance: API not connected. Connecting...")
        await chainApi.connect()
        console.log("Get Token Balance: API connected: " + chainApi.isConnected)
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
        tokenSymbol = assetSymbol
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

    let validatedTokenSymbol = getBalanceAdapterSymbol(paraId, tokenSymbol, assetObject, relay)
    const balanceObservable = destAdapter.subscribeTokenBalance(validatedTokenSymbol, accountAddress);
    console.log("Get Token Balance: Subscribed to balance")
    let balance = await firstValueFrom(balanceObservable)
    console.log("Balance: " + JSON.stringify(balance.available.toNumber()))
    return balance
}

// TEMP until we smooth out paraspell and balance adapter indexes
// VALIDATE symbol used for balance adapter, adjust for know symbol collisions
function getBalanceAdapterSymbol(chainId: number, tokenSymbol: string, assetObject: MyAssetRegistryObject, relay: Relay){
    let localId = assetObject.tokenData.localId
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