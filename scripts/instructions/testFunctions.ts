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

// async function runDynamicArbTester(chopsticks: boolean){
//     let latestFile = getLatestFileFromLatestDay()
//     let assetPath = constructRoute(latestFile)
//     // let reverse
//     let instructionsPromise = await buildInstructionSet(assetPath)
//     let executeMovr = false
//     let testLoops = 100
//     let totalArbResults: ArbExecutionResult[] = []
//     let executionResults: ExtrinsicSetResultDynamic = await buildAndExecuteExtrinsics(instructionsPromise, chopsticks, executeMovr, testLoops)
//     executionResults.extrinsicData.forEach((extrinsicData) => {
//         totalArbResults.push(extrinsicData.arbExecutionResult)
//     })
//     logResultsDynamic(executionResults, latestFile, false)
//     console.log("Execution success: " + executionResults.success)
//     let lastNode = executionResults.lastSuccessfulNode
//     console.log(`Last Node: ${JSON.stringify(executionResults.lastSuccessfulNode)}`)
//     if(lastNode.chainId == 0){
//         console.log("Last node chain is KUSAMA. Cant find arb with that. Can just exit successfully")
//     } else {
//         let functionArgs = `${lastNode.assetKey} ${ksmTargetNode} ${lastNode.assetValue}`
//         console.log("Executing Arb Fallback with args: " + functionArgs)

//         let fallbackArbResults: ResultDataObject[] = await runAndReturnFallbackArb(functionArgs, chopsticks)

//         console.log("Fallback Arb Results: ")
//         console.log(JSON.stringify(fallbackArbResults, null, 2))

//         let assetPath: AssetNode[] = fallbackArbResults.map(result => readLogData(result))
    
//         console.log("Asset Path: ")
//         console.log(JSON.stringify(assetPath, null, 2))
    
//         let reverseInstructions = await buildInstructionSet(assetPath)
    
//         let reverseExtrinsicResult = await buildAndExecuteExtrinsics(reverseInstructions, chopsticks, executeMovr, 100)
//         logResultsDynamic(reverseExtrinsicResult, latestFile, true)

//         console.log("ORIGIN EXTRINSICS")
//         printExtrinsicSetResults(executionResults.extrinsicData)
//         console.log("REVERSE EXTRINSICS")
//         printExtrinsicSetResults(reverseExtrinsicResult.extrinsicData)
//         console.log(`Last Node: ${JSON.stringify(executionResults.lastSuccessfulNode)}`)
//         console.log(`Last Node Reverse: ${JSON.stringify(reverseExtrinsicResult.lastSuccessfulNode)}`)
//     // let arbResults = executionResults.extrinsicData.forEach((extrinsicData) => {
//     //     console.log(extrinsicData.arbExecutionResult)
//     // })
//     }
// }

// async function testKarXrtPath(chopsticks: boolean, movr: boolean){
//     let testRouteFilePath = path.join(__dirname, './testMovrPath.json')
//     let route = constructRoute(testRouteFilePath)
//     let instructions = await buildInstructionSet(route)
//     let swapInstructions: SwapInstruction[] = instructions.map((instruction) => {
//         return instruction as SwapInstruction
//     })
//     let inputSwapInstructions = [swapInstructions[1]]
//     let chainNonces: ChainNonces = {
//         2000: 0,
//         2023: 0,
//         2001: 0,
//         2090: 0,
//         2110: 0,
//         2085: 0
//     }
//     let  txIndex: IndexObject = {i: 0}
//     let instructionIndex: number[] = []
//     let movrTx = await getMovrSwapTx(inputSwapInstructions, chopsticks)
//     let swapContainer = await formatMovrTx(movrTx, inputSwapInstructions, chainNonces, txIndex, instructionIndex,chopsticks)
//     console.log(JSON.stringify(swapContainer.movrBatchSwapParams, null, 2))
//     let extrinsicObj: ExtrinsicObject = await createSwapExtrinsicObject(swapContainer)

