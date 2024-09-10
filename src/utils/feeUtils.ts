import { ApiPromise } from '@polkadot/api';
import { EventRecord } from "@polkadot/types/interfaces";
import { FeeData, IMyAsset, PNode, PromiseTracker, Relay, ReserveFeeData, TransferDepositEventData, TransferExtrinsicContainer, TransferOrDeposit } from './../types/types.ts';
import { findValueByKey, getMyAssetById, getMyAssetBySymbol, getChainIdFromNode } from './utils.ts';

import { getParaId, getRelayChainSymbol, TNode } from '@paraspell/sdk';
import { BN } from '@polkadot/util/bn/bn';
// import { getBsxSwapExtrinsic, testBsxSwap } from './../swaps/bsxSwap.ts';
import '@galacticcouncil/api-augment/basilisk';
import { FrameSystemEventRecord } from '@polkadot/types/lookup';
import bn from 'bignumber.js';
import { depositEventDictionary, multiassetsDepositEventDictionary, TokenType, transferEventDictionary, TransferType, XcmDepositEventData } from '../config/feeConsts.ts';
import { MyAsset } from '../core/index.ts';



// export async function watchDepositEvents(destApi: ApiPromise, xcmpMessageHash: string, chainId: PNode) {
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

// *** When transferring assets from hydra to statemint, will send token and 180000 usdt to cover fees. Fee will be deducted from usdt sent from hydra, and deposit the rest to dest account
// *** STATEMINT DEPOSIT for multiasset transfer
// SYSTEM EVENTS
// assets.Burned [assetId, owner, balance] (pink)
// assets.Burned [assetId, owner, balance] (usdt)
// balances.Withdraw [who, amount] (dot)
// assetConversion.SwapCreditExecuted [amountIn, amountOut, path] (usdt -> dot)
// assets.Issued [assetId, owner, amount] (pink)
// assets.Issued [assetId, owner, amount] (usdt minus fee) 
// balances.Issued [amount]
// balances.Deposit [who, amount] (dot)
// messageQueue.Processed

// *** HYDRA TRANSFER for multassets to statemint
// xTokens.transferMultiassets
// balances.Upgraded
// balances.Withdraw [who, amount] (hdx)
// currencies.Withdrawn [currencyId, who, amount] (hdx)
// tokens.Withdrawn [currencyId, who, amount] (pink)
// currencies.Withdrawn [currencyId, who, amount] (pink)
// tokens.Withdrawn [currencyId, who, amount] (usdt)
// currencies.Withdrawn [currencyId, who, amount] (usdt)
// xcmpQueue.XcmpMessageSent
// xTokens.TransferredAssets
// balances.Deposit [who, amount] (hdx)
// currencies.Deposited [currencyId, who, amount]
// transactionPayment.TransactionFeePaid
// system.ExtrinsicSuccess

// listens for deposit events and gets the deposit and fee amounts
/**
 * 
 * @param api 
 * @param receivingChain 
 * @param transferType 
 * @param depositAssetSymbol - REMOVE. Used to determine if asset is native chain token 
 * @param depositAssetDecimals - REMOVE
 * @param depositAssetObject - Asset object containing all asset properties
 * @param depositAddress - Deposit address used to check for deposit events, NEEDED for when xcm message id's dont match up
 * @param balanceDepositTracker - Track balance change on chain to determine if deposit was successful when we can't find xcm deposit event
 * @param xcmTxProperties 
 * @param xcmpMessageHash - Match xcm transaction event from sending chain to receiving chain
 * @param xcmpMessageId 
 * @returns 
 */
