import fs from 'fs'
import * as paraspell from '@paraspell/sdk'
import { Observable } from 'rxjs'
import { timeout } from 'rxjs/operators'
import { WsProvider, ApiPromise, Keyring } from '@polkadot/api'
import { FixedPointNumber } from '@acala-network/sdk-core'
import { u8aToHex } from '@polkadot/util'
import { EventRecord, Phase, Event, Hash } from '@polkadot/types/interfaces'
import { ISubmittableResult, IU8a } from '@polkadot/types/types'
import { TNode, getAssetsObject, getNode, getTNode } from '@paraspell/sdk'
// import * as bridge from '@polkawallet/bridge'
// import * as adapters from '@polkawallet/bridge/adapters/index'
// import {BifrostAdapter} from '@polkawallet/bridge/adapters/bifrost'
import { BalanceData, getAdapter } from '@polkawallet/bridge'
import { exec, execSync, spawn, ChildProcess } from 'child_process';
import path from 'path';
// import { getAdapter } from './adapters'
import { finalize } from 'rxjs/operators';
import { ApiBase } from '@polkadot/api/types'
import { wsLocalFrom } from './testParams'
// import { UI8 } from '@polkadot/types/primitive';
// import { getAssetBySymbolOrId } from '@paraspell/sdk/asset'
// import { BifrostAdapter } from '../../bridge/src/adapters/bifrost'
// import { vi, describe, expect, it, beforeEach } from 'vitest'
// import { type Bool, type TNode } from '../../../types'
// import { createApiInstance } from '../../../utils'
// import * as hrmp from '../../hrmp'
// import * as parasSudoWrapper from '../../parasSudoWrapper'
// import * as xcmPallet from '../../xcmPallet'
// import * as xyk from '../../xyk'
// import { getRelayChainSymbol } from '../../assets'
// 182365888117048807484804376330534607370
// 182365888117048807484804376330534607370
// 
const localHost = "ws://172.26.130.75:"
const aliceAddress = "HNZata7iMYWmk5RvZRTiAsSDhV8366zq2YGb3tLH5Upf74F"
const nodeOne = getNode('Karura').node
const nodeTwo = getNode('BifrostKusama').node
const nodeThree = 'Khala'
let sourceChainApi: ApiPromise | null = null;
let destChainApi: ApiPromise | null = null;

// const successfullTests = ["BNC, TUR, HKO, QTZ"]

let chopsticksProcess: ChildProcess | null = null;
let bashScriptPid: string | null;
let chopsticksPid: string | null;
let chopsticksConnected = false;
type TxDetails = {
    success: boolean;
    hash: IU8a,
    included: EventRecord[];
    finalized: EventRecord[];
    blockHash: string;
    txHash: Hash;
    txIndex?: number;
}
interface MyAssetRegistryObject {
    tokenData: MyAsset,
    hasLocation: boolean;
    tokenLocation?: string;
}

interface MyAsset {
    network: string;
    chain: number;
    localId: string;
    name: string;
    symbol: string;
    decimals: string;
    minimalBalance?: string;
    deposit?: string;
    isFrozen?: boolean;
    contractAddress?: string;
}
interface TransferrableAssetObject {
    sourceParaspellChainName: TNode;
    assetRegistryObject: MyAssetRegistryObject;
    paraspellAssetSymbol: ParaspellAssetSymbol;
    originChainParaId: number;
    originParaspellChainName: TNode | "Kusama";
}
type OriginParaspellChainName = TNode | "Kusama";
interface ParaspellAssetSymbol {
    symbol?: string;
    assetId?: string;
}
interface TransferParams {
    type: string;
    from: TNode;
    to?: TNode | "Kusama";
    currency?: string;
    amount?: any;
    address?: string;
    transferrableAssetObject: TransferrableAssetObject;
}
interface XcmTestParams{
    chopsticksCommand: string;
    transferParams: TransferParams;
}
async function buildAndSubmitXcmTx(){
    console.log("Connecting to api")
    let nodeOneEndpoints = paraspell.getNodeEndpointOption(nodeOne)
    // console.log(nodeOneEndpoints)
    const wsProvider = new WsProvider(wsLocalFrom)
    let api =  await ApiPromise.create({ provider: wsProvider })

    const asset = "KAR"
    const karAssets = paraspell.getAllAssetsSymbols(nodeOne)
    // console.log(karAssets)


    const karDecimals = paraspell.getAssetDecimals(nodeOne, asset)
    const karAmount = new FixedPointNumber(1,Number(karDecimals)).toChainData()
    // console.log(karAmount)

    const xcmTx = paraspell.Builder(api).from("Karura").to("BifrostKusama").currency(asset).amount(karAmount).address(aliceAddress).build()
    // console.log(JSON.stringify(xcmTx.toHuman()))
    const keyring = new Keyring({ type: 'sr25519' });
    const alice = keyring.addFromUri('//Alice');
    const aliceAccountId32 = u8aToHex(alice.addressRaw);

    // console.log(JSON.stringify(xcmTx.toHuman()))
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
                resolve({ success, hash, included, finalized, blockHash, txHash, txIndex });
            } else if (status.isReady) {
                // let's not be too noisy..
            } else {
                console.log(`🤷 Other status ${status}`);
            }
        });
    });
    paraspell.hasSupportForAsset(nodeOne, asset)
    let txDetails: any = await txResult;

    api.disconnect()
    return txDetails.success
}

