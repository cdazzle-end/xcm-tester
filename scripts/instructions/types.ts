import { EventRecord, Phase, Event, Hash, BlockNumber, ExtrinsicStatus, DispatchError, DispatchInfo } from '@polkadot/types/interfaces'
import { ISubmittableResult, IU8a } from '@polkadot/types/types'
import { TNode, getAssetsObject, getNode } from '@paraspell/sdk'
import { AssetNode } from './AssetNode.ts';
import { ApiPromise, ApiRx } from '@polkadot/api';
import { FixedPointNumber } from '@acala-network/sdk-core';
import { SubmittableExtrinsic } from '@polkadot/api/submittable/types'
import * as paraspell from '@paraspell/sdk'
import { MultiPath, TokenAmount } from '@zenlink-dex/sdk-core';
import { ModuleBApi } from '@zenlink-dex/sdk-api';
import { BN } from '@polkadot/util/bundle';
import { MangataInstance } from '@mangata-finance/sdk';
import { BatchSwapParams } from './../swaps/movr/utils/types.ts';
import { BalanceData, getAdapter } from '@polkawallet/bridge';
import { ManagerSwapParams } from 'scripts/swaps/glmr/utils/types.ts';
import bn, { BigNumber } from 'bignumber.js'
// import { BalanceData } from '@polkawallet/bridge';
// import { ISubmittableResult, IU8a } from '@polkadot/types/types'

export interface ApiSet {
    promise: ApiPromise;
    promiseEndpoint: string;
    observable: ApiRx;
    observableEndpoint: string;
}


export interface MyAssetRegistryObject {
    tokenData: MyAsset,
    hasLocation: boolean;
    tokenLocation?: string;
}

export interface MyAsset {
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

// // Type for JSON objects stored in result data files
// export interface JsonPathNode {
//     node_key: string,
//     asset_name: string,
//     path_value: number,
//     path_type: number,
//     path_data: any
// }

export interface AssetNodeData {
    paraspellAsset: { symbol?: string; assetId?: string },
    paraspellChain: TNode,
    assetRegistryObject: MyAssetRegistryObject,
    pathValue: number,
    getChainId(): number

}

export interface JsonPathNode {
    node_key: string,
    asset_name: string,
    path_value: number,
    path_type: string,
    path_data: any
}
export type TxDetails = {
    success: boolean;
    dispatchError?: DispatchError | undefined;
    dispatchInfo?: DispatchInfo | undefined;
    hash?: IU8a,
    included?: EventRecord[];
    finalized?: EventRecord[];
    eventLogs?: any[];
    blockHash?: string;
    status?: ExtrinsicStatus;
    txHash?: Hash;
    txIndex?: number;
    blockNumber?: BlockNumber;
    decodedError?: any;
    errorMessages?: string[];
    movrInfo?: any;
    glmrInfo?: any;
    xcmMessageHash?: string;
    xcmMessageId?: string,
    feeEvent?: any
}
export enum InstructionType {
    Swap,
    TransferToHomeChain,
    TransferAwayFromHomeChain,
    TransferToHomeThenDestination
}

export const enum PathType {
    Xcm = "Xcm",
    DexV2 = "Dex", // REVIEW DexV2 is saved as Dex in arb finder. Should reformat to make consistant from arb finder
    StableSwap = "StableSwap",
    DexV3 = "DexV3",
    OmniSwap = "OmniSwap"
}
export interface PathData{
    dexType: string, // 0 solar 1 zenlink 2 uni 3 algebra
    lpId: string // pool address
    xcmTransferFeeAmounts?: string[] // fee amounts
    xcmTransferReserveAmounts?: string[] // reserve values
    xcmDepositFeeAmounts?: string[],
    xcmDepositReserveAmounts?: string[]
}
export interface SwapInstruction {
    type: InstructionType.Swap;
    chain: number,
    instructionIndex: number,
    pathType: PathType, // 0 xcm | 1 dexV2 | 2 stable swap | 3 dexV3 | 4 omniswap
    pathData: PathData,
    assetInLocalId: string,
    assetInAmount: string,
    assetInAmountFixed: FixedPointNumber,
    assetOutLocalId: string,
    assetOutTargetAmount: string,
    assetOutTargetAmountFixed: FixedPointNumber,
    assetNodes: AssetNode[]

}
export type TransferInstruction = TransferToHomeChainInstruction | TransferAwayFromHomeChainInstruction | TransferToHomeThenDestInstruction;
// export type TransferInstructionType = InstructionType.TransferToHomeChain | InstructionType.TransferAwayFromHomeChain | InstructionType.TransferToHomeThenDestination;

export interface BasicTransferInstructionInterface {
    type: InstructionType.TransferToHomeChain | InstructionType.TransferAwayFromHomeChain | InstructionType.TransferToHomeThenDestination;
    instructionIndex: number,
    fromChainId: number,
    toChainId: number,

