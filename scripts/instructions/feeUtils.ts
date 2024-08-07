import fs from 'fs'
import { WsProvider, ApiPromise, Keyring, ApiRx } from '@polkadot/api'
import path from 'path';
import { cryptoWaitReady } from "@polkadot/util-crypto"
import { getParaspellChainName, getAssetRegistryObject, readLogData, getAssetRegistryObjectBySymbol, getSigner, printInstruction, increaseIndex, getLastSuccessfulNodeFromResultData, printExtrinsicSetResults, getLatestFileFromLatestDay, constructRouteFromFile, getLastSuccessfulNodeFromAllExtrinsics, getNodeFromChainId, getTotalArbResultAmount, getLatestTargetFileKusama, getLatestAsyncFilesKusama, getLatestTargetFilePolkadot, getLatestAsyncFilesPolkadot, constructRouteFromJson, printAllocations, printInstructionSet, getChainIdFromNode, findValueByKey } from './utils.ts'
import { MyAssetRegistryObject, MyAsset, AssetNodeData, InstructionType, SwapInstruction, TransferInstruction, TransferToHomeThenDestInstruction, TxDetails, TransferToHomeChainInstruction, TransferParams, TransferAwayFromHomeChainInstruction, TransferrableAssetObject, TransferTxStats, BalanceChangeStats, SwapTxStats, SwapExtrinsicContainer, ExtrinsicObject, ChainNonces, TransferExtrinsicContainer, SwapResultObject, ExtrinsicSetResult, IndexObject, ArbExecutionResult, PathNodeValues, LastNode, SingleExtrinsicResultData, SingleTransferResultData, SingleSwapResultData, ExtrinsicSetResultDynamic, ExecutionState, LastFilePath, PreExecutionTransfer, TransactionState, TransferProperties, SwapProperties, AsyncFileData, Relay, JsonPathNode, TransferEventData, DepositEventData, PromiseTracker } from './types.ts'
import { AssetNode } from './AssetNode.ts'
import { allocateKsmFromPreTransferPaths, buildInstructionSet, buildInstructions, getPreTransferPath, getTransferrableAssetObject } from './instructionUtils.ts';
import * as paraspell from '@paraspell/sdk';
import { arb_wallet_kusama, dotNodeKeys, dotTargetNode, ksmRpc, ksmTargetNode, kusamaNodeKeys, live_wallet_3, localRpcs, mainWalletAddress, mainWalletEthAddress, testBncNode, testNets, testZlkNode } from './txConsts.ts';
import { buildSwapExtrinsicDynamic, buildTransferExtrinsicDynamic, buildTransferExtrinsicReworked, buildTransferKsmToChain, buildTransferToKsm, createSwapExtrinsicObject, createTransferExtrinsicObject } from './extrinsicUtils.ts';
import { EventRecord } from "@polkadot/types/interfaces"
import { fileURLToPath } from 'url';
// import { BalanceChangeStatue } from 'src/types.ts';
import { logSwapTxStats, logSwapTxResults, logTransferTxStats, logArbExecutionResults, logInstructions, logSubmittableExtrinsics, logAllResultsDynamic, logProfits, logLastFilePath, updateFeeBook } from './logUtils.ts';
import { runAndReturnFallbackArb, runAndReturnTargetArb, runArbFallback } from './executeArbFallback.ts';
import { Mangata, MangataInstance } from '@mangata-finance/sdk';
import { reverse } from 'dns';
import { buildAndExecuteSwapExtrinsic, checkAndAllocateRelayToken, confirmLastTransactionSuccess, executeAndReturnExtrinsic, executeSingleSwapExtrinsic, executeSingleSwapExtrinsicMovr, executeSingleTransferExtrinsic, executeTransferTx } from './executionUtils.ts';
// import { liveWallet3Pk } from 'scripts/swaps/movr/utils/const.ts';
import { TNode, getParaId } from '@paraspell/sdk';
import { BN } from '@polkadot/util/bn/bn';
import { FixedPointNumber } from '@acala-network/sdk-core';
import { movrContractAddress, xcKarContractAddress, xcXrtContractAddress } from './../swaps/movr/utils/const.ts';
import { formatMovrTx, getMovrSwapTx, testXcTokensMoonriver } from './../swaps/movr/movrSwap.ts';
// import { getBsxSwapExtrinsic, testBsxSwap } from './../swaps/bsxSwap.ts';
import '@galacticcouncil/api-augment/basilisk';
import { getApiForNode } from './apiUtils.ts';
import { setLastExtrinsicSet, getLastExecutionState, setExecutionSuccess } from './globalStateUtils.ts';
import { getBalanceChange, watchTokenBalance } from './balanceUtils.ts';
import bn, { BigNumber } from 'bignumber.js'
import { ManagerSwapParams } from './../swaps/glmr/utils/types.ts';
import { executeSingleGlmrSwap } from './../swaps/glmr/glmrSwap.ts';
import { getAdapter } from '@polkawallet/bridge';
import { firstValueFrom, Observable, timeout } from "rxjs";
import { FrameSystemEventRecord } from '@polkadot/types/lookup';
import { depositEventDictionary, transferEventDictionary, TransferEventDictionary, TransferEvent } from './feeConsts.ts';