async function connectApis(portOne: number, fromChainName: TNode, portTwo: number, toChainName: TNode | "Kusama"){
    console.log(`Connecting to source chain api on port ${portOne}`)
    console.log(`Connecting to destination chain api on port ${portTwo}`)
    let sourceChainWs = `ws://172.26.130.75:${portOne}`;
    let destChainWs = `ws://172.26.130.75:${portTwo}`;

    let fromApiPromise = getNode(fromChainName).createApiInstance(sourceChainWs).then(api => api.isReady);
    let toApiPromise = toChainName === "Kusama" ? 
        ApiPromise.create({ provider: new WsProvider(destChainWs) }).then(api => api.isReady) :
        getNode(toChainName).createApiInstance(destChainWs).then(api => api.isReady);

    let [sourceChainApi, destChainApi] = await Promise.all([fromApiPromise, toApiPromise]);
    console.log("Connected to both source and destination chain APIs");
    
    return {sourceChainApi, destChainApi}
}

async function disconnectApis(sourceChainApi: ApiPromise | null, destChainApi: ApiPromise | null){
    if(sourceChainApi != null && sourceChainApi.isConnected){
        await sourceChainApi.disconnect()
    }
    if(destChainApi != null && destChainApi.isConnected){
        await destChainApi.disconnect()
    }
}

