import { deepEqual, findValueByKey, getAssetRegistry, getNode } from "../utils/index.ts";
import { TokenData, IMyAsset, Relay, PNode } from "../types/types.ts";
import { TNode } from "@paraspell/sdk";


/**
 * Class to implement the MyAssetRegistryObject interface with helpful functions. Should replace all instances of MyAssetRegistryObject
 * 
 * 
 */
export class MyAsset implements IMyAsset {
    tokenData: TokenData;
    hasLocation: boolean;
    tokenLocation?: string;

    constructor(asset: IMyAsset){
        this.tokenData = asset.tokenData;
        this.hasLocation = asset.hasLocation;
        this.tokenLocation = asset.tokenLocation;
    }
    getRelay(): Relay{
        return this.tokenData.network as Relay
    }
    getChainId(): number {
        return this.tokenData.chain
    }
    getName(): string{
        return this.tokenData.name
    }
    getSymbol(): string{
        return this.tokenData.symbol
    }
    getLocalId(): string{
        return this.tokenData.localId
    }
    getDecimals(): number{
        return Number.parseInt(this.tokenData.decimals)
    }
    /**
     * If hasLocation === false, will throw error. Should rewrite the location properties to be more concise and safe
     * 
     * @returns Token location as string
     */
    getLocation(): string {
        if (this.hasLocation === false) throw new Error(`Trying to get token location for asset without a location`)
        return this.tokenLocation!
    }

    /**
     * Get unique registry key (chainId + local id). Used for building token graph
     */
    getAssetKey(): string{
        return JSON.stringify(this.tokenData.chain.toString() + JSON.stringify(this.tokenData.localId))
    }
    /**
     * Parses the 'Parachain' value from token location, which is the chain the asset was created on
     * 
     * @returns Origin chain id
     */
    getOriginChainId(): number {
        // Check if relay chain/kusama
        if(this.tokenLocation == "here"){
            return 0
        }
        let parachain = findValueByKey(this.tokenLocation, "Parachain")
        if(!parachain){
            throw new Error("Can't find origin chain for asset node: " + JSON.stringify(this, null, 2))
        }
        return parseInt(parachain)
    }

    /**
     * Get corresponding asset on origin chain by comparing token locations
     * 
     * @returns 
     */
    getOriginAsset(): MyAsset {
        let assetRegistry: IMyAsset[] = getAssetRegistry(this.getRelay())
        let originChain = this.getOriginChainId()
        let originAsset = assetRegistry.find((asset: IMyAsset) => 
            asset.tokenData.chain === originChain && 
            asset.hasLocation && 
            deepEqual(asset.tokenLocation, this.tokenLocation)
        )
        if(!originAsset){
            throw new Error("Can't find origin asset for asset node: " + JSON.stringify(this, null, 2))
        }
        return new MyAsset(originAsset)
    }

    getChainNode(): PNode{
        return getNode(this.getRelay(), this.getChainId())
    }

    getContractAddress(): string {
        if (this.tokenData.contractAddress === undefined) throw new Error(`Asset ${this.getChainNode()} ${this.getSymbol()} does not have a contract address`)
        return this.tokenData.contractAddress
    }

}