export async function listenForXcmpDepositEvent(
    transferTxContainer: TransferExtrinsicContainer,
    depositAddress: string, 
    balanceDepositTracker: PromiseTracker, 
    xcmTxProperties: any, // Use for further info. To distinguish between transfer and transferMultiassets
    xcmpMessageHash?: string, 
    xcmpMessageId?: string
): Promise<TransferDepositEventData> {
    let sendingChain: PNode = transferTxContainer.startChain
    let receivingApi: ApiPromise = transferTxContainer.destinationApi
    let receivingChain: PNode = transferTxContainer.destinationChain
    let receivingAsset: MyAsset = transferTxContainer.destinationAsset.asset
    let transferType = getTransferType(sendingChain, receivingChain)


    const txParams = xcmTxProperties.method
    const method = txParams.method

    const depositAssetSymbol = receivingAsset.tokenData.symbol
    const depositAssetDecimals = Number.parseInt(receivingAsset.tokenData.decimals)

    if(transferType === "hrmp" && !xcmpMessageHash && !xcmpMessageId){
        throw new Error("HRMP transfers require XCMP message hash")
    }
    let nativeChainToken = receivingApi.registry.chainTokens[0]
    let tokenType: TokenType = depositAssetSymbol.toUpperCase() == nativeChainToken.toUpperCase() ? "native" : "tokens" 

    // let nodeEventData = depositEventDictionary[node][transferType][tokenType]
    let nodeEventData: XcmDepositEventData | null
    if(transferType === "hrmp"){
        nodeEventData = depositEventDictionary[receivingChain]?.[transferType]?.[tokenType] ?? null;
    } else {
        nodeEventData = depositEventDictionary[receivingChain][transferType] ?? null
    }
    if(nodeEventData === null){
        console.log(`Deposit type ${transferType} not avaiable for ${receivingChain}`)
        throw new Error("Invalid node or transfer type")
    }
    nodeEventData = nodeEventData as XcmDepositEventData

    let eventListener: Promise<FrameSystemEventRecord[]> = createDepositEventListener(
        receivingApi, 
        nodeEventData, 
        receivingChain, 
        tokenType, 
        transferType, 
        depositAddress, 
        balanceDepositTracker, 
        xcmpMessageId, 
        xcmpMessageHash
    )

    let events;
    try {
        events = await eventListener;
    } catch (error) {
        console.error("Error listening for XCMP Deposit event:", error);
        throw new Error(`Failed to listen for XCMP Deposit event. Depositing to -> ${receivingChain} ${depositAssetSymbol} `);
    }

    if(!events){
        throw new Error("No events found");
    }

    events = events.reverse()

    // REVIEW Asset Hub deposit when xTokens.transferMultiassets. Currently only from Hydra
    if(method === 'transferMultiassets'){
        if(receivingChain !== "AssetHubPolkadot") throw new Error(`Not configured for transferMultiassets deposit events for node ${receivingChain}`)
        console.log(`TRUE`)
        const eventDataRegistry = multiassetsDepositEventDictionary["AssetHubPolkadot"]
        console.log(`AssetHub tranfserMultiAsset Event Data Registry: ${JSON.stringify(eventDataRegistry)}`)
        let depositEvent = events.filter((event) => event.event.section === eventDataRegistry.deposit.section && event.event.method === eventDataRegistry.deposit.method)[eventDataRegistry.deposit.index]
        let depositAmount = depositEvent.event.data[eventDataRegistry.deposit.amountIndex]
        
        let feeEvent = events.filter((event) => event.event.section === eventDataRegistry.fee.section && event.event.method === eventDataRegistry.fee.method)[eventDataRegistry.fee.index]
        let feeAmount = new bn(feeEvent.event.data[eventDataRegistry.fee.amountIndex].toString())
        
        let feeAssetIdEvent = events.filter((event) => event.event.section === eventDataRegistry.feeAssetId.section && event.event.method === eventDataRegistry.feeAssetId.method)[eventDataRegistry.feeAssetId.index]
        //REVIEW Will this return commas in the asset ID?
        let feeAssetId = new bn(feeAssetIdEvent.event.data[eventDataRegistry.feeAssetId.assetIdIndex].toString())

        const nodeChainId = getParaId(receivingChain)
        const relay: Relay = getRelayChainSymbol(receivingChain) === 'DOT' ? 'polkadot' : 'kusama'
        const feeAssetObject = getMyAssetById(nodeChainId, feeAssetId.toString(), relay)

        let depositEventData: TransferDepositEventData = {
            xcmAmount: new bn(depositAmount.toString()),
            xcmAssetSymbol: depositAssetSymbol,
            xcmAssetId: receivingAsset.tokenData.localId,
            xcmAssetDecimals: depositAssetDecimals,
            feeAmount: feeAmount,
            feeAssetSymbol: feeAssetObject.tokenData.symbol,
            feeAssetId: feeAssetId.toString(),
            feeAssetDecimals: Number.parseInt(feeAssetObject.tokenData.decimals),
            node: receivingChain
        }
        console.log(`*** transferMultiassets Deposit Event success: ${JSON.stringify(depositEventData, null, 2)}`)
        // console.log(`DEPOSIT EVENT SUCCESS: Deposit amount: ${eventDataRegistry.depositAmount.toString()} | Fee amount: ${eventDataRegistry.feeAmount.toString()}`)
    
        return depositEventData
    }


    // If ACALA, if deposit is ACA then events are differnt

    // console.log(JSON.stringify(nodeEventData))

    // Get deposit and fee amounts
    let depositEvent = events.filter((event) => event.event.section === nodeEventData!.deposit.section && event.event.method === nodeEventData!.deposit.method)[nodeEventData.deposit.index]
    let depositAmount = depositEvent.event.data[nodeEventData.deposit.amountIndex]

    // CRUST/NODLE withdraws full transfer amount from sibling reserve account, then deposits the amount minus fee to the wallet. There is no fee event, so we need to handle this case
    let feeAmount
    if(nodeEventData.fee.index === -1){
        console.log("No fee event detected")
        feeAmount = new BN(0)
    } else {
        let feeEvent = events.filter((event) => event.event.section === nodeEventData!.fee.section && event.event.method === nodeEventData!.fee.method)[nodeEventData.fee.index]
        feeAmount = new bn(feeEvent.event.data[nodeEventData.fee.amountIndex].toString())

        // CRUST/NODLE fee amount will be the full amount, thus larger than the deposit amount
        if(feeAmount.gt(depositAmount)){
            // console.log("Fee amount is larger than deposit amount. Fee amount will be the full deposit amount")
            feeAmount = new bn(feeAmount).minus(new bn(depositAmount.toString()))
        }
    }

    let depositEventData: TransferDepositEventData = {
        xcmAmount: new bn(depositAmount.toString()),
        xcmAssetSymbol: depositAssetSymbol,
        xcmAssetId: receivingAsset.tokenData.localId,
        xcmAssetDecimals: depositAssetDecimals,
        feeAmount: feeAmount,
        feeAssetSymbol: depositAssetSymbol,
        feeAssetId: receivingAsset.tokenData.localId,
        feeAssetDecimals: depositAssetDecimals,
        node: receivingChain
    }
    // console.log(`DEPOSIT EVENT SUCCESS: Deposit amount: ${depositEventData.xcmAmount.toString()} | Fee amount: ${depositEventData.feeAmount.toString()}`)

    return depositEventData

}

