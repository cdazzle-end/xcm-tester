import { exec } from "child_process";
import { spawn } from "child_process";
import { readdir, stat } from "fs/promises";
import path, { join } from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { Relay, ArbFinderNode, PNode, ApiMap } from "./../types/types.ts";
import { dotTargetNode, ksmTargetNode } from "../config/txConsts.js";
import { acalaStableLpsPath, arbFinderPath, assetRegistryPath, glmrLpsPath, kusamaAssetRegistryPath, lpRegistryPath, polkadotAssetRegistryPath} from "../config/index.ts"
import { getApiForNode, getApiMap, stateSetLastFile } from "../utils/index.ts";
import { updateAssetRegistryWithMap } from './../../../polkadot_assets/assets/assetHandler.ts';
import { updateLpsWithMap } from './../../../polkadot_assets/lps/all_lps.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * "fallback_search_a_to_b_kusama " + args ||
 * "fallback_search_a_to_b_polkadot " + args
 * 
 * @param args 
 * @param relay 
 * @returns 
 */
export async function arbRunFallbackSearch(startKey: string, destinationKey: string, inputValue: string, relay: Relay): Promise<boolean> {
    return new Promise((resolve, reject) => {
        // let functionCall =
        //     relay === "kusama"
        //         ? "fallback_search_a_to_b_kusama " + args
        //         : "fallback_search_a_to_b_polkadot " + args;
        let functionCall = `fallback_search ${relay} ${startKey} ${destinationKey} ${inputValue}`;
        const command = `cd ${arbFinderPath} && set RUSTFLAGS=-Awarnings && cargo run -- ${functionCall}`;

        console.log("Executing arb: " + functionCall);
        exec(command, (error, stdout, stderr) => {
            console.log(`stdout: ${stdout}`);
            console.log(`stderr: ${stderr}`);

            // Filter out benign Cargo messages
            const benignMessages = [
                "Finished dev [unoptimized + debuginfo]",
                "Running `target\\debug\\arb_handler.exe",
            ];

            const isCriticalError = benignMessages.every(
                (msg) => !stderr.includes(msg)
            );

            if (error) {
                console.error(`exec error: ${error}`);
                reject(error); // Reject the promise on execution error, including non-zero exit codes
                return;
            }

            if (isCriticalError) {
                console.error(`stderr: ${stderr}`);
                resolve(false); // You might still resolve with false if you want to treat stderr output as a soft failure
            } else {
                resolve(true); // Resolve with true if execution was successful without critical errors
            }
        });
    });
}

/**
 * Spawns a new shell that will navigate to the arb-finder repository and execute a new target arb with specified input.
 * - Arb-finder will log results in /target_log_data/ directory, which we can parse and use for arb execution
 * 
 * `search_best_path_a_to_b_${relay} ` + args
 * 
 * @param args: String = assetKey(startNode) + assetKey(destinationNode) + inputValue
 * 
 * Resolves true if arb-finder completes successfully, or throws error
 * 
 * @param args - Input for arb-finder executable
 * @param relay - relay
 * @returns 
 */
export async function arbRunTargetSearch(startKey: string, destinationKey: string, inputValue: string, relay: Relay): Promise<boolean> {
    return new Promise((resolve, reject) => {
        // let functionCall = `search_best_path_a_to_b_${relay} ` + args;
        let functionCall = `target_search ${relay} ${startKey} ${destinationKey} ${inputValue}`;
        const command = `cd ${arbFinderPath} && set RUSTFLAGS=-Awarnings && cargo run --quiet -- ${functionCall}`;
        // const command = `cd ${arbFinderPath} && set RUSTFLAGS=-Awarnings && cargo run -- ${functionCall}`;

        console.log("Executing arb: " + functionCall);
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`exec error: ${error}`);
                reject(error); // Reject the promise on execution error, including non-zero exit codes
                return;
            }
            if (stderr) {
                console.error(`stderr: ${stderr}`);
                resolve(false);
            } else {
                resolve(true); // Resolve with true if execution was successful without errors
            }
        });
    });
}
export async function findLatestDirectory(dirPath: string): Promise<string | null> {
    try {
        const items = await readdir(dirPath, { withFileTypes: true });
        let latestDir: string | null = null;
        let latestTime = 0;

        for (const item of items) {
            if (item.isDirectory()) {
                const itemPath = join(dirPath, item.name);
                const itemInfo = await stat(itemPath);
                if (itemInfo.birthtime.getTime() > latestTime) {
                    latestTime = itemInfo.birthtime.getTime();
                    latestDir = itemPath;
                }
            }
        }

        return latestDir;
    } catch (error) {
        console.error(`Error finding the latest directory: ${error}`);
        return null;
    }
}