//     let movrTxResult = await executeSingleSwapExtrinsicMovr(extrinsicObj, txIndex, true)
//     console.log(movrTxResult)
//     // let testLoops = 100
//     // let allExtrinsicSets: ExtrinsicSetResultDynamic[] = []
//     // let executionResults: ExtrinsicSetResultDynamic = await buildAndExecuteExtrinsics(instructions, chopsticks, movr, testLoops)
//     // allExtrinsicSets.push(executionResults)
//     // logAllResultsDynamic(allExtrinsicSets, testRouteFilePath, true)
// }

async function testMovrBatchSwap(){
    let tokenPath = [xcKarContractAddress, movrContractAddress, xcXrtContractAddress ]
    await testXcTokensMoonriver(tokenPath, 0.3, 50)
}
async function testBalance(){
    let apiEndpoints = getEndpointsForChain(2000)
    let provider = new WsProvider(apiEndpoints[0])
    const api = await ApiPromise.create({ provider: provider });
    await api.isReady

    let wallet = await getSigner(false, false)

    let balance = await getBalance(2000, false, api, "KAR", "Karura", wallet.address)
    console.log("Balance: " + JSON.stringify(balance, null, 2))
}

async function testDotWallet(){
    
    const ksmRpc = 'wss://kusama-rpc.dwellir.com'
    const provider = new WsProvider(ksmRpc)
    const api = await ApiPromise.create({ provider })
    await api.isReady
    await cryptoWaitReady()

    let keyring = new Keyring({ type: 'sr25519' });
    let walletKey = arb_wallet
    let liveWallet = keyring.addFromMnemonic(walletKey)


    let recipientAddress = mainWalletAddress
    let transferAmount = 10n ** 10n // 0.01 KSM

    let transferTx = api.tx.balances.transferKeepAlive(recipientAddress, transferAmount)
    let txReceipt = await transferTx.signAndSend(liveWallet, ({ events = [], status }) => {
        if (status.isInBlock) {
            console.log('Successful transfer of ' + transferAmount + ' with hash ' + status.asInBlock.toHex());
            // console.log('Events:', JSON.stringify(events.toHuman(), null, 2));
        }
    });
}

async function testMovrWallet(){
    // const movrRpc = 'wss://moonriver.api.onfinality.io/public-ws'
    // const provider = new WsProvider(movrRpc)
    // const api = await ApiPromise.create({ provider })
    // await api.isReady
    // await cryptoWaitReady()

    // let keyring = new Keyring({ type: 'sr25519' });
    // let walletKey = liveWallet3Pk
    // let liveWallet = keyring.addFromMnemonic(walletKey)

    let liveWallet = await getSigner(false, true)

    console.log("Live Wallet: " + JSON.stringify(liveWallet.address, null, 2))

    // let recipientAddress = mainWalletEthAddress
    // let transferAmount = 10n ** 10n // 0.01 KSM

    // let transferTx = api.tx.balances.transferKeepAlive(recipientAddress, transferAmount)
    // let txReceipt = await transferTx.signAndSend(liveWallet, ({ events = [], status }) => {
    //     if (status.isInBlock) {
    //         console.log('Successful transfer of ' + transferAmount + ' with hash ' + status.asInBlock.toHex());
    //         // console.log('Events:', JSON.stringify(events.toHuman(), null, 2));
    //     }
    // });
    // console.log("Tx Receipt: " + JSON.stringify(txReceipt, null, 2))
}

