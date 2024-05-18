import fs from 'fs'
import * as paraspell from '@paraspell/sdk'
import { TNode, getAssetsObject, getNode } from '@paraspell/sdk'
import path from 'path';
import { cryptoWaitReady } from "@polkadot/util-crypto"
import { MyAssetRegistryObject, ResultDataObject, IndexObject, SingleSwapResultData, SingleTransferResultData, ExtrinsicSetResultDynamic, LastNode, ArbExecutionResult, Relay, JsonPathNode, PathData } from './types.ts'
import { AssetNode } from './AssetNode.ts'
import { fileURLToPath } from 'url';
import { Keyring } from '@polkadot/api'
import {KeyringPair} from '@polkadot/keyring/types'
import { InstructionType, SwapInstruction, TransferInstruction } from './types.ts'
import { arb_wallet_kusama, dotTargetNode, ksmTargetNode, live_wallet_3 } from './txConsts.ts';
import { runAndReturnTargetArb } from './executeArbFallback.ts';

// import { buildTransferExtrinsic } from './extrinsicUtils.ts';
// Get the __dirname equivalent in ES module
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const aliceAddress = "HNZata7iMYWmk5RvZRTiAsSDhV8366zq2YGb3tLH5Upf74F"







// TRUNCATE execution path. Skips to the first swap
export async function getFirstSwapNodeFromAssetNodes(nodes: AssetNode[], chopsticks: boolean){ 
    let instructionIndex = 0;   
    let firstKsmNodeIndex = -1
    for(let i = 0; i < nodes.length; i++){
        if(nodes[i].pathType !== 0){
            firstKsmNodeIndex = i - 1
            break;
        }
    }
    if(firstKsmNodeIndex == -1){
        throw new Error("No swap instructions found")
    }
    let truncatedAssetNodes = nodes.slice(firstKsmNodeIndex)
    return truncatedAssetNodes
}



export function getNodeFromChainId(chainId: number, relay: Relay): TNode{
    // if(chainId == 0){
    //     return relay === 'kusama' ? 'Kusama' : 'Polkadot'
    // }
    let relaySymbol = relay === 'kusama' ? 'KSM' : 'DOT'
    let node = paraspell.NODE_NAMES.find((node) => {
        return paraspell.getParaId(node) == chainId && paraspell.getRelayChainSymbol(node) == relaySymbol
    })
    return node as TNode

}



export function getParaspellChainName(relay: Relay, chainId: number): TNode | "Kusama" | "Polkadot" {
    if(chainId == 0){
        return relay === 'kusama' ? 'Kusama' : 'Polkadot'
    }
    let relaySymbol = relay === 'kusama' ? 'KSM' : 'DOT'
    let chain = paraspell.NODE_NAMES.find((node) => {
      return paraspell.getParaId(node) == chainId && paraspell.getRelayChainSymbol(node) == relaySymbol  
    })
    return chain as TNode
}



