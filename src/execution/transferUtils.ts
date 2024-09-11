import { testNets } from "../config/txConsts.ts"
import { getSigner, getWalletAddressFormatted, isEvmChain, isTxDetails, trackPromise } from "../utils/utils.ts"
import { ArbExecutionResult, BalanceChange, BalanceChangePromiseTracker, FeeData, LastNode, PNode, PromiseTracker, Relay, ReserveFeeData, SingleTransferResultData, TransactionState, TransferDepositEventData, TransferExtrinsicContainer, TransferTxStats, TxDetails } from "./../types/types.ts"
import { KeyringPair } from '@polkadot/keyring/types'
import { balanceChangeDisplay, getBalance, getDisplayBalance, manualCheckBalanceChange, watchBalanceChange } from "./../utils/balanceUtils.ts"
import { stateSetLastNode, stateSetResultData, stateSetTransactionState, updateXcmFeeReserves } from "./../utils/globalStateUtils.ts"
// import {BigNumber as bn } from "bignumber.js"
import { ApiPromise, Keyring } from '@polkadot/api'
import bn from 'bignumber.js'
import { MyAsset } from "../core"
import { createFeeDatas, createReserveFees, getXcmTransferEventData, listenForXcmpDepositEvent } from "../utils/index.ts"
import { logEventFeeBook } from "../utils/logUtils.ts"
// import { H256 } from '@polkadot/types/primitive';
bn.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 }) // Set to max precision


/**
 * When running on chopsticks, if either chain is not active, specified in 'testNets', skip execution
 * 
 * @param chopsticks 
 * @param startChain 
 * @param destinationChain 
 * @returns 
 */
export function shouldExecuteTransfer(chopsticks: boolean, startChain: PNode, destinationChain: PNode): boolean{
    if(chopsticks){
        //If either chain is not running, skip
        if(!testNets.includes(startChain) || !testNets.includes(destinationChain)){
            return false
        }
    }
    return true
}

/**
 * Get signers for transfer, start chain and destination chain
 * 
 * @param chopsticks 
 * @param startChain 
 * @param destinationChain 
 * @returns 
 */
export async function getSigners(chopsticks: boolean, startChain: PNode, destinationChain: PNode): Promise<[KeyringPair, KeyringPair]>{
    let startSigner: KeyringPair = await getSigner(chopsticks, startChain)
    let destSigner: KeyringPair = await getSigner(chopsticks, destinationChain)
    return [startSigner, destSigner]
}

/**
 * Creates balance change observable, as a promise, that will complete upon balance change. Initiate before extrinsic execution
 * - Transfers: Use for start chain and destination chain
 * - Swap: Can be used for asset in and asset out
 * 
 * @return PromiseTracker<BalanceChange> and unsubscribe function
 * 
 * @param relay 
 * @param asset 
 * @param api 
 * @param address 
 * @param chopsticks 
 * @returns 
 */
export async function setupBalanceWatch(
    relay: Relay, 
    asset: MyAsset, 
    api: ApiPromise, 
    address: string, 
    chopsticks: boolean
): Promise<{ balanceChangeTracker: BalanceChangePromiseTracker, unsubscribe: () => void }> {
    const { balanceChangePromise: balanceChangePromise, unsubscribe } = await watchBalanceChange(relay, chopsticks, api, asset, address);
    const balanceChangeTracker = trackPromise(balanceChangePromise);
    return { balanceChangeTracker, unsubscribe };
}

/**
 * Use for transfers to query the balances of an asset on the start chain and the destination chain
 * 
 * @return start chain balance and destination chain balance as bn
 * 
 * @param relay 
 * @param chopsticks 
 * @param container 
 * @param startSigner 
 * @param destSigner 
 * @returns 
 */