async function testEndpoints(node: TNode | "Kusama", chopsticks: boolean){
    let apiEndpoint: string[];
    if(node == "Kusama"){
        apiEndpoint = [ksmRpc]
        // throw new Error("Trying to transfer kusama away from home chain to kusama")
    } else{
        apiEndpoint = paraspell.getAllNodeProviders(node)
    }
    
    // -- But initialize test endpoints until real
    if(chopsticks){
        let localRpc = localRpcs[node]
        if(localRpc){
            apiEndpoint = localRpc
        }
    }

    let api: ApiPromise;
    // if(node == "Mangata"){
    //     const MangataSDK = await import('@mangata-finance/sdk')
    //     api = await MangataSDK.Mangata.instance([apiEndpoint[1]]).api()
    // } else {
    //     let provider = new WsProvider(apiEndpoint)
    //     api = await ApiPromise.create({ provider: provider });
    // }
    let apiSet = await connectFirstApi(apiEndpoint, 2110)
    api = apiSet.promise
    await api.isReady
    return api
}

async function testMovrTx(){
    // let wallet = await getSigner(true, true)
    // const index = 0;
    // let ethDerPath = `m/44'/60'/0'/0/${index}`;
    // let keyring = new Keyring({ type: 'ethereum' });
    // // let wallet = keyring.addFromUri(`${live_wallet_3}/${ethDerPath}`);
    // // console.log(live_wallet_3)
    // let wallet = keyring.addFromUri(`${live_wallet_3}`);
    let wallet = await getSigner(false, true)
    let recipientAddress = mainWalletAddress
    // let amount = 10n ** 17n // 0.1 MOVR

    let assetSymbol = "MOVR"
    let localrpc = localRpcs["Moonriver"]
    let movrApiEndpoints = paraspell.getAllNodeProviders("Moonriver")
    let provider = new WsProvider(movrApiEndpoints[0])
    let api = await ApiPromise.create({ provider: provider });
    await api.isReady

    let fromChain: TNode = "Moonriver"
    let toChain: TNode = "ParallelHeiko"
    let assetSymbolOrId = getAssetBySymbolOrId(fromChain, "MOVR")
    console.log("Asset Symbol or Id: ")
    console.log(assetSymbolOrId)
    if(!assetSymbolOrId){
        throw new Error("Cant find asset symbol or id")
    }
    let currencyParameter = assetSymbolOrId.assetId ?? assetSymbolOrId.symbol

    let decimals = paraspell.getAssetDecimals(fromChain, assetSymbol);
    let amount = new FixedPointNumber(0.01, Number(decimals));

    let address = wallet.address
    console.log("Address: " + address)
    const xcmTx = paraspell.Builder(api).from(fromChain).to(toChain).currency(currencyParameter).amount(amount.toChainData()).address(recipientAddress).build()

    let unsubscribeOne
    let balanceObservable$ = await watchTokenBalance(2023, false, api, "XCKAR", "Moonriver", wallet.address)
    // let balanceChage = await getBalanceChange(balanceObservable$)
    let balancePromise = await getBalanceChange(balanceObservable$, (unsub) => {
        unsubscribeOne = unsub
    })

    let tokenBalanceChange = await balancePromise
    console.log("Balance Change: " + JSON.stringify(tokenBalanceChange, null, 2))
    // let txResult: any= new Promise((resolve, reject) => {
    //     let success = false;
    //     let included: EventRecord[] = [];
    //     let finalized: EventRecord[] = [];
    //     let eventLogs: any[] = [];
    //     let blockHash: string = "";
    //     let dispatchErrorCode;
    //     let decodedError;
    //     console.log(`Execute Transfer: Sending tx -- ${JSON.stringify(xcmTx.toHuman())}`)
    //     xcmTx.signAndSend(wallet, ({ events = [], status, txHash, txIndex, dispatchError }) => {
    //         if (status.isInBlock) {
    //             success = dispatchError ? false : true;
    //             console.log(
    //                 `Execute Transfer: 📀 Transaction ${xcmTx.meta.name}(..) included at blockHash ${status.asInBlock} [success = ${success}]`
    //             );
    //             included = [...events];

    //         } else if (status.isBroadcast) {
    //             console.log(`Execute Transfer: 🚀 Transaction broadcasted.`);
    //         } else if (status.isFinalized) {
    //             console.log(
    //                 `Execute Transfer: 💯 Transaction ${xcmTx.meta.name}(..) Finalized at blockHash ${status.asFinalized}`
    //             );
    //             blockHash = status.asFinalized.toString();
    //             finalized = [...events];
    //             events.forEach((eventObj) => {
    //                 eventLogs.push(eventObj.toHuman())
    //                 if(eventObj.event.method == "ExtrinsicFailed" && dispatchError){
    //                     const {index, error} = dispatchError.asModule;
    //                     const moduleIndex = parseInt(index.toString(), 10);
    //                     const errorCodeHex = error.toString().substring(2, 4); // "09"
    //                     const errorIndex = parseInt(errorCodeHex, 16);

    //                     // Get the module and error metadata
    //                     decodedError = xcmTx.registry.findMetaError({index: new BN(moduleIndex), error: new BN(errorIndex)});
    //                     dispatchErrorCode = dispatchError.asModule;
    //                     console.log("Execute Transfer: Dispatch Error: " + dispatchError.toString())
    //                     console.log("Execute Transfer: DECODED MODULE: " + JSON.stringify(decodedError, null, 2))
    //                 }
    //             })
    //             const hash = status.hash;
    //             let txDetails: TxDetails = { success, hash, dispatchError: dispatchErrorCode, decodedError, included, finalized, eventLogs, blockHash, txHash, txIndex };
    //             resolve(txDetails);
    //         } else if (status.isReady) {
    //             // let's not be too noisy..
    //             console.log("Execute Transfer: Status: Ready")
    //         } else if (dispatchError){
    //             console.log("Execute Transfer: Dispatch error: " + dispatchError.toString())
    //             if(dispatchError.isModule){
    //                 const decoded = xcmTx.registry.findMetaError(dispatchError.asModule);
    //                 console.log("Execute Transfer: DISPATCH ERROR DECODED: " + JSON.stringify(decoded, null, 2))
    //                 const { docs, name, section } = decoded;
    //                 reject(new Error(`${section}.${name}: ${docs.join(' ')}`));
    //             } else {
    //                 reject(new Error(dispatchError.toString()));
    //             }
    //         }
    //         else {
    //             console.log(`Execute Transfer: 🤷 Other status ${status}`);
    //         }
    //     }).catch((error) => {
    //         console.log("Execute Transfer: Error: " + error);
    //         reject(error);
    //     });
    // });
    // let hash = await txResult
    // console.log("Tx Result: " + JSON.stringify(hash, null, 2))
}
async function testBsxTx(){
    let testRouteFilePath = path.join(__dirname, './testBsxPath.json')
    let route = constructRoute(testRouteFilePath)
    let instructions = await buildInstructionSet(route)
    let swapInstructions: SwapInstruction[] = instructions.map((instruction) => {
        return instruction as SwapInstruction
    })
    let inputSwapInstructions = [swapInstructions[1]]
    let chainNonces: ChainNonces = {
        2000: 0,
        2023: 0,
        2001: 0,
        2090: 0,
        2110: 0,
        2085: 0
    }
    let  txIndex: IndexObject = {i: 0}
    let instructionIndex: number[] = []
    let bsxTx = await testBsxSwap(swapInstructions, true)
    console.log(bsxTx.toHuman())
}
async function testZlkFallback(){
    let functionArgs = `${testZlkNode} ${ksmTargetNode} 10`
    console.log("Calling arb fallback function")
    let fallbackArbResults = await runAndReturnFallbackArb(functionArgs, false)

    console.log("Fallback Arb Results: ")
    console.log(JSON.stringify(fallbackArbResults, null, 2))

}
async function logProfitTest(){

    let testDay = "testDay35"
    let testAmount = 1.145
    let profitLogDatabase = {}
    profitLogDatabase[testDay] = testAmount
    console.log("PROFIT LOG DATABASE")
    console.log(profitLogDatabase)

    let profitFilePath = path.join(__dirname, './liveSwapExecutionStats', 'profitStats.json')
    profitLogDatabase = JSON.parse(fs.readFileSync(profitFilePath, 'utf8'))
    profitLogDatabase[testDay] = testAmount
    fs.writeFileSync(profitFilePath, JSON.stringify(profitLogDatabase, null, 2))

}
async function testFallback(){
    let functionArgs = `${testBncNode} ${ksmTargetNode} 10`
    console.log("Calling arb fallback function")
    let fallbackArbResults = await runAndReturnFallbackArb(functionArgs, true)

}

