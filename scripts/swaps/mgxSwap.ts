import { RegistryError } from '@polkadot/types/types/registry';
// import * as s from 'json-stringify-safe';
import flatted from 'flatted';
import { encodeAddress, decodeAddress } from "@polkadot/keyring";
import { BalanceChangeStatue } from '../../src/types';
// import {Account, Mangata, MultiswapBuyAsset, TokenAmount, TokenId, TxOptions} from '@mangata-finance/sdk'
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
import { MangataInstance, Mangata, MultiswapBuyAsset, MultiswapSellAsset } from "@mangata-finance/sdk"
import { BN } from '@polkadot/util';
const wsLocalChain = "ws://172.26.130.75:8000"

async function main(assetInSymbol: string, assetOutSymbol: string, amount: number) {
  // Connect to the mainet (also testnet, mainnet)
  const mangata: MangataInstance = Mangata.instance([wsLocalChain]);

  // Retrieve the chainName, nodeName & nodeVersion information
  const [chain, nodeName, nodeVersion] = await Promise.all([
    mangata.rpc.getChain(),
    mangata.rpc.getNodeName(),
    mangata.rpc.getNodeVersion()
  ]);

  console.log(
    `You are connected to chain ${chain} using ${nodeName} v${nodeVersion}`
  );

    let key = await getSigner()
    let assetIn;
    let assetOut;
    let assets = await mangata.query.getAssetsInfo()
    
    console.log(JSON.stringify(assets, null, 2))
    for (let asset of Object.keys(assets)) {
        let assetInfo = assets[asset]
        if(assetInfo.symbol === assetInSymbol){
            console.log(assetInfo)
            assetIn = assetInfo
        }
        if(assetInfo.symbol === assetOutSymbol){
            console.log(assetInfo)
            assetOut = assetInfo
        }
    }
    if(!assetIn || !assetOut){
      throw new Error("Asset not found")
    }
    console.log(`assetIn: ${JSON.stringify(assetIn)} `)
    console.log(`assetOut: ${JSON.stringify(assetOut)} `)
    
    const tokens: Token[] = [assetIn, assetOut]
    let amountInBN = new BN(amount)
    let minAmountOut = new BN("20000000000000000000000")
    const args: MultiswapSellAsset = {
        account: key,
        tokenIds: [assetIn.id, assetOut.id],
        amount: amountInBN,
        minAmountOut: minAmountOut,
        
    }
    console.log(JSON.stringify(args, null, 2))
    let tx = await mangata.xyk.multiswapSellAsset(args)
    console.log(JSON.stringify(tx, null, 2))
    process.exit(0)
}
async function run(){
    main("KSM", "MGX", 1000000000000)


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