export async function findLatestFile(dirPath: string): Promise<string | null> {
    try {
        const files = await readdir(dirPath);
        let latestFile: string | null = null;
        let latestTime = 0;

        for (const file of files) {
            const filePath = join(dirPath, file);
            const fileInfo = await stat(filePath);
            if (
                fileInfo.isFile() &&
                fileInfo.birthtime.getTime() > latestTime
            ) {
                latestTime = fileInfo.birthtime.getTime();
                latestFile = filePath;
            }
        }

        return latestFile;
    } catch (error) {
        console.error(`Error finding the latest file: ${error}`);
        return null;
    }
}

export async function findLatestFileInLatestDirectory(baseDir: string) {
    const latestDirectory = await findLatestDirectory(baseDir);
    if (latestDirectory) {
        console.log(`The latest directory is: ${latestDirectory}`);
        const latestFile = await findLatestFile(latestDirectory);
        if (latestFile) {
            console.log(
                `The latest file within the latest directory is: ${latestFile}`
            );
            return latestFile;
        } else {
            console.log(`No files found in the latest directory.`);
            throw new Error(`No files found in the latest directory.`);
        }
    } else {
        console.log(`No directories found in the base directory.`);
        throw new Error(`No directories found in the base directory.`);
    }
}
export async function updateAssets(chopsticks: boolean, relay: Relay) {
    // const command = `cd ${assetRegistryPath} && ts-node assetHandler.ts ${relay} ${chopsticks}`;
    return new Promise((resolve, reject) => {
        // let functionCall = 'search_best_path_a_to_b ' + chop;
        const command = `cd ${assetRegistryPath} && ts-node assetHandler.ts ${relay} ${chopsticks}`;

        console.log("Updating Assets");
        let child = exec(command, (error, stdout, stderr) => {
            // stdio: 'ignore' // This ignores the output
            if (error) {
                console.error(`exec error: ${error}`);
                reject(error); // Reject the promise on execution error, including non-zero exit codes
                return;
            }
            resolve(true); // Resolve with true if execution was successful without errors
        });

        if (!child.stdout || !child.stderr) {
            throw new Error("Execute arb fallback std error");
        }
        // Ignore package manager warnings
        child.stdout.on("data", (data) => {
            if (
                !data.includes("The following conflicting packages were found:")
            ) {
                process.stdout.write(data);
            }
        });

        child.stderr.on("data", (data) => {
            if (
                !data.includes(
                    "The following conflicting packages were found:"
                ) &&
                !data.includes("API/INIT")
            ) {
                process.stderr.write(data);
            }
        });
    });
}

export async function updateLps(chop: boolean, relay: Relay) {
    // let relayParameter = relay === "Kusama" ? 'kusama' : 'polkadot'

    return new Promise((resolve, reject) => {
        // let functionCall = 'search_best_path_a_to_b ' + chop;
        const command = `cd ${lpRegistryPath} && ts-node all_lps.ts ${relay} ${chop}`;

        console.log("Updating Lps");
        let child = exec(command, (error, stdout, stderr) => {
            // stdio: 'ignore' // This ignores the output
            if (error) {
                console.error(`exec error: ${error}`);
                reject(error); // Reject the promise on execution error, including non-zero exit codes
                return;
            }
            resolve(true); // Resolve with true if execution was successful without errors
        });
        // let child = exec(command)

        if (!child.stdout || !child.stderr) {
            throw new Error("Execute arb fallback std error");
        }
        // Ignore package manager warnings
        child.stdout.on("data", (data) => {
            if (
                !data.includes("The following conflicting packages were found:")
            ) {
                process.stdout.write(data);
            }
        });

        child.stderr.on("data", (data) => {
            if (
                !data.includes(
                    "The following conflicting packages were found:"
                ) &&
                !data.includes("API/INIT")
            ) {
                process.stderr.write(data);
            }
        });
    });
}



async function updateAssetsAndLps(chopsticks: boolean, relay: Relay){
  let assetsResult;  
  let lpsResult;
    try {
        let assetsPromise = updateAssets(chopsticks, relay)
        lpsResult = await updateLps(chopsticks, relay);
        assetsResult = await assetsPromise
    } catch (e) {
        console.log("Error updating assets and lps. Attempting to update again.");
        console.log(e);
        let updateComplete = false;
        let updateAttempts = 0;
        while (!updateComplete && updateAttempts < 3) {
            try {
                let assetsPromise = updateAssets(chopsticks, relay)
                lpsResult = await updateLps(chopsticks, relay);
                assetsResult = await assetsPromise
                updateComplete = true;
            } catch (e) {
                console.log("Error updating lps");
                console.log(e);
            }
        }
        if (!updateComplete) {
            throw new Error("Error updating lps");
        }
    }
    console.log("Lps update complete");
    console.log(assetsResult)
    console.log(lpsResult);
}