export async function getInitialBalances(
    relay: Relay, 
    chopsticks: boolean, 
    container: TransferExtrinsicContainer, 
    startSigner: KeyringPair, 
    destSigner: KeyringPair
): Promise<[bn, bn]> {
    // Implementation
    const { startAsset, destinationAsset, startApi, destinationApi } = container
    let startNodeStartBalance = await getBalance(relay, chopsticks, startApi, startAsset.asset, startSigner.address)
    let destNodeStartBalance = await getBalance(relay, chopsticks, destinationApi, destinationAsset.asset, destSigner.address)
    return [startNodeStartBalance, destNodeStartBalance]
}

/**
 * Processes transfer events on the start chain and the destination chain
 * - transfer asset & amount | fee asset & amount from start chain
 * - Get deposited asset & amount from destination chain 
 * 
 * Processes the start chain transfer events immediately, and sets up a listener for the destination chain deposit event
 * 
 * Use immediately after transfer extrinsic execution. Pass in event records from extrinsic execution on start chain
 * 
 * @return start event data and promise tracker for destination event data
 * 
 * @param container 
 * @param txDetails 
 * @param xcmTxProperties 
 * @param destBalanceChangeTracker 
 * @param destSigner 
 */
export async function processTransferEvents(
    container: TransferExtrinsicContainer, 
    txDetails: TxDetails, 
    xcmTxProperties: any, 
    destBalanceChangeTracker: PromiseTracker, 
    destSigner: KeyringPair
): Promise<[TransferDepositEventData, PromiseTracker]> {
    // Implementation
    let { startChain, destinationChain, startAsset, destinationAsset, startApi, destinationApi, relay } = container
    let startChainNativeToken = startApi.registry.chainTokens[0]

    let startTransferEventData = getXcmTransferEventData(startChain, startAsset.asset, startChainNativeToken, txDetails.finalized!, relay, xcmTxProperties)
   
    console.log("Execute TRANSFER: Initiating deposit event listener")
    const destWalletFormatted = getWalletAddressFormatted(destSigner, new Keyring({ ss58Format: 0, type: 'sr25519' }), destinationChain, await destinationApi.consts.system.ss58Prefix);
        
    let depositEventPromise = listenForXcmpDepositEvent(
        container,
        destWalletFormatted,
        destBalanceChangeTracker,
        xcmTxProperties, 
        txDetails.xcmMessageHash!
    )
    let depositEventTracker = trackPromise(depositEventPromise)
    return [startTransferEventData, depositEventTracker]
}

/**
 * Confirms balance deposit on destination chain. Check PromiseTracker for destination BalanceChange.
 * - If resolved, return resolved BalanceChange promise
 * - After 10 seconds, manually query balance and check for change
 * 
 * @param destBalanceChangeTracker 
 * @param destEventTracker 
 * @param destNodeStartBalance 
 * @param destBalanceUnsub 
 * @param container 
 * @param chopsticks 
 * @param destSignerAddress 
 * @returns 
 */
