import { TNode } from "@paraspell/sdk";
import { MyAssetRegistryObject, PathData } from "./types.ts";
// import { findValueByKey } from "./utils.ts";
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url';
import { FixedPointNumber } from "@acala-network/sdk-core";

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
    paraspellAsset: { symbol?: string; assetId?: string } | null,
    paraspellChain: TNode | "Kusama" | "Polkadot",
    assetRegistryObject: MyAssetRegistryObject,
    pathValue: number,
    pathType: number,
    pathData: PathData
}

export class AssetNode implements AssetNodeData{
    paraspellAsset: { symbol?: string; assetId?: string } | null;
    paraspellChain: TNode | "Kusama" | "Polkadot";
    assetRegistryObject: MyAssetRegistryObject;
    pathValue: number;
    pathValueFixed: FixedPointNumber
    pathType: number;
    pathData: PathData;
    

    constructor(data: AssetNodeData) {
        this.paraspellAsset = data.paraspellAsset;
        this.paraspellChain = data.paraspellChain;
        this.assetRegistryObject = data.assetRegistryObject;
        this.pathValue = data.pathValue;
        this.pathType = data.pathType;
        this.pathData = data.pathData;

        let assetDecimals = this.assetRegistryObject.tokenData.decimals
        // console.log("PATH VALUE ", this.pathValue)
        this.pathValueFixed = new FixedPointNumber(this.pathValue, Number.parseInt(assetDecimals))
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
    // Get origin asset object by comparing location on origin chain
    getAssetOriginRegistryObject(): MyAssetRegistryObject {
        // console.log("Searching for asset origin registry object for asset: " + JSON.stringify(this, null, 2))
        let originChainId = this.getAssetOriginChainId()
        let relay = this.assetRegistryObject.tokenData.network;
        let assetRegistry: MyAssetRegistryObject[] = relay === 'kusama' ? JSON.parse(fs.readFileSync(path.join(__dirname, '../../allAssets.json'), 'utf8')) : JSON.parse(fs.readFileSync(path.join(__dirname, '../../allAssetsPolkadot.json'), 'utf8'));
        // let assetRegistry: MyAssetRegistryObject[] = JSON.parse(fs.readFileSync(path.join(__dirname, '../../allAssets.json'), 'utf8'));
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