export async function updateAssetsAndLpsReworked(chopsticks: boolean, relay: Relay) {
    
    console.log(`Update assets and lps`)
    let apiMap: ApiMap = getApiMap()
    let assetUpdate = updateAssetRegistryWithMap(chopsticks, relay, apiMap)
    let lpUpdate = updateLpsWithMap(chopsticks, relay, apiMap)

    await Promise.all([assetUpdate, lpUpdate])
}
// export async function updateAssetsReworked(chopsticks: boolean, relay: Relay) {
//     await updateAssetRegistryWithMap(chopsticks, relay, apiMap)
// }
// export async function updateLpsReworked(chopsticks: boolean, relay: Relay) {
//     let apiMap: ApiMap = getApiMap()
//     await updateLpsWithMap(chopsticks, relay, apiMap)
// }



/**
 * Use at the start of a new run
 * - Updates assets and lps
 * - Runs runTargetArb function
 * - Save results in /target_log_data/
 * - Read, parse, and return results as ArbFinderNode[] 
 * 
 * Sets GlobalState lastFilePath
 * 
 * @param relay - Relay to run on
 * @param inputAmount - Amount to use as input for the initial asset
 * @param chopsticks - testnet/live
 */
export async function findNewTargetArb(
    relay: Relay,
    inputAmount: string,
    chopsticks: boolean
): Promise<ArbFinderNode[]> {
    await updateAssetsAndLps(chopsticks, relay)
    try{
        // const arbArgs = relay === 'kusama' ? `${ksmTargetNode} ${ksmTargetNode} ${inputAmount}` : `${dotTargetNode} ${dotTargetNode} ${inputAmount}`
        let assetKey  = relay === 'kusama' ? ksmTargetNode : dotTargetNode
        let arbCompleted = await arbRunTargetSearch(assetKey, assetKey, inputAmount, relay);
        if (arbCompleted) {
            // const targetLogFolder = await path.join(
            //     __dirname,
            //     `${arbFinderPath}/target_log_data/${relay}/`
            // );
            const targetLogFolder = `${arbFinderPath}/target_log_data/${relay}/`
            const latestFile = await findLatestFileInLatestDirectory(
                targetLogFolder
            );

            // Set state latest file
            stateSetLastFile(latestFile)

            const targetArbResults: ArbFinderNode[] = JSON.parse(
                fs.readFileSync(latestFile, "utf8")
            );
            return targetArbResults;
        } else {
            throw new Error("Failed to run target arb")
        }
    }  catch {
        console.log("Failed to run target arb")
        throw new Error("Failed to run target arb")
    }
}

/**
 * Use when continuing a previous attempt, starting from an arbitrary asset
 * - Update assets and lps
 * - Run runArbFallback function
 * - Save results in /fallback_log_data/
 * - Read, parse, and return results as ArbFinderNode[] 
 * 
 * @param args 
 * @param chopsticks 
 * @param relay 
 * @returns 
 */
export async function findFallbackArb(
    // args: string,
    startKey: string,
    destinationKey: string,
    inputValue: string,
    chopsticks: boolean,
    relay: Relay
): Promise<ArbFinderNode[]> {
    await updateAssetsAndLps(chopsticks,relay)

    console.log(`Running fallback arb with params ${startKey} ${destinationKey} ${inputValue}`)
    try {
        let arbCompleted = await arbRunFallbackSearch(startKey, destinationKey, inputValue, relay);
        if (arbCompleted) {
            const fallbackLogFolder = `${arbFinderPath}/fallback_log_data/${relay}/`
            const latestFile = await findLatestFileInLatestDirectory(fallbackLogFolder);

            const fallbackArbResults: ArbFinderNode[] = JSON.parse(
                fs.readFileSync(latestFile, "utf8")
            );
            return fallbackArbResults;
        } else {
            throw new Error("Arb Fallback failed");
        }
    } catch (e) {
        console.log("Error running and returning fallback arb");
        console.log(e);
        throw new Error("Error running and returning fallback arb");
    }

    // return results;
}

export async function getBlockNumbers(relay: Relay, chopsticks: boolean) {
    if (relay === 'kusama'){
        
    }
    const chains: PNode[] = relay === 'polkadot' ? ['BifrostPolkadot', 'Parallel', 'Acala', 'Moonbeam', 'HydraDX'] 
        : ['BifrostKusama', 'ParallelHeiko', 'Karura', 'Moonriver', 'Basilisk', 'Mangata'];
        
    const blockNumbers: { [key: string]: number } = {};

    await Promise.all(chains.map(async (chain) => {
        const api = await getApiForNode(chain, chopsticks);
        const blockNumber = await api.query.system.number();
        console.log(`${chain} block number: ${blockNumber.toNumber()}`);
        blockNumbers[chain] = blockNumber.toNumber();
    }));

    return blockNumbers
}
async function run() {
    //  await testArbFinder()
    // await updateLps(true)
}
// run()
// runArbFallback('search_best_path_a_to_b "2001{\\"Native\\":\\"BNC\\"}" "2000{\\"NativeAssetId\\":{\\"Token\\":\\"KSM\\"}}" 1');
