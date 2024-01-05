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
import { BalanceChangeStatue } from '../../src/types';
import {Mangata} from '@mangata-finance/sdk'
import { wsLocalFrom, wsLocalDestination, assetSymbol, fromChain, toChain } from './testParams'
// import { u8aToHex } from '@polkadot/util';
import { mnemonicToLegacySeed, hdEthereum } from '@polkadot/util-crypto';

const aliceAddress = "HNZata7iMYWmk5RvZRTiAsSDhV8366zq2YGb3tLH5Upf74F"



const mgxRpc = 'wss://kusama-rpc.mangata.online'
const dazzleMgxAddres = '5G22cv9fT5RNVm2AV4MKgagmKH9aoZL4289UDcYrToP9K6hQ'
const localHost = "ws://172.26.130.75:"
const aliceErc20 = "0xf24FF3a9CF04c71Dbc94D0b566f7A27B94566cac"

const fromNode = getNode(fromChain)
const toNode = getNode(toChain)



    
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
// 1,000,000,000,000,000
async function testTx(){
    // let provider = new WsProvider(wsLocalFrom);
    // let api = new ApiPromise({provider});
    // await api.isReady;

    // let mangataNode = getNode('Mangata')
    let provider = new WsProvider(wsLocalFrom);
    let api = await fromNode.createApiInstance(wsLocalFrom);
    let keyring = new Keyring({ type: 'sr25519' });
    let alice = keyring.addFromUri('//Alice');

    console.log("Api ready")
    let assetId = paraspell.getAssetId(fromChain, assetSymbol)
    let assetSymbolOrId = getAssetBySymbolOrId(fromChain, assetSymbol)
    console.log("Asset Symbol or Id: ")
    console.log(assetSymbolOrId)
    if(!assetSymbolOrId){
        throw new Error("Cant find asset symbol or id")
    }
    let currencyParameter = assetSymbolOrId.assetId ?? assetSymbolOrId.symbol
    currencyParameter = currencyParameter
    if(!currencyParameter){
        throw new Error("Cant find currency parameter")
    }
    console.log("Asset Id: " + assetId)
    console.log("Currency Parameter " + currencyParameter)
    let decimals = paraspell.getAssetDecimals(fromChain, assetSymbol);
    let amount = new FixedPointNumber(1, Number(decimals));
    let ksmAmount = new FixedPointNumber(1, 12);

    // const xcmTx2 = paraspell.Builder(api).from(fromChain).to(toChain).currency(currencyParameter).amount(amount.toChainData()).address(aliceAddress)
    // console.log(flatted.stringify(xcmTx2, null, 2))
    // console.log(JSON.stringify(xcmTx2, null, 2));
    const xcmTx = paraspell.Builder(api).from(fromChain).to(toChain).currency(currencyParameter).amount(amount.toChainData()).address(aliceAddress).build()
    // const xcmTx = paraspell.Builder(api).from(fromChain).amount(ksmAmount.toChainData()).address(aliceAddress).build()
    // const xcmTx = paraspell.Builder(api).to(toChain).amount(ksmAmount.toChainData()).address(aliceAddress).build()

    // const xcmTx = paraspell.Builder(api).from("BifrostKusama").to("Karura").currency("KAR").amount(1000000000000).address(aliceAddress).build()
    console.log(JSON.stringify(xcmTx.toHuman()));
    console.log(xcmTx.toHuman())
    let obj = xcmTx;
    let propertiesOnly = Object.fromEntries(
        Object.entries(obj).filter(([key, value]) => typeof value !== 'function')
    );
    // console.log(propertiesOnly);
    // const mnemonic = 'bottom drive obey lake curtain smoke basket hold race lonely fit walk';
    // let privateKey = "0x5fb92d6e98884f76de468fa3f6278f8807c48bebc13595d45af5bdc4da702133"
    // const keyring = new Keyring({ type: 'ethereum' });
    // const index = 0;
    // let ethDerPath = `m/44'/60'/0'/0/${index}`;
    // const alice = keyring.addFromUri(`${privateKey}/${ethDerPath}`);
    // console.log(`Derived Ethereum Address from Mnemonic: ${alice.address}`);
// console.log(alice.address)
// console.log(alice)
    // const privateKey = u8aToHex(
    //     hdEthereum(mnemonicToLegacySeed(mnemonic, '', false, 64), ethDerPath)
    //     .secretKey
    // );
    // console.log(`Derived Private Key from Mnemonic: ${privateKey}`);

    try{
        let txResult: any= new Promise((resolve, reject) => {
            let success = false;
            let included: EventRecord[] = [];
            let finalized: EventRecord[] = [];
            let blockHash: string = "";
            xcmTx.signAndSend(alice, ({ events = [], status, txHash, txIndex, dispatchError }) => {
                if (status.isInBlock) {
                    success = dispatchError ? false : true;
                    console.log(
                        `📀 Transaction ${xcmTx.meta.name}(..) included at blockHash ${status.asInBlock} [success = ${success}]`
                    );
                    included = [...events];

                } else if (status.isBroadcast) {
                    console.log(`🚀 Transaction broadcasted.`);
                } else if (status.isFinalized) {
                    console.log(
                        `💯 Transaction ${xcmTx.meta.name}(..) Finalized at blockHash ${status.asFinalized}`
                    );
                    blockHash = status.asFinalized.toString();
                    finalized = [...events];
                    const hash = status.hash;
                    let txDetails: TxDetails = { success, hash, included, finalized, blockHash, txHash, txIndex };
                    resolve(txDetails);
                } else if (status.isReady) {
                    // let's not be too noisy..
                } else if (dispatchError){
                    if(dispatchError.isModule){
                        const decoded = api.registry.findMetaError(dispatchError.asModule);
                        const { docs, name, section } = decoded;
                        reject(new Error(`${section}.${name}: ${docs.join(' ')}`));
                    } else {
                        reject(new Error(dispatchError.toString()));
                    
                    }
                }
                else {
                    console.log(`🤷 Other status ${status}`);
                }
            }).catch((error) => {
                console.log("Error: " + error);
                reject(error);
            });
        });
        let txDetails: TxDetails = await txResult;
        // let balanceChanged = await balanceChangePromise;
        // console.log("Balance changed: " + balanceChanged)
        api.disconnect();
        // mgxApi.disconnect();
        return txDetails;
    } catch (error) {
        console.error('Error with transaction:', error);
    }
}