// export async function watchDepositEvents(destApi: ApiPromise, xcmpMessageHash: string, chainId: TNode | "Polkadot" | "Kusama") {
//     let eventRecords: FrameSystemEventRecord[] = []
//     if (chainId === "AssetHubPolkadot") {
//         eventRecords = await listenForXcmpEventStatemint(destApi, xcmpMessageHash)
//         return getStatemintDepositFees(eventRecords)
//     } else if (chainId === "Acala") {
//         eventRecords = await listenForXcmpEventAcala(destApi, xcmpMessageHash)
//         return getAcalaDepositFees(eventRecords)
//     } else if (chainId === "Moonbeam") {
//         eventRecords = await listenForXcmpEventMoonbeam(destApi, xcmpMessageHash)
//         return getMoonbeamDepositFees(eventRecords)
//     } else if (chainId === "HydraDX") {
//         eventRecords = await listenForXcmpEventHydra(destApi, xcmpMessageHash)
//         return getHydraDepositFees(eventRecords)
//     } else {
//         console.log("Invalid chain ID")
//     }

// }

// Flow of getting deposit and fee amounts from xcm transfers by listening to events on the receiving chain
// 1. Execute transfer
// 2. Listen for events on destination chain
// -- Add each event to array until xcm event with message id is found
// -- Reverse and return array
// -- i.e. Dont have easy way to only return events for our xcm extrinsic. We may get other unrelated events before the xcm extrinsic event, so instead of returning the array as is,
// -- reverse the array. This way the deposit and fee events will always be at the same position in the array. 
// 3. Filter events for deposit and fee events
// -- Each chain handles xcm transfers in their own way.
// -- DMP (Transfers from relay chain) and HRMP/XCMP (Transfers from parachains) have different event structures
// -- Once we have array of events, we need to filter for the deposit event and fee event.
// -- Create database/dictionary that stores the section/method/position of the deposit and fee events for each chain (Both DMP and HRMP)
// -- Filter events by specified section, method, and position. Get deposit and fee amounts 



