import fs from 'fs'
import * as paraspell from '@paraspell/sdk'
import { Observable } from 'rxjs'
import { timeout } from 'rxjs/operators'
import { WsProvider, ApiPromise, Keyring } from '@polkadot/api'
import { FixedPointNumber } from '@acala-network/sdk-core'
import { u8aToHex } from '@polkadot/util'
import { EventRecord, Phase, Event, Hash } from '@polkadot/types/interfaces'
import { ISubmittableResult, IU8a } from '@polkadot/types/types'
import { TNode, getAssetsObject, getNode } from '@paraspell/sdk'
import { BalanceData, getAdapter } from '@polkawallet/bridge'
import { exec, execSync, spawn, ChildProcess } from 'child_process';
import path from 'path';
// import { getAdapter } from './adapters'

import { RegistryError } from '@polkadot/types/types/registry';
// import * as s from 'json-stringify-safe';
import flatted from 'flatted';
import { encodeAddress, decodeAddress } from "@polkadot/keyring";
import { BalanceChangeStatue } from '../src/types';
import {Mangata} from '@mangata-finance/sdk'
import { wsLocalFrom, wsLocalDestination, assetSymbol, fromChain, toChain } from './testParams'
// import { u8aToHex } from '@polkadot/util';
import { mnemonicToLegacySeed, hdEthereum } from '@polkadot/util-crypto';
// const { ApiPromise } = require('@polkadot/api');
// const { WsProvider } = require('@polkadot/rpc-provider');
import { options } from '@acala-network/api';
// const { options } = require('@acala-network/api');
// import { Fixed18, convertToFixed18, calcSwapTargetAmount } from '@acala-network/api';

async function karuraSwap() {
    const provider = new WsProvider('wss://karura.api.onfinality.io/public-ws');
    const api = new ApiPromise(options({ provider }));
    await api.isReady;

    const keyring = new Keyring({ type: 'sr25519' });
    const newPair = keyring.addFromUri('yourinput');
    const address = newPair.address;
    console.log(newPair.address); // you need to get test tokens
  	
    // DOT -> aUSD
  	
    // Set Supply Amount
    const supply = 1
    
    // Query Dex Pool
    const pool = await api.derive.dex.pool('DOT');
  
    // Query Exchange Fee
    const exchangeFee = api.consts.dex.getExchangeFee;
    
    // Calculate Target Currency Amount
    const target = calcSwapTargetAmount(
        supply,
        convertToFixed18(pool.base),
        convertToFixed18(pool.other),
        convertToFixed18(exchangeFee),
        Fixed18.fromNature(0.005)
    );
  
    // Exec Exchange
    await api.tx.dex.swapCurrency(
        'DOT',
        Fixed18.fromNatural(supply).innerToString(),
        'AUSD',
        Fixed18.fromNatural(target).innerToString()
    ).signAndSend(newPair);

    // Ensure Amount
    const dotAccount = await api.query.tokens.accounts(address, 'DOT');
    console.log(dotAccount.toHuman());
  
    const aUSDAccount = await api.query.tokens.accounts(address, 'AUSD');
    console.log(aUSDAccount.toHuman());
}