// async function testKsmBalances(){
//     let ksmBalances = await getKsmBalancesAcrossChains()
//     console.log(ksmBalances)
// }
// async function testPreTransfers(chopsticks: boolean, executeMovr: boolean){
//     await getPreTransferPath(2000, 0.12, true)
//     let preTransferFile = path.join(__dirname, './preTransferNodes.json') 
//     let assetPath = constructRoute(preTransferFile)
//     let instructions = await buildInstructionSet(assetPath)
//     // let executeMovr = false
//     let testLoops = 100
//     let allExtrinsicSets: ExtrinsicSetResultDynamic[] = []
//     let executionResults: ExtrinsicSetResultDynamic = await buildAndExecuteExtrinsics(instructions, chopsticks, executeMovr, testLoops)
//     // executionResults.extrinsicData = executionResults.extrinsicData.reverse()
// }
// async function testAllocateAndExecute(chopsticks: boolean, executeMovr: boolean){
//     let small = false
//     let latestFile = getLatestFileFromLatestDay(small)
//     console.log("Latest File: ", latestFile)
//     let assetPath = constructRoute(latestFile)
    
//     let instructions = await buildInstructionSet(assetPath)
//     let instructionsAbreviated = await getFirstKsmNode(instructions, chopsticks)
//     let firstInstruction = instructionsAbreviated[0]
//     let startChain = firstInstruction.assetNodes[0].getChainId()
//     let startValue = firstInstruction.assetNodes[0].pathValue
//     console.log("Start Chain: ", startChain)
//     console.log("Start Value: ", startValue)
//     let ksmBalances = await getKsmBalancesAcrossChains(chopsticks)
//     console.log(ksmBalances)