export async function waitForDestinationBalanceChange(
    destBalanceChangeTracker: PromiseTracker,
    destEventTracker: PromiseTracker, 
    destNodeStartBalance: bn,
    destBalanceUnsub: () => void,
    container: TransferExtrinsicContainer,
    chopsticks: boolean, 
    destSignerAddress: string
): Promise<BalanceChange> {
    // Implementation
    let { relay, destinationApi, destinationAsset, destinationChain } = container

    let queryIndex = 1
    let tokenDepositConfirmed = false
    let destBalanceChangeStats: BalanceChange = {} as BalanceChange
    while(!tokenDepositConfirmed){
        queryIndex++

        // Check this every second, at 10 sec query manually
        if (queryIndex % 10 != 0 ){
            console.log(`Deposit Balance Change Tracker: ${destBalanceChangeTracker.isResolved()} | Waiting 1 sec...`)

            // Check if balance change has resolved, balance observable has logged a change in balance
            if(destBalanceChangeTracker.isResolved()){
                console.log("Balance Change resolved successfully")

                // Get balance change data from resolved promise
                destBalanceChangeStats = await destBalanceChangeTracker.trackedPromise
                
                // Confirm token deposit
                tokenDepositConfirmed = true
            }

            // wait 1 second
            await new Promise(resolve => setTimeout(resolve, 1000))
        } else {

            // Query balance manually, confirm if change or not
            let destinationBalanceChange = await manualCheckBalanceChange(destNodeStartBalance, relay, chopsticks, destinationApi, destinationAsset.asset, destSignerAddress)
            if(destinationBalanceChange !== null){
                destBalanceChangeStats = destinationBalanceChange
                tokenDepositConfirmed = true

                // If balance change has not resolved yet, but we have confirmed balance change manually, call unsub
                if(!destBalanceChangeTracker.isResolved()){
                    console.log("Call destination balance unsub...")
                    destBalanceUnsub!();
                    console.log("Destination balance unsub called")
                }
                
            } else {
                console.log("BALANCE QUERIED AND NO CHANGE IN BALANCE, waiting 10 seconds")
                await new Promise(resolve => setTimeout(resolve, 1000))
            }
        }

    }

    return destBalanceChangeStats
}

/**
 * Waits for deposit events on the destination chain, and processes the event data
 * - Check PromiseTracker for deposit event data on destination chain
 * - Wait for promise to resolve
 * - Extract FeeData information from deposit event data
 * 
 * @param startTransferEventData 
 * @param depositEventTracker 
 * @param container 
 * @returns 
 */
export async function waitForDepositEventData(
    startTransferEventData: TransferDepositEventData, 
    depositEventTracker: PromiseTracker, 
    container: TransferExtrinsicContainer, 
): Promise<[FeeData, FeeData, ReserveFeeData[]]> {
    console.log("*********** WAITING ON DEPOSIT EVENTS **************")
    // REVIEW Maybe just combine FeeData and ReserveFeeData into one
    let transferFeeData: FeeData = {} as FeeData
    let depositFeeData: FeeData = {} as FeeData
    
    let reserveFees: ReserveFeeData[] = []

    let { relay, destinationApi, destinationAsset } = container


    let destDepositEventData: TransferDepositEventData;
    // If fail to detect deposit events, dont update fee book
    try {
        destDepositEventData = await depositEventTracker.trackedPromise
        if(!destDepositEventData.xcmAssetDecimals){
            destDepositEventData.xcmAssetDecimals = destinationAsset.getDecimals()
        }

        // Track Transfer and Deposit reserve fees
        reserveFees.push(createReserveFees(container, startTransferEventData, 'Transfer'))
        if(new bn(container.depositReserveAmount).isGreaterThan(new bn(0))){
            reserveFees.push(createReserveFees(container, destDepositEventData, 'Deposit'))
        }

        transferFeeData = createFeeDatas(container, startTransferEventData, 'Transfer')
        depositFeeData = createFeeDatas(container, destDepositEventData, 'Deposit')


        reserveFees.forEach((feeData) => console.log(`Reserves | Fee Data: ${JSON.stringify(feeData.feeAssetId)} ${feeData.feeAssetAmount} | Reserve Data: ${JSON.stringify(feeData.reserveAssetId)} ${feeData.reserveAssetAmount}`))
        console.log(`Transfer fees: ${JSON.stringify(transferFeeData.feeAssetId)} ${transferFeeData.feeAmount} | Deposit fees: ${JSON.stringify(destDepositEventData.feeAssetId)} ${destDepositEventData.feeAmount}`)


    } catch (error) {
        console.error("ERROR: " + error)
        console.error("Failed to detect deposit events")
    }
    return [transferFeeData, depositFeeData, reserveFees]
}

/**
 * Format and return result data for transfer execution
 * 
 * @param container 
 * @param startBalanceChangeStats 
 * @param destBalanceChangeStats 
 * @param transferFeeData 
 * @param depositFeeData 
 * @param txDetails 
 * @returns 
 */
