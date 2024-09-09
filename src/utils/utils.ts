import * as paraspell from "@paraspell/sdk";
import { TNode, getAssetsObject } from "@paraspell/sdk";
import { Keyring } from "@polkadot/api";
import { KeyringPair } from "@polkadot/keyring/types";
import { cryptoWaitReady } from "@polkadot/util-crypto";
import bn from "bignumber.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { AssetNode } from "../core/AssetNode.ts";
import {
    arb_wallet_kusama,
    dotNodeKeys,
    dotTargetNode,
    ksmTargetNode,
    kusamaNodeKeys,
    kusamaRelayMinimum,
    live_wallet_3,
    polkadotRelayMinimum,
} from "../config/txConsts.ts";
import {
    ArbExecutionResult,
    AsyncFileData,
    ExtrinsicSetResultDynamic,
    IndexObject,
    InstructionType,
    ArbFinderNode,
    LastNode,
    IMyAsset,
    PathData,
    PathType,
    Relay,
    SingleSwapResultData,
    SingleTransferResultData,
    SwapInstruction,
    SwapTxStats,
    TransferInstruction,
    TransferTxStats,
    TxDetails,
    PNode,
    ExtrinsicContainer,
    SwapExtrinsicContainer,
    TransferExtrinsicContainer,
    ExtrinsicObject,
    TransferProperties,
    SwapProperties,
    PromiseTracker,
    RelayTokenSymbol,
    AssetMap,
} from "./../types/types.ts";
import { GlobalState, MyAsset } from "../core/index.ts";
import { arbFinderPath, kusamaAssetRegistryPath, polkadotAssetRegistryPath } from "../config/index.ts";
import { stateGetExtrinsicSetResults, stateGetLastNode, stateSetLastFile } from "./index.ts";

// import { buildTransferExtrinsic } from './extrinsicUtils.ts';
// Get the __dirname equivalent in ES module
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const aliceAddress = "HNZata7iMYWmk5RvZRTiAsSDhV8366zq2YGb3tLH5Upf74F";

// Create two AssetMaps, one for each relay
const kusamaAssetMap: AssetMap = createAssetMap('kusama');
const polkadotAssetMap: AssetMap = createAssetMap('polkadot');

// After reading log data, truncate the asset node path to the first swap node. To avoid unnecessary transfers
/**
 * Truncate AssetNode[] path to skip past transfers up to first swap
 * - Find's first node with a swap path type, and slices the node array from there
 * 
 * @param nodes 
 * @param chopsticks 
 * @returns AssetNode[]
 */
export function truncateAssetPath(nodes: AssetNode[]): AssetNode[]{
    console.log(`Truncating asset node path`)
    for (let i = 1; i < nodes.length; i++) {
        console.log(`Asset node: ${nodes[i].chain} ${nodes[i].getAssetKey()} ${nodes[i].pathValue} ${nodes[i].pathType} ${nodes[i].pathData.dexType}`)
        if (
            nodes[i].pathData.dexType != "Start" &&
            nodes[i].pathData.dexType != "Xcm"
        ) {
            return nodes.slice(i - 1)
        }
    }
    throw new Error("Truncating asset path | Could not find AssetNode with swap dex type.")
}

export function getNodeFromChainId(chainId: number, relay: Relay): PNode {
    if (chainId == 0) {
        return relay === "kusama" ? "Kusama" : "Polkadot";
    }
    let relaySymbol = relay === "kusama" ? "KSM" : "DOT";
    let node = paraspell.NODE_NAMES.find((node) => {
        return (
            paraspell.getParaId(node) == chainId &&
            paraspell.getRelayChainSymbol(node) == relaySymbol
        );
    });
    return node as TNode;
}

export function getNode(relay: Relay, chainId: number): PNode {
    if (chainId == 0) {
        return relay === "kusama" ? "Kusama" : "Polkadot";
    }
    let relaySymbol = relay === "kusama" ? "KSM" : "DOT";
    let chain = paraspell.NODE_NAMES.find((node) => {
        return (
            paraspell.getParaId(node) == chainId &&
            paraspell.getRelayChainSymbol(node) == relaySymbol
        );
    });
    return chain as TNode;
}

