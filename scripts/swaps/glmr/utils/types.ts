import { ethers } from "ethers";
import bn, { BigNumber } from 'bignumber.js'
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
    wrapAmounts: bigint[];
    data: string[];
    reverseSwapParams?: BatchSwapParams;
}

export interface MyAssetRegistryObject {
    tokenData: MyAsset | CexAsset,
    hasLocation: boolean,
    tokenLocation?: any
}

export interface CexAsset {
    exchange: string,
    assetTicker: string,
    name: string,
    chain: string,
    precision: number,
    contractAddress: string,
}

//This is the unifying interface for all asset from all chains
export interface MyAsset {
    network: "kusama" | "polkadot"
    chain: number,
    localId: any,
    name: string,
    symbol: string,
    decimals: string,
    minimalBalance?: string,
    isFrozen?: boolean,
    deposit?: string,
    contractAddress?: string,
}

//MultiLocations 
export interface MyMultiLocation {
    [index: string]: any
    
}



//Use this to help convert data into '@polkadot/types/interfaces/Junction' when having trouble with the api.createType() method
export interface MyJunction {
    [index: string]: any,
    Parent?: boolean,
    Parachain?: number,
    AccountId32?: {
        networkId: string,
        id: String
    }
    AccountIndex64?: {
        networkId: string,
        index: String
    }
    AccountKey20?: {
        network: string,
        key: string
    }
    PalletInstance?: number,
    GeneralIndex?: number,
    GeneralKey?: {
        length: number,
        data: string
    }
    OnlyChild?: boolean,
    Plurality?: {
        id: string,
        part: string
    }
}

export interface V3CalculationResult {
    inputAmount: bn,
    outputAmount: bn,
    targetPrice: bn
}


// export interface MyLp{
//     chainId: number,
//     contractAddress?: string,
//     poolAssets: any[]
//     liquidityStats: string[]
// }

export interface CexLp{
    exchange: string,
    assetTicker: string,
    price: [number, number],
    priceDecimals: [number, number],
}

export interface StableSwapPool{
    chainId: number,
    contractAddress?: string,
    poolAssets: any[],
    liquidityStats: string[],
    tokenPrecisions: string[],
    swapFee: string,
    a: number,
    aPrecision: number,
    aBlock: number,
    futureA: number,
    futureABlock: number,
    totalSupply: string,
    poolPrecision: string,
}

export interface LpData {
    address: string,
    lp: boolean,
    abi?: string,
    name?: string,
    symbol?: string

}

export interface LpResult {
    success: boolean,
    abi: string
    name?: string,
    symbol?: string
}

export interface Lp {
    chainId: number,
    contractAddress: string,
    poolAssets: string[],
    liquidityStats: string[]
}
export interface GlobalState{
    price: string,
    tick: string,
    fee: string,
    timepointIndex: string,
    communityFeeToken0: string,
    communityFeeToken1: string,
    unlocked: boolean
}

export interface Slot0 {
    sqrtPriceX96: string,
    tick: string,
    observationIndex: string,
    observationCardinality: string,
    observationCardinalityNext: string,
    fee: string, //feeProtocol
    unlocked: boolean

}

export interface TickData {
    tick: number,
    liquidityTotal: string,
    liquidityDelta: string,
    intialized: boolean
}
export interface LpV3Data {
    contractAddress: string,
    token0: string,
    token1: string,
    activeLiquidity: string,
    currentPriceX96: string,
    feeRate: string,
    currentTick: number,
    tickSpacing: number,
    lowerTicks: TickData[],
    upperTicks: TickData[],
}

export interface MyLp{
    chainId: number,
    dexType?: string,
    contractAddress?: string,
    abi?: string,
    poolAssets: any[]
    liquidityStats: string[],
    feeRate?: string,
    currentTick?: number,
    activeLiquidity?: string,
    lowerTicks?: TickData[],
    upperTicks?: TickData[],
}

export interface UniswapV3SwapParams{
    poolAddress: string,
    zeroForOne: boolean,
    amountSpecified: bigint,
    sqrtPriceLimit: bigint,
    data: string
}

export interface UniswapV3CallbackData{
    tokenIn: string,
    tokenOut: string,
    payer: string
}

export interface SwapSingleParams{
    tokenIn: string,
    tokenOut: string,
    fee: bigint,
    amountIn: bigint,
    sqrtPriceLimitX96: bigint,
    poolAddress: string
}

export interface ManagerSwapParams{
    swapType: number, // 0 V2, 1 V3
    dexAddress: string,
    abiIndex: number, // 0 solar, 1 zen, 2 uni, 3 algebra
    inputTokenIndex: number,
    inputToken: string,
    outputToken: string,
    amountIn: ethers.BigNumberish,
    amountOut: ethers.BigNumberish,
    glmrWrapAmount: ethers.BigNumberish,
    fee: number,
    sqrtPriceLimitX96: ethers.BigNumberish, // Use to specify a minimum amount  out, or set to max
    data: string // can remove, solar takes a 0x data parameter
}

//     struct ManagerSwapParams {
//         uint8 swapType; // 0 for V2, 1 for V3
//         address dexAddress;
//         uint8 abiIndex;
//         uint8 inputTokenIndex;
//         address inputToken;
//         address outputToken;
//         uint256 amountIn;
//         uint256 amountOut;
//         uint256 movrWrapAmount;
//         uint24 fee; // V3
//         uint160 sqrtPriceLimitX96; // V3
//         bytes data;
// }