// listens for deposit events and gets the deposit and fee amounts
export async function listenForXcmpEventForNode(api: ApiPromise, node: TNode | "Polkadot" | "Kusama", transferType: "dmp" | "hrmp" | "ump", assetSymbol: string, assetDecimals: number, assetObject: MyAssetRegistryObject, depositAddress: string, balanceDepositTracker: PromiseTracker, xcmpMessageHash?: string, xcmpMessageId?: string): Promise<DepositEventData> {
    if(transferType === "hrmp" && !xcmpMessageHash && !xcmpMessageId){
        throw new Error("HRMP transfers require XCMP message hash")
    }
    let nativeChainToken = api.registry.chainTokens[0]
    let tokenType = assetSymbol.toUpperCase() == nativeChainToken.toUpperCase() ? "native" : "tokens" 

    // let nodeEventData = depositEventDictionary[node][transferType][tokenType]
    let nodeEventData
    if(transferType === "hrmp"){
        nodeEventData = depositEventDictionary[node]?.[transferType]?.[tokenType] ?? null;
    } else {
        nodeEventData = depositEventDictionary[node][transferType] ?? null
    }
    if(!nodeEventData){
        console.log(`Deposit type ${transferType} not avaiable for ${node}`)
        throw new Error("Invalid node or transfer type")
    }

    let xcmEventSection = nodeEventData.xcm.section

    let eventRecords: FrameSystemEventRecord[] = []
    let eventListener: Promise<FrameSystemEventRecord[]> = new Promise(async (resolve, reject) => {
        let eventPromiseResolved;
        const unsubscribe = await api.query.system.events((events) => {
            
            events.forEach((record) => {
                eventRecords.push(record)
                const { event, phase } = record;

                if(event.section === "common"){
                    // console.log(`COMMON EVENT: ${JSON.stringify(event, null, 2)}`)
                }
                if (event.section === xcmEventSection) {
                    console.log("Found xcm event")
                    if(nodeEventData.xcm.idIndex !== -1){
                        // Comparing message hash of 
                        try{
                            const messageHash = event.data[nodeEventData.xcm.idIndex].toString();
                            if (messageHash.toString() === xcmpMessageHash || messageHash.toString() === xcmpMessageId) {
                                console.log("Found xcm event")
                                eventPromiseResolved = true
                                unsubscribe(); // Stop listening for events
                                resolve(eventRecords);
                            }
                        } catch (error){
                            console.log("*********** ERROR *************8")
                            console.log(`Can't find xcm deposit even in registry for ${node} | ${transferType} | ${tokenType}`)
                            console.log("Registry Node Data:")
                            console.log(JSON.stringify(nodeEventData, null, 2))
                            console.log("Event:")
                            console.log(JSON.stringify(event.toHuman(), null, 2))
                            console.log("Event data: " + JSON.stringify(event.data.toHuman(), null, 2))
                            eventPromiseResolved = true
                            console.log(`Trying to match against registry xcmpMessage id/hash ${xcmpMessageId} | ${xcmpMessageHash}`)
                            console.log(`*** Problem usually cant find ID index: ${nodeEventData.xcm.idIndex} in event.data: ${JSON.stringify(event.data.toHuman())}`)
                            unsubscribe()
                            reject(error)
                        }

                    } else {
                        // Found xcm event without working message id, so check if the deposit is to the correct address to confirm we have the correct event

                        let reversedEventArray = eventRecords.map((event) => event).reverse()
                        let depositEvent = reversedEventArray.filter((event) => event.event.section === nodeEventData.deposit.section && event.event.method === nodeEventData.deposit.method)[nodeEventData.deposit.index]
                        let eventDepositAddress = depositEvent.event.data[nodeEventData.deposit.addressIndex].toString()
                        if(eventDepositAddress === depositAddress){
                            eventPromiseResolved = true
                            unsubscribe(); // Stop listening for events
                            resolve(eventRecords);
                        }
                    }
                }
            });
            let balanceDepositResolve = balanceDepositTracker.isResolved()
            console.log("Reached end of deposit events, no xcm event found")
            console.log(`BALANCE DEPOSIT RESOLVED: ${balanceDepositResolve}`)
            // events.forEach((event) => {
            //     console.log(`Event: ${event.event.section} | ${event.event.method} | ${event.phase.toString()}`)
            // })

            // If balance deposit has resolved true, and we haven't found the xcm event, then reject the promise
            if(balanceDepositResolve){
                console.log("Balance deposit has resolved")
                if(!eventPromiseResolved){
                    console.log("Balance deposit has resolved, but no xcm event found")
                    unsubscribe()
                    reject("No xcm event found")
                }
            }
        });
    });

    let events;
    try {
        events = await eventListener;
    } catch (error) {
        console.error("Error listening for XCMP event:", error);
        throw new Error("Failed to listen for XCMP event");
    }

    if(!events){
        throw new Error("No events found");
    }

    events = events.reverse()

    // If ACALA, if deposit is ACA then events are differnt

    // Get deposit and fee amounts
    let depositEvent = events.filter((event) => event.event.section === nodeEventData.deposit.section && event.event.method === nodeEventData.deposit.method)[nodeEventData.deposit.index]
    let depositAmount = depositEvent.event.data[nodeEventData.deposit.amountIndex]

    // CRUST/NODLE withdraws full transfer amount from sibling reserve account, then deposits the amount minus fee to the wallet. There is no fee event, so we need to handle this case
    let feeAmount
    if(nodeEventData.fee.index === -1){
        console.log("No fee event detected")
        feeAmount = new BN(0)
    } else {
        let feeEvent = events.filter((event) => event.event.section === nodeEventData.fee.section && event.event.method === nodeEventData.fee.method)[nodeEventData.fee.index]
        feeAmount = new bn(feeEvent.event.data[nodeEventData.fee.amountIndex].toString())

        // CRUST/NODLE fee amount will be the full amount, thus larger than the deposit amount
        if(feeAmount.gt(depositAmount)){
            // console.log("Fee amount is larger than deposit amount. Fee amount will be the full deposit amount")
            feeAmount = new bn(feeAmount).minus(new bn(depositAmount.toString()))
        }
    }

    let depositEventData: DepositEventData = {
        depositAmount: new bn(depositAmount.toString()),
        feeAmount: feeAmount,
        assetSymbol: assetSymbol,
        assetId: assetObject.tokenData.localId,
        assetDecimals: assetDecimals,
        node: node
    }
    console.log(`DEPOSIT EVENT SUCCESS: Deposit amount: ${depositEventData.depositAmount.toString()} | Fee amount: ${depositEventData.feeAmount.toString()}`)

    return depositEventData

}

