import { ethers } from "ethers";

export interface GenericTx {
    type: string, // transfer or swap
    to: string, //Contract address
    wallet: ethers.Wallet,
    walletIndex: number,
    nonce: any
}

export interface SwapResultData {
    transactionData: TxData,
    errorData: ErrorData
}
export interface TxData {
    success: boolean,
    wallet: string,
    walletIndex: number,
    tokenIn: string,
    tokenOut: string,
    nonce: number,
    contractAddress: string,
    token0?: string,
    token1?: string,
    abiIndex?: number,
    slippage?: number,
    failureStatus?: string,
    swapData?: SwapData,
    swapTxReceipt?: any
}
export interface ErrorData {
    wallet: string,
    walletIndex: number,
    nonce: number,
    contractAddress: string,
    tokenIn: string,
    tokenOut: string,
    inTokenSymbol: string,
    outTokenSymbol: string,
    abiIndex: number,
    error: any

}
export interface SwapData {
    swapTx: any,
    calculatedAmountOut: bigint,
    dexAddress: string,
    tokenIn: string,
    tokenInSymbol: string,
    tokenInBalanceBefore: bigint,
    tokenInBalanceAfter: bigint,
    tokenInBalanceChange: bigint,
    tokenOut: string,
    tokenOutSymbol: string,
    tokenOutBalanceBefore: bigint,
    tokenOutBalanceAfter: bigint,
    tokenOutBalanceChange: bigint,
    // swapTxReceipt?: any
}

export interface BatchSwapParams{
    chainId: 2023,
    batchContract: ethers.Contract,
    wallet: ethers.Wallet,
    dexAddresses: string[];
    abiIndexes: bigint[];
    inputTokens: string[];
    outputTokens: string[];
    amount0Ins: bigint[];
    amount1Ins: bigint[];
    amount0Outs: bigint[];
    amount1Outs: bigint[];
    movrWrapAmounts: bigint[];
    data: string[];
    reverseSwapParams?: BatchSwapParams;
}