export function createTransferResultData(
    container: TransferExtrinsicContainer, 
    startBalanceChangeStats: BalanceChange, 
    destBalanceChangeStats: BalanceChange, 
    transferFeeData: FeeData, 
    depositFeeData: FeeData, 
    txDetails: TxDetails
): SingleTransferResultData {
    // Implementation
    let transferTxStats: TransferTxStats = {} as TransferTxStats
    let arbExecutionResult: ArbExecutionResult = {} as ArbExecutionResult
    let transferResultData: SingleTransferResultData = {} as SingleTransferResultData

    const { startChain, destinationChain, startAsset, destinationAsset, startApi, destinationApi, pathAmount } = container

    let lastNode: LastNode = {
        assetKey: destinationAsset.getAssetKey(),
        assetValue: getDisplayBalance(destBalanceChangeStats.changeInBalance, destBalanceChangeStats.decimals),
        chainId: destinationAsset.getChainId(),
        assetSymbol: destinationAsset.getAssetSymbol()
    }



    console.log("Tx Details Success: " + txDetails.success)
    // let feesAndGasAmount = startBalanceChangeStats.changeInBalance.minus(destBalanceChangeStats.changeInBalance).abs()

    console.log(
        `Execute Extrinsic Set Loop: Start Balance Change: ${JSON.stringify(startBalanceChangeStats.changeInBalance)} | 
        Destination Balance Change: ${JSON.stringify(destBalanceChangeStats.changeInBalance)} | 
        Transfer Fee Amount: (${JSON.stringify(transferFeeData.feeAssetId)}) ${transferFeeData.feeAmount} | 
        Transfer Reserve Amount: (${JSON.stringify(transferFeeData.reserveAssetId)}) ${transferFeeData.reserveAssetAmount} | 
        Deposit Fee Amount: (${JSON.stringify(depositFeeData.feeAssetId)}) ${depositFeeData.feeAmount} | 
        Deposit Reserve Amount: (${JSON.stringify(depositFeeData.reserveAssetId)}) ${depositFeeData.reserveAssetAmount}`
    )
    transferTxStats = {
        startChain: startChain,
        destChain: destinationChain,
        startAssetKey: startAsset.getAssetKey(),
        startBalanceStats: startBalanceChangeStats,
        destBalanceStats: destBalanceChangeStats,
        originFee: transferFeeData,
        destinationFee: depositFeeData,
    }
    
    arbExecutionResult = {
        assetSymbolIn: startAsset.getAssetSymbol(),
        assetSymbolOut: startAsset.getAssetSymbol(),
        assetAmountIn: balanceChangeDisplay(startBalanceChangeStats),
        assetAmountOut: balanceChangeDisplay(destBalanceChangeStats),
        blockHash: txDetails.blockHash!,
        result: `SUCCESS: ${txDetails.success} - TRANSFER: (${startChain} ${startAsset.getChainId()} ${startAsset.getAssetSymbol()} ${startBalanceChangeStats.changeInBalance} -> ${destinationChain} ${destinationAsset.getChainId()} ${startAsset.getAssetSymbol()} ${destBalanceChangeStats.changeInBalance}) |
        Transfer Fee: ${transferFeeData.feeAssetSymbol} ${transferFeeData.feeAmount} | Transfer Reserve: ${transferFeeData.reserveAssetAmount!} |
        Deposit Fee: ${depositFeeData.feeAssetSymbol} ${depositFeeData.feeAmount} | Deposit Reserve ${depositFeeData.reserveAssetAmount} |
        START: ${balanceChangeDisplay(startBalanceChangeStats)} -> DEST: ${balanceChangeDisplay(destBalanceChangeStats)}`
    }
    transferResultData = {
        success: txDetails.success,
        arbExecutionResult: arbExecutionResult,
        transferTxStats: transferTxStats,
        lastNode: lastNode,
    }
    return transferResultData
}

