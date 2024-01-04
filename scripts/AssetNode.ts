import { TNode } from "@paraspell/sdk";
import { MyAssetRegistryObject } from "./types";
import { findValueByKey } from "./utils";
import fs from 'fs'
import path from 'path'

export interface AssetNodeData {
    paraspellAsset: { symbol?: string; assetId?: string } | null,
    paraspellChain: TNode | "Kusama",
    assetRegistryObject: MyAssetRegistryObject,
    pathValue: number,
}

export class AssetNode implements AssetNodeData{
    paraspellAsset: { symbol?: string; assetId?: string } | null;
    paraspellChain: TNode | "Kusama";
    assetRegistryObject: MyAssetRegistryObject;
    pathValue: number;

    constructor(data: AssetNodeData) {
        this.paraspellAsset = data.paraspellAsset;
        this.paraspellChain = data.paraspellChain;
        this.assetRegistryObject = data.assetRegistryObject;
        this.pathValue = data.pathValue;
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
    // Get origin asset object by comparing location on origin chain
    getAssetOriginRegistryObject(): MyAssetRegistryObject {
        // console.log("Searching for asset origin registry object for asset: " + JSON.stringify(this, null, 2))
        let originChainId = this.getAssetOriginChainId()
        let assetRegistry: MyAssetRegistryObject[] = JSON.parse(fs.readFileSync(path.join(__dirname, '../allAssets.json'), 'utf8'));
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

function deepEqual(obj1: any, obj2: any) {
    // console.log("***** DEEP EQUAL *****")
    // console.log("obj1: " + JSON.stringify(obj1))
    // console.log("obj2: " + JSON.stringify(obj2))
    if (obj1 === obj2) {
        return true;
    }
    if (typeof obj1 !== 'object' || typeof obj2 !== 'object' || obj1 == null || obj2 == null) {
        return false;
    }

    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    if (keys1.length !== keys2.length) {
        return false;
    }

    for (let key of keys1) {
        if (!keys2.includes(key) || !deepEqual(obj1[key], obj2[key])) {
            return false;
        }
    }

    return true;
}


// const areEqual = deepEqual(object1.tokenLocation, object2.tokenLocation);