export const getAssetBySymbolOrId = (
    node: TNode,
    inputAssetId: string,
    inputAssetSymbol: string,
    // symbolOrId: string | number
  ): { symbol?: string; assetId?: string } | null => {
    console.log("Node: ", node)
    console.log("Asset symbol: ", inputAssetSymbol)
    console.log("Asset ID: ", inputAssetId)

    const { otherAssets, nativeAssets, relayChainAssetSymbol } = getAssetsObject(node)
    // console.log("Getting asset symbol or ID: " + JSON.stringify(symbolOrId))
    let allAssets = [...otherAssets, ...nativeAssets];

    // Modified function to take both asset Id and symbol, which we can get from our assetRegistry
    // Search for asset but unique ID, but some paraspell assets dont have marked ID, so we can use symbol for that until we add all ID's to paraspell assets
    let paraspellAsset = allAssets.find(({symbol, assetId}) => {
        return assetId?.toLowerCase() == inputAssetId.toLowerCase()
    })

    if(!paraspellAsset){
        paraspellAsset = allAssets.find(({symbol, assetId}) => {
            return symbol?.toLowerCase() == inputAssetSymbol.toLowerCase()
        })
    }


    // const asset = [...otherAssets, ...nativeAssets].find(
    //   ({ symbol, assetId }) => {
    //     if(typeof symbolOrId === 'string'){ // Check ID first to avoid symbol conflicts
    //         return assetId?.toLowerCase() === symbolOrId.toLowerCase() || symbol?.toLowerCase() === symbolOrId.toLowerCase()
    //     }
    //     else{
    //         return symbol === symbolOrId.toString() || assetId === symbolOrId.toString()
    //     }
    // })
  
    if (paraspellAsset !== undefined) {
      const { symbol, assetId } = paraspellAsset
      return { symbol, assetId }
    }
    // For xc asset chains, account for the 'xc' prefix when sending to or receiving from
    // if(node == "Moonriver" || node == "Shiden" || node == "Astar"){
        
    //     const asset = [...otherAssets, ...nativeAssets].find(
    //         ({ symbol, assetId }) => {
    //           // console.log("Asset symobl or id " + JSON.stringify(symbolOrId) + " --- " + symbol + " --- " + assetId)
    //           if(typeof symbolOrId === 'string'){
    //             let prefixedSymbolOrId = "xc" + symbolOrId
    //             return symbol?.toLowerCase() === prefixedSymbolOrId.toLowerCase() || assetId?.toLowerCase() === prefixedSymbolOrId.toLowerCase()
    //           }
    //           else{
    //               return symbol === symbolOrId.toString() || assetId === symbolOrId.toString()
    //           }
    //       })
    // // Check if asset is coming from an xc chain, and remove the 'xc' prefix
    // } else if (node == 'Moonbeam') {
    //     // console.log("MOONBEAM REMOVE XC")
    //     const asset = [...otherAssets, ...nativeAssets].find(
    //         ({ symbol, assetId }) => {
    //           // console.log("Asset symobl or id " + JSON.stringify(symbolOrId) + " --- " + symbol + " --- " + assetId)
    //           if(typeof symbolOrId === 'string'){
    //             let noPrefixSymbolOrId = symbolOrId.toLowerCase().startsWith("xc") ? symbolOrId.slice(2) : symbolOrId
    //             // console.log("Asset symobl or id " + noPrefixSymbolOrId.toLowerCase() + " --- " + symbol.toLowerCase() + " --- " + assetId)
    //             return symbol?.toLowerCase() === noPrefixSymbolOrId.toLowerCase() || assetId?.toLowerCase() === noPrefixSymbolOrId.toLowerCase()
    //           }
    //           else{
    //               return symbol === symbolOrId.toString() || assetId === symbolOrId.toString()
    //           }
    //       })
    //     //   console.log("Asset: " + JSON.stringify(asset))
    //     return asset
    // } 
    
    // else {
    //     const asset = [...otherAssets, ...nativeAssets].find(
    //         ({ symbol, assetId }) => {
    //           // console.log("Asset symobl or id " + JSON.stringify(symbolOrId) + " --- " + symbol + " --- " + assetId)
    //           if(typeof symbolOrId === 'string'){
    //             let noPrefixSymbolOrId = symbolOrId.toLowerCase().startsWith("xc") ? symbolOrId.slice(2) : symbolOrId
    //             return symbol?.toLowerCase() === noPrefixSymbolOrId.toLowerCase() || assetId?.toLowerCase() === noPrefixSymbolOrId.toLowerCase()
    //           }
    //           else{
    //               return symbol === symbolOrId.toString() || assetId === symbolOrId.toString()
    //           }
    //       })
    // }
  
    if (relayChainAssetSymbol.toLowerCase() === inputAssetSymbol.toLowerCase()) return { symbol: relayChainAssetSymbol }
  
    return null
}