export function getXcmTransferEventData(node: TNode | "Polkadot" | "Kusama", transferredAssetSymbol: string, transferredAssetObject: MyAssetRegistryObject, nativeCurrencySymbol: string, events: EventRecord[], relay: Relay): TransferEventData{
    let eventRecords = events.map((event) => event).reverse()

    let nodeFeeEvents = transferEventDictionary[node].feeEvents
    let totalFees = new bn(0)

    nodeFeeEvents.forEach((feeEvent) => {
        let feeEventData = events.find((eventRecord) => {
            if (eventRecord.event.section == feeEvent.section && eventRecord.event.method == feeEvent.method) return true
        })
        if(!feeEventData){
            throw new Error(`Cant find fee event data for ${feeEvent.section}.${feeEvent.method}`)
        } else {
            // console.log(`Found origin transfer fee event data: ${JSON.stringify(feeEventData, null, 2)}`)
        }
        let feeAmount = new bn(feeEventData.event.data[feeEvent.amountIndex].toString())
        // console.log(`Fee amount: ${feeAmount}`)
        totalFees = totalFees.plus(feeAmount)
    })

    // With ACALA, maybe others. different types of tokens. Any tokens that are native to the chain will have differnt events, so treat them as the native currency
    let assetOriginChainId
    let chainId = getChainIdFromNode(node)
    if(transferredAssetObject.tokenLocation == "here"){
        assetOriginChainId = 0
    } else {
        let parachain = findValueByKey(transferredAssetObject.tokenLocation, "Parachain")
        if(!parachain){
            throw new Error("Can't find origin chain for asset node: " + JSON.stringify(transferredAssetObject, null, 2))
        }
        assetOriginChainId = parseInt(parachain)
    }
    let nodeBalanceEvent
    if (transferredAssetSymbol === nativeCurrencySymbol){
        nodeBalanceEvent = transferEventDictionary[node].balanceEvents?.nativeCurrency ?? null
    } else {
        nodeBalanceEvent = assetOriginChainId == chainId ?
        transferEventDictionary[node].balanceEvents?.nativeTokens ?? null : 
        transferEventDictionary[node].balanceEvents?.foreignTokens ?? null
    } 
    if(!nodeBalanceEvent){
        throw new Error("Cant get Xcm Transfer execution event data from start chain")
    }
    // if(node == "Acala"){
    //     if (transferredAssetSymbol === nativeCurrencySymbol){
    //         nodeBalanceEvent = transferEventDictionary[node].balanceEvents.nativeCurrency
    //     } else {
    //         nodeBalanceEvent = assetOriginChainId == chainId ?
    //         transferEventDictionary[node].balanceEvents.nativeTokens : 
    //         transferEventDictionary[node].balanceEvents.foreignTokens
    //     }

    // } else {
    //     nodeBalanceEvent = transferredAssetSymbol === nativeCurrencySymbol ? 
    //         transferEventDictionary[node].balanceEvents.native : 
    //         transferEventDictionary[node].balanceEvents.tokens
    // }


    // console.log(`Node balance event: ${JSON.stringify(nodeBalanceEvent, null, 2)}`)
    // let nodeBalanceEvent: TransferEvent = transferEventDictionary[node].balanceEvents.native
    let balanceEvents = eventRecords.filter((event) => {
        // console.log(`Checking event: ${event.event.section} | ${event.event.method}`)
        if (event.event.section == nodeBalanceEvent.section && event.event.method == nodeBalanceEvent.method) {
            return true
        }
    })

    if(!balanceEvents){
        throw new Error(`Cant find transfer balance events for ${node} | ${transferredAssetSymbol}. `)
    }

    // console.log(`Balance events: ${JSON.stringify(balanceEvents)}`)

    let transferAmount = new bn(balanceEvents[nodeBalanceEvent.eventIndex].event.data[nodeBalanceEvent.amountIndex].toString())

    let nativeAssetObject = getAssetRegistryObjectBySymbol(chainId, nativeCurrencySymbol, relay)
    let feeAssetDecimals = nativeAssetObject.tokenData.decimals

    let transferAssetDecimals = transferredAssetObject.tokenData.decimals


    // console.log("Transfer amount: ", transferAmount.toString())
    // console.log(`Total fees: ${totalFees}`)
    let transferFee: TransferEventData = {
        transferAmount: transferAmount,
        transferAssetSymbol: transferredAssetSymbol,
        transferAssetId: transferredAssetObject.tokenData.localId,
        transferAssetDecimals: Number.parseInt(transferAssetDecimals),
        feeAmount: totalFees,
        feeAssetSymbol: nativeCurrencySymbol,
        feeAssetId: nativeAssetObject.tokenData.localId,
        feeAssetDecimals: Number.parseInt(feeAssetDecimals),
        node: node
    }
    return transferFee

}

