import { options } from '@acala-network/api'
import { FixedPointNumber } from "@acala-network/sdk-core"
import { Wallet } from "@acala-network/sdk/wallet/wallet.js"
import { ApiPromise, Keyring, WsProvider } from '@polkadot/api'
import { SubmittableExtrinsic } from '@polkadot/api/submittable/types'
import { ISubmittableResult } from '@polkadot/types/types'
import { BN } from '@polkadot/util'
import { AssetNode } from '../core/index.ts'
import { IndexObject, PathType, SwapExtrinsicContainer, SwapInstruction } from '../types/types.ts'
import { getApiForNode } from './../utils/index.ts'
import bn from 'bignumber.js'

const wsLocalChain = "ws://172.26.130.75:8008"
// const wsLocalDestination = "ws://172.26.130.75:8008" 
const karRpc = "wss://karura-rpc-0.aca-api.network"

export async function getKarSwapExtrinsicDynamic(    
    swapType: PathType, 
    startAssetSymbol: any,
    amountIn: string,
    swapInstructions: SwapInstruction[], 
    chopsticks: boolean = true, 
    priceDeviationPercent: number = 2
): Promise<[SwapExtrinsicContainer, SwapInstruction[]]>{
    const api = await getApiForNode("Karura", chopsticks)
    await api.isReady;

    const wallet = new Wallet(api)
    await wallet.isReady
    let [swapInstructionsToExecute, remainingInstructions] = truncateSwapInstructions(startAssetSymbol, swapInstructions)
    const assetIn = swapInstructionsToExecute[0].assetNodes[0]
    const assetOut = swapInstructionsToExecute[swapInstructionsToExecute.length - 1].assetNodes[1]
    let startAssetDynamic = assetIn.getAssetSymbol()
    let destAssetDynamic = assetOut.getAssetSymbol()

    const startToken = wallet.getToken(startAssetDynamic);
    const destToken = wallet.getToken(destAssetDynamic);

    let tokenPathSymbols: string[] = [startAssetDynamic];
    let extrinsicNodes: AssetNode[] = [assetIn]
    swapInstructionsToExecute.forEach((swapInstruction) => {
        tokenPathSymbols.push(swapInstruction.assetNodes[1].getAssetSymbol())
        extrinsicNodes.push(swapInstruction.assetNodes[1])
    })

    let tokenPath = tokenPathSymbols.map((token)=> {
        return wallet.getToken(token).toChainData()
    })

    let amountInDynamic = assetIn.pathValue;
    let expectedAmountOutDynamic = assetOut.pathValue;
    const supplyAmount = new FixedPointNumber(amountInDynamic, startToken.decimals);
    const expectedOutAmountFixed = new FixedPointNumber(expectedAmountOutDynamic, destToken.decimals);

    const priceDeviation = expectedOutAmountFixed.mul(new FixedPointNumber(priceDeviationPercent)).div(new FixedPointNumber(100));
    let expectedAmountOutWithDeviation = expectedOutAmountFixed.sub(priceDeviation);
    let swapTx: SubmittableExtrinsic<"promise", ISubmittableResult> | SubmittableExtrinsic<"rxjs", ISubmittableResult>;

    if(swapType == PathType.DexV2){
        // Dex swap
        swapTx = await api.tx.dex
            .swapWithExactSupply(
                tokenPath,
                supplyAmount.toChainData(),
                expectedAmountOutWithDeviation.toChainData()
            )
    } else {
        // Need to figure out how to calc minDy, if KSM input, output can just equal supply
        // If LKSM input, multiply supply by 6.587, and output can be normal expected amount
        let stablePools = await api.query.stableAsset.pools.entries()
            const matchingStablePool = findObjectWithEntry(stablePools, tokenPath[0])
            if(!matchingStablePool){
                throw new Error("No matching stable pool found for asset: " + JSON.stringify(tokenPath[0], null, 2))
            }

            const poolData = matchingStablePool[1].toJSON()
            const poolAssets = poolData["assets"]
            const stablePoolIndex = poolData["poolAsset"]["stableAssetPoolToken"]
            const startAssetIndex = getAssetIndex(poolAssets, tokenPath[0])
            const endAssetIndex = getAssetIndex(poolAssets, tokenPath[1])
            const assetLength = poolAssets.length

            //if lksm or ksm, adjust parameters
            if(startAssetDynamic == "LKSM"){
                let lksmSupply = supplyAmount.times(new FixedPointNumber(6.587))

                swapTx = await api.tx.stableAsset
                .swap(
                    stablePoolIndex,
                    startAssetIndex, 
                    endAssetIndex, 
                    lksmSupply.toChainData(), 
                    // Temporary value for minDy
                    expectedAmountOutWithDeviation.toChainData(), 
                    assetLength
                )
            } else if (startAssetDynamic == "KSM"){
                swapTx = await api.tx.stableAsset
                .swap(
                    stablePoolIndex,
                    startAssetIndex, 
                    endAssetIndex, 
                    supplyAmount.toChainData(), 
                    // Temporary value for minDy
                    supplyAmount.toChainData(), 
                    assetLength
                )
            // Other stables can be calculated normally
            } else {
                console.log(`KAR Stable Swap: ${startAssetDynamic} to ${destAssetDynamic}: ${supplyAmount.toNumber()} to ${expectedAmountOutWithDeviation.toNumber()}`)
                console.log("Reducing expected by 5%")
                expectedAmountOutWithDeviation = expectedAmountOutWithDeviation.times(new FixedPointNumber(0.95))
                console.log(`KAR Stable Swap: ${startAssetDynamic} to ${destAssetDynamic}: ${supplyAmount.toNumber()} to ${expectedAmountOutWithDeviation.toNumber()}`)
                swapTx = await api.tx.stableAsset
                    .swap(
                        stablePoolIndex,
                        startAssetIndex, 
                        endAssetIndex, 
                        supplyAmount.toChainData(), 
                        // Temporary value for minDy
                        expectedAmountOutWithDeviation.toChainData(), 
                        assetLength
                    )
            }

            
    }
    // let assetNodes = extrinsicNodes[index]
        let swapTxContainer: SwapExtrinsicContainer = {
            relay: 'kusama',
            chainId: 2000,
            chain: "Karura",
            type: "Swap",
            assetNodes: extrinsicNodes,
            extrinsic: swapTx,
            assetAmountIn: new bn(supplyAmount.toChainData()),
            expectedAmountOut: new bn(expectedOutAmountFixed.toChainData()),
            assetIn: assetIn,
            assetOut: assetOut,
            pathType: swapType,
            pathAmount: amountIn,
            api: api,
        }
        return [swapTxContainer, remainingInstructions]

}


