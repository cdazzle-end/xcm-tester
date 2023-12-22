import { WsProvider, ApiPromise } from '@polkadot/api'
import { getAdapter } from '@polkawallet/bridge'
import {  getParaId } from '@paraspell/sdk'

async function watchTokenDeposit(){
    let toChainId = getParaId("Moonriver")
    let localProvider = new WsProvider("ws://172.26.130.75:8000")
    let localApi = new ApiPromise({provider: localProvider});
    let destinationChainAdapter = getAdapter(toChainId);
    await destinationChainAdapter.init(localApi);
}

async function run(){
    await watchTokenDeposit();
}
run()