async function testDestination(){
    let provider = new WsProvider(wsLocalDestination);
    let api = new ApiPromise({provider});
    await api.isReady;
    
    await provider.send("dev_newBlock", [{ count: 10 }]).catch((error) => {
        console.log("Error: " + error);  
    });
    console.log("10 new blocks created");
    // let assetRegistry = await api.query.assets.asset.entries();
    // Object.entries(assetRegistry).forEach(([key, value]) => {
    //     console.log(`${key}: ${value}`);
    // })
    api.disconnect();
}
const getAssetBySymbolOrId = (
    node: TNode,
    symbolOrId: string | number
  ): { symbol?: string; assetId?: string } | null => {
    const { otherAssets, nativeAssets, relayChainAssetSymbol } = getAssetsObject(node)
  
    const asset = [...otherAssets, ...nativeAssets].find(
      ({ symbol, assetId }) => {
        if(typeof symbolOrId === 'string'){
            symbolOrId = symbolOrId.toUpperCase()
        }
        return symbol?.toUpperCase() === symbolOrId || assetId === symbolOrId
        }
    )
  
    if (asset !== undefined) {
      const { symbol, assetId } = asset
      return { symbol, assetId }
    }
  
    if (relayChainAssetSymbol === symbolOrId) return { symbol: relayChainAssetSymbol }
  
    return null
}
let chopsticksProcess: ChildProcess | null;
let chopsticksConnected = false;
async function chopTest(){
    return new Promise((resolve, reject) => {
        const chopstickStartCommand = `cd ~/workspace && bash start_chopsticks.sh karura bifrost`;
        chopsticksProcess = spawn('wsl', ['bash', '-l', '-c', chopstickStartCommand]);
        chopsticksProcess.stderr?.on('data', (data) => {
            console.error(`stderr: ${data}`);
            reject(false)
        });
        chopsticksProcess.on('close', (code) => {
            console.log(`Chopsticks process exited with code ${code}`);
            chopsticksProcess = null;
            reject(false)
        });
        chopsticksProcess.stdout?.on('data', (data) => {
            console.log(`stdout: ${data}`);

            const output = data.toString();
            const lines = output.split('\n');
            
            lines.forEach((line: string) => {
                if (line.startsWith("Bash script PID:")) {
                    scriptPid = line.split(':')[1].trim();
                    console.log(`Captured Bash script PID: ${scriptPid}`);
                } else if (line.startsWith("Chopsticks PID:")) {
                    chopsticksPid = line.split(':')[1].trim();
                    console.log(`Captured Chopsticks PID: ${chopsticksPid}`);
                }
            });

            if(output.includes("Connected relaychain 'Kusama' with parachain 'Bifrost'")){
                chopsticksConnected = true;
                console.log("Chopsticks connected");
                resolve(true);
            }

        });
        chopsticksProcess.on('exit', (code, signal) => {
            console.log(`Child process exited with code ${code} and signal ${signal}`);
            reject(false);
        });
        console.log("Windows process ID: " + chopsticksProcess.pid)
    });
    
}
async function stopChopTest(){
    console.log("Checking script process and chopsticks process before closing: ")
    let scriptProcessRunning = checkProcessInWSL(scriptPid)
    let chopsticksProcessRunning = checkProcessInWSL(chopsticksPid)
    if(await scriptProcessRunning && await chopsticksProcessRunning){
        console.log("Script and chopsticks process running. Now stopping...")
    } else {
        console.log("Script and chopsticks process not running. Now stopping...")
        throw new Error("Script and chopsticks process not running.")
    }
    if(chopsticksConnected){
        return await killProcessInWslTermSync(Number(scriptPid)); // Will block script until finished
        
    }
    console.log("Windows process: " + chopsticksProcess?.pid)
    console.log("Returning false")
    return false

}
function isProcessRunning(pid: number) {
    try {
        process.kill(pid, 0); // Signal 0 doesn't kill the process
        return true;
    } catch (e) {
        return false;
    }
}
function checkProcessInWSL(processId: string | null): Promise<boolean> {
    return new Promise((resolve, reject) => {
        // exec(`wsl ps aux | grep ${processName}`, (error, stdout, stderr) => { // Check for process name
        exec(`wsl ps -p ${processId}`, (error, stdout, stderr) => {
            if (error) {
                // If there's an error, it could mean the process doesn't exist
                resolve(false);
                return;
            }
            if (stderr) {
                if(stderr.includes("bogus")){
                    //ignore
                } else{
                    console.error(`stderr: ${stderr}`);
                    resolve(false);
                }
                
            }
            if(!processId){
                throw new Error("Script PID not found. Should be initiated already")
            }
            // If stdout includes the PID, it means the process is running
            if (stdout.includes(processId.toString())) {
                console.log("stdout: " + stdout)
                console.log("returning true")
                resolve(true);
            } else {
                console.log("stdout: " + stdout)
                console.log("returning false")
                resolve(false);
            }
        });
    });
}
// Check after stopping, confirm nothing is running and set process IDs to null
async function confirmScriptEnded(processId: string | null){
    if(!processId){
        throw new Error("Script PID not found. Should be initiated already")
        
    } else {
        let processRunning = await checkProcessInWSL(processId)
        if(processRunning){
            console.log("Script still running. Waiting 5 seconds...")
            setTimeout(() => {
                return confirmScriptEnded(processId)
            }, 5000);
        } else {
            console.log("Confirmed script ended. Continuing...")
            scriptPid = null;
            chopsticksPid = null;
            return true
        }
    }
}
async function runChopsticksTest(){
    let chopConnected =  await chopTest();
    if(chopConnected && scriptPid != null){
        console.log("Chopsticks connected. Now stopping...")
        let chopstopped = await stopChopTest()
        console.log("Chopsticks stopped: " + chopstopped)
    } else {
        throw new Error("Chopsticks not connected")
    }
    console.log("Confirm script ended")
    await confirmScriptEnded(scriptPid)

    //End windows process
    chopsticksProcess?.kill('SIGTERM');
    chopsticksProcess = null;
}