function truncateSwapInstructions(startAsset: string, swapInstructions: SwapInstruction[]){
    let instructionsToExecute = swapInstructions.slice(0, 3)
    let remainingInstructions = swapInstructions.slice(3)
    return [instructionsToExecute, remainingInstructions]
}








function getAssetIndex(stablePoolAssets: any[], targetAsset: any){
    let assetType = Object.keys(targetAsset)[0];
    let assetId = targetAsset[assetType];
    let assetIndex = stablePoolAssets.findIndex((asset) => {
        const poolAssetKey = Object.keys(asset)[0]
        const poolAssetId = asset[poolAssetKey]
        return poolAssetKey.toLowerCase() == assetType.toLowerCase() && poolAssetId.toString().toLowerCase() == assetId.toString().toLowerCase()
        
    })
    return assetIndex;
}

function findObjectWithEntry(stablePools, targetAsset) {
    let assetType = Object.keys(targetAsset)[0];
    let assetId = targetAsset[assetType];
    let matchingStablePool = stablePools.find(([poolKey, poolData]) => {
        let poolAssets = poolData.toJSON()["assets"]
        let matchedPool = false;
        poolAssets.forEach((asset) => {
            const poolAssetKey = Object.keys(asset)[0]
            const poolAssetId = asset[poolAssetKey]
            if(poolAssetKey.toLowerCase() == assetType.toLowerCase() && poolAssetId.toString().toLowerCase() == assetId.toString().toLowerCase()){
                // console.log("FOUND MATCH")
                matchedPool = true;
            }
        })
        return matchedPool;
    })
    return matchingStablePool;

}
async function run(){
    process.exit(0)
}

// run()