// HYDRADX
export async function listenForXcmpEventOne(api: ApiPromise, xcmpMessageHash: string): Promise<FrameSystemEventRecord[]> {

    return new Promise(async (resolve) => {
        console.log(`Listening for XCMP message hash on the destination chain: ${xcmpMessageHash}`);
        
        const unsubscribe = await api.query.system.events((events) => {

            events.forEach((record) => {
                console.log("EVENT RECORD: " + JSON.stringify(record.toHuman(), null, 2))
                const { event, phase } = record;
                if (event.section === 'xcmpQueue') {
                    const [messageHash] = event.data;
                    if (messageHash.toString() === xcmpMessageHash) {
                        console.log(`XCMP message received on destination chain with hash: ${messageHash.toString()}`);
                        console.log(`Phase: ${phase.toString()}`);

                        const extrinsicIndex = phase.asApplyExtrinsic.toNumber();
                        const extrinsicEvents = events.filter(({ phase }) => phase.isApplyExtrinsic && phase.asApplyExtrinsic.eq(extrinsicIndex));
                        unsubscribe(); // Stop listening for events
                        resolve(extrinsicEvents);
                    }
                }
            });
        });
    });
}

// POLKADOT -> STATEMINT
// PARACHAIN -> STATEMINT, ACALA, MOONBEAM, POLKADOT, BIFROST
export async function listenForXcmpEventTwo(api: ApiPromise, xcmpMessageHash: string): Promise<FrameSystemEventRecord[]> {

    return new Promise(async (resolve) => {
        console.log(`Listening for XCMP message hash on the destination chain: ${xcmpMessageHash}`);
        let eventRecords: FrameSystemEventRecord[] = []
        const unsubscribe = await api.query.system.events((events) => {
            events.forEach((record) => {
                eventRecords.push(record)
                console.log("EVENT RECORD: " + JSON.stringify(record.toHuman(), null, 2))
                if (record.event.section === 'messageQueue') {
                    const [messageHash] = record.event.data;
                    if (messageHash.toString() === xcmpMessageHash) {
                        unsubscribe(); // Stop listening for events
                        resolve(eventRecords);
                    } else {
                        // Clear event records
                        eventRecords = []
                    }
                }
            });
        });
    });
}

