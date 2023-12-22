import { timeout } from 'rxjs/operators'
import { WsProvider, ApiPromise } from '@polkadot/api'
import { EventRecord, Hash } from '@polkadot/types/interfaces'
import { BalanceData, getAdapter } from '@polkawallet/bridge'
import { IU8a } from '@polkadot/types/types'
import { wsLocalFrom, wsLocalDestination, assetSymbol, fromChain, toChain } from './testParams'
import { getNode, getParaId } from '@paraspell/sdk'
import { options } from '@acala-network/api'
import { BaseSDK } from '@acala-network/sdk'
import { AnyApi } from '@acala-network/sdk-core'
import {  } from '@acala-network/sdk-core'

const aliceAddress = "HNZata7iMYWmk5RvZRTiAsSDhV8366zq2YGb3tLH5Upf74F"
const aliceErc20 = "0xf24FF3a9CF04c71Dbc94D0b566f7A27B94566cac"
let scriptPid: string | null = null;
let chopsticksPid: string | null = null;

type TxDetails = {
    success: boolean;
    hash: IU8a,
    included: EventRecord[];
    finalized: EventRecord[];
    blockHash: string;
    txHash: Hash;
    txIndex?: number;
}

async function watchTokenDeposit(){
    // let toChainNode = getNode(toChain)
    let fromChainId = getParaId(toChain)
    let localProvider = new WsProvider("ws://172.26.130.75:8001")
    let localApi = new ApiPromise({provider: localProvider});
    let destinationChainAdapter = getAdapter(fromChainId);
    await destinationChainAdapter.init(localApi);
    // const provider = new WsProvider("wss://karura.api.onfinality.io/public-ws");
    // const api = new ApiPromise(options({ provider }));
    // await api.isReadyOrError;

    let balanceObservable$ = destinationChainAdapter.subscribeTokenBalance("KINT", aliceAddress);

    let balanceChangePromise = new Promise<boolean>((resolve, reject) => {
        let currentBalance: BalanceData;
        const subscription = balanceObservable$.pipe(timeout(1200000)).subscribe({
            next(balance) {
                
                if(currentBalance){
                    console.log("Balance changed *****")
                    let changeInBalance = balance.free.toNumber() - currentBalance.free.toNumber();
                    // currentBalance = balance;
                    console.log(`Change in Balance: ${changeInBalance}`);
                    console.log(`New Balance: ${balance.free.toNumber()}`);
                    subscription.unsubscribe();
                    
                    resolve(true)
                } else {
                    
                    currentBalance = balance;
                    console.log(`Current Balance: ${balance.free.toNumber()}`);
                    // logToFile("Original Balance: " + balance.free.toNumber().toString())
                }
            },
            error(err) {
                if(err.name == 'TimeoutError'){
                    console.log('No balance change reported within 120 seconds');
                    subscription.unsubscribe();
                    resolve(false)
                } else {
                    console.log("ERROR")
                    console.log(err)
                    subscription.unsubscribe()
                    resolve(false)
                }
            },
            complete(){
                console.log('Balance change subscription completed for some reason');
                subscription.unsubscribe();
                resolve(false)
            }
        });
    })

    return {balanceChangePromise, localApi};
}

async function run(){
    // await watchTokenDeposit();
    let {balanceChangePromise, localApi} = await watchTokenDeposit();
    const balanceChange = await balanceChangePromise;
    console.log(balanceChange)
    if (localApi.isConnected) await localApi.disconnect()

}
run()