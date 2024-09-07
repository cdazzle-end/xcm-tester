import { TNode } from "@paraspell/sdk";
import { LastNode, IMyAsset, PathData, PathType, Relay, PNode } from "./../types/types.ts";
// import { findValueByKey } from "./utils.ts";
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url';
import { MyAsset } from "./index.ts";
import bn from 'bignumber.js'
import { getBalanceFromDisplay } from "../utils/balanceUtils.ts";

// Get the __dirname equivalent in ES module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function findValueByKey(obj: any, targetKey: any): any {
    if (typeof obj !== 'object' || obj === null) {
        return null;
    }
    for (let key in obj) {
        if (key === targetKey) {
            return obj[key];
        }

        let foundValue: any = findValueByKey(obj[key], targetKey);
        if (foundValue !== null) {
            return foundValue;
        }
    }
    return null;
}

export interface AssetNodeData {
    chain: PNode,
    asset: MyAsset,
    pathValue: string, // asset amount display
    // REVIEW
    // ** Maybe remove. 0 = Xcm, 1 = Dex,  2 = Stable (All forms of stable, including stable share), 3 = DexV3 (PathData.path_type = pool name like uni3 or algebra), 4 = Omnipool, 100 = Cex (Not in use atm),
    // pathType is confusing and redundant as it can be inferred from pathData
    pathType: PathType,
    pathData: PathData
}

/**
 * Asset Nodes are built from the arb finder search result. Each asset node represents a node in the path
 * 
 * @prop chain - Chain Name
 * @prop asset - My asset data, token data + multi-location of asset
 * @prop pathValue - Asset value of node in DISPLAY format
 * @prop pathType - Type of the transition from the previous node to this one. XCM or Swap type
 * @prop pathData - Additional data relevant to the xcm or swap
 */

export class AssetNode implements AssetNodeData{
    chain: PNode;
    asset: MyAsset;
    pathValue: string; 
    pathType: PathType; 
    pathData: PathData;
    

    constructor(data: AssetNodeData) {
        // this.paraspellAsset = data.paraspellAsset;
        this.chain = data.chain;
        this.asset = new MyAsset(data.asset);
        this.pathValue = data.pathValue;
        this.pathType = data.pathType;
        this.pathData = data.pathData;
    }

    getPathValueAsNumber(){
        return Number.parseFloat(this.pathValue)
    }

    getChainId(): number{
        return this.asset.getChainId()
    }

    getOriginChainId(): number{
        return this.asset.getOriginChainId()
    }
    getLocalId(): string {
        return this.asset.getLocalId()
    }
    getAssetSymbol(): string {
        return this.asset.getSymbol()
    }
    getOriginAssetLocalId(): string {
        return this.asset.getOriginAsset().getLocalId()
    }
    /**
     * Get's unique key for asset. (chainId + localId)
     */
    getAssetKey(): string{
        return this.asset.getAssetKey()
    }
    asLastNode(): LastNode {
        return {
            assetKey: this.getAssetKey(),
            assetValue: this.pathValue,
            chainId: this.getChainId(),
            assetSymbol: this.getAssetSymbol()
        }
    }
    // Get origin asset object by comparing location on origin chain
    getAssetOriginRegistryObject(): MyAsset {
        return this.asset.getOriginAsset()
    }

    getDecimals(): number {
        return this.asset.getDecimals()
    }

    getContractAddress(): string {
        return this.asset.getContractAddress()
    }

    /**
     * Converts the path value (which is in display format) to chain format
     * 
     * @returns bn
     */
    getChainBalance(): bn {
        return getBalanceFromDisplay(this.pathValue, this.getDecimals())
    }
}