// DMP from polkadot -> hydra, 
export async function listenForXcmpEventThree(api: ApiPromise, depositAddress: string): Promise<any[]> {
    
        let eventRecordsPromise: Promise<FrameSystemEventRecord[]>= new Promise(async (resolve) => {
            console.log(`Listening for XCMP message hash on the destination chain. Deposit Addres: ${depositAddress}`);
            let eventRecords: FrameSystemEventRecord[] = []
            const unsubscribe = await api.query.system.events((events) => {
                let foundDeposit = false
                events.forEach((record) => {
                    // When we find the deposit event matching address, the next deposit will be the fee
                    if(foundDeposit && record.event.section === 'currencies' && record.event.method === 'Deposited'){
                        eventRecords.push(record)
                        unsubscribe(); // Stop listening for events
                        resolve(eventRecords);
                    }
                    else if (record.event.section === 'currencies' && record.event.method === 'Deposited') {
                        console.log("Found deposit event")
                        console.log("EVENT RECORD: " + JSON.stringify(record.toHuman(), null, 2))
                        // console.log("Checking match against deposit address: ", depositAddress)
                        const [, who,] = record.event.data;
                        console.log(`Comparing ${who.toString()} to ${depositAddress}`)
                        if (who.toString() === depositAddress) {
                            console.log("FOUND DEPOSIT  ADDRESS")
                            foundDeposit = true
                            eventRecords.push(record)
                        }
                    }
                });
            });
        });
        let eventRecords = await eventRecordsPromise
        let depositEvent = eventRecords[0]
        let feeEvent = eventRecords[1]

        let [, , depositAmount] = depositEvent.event.data
        let [, , feeAmount] = feeEvent.event.data
        console.log(`Deposit amount: ${depositAmount.toString()} | Fee amount: ${feeAmount.toString()}`)
        return [depositAmount, feeAmount]
}

// DMP polkadot -> statemint
// export async function listenForXcmpEventFour(api: ApiPromise, depositAddress: string): Promise<any[]> {

// }

export async function getDepositFees(eventRecords: FrameSystemEventRecord[], node: TNode | "Polkadot" | "Kusama" ){
    let depositLookup = depositEventDictionary[node]
    let xcmEvents = eventRecords.filter((event) => event.event.section === 'currencies')

    // 0 - Amount deposited to wallet
    let depositEvent = xcmEvents[0]
    let [depositCurrentyId, depositWho, depositAmount] = depositEvent.event.data

    console.log(`Currency ID: ${depositCurrentyId.toString()} | who: ${depositWho.toString()} | amount: ${depositAmount.toString()}`)

    // 1 - Fee deducted from deposit
    let feeEvent = xcmEvents[1]
    let [feeCurrencyId, feeWho, feeAmount] = feeEvent.event.data

    console.log(`Fee Currency ID: ${feeCurrencyId.toString()} | who: ${feeWho.toString()} | amount: ${feeAmount.toString()}`)

    return [depositAmount, feeAmount]
}

// EXTRINSIC EVENTS
// Listens for event with XCM message hash, returns all events for that extrinsic
export async function listenForXcmpEventHydra(api: ApiPromise, xcmpMessageHash: string): Promise<FrameSystemEventRecord[]> {

    return new Promise(async (resolve) => {
        console.log(`Listening for XCMP message hash on the destination chain: ${xcmpMessageHash}`);
        
        const unsubscribe = await api.query.system.events((events) => {

            events.forEach((record) => {
                console.log("EVENT RECORD: " + JSON.stringify(record.toHuman(), null, 2))
                const { event, phase } = record;
                if (event.section === 'xcmpQueue') {
                    const [messageHash] = event.data;
                    if (messageHash.toString() === xcmpMessageHash) {
                        console.log(`XCMP message received on destination chain with hash: ${messageHash.toString()}`);
                        console.log(`Phase: ${phase.toString()}`);

                        const extrinsicIndex = phase.asApplyExtrinsic.toNumber();
                        const extrinsicEvents = events.filter(({ phase }) => phase.isApplyExtrinsic && phase.asApplyExtrinsic.eq(extrinsicIndex));
                        unsubscribe(); // Stop listening for events
                        resolve(extrinsicEvents);
                    }
                }
            });
        });
    });
}

// SYSTEM
// Listens for event with XCM message hash. Events are emitted consecutively, so the assetConversion.Swap and other events right before the xcm message hash event are the ones we want
export async function listenForXcmpEventStatemint(api: ApiPromise, xcmpMessageHash: string): Promise<FrameSystemEventRecord[]> {

    return new Promise(async (resolve) => {
        console.log(`Listening for XCMP message hash on the destination chain: ${xcmpMessageHash}`);
        let eventRecords: FrameSystemEventRecord[] = []
        const unsubscribe = await api.query.system.events((events) => {

            events.forEach((record) => {
                eventRecords.push(record)
                console.log("EVENT RECORD: " + JSON.stringify(record.toHuman(), null, 2))
                const { event, phase } = record;
                if (event.section === 'messageQueue') {
                    const [messageHash] = event.data;
                    if (messageHash.toString() === xcmpMessageHash) {
                        console.log(`XCMP message received on destination chain with hash: ${messageHash.toString()}`);
                        console.log(`Phase: ${phase.toString()}`);
                        unsubscribe(); // Stop listening for events
                        resolve(eventRecords);
                    } else {
                        // Clear event records
                        eventRecords = []
                    }
                }
            });
        });
    });
}