export function getMyAssetById(
    chainId: number,
    localId: string,
    relay: Relay
): IMyAsset {
    let assetRegistry = getAssetMapAssets(relay);
    let asset = assetRegistry.find((assetRegistryObject: IMyAsset) => {
        if (chainId == 0 && assetRegistryObject.tokenData.chain == 0) {
            return true;
        }
        // console.log(JSON.stringify(assetRegistryObject.tokenData.localId).replace(/\\|"/g, ""))
        return (
            assetRegistryObject.tokenData.chain == chainId &&
            JSON.stringify(assetRegistryObject.tokenData.localId).replace(
                /\\|"/g,
                ""
            ) == localId
        );
    });
    if (asset == undefined) {
        throw new Error(
            `Asset not found in registry: chainId: ${chainId}, localId: ${localId} | localId stringify: ${JSON.stringify(
                localId
            )}`
        );
    }
    return asset;
}
export function getAssetKey(assetObject: IMyAsset): string {
    return JSON.stringify(
        assetObject.tokenData.chain.toString() +
            JSON.stringify(assetObject.tokenData.localId)
    );
}
export function getAssetKeyFromChainAndSymbol(
    chainId: number,
    symbol: string,
    relay: Relay
): string {
    return new MyAsset(getMyAssetBySymbol(chainId, symbol, relay)).getAssetKey()

}
export function getMyAssetBySymbol(
    chainId: number,
    symbol: string,
    relay: Relay
): IMyAsset {
    let assetRegistry = getAssetMapAssets(relay);
    let asset = assetRegistry.find((assetRegistryObject: IMyAsset) => {
        return (
            assetRegistryObject.tokenData.chain == chainId &&
            JSON.stringify(
                assetRegistryObject.tokenData.symbol
            ).toLowerCase() == JSON.stringify(symbol).toLowerCase()
        );
    });

    if (asset) return asset;

    // REVIEW Make this more efficient, just add or remove xc for evm chains
    // Try again but account for xc
    if (symbol.toLowerCase().startsWith("xc")) {
        // Try removing prefix
        let symbolNoPrefix = symbol.slice(2);
        asset = assetRegistry.find((assetRegistryObject: IMyAsset) => {
            return (
                assetRegistryObject.tokenData.chain == chainId &&
                assetRegistryObject.tokenData.symbol.toLowerCase() ==
                    symbolNoPrefix.toLowerCase()
            );
        });
    } else {
        // Try adding prefix
        let symbolYesPrefix = "xc" + symbol;
        asset = assetRegistry.find((assetRegistryObject: IMyAsset) => {
            return (
                assetRegistryObject.tokenData.chain == chainId &&
                assetRegistryObject.tokenData.symbol.toLowerCase() ==
                    symbolYesPrefix.toLowerCase()
            );
        });
    }

    if (asset == undefined) {
        throw new Error(
            `Asset not found in registry: chainId: ${chainId}, symbol: ${symbol}`
        );
    }
    return asset;
}

/**
 * Parses asset key into chain id and local id
 *
 * @param assetKey - Unique asset key (chain ID + local ID)
 * @returns [chainId, localId] as [number, string]
 */