async function sendTx(){
    let mgxWs = "ws://172.26.130.75:8000"
    let provider = new WsProvider(mgxRpc);
    // let provider = new WsProvider(wsLocalBifrost);
    let mgxApi = new ApiPromise({provider});
    await mgxApi.isReady;
    let keyring = new Keyring({ type: 'sr25519' });
    let alice = keyring.addFromUri('//Alice');
    await mgxApi.tx.balances.transfer(dazzleMgxAddres, 10000000000000000000).signAndSend(alice)
    mgxApi.disconnect()
}
async function watchTokenDeposit(){
    let localProvider = new WsProvider(wsLocalDestination)
    let localApi = new ApiPromise({provider: localProvider});
    let statemineAdapter = getAdapter(1000);
    await statemineAdapter.init(localApi);

    let balanceObservable$ = statemineAdapter.subscribeTokenBalance("USDT", aliceAddress);

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

    return balanceChangePromise;
}
// async function waitForBalanceChange(balanceObservable$: Observable<BalanceData>): Promise<boolean>{

// }
async function testMangataAdapter(){

    let mgxWs = "ws://172.26.130.75:8000"
    let provider = new WsProvider(mgxWs);
    let mgxApi = new ApiPromise({provider});

    await mgxApi.isReady;
    let mgxAdapter = getAdapter(2110);
    await mgxAdapter.init(mgxApi);

    let balanceObservable$ = mgxAdapter.subscribeTokenBalance("MGX", aliceAddress);

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

    // let balanceChangeResult = await balanceChangePromise;
    // console.log(`RESULT: ${balanceChangeResult}`)
    // mgxApi.disconnect()

    return balanceChangePromise;

    // api.disconnect()
}

