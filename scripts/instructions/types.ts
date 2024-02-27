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

// Type for JSON objects stored in result data files
export interface ResultDataObject {
    node_key: string,
    asset_name: string,
    path_value: number,
    path_identifier: number,
}

export interface AssetNodeData {
    paraspellAsset: { symbol?: string; assetId?: string },
    paraspellChain: TNode,
    assetRegistryObject: MyAssetRegistryObject,
    pathValue: number,
    getChainId(): number

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
}
export enum InstructionType {
    Swap,
    TransferToHomeChain,
    TransferAwayFromHomeChain,
    TransferToHomeThenDestination
}

export interface SwapInstruction {
    type: InstructionType.Swap;
    chain: number,
    instructionIndex: number,
    pathType: number,
    assetInLocalId: string,
    assetInAmount: number,
    assetInAmountFixed: FixedPointNumber,
    assetOutLocalId: string,
    assetOutTargetAmount: number,
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

    startNode: TNode | "Kusama";
    destinationNode: TNode | "Kusama";

    startNodeLocalId: string;
    destinationNodeLocalId: string;

    startAssetNode: AssetNode;
    destinationAssetNode: AssetNode;

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
    middleNode: TNode | "Kusama";
    middleAssetNode: AssetNode;
    middleNodeLocalId: string;  
}
export interface ParaspellAsset {
    symbol?: string;
    assetId?: string;
}

export interface TransferrableAssetObject {
    sourceParaspellChainName: TNode | "Kusama";
    assetRegistryObject: MyAssetRegistryObject;
    paraspellAsset: ParaspellAsset;
    originChainParaId: number;
    originParaspellChainName: TNode | "Kusama";
}

export interface TransferParams {
    type: string;
    from: TNode;
    to?: TNode | "Kusama";
    currency?: string;
    amount?: any;
    address?: string;
    transferrableAssetObject: TransferrableAssetObject;
}
export interface TransferTxStats {
    startChain: string,
    startParaId: number,
    destChain: string,
    destParaId: number,
    currency: string,
    startBalanceStats: BalanceChangeStats,
    destBalanceStats: BalanceChangeStats,
    feesAndGasAmount: FixedPointNumber,
}
export interface BalanceChangeStats{
    startBalance: FixedPointNumber,
    endBalance: FixedPointNumber,
    changeInBalance: FixedPointNumber,
    startBalanceString: string,
    endBalanceString: string,
    changeInBalanceString: string,
}

export interface ChainNonces{
    2000: number,
    2023: number,
    2001: number,
    2090: number,
    2110: number,
    2085: number
}
export interface ExecutionState{
    lastNode: LastNode,
    lastFilePath: string,
    extrinsicSetResults: ExtrinsicSetResultDynamic,
    transactionState: TransactionState,
    transactionProperties: SwapProperties | TransferProperties,

}
export enum TransactionState {
    PreSubmission = "PreSubmission",
    Broadcasted = "Broadcasted",
    Finalized = "Finalized"
}
export interface SwapProperties{
    type: 'Swap',
    chopsticks: boolean,
    node: TNode | 'Kusama',
    paraId: number,
    address: string,
    assetInSymbol: string,
    assetInStartBalance: BalanceData,
    assetInStartBalanceString: string,
    assetInDecimals: string,
    assetOutSymbol: string,
    assetOutStartBalance: BalanceData,
    assetOutStartBalanceString: string,
    assetOutDecimals: string,
    inputAmount: number,
    destAssetKey: string
    

}
export interface TransferProperties{
    type: 'Transfer',
    chopsticks: boolean,
    startNode: TNode | 'Kusama',
    startParaId: number,
    startAssetSymbol: string,
    startAddress: string,
    startNodeStartBalance: BalanceData,
    startNodeStartBalanceString: string,
    destNode: TNode | 'Kusama',
    destParaId: number,
    destAssetSymbol: string,
    destAddress: string,
    destNodeStartBalance: BalanceData,
    destNodeStartBalanceString: string,
    inputAmount: number,
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
    firstNode: TNode | "Kusama",
    secondNode: TNode | "Kusama",
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
    pathAmount: number,
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
    tokenInBalanceChange: BalanceChangeStats,
    tokenOutBalanceChange: BalanceChangeStats,
    feesAndGasAmount?: FixedPointNumber,

}
export interface SwapExtrinsicContainer{
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
    pathSwapType: number,
    pathAmount: number,