export function parsePathNodeKey(assetKey: string): [number, string] {
    let chainId: number, localId: string;
    let cleanedNodeKey = assetKey.replace(/\\|"/g, "");

    // If chain startsWith '0' then that is relay chain
    if (cleanedNodeKey.startsWith("0")) {
        chainId = 0;
        localId = cleanedNodeKey.slice(1);
    } else {
        chainId = parseInt(cleanedNodeKey.slice(0, 4));
        localId = cleanedNodeKey.slice(4);
    }
    return [chainId, localId];
}

/**
 * Get asset key (chain+localId) to an arbitrary target node, set in txConsts.ts. Target node is currently set to the relay asset on Acala/Karura
 * - The chain of the target node does not matter
 * - Arb finder will get all assets that have the same location as thee target node, and will treat them all as targets
 * - 
 * 
 * @param relay 
 * @returns 
 */
export function getTargetNode(relay: Relay){
    return relay === 'polkadot' ? dotTargetNode : ksmTargetNode
}

/**
 * 
 * Get's the asset key of dot/ksm on every chain
 * 
 * @param relay 
 * @returns 
 */
export function getAllNodes(relay: Relay): string[]{
    return relay === 'polkadot' ? dotNodeKeys : kusamaNodeKeys
}

export function parseJsonNodePathData(jsonObject: ArbFinderNode): PathData {
    let data = jsonObject.path_data as any;
    let pathDataFormatted: PathData = {
        dexType: data.path_type,
        lpId: data.lp_id,
        xcmTransferFeeAmounts: data.xcm_transfer_fee_amounts,
        xcmTransferReserveAmounts: data.xcm_transfer_reserve_amounts,
        xcmDepositFeeAmounts: data.xcm_deposit_fee_amounts,
        xcmDepositReserveAmounts: data.xcm_deposit_reserve_amounts,
    };
    return pathDataFormatted;
}

/**
 * Checks if chain is EVM, because they are handled differently
 * - Don't run swaps on evm when testing 
 * - evm chains have different signers
 * - etc
 * 
 * @param chain 
 * @returns boolean
 */
export function isEvmChain(chain: PNode){
    // Add more if necessary
    if (
        chain === 'Astar' ||
        chain === 'Shiden' ||
        chain === 'Moonbeam' ||
        chain === 'Moonriver'
    ) {
        return true
    }
}

// Reads a json object from the arbitrage result log and returns the corresponding paraspell asset and amount
/**
 * Constructs AssetNodes from arb-finder's path data
 * - Formats path data and retreives all relevant asset info (as MyAsset) for each path node
 * 
 * @param arbPathNode 
 * @param relay 
 * @returns 
 */
export function readLogData(
    arbPathNode: ArbFinderNode,
    relay: Relay
) {
    let [chainId, assetLocalId] = parsePathNodeKey(arbPathNode.node_key);

    let asset: MyAsset = new MyAsset(
        getMyAssetById(chainId, assetLocalId, relay)
    );
    let chain = getNode(relay, chainId);
    let pathDataFormatted = parseJsonNodePathData(arbPathNode);

    let pathType: PathType = arbPathNode.path_type as PathType;

    let assetNode = new AssetNode({
        chain: chain,
        asset: asset,
        pathValue: arbPathNode.path_value.toString(),
        pathType: pathType,
        pathData: pathDataFormatted,
    });
    return assetNode;
}

export function findValueByKey(obj: any, targetKey: any): any {
    if (typeof obj !== "object" || obj === null) {
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
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getSigner(
    chopsticks: boolean,
    chain: PNode
): Promise<KeyringPair> {
    let eth = isEvmChain(chain);
    let keyring;
    let key;

    if (chopsticks) {
        // Get test accounts
        if (eth) {
            // CHOPSTICKS EVM WALLET, ONLY FOR TRANSFERS
            const index = 0;
            let ethDerPath = `m/44'/60'/0'/0/${index}`;
            keyring = new Keyring({ type: "ethereum" });
            return keyring.addFromUri(`${live_wallet_3}/${ethDerPath}`);
        } else {
            // CHOPSTICKS SUBSTRATE WALLET
            await cryptoWaitReady();
            keyring = new Keyring({ type: "sr25519" });
            return keyring.addFromUri("//Alice");
        }
    } else {
        // Get live accounts
        if (eth) {
            // LIVE EVM WALLET
            const index = 0;
            let ethDerPath = `m/44'/60'/0'/0/${index}`;
            keyring = new Keyring({ type: "ethereum" });
            return keyring.addFromUri(`${live_wallet_3}/${ethDerPath}`);
        } else {
            // LIVE SUBSTRATE WALLET
            await cryptoWaitReady();
            keyring = new Keyring({ type: "sr25519" });
            return keyring.addFromMnemonic(arb_wallet_kusama);
        }
    }
}

export async function getKeyring(
    chopsticks: boolean,
    eth: boolean
): Promise<KeyringPair> {
    let keyring;
    let key;

    if (chopsticks) {
        // Get test accounts
        if (eth) {
            // CHOPSTICKS EVM WALLET, ONLY FOR TRANSFERS
            const index = 0;
            let ethDerPath = `m/44'/60'/0'/0/${index}`;
            keyring = new Keyring({ type: "ethereum" });
            return keyring.addFromUri(`${live_wallet_3}/${ethDerPath}`);
        } else {
            // CHOPSTICKS SUBSTRATE WALLET
            await cryptoWaitReady();
            keyring = new Keyring({
                type: "sr25519",
            });
            return keyring.addFromUri("//Alice");
        }
    } else {
        // Get live accounts
        if (eth) {
            // LIVE EVM WALLET
            const index = 0;
            let ethDerPath = `m/44'/60'/0'/0/${index}`;
            keyring = new Keyring({ type: "ethereum" });
            return keyring.addFromUri(`${live_wallet_3}/${ethDerPath}`);
        } else {
            // LIVE SUBSTRATE WALLET
            await cryptoWaitReady();
            keyring = new Keyring({ type: "sr25519" });
            return keyring.addFromMnemonic(arb_wallet_kusama);
        }
    }
}

export function printInstruction(
    instruction: SwapInstruction | TransferInstruction
) {
    if (instruction.type == InstructionType.Swap) {
        // console.log("Swap Instruction: " + JSON.stringify(instruction))
        console.log(
            `SWAP chain: ${instruction.chain} ${
                instruction.assetNodes[0].chain
            } ${JSON.stringify(instruction.assetInLocalId)} -> ${JSON.stringify(
                instruction.assetOutLocalId
            )}`
        );
    } else if (
        instruction.type == InstructionType.TransferToHomeThenDestination
    ) {
        // console.log("Transfer instruction")
        const nodes = instruction.assetNodes;
        console.log(
            `TRANSFER ${instruction.startAsset.getAssetSymbol()} --- ${
                instruction.startAsset.getAssetKey()
            } -> ${instruction.middleAsset.getAssetKey()} -> ${instruction.destinationAsset.getAssetKey()}`
        );
    } else {
        console.log(
            `TRANSFER ${instruction.startAsset.getAssetSymbol()} --- ${
                instruction.startAsset.getAssetKey()
            } -> ${instruction.destinationAsset.getAssetKey()}`
        );
    }
}

export function printExtrinsicSetResults(
    extrinsicSetResults: (SingleSwapResultData | SingleTransferResultData)[]
) {
    extrinsicSetResults.forEach((resultData) => {
        console.log(resultData.success);
        console.log(JSON.stringify(resultData.arbExecutionResult, null, 2));
    });
}

export function getLatestAsyncFilesPolkadot(): [number, string][] {
    const resultsDirPath = path.join(
        __dirname,
        `${arbFinderPath}/default_log_data/polkadot/`    
        );
    let inputAmounts = [0.5, 2, 5];

    let logFilePaths: [number, string][] = inputAmounts.map((inputAmount) => {
        // let inputDir = path.join(resultsDirPath, inputAmount.toString())
        try {
            let sortedDays;
            let latestDayDir;
            let latestDayPath;
            let days;

            days = fs
                .readdirSync(resultsDirPath, { withFileTypes: true })
                .filter((dirent) => dirent.isDirectory())
                .map((dirent) => dirent.name)
                .filter((day) => !day.includes("_small"));
            sortedDays = days.sort(
                (a, b) => new Date(b).getTime() - new Date(a).getTime()
            );
            // Get the latest day's directory
            console.log("Sorted days: ", JSON.stringify(sortedDays, null, 2));

            latestDayDir = sortedDays[0];
            latestDayPath = path.join(resultsDirPath, latestDayDir);
            let inputDir = path.join(latestDayPath, inputAmount.toString());

            console.log("Days: ", JSON.stringify(days, null, 2));
            // Sort directories by date
            console.log("Latest Target Day Path: ", latestDayPath);
            // Get list of files in the latest day's directory
            console.log("Input Dir: ", inputDir);
            const files = fs.readdirSync(inputDir);

            // Sort files by timestamp in filename
            const sortedFiles = files.sort((a, b) => {
                const timeA = a
                    .match(/\d{2}-\d{2}-\d{2}/)![0]
                    .replace(/-/g, ":");
                const timeB = b
                    .match(/\d{2}-\d{2}-\d{2}/)![0]
                    .replace(/-/g, ":");
                return (
                    new Date(`${latestDayDir}T${timeA}`).getTime() -
                    new Date(`${latestDayDir}T${timeB}`).getTime()
                );
            });

            // Get the latest file
            const latestFile = sortedFiles[sortedFiles.length - 1];
            const latestFilePath = path.join(inputDir, latestFile);
            console.log("Latest file path: ", latestFilePath);
            return [inputAmount, latestFilePath];
        } catch (error) {
            console.error("Error:", error);
            throw new Error("Cant parse latest files");
        }
    });

    return logFilePaths;
}

export function getLatestAsyncFilesKusama(): [number, string][] {
    const resultsDirPath = path.join(
        __dirname,
        `${arbFinderPath}/default_log_data/kusama/`
    );
    let inputAmounts = [0.1, 0.5, 1];

    let logFilePaths: [number, string][] = inputAmounts.map((inputAmount) => {
        // let inputDir = path.join(resultsDirPath, inputAmount.toString())
        try {
            let sortedDays;
            let latestDayDir;
            let latestDayPath;
            let days;

            days = fs
                .readdirSync(resultsDirPath, { withFileTypes: true })
                .filter((dirent) => dirent.isDirectory())
                .map((dirent) => dirent.name)
                .filter((day) => !day.includes("_small"));
            sortedDays = days.sort(
                (a, b) => new Date(b).getTime() - new Date(a).getTime()
            );
            // Get the latest day's directory
            console.log("Sorted days: ", JSON.stringify(sortedDays, null, 2));

            latestDayDir = sortedDays[0];
            latestDayPath = path.join(resultsDirPath, latestDayDir);
            let inputDir = path.join(latestDayPath, inputAmount.toString());

            console.log("Days: ", JSON.stringify(days, null, 2));
            // Sort directories by date
            console.log("Latest Target Day Path: ", latestDayPath);
            // Get list of files in the latest day's directory
            console.log("Input Dir: ", inputDir);
            const files = fs.readdirSync(inputDir);

            // Sort files by timestamp in filename
            const sortedFiles = files.sort((a, b) => {
                const timeA = a
                    .match(/\d{2}-\d{2}-\d{2}/)![0]
                    .replace(/-/g, ":");
                const timeB = b
                    .match(/\d{2}-\d{2}-\d{2}/)![0]
                    .replace(/-/g, ":");
                return (
                    new Date(`${latestDayDir}T${timeA}`).getTime() -
                    new Date(`${latestDayDir}T${timeB}`).getTime()
                );
            });

            // Get the latest file
            const latestFile = sortedFiles[sortedFiles.length - 1];
            const latestFilePath = path.join(inputDir, latestFile);
            console.log("Latest file path: ", latestFilePath);
            return [inputAmount, latestFilePath];
        } catch (error) {
            console.error("Error:", error);
            throw new Error("Cant parse latest files");
        }
    });

    return logFilePaths;
}

/**
 * Finds filepath to most recent arb-finder result from target arb
 * - Executes at the start of a new run
 * - Sets GlobalState lastFilePath 
 * 
 * Parses and returns arb data as ArbFinderNode[]
 * 
 * @param relay 
 * @returns ArbFinderNode[] - arb path
 */
export function getLastTargetArb(relay: Relay): ArbFinderNode[]{
    const resultsDirPath = path.join(
        __dirname,
        `${arbFinderPath}/target_log_data/${relay}/`
    );

    let latestFilePath: string
    try {
        let sortedDays;
        let latestDayDir;
        let latestDayPath;
        let days;

        days = fs
            .readdirSync(resultsDirPath, { withFileTypes: true })
            .filter((dirent) => dirent.isDirectory())
            .map((dirent) => dirent.name)
            .filter((day) => !day.includes("_small"));
        sortedDays = days.sort(
            (a, b) => new Date(b).getTime() - new Date(a).getTime()
        );

        // Get the latest day's directory
        latestDayDir = sortedDays[0];
        latestDayPath = path.join(resultsDirPath, latestDayDir);

        // Sort directories by date
        // Get list of files in the latest day's directory
        const files = fs.readdirSync(latestDayPath);

        // Sort files by timestamp in filename
        const sortedFiles = files.sort((a, b) => {
            const timeA = a.match(/\d{2}-\d{2}-\d{2}/)![0].replace(/-/g, ":");
            const timeB = b.match(/\d{2}-\d{2}-\d{2}/)![0].replace(/-/g, ":");
            return (
                new Date(`${latestDayDir}T${timeA}`).getTime() -
                new Date(`${latestDayDir}T${timeB}`).getTime()
            );
        });

        // Get the latest file
        const latestFile = sortedFiles[sortedFiles.length - 1];
        latestFilePath = path.join(latestDayPath, latestFile);

        // return latestFilePath;
    } catch (error) {
        console.error("Error:", error);
        throw new Error("Latest File undefined")
    }

    stateSetLastFile(latestFilePath)

    return JSON.parse(fs.readFileSync(latestFilePath, 'utf8'))
}

export function constructRouteFromFile(relay: Relay, logFilePath: string) {
    console.log("LatestFile: ", logFilePath);
    const testResults: ArbFinderNode[] = JSON.parse(
        fs.readFileSync(logFilePath, "utf8")
    );
    console.log(JSON.stringify(testResults));
    let assetPath: AssetNode[] = testResults.map((result) =>
        readLogData(result, relay)
    );
    return assetPath;
}
export function constructAssetNodesFromPath(
    relay: Relay,
    arbPath: ArbFinderNode[]
) {
    let assetNodePath: AssetNode[] = arbPath.map((node) =>
        readLogData(node, relay)
    );
    return assetNodePath;
}

// 
/**
 * Calculate profit
 * - Get extrinsic set results
 * - Take input from first extrinsic and output of the last extrinsic
 * 
 * Confirm last node is target node
 * 
 * Returns profit amount formatted into display notation
 */
export async function getTotalArbResultAmount(
    relay: Relay,
    chopsticks: boolean
): Promise<string> {
    console.log("Getting total arb amount result");
    GlobalState.getInstance('polkadot')

    let results: Readonly<ExtrinsicSetResultDynamic> = stateGetExtrinsicSetResults()!;
    let firstExtrinsic: SingleSwapResultData | SingleTransferResultData = results.allExtrinsicResults[0]
    let lastExtrinsic: SingleSwapResultData | SingleTransferResultData = results.allExtrinsicResults[results.allExtrinsicResults.length - 1]

    let originalInputValue: bn;

    if(isSwapResult(firstExtrinsic)){
        originalInputValue = new bn(firstExtrinsic.swapTxStats.assetInBalanceChange.changeInBalance)

    } else if(isTransferResult(firstExtrinsic)){
        originalInputValue = new bn(firstExtrinsic.transferTxStats.startBalanceStats.changeInBalance)
    } else {
        throw new Error('')
    }
    console.log(originalInputValue)

    let finalOutputValue: bn

    if(isSwapResult(lastExtrinsic)){
        finalOutputValue = new bn(lastExtrinsic.swapTxStats.assetOutBalanceChange.changeInBalance)

    } else if(isTransferResult(lastExtrinsic)){
        finalOutputValue = new bn(lastExtrinsic.transferTxStats.destBalanceStats.changeInBalance)
    }else {
        throw new Error('')
    }

    let totalProfit = finalOutputValue.minus(originalInputValue)

    let testAsset = new MyAsset(getMyAssetBySymbol(2000, 'DOT', 'polkadot'))
    let assetLocation = testAsset.getLocation();

    let xcmAssets = getAssetsAtLocation(assetLocation, 'polkadot')

    let lastNode = stateGetLastNode()
    let lastNodeAsset = new MyAsset(getMyAssetBySymbol(lastNode?.chainId!, lastNode?.assetSymbol!, 'polkadot'))

    let foundAsset = xcmAssets.find((xcmAsset) => {
        return new MyAsset(xcmAsset).getAssetKey() == lastNodeAsset.getAssetKey()
    })

    if (foundAsset !== undefined){
        console.log(`Final node is a target node. Success`)
        return totalProfit.div(new bn(10).pow(lastNodeAsset.getDecimals())).toString()
    } else {
        console.log(`Final node is NOT a target. Fail`)
        return "0"
    }


}

export function printAllocations(
    instructionSets: (SwapInstruction | TransferInstruction)[][]
) {
    console.log(
        "*********************ALLOCATION INSTRUCTIONS***********************"
    );
    instructionSets.forEach((set) => {
        set.forEach((instruction) => {
            printInstruction(instruction);
        });
    });
    console.log(
        "*********************************************************************"
    );
}

export function printInstructionSet(
    instructionSet: (SwapInstruction | TransferInstruction)[]
) {
    console.log("*********************INSTRUCTION SET***********************");
    instructionSet.forEach((instruction) => {
        printInstruction(instruction);
    });
    console.log(
        "*********************************************************************"
    );
}

export function getAssetRegistry(relay: Relay) {
    const assetRegistryPath =
        relay === "kusama"
            ? kusamaAssetRegistryPath
            : polkadotAssetRegistryPath;
    const assetRegistry: IMyAsset[] = JSON.parse(
        fs.readFileSync(assetRegistryPath, "utf8")
    );
    return assetRegistry;
}

/** 
 * Asset map is the new registry.
 * 
 * Called at the beginning, at modular level, to create one asset map we can use repeatedly
 * - Reads asset registry JSON data into IMyAsset[]
 * - Enters each asset into the map with assetKey
 */
export function createAssetMap(relay: Relay): AssetMap {
    const assetRegistryPath = relay === "kusama" ? kusamaAssetRegistryPath : polkadotAssetRegistryPath;
    const assetArray: IMyAsset[] = JSON.parse(fs.readFileSync(assetRegistryPath, "utf8"));
    return new Map(assetArray.map(asset => [new MyAsset(asset).getAssetKey(), asset]));
}
/**
 * Get list of values from asset map
 * 
 * Returns all assets MyAsset[]
 * 
 * @param relay 
 * @returns all assets as MyAsset[]
 */
export function getAssetMapAssets(relay: Relay): IMyAsset[] {
    return Array.from((relay === 'kusama' ? kusamaAssetMap : polkadotAssetMap).values());
}

/**
 * Get current instance of asset map
 * 
 * @param relay 
 * @returns AssetMap
 */
export function getAssetRegistryMap(relay: Relay): AssetMap {
    return relay === 'kusama' ? kusamaAssetMap : polkadotAssetMap;
}

/**
 * Lookup asset in AssetMap by assetKey. Throw if asset not found
 * 
 * @param assetKey 
 * @param relay 
 * @returns 
 */
export function assetMapLookupByKey(assetKey: string, relay: Relay): IMyAsset{
    return (relay === 'kusama' ? kusamaAssetMap : polkadotAssetMap).get(assetKey) 
        ?? (() => { throw new Error(`Asset not found for key: ${assetKey} in ${relay} network`); })();
}

export function getChainIdFromNode(node: PNode) {
    if (node == "Polkadot" || node == "Kusama") {
        return 0;
    } else {
        let chainId = paraspell.getParaId(node);
        return chainId;
    }
}

export function deepEqual(obj1: any, obj2: any) {
    if (obj1 === obj2) {
        return true;
    }
    if (
        typeof obj1 !== "object" ||
        typeof obj2 !== "object" ||
        obj1 == null ||
        obj2 == null
    ) {
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

export function getAssetDecimalsFromLocation(location: any, relay: Relay) {
    let assetRegistry: IMyAsset[] = getAssetMapAssets(relay);

    let firstAssetWithLocation: IMyAsset = assetRegistry.find(
        (assetObject) =>
            JSON.stringify(assetObject.tokenLocation) ==
            JSON.stringify(location)
    )!;
    return firstAssetWithLocation.tokenData.decimals;
}

/**
 * Get all assets with the specified location
 * 
 * Could rework this to create a map with location as key, if we needed to lookup and compare asset locations more often
 * 
 * @param assetLocationObject 
 * @param relay 
 * @returns 
 */
export function getAssetsAtLocation(
    assetLocationObject: any,
    relay: Relay
): IMyAsset[] {
    let assetRegistry: IMyAsset[] = getAssetMapAssets(relay);
    let assetsAtLocation: IMyAsset[] = assetRegistry
        .map((assetObject) => {
            if (
                JSON.stringify(assetObject.tokenLocation) ===
                JSON.stringify(assetLocationObject)
            ) {
                return assetObject;
            }
        })
        .filter(
            (assetObject): assetObject is IMyAsset => assetObject !== undefined
        );

    return assetsAtLocation;
}

/**
 * Get formatted address string to match against chain deposit events
 * 
 * @param signer 
 * @param key 
 * @param chain 
 * @param ss58Format 
 * @returns 
 */
export function getWalletAddressFormatted(
    signer: KeyringPair,
    key: Keyring,
    chain: PNode,
    ss58Format: any
) {
    if (chain == "Moonbeam" || chain == "Moonriver") {
        return signer.address.toString();
    } else {
        return key.encodeAddress(signer.address, ss58Format.toNumber());
    }
}

export async function getLatestDefaultArb(
    relay: Relay
): Promise<AsyncFileData> {
    let latestFile =
        relay === "kusama"
            ? await getLatestAsyncFilesKusama()
            : await getLatestAsyncFilesPolkadot();

    let small, medium, big, smallMinimum, mediumMinimum, bigMinimum;
    if (relay === "kusama") {
        small = 0.1;
        smallMinimum = 0.005;
        medium = 0.5;
        mediumMinimum = 0.01;
        big = 1;
        bigMinimum = 0.05;
    } else {
        small = 0.5;
        smallMinimum = 1;
        medium = 2;
        mediumMinimum = 1;
        big = 5;
        bigMinimum = 1;
    }

    let estimatedResults = latestFile.map(async ([inputAmount, filePath]) => {
        let latestFileData: ArbFinderNode[] = JSON.parse(
            fs.readFileSync(filePath, "utf8")
        );

        let estimatedOutput =
            latestFileData[latestFileData.length - 1].path_value - inputAmount;
        console.log(
            `Estimated output for input amount ${inputAmount}: ${estimatedOutput}`
        );
        let asyncFileData: AsyncFileData = {
            inputAmount: inputAmount,
            estimatedOutput: estimatedOutput,
            latestFileData: latestFileData,
        };
        return asyncFileData;
    });

    let results = await Promise.all(estimatedResults);

    let mediumResult = results.find((asyncFileData) => {
        return asyncFileData.inputAmount == medium;
    });
    let smallResult = results.find((asyncFileData) => {
        return asyncFileData.inputAmount == small;
    });

    if (!smallResult || !mediumResult) {
        throw new Error("Cant find result for small or medium");
    }

    if (
        smallResult.estimatedOutput > mediumResult.estimatedOutput &&
        smallResult.estimatedOutput > mediumMinimum
    ) {
        console.log(
            "returning smale result. estimated output: ",
            smallResult.estimatedOutput
        );
        return smallResult;
    }
    if (mediumResult.estimatedOutput > mediumMinimum) {
        console.log(
            "Returning medium result. Estimated output: ",
            mediumResult.estimatedOutput
        );
        return mediumResult;
    }
    if (smallResult.estimatedOutput > smallMinimum) {
        console.log(
            "Returning small result. Estimated output: ",
            smallResult.estimatedOutput
        );
        return smallResult;
    }
    throw new Error("No suitable result found");
}

/**
 * Take an asset amount in short hand, and convert it to it's actual amount with the number of decimal places. Return as a BigNumber
 *
 *
 * @param inputAmount
 * @param decimals
 */
export function toFullAssetAmount(
    inputAmount: string | number,
    decimals: string | number
): bn {
    return new bn(inputAmount).times(new bn(10).pow(new bn(decimals)));
}

export function trackPromise(promise: Promise<any>): PromiseTracker {
    let isResolved = false;

    // Create a new promise that resolves the same way the original does
    // and updates the `isResolved` flag
    const trackedPromise = promise.then(
        (result) => {
            isResolved = true;
            return result; // Pass through the result
        },
        (error) => {
            isResolved = true;
            throw error; // Rethrow the error to be caught later
        }
    );
    let promiseTracker: PromiseTracker = {
        trackedPromise: trackedPromise,
        isResolved: () => isResolved
    }

    // Return both the new promise and a function to check if it's resolved
    // return { trackedPromise, isResolved: () => isResolved };
    return promiseTracker;
}

export function getRelayTokenSymbol(relay: Relay): RelayTokenSymbol {
    return relay === 'polkadot' ? "DOT" : "KSM"
}

export function getRelayMinimum(relay: Relay): number{
    return relay === 'polkadot' ? polkadotRelayMinimum : kusamaRelayMinimum
}

//TODO maybe make own file
// Type guard function
export function isTxDetails(error: unknown): error is TxDetails {
    return typeof error === "object" && error !== null && "success" in error;
}

export function isSwapResult(
    result: any
): result is {
    swapTxStats: SwapTxStats;
    swapTxResults: any;
    arbExecutionResult: ArbExecutionResult;
} {
    return "swapTxStats" in result;
}

export function isTransferResult(
    result: any
): result is {
    transferTxStats: TransferTxStats;
    arbExecutionResult: ArbExecutionResult;
} {
    return "transferTxStats" in result;
}

// Type guard for Extrinsic Container without using type property in ExtrinsicObject
export function isTransferExtrinsicContainer(
    container: ExtrinsicContainer
): container is TransferExtrinsicContainer {
    return container.type === "Transfer";
}

export function isSwapExtrinsicContainer(
    container: ExtrinsicContainer
): container is SwapExtrinsicContainer {
    return container.type === "Swap";
}

export function isSwapProperties(properties: SwapProperties | TransferProperties): properties is SwapProperties{
    return properties.type === "Swap"
}
export function isTransferProperties(properties: SwapProperties | TransferProperties): properties is TransferProperties{
    return properties.type === "Transfer"
}

export function isTransferInstruction(instruction: TransferInstruction | SwapInstruction): instruction is TransferInstruction{
    return instruction.type !== InstructionType.Swap
}
export function isSwapInstruction(instruction: TransferInstruction | SwapInstruction): instruction is SwapInstruction{
    return instruction.type === InstructionType.Swap
}
// export function isTransferResults(resultData: SingleTransferResultData | SingleSwapResultData): resultData is SingleTransferResultData {

// }
// export function isSwapResults(resultData: SingleTransferResultData | SingleSwapResultData): resultData is SingleTransferResultData {
    
// }