// SYSTEM
// Listens for event with XCM message hash. Events are emitted consecutively, so the assetConversion.Swap and other events right before the xcm message hash event are the ones we want
export async function listenForXcmpEventAcala(api: ApiPromise, xcmpMessageHash: string): Promise<FrameSystemEventRecord[]> {

    return new Promise(async (resolve) => {
        console.log(`Listening for XCMP message hash on the destination chain: ${xcmpMessageHash}`);
        let eventRecords: FrameSystemEventRecord[] = []
        const unsubscribe = await api.query.system.events((events) => {

            events.forEach((record) => {
                eventRecords.push(record)
                console.log("EVENT RECORD: " + JSON.stringify(record.toHuman(), null, 2))
                const { event, phase } = record;
                if (event.section === 'messageQueue') {
                    const [messageHash] = event.data;
                    if (messageHash.toString() === xcmpMessageHash) {
                        console.log(`XCMP message received on destination chain with hash: ${messageHash.toString()}`);
                        console.log(`Phase: ${phase.toString()}`);
                        unsubscribe(); // Stop listening for events
                        resolve(eventRecords);
                    } else {
                        // Clear event records
                        eventRecords = []
                    }
                }
            });
        });
    });
}

// SYSTEM EVENTS
export async function listenForXcmpEventMoonbeam(api: ApiPromise, xcmpMessageHash: string): Promise<FrameSystemEventRecord[]> {

    return new Promise(async (resolve) => {
        console.log(`Listening for XCMP message hash on the destination chain: ${xcmpMessageHash}`);
        let eventRecords: FrameSystemEventRecord[] = []
        const unsubscribe = await api.query.system.events((events) => {

            events.forEach((record) => {
                eventRecords.push(record)
                console.log("EVENT RECORD: " + JSON.stringify(record.toHuman(), null, 2))
                const { event, phase } = record;
                if (event.section === 'messageQueue') {
                    const [messageHash] = event.data;
                    if (messageHash.toString() === xcmpMessageHash) {
                        console.log(`XCMP message received on destination chain with hash: ${messageHash.toString()}`);
                        console.log(`Phase: ${phase.toString()}`);
                        unsubscribe(); // Stop listening for events
                        resolve(eventRecords);
                    } else {
                        // Clear event records
                        eventRecords = []
                    }
                }
            });
        });
    });
}

export async function listenForXcmpTransferPolkadot(api: ApiPromise) {

    return new Promise(async (resolve) => {
        // console.log(`Listening for XCMP message hash on the destination chain: ${xcmpMessageHash}`);
        let eventRecords: FrameSystemEventRecord[] = []
        const unsubscribe = await api.query.system.events((events) => {

            events.forEach((record) => {
                eventRecords.push(record)
                // console.log("EVENT RECORD: " + JSON.stringify(record.toHuman(), null, 2))
                const { event, phase } = record;
                if (event.section === 'xcmPallet' && event.method == "Sent") {
                    const [origin, destination, message, messageHash] = event.data;
                    console.log(`Origin chain: ${origin.toString()}`)
                    console.log(`Destination chain: ${destination.toString()}`)
                    console.log(`Message: ${message.toString()}`)
                    console.log(`Message hash: ${messageHash.toString()}`)
                    let eventData = {
                        origin: origin,
                        destination: destination,
                        message: message,
                        messageHash: messageHash
                    }
                    unsubscribe(); // Stop listening for events
                    resolve(eventData);
                    // if (messageHash.toString() === xcmpMessageHash) {
                    //     console.log(`XCMP message received on destination chain with hash: ${messageHash.toString()}`);
                    //     console.log(`Phase: ${phase.toString()}`);
                    //     unsubscribe(); // Stop listening for events
                    //     resolve(eventRecords);
                    // } else {
                    //     // Clear event records
                    //     eventRecords = []
                    // }
                }
            });
        });
    });
}