/**
 * Take results from transfer execution
 * - Update state.LastNode
 * - Update state.TransactionState
 * - Update state.ResultData
 * - Log fee data from events
 * - Log fee reserve amounts
 * 
 * @param container 
 * @param transferResultData 
 * @param startTransferEventData 
 * @param destDepositEventData 
 * @param reserveFeeData 
 * @param relay 
 */
export function transferUpdateStateAndFeeBook(
    container: TransferExtrinsicContainer, 
    transferResultData: SingleTransferResultData, 
    startTransferEventData: TransferDepositEventData, 
    destDepositEventData: TransferDepositEventData, 
    reserveFeeData: ReserveFeeData[],
    relay: Relay
): void {
    // Implementation
    let minimumExpected = new bn(container.pathAmount).times(.95)
    let sufficient = transferResultData.transferTxStats?.destBalanceStats.changeInBalance.minus(minimumExpected)!   

    let success
    if(sufficient.gt(new bn(0))){
        console.log("Transfer deposit balance change is sufficient")
        console.log("Transfer Extrinsic successful. setting last node...")
        stateSetLastNode(transferResultData.lastNode!)
        stateSetTransactionState(TransactionState.Finalized)
        success = true
    } else {
        console.log("Transfer deposit balance change is NOT sufficient")
        console.log("Balance Change: ", transferResultData.transferTxStats?.destBalanceStats.changeInBalance.toString())
        console.log("Minimum expected: ", minimumExpected.toString())
        console.log("Sufficient: ", sufficient.toString())
        success = false
    }
    logEventFeeBook(startTransferEventData, destDepositEventData, relay)
    updateXcmFeeReserves(reserveFeeData)
    transferResultData.success = success
    stateSetResultData(transferResultData)

}

/**
 * If there is an error in transfer execution, handle the error
 * - Unsubscribe from balance change observables
 * - Create transfer result data indicating failure
 * - Update state.ResultData
 * - return transfer result data
 * 
 * 
 * @param error 
 * @param container 
 * @param txDetails 
 * @param startBalanceUnsub 
 * @param destBalanceUnsub 
 * @returns 
 */
export function handleTransferError(
    error: any, 
    container: TransferExtrinsicContainer, 
    txDetails: TxDetails,
    startBalanceUnsub: () => void, 
    destBalanceUnsub: () => void
): SingleTransferResultData {
    console.log("ERROR: " + error)
    // txPromise = e

    if(!isTxDetails(error)) throw new Error("Transfer failure, unknown error type");
    let decodedError = error.decodedError

    // REVIEW declaring these functions as null or empty function
    if(startBalanceUnsub) startBalanceUnsub()
    if(destBalanceUnsub) destBalanceUnsub()

    let { startChain, destinationChain, startAsset, destinationAsset, pathAmount } = container
    
    let transferResultData: SingleTransferResultData;
    let arbExecutionResult: ArbExecutionResult;
    
    arbExecutionResult = { 
        assetSymbolIn: startAsset.getAssetSymbol(),
        assetSymbolOut: startAsset.getAssetSymbol(),
        assetAmountIn: pathAmount,
        assetAmountOut: "0",
        blockHash: txDetails.blockHash ? txDetails.blockHash : "",
        result: `FAILURE: TRANSFER: (${startChain} ${startAsset.getChainId()} ${startAsset.getAssetSymbol()} ${pathAmount}-> ${destinationChain}) ${destinationAsset.getChainId()} | ERROR: ${JSON.stringify(decodedError)}` 
    }

    transferResultData = {
        success: false,
        arbExecutionResult: arbExecutionResult,
        transferTxStats: null,
        lastNode: null,
    }
    stateSetResultData(transferResultData)

    console.log("Returning on CATCH from failed Transfer Extrinsic")
    return transferResultData
}