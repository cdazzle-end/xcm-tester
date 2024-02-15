import { EventRecord } from '@polkadot/types/interfaces';
import { BN } from '@polkadot/util/bn';
import { localRpcs } from './txConsts';
import { TxDetails, TransferrableAssetObject } from './types';
import { getSigner, getAssetRegistryObjectBySymbol, getAssetBySymbolOrId, watchTokenDeposit, getBalanceChange, watchTokenBalance } from './utils';
import * as paraspell from '@paraspell/sdk'
async function testMgxTransfer(){
    let endpoint = localRpcs["Mangata"]
    console.log(`MANGATA Endpoint: ${endpoint}`)
    let provider = new WsProvider(endpoint)
    let api =  await ApiPromise.create({ provider: provider });
    const MangataSDK = await import('@mangata-finance/sdk')
    const instance = await MangataSDK.Mangata.instance([endpoint]).api()
    // let mgxApi = paraspell.getNode("Mangata")
    await instance.isReady

    let assets = await instance.query.assetRegistry.metadata.entries()
    console.log("ASSETS")
    console.log(JSON.stringify(assets, null, 2))

    let signer = await getSigner();
    let xcmTx = paraspell.Builder(instance).from("Mangata").to("AssetHubKusama").currency("USDT").amount(2665463).address(signer.address).build()
    console.log(`TX: ${JSON.stringify(xcmTx.toHuman(), null, 2)}`)
    let txResult: any= new Promise((resolve, reject) => {
        let success = false;
        let included: EventRecord[] = [];
        let finalized: EventRecord[] = [];
        let eventLogs: any[] = [];
        let blockHash: string = "";
        let dispatchErrorCode;
        let decodedError;
        xcmTx.signAndSend(signer, ({ events = [], status, txHash, txIndex, dispatchError }) => {
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
                events.forEach((eventObj) => {
                    eventLogs.push(eventObj.toHuman())
                    if(eventObj.event.method == "ExtrinsicFailed" && dispatchError){
                        const {index, error} = dispatchError.asModule;
                        const moduleIndex = parseInt(index.toString(), 10);
                        const errorCodeHex = error.toString().substring(2, 4); // "09"
                        const errorIndex = parseInt(errorCodeHex, 16);

                        // Get the module and error metadata
                        decodedError = xcmTx.registry.findMetaError({index: new BN(moduleIndex), error: new BN(errorIndex)});
                        dispatchErrorCode = dispatchError.asModule;
                        console.log("Dispatch Error: " + dispatchError.toString())
                        console.log("DECODED MODULE: " + JSON.stringify(decodedError, null, 2))

                    }
                })
                const hash = status.hash;
                let txDetails: TxDetails = { success, hash, dispatchError: dispatchErrorCode, decodedError, included, finalized, eventLogs, blockHash, txHash, txIndex };
                resolve(txDetails);
            } else if (status.isReady) {
                // let's not be too noisy..
            } else if (dispatchError){
                console.log("Dispatch error: " + dispatchError.toString())
                if(dispatchError.isModule){
                    const decoded = xcmTx.registry.findMetaError(dispatchError.asModule);
                    console.log("DISPATCH ERROR DECODED: " + JSON.stringify(decoded, null, 2))
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
    console.log("TX DETAILS")
    console.log(JSON.stringify(txDetails, null, 2))
    return txDetails
}
async function testKsmTransfer(){
    let endpoint = localRpcs["Kusama"]
    console.log(`KSM Endpoint: ${endpoint}`)
    let provider = new WsProvider(endpoint)
    let api =  await ApiPromise.create({ provider: provider });

    let mgxEndpoint = localRpcs["Mangata"]
    const MangataSDK = await import('@mangata-finance/sdk')
    const instance = await MangataSDK.Mangata.instance([mgxEndpoint]).api()
    
    // let mgxApi = paraspell.getNode("Mangata")
    await instance.isReady
    await api.isReady


    // // let assets = await instance.query.assetRegistry.metadata.entries()
    // console.log("ASSETS")
    // console.log(JSON.stringify(assets, null, 2))
    let mgxAssetRegistryObj = getAssetRegistryObjectBySymbol(2110, "KSM")
    let transferObject: TransferrableAssetObject = {
        sourceParaspellChainName: "Kusama",
        originParaspellChainName: "Kusama",
        originChainParaId:0,
        paraspellAsset: getAssetBySymbolOrId("Mangata", "KSM"),
        assetRegistryObject: mgxAssetRegistryObj
        
    }
    let signer = await getSigner();
    let balanceObservable$ = await watchTokenDeposit(2110, instance, 0, transferObject, signer.address)
    
    let xcmTx = paraspell.Builder(api).to("Mangata").amount(77741956653).address(signer.address).build()
    console.log(`TX: ${JSON.stringify(xcmTx.toHuman(), null, 2)}`)
    let txResult: any= new Promise((resolve, reject) => {
        let success = false;
        let included: EventRecord[] = [];
        let finalized: EventRecord[] = [];
        let eventLogs: any[] = [];
        let blockHash: string = "";
        let dispatchErrorCode;
        let decodedError;
        xcmTx.signAndSend(signer, ({ events = [], status, txHash, txIndex, dispatchError }) => {
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
                events.forEach((eventObj) => {
                    eventLogs.push(eventObj.toHuman())
                    if(eventObj.event.method == "ExtrinsicFailed" && dispatchError){
                        const {index, error} = dispatchError.asModule;
                        const moduleIndex = parseInt(index.toString(), 10);
                        const errorCodeHex = error.toString().substring(2, 4); // "09"
                        const errorIndex = parseInt(errorCodeHex, 16);

                        // Get the module and error metadata
                        decodedError = xcmTx.registry.findMetaError({index: new BN(moduleIndex), error: new BN(errorIndex)});
                        dispatchErrorCode = dispatchError.asModule;
                        console.log("Dispatch Error: " + dispatchError.toString())
                        console.log("DECODED MODULE: " + JSON.stringify(decodedError, null, 2))

                    }
                })
                const hash = status.hash;
                let txDetails: TxDetails = { success, hash, dispatchError: dispatchErrorCode, decodedError, included, finalized, eventLogs, blockHash, txHash, txIndex };
                resolve(txDetails);
            } else if (status.isReady) {
                // let's not be too noisy..
            } else if (dispatchError){
                console.log("Dispatch error: " + dispatchError.toString())
                if(dispatchError.isModule){
                    const decoded = xcmTx.registry.findMetaError(dispatchError.asModule);
                    console.log("DISPATCH ERROR DECODED: " + JSON.stringify(decoded, null, 2))
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
    
    let balanceUnsubscribe;
    let balanceChange = await getBalanceChange(balanceObservable$, (unsub) => {
        balanceUnsubscribe = unsub;
    })
    console.log("Balance Change: " + JSON.stringify(balanceChange, null, 2))
    let txDetails: TxDetails = await txResult;
    // console.log("TX DETAILS")
    // console.log(JSON.stringify(txDetails, null, 2))
    return txDetails
}

// async function testProviders(){
//     let endpoints = getEndpointsForChain(2000)
//     const api = await connectFirstApi(endpoints, 2000)
//     // let api = promiseApis[2000]
//     await api.promise.isReady
//     if(api.promise.isConnected){
//         console.log("API promise isConnected = true")
//     } else {
//         console.log("Not connected to Karura")
//         await api.promise.disconnect()
//     }

//     await api.observable.isReady
//     if(api.observable.isConnected){
//         console.log("Api observable isConnected = true")
//     } else {
//         console.log("Not connected to Karura")
//         await api.observable.disconnect()
//     }

//     console.log("Waiting 10 seconds...")
//     await delay(10000)

//     // Check API connections
//     allConnections.forEach((connection, endpoint) => {
//         if (connection.isConnected) {
//             console.log(`API with endpoint ${endpoint} is still connected.`);
//             if(endpoint == api.promiseEndpoint){
//                 console.log("Primary connection promise")
//             } else {
//                 console.log("Disconnecting api")
//                 connection.disconnect();
//             }
//         } else {
//             console.log(`API with endpoint ${endpoint} is not connected.`);
//         }
//     });

//     console.log("Waiting 10 seconds...")
//     await delay(10000)

//     allConnections.forEach((connection, endpoint) => {
//         if (connection.isConnected) {
//             console.log(`API with endpoint ${endpoint} is still connected.`);
//             if(endpoint == api.promiseEndpoint){
//                 console.log("Primary connection promise. Disconnecting...")
//                 connection.disconnect();
//             } else {
//                 console.log("Disconnecting api")
//                 connection.disconnect();
//             }
//         } else {
//             console.log(`API with endpoint ${endpoint} is not connected.`);
//         }
//     });
// }

async function testMovrBalance(){
    let chainId = 2023
    let provider = new WsProvider("wss://moonriver.unitedbloc.com")
    let api = await ApiPromise.create({ provider })
    await api.isReady

    let tokenSymbol = "MOVR"
    let unsubscribe;
    let balanceObservable$ = await watchTokenBalance(2023, api, tokenSymbol, "Moonriver", "0x1A73c8A6aBd21b5cD8969a531E2Ace452cbA5f73")
    let balanceChangePromise = getBalanceChange(balanceObservable$, (unsub) => {
        unsubscribe = unsub
    })

    let balanceChange = await balanceChangePromise
    console.log("BALANCE CHANGE")
    console.log(JSON.stringify(balanceChange, null, 2))

    // let assetSymbol = "M
    
}

