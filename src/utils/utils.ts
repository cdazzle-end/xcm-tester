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
import { runAndReturnTargetArb } from "../arbFinder/runArbFinder.ts";
import {
    arb_wallet_kusama,
    dotTargetNode,
    ksmTargetNode,
    live_wallet_3,
} from "../config/txConsts.ts";
import {
    ArbExecutionResult,
    AsyncFileData,
    ExtrinsicSetResultDynamic,
    IndexObject,
    InstructionType,
    JsonPathNode,
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
} from "./../types/types.ts";
import { MyAsset } from "../core/index.ts";

// import { buildTransferExtrinsic } from './extrinsicUtils.ts';
// Get the __dirname equivalent in ES module
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const aliceAddress = "HNZata7iMYWmk5RvZRTiAsSDhV8366zq2YGb3tLH5Upf74F";

// After reading log data, truncate the asset node path to the first swap node. To avoid unnecessary transfers
export async function truncateAssetPath(
    nodes: AssetNode[],
    chopsticks: boolean
) {
    let firstKsmNodeIndex = -1;

    // The first node (index 0) will not be a swap, the json node path_identifier is 0 (logically incorrect, 0 is for xcm path traversal but this is the first node with node previous path)
    // and PathData.path_type will be "Start"
    // Since first node is always start node, then first swap node will always be at index 1 or greater
    for (let i = 0; i < nodes.length; i++) {
        // console.log("Node path data: ", JSON.stringify(nodes[i].pathData))
        if (
            nodes[i].pathData.dexType != "Start" &&
            nodes[i].pathData.dexType != "Xcm"
        ) {
            firstKsmNodeIndex = i - 1;
            break;
        }
    }
    if (firstKsmNodeIndex == -1) {
        throw new Error("No swap instructions found");
    }

    // If the first asset node with a swap type is at index 2 (the third node), that means the first swap is from the second node (index 1) to the third (index 2).
    // Therefore we remove all nodes up to index 1, just the first node(index 0)
    // Thats why when we find the first swap node we substract one from the index and remove all nodes up tho that index.
    let truncatedAssetNodes = nodes.slice(firstKsmNodeIndex);
    return truncatedAssetNodes;
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

export const getAssetBySymbolOrId = (
    node: TNode,
    inputAssetId: string,
    inputAssetSymbol: string
    // symbolOrId: string | number
): { symbol?: string; assetId?: string } | null => {
    const { otherAssets, nativeAssets, relayChainAssetSymbol } =
        getAssetsObject(node);
    let allAssets = [...otherAssets, ...nativeAssets];

    // Modified function to take both asset Id and symbol, which we can get from our assetRegistry
    // Search for asset but unique ID, but some paraspell assets dont have marked ID, so we can use symbol for that until we add all ID's to paraspell assets
    let paraspellAsset = allAssets.find(({ symbol, assetId }) => {
        return assetId?.toLowerCase() == inputAssetId.toLowerCase();
    });

    if (!paraspellAsset) {
        paraspellAsset = allAssets.find(({ symbol, assetId }) => {
            return symbol?.toLowerCase() == inputAssetSymbol.toLowerCase();
        });
    }

    if (paraspellAsset !== undefined) {
        const { symbol, assetId } = paraspellAsset;
        return { symbol, assetId };
    }

    if (relayChainAssetSymbol.toLowerCase() === inputAssetSymbol.toLowerCase())
        return { symbol: relayChainAssetSymbol };

    return null;
};

export function getAssetRegistryObject(
    chainId: number,
    localId: string,
    relay: Relay
): IMyAsset {
    let assetRegistry = getAssetRegistry(relay);
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
    let assetRegistryObject: IMyAsset = getAssetRegistryObjectBySymbol(
        chainId,
        symbol,
        relay
    );
    return JSON.stringify(
        assetRegistryObject.tokenData.chain.toString() +
            JSON.stringify(assetRegistryObject.tokenData.localId)
    );
}
export function getAssetRegistryObjectBySymbol(
    chainId: number,
    symbol: string,
    relay: Relay
): IMyAsset {
    let assetRegistry = getAssetRegistry(relay);
    let asset = assetRegistry.find((assetRegistryObject: IMyAsset) => {
        return (
            assetRegistryObject.tokenData.chain == chainId &&
            JSON.stringify(
                assetRegistryObject.tokenData.symbol
            ).toLowerCase() == JSON.stringify(symbol).toLowerCase()
        );
    });
    if (asset) {
        return asset;
    }

    if (symbol.toUpperCase() == "XCKSM" && chainId == 2023) {
        asset = assetRegistry.find((assetRegistryObject: IMyAsset) => {
            return (
                assetRegistryObject.tokenData.chain == chainId &&
                assetRegistryObject.tokenData.symbol.toUpperCase() == "XCKSM"
            );
        });
    }
    if (asset) return asset;

    // Try again but account for xc
    if (symbol.toLowerCase().startsWith("xc")) {
        let symbolNoPrefix = symbol.slice(2);
        asset = assetRegistry.find((assetRegistryObject: IMyAsset) => {
            return (
                assetRegistryObject.tokenData.chain == chainId &&
                assetRegistryObject.tokenData.symbol.toLowerCase() ==
                    symbolNoPrefix.toLowerCase()
            );
        });
    } else {
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

export function parseJsonNodePathData(jsonObject: JsonPathNode): PathData {
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

// Reads a json object from the arbitrage result log and returns the corresponding paraspell asset and amount
export function readLogData(
    jsonObject: JsonPathNode | JsonPathNode,
    relay: Relay
) {
    let [chainId, assetLocalId] = parsePathNodeKey(jsonObject.node_key);

    let asset: MyAsset = new MyAsset(
        getAssetRegistryObject(chainId, assetLocalId, relay)
    );
    let chain = getNode(relay, chainId);
    let pathDataFormatted = parseJsonNodePathData(jsonObject);

    let pathType: PathType = jsonObject.path_type as PathType;

    let assetNode = new AssetNode({
        chain: chain,
        asset: asset,
        pathValue: jsonObject.path_value.toString(),
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

export function increaseIndex(index: IndexObject) {
    index.i += 1;
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
                instruction.startAsset
            } -> ${instruction.middleAsset} -> ${instruction.destinationAsset}`
        );
    } else {
        console.log(
            `TRANSFER ${instruction.startAsset.getAssetSymbol()} --- ${
                instruction.startAsset
            } -> ${instruction.destinationAsset}`
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

export async function getLastSuccessfulNodeFromResultData(
    allExtrinsicResultData: (SingleSwapResultData | SingleTransferResultData)[]
) {
    let lastSuccessfulResultData =
        allExtrinsicResultData[allExtrinsicResultData.length - 1];
    if (!lastSuccessfulResultData.success) {
        if (allExtrinsicResultData.length > 1) {
            lastSuccessfulResultData =
                allExtrinsicResultData[allExtrinsicResultData.length - 2];
            if (!lastSuccessfulResultData.success) {
                console.log("No successful extrinsics");
            }
        } else {
            console.log("No successful extrinsics");
        }
    }
    return lastSuccessfulResultData.lastNode;
}
export async function getLastNodeFromResultData(
    allExtrinsicResultData: (SingleSwapResultData | SingleTransferResultData)[]
) {
    let lastSuccessfulResultData =
        allExtrinsicResultData[allExtrinsicResultData.length - 1];
    // if(!lastSuccessfulResultData.success){
    //     console.log("No successful extrinsics")
    // }
    return lastSuccessfulResultData.lastNode;
}
export async function getLastSuccessfulNodeFromAllExtrinsics(
    allExtrinsicResultData: ExtrinsicSetResultDynamic[]
) {
    let resultData: (SingleSwapResultData | SingleTransferResultData)[] = [];
    allExtrinsicResultData.forEach((extrinsicSetResult) => {
        extrinsicSetResult.allExtrinsicResults.forEach((extrinsicData) => {
            resultData.push(extrinsicData);
        });
    });
    let lastSuccessfulResultData = resultData[resultData.length - 1];
    if (!lastSuccessfulResultData.success) {
        if (resultData.length > 1) {
            lastSuccessfulResultData = resultData[resultData.length - 2];
            if (!lastSuccessfulResultData.success) {
                console.log("No successful extrinsics");
            }
        } else {
            console.log("No successful extrinsics");
        }
    }

    return lastSuccessfulResultData.lastNode;
}
export function getLatestFileFromLatestDay(small: boolean) {
    const resultsDirPath = path.join(
        __dirname,
        "/../../../test2/arb-dot-2/arb_handler/result_log_data"
    );
    try {
        let sortedDays;
        let latestDayDir;
        let latestDayPath;
        let days;
        if (small) {
            // Get list of directories (days)
            days = fs
                .readdirSync(resultsDirPath, { withFileTypes: true })
                .filter((dirent) => dirent.isDirectory())
                .map((dirent) => dirent.name)
                .filter((day) => day.includes("_small"));
            sortedDays = days.sort(
                (a, b) => new Date(b).getTime() - new Date(a).getTime()
            );
            latestDayDir = sortedDays[sortedDays.length - 1];
            latestDayPath = path.join(resultsDirPath, latestDayDir);
        } else {
            days = fs
                .readdirSync(resultsDirPath, { withFileTypes: true })
                .filter((dirent) => dirent.isDirectory())
                .map((dirent) => dirent.name)
                .filter((day) => !day.includes("_small"));
            sortedDays = days.sort(
                (a, b) => new Date(b).getTime() - new Date(a).getTime()
            );
            // Get the latest day's directory
            console.log("Sorted days: ", JSON.stringify(days, null, 2));

            latestDayDir = sortedDays[0];
            latestDayPath = path.join(resultsDirPath, latestDayDir);
        }

        console.log("Days: ", JSON.stringify(days, null, 2));
        // Sort directories by date
        // const sortedDays = days.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
        // // Get the latest day's directory
        // console.log("Sorted days: ", JSON.stringify(days, null, 2))

        // const latestDayDir = sortedDays[sortedDays.length - 1]
        // const latestDayPath = path.join(resultsDirPath, latestDayDir);
        console.log("Latest Day Path: ", latestDayPath);
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
        const latestFilePath = path.join(latestDayPath, latestFile);

        return latestFilePath;
    } catch (error) {
        console.error("Error:", error);
        return null;
    }
}

export function getLatestAsyncFilesPolkadot(): [number, string][] {
    const resultsDirPath = path.join(
        __dirname,
        "/../../../test2/arb-dot-2/arb_handler/default_log_data/polkadot"
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
        "/../../../test2/arb-dot-2/arb_handler/default_log_data/kusama/"
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

export function getLatestTargetFileKusama() {
    const resultsDirPath = path.join(
        __dirname,
        "/../../../test2/arb-dot-2/arb_handler/target_log_data/kusama/"
    );
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
        const latestFilePath = path.join(latestDayPath, latestFile);

        return latestFilePath;
    } catch (error) {
        console.error("Error:", error);
        return null;
    }
}

export function getLatestTargetFilePolkadot() {
    const resultsDirPath = path.join(
        __dirname,
        "/../../../test2/arb-dot-2/arb_handler/target_log_data/polkadot/"
    );
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
        const latestFilePath = path.join(latestDayPath, latestFile);

        return latestFilePath;
    } catch (error) {
        console.error("Error:", error);
        return null;
    }
}

export function getLatestDefaultFile(relay: Relay) {}

export function constructRouteFromFile(relay: Relay, logFilePath: string) {
    console.log("LatestFile: ", logFilePath);
    const testResults: JsonPathNode[] = JSON.parse(
        fs.readFileSync(logFilePath, "utf8")
    );
    console.log(JSON.stringify(testResults));
    let assetPath: AssetNode[] = testResults.map((result) =>
        readLogData(result, relay)
    );
    return assetPath;
}
export function constructRouteFromJson(
    relay: Relay,
    jsonPathNodes: JsonPathNode[]
) {
    let assetPath: AssetNode[] = jsonPathNodes.map((node) =>
        readLogData(node, relay)
    );
    return assetPath;
}

// How much profit we got for latest arb
export async function getTotalArbResultAmount(
    relay: Relay,
    lastSuccessfulNode: LastNode,
    chopsticks: boolean
): Promise<string> {
    console.log("Getting total arb amount result");
    let latestFilePath;
    if (chopsticks) {
        latestFilePath = path.join(
            __dirname,
            `./logResults/chopsticks/latestAttempt/${relay}/arbExecutionResults.json`
        );
    } else {
        latestFilePath = path.join(
            __dirname,
            `./logResults/latestAttempt/${relay}/arbExecutionResults.json`
        );
    }

    let latestArbResults: ArbExecutionResult[] = JSON.parse(
        fs.readFileSync(latestFilePath, "utf8")
    );
    console.log("Latest arb execution results");
    console.log(JSON.stringify(latestArbResults, null, 2));
    let assetOut = latestArbResults[latestArbResults.length - 1].assetSymbolOut;
    let arbAmountProfit = new bn(0);
    let arbAmountIn = new bn(latestArbResults[0].assetAmountIn);
    let arbAmountOut = new bn(lastSuccessfulNode.assetValue);
    // if(assetOut == "KSM"){
    //     arbAmountOut = latestArbResults[latestArbResults.length - 1].assetAmountOut - arbAmountIn
    // }
    console.log("Last Node: ", JSON.stringify(lastSuccessfulNode));
    let lastNodeAssetSymbol = lastSuccessfulNode.assetSymbol;
    console.log("Last Node Asset Symbol: ", lastNodeAssetSymbol);
    console.log("Asset out from result set: ", assetOut);
    console.log("Amount in: ", arbAmountIn);
    if (
        (relay == "kusama" && lastSuccessfulNode.assetSymbol == "KSM") ||
        lastSuccessfulNode.assetSymbol.toUpperCase() == "XCKSM"
    ) {
        console.log("Amount out: ", arbAmountOut);
        arbAmountProfit = arbAmountOut.minus(arbAmountIn);
    }
    if (
        (relay == "polkadot" && lastSuccessfulNode.assetSymbol == "DOT") ||
        lastSuccessfulNode.assetSymbol.toUpperCase() == "XCDOT"
    ) {
        console.log("Amount out: ", arbAmountOut);
        arbAmountProfit = arbAmountOut.minus(arbAmountIn);
    }
    // getLastSuccessfulNodeFromResultData
    console.log("Amount Profit: ", arbAmountProfit);
    return arbAmountProfit.toFixed();
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
            ? "../../../polkadot_assets/assets/asset_registry/allAssetsKusamaCollected.json"
            : "../../../polkadot_assets/assets/asset_registry/allAssetsPolkadotCollected.json";
    // const assetRegistryPath = relay === 'kusama' ? '../../allAssets.json' : '../../../polkadot_assets/assets/asset_registry/allAssetsPolkadotCollected.json'
    const assetRegistry: IMyAsset[] = JSON.parse(
        fs.readFileSync(path.join(__dirname, assetRegistryPath), "utf8")
    );
    return assetRegistry;
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
    // console.log("***** DEEP EQUAL *****")
    // console.log("obj1: " + JSON.stringify(obj1))
    // console.log("obj2: " + JSON.stringify(obj2))
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
    let assetRegistry: IMyAsset[] = getAssetRegistry(relay);
    // let assetsAtLocation: MyAssetRegistryObject[] = []
    // let assetsAtLocation: MyAssetRegistryObject = assetRegistry.find((assetObject) => {
    //     if(JSON.stringify(assetObject.tokenLocation) == JSON.stringify(location)){
    //         return assetObject
    //     }
    // })
    let firstAssetWithLocation: IMyAsset = assetRegistry.find(
        (assetObject) =>
            JSON.stringify(assetObject.tokenLocation) ==
            JSON.stringify(location)
    )!;
    return firstAssetWithLocation.tokenData.decimals;
}

export function getAssetsAtLocation(
    assetLocationObject: any,
    relay: Relay
): IMyAsset[] {
    let assetRegistry: IMyAsset[] = getAssetRegistry(relay);
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
        let latestFileData: JsonPathNode[] = JSON.parse(
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