// import { firstValueFrom } from "rxjs";
// import {BifrostAdapter} from '@polkawallet/bridge/adapters/bifrost'
import { BifrostAdapter } from "@polkawallet/bridge";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { BalanceData } from '@polkawallet/bridge';

const aliceAddress = "HNZata7iMYWmk5RvZRTiAsSDhV8366zq2YGb3tLH5Upf74F"

async function testAdapters(){
    let bfAdapter = new BifrostAdapter();
    let provider = new WsProvider("ws://172.26.130.75:8009")
    let bfApi = new ApiPromise({provider});

    let currentBalance: BalanceData;

    await bfAdapter.init(bfApi);
    const balanceObservable = bfAdapter.subscribeTokenBalance("KAR", aliceAddress);

    balanceObservable.subscribe((balance) => {
        if(currentBalance){
            let changeInBalance = balance.free.toNumber() - currentBalance.free.toNumber();
            currentBalance = balance;
            console.log(`Change in Balance: ${changeInBalance}`);
            console.log(`New Balance: ${balance.free.toNumber()}`);
        } else {
            currentBalance = balance;
            console.log(`Current Balance: ${balance.free.toNumber()}`);
        }
    });
}

async function run(){
    await testAdapters();
}

run()