//     let executionInstructions = instructionsAbreviated
//     if(ksmBalances[startChain] > startValue){
//         console.log("StartNode has sufficient start balance")
//     } else {
//         console.log("StartNode has insufficient start balance. Need to allocate")
//         let prePath = await getPreTransferPath(startChain, startValue, chopsticks, ksmBalances)
//         let executionPath = prePath.concat(assetPath)
//         executionInstructions = await buildInstructionSet(executionPath)
//     }

//     executionInstructions.forEach((instruction) => {
//         console.log(instruction.type)
//         instruction.assetNodes.forEach((node) => {
//             console.log(`${node.getAssetRegistrySymbol()} ${node.getChainId()}`)
//         })
//     })

//     // let preTransfers = await getPreTransferPath(2000, 0.05, chopsticks)
//     // // let executeMovr = false
//     let testLoops = 100
//     let allExtrinsicSets: ExtrinsicSetResultDynamic[] = []
//     let executionResults: ExtrinsicSetResultDynamic = await buildAndExecuteExtrinsics(executionInstructions, chopsticks, executeMovr, testLoops)
//     // executionResults.extrinsicData = executionResults.extrinsicData.reverse()
//     // // logResultsDynamic(executionResults, latestFile, false)
    
//     allExtrinsicSets.push(executionResults)
//     // logLastFilePath(latestFile)
//     setLastFile(latestFile)
//     logAllResultsDynamic(allExtrinsicSets, latestFile, true)
//     logAllArbAttempts(allExtrinsicSets, latestFile, chopsticks)
//     // let arbSuccess = executionResults.success
//     // let lastNode = globalState.lastNode
// }