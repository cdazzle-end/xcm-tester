import { exec } from "child_process";
import { spawn } from "child_process";
import { readdir, stat } from "fs/promises";
import path, { join } from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { Relay, JsonPathNode } from "./../types/types.ts";
import { dotTargetNode, ksmTargetNode } from "../config/txConsts.js";
import { acalaStableLpsPath, arbFinderPath, assetRegistryPath, glmrLpsPath, kusamaAssetRegistryPath, lpRegistryPath, polkadotAssetRegistryPath} from "../config/index.ts"

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


export async function runArbFallback(args: string, relay: Relay) {
    return new Promise((resolve, reject) => {
        let functionCall =
            relay === "kusama"
                ? "fallback_search_a_to_b_kusama " + args
                : "fallback_search_a_to_b_polkadot " + args;
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
export async function runArbTarget(args: string, relay: Relay) {
    return new Promise((resolve, reject) => {
        let functionCall = `search_best_path_a_to_b_${relay} ` + args;
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
async function findLatestDirectory(dirPath: string): Promise<string | null> {
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

async function findLatestFile(dirPath: string): Promise<string | null> {
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

async function findLatestFileInLatestDirectory(baseDir: string) {
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

export async function runAndReturnFallbackArb(
    args: string,
    chopsticks: boolean,
    relay: Relay
): Promise<JsonPathNode[]> {
    await updateAssetsAndLps(chopsticks,relay)

    try {
        let arbCompleted = await runArbFallback(args, relay);
        if (arbCompleted) {
            const fallbackLogFolder = await path.join(
                __dirname,
                `${arbFinderPath}/fallback_log_data/${relay}/`
            );
            const latestFile = await findLatestFileInLatestDirectory(
                fallbackLogFolder
            );
            let latestFileData: JsonPathNode[] = JSON.parse(
                fs.readFileSync(latestFile, "utf8")
            );
            return latestFileData;
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

export async function runAndReturnTargetArb(
    args: string,
    chopsticks: boolean,
    relay: Relay
): Promise<JsonPathNode[]> {

  await updateAssetsAndLps(chopsticks,relay)

    try {
        let arbCompleted = await runArbTarget(args, relay);
        if (arbCompleted) {
            const targetLogFolder = await path.join(
                __dirname,
                `${arbFinderPath}/target_log_data/${relay}/`
            );
            const latestFile = await findLatestFileInLatestDirectory(
                targetLogFolder
            );
            let latestFileData: JsonPathNode[] = JSON.parse(
                fs.readFileSync(latestFile, "utf8")
            );
            return latestFileData;
        } else {
            throw new Error("Arb Fallback failed");
        }
    } catch (e) {
        console.log("Error running and returning fallback arb");
        console.log(e);
        throw new Error("Error running and returning fallback arb");
    }
}

export async function getArbExecutionPath(
    relay: Relay, 
    latestFile: string, 
    inputAmount: number, 
    useLatestTarget: boolean, 
    chopsticks: boolean
){
    let arbPathData: JsonPathNode[] | JsonPathNode[] = []
    
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

/**
 * Use at the start of a new run
 * - Updates both asset and lp registries
 * - Calls arb-finder executable, searches for best arb path using default asset
 * - Logs and returns path as JSON objects. This data is used to execute the arb
 * 
 * @param relay - Relay to run on
 * @param inputAmount - Amount to use as input for the initial asset
 * @param chopsticks - testnet/live
 */
export async function findNewArb(
    relay: Relay,
    inputAmount: number,
    chopsticks: boolean
): Promise<JsonPathNode[]> {
    try{
        let arbArgs = relay === 'kusama' ? `${ksmTargetNode} ${ksmTargetNode} ${inputAmount}` : `${dotTargetNode} ${dotTargetNode} ${inputAmount}`
        return await runAndReturnTargetArb(arbArgs, chopsticks, relay)
    }  catch {
        console.log("Failed to run target arb")
        throw new Error("Failed to run target arb")
    }
}


async function testArbFinder(relay: Relay) {
    let arbArgs =
        relay === "kusama"
            ? `${ksmTargetNode} ${ksmTargetNode} 1.0`
            : `${dotTargetNode} ${dotTargetNode} 1.0`;
    // let arbArgs = `${ksmTargetNode} ${ksmTargetNode} 1.0`
    try {
        let arbCompleted = await runArbTarget(arbArgs, relay);
        if (arbCompleted) {
            const targetLogFolder = await path.join(
                __dirname,
                `${arbFinderPath}/target_log_data/`
            );
            const latestFile = await findLatestFileInLatestDirectory(
                targetLogFolder
            );
            let latestFileData: JsonPathNode[] = JSON.parse(
                fs.readFileSync(latestFile, "utf8")
            );
            return latestFileData;
        } else {
            throw new Error("Arb Fallback failed");
        }
    } catch (e) {
        console.log("Error running and returning fallback arb");
        console.log(e);
        throw new Error("Error running and returning fallback arb");
    }
}
async function run() {
    //  await testArbFinder()
    // await updateLps(true)
}
// run()
// runArbFallback('search_best_path_a_to_b "2001{\\"Native\\":\\"BNC\\"}" "2000{\\"NativeAssetId\\":{\\"Token\\":\\"KSM\\"}}" 1');
