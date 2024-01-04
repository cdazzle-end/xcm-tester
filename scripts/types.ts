import { EventRecord, Phase, Event, Hash } from '@polkadot/types/interfaces'
import { ISubmittableResult, IU8a } from '@polkadot/types/types'
import { TNode, getAssetsObject, getNode } from '@paraspell/sdk'
import { AssetNode } from './AssetNode';
import { ApiPromise, ApiRx } from '@polkadot/api';

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

export interface TxDetails {
    success: boolean;
    hash: IU8a,
    included: EventRecord[];
    finalized: EventRecord[];
    blockHash: string;
    txHash: Hash;
    txIndex?: number;
}

// Type for JSON objects stored in result data files
export interface ResultDataObject {
    node_key: string,
    asset_name: string,
    path_value: number
}

export interface AssetNodeData {
    paraspellAsset: { symbol?: string; assetId?: string },
    paraspellChain: TNode,
    assetRegistryObject: MyAssetRegistryObject,
    pathValue: number,
    getChainId(): number

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
    assetInLocalId: string,
    assetInAmount: number,
    assetOutLocalId: string,
    assetOutTargetAmount: number,
    assetNodes: AssetNode[]

}
export type TransferInstruction = TransferToHomeChainInstruction | TransferAwayFromHomeChainInstruction | TransferToHomeThenDestInstruction;
// export type TransferInstructionType = InstructionType.TransferToHomeChain | InstructionType.TransferAwayFromHomeChain | InstructionType.TransferToHomeThenDestination;

export interface BasicTransferInstructionInterface {
    type: InstructionType.TransferToHomeChain | InstructionType.TransferAwayFromHomeChain | InstructionType.TransferToHomeThenDestination;
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
    middleNode: TNode | "Kusama";
    middleAssetNode: AssetNode;
    middleNodeLocalId: string;  
}
