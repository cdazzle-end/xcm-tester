import { RegistryError } from '@polkadot/types/types/registry';
// import * as s from 'json-stringify-safe';
import flatted from 'flatted';
import { encodeAddress, decodeAddress } from "@polkadot/keyring";
import { BalanceChangeStatue } from '../../src/types';
import {Mangata} from '@mangata-finance/sdk'
import { wsLocalFrom, wsLocalDestination, assetSymbol, fromChain, toChain } from '../xcm_tests/testParams'
// import { u8aToHex } from '@polkadot/util';
import { mnemonicToLegacySeed, hdEthereum } from '@polkadot/util-crypto';
// const { ApiPromise } = require('@polkadot/api');
// const { WsProvider } = require('@polkadot/rpc-provider');
import { options } from '@acala-network/api';
// import { SwapPromise } from "@acala-network/sdk-swap";
import { WalletPromise } from "@acala-network/sdk-wallet";
import {cryptoWaitReady} from "@polkadot/util-crypto"
import { FixedPointNumber, Token } from "@acala-network/sdk-core";
import { Wallet,  } from "@acala-network/sdk"
import { AcalaDex, AggregateDex } from "@acala-network/sdk-swap"
import { AggregateDexSwapParams } from '@acala-network/sdk-swap/types'
import { TradeRouter, PoolService, Router, BigNumber } from "@galacticcouncil/sdk"
import { ApiPromise, Keyring, WsProvider } from '@polkadot/api';

import '@galacticcouncil/api-augment/hydradx';
import '@galacticcouncil/api-augment/basilisk';
import { ZERO, INFINITY, ONE } from '@galacticcouncil/sdk';
import { SubmittableExtrinsic } from '@polkadot/api/promise/types';

const niceEndpoint = 'wss://rpc.nice.hydration.cloud'
const wsLocalChain = "ws://172.26.130.75:8000"

async function getSwapTx(startAssetSymbol: string, destAssetSymbol: string, assetInAmount: number){
    const provider = new WsProvider(wsLocalChain);
    const api = new ApiPromise({ provider });
    await api.isReady;
    const poolService = new PoolService(api);
    const router = new TradeRouter(poolService);

    let allAssets = await router.getAllAssets()
    console.log(JSON.stringify(allAssets, null, 2))
    allAssets.forEach((asset) => {
      console.log(asset.symbol)
    })
    let assetIn = allAssets.find((asset) => asset.symbol === startAssetSymbol)
    let assetOut = allAssets.find((asset) => asset.symbol === destAssetSymbol)
    console.log(`ASSET IN ${JSON.stringify(assetIn, null, 2)}`)
    console.log(`ASSET OUT ${JSON.stringify(assetOut, null, 2)}`)
    if(!assetIn || !assetOut){
      throw new Error("Cant find BSX asset from symbol")
    }
    let number = new BigNumber(ZERO)
    let bestBuy = await router.getBestSell(assetIn.id, assetOut.id, assetInAmount)
    console.log(JSON.stringify(bestBuy, null, 2))
    
    let swapZero = bestBuy.toTx(number)

    console.log(JSON.stringify(swapZero, null, 2))
    let key = await getSigner()
    let tx: SubmittableExtrinsic = swapZero.get()
    console.log(`TX ${JSON.stringify(tx.toHuman(), null, 2)}`)
    let hash = await tx.signAndSend(key)
    console.log(`HASH ${hash}`)
    await api.disconnect()
    return bestBuy
}

class GetAllAssetsExample {
    async script(api: ApiPromise): Promise<any> {
      const poolService = new PoolService(api);
      const router = new TradeRouter(poolService);
      return router.getAllAssets();
    }
  }
  
//   new GetAllAssetsExample(ApiUrl.Nice, 'Get all assets').run()


async function run(){
    // await getSwapTx("KSM", "BSX", 1)
    let assets = await getSwapTx("KSM", "BSX", 1)
    // console.log(JSON.stringify(assets, null, 2))

}

run()

const getSigner = async () => {
  await cryptoWaitReady()
  const keyring = new Keyring({
    type: "sr25519",
  });

  // Add Alice to our keyring with a hard-deived path (empty phrase, so uses dev)
  return keyring.addFromUri("//Alice");
};