export function getAssetRegistryObject(chainId: number, localId: string, relay: Relay): MyAssetRegistryObject{
    // console.log("Getting asset registry object: " + chainId + " --- " + localId)
    let assetRegistry: MyAssetRegistryObject[] = relay === 'kusama' ? JSON.parse(fs.readFileSync(path.join(__dirname, '../../allAssets.json'), 'utf8')) : JSON.parse(fs.readFileSync(path.join(__dirname, '../../allAssetsPolkadot.json'), 'utf8'));
    // let assetRegistry: MyAssetRegistryObject[] = JSON.parse(fs.readFileSync(path.join(__dirname, '../../allAssets.json'), 'utf8'));
    let asset = assetRegistry.find((assetRegistryObject: MyAssetRegistryObject) => {
        if(chainId == 0 && assetRegistryObject.tokenData.chain == 0){
            return true
        }
        // console.log(JSON.stringify(assetRegistryObject.tokenData.localId).replace(/\\|"/g, ""))
        return assetRegistryObject.tokenData.chain == chainId && JSON.stringify(assetRegistryObject.tokenData.localId).replace(/\\|"/g, "") == localId
    })
    if(asset == undefined){
        throw new Error(`Asset not found in registry: chainId: ${chainId}, localId: ${localId} | localId stringify: ${JSON.stringify(localId)}`)
    }
    return asset
}
export function getAssetKeyFromChainAndSymbol(chainId: number, symbol: string, relay: Relay): string{
    let assetRegistryObject: MyAssetRegistryObject = getAssetRegistryObjectBySymbol(chainId, symbol, relay)
    return JSON.stringify(assetRegistryObject.tokenData.chain.toString() + JSON.stringify(assetRegistryObject.tokenData.localId))
}
export function getAssetRegistryObjectBySymbol(chainId: number, symbol: string, relay: Relay): MyAssetRegistryObject{
    let assetRegistryPath = relay === 'kusama' ? '../../allAssets.json' : '../../allAssetsPolkadot.json'
    let assetRegistry: MyAssetRegistryObject[] = JSON.parse(fs.readFileSync(path.join(__dirname, assetRegistryPath), 'utf8'));
    let asset = assetRegistry.find((assetRegistryObject: MyAssetRegistryObject) => {
        return assetRegistryObject.tokenData.chain == chainId && JSON.stringify(assetRegistryObject.tokenData.symbol).toLowerCase() == JSON.stringify(symbol).toLowerCase()
    })
    if(asset){
        return asset
    }

    if(symbol.toUpperCase() == "XCKSM" && chainId == 2023){
        asset = assetRegistry.find((assetRegistryObject: MyAssetRegistryObject) => {
            return assetRegistryObject.tokenData.chain == chainId && assetRegistryObject.tokenData.symbol.toUpperCase() == "XCKSM"
        })
    }
    if(asset) return asset

    // Try again but account for xc
    if(symbol.toLowerCase().startsWith("xc")){
        let symbolNoPrefix = symbol.slice(2)
        asset = assetRegistry.find((assetRegistryObject: MyAssetRegistryObject) => {
            return assetRegistryObject.tokenData.chain == chainId && assetRegistryObject.tokenData.symbol.toLowerCase() == symbolNoPrefix.toLowerCase()
        })
    } else {
        let symbolYesPrefix = "xc" + symbol
        asset = assetRegistry.find((assetRegistryObject: MyAssetRegistryObject) => {
            return assetRegistryObject.tokenData.chain == chainId && assetRegistryObject.tokenData.symbol.toLowerCase() == symbolYesPrefix.toLowerCase()
        })
    }

    if(asset == undefined){
        throw new Error(`Asset not found in registry: chainId: ${chainId}, symbol: ${symbol}`)
    }
    return asset
}

// Reads a json object from the arbitrage result log and returns the corresponding paraspell asset and amount
export function readLogData(jsonObject: JsonPathNode | ResultDataObject, relay: Relay ){
    console.log("Reading log data: " + JSON.stringify(jsonObject))
    let chainId;
    let assetLocalId;
    let nodeKey = jsonObject.node_key.replace(/\\|"/g, "");
    if(nodeKey.startsWith("0")){
        chainId = "0"
        assetLocalId = relay == 'kusama' ? "KSM" : "DOT"
    } else {
        chainId = nodeKey.slice(0,4)
        assetLocalId = nodeKey.slice(4)
    }

    let assetRegistryObject = getAssetRegistryObject(parseInt(chainId), assetLocalId, relay)
    let assetSymbol = assetRegistryObject.tokenData.symbol
    let assetId = JSON.stringify(assetRegistryObject.tokenData.localId).replace(/\\|"/g, "")

    let paraspellChainName = getParaspellChainName(relay, parseInt(chainId))
    let path_data = jsonObject.path_data as any
    let pathDataFormatted: PathData = {
        dexType: path_data.path_type,
        lpId: path_data.lp_id
    }

    if(paraspellChainName == "Kusama" || paraspellChainName == "Polkadot"){
        let assetNode = new AssetNode({
            paraspellAsset: {symbol: assetSymbol},
            paraspellChain: paraspellChainName,
            assetRegistryObject: assetRegistryObject,
            pathValue: jsonObject.path_value,
            pathType: jsonObject.path_identifier,
            pathData: pathDataFormatted
        });
        return assetNode
    } else {

        
        let paraspellAsset = getAssetBySymbolOrId(paraspellChainName, assetId, assetSymbol)

        if(paraspellChainName == undefined){
            throw new Error("Paraspell chain name not found for chain id " + chainId)
        }
        if(paraspellAsset == null){
            paraspellAsset = getAssetBySymbolOrId(paraspellChainName, assetId, assetLocalId) // Should probably search by local ID first instead of symbol
            if (paraspellAsset == null){
                throw new Error("Paraspell asset not found for chain " + paraspellChainName + " and asset id " + assetLocalId)
            }
        }
        
        let assetNode = new AssetNode({
            paraspellAsset: paraspellAsset,
            paraspellChain: paraspellChainName,
            assetRegistryObject: assetRegistryObject,
            pathValue: jsonObject.path_value,
            pathType: jsonObject.path_identifier,
            pathData: pathDataFormatted
        });
        // console.log(JSON.stringify(assetNode))
        return assetNode
    }
    
}

export function findValueByKey(obj: any, targetKey: any): any {
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




export function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


export async function getSigner(chopsticks: boolean, eth: boolean): Promise<KeyringPair>{
    let keyring;
    let key;

    
    if(chopsticks){ 
        // Get test accounts
        if(eth){ // CHOPSTICKS EVM WALLET, ONLY FOR TRANSFERS
            const index = 0;
            let ethDerPath = `m/44'/60'/0'/0/${index}`;
            keyring = new Keyring({ type: 'ethereum' });
            return keyring.addFromUri(`${live_wallet_3}/${ethDerPath}`);
        } else { // CHOPSTICKS SUBSTRATE WALLET
            await cryptoWaitReady()
            keyring = new Keyring({
                type: "sr25519",
            });
            return keyring.addFromUri("//Alice");
        }
    } else {
        // Get live accounts
        if(eth){ // LIVE EVM WALLET
            const index = 0;
            let ethDerPath = `m/44'/60'/0'/0/${index}`;
            keyring = new Keyring({ type: 'ethereum' });
            return keyring.addFromUri(`${live_wallet_3}/${ethDerPath}`);
        } else { // LIVE SUBSTRATE WALLET
            await cryptoWaitReady()
            keyring = new Keyring({ type: 'sr25519' });
            return keyring.addFromMnemonic(arb_wallet_kusama)
        }


    }

    
    
}

export function increaseIndex(index: IndexObject) {
    index.i += 1;
}

export function printInstruction(instruction: SwapInstruction | TransferInstruction){
    if(instruction.type == InstructionType.Swap){
        // console.log("Swap Instruction: " + JSON.stringify(instruction))
        console.log(`${instruction.instructionIndex} SWAP chain: ${instruction.chain} ${instruction.assetNodes[0].paraspellChain} ${JSON.stringify(instruction.assetInLocalId)} -> ${JSON.stringify(instruction.assetOutLocalId)}`)
    } else if(instruction.type == InstructionType.TransferToHomeThenDestination){
        // console.log("Transfer instruction")
        const nodes = instruction.assetNodes
        console.log(`${instruction.instructionIndex} TRANSFER ${instruction.startAssetNode.getAssetRegistrySymbol()} --- ${instruction.startNode} -> ${instruction.middleNode} -> ${instruction.destinationNode}`)
    } else {
        console.log(`${instruction.instructionIndex} TRANSFER ${instruction.startAssetNode.getAssetRegistrySymbol()} --- ${instruction.startNode} -> ${instruction.destinationNode}`)
    }
}

export function printExtrinsicSetResults(extrinsicSetResults: (SingleSwapResultData | SingleTransferResultData) []){
    extrinsicSetResults.forEach((resultData) => {
        console.log(resultData.success)
        console.log(JSON.stringify(resultData.arbExecutionResult, null, 2))
    })
}

export async function getLastSuccessfulNodeFromResultData(allExtrinsicResultData: (SingleSwapResultData | SingleTransferResultData) []){
    let lastSuccessfulResultData = allExtrinsicResultData[allExtrinsicResultData.length - 1]
    if(!lastSuccessfulResultData.success){
        if(allExtrinsicResultData.length > 1){
            lastSuccessfulResultData = allExtrinsicResultData[allExtrinsicResultData.length - 2]
            if(!lastSuccessfulResultData.success){
                console.log("No successful extrinsics")
            }
        } else {
            console.log("No successful extrinsics")
        }
    }
    return lastSuccessfulResultData.lastNode
}
export async function getLastNodeFromResultData(allExtrinsicResultData: (SingleSwapResultData | SingleTransferResultData) []){
    let lastSuccessfulResultData = allExtrinsicResultData[allExtrinsicResultData.length - 1]
    // if(!lastSuccessfulResultData.success){
    //     console.log("No successful extrinsics")
    // }
    return lastSuccessfulResultData.lastNode
}
export async function getLastSuccessfulNodeFromAllExtrinsics(allExtrinsicResultData: ExtrinsicSetResultDynamic []){
    let resultData: (SingleSwapResultData | SingleTransferResultData) [] = [];
    allExtrinsicResultData.forEach((extrinsicSetResult) => {
        extrinsicSetResult.extrinsicData.forEach((extrinsicData) => {
            resultData.push(extrinsicData)
        })
    })
    let lastSuccessfulResultData = resultData[resultData.length - 1]
    if(!lastSuccessfulResultData.success){
        if(resultData.length > 1){
            lastSuccessfulResultData = resultData[resultData.length - 2]
            if(!lastSuccessfulResultData.success){
                console.log("No successful extrinsics")
            }
        } else {
            console.log("No successful extrinsics")
        }
    }

    return lastSuccessfulResultData.lastNode
}
export function getLatestFileFromLatestDay(small: boolean) {
    
    const resultsDirPath = path.join(__dirname, '/../../../test2/arb-dot-2/arb_handler/result_log_data');
    try {
        let sortedDays
        let latestDayDir;
        let latestDayPath
        let days;
        if(small){
        // Get list of directories (days)
            days = fs.readdirSync(resultsDirPath, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name)
                .filter((day) => day.includes("_small"))
            sortedDays = days.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
            latestDayDir = sortedDays[sortedDays.length - 1]
            latestDayPath = path.join(resultsDirPath, latestDayDir);
        } else {
            days = fs.readdirSync(resultsDirPath, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name)
                .filter((day) => !day.includes("_small"))
            sortedDays = days.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
            // Get the latest day's directory
            console.log("Sorted days: ", JSON.stringify(days, null, 2))
    
            latestDayDir = sortedDays[0]
            latestDayPath = path.join(resultsDirPath, latestDayDir);
        }

        console.log("Days: ", JSON.stringify(days, null, 2))
        // Sort directories by date
        // const sortedDays = days.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
        // // Get the latest day's directory
        // console.log("Sorted days: ", JSON.stringify(days, null, 2))

        // const latestDayDir = sortedDays[sortedDays.length - 1]
        // const latestDayPath = path.join(resultsDirPath, latestDayDir);
        console.log("Latest Day Path: ", latestDayPath)
        // Get list of files in the latest day's directory
        const files = fs.readdirSync(latestDayPath);

        // Sort files by timestamp in filename
        const sortedFiles = files.sort((a, b) => {
            const timeA = a.match(/\d{2}-\d{2}-\d{2}/)[0].replace(/-/g, ':');
            const timeB = b.match(/\d{2}-\d{2}-\d{2}/)[0].replace(/-/g, ':');
            return new Date(`${latestDayDir}T${timeA}`).getTime() - new Date(`${latestDayDir}T${timeB}`).getTime();
        });

        // Get the latest file
        const latestFile = sortedFiles[sortedFiles.length - 1];
        const latestFilePath = path.join(latestDayPath, latestFile);

        return latestFilePath;
    } catch (error) {
        console.error('Error:', error);
        return null;
    }
}

export function getLatestAsyncFilesPolkadot(): [number, string][]{
    const resultsDirPath = path.join(__dirname, '/../../../test2/arb-dot-2/arb_handler/default_log_data/polkadot');
    let inputAmounts = [0.5, 2, 5]

    let logFilePaths: [number, string][] = inputAmounts.map((inputAmount) => {
        // let inputDir = path.join(resultsDirPath, inputAmount.toString())
        try{
            let sortedDays
            let latestDayDir;
            let latestDayPath
            let days;
    
            days = fs.readdirSync(resultsDirPath, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name)
                .filter((day) => !day.includes("_small"))
            sortedDays = days.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
            // Get the latest day's directory
            console.log("Sorted days: ", JSON.stringify(sortedDays, null, 2))
    
            latestDayDir = sortedDays[0]
            latestDayPath = path.join(resultsDirPath, latestDayDir);
            let inputDir = path.join(latestDayPath, inputAmount.toString())
    
            console.log("Days: ", JSON.stringify(days, null, 2))
            // Sort directories by date
            console.log("Latest Target Day Path: ", latestDayPath)
            // Get list of files in the latest day's directory
            console.log("Input Dir: ", inputDir)
            const files = fs.readdirSync(inputDir);
    
            // Sort files by timestamp in filename
            const sortedFiles = files.sort((a, b) => {
                const timeA = a.match(/\d{2}-\d{2}-\d{2}/)[0].replace(/-/g, ':');
                const timeB = b.match(/\d{2}-\d{2}-\d{2}/)[0].replace(/-/g, ':');
                return new Date(`${latestDayDir}T${timeA}`).getTime() - new Date(`${latestDayDir}T${timeB}`).getTime();
            });
    
            // Get the latest file
            const latestFile = sortedFiles[sortedFiles.length - 1];
            const latestFilePath = path.join(inputDir, latestFile);
            console.log("Latest file path: ", latestFilePath)
            return [inputAmount, latestFilePath];

        } catch (error) {
            console.error('Error:', error);
            return null;
        }

    })

    return logFilePaths

}

export function getLatestAsyncFilesKusama(): [number, string][]{
    const resultsDirPath = path.join(__dirname, '/../../../test2/arb-dot-2/arb_handler/default_log_data/kusama/');
    let inputAmounts = [0.1, 0.5, 1]

    let logFilePaths: [number, string][] = inputAmounts.map((inputAmount) => {
        // let inputDir = path.join(resultsDirPath, inputAmount.toString())
        try{
            let sortedDays
            let latestDayDir;
            let latestDayPath
            let days;
    
            days = fs.readdirSync(resultsDirPath, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name)
                .filter((day) => !day.includes("_small"))
            sortedDays = days.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
            // Get the latest day's directory
            console.log("Sorted days: ", JSON.stringify(sortedDays, null, 2))
    
            latestDayDir = sortedDays[0]
            latestDayPath = path.join(resultsDirPath, latestDayDir);
            let inputDir = path.join(latestDayPath, inputAmount.toString())
    
            console.log("Days: ", JSON.stringify(days, null, 2))
            // Sort directories by date
            console.log("Latest Target Day Path: ", latestDayPath)
            // Get list of files in the latest day's directory
            console.log("Input Dir: ", inputDir)
            const files = fs.readdirSync(inputDir);
    
            // Sort files by timestamp in filename
            const sortedFiles = files.sort((a, b) => {
                const timeA = a.match(/\d{2}-\d{2}-\d{2}/)[0].replace(/-/g, ':');
                const timeB = b.match(/\d{2}-\d{2}-\d{2}/)[0].replace(/-/g, ':');
                return new Date(`${latestDayDir}T${timeA}`).getTime() - new Date(`${latestDayDir}T${timeB}`).getTime();
            });
    
            // Get the latest file
            const latestFile = sortedFiles[sortedFiles.length - 1];
            const latestFilePath = path.join(inputDir, latestFile);
            console.log("Latest file path: ", latestFilePath)
            return [inputAmount, latestFilePath];

        } catch (error) {
            console.error('Error:', error);
            return null;
        }

    })

    return logFilePaths
    // try {
    //     let sortedDays
    //     let latestDayDir;
    //     let latestDayPath
    //     let days;

    //     days = fs.readdirSync(resultsDirPath, { withFileTypes: true })
    //         .filter(dirent => dirent.isDirectory())
    //         .map(dirent => dirent.name)
    //         .filter((day) => !day.includes("_small"))
    //     sortedDays = days.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    //     // Get the latest day's directory
    //     console.log("Sorted days: ", JSON.stringify(days, null, 2))

    //     latestDayDir = sortedDays[0]
    //     latestDayPath = path.join(resultsDirPath, latestDayDir);

    //     console.log("Days: ", JSON.stringify(days, null, 2))
    //     // Sort directories by date
    //     console.log("Latest Target Day Path: ", latestDayPath)
    //     // Get list of files in the latest day's directory
    //     const files = fs.readdirSync(latestDayPath);

    //     // Sort files by timestamp in filename
    //     const sortedFiles = files.sort((a, b) => {
    //         const timeA = a.match(/\d{2}-\d{2}-\d{2}/)[0].replace(/-/g, ':');
    //         const timeB = b.match(/\d{2}-\d{2}-\d{2}/)[0].replace(/-/g, ':');
    //         return new Date(`${latestDayDir}T${timeA}`).getTime() - new Date(`${latestDayDir}T${timeB}`).getTime();
    //     });

    //     // Get the latest file
    //     const latestFile = sortedFiles[sortedFiles.length - 1];
    //     const latestFilePath = path.join(latestDayPath, latestFile);

    //     return latestFilePath;
    // } catch (error) {
    //     console.error('Error:', error);
    //     return null;
    // }
}

export function getLatestTargetFileKusama(){
      
    const resultsDirPath = path.join(__dirname, '/../../../test2/arb-dot-2/arb_handler/target_log_data/kusama/');
    try {
        let sortedDays
        let latestDayDir;
        let latestDayPath
        let days;

        days = fs.readdirSync(resultsDirPath, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name)
            .filter((day) => !day.includes("_small"))
        sortedDays = days.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
        // Get the latest day's directory
        console.log("Sorted days: ", JSON.stringify(days, null, 2))

        latestDayDir = sortedDays[0]
        latestDayPath = path.join(resultsDirPath, latestDayDir);

        console.log("Days: ", JSON.stringify(days, null, 2))
        // Sort directories by date
        console.log("Latest Target Day Path: ", latestDayPath)
        // Get list of files in the latest day's directory
        const files = fs.readdirSync(latestDayPath);

        // Sort files by timestamp in filename
        const sortedFiles = files.sort((a, b) => {
            const timeA = a.match(/\d{2}-\d{2}-\d{2}/)[0].replace(/-/g, ':');
            const timeB = b.match(/\d{2}-\d{2}-\d{2}/)[0].replace(/-/g, ':');
            return new Date(`${latestDayDir}T${timeA}`).getTime() - new Date(`${latestDayDir}T${timeB}`).getTime();
        });

        // Get the latest file
        const latestFile = sortedFiles[sortedFiles.length - 1];
        const latestFilePath = path.join(latestDayPath, latestFile);

        return latestFilePath;
    } catch (error) {
        console.error('Error:', error);
        return null;
    }
}

export function getLatestTargetFilePolkadot(){
      
    const resultsDirPath = path.join(__dirname, '/../../../test2/arb-dot-2/arb_handler/target_log_data/polkadot/');
    try {
        let sortedDays
        let latestDayDir;
        let latestDayPath
        let days;

        days = fs.readdirSync(resultsDirPath, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name)
            .filter((day) => !day.includes("_small"))
        sortedDays = days.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
        // Get the latest day's directory
        console.log("Sorted days: ", JSON.stringify(days, null, 2))

        latestDayDir = sortedDays[0]
        latestDayPath = path.join(resultsDirPath, latestDayDir);

        console.log("Days: ", JSON.stringify(days, null, 2))
        // Sort directories by date
        console.log("Latest Target Day Path: ", latestDayPath)
        // Get list of files in the latest day's directory
        const files = fs.readdirSync(latestDayPath);

        // Sort files by timestamp in filename
        const sortedFiles = files.sort((a, b) => {
            const timeA = a.match(/\d{2}-\d{2}-\d{2}/)[0].replace(/-/g, ':');
            const timeB = b.match(/\d{2}-\d{2}-\d{2}/)[0].replace(/-/g, ':');
            return new Date(`${latestDayDir}T${timeA}`).getTime() - new Date(`${latestDayDir}T${timeB}`).getTime();
        });

        // Get the latest file
        const latestFile = sortedFiles[sortedFiles.length - 1];
        const latestFilePath = path.join(latestDayPath, latestFile);

        return latestFilePath;
    } catch (error) {
        console.error('Error:', error);
        return null;
    }
}

export function getLatestDefaultFile(relay: Relay){

}


export function constructRouteFromFile(relay: Relay, logFilePath: string) {
    console.log("LatestFile: ", logFilePath)
    const testResults: ResultDataObject[] = JSON.parse(fs.readFileSync(logFilePath, 'utf8'));
    console.log(JSON.stringify(testResults))
    let assetPath: AssetNode[] = testResults.map(result => readLogData(result, relay))
    return assetPath
}
export function constructRouteFromJson(relay: Relay, jsonPathNodes: JsonPathNode[]) {
    // console.log("LatestFile: ", logFilePath)
    // const testResults: ResultDataObject[] = JSON.parse(fs.readFileSync(logFilePath, 'utf8'));
    // console.log(JSON.stringify(testResults))
    let assetPath: AssetNode[] = jsonPathNodes.map(node => readLogData(node, relay))
    return assetPath
}

// How much profit we got for latest arb
export async function getTotalArbResultAmount(relay: Relay, lastSuccessfulNode: LastNode){
    console.log("Getting total arb amount result")
    let latestFilePath = path.join(__dirname, `./logResults/latestAttempt/${relay}/arbExecutionResults.json`)
    let latestArbResults: ArbExecutionResult[] = JSON.parse(fs.readFileSync(latestFilePath, 'utf8'))
    let assetOut = latestArbResults[latestArbResults.length - 1].assetSymbolOut
    let arbAmountOut = 0;
    let arbAmountIn = latestArbResults[0].assetAmountIn;
    // if(assetOut == "KSM"){
    //     arbAmountOut = latestArbResults[latestArbResults.length - 1].assetAmountOut - arbAmountIn
    // }
    console.log("Last Node: ", JSON.stringify(lastSuccessfulNode))
    let lastNodeAssetSymbol = lastSuccessfulNode.assetSymbol
    console.log("Last Node Asset Symbol: ", lastNodeAssetSymbol)
    console.log("Asset out from result set: ", assetOut)
    if(relay == 'kusama' && lastSuccessfulNode.assetSymbol == "KSM" || lastSuccessfulNode.assetSymbol.toUpperCase() == "XCKSM"){
        arbAmountOut = Number.parseFloat(lastSuccessfulNode.assetValue) - arbAmountIn
    }
    if(relay == 'polkadot' && lastSuccessfulNode.assetSymbol == "DOT" || lastSuccessfulNode.assetSymbol.toUpperCase() == "XCDOT"){
        arbAmountOut = Number.parseFloat(lastSuccessfulNode.assetValue) - arbAmountIn
    }
    // getLastSuccessfulNodeFromResultData
    console.log("Amount Out: ", arbAmountOut)
    return arbAmountOut
}

export function printAllocations(instructionSets: (SwapInstruction | TransferInstruction)[][]){
    console.log("*********************ALLOCATION INSTRUCTIONS***********************")
    instructionSets.forEach((set) => {
        set.forEach((instruction) => {
            printInstruction(instruction)
        })
    })
    console.log("*********************************************************************")
}

export function printInstructionSet(instructionSet: (SwapInstruction | TransferInstruction)[]){
    console.log("*********************INSTRUCTION SET***********************")
    instructionSet.forEach((instruction) => {
        printInstruction(instruction)
    })
    console.log("*********************************************************************")
}

export function getAssetRegistry(relay: Relay){
    let assetRegistry: MyAssetRegistryObject[] = relay === 'kusama' ? JSON.parse(fs.readFileSync(path.join(__dirname, '../../allAssets.json'), 'utf8')) : JSON.parse(fs.readFileSync(path.join(__dirname, '../../allAssetsPolkadot.json'), 'utf8'));
    return assetRegistry
}

export async function getArbExecutionPath(relay: Relay, latestFile: string, inputAmount: number, useLatestTarget: boolean, chopsticks: boolean){
    let arbPathData: ResultDataObject[] | JsonPathNode[] = []
    
    // If useLatestTarget is false, will update LPs and run arb
    if(!useLatestTarget){
        try{
            let arbArgs = relay === 'kusama' ? `${ksmTargetNode} ${ksmTargetNode} ${inputAmount}` : `${dotTargetNode} ${dotTargetNode} ${inputAmount}`
            arbPathData = await runAndReturnTargetArb(arbArgs, chopsticks, relay)
        }  catch {
            console.log("Failed to run target arb")
            throw new Error("Failed to run target arb")
        }
    } else {
        arbPathData = JSON.parse(fs.readFileSync(latestFile, 'utf8'))
    }

    return arbPathData
}