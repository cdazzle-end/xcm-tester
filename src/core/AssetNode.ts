import { TNode } from "@paraspell/sdk";
import { LastNode, MyAssetRegistryObject, PathData, PathType } from "./../types/types.ts";
// import { findValueByKey } from "./utils.ts";
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url';
import { FixedPointNumber } from "@acala-network/sdk-core";
import { deepEqual, getAssetRegistry } from "../utils/utils.ts";

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
    // paraspellAsset: { symbol?: string; assetId?: string } | null,
    paraspellChain: TNode | "Kusama" | "Polkadot",
    assetRegistryObject: MyAssetRegistryObject,
    pathValue: string, // asset amount display
    // ** Maybe remove. 0 = Xcm, 1 = Dex,  2 = Stable (All forms of stable), 3 = DexV3 (PathData.path_type = pool name like uni3 or algebra), 4 = Omnipool, 100 = Cex (Not in use atm),
    // pathType is confusing and redundant as it can be inferred from pathData
    pathType: PathType,
    pathData: PathData
}

export class AssetNode implements AssetNodeData{
    // paraspellAsset: { symbol?: string; assetId?: string } | null;
    paraspellChain: TNode | "Kusama" | "Polkadot";
    assetRegistryObject: MyAssetRegistryObject;
    pathValue: string; 
    pathValueFixed: FixedPointNumber // asset amount formatted
    pathType: PathType; 
    pathData: PathData;
    

    constructor(data: AssetNodeData) {
        // this.paraspellAsset = data.paraspellAsset;
        this.paraspellChain = data.paraspellChain;
        this.assetRegistryObject = data.assetRegistryObject;
        this.pathValue = data.pathValue;
        this.pathType = data.pathType;
        this.pathData = data.pathData;

        let assetDecimals = this.assetRegistryObject.tokenData.decimals
        // console.log("PATH VALUE ", this.pathValue)
        this.pathValueFixed = new FixedPointNumber(this.pathValue, Number.parseInt(assetDecimals))
    }

    getPathValueAsNumber(){
        return Number.parseFloat(this.pathValue)
    }

    // Reduce path by 2% to ensure trade amount for reverse
    getReducedPathValue() {
        let assetDecimals = this.assetRegistryObject.tokenData.decimals
        let amountFn = new FixedPointNumber(this.pathValue, Number.parseInt(assetDecimals))
        let amountToSubtract = amountFn.mul(new FixedPointNumber(2)).div(new FixedPointNumber(100))
        let reducedAmount = amountFn.sub(amountToSubtract)
        return reducedAmount.toNumber()
    }

    getChainId(): number{
        return this.assetRegistryObject.tokenData.chain
    }

    getAssetOriginChainId(): number{
        // Check if relay chain/kusama
        if(this.assetRegistryObject.tokenLocation == "here"){
            return 0
        }
        let parachain = findValueByKey(this.assetRegistryObject.tokenLocation, "Parachain")
        if(!parachain){
            throw new Error("Can't find origin chain for asset node: " + JSON.stringify(this, null, 2))
        }
        return parseInt(parachain)
    }
    getAssetLocalId(): string {
        return this.assetRegistryObject.tokenData.localId
    }
    getAssetRegistrySymbol(): string {
        return this.assetRegistryObject.tokenData.symbol
    }
    getAssetOriginLocalId(): string {
        let originAssetRegistryObject = this.getAssetOriginRegistryObject()
        return originAssetRegistryObject.tokenData.localId
    }
    /**
     * Get's unique key for asset. (chainId + localId)
     */
    getAssetKey(): string{
        return JSON.stringify(this.getChainId().toString() + JSON.stringify(this.getAssetLocalId()))
    }
    asLastNode(): LastNode {
        return {
            assetKey: this.getAssetKey(),
            assetValue: this.pathValue,
            chainId: this.getChainId(),
            assetSymbol: this.getAssetRegistrySymbol()
        }
    }
    // Get origin asset object by comparing location on origin chain
    getAssetOriginRegistryObject(): MyAssetRegistryObject {
        // console.log("Searching for asset origin registry object for asset: " + JSON.stringify(this, null, 2))
        let originChainId = this.getAssetOriginChainId()
        let relay = this.assetRegistryObject.tokenData.network;
        let assetRegistry: MyAssetRegistryObject[] = getAssetRegistry('polkadot')
        let asset = assetRegistry.find((assetRegistryObject: MyAssetRegistryObject) => {
            if(assetRegistryObject.tokenData.chain == originChainId && assetRegistryObject.hasLocation == true){
                // console.log("Running deep equal check for asset: " + JSON.stringify(assetRegistryObject))
                let isEqual = deepEqual(assetRegistryObject.tokenLocation, this.assetRegistryObject.tokenLocation)
                if(isEqual){
                    // console.log("Found origin asset: " + JSON.stringify(assetRegistryObject, null, 2))
                    return true
                }
            }
        })
        if(!asset){
            throw new Error("Can't find origin asset for asset node: " + JSON.stringify(this, null, 2))
        }
        return asset
    }
}