async function validateAddress(){
    console.log(aliceAddress)
    console.log(decodeAddress(aliceAddress))
    console.log(encodeAddress(decodeAddress(aliceAddress)))
}

async function run(){
    testTx()
    // let balanceDepositResult = await watchTokenDeposit()
    // console.log("Balance deposit result: " + balanceDepositResult)
    // testMangataAdapter()
    // sendTx()
    // validateAddress()

}
run()
function killProcessInWslTerm(wslPid: number) {
    exec(`wsl kill -TERM ${wslPid}`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error: ${error.message}`);
        }
        if (stderr) {
            console.error(`stderr: ${stderr}`);
        }
        if (stdout) {
            console.log(`stdout: ${stdout}`);
        }
    });
}
function killProcessInWslTermSync(wslPid: number) {
    try {
        const stdout = execSync(`wsl kill -TERM ${wslPid}`);
        console.log(`stdout: ${stdout}`);
        return true
    } catch (error: any) {
        // Error will include the entire stdout and stderr as part of the message
        console.error(`Error: ${error.message}`);
        return false
    }
}
async function killWindowsProcess(pid: number){
    try{
        process.kill(pid, "SIGTERM")
    }catch(e){
        console.log("Error killing process: " + e)
    }
}
// Handle script exit
process.on('SIGINT', () => {
    console.log('Received SIGINT. Stopping Chopsticks...');
    // scriptPid? killProcessInWslTerm(Number(scriptPid)) : console.log("Script PID not found");
    if(scriptPid != null){
        console.log("Script PID: " + scriptPid)
        killProcessInWslTermSync(Number(scriptPid));
    }
    chopsticksProcess?.kill('SIGTERM');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('Received SIGTERM. Stopping Chopsticks...');
    chopsticksProcess?.kill('SIGTERM');
    process.exit(0);
});

process.on('exit', () => {
    console.log('Exiting. Stopping Chopsticks...');
    chopsticksProcess?.kill('SIGTERM');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Application specific logging, throwing an error, or other logic here
});