    assetSymbolOut: string,
    
    expectedAmountOut: FixedPointNumber,
    api?: ApiPromise,
    reverseTx?: any,
    movrBatchSwapParams?: BatchSwapParams
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

export interface ReverseSwapExtrinsicParams{
    chainId: number,
    chain?: TNode,
    type?: number,
    module?: string,
    call?: string,
    supply?: FixedPointNumber | TokenAmount | BN,
    target: FixedPointNumber | TokenAmount | BN,
    supplyFn?: FixedPointNumber,
    targetFn?: FixedPointNumber,
    poolIndex?: any,
    path?: any[],
    supplyAssetId: any,
    supplySymbol?: any,
    targetAssetId: any,
    targetSymbol?: any,
    assetLength?: any,
    recipient?: any,
    deadline?: any,
    moduleBApi?: ModuleBApi,
    mangataInstance?: MangataInstance,
    movrBatchSwapParams?: BatchSwapParams
    assetSymbolIn?: string,
    assetSymbolOut?: string,
    assetAmountIn?: FixedPointNumber,
    assetAmountOut?: FixedPointNumber,
    startAssetIndex?: number,
    endAssetIndex?: number,
}

export interface ReverseKarSwapParams {
    chainId: number,
    chain: TNode,
    type: number,
    module: string,
    call: string,
    supplyAssetId: any,
    targetAssetId: any,
    supply: FixedPointNumber,
    target: FixedPointNumber,
    // *****
    path?: any[],
    // *****
    poolIndex?: any,
    startAssetIndex?: number,
    endAssetIndex?: number,
    assetLength?: any,
}

export interface ReverseBncSwapParams {
    chainId: number,
    chain: TNode,
    path: MultiPath[],
    supply: TokenAmount,
    supplyFn: FixedPointNumber,
    target: TokenAmount,
    targetFn: FixedPointNumber,
    recipient: string,
    deadline: number,
    call: string,
    moduleBApi: ModuleBApi,
    supplyAssetId: string,
    targetAssetId: string
}

export interface ReverseBsxSwapParams {
    chainId: 2090,
    chain: string,
    // supplyAssetId: reverseIn.id,
    // targetAssetId: reverseOut.id,
    // supplySymbol: destAssetSymbol,
    // targetSymbol: startAssetSymbol,
    // supply: reverseSupply,
    // target: reverseTarget,
    // module: "router",
    // call: "sell",
    // path: route,
}

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
    extrinsicData: (SingleTransferResultData | SingleSwapResultData)[],
    lastSuccessfulNode: LastNode,
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
export interface SingleTransferResultData {
    success: boolean,
    arbExecutionResult: ArbExecutionResult,
    resultPathNode?: PathNodeValues,
    transferTxStats: TransferTxStats,
    lastNode: LastNode,
    extrinsicIndex: number,
}

export interface SingleSwapResultData {
    success: boolean,
    arbExecutionResult: ArbExecutionResult,
    resultPathNode?: PathNodeValues,
    swapTxStats: SwapTxStats,
    swapTxResults: any,
    lastNode: LastNode,
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
    assetAmountIn: number,
    assetAmountOut: number,
    blockHash: string,
}
export interface PreExecutionTransfer {
    fromChainId: number,
    fromChainNode: TNode | "Kusama",
    fromChainAccount: any,
    toChainId: number,
    toChainNode: TNode | "Kusama",
    toChainAccount: any,
    extrinsic: paraspell.Extrinsic,
    transferAmount: FixedPointNumber
}