async function createDepositEventListener(
    api: ApiPromise, 
    nodeEventData: XcmDepositEventData,
    node: PNode,
    tokenType: TokenType,
    transferType: TransferType,
    depositAddress: string,
    manualBalanceDepositTracker: PromiseTracker,
    xcmpMessageId?: string, 
    xcmpMessageHash?: string
): Promise<FrameSystemEventRecord[]>{
    return new Promise(async (resolve, reject) => {
        let eventPromiseResolved;
        let xcmEventSection = nodeEventData.xcm.section
        let xcmEventMethod = nodeEventData.xcm.method
        let eventRecords: FrameSystemEventRecord[] = []

        // This will find the event that matches the section and method from registry, and then compare the message hash
        const unsubscribe = await api.query.system.events(async (events) => {
            // console.log(`Looking for xcmp event section method ${xcmEventSection}`)
            events.forEach((record) => {
                eventRecords.push(record)
                const { event, phase } = record;
                if(event.section === "common"){
                    // console.log(`COMMON EVENT: ${JSON.stringify(event, null, 2)}`)
                }
                // REVIEW This will match other events from the same module, xcmpQueue.XcmpMessageSent vs xcmpQueue.Succes
                if (event.section === xcmEventSection && event.method === xcmEventMethod) {
                    console.log("Found xcm event")
                    if(nodeEventData.xcm.idIndex !== -1){
                        // Comparing message hash of 
                        try{
                            const messageHash = event.data[nodeEventData.xcm.idIndex].toString();
                            if (messageHash.toString() === xcmpMessageHash || messageHash.toString() === xcmpMessageId) {
                                // console.log("Found xcm event")
                                eventPromiseResolved = true
                                unsubscribe(); // Stop listening for events
                                resolve(eventRecords);
                            }
                        } catch (error){
                            // This throws if the event we matched
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
                        try{
                            let depositEvent = reversedEventArray.filter((event) => event.event.section === nodeEventData.deposit.section && event.event.method === nodeEventData.deposit.method)[nodeEventData.deposit.index]
                            let eventDepositAddress = depositEvent.event.data[nodeEventData.deposit.addressIndex].toString()
                            if(eventDepositAddress === depositAddress){
                                eventPromiseResolved = true
                                unsubscribe(); // Stop listening for events
                                resolve(eventRecords);
                            }
                        } catch (e){
                            console.log(`ERROR matching deposit xcm event for ${node}`)
                            console.log(`Captured events:`)
                            reversedEventArray.forEach((event) => console.log(`Section: ${event.event.section} | Method: ${event.event.method}`))
                            console.log('-----------------------------')
                            console.log(`${node} registry deposit events: Section: ${nodeEventData.deposit.method} | Method: ${nodeEventData.deposit.section} | Event index:${nodeEventData.deposit.index}`)
                        }
                        
                    }
                }
            });
            // Gone through all the events up to this point and still have not found the xcm event.
            // Check if balance observable has resolved.
            // If it has resolved, wait 15 seconds for the events to show and if the events aren't found then throw

            let balanceDepositResolve = manualBalanceDepositTracker.isResolved()

            // If balance deposit has resolved true, and we haven't found the xcm event, then reject the promise after a wait
            if(balanceDepositResolve){
                console.log("*** Balance deposit promise has resolved, but xcm events not found yet. WAIT 15 sec...")
                await new Promise(resolve => setTimeout(resolve, 15000))
                console.log(`Checking if event promise resolved...`)
                if(!eventPromiseResolved){
                    console.log("Event promise has NOT resolved.")
                    console.log('------------------------')
                    console.log(`Searching for section: ${xcmEventSection} | method: ${xcmEventMethod}`)
                    console.log(`Events up to now:`)
                    eventRecords.forEach((eventRecord) => {
                        console.log(`section: ${eventRecord.event.section} | method: ${eventRecord.event.method}`)
                    })
                    unsubscribe()
                    reject("Balance Change observed BUT No xcm event found so rejecting")
                } else {
                    console.log(`Event promise has resolved successfully`)
                }
            }
        });
    })
}

/**
 * Take event records from Transfer Extrinsic details, extract relevant info
 * - transfer asset and amount
 * - fee asset and amount
 * 
 * @param node 
 * @param transferredAssetObject 
 * @param nativeCurrencySymbol 
 * @param events 
 * @param relay 
 * @param xcmTxProperties 
 * @returns 
 */
export function getXcmTransferEventData(
    node: PNode,
    transferredAssetObject: MyAsset, 
    nativeCurrencySymbol: string, 
    events: EventRecord[], 
    relay: Relay,
    xcmTxProperties: any // Copy of tx properties to use if needed to distinguish between extrinsics
): TransferDepositEventData{
    let transferredAssetSymbol = transferredAssetObject.getSymbol()
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

    let nativeAssetObject = getMyAssetBySymbol(chainId, nativeCurrencySymbol, relay)
    let feeAssetDecimals = nativeAssetObject.tokenData.decimals

    let transferAssetDecimals = transferredAssetObject.tokenData.decimals

    // REVIEW This assumes fee asset is alway native asset
    let transferFee: TransferDepositEventData = {
        xcmAmount: transferAmount,
        xcmAssetSymbol: transferredAssetSymbol,
        xcmAssetId: transferredAssetObject.tokenData.localId,
        xcmAssetDecimals: Number.parseInt(transferAssetDecimals),
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

export async function getDepositFees(eventRecords: FrameSystemEventRecord[], node: PNode ){
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

export async function getAcalaDepositFees(eventRecords: FrameSystemEventRecord[], node: PNode){
    
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

export function getTransferType(startChain: PNode, destChain: PNode): "dmp" | "hrmp" | "ump" {
    if (startChain == "Kusama" || startChain == "Polkadot"){
        return "dmp"
    } else if (destChain == "Kusama" || destChain ==  "Polkadot"){
        return "ump"
    } else {
        return "hrmp"
    }
}

export function createReserveFees(txContainer: TransferExtrinsicContainer, xcmEventData: TransferDepositEventData, eventType: TransferOrDeposit): ReserveFeeData {
    const startAsset: MyAsset = txContainer.startAsset.asset
    const destinationAsset: MyAsset = txContainer.destinationAsset.asset
    return {
        chainId: eventType === 'Transfer' ? startAsset.getChainId() : destinationAsset.getChainId(),
        feeAssetId: xcmEventData.feeAssetId,
        feeAssetAmount: xcmEventData.feeAmount.toString(),
        reserveAssetId: eventType === 'Transfer' ? startAsset.getLocalId() : destinationAsset.getLocalId(),
        reserveAssetAmount: eventType === 'Transfer' ? txContainer.transferReserveAmount : txContainer.depositReserveAmount
    }
}

/**
 * Format Event Data from transfer or deposit as a FeeData object
 * 
 * @param txContainer 
 * @param xcmEventData 
 * @param eventType 
 * @returns 
 */
export function createFeeDatas(txContainer: TransferExtrinsicContainer, xcmEventData: TransferDepositEventData, eventType: TransferOrDeposit): FeeData {
    const startAsset: MyAsset = txContainer.startAsset.asset
    const destinationAsset: MyAsset = txContainer.destinationAsset.asset

    const chainId = eventType === 'Transfer' ?  startAsset.getChainId() : destinationAsset.getChainId()
    const feeAssetObject = getMyAssetBySymbol(chainId, xcmEventData.feeAssetSymbol, txContainer.relay)
    const feeAssetLocation = feeAssetObject.tokenLocation!
    
    return {
        assetLocation: feeAssetLocation,
        chainId: chainId,
        feeAssetSymbol: xcmEventData.feeAssetSymbol,
        feeAssetId: xcmEventData.feeAssetId,
        feeAssetDecimals: xcmEventData.feeAssetDecimals,
        feeAmount: xcmEventData.feeAmount.toString(),
        reserveAssetAmount:eventType === 'Transfer' ? txContainer.transferReserveAmount.toString() : txContainer.depositReserveAmount.toString(),
        reserveAssetId: eventType === 'Transfer' ? startAsset.getLocalId() : destinationAsset.getLocalId()
    }
}