    startNode: TNode | "Kusama" | "Polkadot";
    destinationNode: TNode | "Kusama" | "Polkadot";

    startNodeLocalId: string;
    destinationNodeLocalId: string;

    startAssetNode: AssetNode;
    destinationAssetNode: AssetNode;

    startTransferReserve: string,
    startTransferFee: string,

    destinationDepositFee: string,
    destinationDepositReserve: string,

    assetNodes: AssetNode[]

}
export interface TransferToHomeChainInstruction extends BasicTransferInstructionInterface {
    type: InstructionType.TransferToHomeChain;
}
export interface TransferAwayFromHomeChainInstruction extends BasicTransferInstructionInterface {
    type: InstructionType.TransferAwayFromHomeChain;
}
export interface TransferToHomeThenDestInstruction extends BasicTransferInstructionInterface {
    type: InstructionType.TransferToHomeThenDestination;
    secondInstructionIndex: number,
    middleNode: TNode | "Kusama" | "Polkadot";
    middleAssetNode: AssetNode;
    middleNodeLocalId: string;
    middleTransferReserve: string, 
    middleTransferFee: string,
    middleDepositReserve: string, 
    middleDepositFee: string
}
export interface ParaspellAsset {
    symbol?: string;
    assetId?: string;
}

export interface TransferrableAssetObject {
    sourceParaspellChainName: TNode | "Kusama" | "Polkadot";
    assetRegistryObject: MyAssetRegistryObject;
    // paraspellAsset: ParaspellAsset;
    originChainParaId: number;
    originParaspellChainName: TNode | "Kusama" | "Polkadot";
}

export interface TransferParams {
    type: string;
    from: TNode;
    to?: TNode | "Kusama" | "Polkadot";
    currency?: string;
    amount?: any;
    address?: string;
    transferrableAssetObject: TransferrableAssetObject;
}
// export interface TransferFeeData{
//     originFeeAsset:
// }
export interface TransferTxStats {
    startChain: string,
    startParaId: number,
    destChain: string,
    destParaId: number,
    currency: string,
    startAssetId: string,
    startBalanceStats: BalanceChangeStatsBn,
    destBalanceStats: BalanceChangeStatsBn,
    feesAndGasAmount?: bn, // Remove this as we have new fee structure
    originFee: FeeData,
    destinationFee: FeeData
}
export interface BalanceChangeStats{
    startBalance: FixedPointNumber,
    endBalance: FixedPointNumber,
    changeInBalance: FixedPointNumber,
    startBalanceString: string,
    endBalanceString: string,
    changeInBalanceString: string,
}

export interface BalanceChangeStatsBn{
    startBalance: bn,
    endBalance: bn,
    changeInBalance: bn,
    startBalanceDisplay: string,
    endBalanceDisplay: string,
    changeInBalanceDisplay: string,
    decimals?: number
}

export interface ChainNonces{
    2000: number,
    2023: number,
    2001: number,
    2090: number,
    2110: number,
    2085: number
}
// export interface ChainNonces{
//     [string]: number,
// }
export interface ExecutionState{
    tracking: boolean, // If true, we are currently tracking the execution of a set of extrinsics
    relay: Relay | null,
    lastNode: LastNode | null,
    lastFilePath: string | null,
    extrinsicSetResults: ExtrinsicSetResultDynamic | null,
    transactionState: TransactionState | null,
    transactionProperties: SwapProperties | TransferProperties | null,
    executionSuccess: boolean,
    executionAttempts: number | null,
    accumulatedFeeData: AccumulatedFeeData | null,
    xcmFeeReserves: ReserveFeeData[] | null
}

export type Relay = "kusama" | "polkadot"

export type TransferOrDeposit = "Transfer" | "Deposit"

export enum TransactionState {
    PreSubmission = "PreSubmission",
    Broadcasted = "Broadcasted",
    Finalized = "Finalized"
}
export type NativeBalancesType = {
    [key: number]: string;
  };
export interface SwapProperties{
    type: 'Swap',
    relay: Relay,
    chopsticks: boolean,
    node: TNode | 'Kusama' | 'Polkadot',
    paraId: number,
    address: string,
    assetInSymbol: string,
    assetInLocalId: string,
    assetInStartBalance: BalanceData,
    assetInStartBalanceString: string,
    assetInDecimals: string,
    assetOutSymbol: string,
    assetOutLocalId: string,
    assetOutStartBalance: BalanceData,
    assetOutStartBalanceString: string,
    assetOutDecimals: string,
    inputAmount: string,
    destAssetKey: string
    

}
export interface TransferProperties{
    type: 'Transfer',
    chopsticks: boolean,
    relay: Relay,
    startNode: TNode | 'Kusama' | 'Polkadot',
    startParaId: number,
    startAssetSymbol: string,
    startAssetLocalId: string,
    startAddress: string,
    startNodeStartBalance: BalanceData,
    startNodeStartBalanceString: string,
    destNode: TNode | 'Kusama' | 'Polkadot',
    destParaId: number,
    destAssetSymbol: string,
    destAssetLocalId: string,
    destAddress: string,
    destNodeStartBalance: BalanceData,
    destNodeStartBalanceString: string,
    inputAmount: string,
    reserveAmount: string,
    assetDecimals: string,
    destAssetKey: string,

}
export interface ExtrinsicObject{
    type: "Swap" | "Transfer",
    instructionIndex?: number[],
    extrinsicIndex?: number,
    correspondingExtrinsicIndex?: number,
    transferExtrinsicContainer?: TransferExtrinsicContainer,
    swapExtrinsicContainer?: SwapExtrinsicContainer
}
export interface TransferExtrinsicContainer{
    relay: Relay,
    firstNode: TNode | "Kusama" | "Polkadot",
    secondNode: TNode | "Kusama" | "Polkadot",
    assetSymbol: string,
    assetIdStart: string,
    assetIdEnd: string,
    extrinsic: paraspell.Extrinsic | any,
    instructionIndex: number[],
    extrinsicIndex: number,
    startApi: ApiPromise,
    destinationApi: ApiPromise,
    startChainId: number,
    destinationChainId: number,
    startTransferrable: TransferrableAssetObject,
    destinationTransferrable: TransferrableAssetObject,
    pathInLocalId: string,
    pathOutLocalId: string,
    pathSwapType: number,
    pathAmount: string,
    transferReserveAmount: string,
    depositReserveAmount: string,
}
export interface SwapTxStats {
    txHash: Hash,
    chain: string,
    paraId: number,
    currencyIn: string,
    currencyOut: string,
    expectedAmountIn: string,
    actualAmountIn: string,
    expectedAmountOut: string,
    actualAmountOut: string,
    tokenInBalanceChange: BalanceChangeStatsBn,
    tokenOutBalanceChange: BalanceChangeStatsBn,
    feesAndGasAmount?: bn,

}


export interface PromiseTracker {
    trackedPromise: Promise<any>;
    isResolved: () => boolean;
}
export interface SwapExtrinsicContainer{
    relay: Relay,
    chainId: number,
    chain: TNode,
    assetNodes: AssetNode[],
    extrinsic: SubmittableExtrinsic<"promise", ISubmittableResult> | SubmittableExtrinsic<"rxjs", ISubmittableResult> | any,
    extrinsicIndex: number,
    instructionIndex: number[],
    nonce?: number,
    txString?: string,
    assetAmountIn: FixedPointNumber,
    assetSymbolIn: string,
    