async function watchTokenDeposit(paraId: number, destChainApi: ApiPromise, destPort: number, transferrableAssetObject: TransferrableAssetObject){
    // let destChainWs = `ws://172.26.130.75:${port}`;
    // let provider = new WsProvider(destChainWs);
    // let destChainApi = new ApiPromise({provider});
    // await destChainApi.isReady;

    printAndLogToFile("Initiating balance adapter for destination chain " + paraId + " on port " + destPort )
    let destAdapter = getAdapter(paraId)
    let currentBalance: BalanceData;
    await destAdapter.init(destChainApi);
    printAndLogToFile("Subscribing to balance for destination chain " + paraId + " for asset " + transferrableAssetObject.paraspellAssetSymbol.symbol + " for address " + aliceAddress)
    if(!transferrableAssetObject.paraspellAssetSymbol.symbol){
        throw logError(new Error("Asset symbol is null. Cant subscribe to token balance"))
    }
    const bncAliceAddress = "gXCcrjjFX3RPyhHYgwZDmw8oe4JFpd5anko3nTY8VrmnJpe"

    console.log("Transferrable asset object: " + JSON.stringify(transferrableAssetObject))
    let tokenSymbol = transferrableAssetObject.paraspellAssetSymbol.symbol;
    console.log(`Source Chain Name ${transferrableAssetObject.sourceParaspellChainName} | Token Symbol ${tokenSymbol}`)
    if(transferrableAssetObject.sourceParaspellChainName == "Moonriver" && transferrableAssetObject.paraspellAssetSymbol.symbol.toUpperCase().startsWith("XC")){
        console.log("Removing XC from token symbol")
        tokenSymbol = tokenSymbol.slice(2)
    }

    const balanceObservable = destAdapter.subscribeTokenBalance(tokenSymbol, aliceAddress);
    console.log("Subscribed to balance")
    console.log(destChainApi.registry.chainTokens)
    return new Observable<BalanceData>((subscriber) => {
        const subscription = balanceObservable.subscribe({
            next(balance) {
                if(currentBalance){
                    subscriber.next(balance);
                    subscriber.complete();
                    console.log("Token deposit complete")
                } else {
                    currentBalance = balance;
                    subscriber.next(balance);
                }
            },
            error(err) {
                subscriber.error(logError(new Error(err), "Error watching token deposit"));
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

async function getBalanceChange(balanceObservable$: Observable<BalanceData>){
    logToFile(" Waiting for balance change")

    let currentBalance: BalanceData;
    const balanceChangePromise = new Promise<boolean>((resolve, reject) => {
        const subscription = balanceObservable$.pipe(timeout(600000)).subscribe({
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
                    logToFile("Original Balance: " + balance.free.toNumber().toString())
                }
            },
            
            error(err) {
                if(err.name == 'TimeoutError'){
                    console.log('No balance change reported within 120 seconds');
                    logError(err, "No balance change reported within 120 seconds")
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
    });
    return balanceChangePromise
}

function logToFile(message: string) {
    const logFilePath = path.join(__dirname, 'testResults.log');
    fs.appendFileSync(logFilePath, message + '\n', 'utf8');
}
function printAndLogToFile(message: string){
    console.log(message)
    logToFile(message)
}
function logError(error: Error, message?: string): Error{
    const logFilePath = path.join(__dirname, 'testErrors.log');
    fs.appendFileSync(logFilePath, message + '\n' + error + '\n', 'utf8');
    return error
}
let newTestRound = true;
function logSuccessOrFail(testParams: TransferParams, success: boolean, fromChain: string, destinationChain: string, currency?: string){
    const logFilePath = path.join(__dirname, 'testSuccessOrFailure.log');
    const successJsonFilePath = path.join(__dirname, 'success.json');
    let successParams = JSON.parse(fs.readFileSync(successJsonFilePath, 'utf8'))
    // let successParams: any[] = [];
    if(newTestRound){   
        fs.appendFileSync(logFilePath, "*****************" + '\n', 'utf8');
        fs.appendFileSync(logFilePath, "Starting new test" + '\n', 'utf8');
        fs.appendFileSync(logFilePath, "*****************" + '\n', 'utf8');
        newTestRound = false;
    }
    let resultLogMessage;
    if(success){
        resultLogMessage = `Source chain: ${fromChain} --- Destination chain: ${destinationChain} --- Asset: ${currency} --- Result: SUCCESS`
        // let resultJson = JSON.stringify(testParams, null, 2)
        console.log("Result JSON")
        console.log(testParams)
        successParams.push(testParams)
        let successParamsJson = JSON.stringify(successParams, null, 2)
        fs.writeFileSync(successJsonFilePath, successParamsJson)
    } else {
        resultLogMessage = `Source chain: ${testParams.from} --- Destination chain: ${testParams.to} --- Asset: ${testParams.currency} --- Result: FAILURE`
    }
    fs.appendFileSync(logFilePath, "" + '\n', 'utf8');
    fs.appendFileSync(logFilePath, resultLogMessage + '\n', 'utf8');
}
//Get all transferrable assets on the source chain and their corresponding origin chains
//For each asset, get the origin chain and the destination chain
//For each asset, get the balance of the user on the origin chain
//Execute the cross chain transfer
//Watch the balance of the user on the destination chain
//If the balance changes, the transfer was successful

async function runXcmTransferTests(sourceChain: number){
    let testParams = await constructXcmTransferTests(sourceChain)
    let testIndex = 0;
    let testExceptions = await getTestExceptions(sourceChain)
    for (const testParam of testParams) {
        let transferrableAsset = testParam.transferParams.transferrableAssetObject;
        let fromChainName = testParam.transferParams.from;
        let destinationChainName = testParam.transferParams.to ?? testParam.transferParams.transferrableAssetObject.originParaspellChainName;
        let destinationChainId = testParam.transferParams.transferrableAssetObject.originChainParaId;
        let transferCurrency = testParam.transferParams.currency ?? testParam.transferParams.transferrableAssetObject.paraspellAssetSymbol.symbol;

        // SKIP calamari, genshiro, chopsticks breaks
        // Some chain names arent being read properly and coming back as undefined
        if(
             
            // (testParam.transferParams.type == "paraToPara" || testParam.transferParams.type == "paraToRelay")
            testParam.transferParams.from != testParam.transferParams.to
            && (testParam.transferParams.to != undefined || testParam.transferParams.transferrableAssetObject.originParaspellChainName == "Kusama")
            && (testParam.transferParams.currency != undefined || testParam.transferParams.transferrableAssetObject.originParaspellChainName == "Kusama")
            // && !successfullTests.includes(testParam.transferParams.currency?)
            && !testExceptions.toSkip.includes(testParam.transferParams.to)
            && !testExceptions.currencySkip.includes(testParam.transferParams.currency)
            && !testExceptions.toSkip.includes(testParam.transferParams.transferrableAssetObject.originParaspellChainName)
            // && testIndex < 2
        ){
            
            try{

                if(chopsticksProcess != null){
                    throw logError(new Error("Chopsticks process already running"))
                }
                
                
                console.log(`----------------------------New test starting---------------------------- \n Source chain: ${fromChainName} --- Destination chain: ${destinationChainName} --- Asset: ${transferCurrency}`)
                
                logToFile("----------------------------New test starting----------------------------")
                logToFile(`Source chain: ${fromChainName} --- Destination chain: ${destinationChainName} --- Asset: ${transferCurrency}`)
                logToFile("\n TEST PARAMETERS: \n " + JSON.stringify(testParam))
                
                chopsticksProcess = runChopsticksInstance(testParam.chopsticksCommand, fromChainName, destinationChainName);
                let ports = await getChopstickPorts(chopsticksProcess, testParam.transferParams.type);
                if(testParam.transferParams.type == "relayToPara"){
                    let reversedPorts = {
                        portOne: ports.portTwo,
                        portTwo: ports.portOne,
                        portThree: ports.portThree
                    }
                    ports = reversedPorts;
                }
                logToFile(`Successfully initiated chopsticks instance. \n Windows Process ID: ${chopsticksProcess?.pid} | Script ID: ${bashScriptPid} | Chopsticks ID: ${chopsticksPid}`)
                console.log("Windows process id " + chopsticksProcess?.pid + "\n Script Id " + bashScriptPid + "\n Chopsticks Id " + chopsticksPid)
                

                let apis = await connectApis(ports.portOne, fromChainName, ports.portTwo, destinationChainName)
                sourceChainApi = apis.sourceChainApi;
                destChainApi = apis.destChainApi;
                
                
                let balanceObservable$ = await watchTokenDeposit(destinationChainId, destChainApi, ports.portTwo, transferrableAsset);
                logToFile("Successfully initiated balance observer.")
                
                
                let txDetails: TxDetails = await executeTest(sourceChainApi, chopsticksProcess, testParam.transferParams)
                logToFile("Successfully submitted extrinsic. Transaction details: \n" + JSON.stringify(txDetails))
                console.log("Transaction success? --- " + txDetails.success)
                
                let balanceChanged = await getBalanceChange(balanceObservable$)
                logToFile("Balance change observed? --- " + balanceChanged)

                let chopsticksClosed = waitForChopsticksToClose();
                
                await stopChopsticks();
                let wslProcessEnded = await confirmWslScriptEnded(bashScriptPid)

                await chopsticksClosed.then( () => {
                    console.log("Chopsticks instance closed, promise resolved")
                    if(!wslProcessEnded){
                        throw logError(new Error("Wsl Processes not closed correctly"))
                    }
                }).catch((error) => {
                    console.log(logError(error, "Chopsticks close promise rejected"))
                });
                if (chopsticksProcess){
                    throw logError(new Error("Chopsticks process not killed"))
                } else {
                    printAndLogToFile("Chopsticks process killed")
                }
                logToFile("----------------------")
                logSuccessOrFail(testParam.transferParams, balanceChanged, fromChainName, destinationChainName, transferCurrency)
                

            } catch (error: any) {
                console.log(logError(new Error(JSON.stringify(error)), "Error in test execution"))
                logToFile(JSON.stringify(error))
                printAndLogToFile(JSON.stringify(error.stack, null, 2))
                logError(error, JSON.stringify(error.stack, null, 2))

                let chopsticksClosed = waitForChopsticksToClose();
                await stopChopsticks();

                if(bashScriptPid != null){
                    confirmWslScriptEnded(bashScriptPid)
                }
                await chopsticksClosed;
                logSuccessOrFail(testParam.transferParams, false, fromChainName, destinationChainName, transferCurrency)
                logToFile("----------------------")
                console.log("Failed test. Stopping chopsticks instance")
                await disconnectApis(sourceChainApi, destChainApi)
                
            } finally {
                await disconnectApis(sourceChainApi, destChainApi)
            }
            await disconnectApis(sourceChainApi, destChainApi)
        }
    }
}

async function getTestExceptions(sourceChain: number){
    let testExceptions = JSON.parse(fs.readFileSync('./scripts/testConfigs.json', 'utf8'));
    let sourceChainTestExceptions = testExceptions.find((testException: any) => {
        return testException.sourceChain == sourceChain
    })
    console.log(sourceChainTestExceptions)
    return sourceChainTestExceptions
}

async function executeTest(sourceApi: ApiPromise, chopsticksInstance: ChildProcess | null, testParams: TransferParams){
    logToFile("Executing XCM transfer test")

    if(chopsticksInstance == null){
        throw logError(new Error("Chopsticks instance is null when executing test"))
    }

    await sourceApi.isReady;
    let xcmTx: paraspell.Extrinsic;
    if(testParams.type == "paraToRelay" && testParams.address){
        xcmTx = paraspell.Builder(sourceApi).from(testParams.from).amount(testParams.amount).address(testParams.address).build()
    } else if(testParams.to != "Kusama" && testParams.to != undefined && testParams.from != testParams.to && testParams.type == "paraToPara" && testParams.currency != undefined && testParams.amount != undefined && testParams.address != undefined){
        xcmTx = paraspell.Builder(sourceApi).from(testParams.from).to(testParams.to).currency(testParams.currency).amount(testParams.amount).address(testParams.address).build()
    } else{
        console.log("Invalid test params, Maybe relay to para" )
        sourceApi.disconnect()
        throw logError(new Error("Invalid test params, Maybe relay to para"))
    }

    if(!xcmTx){
        sourceApi.disconnect()
        throw logError(new Error("XCM TX is null"))
    }

    let fromChainName = testParams.from;
    let privateKey = "0x5fb92d6e98884f76de468fa3f6278f8807c48bebc13595d45af5bdc4da702133"
    let keyring;
    let alice;
    if(fromChainName == "Moonriver"){
        const index = 0;
        let ethDerPath = `m/44'/60'/0'/0/${index}`;
        keyring = new Keyring({ type: 'ethereum' });
        alice = keyring.addFromUri(`${privateKey}/${ethDerPath}`);
    } else {
        keyring = new Keyring({ type: 'sr25519' });
        alice = keyring.addFromUri('//Alice');
    }
    if(xcmTx != null){
        let keyring = fromChainName === "Moonriver" ? new Keyring({ type: 'ethereum' }) : new Keyring({ type: 'sr25519' });
        let alice = fromChainName === "Moonriver" ? keyring.addFromUri(`${privateKey}/m/44'/60'/0'/0/0`) : keyring.addFromUri('//Alice');
        let txResult: any= new Promise((resolve, reject) => {
            // const keyring = new Keyring({ type: 'sr25519' });
            // const alice = keyring.addFromUri('//Alice');
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
                    if(dispatchError){
                        logError(new Error(JSON.stringify(dispatchError, null, 2)), "Dispatch error in XCM transfer test")
                    }
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
                } else {
                    console.log(`🤷 Other status ${status}`);
                }
            });
        });
        let txDetails: TxDetails = await txResult;
        sourceApi.disconnect()
        return txDetails;
    } else {
        sourceApi.disconnect()
        throw logError(new Error("XCM TX is null"))
    }

}

async function constructXcmTransferTests(sourceChain: number){
    let transferrableAssetObjects: TransferrableAssetObject[] = await getTransferrableAssetsForSourceChain(sourceChain)
    let testParams: XcmTestParams[] = transferrableAssetObjects
    .filter((transferrableAssetObject: TransferrableAssetObject) => {
        // Only include the objects that don't match the condition you want to skip
        return !(transferrableAssetObject.assetRegistryObject.tokenData.chain == 2023 && transferrableAssetObject.assetRegistryObject.tokenData.symbol == "ZLK");
    })
    .map((transferrableAssetObject: TransferrableAssetObject) => {
        let chopsticksCommand = constructChopsticksParams(sourceChain, transferrableAssetObject.originChainParaId);
        let transferParams = constructTransferParams(sourceChain, transferrableAssetObject);
        return {chopsticksCommand, transferParams};
    });
    let testsToRun: XcmTestParams[] = [];
    let alreadySuccessfulTests = await JSON.parse(await fs.readFileSync('./scripts/success.json', 'utf8'))
    alreadySuccessfulTests.forEach((test: any) => {
        console.log(`Source chain: ${test.from} --- Destination chain: ${test.to} --- Asset: ${test.currency}`)
    })
    testParams.forEach((testParam: any) => {
        let alreadySuccess = alreadySuccessfulTests.find((successfulTest: any) => {
            if(
                testParam.transferParams.from == successfulTest.from
                && testParam.transferParams.to == successfulTest.to 
                && testParam.transferParams.currency == successfulTest.currency
            ){
                // console.log("Already ran test")
                // console.log(`Source chain: ${testParam.transferParams.from} --- Destination chain: ${testParam.transferParams.to} --- Asset: ${testParam.transferParams.currency}`)
                return true
            }
        })
        if(!alreadySuccess){
            testsToRun.push(testParam)
        }
        
    })
    console.log("Tests to run: ")
    testsToRun.forEach((testParam: any) => {
        console.log(`Source chain: ${testParam.transferParams.from} --- Destination chain: ${testParam.transferParams.to} --- Asset: ${testParam.transferParams.currency}`)
        if(testParam.transferParams.to == undefined || testParam.transferParams.currency == undefined){
            console.log("********UNDEFINED TRANSFER PARAMS********")
            console.log(JSON.stringify(testParam, null, 2))
            console.log("*****************************************")
        }
    })
    return testsToRun

}


function constructTransferParams(sourceChain: number, transferrableAssetObject: TransferrableAssetObject): TransferParams{
    if(!transferrableAssetObject.paraspellAssetSymbol.symbol){
        console.log("Transferrable Asset Object: " + JSON.stringify(transferrableAssetObject))
        throw logError(new Error("Asset symbol is null. Cant find asset registry object from allAssets in paraspell assets list"))
    }
    const assetDecimals = paraspell.getAssetDecimals(transferrableAssetObject.sourceParaspellChainName, transferrableAssetObject.paraspellAssetSymbol.symbol)
    
    if(transferrableAssetObject.paraspellAssetSymbol.symbol == "PHA"){
        console.log("PHALA *********")
        console.log(transferrableAssetObject)
    }
    
    let assetTxAmount = new FixedPointNumber(1,Number(assetDecimals)).toChainData()

    // MGX only works with certain amounts, likely a chopsticks thing
    if(transferrableAssetObject.paraspellAssetSymbol.symbol == "MGX"){
        assetTxAmount = new FixedPointNumber(10,Number(assetDecimals)).toChainData()
    }
    if(transferrableAssetObject.paraspellAssetSymbol.symbol == "KBTC"){
        assetTxAmount = new FixedPointNumber(0.001,Number(assetDecimals)).toChainData()
    }
    //Transfer to relay
    if(transferrableAssetObject.originChainParaId == 0){

        // Builder(api).from(NODE).amount(amount).address(address).build()
        let transferParams: TransferParams = {
            type: "paraToRelay",
            from: transferrableAssetObject.sourceParaspellChainName,
            amount: assetTxAmount,
            address: aliceAddress,
            transferrableAssetObject: transferrableAssetObject
        }
        return transferParams
    //Make sure destination chain is not source chain, tranfer para to para
    // } else if(assetObject.originChainParaId != sourceChain){
    } else {
        // let nodeOneEndpoints = paraspell.getNodeEndpointOption(nodeOne)
        // const wsProvider = new WsProvider(wsLocalKarura)
        // let api =  await ApiPromise.create({ provider: wsProvider })


    
        // const xcmTx = paraspell.Builder(api).from("Karura").to("BifrostKusama").currency(asset).amount(karAmount).address(aliceAddress).build()

        let transferParams: TransferParams = {
            type: "paraToPara",
            from: transferrableAssetObject.sourceParaspellChainName,
            to: transferrableAssetObject.originParaspellChainName,
            currency: transferrableAssetObject.paraspellAssetSymbol.symbol,
            amount: assetTxAmount,
            address: aliceAddress,
            transferrableAssetObject: transferrableAssetObject
        }
        return transferParams
    }
}

function constructChopsticksParams(sourceChain: number, destinationChain: number){
    const chainData: any[] = JSON.parse(fs.readFileSync(path.join(__dirname, '../kusamaParachainInfo.json'), 'utf8'))
    let sourceParachainInfo;
    let destinationParachainInfo
    for (const [chainKey, chain] of Object.entries(chainData)) {
        if(chain.paraID == sourceChain){
            sourceParachainInfo = chain;
        }
        if(chain.paraID == destinationChain){
            destinationParachainInfo = chain;
        }
    }

    if (!sourceParachainInfo || !destinationParachainInfo) {
        console.log(`Source chain: ${sourceChain} --- Destination chain: ${destinationChain}`)
        throw logError(new Error('Chain not found'));
    }

    // let chainOneYmlConfig = `configs/${sourceParachainInfo.id}.yml`
    // let chainTwoYmlConfig = `configs/${destinationParachainInfo.id}.yml`
    // const chopstickStartCommand = `cd ~/workspace/chopsticks && yarn start xcm -r configs/kusama.yml -p ${chainOneYmlConfig} -p ${chainTwoYmlConfig}`
    const chopstickStartCommand = `cd ~/workspace && bash start_chopsticks.sh ${sourceParachainInfo.id} ${destinationParachainInfo.id}`;
    return chopstickStartCommand

    
    
}

async function getTransferrableAssetsForSourceChain(sourceChain: number): Promise<TransferrableAssetObject[]>{
    let assetRegistry = JSON.parse(await fs.readFileSync('./allAssets.json', 'utf8'))
    let transferrableAssets: MyAssetRegistryObject[] = assetRegistry.filter((asset: MyAssetRegistryObject) => {
        return asset.tokenData.chain == sourceChain && asset.hasLocation == true
    })
    let paraspellChainName = getParaspellKsmChainNameByParaId(sourceChain)
    let paraspellAssetSymbols = paraspell.getAllAssetsSymbols(paraspellChainName)
    console.log(`Transferrable assets for ${paraspellChainName} -- ${sourceChain}`)
    let transferrableAssetObjects: TransferrableAssetObject[] = transferrableAssets.map((asset: any) => {
        // let paraspellChainName = getParaspellKsmChainNameByParaId(asset.tokenData.chain)
        let paraspellAssetSymbol = getParaspellAssetFromAssetRegistryObject(paraspellChainName, asset.tokenData.symbol)
        let originChain = findValueByKey(asset, "Parachain")
        if(!originChain){
            originChain = 0
        }
        let originParaspellChainName: OriginParaspellChainName = originChain === 0 ? "Kusama" : getParaspellKsmChainNameByParaId(originChain)
        console.log(`Paraspell Asset Symbol: ${paraspellAssetSymbol?.symbol} --- Asset Registry Object: ${JSON.stringify(asset.tokenData.localId)} --- Origin Chain: ${originChain}`)  
        // getTNode(originParaspellChainName)
        if(paraspellAssetSymbol == null){
            paraspellAssetSymbol = {
                symbol: undefined,
                assetId: undefined
            }
            // throw new Error("Paraspell asset symbol is null. Could not find symbol: " + asset.tokenData.symbol)
        }
        
        let transferrableAssetObject: TransferrableAssetObject = {
            sourceParaspellChainName: paraspellChainName,
            assetRegistryObject: asset,
            paraspellAssetSymbol: paraspellAssetSymbol,
            originChainParaId: originChain,
            originParaspellChainName: originParaspellChainName
        }
        return transferrableAssetObject
    })
    return transferrableAssetObjects
}
function getParaspellKsmChainNameByParaId(chainId: number): TNode{
    let chain =  paraspell.NODE_NAMES.find((node) => {
      return paraspell.getParaId(node) == chainId && paraspell.getRelayChainSymbol(node) == "KSM"  
    })
    return chain as TNode
}
function getOriginChainForAssetSymbol(assetSymbol: string){
    let assets = JSON.parse(fs.readFileSync('./allAssets.json', 'utf8'))
    let assetData = assets.find((asset: any) => {
        return asset.tokenData.symbol == assetSymbol
    })
    // console.log(assetData)
    return assetData
}
function getParaspellAssetFromAssetRegistryObject(paraspellChainName: TNode, assetSymbol: any){
    let assetSymbolOrId = getAssetBySymbolOrId(paraspellChainName, assetSymbol)
    return assetSymbolOrId
    // If cant get asset symbol, 
    // if(assetSymbolOrId == undefined){

    // }
    
}

const getAssetBySymbolOrId = (
    node: TNode,
    symbolOrId: string | number
  ): { symbol?: string; assetId?: string } | null => {
    const { otherAssets, nativeAssets, relayChainAssetSymbol } = getAssetsObject(node)
    
    const asset = [...otherAssets, ...nativeAssets].find(
      ({ symbol, assetId }) => {
        console.log("Asset symobl or id " + JSON.stringify(symbolOrId) + " --- " + symbol + " --- " + assetId)
        if(typeof symbolOrId === 'string'){
            return symbol?.toLowerCase() === symbolOrId.toLowerCase() || assetId?.toLowerCase() === symbolOrId.toLowerCase()
        }
        else{
            return symbol === symbolOrId.toString() || assetId === symbolOrId.toString()
        }
    })
  
    if (asset !== undefined) {
      const { symbol, assetId } = asset
      return { symbol, assetId }
    }
  
    if (relayChainAssetSymbol === symbolOrId) return { symbol: relayChainAssetSymbol }
  
    return null
}


function findValueByKey(obj: any, targetKey: any): any {
    if (typeof obj !== 'object' || obj === null) {
        return null;
    }
    for (let key in obj) {
        if (key === targetKey) {
            return obj[key];
        }

        let foundValue: any = findValueByKey(obj[key], targetKey);
        if (foundValue !== null) {
            return foundValue;
        }
    }
    return null;
}

async function getChopstickPorts(chopsticksInstance: ChildProcess | null, scenario: string){
    printAndLogToFile("Getting ports")
    if(chopsticksInstance == null){
        throw logError(new Error("Chopsticks instance is null when getting ports"))
    }
    let portOne: number;
    let portTwo: number;
    let portThree: number;
    let isConnected = false;
    let connectedParachains = 0;

        // Create a promise that resolves when isConnected becomes true
    const isConnectedPromise = new Promise<{portOne: number, portTwo: number, portThree: number}>((resolve, reject) => {
        chopsticksInstance.stdout?.on('data', async (data) => {
            const output = data.toString();
            console.log(`stdout: ${output}`);
            if (output.includes("RPC listening on")){
                if(!portOne){
                    portOne = Number.parseInt(output.split(" ").pop() as string);
                } else if (!portTwo) {
                    portTwo = Number.parseInt(output.split(" ").pop() as string);
                } else {
                    portThree = Number.parseInt(output.split(" ").pop() as string);
                }
            }
            if (output.includes("Connected relaychain")) {
                if(scenario != "paraToPara"){
                    chopsticksConnected = true;
                    console.log('Chopsticks connected. Continuing with the script...');
                    resolve({portOne, portTwo, portThree});
                }
                isConnected = true;
                connectedParachains++;
                if(connectedParachains == 2){
                    chopsticksConnected = true;
                    console.log('Chopsticks connected. Continuing with the script...');
                    resolve({portOne, portTwo, portThree});
                }
                
            }
        })
    });
    // Wait for the promise to resolve
    const ports = await isConnectedPromise;
    return ports;
}

function runChopsticksInstance(chopsticksCommand: string, fromChain: string, toChain: string): ChildProcess {
    console.log("Running chopsticks...");
    // const chopstickStartCommand = `cd ~/workspace && bash start_chopsticks.sh ${fromChain} ${toChain}`;
    console.log(` Chopsticks start command: ${chopsticksCommand}`)
    chopsticksProcess = spawn('wsl', ['bash', '-l', '-c', chopsticksCommand]);
    // chopsticksProcess = spawn('wsl', ['bash', '-l', '-c', chopstickStartCommand]);
    chopsticksProcess.stderr?.on('data', (data) => {
        console.error(`stderr: ${data}`);
    });
    chopsticksProcess.stdout?.on('data', (data) => {
        // console.log(`stdout: ${data}`);

        const output = data.toString();
        const lines = output.split('\n');
        
        lines.forEach((line: string) => {
            if (line.startsWith("Bash script PID:")) {
                bashScriptPid = line.split(':')[1].trim();
                console.log(`Captured Bash script PID: ${bashScriptPid}`);
            } else if (line.startsWith("Chopsticks PID:")) {
                chopsticksPid = line.split(':')[1].trim();
                console.log(`Captured Chopsticks PID: ${chopsticksPid}`);
            }
        });

    });

    chopsticksProcess.on('close', (code) => {
        console.log(`Chopsticks process exited with code ${code}`);
        chopsticksProcess = null;
    });
    console.log("Chopsticks process started")
    return chopsticksProcess
}
async function runChopsticksInstance2(fromChain: string, toChain: string): Promise<boolean>{
    return new Promise((resolve, reject) => {
        let connectedParachains = 0;
        const chopstickStartCommand = `cd ~/workspace && bash start_chopsticks.sh ${fromChain} ${toChain}`;
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
                    bashScriptPid = line.split(':')[1].trim();
                    console.log(`Captured Bash script PID: ${bashScriptPid}`);
                } else if (line.startsWith("Chopsticks PID:")) {
                    chopsticksPid = line.split(':')[1].trim();
                    console.log(`Captured Chopsticks PID: ${chopsticksPid}`);
                }
            });

            if(output.includes("Connected relaychain 'Kusama'")){
                connectedParachains++;
                if(connectedParachains == 2){
                    chopsticksConnected = true;
                    console.log("Chopsticks connected");
                    resolve(true);
                }
            }

        });
        chopsticksProcess.on('exit', (code, signal) => {
            console.log(`Child process exited with code ${code} and signal ${signal}`);
            reject(false);
        });
        console.log("Windows process ID: " + chopsticksProcess.pid)
    });
    
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
                throw logError(new Error("Script PID not found. Should be initiated already"))
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
async function confirmWslScriptEnded(processId: string | null){
    if(!processId){
        throw logError(new Error("Script PID not found. Should be initiated already"))
        
    } else {
        let processRunning = await checkProcessInWSL(processId)
        if(processRunning){
            console.log("Script still running. Waiting 5 seconds...")
            setTimeout(() => {
                return confirmWslScriptEnded(processId)
            }, 5000);
        } else {
            console.log("Confirmed script ended. Continuing...")
            bashScriptPid = null;
            chopsticksPid = null;
            return true
        }
    }
}
async function stopChopsticks() {
    logToFile("Executing stopChopsticks()")
    
    let scriptProcessRunning = await checkProcessInWSL(bashScriptPid)
    let chopsticksProcessRunning = await checkProcessInWSL(chopsticksPid)
    if(scriptProcessRunning){
        console.log("Script process running")
        let bashScriptKilled = await killProcessInWslTermSync(Number(bashScriptPid))
        console.log("Bash script killed: " + bashScriptKilled)
    }
    if(chopsticksConnected){
        let wslProcessesKilled = await killProcessInWslTermSync(Number(bashScriptPid)); // Will block script until finished
        chopsticksProcess?.kill('SIGTERM');
        return wslProcessesKilled
        
    }
    sourceChainApi?.disconnect()
    destChainApi?.disconnect()

    sourceChainApi = null;
    destChainApi = null;

    console.log("Windows process: " + chopsticksProcess?.pid)
    console.log("Returning false")
    return false
}

function waitForChopsticksToClose(): Promise<void> {
    logToFile("Stopping chopsticks instance. Initiated waitForChopsticksToClose promise")

    return new Promise((resolve, reject) => {
        if (!chopsticksProcess) {
            resolve();
            return;
        }

        chopsticksProcess.on('close', (code) => {
            console.log(`Chopsticks process exited with code ${code}`);
            chopsticksProcess = null;
            resolve();
        });

        chopsticksProcess.on('error', (error) => {
            console.error(`Chopsticks process encountered an error: ${error}`);
            logError(error, "Chopsticks process encountered an error")
            reject(error);
        });
    });
}

async function testListen(){
    let ws = localHost + "8000";
    let provider = new WsProvider(ws);
    // let provider2 = new WsProvider("wss://bifrost-rpc.liebi.com/ws");
    let api = new ApiPromise({provider});
    await api.isReady;


    console.log(api.registry.chainTokens)
    api.disconnect()

    provider = new WsProvider(wsLocalFrom);
    let api2 = new ApiPromise({provider});
    await api2.isReady;

    console.log(api2.registry.chainTokens)
    api2.disconnect()
    // let destChainWs = `ws://172.26.130.75:8009`;
    // // let bfAdapter = new BifrostAdapter();
    // let provider = new WsProvider(destChainWs);
    // let destChainApi = new ApiPromise({provider});
}
async function run(){
    runXcmTransferTests(2023)
}
run()
async function checkDepositOnTargerChain(token: string){
    const wsProvider = new WsProvider(wsLocalFrom)
    let api =  await ApiPromise.create({ provider: wsProvider })
    await api.isReady
    
    let targetChainNativeAsset = api.registry.chainTokens[0];
    if(token == targetChainNativeAsset){
        console.log("Token is native asset")
        let balanceData = await api.query.system.account(aliceAddress);
        console.log(balanceData.toHuman());
    } else {
        console.log("Token is not native asset")
        let balanceData = await api.query.tokens.accounts(aliceAddress, token);
    }
    api.disconnect()
}

async function getExtrinsicInfo(blockHash: string, txHash: string, api: ApiPromise){
    const block = await api.rpc.chain.getBlock(blockHash)
    console.log("BLOCK INFO")
    console.log(block.toHuman())
    const extrinsic = block.block.extrinsics.find((ex) => {
        console.log(`${ex.hash.toHex()} --- ${txHash}`);
        return ex.hash.toHex() == txHash
    })
    if(!extrinsic){
        throw logError(new Error("Cant find tx hash"))
    }
    console.log("EXTRINSIC INFO")
    console.log(extrinsic.toHuman())
    console.log(extrinsic.toHex())
}
function killProcessInWslTermSync(wslPid: number) {
    try {
        const stdout = execSync(`wsl kill -TERM ${wslPid}`);
        console.log(`stdout: ${stdout}`);
        return true
    } catch (error: any) {
        // Error will include the entire stdout and stderr as part of the message
        console.error(`Error: ${error.message}`);
        logError(error, "Error in killProcessInWslTermSync()")
        return false
    }
}
// Handle script exit
process.on('SIGINT', async () => {
    console.log('Received SIGINT. Stopping Chopsticks...');
    await stopChopsticks();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('Received SIGTERM. Stopping Chopsticks...');
    stopChopsticks();
    process.exit(0);
});

process.on('exit', () => {
    console.log('Exiting. Stopping Chopsticks...');
    stopChopsticks();
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    logError(reason as Error, "Unhandled Rejection")
    // Application specific logging, throwing an error, or other logic here
});