export async function getHydraDepositFees(eventRecords: FrameSystemEventRecord[]){
    let xcmEvents = eventRecords.filter((event) => event.event.section === 'currencies')

    // 0 - Amount deposited to wallet
    let depositEvent = xcmEvents[0]
    let [depositCurrentyId, depositWho, depositAmount] = depositEvent.event.data

    console.log(`Currency ID: ${depositCurrentyId.toString()} | who: ${depositWho.toString()} | amount: ${depositAmount.toString()}`)

    // 1 - Fee deducted from deposit
    let feeEvent = xcmEvents[1]
    let [feeCurrencyId, feeWho, feeAmount] = feeEvent.event.data

    console.log(`Fee Currency ID: ${feeCurrencyId.toString()} | who: ${feeWho.toString()} | amount: ${feeAmount.toString()}`)

    return [depositAmount, feeAmount]
}

export async function getStatemintDepositFees(eventRecords: FrameSystemEventRecord[]){
    let xcmEvents = eventRecords.filter((event) => event.event.section === 'assetConversion')
    let assetConversion = xcmEvents[0]
    let [feeAmount, amountOut, path] = assetConversion.event.data

    console.log(`Amount in: ${feeAmount.toString()} | Amount Out: ${amountOut.toString()}`)

    
    let depositEvent = eventRecords.filter((event) => event.event.section === 'assets' && event.event.method === 'Issued')
    let [assetId, owner, depositAmount] = depositEvent[0].event.data

    console.log(`Asset ID: ${assetId.toString()} | Owner: ${owner.toString()} | Amount: ${depositAmount.toString()}`)
    return [depositAmount, feeAmount]
}

export async function getAcalaDepositFees(eventRecords: FrameSystemEventRecord[], node: TNode | "Polkadot" | "Kusama"){
    
    let xcmEvents = eventRecords.filter((event) => event.event.section === 'balances' && event.event.method === 'Deposit')

    // 0 - Amount deposited to wallet
    let depositEvent = xcmEvents[0]
    let [depositWho, depositAmount] = depositEvent.event.data

    console.log(`deposit amount: ${depositAmount.toString()}`)

    // 1 - Fee deducted from deposit
    let feeEvent = xcmEvents[1]
    let [feeWho, feeAmount] = feeEvent.event.data

    console.log(`Fee amount: ${feeAmount.toString()}`)

    return [depositAmount, feeAmount]
} 

export async function getMoonbeamDepositFees(eventRecords: FrameSystemEventRecord[]){
    let xcmEvents = eventRecords.filter((event) => event.event.section === 'assets' && event.event.method === 'Issued')

    // 0 - Amount deposited to wallet
    let depositEvent = xcmEvents[0]
    let [assetId, depositWho, depositAmount] = depositEvent.event.data

    console.log("Moonbeam")
    console.log(`Deposit amount: ${depositAmount.toString()}`)

    // 1 - Fee deducted from deposit
    let feeEvent = xcmEvents[1]
    let [feeAssetId, feeWho, feeAmount] = feeEvent.event.data

    console.log(`Fee amount: ${feeAmount.toString()}`)

    return [depositAmount, feeAmount]
} 

export async function getPolkadotDepositFees(eventRecords: FrameSystemEventRecord[]){
    let xcmEvents = eventRecords.filter((event) => event.event.section === 'assets' && event.event.method === 'Issued')

    // 0 - Amount deposited to wallet
    let depositEvent = xcmEvents[0]
    let [assetId, depositWho, depositAmount] = depositEvent.event.data

    console.log("Moonbeam")
    console.log(`Deposit amount: ${depositAmount.toString()}`)

    // 1 - Fee deducted from deposit
    let feeEvent = xcmEvents[1]
    let [feeAssetId, feeWho, feeAmount] = feeEvent.event.data

    console.log(`Fee amount: ${feeAmount.toString()}`)

    return [depositAmount, feeAmount]
} 

export function getTransferType(startChain: TNode | "Polkadot" | "Kusama", destChain: TNode | "Polkadot" | "Kusama"): "dmp" | "hrmp" | "ump" {
    if (startChain == "Kusama" || startChain == "Polkadot"){
        return "dmp"
    } else if (destChain == "Kusama" || destChain ==  "Polkadot"){
        return "ump"
    } else {
        return "hrmp"
    }
}