    // pathInLocalId: string,
    // pathOutLocalId: string,
    pathType: PathType,
    pathAmount: string,

    assetSymbolOut: string,
    
    expectedAmountOut: FixedPointNumber,
    api?: ApiPromise,
    reverseTx?: any,
    movrBatchSwapParams?: BatchSwapParams,
    glmrSwapParams?: ManagerSwapParams[]
}
export interface PathNodeValues {
    // pathInLocalId: string,
    // pathInSymbol: string,
    // pathOutSymbol: string,
    // pathOutLocalId: string,
    // pathSwapType: number,
    // pathValue: number,
    // pathValueNext?: number,

}

// export interface ReverseSwapExtrinsicParams{
//     chainId: number,
//     chain?: TNode,
//     type?: number,
//     module?: string,
//     call?: string,
//     supply?: FixedPointNumber | TokenAmount | BN,
//     target: FixedPointNumber | TokenAmount | BN,
//     supplyFn?: FixedPointNumber,
//     targetFn?: FixedPointNumber,
//     poolIndex?: any,
//     path?: any[],
//     supplyAssetId: any,
//     supplySymbol?: any,
//     targetAssetId: any,
//     targetSymbol?: any,
//     assetLength?: any,
//     recipient?: any,
//     deadline?: any,
//     moduleBApi?: ModuleBApi,
//     mangataInstance?: MangataInstance,
//     movrBatchSwapParams?: BatchSwapParams
//     assetSymbolIn?: string,
//     assetSymbolOut?: string,
//     assetAmountIn?: FixedPointNumber,
//     assetAmountOut?: FixedPointNumber,
//     startAssetIndex?: number,
//     endAssetIndex?: number,
// }

// export interface ReverseKarSwapParams {
//     chainId: number,
//     chain: TNode,
//     type: number,
//     module: string,
//     call: string,
//     supplyAssetId: any,
//     targetAssetId: any,
//     supply: FixedPointNumber,
//     target: FixedPointNumber,
//     // *****
//     path?: any[],
//     // *****
//     poolIndex?: any,
//     startAssetIndex?: number,
//     endAssetIndex?: number,
//     assetLength?: any,
// }

// export interface ReverseBncSwapParams {
//     chainId: number,
//     chain: TNode,
//     path: MultiPath[],
//     supply: TokenAmount,
//     supplyFn: FixedPointNumber,
//     target: TokenAmount,
//     targetFn: FixedPointNumber,
//     recipient: string,
//     deadline: number,
//     call: string,
//     moduleBApi: ModuleBApi,
//     supplyAssetId: string,
//     targetAssetId: string
// }

// export interface ReverseBsxSwapParams {
//     chainId: 2090,
//     chain: string,
//     // supplyAssetId: reverseIn.id,
//     // targetAssetId: reverseOut.id,
//     // supplySymbol: destAssetSymbol,
//     // targetSymbol: startAssetSymbol,
//     // supply: reverseSupply,
//     // target: reverseTarget,
//     // module: "router",
//     // call: "sell",
//     // path: route,
// }

export interface SwapResultObject {
    txString?: string,
    txDetails?: TxDetails
}

export interface ExtrinsicSetResult {
    success: boolean,
    arbExecutionResult: ArbExecutionResult[],
    resultPathNodes?: PathNodeValues[],
    transferTxStats: TransferTxStats[],
    swapTxStats: SwapTxStats[],
    swapTxResults: any[],
    lastNode: LastNode,
    extrinsicIndex: number,
}
export interface ExtrinsicSetResultDynamic {
    success: boolean,
    allExtrinsicResults: (SingleTransferResultData | SingleSwapResultData)[],
    lastSuccessfulNode: LastNode | null,
}

export interface SingleExtrinsicResultData{
    success: boolean,
    arbExecutionResult: ArbExecutionResult,
    resultPathNode?: PathNodeValues,
    transferTxStats: TransferTxStats,
    swapTxStats: SwapTxStats,
    swapTxResults: any,
    lastNode: LastNode,
    extrinsicIndex: number,
}
export interface AccumulatedFeeData{
    [key: string]: { // Key is assetLocation string
        assetSymbol: string,
        assetDecimals: number,
        feeAmount: string
    }
}

export interface SingleTransferResultData {
    success: boolean,
    arbExecutionResult: ArbExecutionResult,
    resultPathNode?: PathNodeValues,
    transferTxStats: TransferTxStats | null,
    lastNode: LastNode | null,
    extrinsicIndex: number,

}

export interface SingleSwapResultData {
    success: boolean,
    arbExecutionResult: ArbExecutionResult,
    resultPathNode?: PathNodeValues,
    swapTxStats: SwapTxStats | null,
    swapTxResults: any,
    lastNode: LastNode | null,
    extrinsicIndex: number,
}
// Last node contains info for the last node we successfully reached in the extrinsic path, and we can use this info to start another arb path
export interface LastNode{
    assetKey: string,
    assetValue: string,
    chainId: number,
    assetSymbol: string,
}
export interface LastFilePath{
    filePath: string,
}
export interface IndexObject {
    i: number

}
export interface ArbExecutionResult{
    result: string,
    assetSymbolIn: string,
    assetSymbolOut: string,
    assetAmountIn: string,
    assetAmountOut: string,
    blockHash: string,
}
export interface PreExecutionTransfer {
    fromChainId: number,
    fromChainNode: TNode | "Kusama" | "Polkadot",
    fromChainAccount: any,
    toChainId: number,
    toChainNode: TNode | "Kusama" | "Polkadot",
    toChainAccount: any,
    extrinsic: paraspell.Extrinsic,
    transferAmount: FixedPointNumber
}

export interface AsyncFileData{
    inputAmount: number,
    estimatedOutput: number,
    latestFileData: JsonPathNode[]

}

export interface ExecutionSuccess {
    success: boolean,
    executionAttempts: number
}


// REVIEW reserves for FeeData
/**
 * Used in FeeTracker and accumulatedFees data
 * 
 * NEED TO GO THROUGH OLD DATA AND MAKE SURE ENTRIES HAVE values for reserveAssetId and reserveAssetAmount
 */
export interface FeeData{
    assetLocation: string,
    chainId: number,
    feeAssetSymbol: string,
    feeAssetId: string,
    feeAssetDecimals: number,
    feeAmount: string,
    reserveAssetId?: string,
    reserveAssetAmount?: string,
}
export interface ReserveFeeData {
    chainId: number,
    feeAssetId: string,
    feeAssetAmount: string,
    reserveAssetId: string,
    reserveAssetAmount: string
}
// REVIEW these 2 types (EventData AND LogData) are redundant and adding complexity. Can combine into one, need to adjust event fee book and arb-finder structs
// export interface TransferEventData {
//     transferAmount: bn,
//     transferAssetSymbol: string,
//     transferAssetId: string,
//     transferAssetDecimals: number,
//     feeAmount: bn,
//     feeAssetSymbol: string,
//     feeAssetId: string,
//     feeAssetDecimals: number,
//     node: TNode | "Polkadot" | "Kusama"
// }
// export interface DepositEventData {
//     depositAmount: bn
//     depositAssetSymbol: string,
//     depositAssetId: string,
//     depositAssetDecimals: number,
//     feeAmount: bn,
//     feeAssetSymbol: string,
//     feeAssetId: string,
//     feeAssetDecimals: number,
//     node: TNode | "Polkadot" | "Kusama"
// }



// export interface FeeBook {
//     "polkadot-transfer": {
//         [chainId: string]: ChainTransferData;
//     };
//     "polkadot-deposit": {
//         [chainId: string]: ChainDepositData;
//     };
// }



// export interface ChainTransferData {
//     [assetKey: string]: TransferLogData;
// }

// export interface ChainDepositData {
//   [assetKey: string]: DepositLogData;
// }

  
// TODO Merge TransferLogData and DepositLogData into one interface, change eventFeeBook data structure, modify Rust struct
//   export interface TransferLogData {
//     transferAmount: string,
//     transferDecimals: string,
//     transferAssetSymbol: string,
//     transferAssetId: string,
//     feeAmount: string,
//     feeDecimals: string
//     feeAssetSymbol: string,
//     feeAssetId: string,
// }
// export interface DepositLogData {
//     depositAmount: string,
//     feeAmount: string,
//     feeDecimals: string
//     feeAssetSymbol: string,
//     feeAssetId: string
// }
// export interface TransferLogDataReworked {
//     xcmAmount: string,
//     xcmDecimals: string,
//     xcmAssetSymbol: string,
//     xcmAssetId: string,
//     feeAmount: string,
//     feeDecimals: string
//     feeAssetSymbol: string,
//     feeAssetId: string,
// }
// export interface DepositLogDataReworked {
//     xcmAmount: string,
//     xcmDecimals?: string,
//     xcmAssetSymbol?: string,
//     xcmAssetId?: string,
//     feeAmount: string,
//     feeDecimals: string
//     feeAssetSymbol: string,
//     feeAssetId: string
// }
export interface FeeBook {
    "polkadot-transfer": {
        [chainId: string]: ChainTransferDepositData;
    };
    "polkadot-deposit": {
        [chainId: string]: ChainTransferDepositData;
    };
}
export interface ChainTransferDepositData {
    [assetKey: string]: TransferDepositJsonData;
  }

export interface TransferDepositEventData {
    xcmAmount: bn
    xcmAssetSymbol: string,
    xcmAssetId: string,
    xcmAssetDecimals: number,
    feeAmount: bn,
    feeAssetSymbol: string,
    feeAssetId: string,
    feeAssetDecimals: number,
    node: TNode | "Polkadot" | "Kusama"
}
// export interface TransferDepositLogData {
//     xcmAmount: string,
//     xcmDecimals: string,
//     xcmAssetSymbol: string,
//     xcmAssetId: string,
//     feeAmount: string,
//     feeDecimals: string
//     feeAssetSymbol: string,
//     feeAssetId: string,
//     node: string,
// }

// A utility type to convert all properties to string
export type StringifyProperties<T> = {
    [K in keyof T]: string;
};
// The type for JSON data, derived from TransferDepositEventData
export type TransferDepositJsonData = StringifyProperties<TransferDepositEventData>;

// export interface OldFeeBook {
//     "polkadot-transfer": {
//         [chainId: string]: {
//             [assetKey: string]: {
//                 transferAmount: string,
//                 transferDecimals: string,
//                 transferAssetSymbol: string,
//                 transferAssetId: string,
//                 feeAmount: string,
//                 feeDecimals: string,
//                 feeAssetSymbol: string,
//                 feeAssetId: string,
//             }
//         }
//     };
//     "polkadot-deposit": {
//         [chainId: string]: {
//             [assetKey: string]: {
//                 depositAmount: string,
//                 feeAmount: string,
//                 feeDecimals: string,
//                 feeAssetSymbol: string,
//                 feeAssetId: string,
//             }
//         }
//     };
// }

// export interface NewFeeBook {
//     "polkadot-transfer": {
//         [chainId: string]: {
//             [assetKey: string]: {
//                 xcmAmount: string,
//                 xcmDecimals: string,
//                 xcmAssetSymbol: string,
//                 xcmAssetId: string,
//                 feeAmount: string,
//                 feeDecimals: string,
//                 feeAssetSymbol: string,
//                 feeAssetId: string,
//             }
//         }
//     };
//     "polkadot-deposit": {
//         [chainId: string]: {
//             [assetKey: string]: {
//                 xcmAmount: string,
//                 xcmDecimals: string,
//                 xcmAssetSymbol: string,
//                 xcmAssetId: string,
//                 feeAmount: string,
//                 feeDecimals: string,
//                 feeAssetSymbol: string,
//                 feeAssetId: string,
//             }
//         }
//     };
// }



export interface NewFeeBook {
    "polkadot-transfer": {
        [chainId: string]: {
            [assetKey: string]: {
                xcmAmount: string,
                xcmDecimals: string,
                xcmAssetSymbol: string,
                xcmAssetId: string,
                feeAmount: string,
                feeDecimals: string,
                feeAssetSymbol: string,
                feeAssetId: string,
                node: string
            }
        }
    };
    "polkadot-deposit": {
        [chainId: string]: {
            [assetKey: string]: {
                xcmAmount: string,
                xcmDecimals: string,
                xcmAssetSymbol: string,
                xcmAssetId: string,
                feeAmount: string,
                feeDecimals: string,
                feeAssetSymbol: string,
                feeAssetId: string,
                node: string
            }
        }
    };
}


















/**
 * Used for FeeTracker. Each fee is formatted as a FeeTrackerEntry and added to FeeTracker.allFees
 */
export interface FeeTrackerEntry {
    feeData: FeeData,
    paid: boolean
}

/**
 * Used to track fees and payments
 * 
 * Tracks each fee, tracks each fee payment, and stores the remaining amount of fees to be paid for each asset
 * 
 * NOT FULLY IMPLEMENTED YET
 * 
 * @property {FeeTrackerEntry[]} allFees - Every fee entry
 * @property {any} feePayments - Every fee entry
 * @property {any} unpaidFees - Dictionary of asset locations and amounts
 */
export interface FeeTracker {
    /** Every fee entry */
    allFees: FeeTrackerEntry[],
    /** Fee payments that have been made */
    feePayments: any,
    /** Total amounts of fees that still need to be paid, according to each asset location of the fee asset */
    unpaidFees: {
        [assetLocation: string]: {
            assetSymbol: string,
            assetDecimals: number,
            feeAmount: string
        }
    }
}