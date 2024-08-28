import { TNode } from "@paraspell/sdk";
import { LastNode, IMyAsset, PathData, PathType, Relay, PNode } from "./../types/types.ts";
// import { findValueByKey } from "./utils.ts";
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url';
import { FixedPointNumber } from "@acala-network/sdk-core";
import { deepEqual, getAssetRegistry } from "../utils/utils.ts";
import { MyAsset } from "./index.ts";

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
    // ** Maybe remove. 0 = Xcm, 1 = Dex,  2 = Stable (All forms of stable), 3 = DexV3 (PathData.path_type = pool name like uni3 or algebra), 4 = Omnipool, 100 = Cex (Not in use atm),
    // pathType is confusing and redundant as it can be inferred from pathData
    pathType: PathType,
    pathData: PathData
}

export class AssetNode implements AssetNodeData{
    chain: PNode;
    asset: MyAsset;
    pathValue: string; 
    pathValueFixed: FixedPointNumber // asset amount formatted
    pathType: PathType; 
    pathData: PathData;
    

    constructor(data: AssetNodeData) {
        // this.paraspellAsset = data.paraspellAsset;
        this.chain = data.chain;
        this.asset = new MyAsset(data.asset);
        this.pathValue = data.pathValue;
        this.pathType = data.pathType;
        this.pathData = data.pathData;

        let assetDecimals = this.asset.tokenData.decimals
        this.pathValueFixed = new FixedPointNumber(this.pathValue, Number.parseInt(assetDecimals))
    }

    getPathValueAsNumber(){
        return Number.parseFloat(this.pathValue)
    }

    // Reduce path by 2% to ensure trade amount for reverse
    getReducedPathValue() {
        let assetDecimals = this.asset.tokenData.decimals
        let amountFn = new FixedPointNumber(this.pathValue, Number.parseInt(assetDecimals))
        let amountToSubtract = amountFn.mul(new FixedPointNumber(2)).div(new FixedPointNumber(100))
        let reducedAmount = amountFn.sub(amountToSubtract)
        return reducedAmount.toNumber()
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
}

