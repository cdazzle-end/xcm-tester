import { exec } from "child_process";
import { spawn } from "child_process";
import { readdir, stat } from "fs/promises";
import path, { join } from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { Relay, JsonPathNode } from "./types";
// import * as lp from './../../../test2/arb-dot-2/lps/all_lp.js'
import { dotTargetNode, ksmTargetNode } from "./txConsts.js";
// import pkg from './../../../test2/arb-dot-2/lps/all_lp.ts';
// const { updateLpsChop } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// export async function runArbFallback(args: string, relay: Relay){
//     return new Promise((resolve, reject) => {
//         let functionCall = relay === "kusama" ? 'fallback_search_a_to_b_kusama ' + args : 'fallback_search_a_to_b_polkadot ' + args;
//         const command = `cd C:\\Users\\dazzl\\CodingProjects\\substrate\\test2\\arb-dot-2\\arb_handler && set RUSTFLAGS=-Awarnings && cargo run --quiet -- ${functionCall}`;
//         // const command = `cd C:\\Users\\dazzl\\CodingProjects\\substrate\\test2\\arb-dot-2\\arb_handler && set RUSTFLAGS=-Awarnings && cargo run ${functionCall}`;

//         console.log("Executing arb: " + functionCall)
//         exec(command, (error, stdout, stderr) => {
//             // console.log(`stdout: ${stdout}`);
//             if (error) {
//                 console.error(`exec error: ${error}`);
//                 reject(error); // Reject the promise on execution error, including non-zero exit codes
//                 return;
//             }
//             if (stderr) {
//                 console.error(`stderr: ${stderr}`);
//                 resolve(false); // You might still resolve with false if you want to treat stderr output as a soft failure
//                 // Or you could reject based on specific stderr content:
//                 // if (stderr.includes("Error:")) reject(new Error(stderr));
//             } else {
//                 resolve(true); // Resolve with true if execution was successful without errors
//             }
//         });
//     });
// }
export async function runArbFallback(args: string, relay: Relay) {
    return new Promise((resolve, reject) => {
        let functionCall =
            relay === "kusama"
                ? "fallback_search_a_to_b_kusama " + args
                : "fallback_search_a_to_b_polkadot " + args;
        const command = `cd C:\\Users\\dazzl\\CodingProjects\\substrate\\test2\\arb-dot-2\\arb_handler && set RUSTFLAGS=-Awarnings && cargo run -- ${functionCall}`;

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
        const command = `cd C:\\Users\\dazzl\\CodingProjects\\substrate\\test2\\arb-dot-2\\arb_handler && set RUSTFLAGS=-Awarnings && cargo run --quiet -- ${functionCall}`;
        // const command = `cd C:\\Users\\dazzl\\CodingProjects\\substrate\\test2\\arb-dot-2\\arb_handler && set RUSTFLAGS=-Awarnings && cargo run -- ${functionCall}`;

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
export async function updateAssets(chopsticks: boolean, relay) {
    // const command = `cd C:\\Users\\dazzl\\CodingProjects\\substrate\\polkadot_assets\\assets\\ && ts-node assetHandler.ts ${relay} ${chopsticks}`;
    return new Promise((resolve, reject) => {
        // let functionCall = 'search_best_path_a_to_b ' + chop;
        const command = `cd C:\\Users\\dazzl\\CodingProjects\\substrate\\polkadot_assets\\assets\\ && ts-node assetHandler.ts ${relay} ${chopsticks}`;

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
        const command = `cd C:\\Users\\dazzl\\CodingProjects\\substrate\\polkadot_assets\\lps\\ && ts-node all_lps.ts ${relay} ${chop}`;

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
                `/../../../test2/arb-dot-2/arb_handler/fallback_log_data/${relay}/`
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
                `/../../../test2/arb-dot-2/arb_handler/target_log_data/${relay}/`
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
                "/../../../test2/arb-dot-2/arb_handler/target_log_data/"
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
