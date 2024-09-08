import { isTxDetails } from "../utils/utils.ts"
import { ArbExecutionResult, BalanceChange, LastNode, PromiseTracker, SingleSwapResultData, SwapExtrinsicContainer, SwapTxStats, TxDetails } from "./../types/types.ts"

import { balanceChangeDisplay, getDisplayBalance, manualCheckBalanceChange } from "./../utils/balanceUtils.ts"
import { stateSetResultData } from "./../utils/globalStateUtils.ts"
// import {BigNumber as bn } from "bignumber.js"
import bn from 'bignumber.js'
// import { H256 } from '@polkadot/types/primitive';
bn.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 }) // Set to max precision


export async function waitForAssetOutBalanceChange(
    balanceChangeTracker: PromiseTracker, 
    assetOutStartBalance: bn,
    balanceUnsub: () => void,
    container: SwapExtrinsicContainer,
    chopsticks: boolean, 
    signerAddress: string
): Promise<BalanceChange> {
    let { relay, api, assetOut } = container

    // Confirm assetOut balance change
    console.log("Execute Swap: confirming asset out balance change...")
    let queryIndex = 0
    let balanceChangeResolved = false
    let assetOutBalanceChange: BalanceChange = {} as BalanceChange
    while(!balanceChangeResolved){
        queryIndex++
        // Check this every second, at 10 sec query manually
        if (queryIndex % 10 != 0 ){

            // Check if balance change has resolved, balance observable has logged a change in balance
            if(balanceChangeTracker.isResolved()){
                console.log("Asset out balance change resolved successfully")

                // Get balance change data from resolved promise
                assetOutBalanceChange = await balanceChangeTracker.trackedPromise
                
                // Confirm token deposit
                balanceChangeResolved = true
            }

            console.log("Balance change tracker not resolved yet...")
            // wait 1 second
            await new Promise(resolve => setTimeout(resolve, 1000))
        } else {
            console.log("10 seconds passed, balance change tracker not resolved. Querying balance manually...")
            // Query balance manually, confirm if change or not
            let balanceChange = await manualCheckBalanceChange(assetOutStartBalance, relay, chopsticks, api, assetOut.asset, signerAddress)
            if(balanceChange !== null){
                assetOutBalanceChange = balanceChange
                balanceChangeResolved = true
                balanceUnsub();
            } else {
                await new Promise(resolve => setTimeout(resolve, 1000))
            }
        }

    }
    return assetOutBalanceChange
}


export async function handleSwapError(e: any, container: SwapExtrinsicContainer, assetInUnsub: () => void, assetOutUnsub: () => void): Promise<SingleSwapResultData> {
    // Implementation
    if(!isTxDetails(e)) throw new Error("Swap failure, unknown error type");

    let decodedError = e.decodedError
    let txDetails = e as TxDetails
    console.log("DECODED ERROR: " + JSON.stringify(decodedError, null, 2))               
    
    await assetInUnsub()
    await assetOutUnsub()
    
    let { chain, chainId, assetAmountIn, assetIn, assetOut } = container

    let arbString: ArbExecutionResult = {
        assetSymbolIn: assetIn.getAssetSymbol(),
        assetSymbolOut: assetOut.getAssetSymbol(),
        assetAmountIn: getDisplayBalance(assetAmountIn, assetIn.getDecimals()),
        assetAmountOut: "0",
        blockHash: txDetails.blockHash!,
        result:`FAILURE: SWAP: (${chain}) ${chainId} ${assetIn.getAssetSymbol()} ${assetAmountIn.toNumber()}-> ${assetOut.getAssetSymbol()} | ERROR: ${JSON.stringify(decodedError)}`
    }

    let swapTxResult = {
        txString: `(${chain}) ${chainId} ${assetIn.getAssetSymbol()} -> ${assetOut.getAssetSymbol()}`,
        txDetails: txDetails
    }

    let swapResultData: SingleSwapResultData = {
        success: false,
        arbExecutionResult: arbString,
        swapTxStats: null,
        swapTxResults: swapTxResult,
        lastNode: null,
    }
    
    await stateSetResultData(swapResultData)

    return swapResultData
}

export function createSwapResultData(
    container: SwapExtrinsicContainer, 
    assetInBalanceChange: BalanceChange, 
    assetOutBalanceChange: BalanceChange,
    txDetails: TxDetails
): SingleSwapResultData{
    let success = assetOutBalanceChange.changeInBalance.gt(new bn(0)) ? true : false

    const { chain, chainId, assetIn, assetOut } = container

    let lastNode: LastNode = {
        assetKey: assetOut.getAssetKey(),
        assetValue: getDisplayBalance(assetOutBalanceChange.changeInBalance, assetOutBalanceChange.decimals),
        chainId: assetOut.getChainId(),
        assetSymbol: assetOut.getAssetSymbol()
    }

    let swapTxStats: SwapTxStats = {
        txHash: txDetails.txHash!,
        chain: chain,
        assetInKey: assetIn.getAssetKey(),
        assetOutKey: assetOut.getAssetKey(),
        expectedAmountIn: container.assetAmountIn.toString(),
        expectedAmountOut: container.expectedAmountOut.toString(),
        assetInBalanceChange: assetInBalanceChange,
        assetOutBalanceChange: assetOutBalanceChange,
    }

    let swapTxResult = {
        txString: `(${chain}) ${chainId} ${assetIn.getAssetSymbol()} -> ${assetOut.getAssetSymbol()}`,
        txDetails: txDetails
    }
    
    let arbExecutionResult: ArbExecutionResult = {
        assetSymbolIn: assetIn.getAssetSymbol(),
        assetSymbolOut: assetOut.getAssetSymbol(),
        assetAmountIn: balanceChangeDisplay(assetInBalanceChange),
        assetAmountOut: balanceChangeDisplay(assetOutBalanceChange),
        blockHash: txDetails.blockHash!,
        result:`SUCCESS: ${success} - SWAP: (${chain}) ${chainId} ${assetIn.getAssetSymbol()} ${balanceChangeDisplay(assetInBalanceChange)}-> ${assetOut.getAssetSymbol()} ${balanceChangeDisplay(assetOutBalanceChange)} | `
    
    }
    let swapResultData: SingleSwapResultData = {
        success: success,
        arbExecutionResult: arbExecutionResult,
        swapTxStats: swapTxStats,
        swapTxResults: swapTxResult,
        lastNode: lastNode,
    }

    console.log(`SUCCESS: ${success} - SWAP: (${chain}) ${chainId} ${assetIn.getAssetSymbol()} ${arbExecutionResult.assetAmountIn}-> ${assetOut.getAssetSymbol()} ${arbExecutionResult.assetAmountOut}`)

    return swapResultData
}