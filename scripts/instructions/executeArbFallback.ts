import { exec } from 'child_process';
import { spawn } from 'child_process';
import { readdir, stat } from 'fs/promises';
import path, { join } from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { ResultDataObject } from './types';
import * as lp from './../../../test2/arb-dot-2/lps/all_lp.js'
// import pkg from './../../../test2/arb-dot-2/lps/all_lp.ts';
// const { updateLpsChop } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


export async function runArbFallback(args: string){
    return new Promise((resolve, reject) => {
        let functionCall = 'search_best_path_a_to_b ' + args;
        const command = `cd C:\\Users\\dazzl\\CodingProjects\\substrate\\test2\\arb-dot-2\\arb_handler && set RUSTFLAGS=-Awarnings && cargo run --quiet -- ${functionCall}`;
        // const command = `cd C:\\Users\\dazzl\\CodingProjects\\substrate\\test2\\arb-dot-2\\arb_handler && set RUSTFLAGS=-Awarnings && cargo run -- ${functionCall}`;

        console.log("Executing arb: " + functionCall)
        exec(command, (error, stdout, stderr) => {
            // console.log(`stdout: ${stdout}`);
            if (error) {
                console.error(`exec error: ${error}`);
                reject(error); // Reject the promise on execution error, including non-zero exit codes
                return;
            }
            if (stderr) {
                console.error(`stderr: ${stderr}`);
                resolve(false); // You might still resolve with false if you want to treat stderr output as a soft failure
                // Or you could reject based on specific stderr content:
                // if (stderr.includes("Error:")) reject(new Error(stderr));
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
        if (fileInfo.isFile() && fileInfo.birthtime.getTime() > latestTime) {
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
        console.log(`The latest file within the latest directory is: ${latestFile}`);
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

export async function updateLps(chop: boolean){
    return new Promise((resolve, reject) => {
      // let functionCall = 'search_best_path_a_to_b ' + chop;
      const command = `cd C:\\Users\\dazzl\\CodingProjects\\substrate\\test2\\arb-dot-2\\lps\\ && ts-node all_lp.ts ${chop}`;

      console.log("Updating Lps")
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

      // Ignore package manager warnings
      child.stdout.on('data', (data) => {
        if (!data.includes('The following conflicting packages were found:')) {
          process.stdout.write(data);
        }
      });
      
      child.stderr.on('data', (data) => {
        if (!data.includes('The following conflicting packages were found:') && !data.includes('API/INIT')) {
          process.stderr.write(data);
        }
      });
  });
  }

export async function runAndReturnFallbackArb(args: string, chopsticks: boolean): Promise<ResultDataObject[]>{
  let lpsResult;
  try{
    lpsResult = await updateLps(chopsticks)
  } catch (e){
    console.log("Error updating lps. Attempting to update again.")
    console.log(e)
    let updateComplete = false;
    let updateAttempts = 0;
    while(!updateComplete && updateAttempts < 3){
      try{
        lpsResult = await updateLps(chopsticks)
        updateComplete = true;
      } catch (e){
        console.log("Error updating lps")
        console.log(e)
      }
    }
    if(!updateComplete){
      throw new Error("Error updating lps")
    }
  }
  console.log("Lps update complete")
  console.log(lpsResult)

    try{
        let arbCompleted = await runArbFallback(args);
        if(arbCompleted){
            const fallbackLogFolder = await path.join(__dirname, '/../../../test2/arb-dot-2/arb_handler/fallback_log_data/');
            const latestFile = await findLatestFileInLatestDirectory(fallbackLogFolder);
            let latestFileData: ResultDataObject[] = JSON.parse(fs.readFileSync(latestFile, 'utf8'));
            return latestFileData
        } else {
            throw new Error("Arb Fallback failed")
        }
    } catch (e){
        console.log("Error running and returning fallback arb")
        console.log(e)
        throw new Error("Error running and returning fallback arb")
    }
    
    // return results;
}
async function run(){
    // console.log("Starting")
    // let results = await runArbFallback('search_best_path_a_to_b "2001{\\"Native\\":\\"BNC\\"}" "2000{\\"NativeAssetId\\":{\\"Token\\":\\"KSM\\"}}" 1');
    // console.log("Done")
    // console.log(JSON.stringify(results, null, 2))

    // const fallbackLogFolder = await path.join(__dirname, '/../../../test2/arb-dot-2/arb_handler/fallback_log_data/');
    // const latestFile = await findLatestFileInLatestDirectory(fallbackLogFolder);
    // console.log(latestFile)
    // let latestFileData = JSON.parse(fs.readFileSync(latestFile, 'utf8'));
    // console.log(JSON.stringify(latestFileData, null, 2))

    // let startNode = '"2001{\\"Native\\":\\"BNC\\"}"'
    // let ksmTargetNode = '"2000{\\"NativeAssetId\\":{\\"Token\\":\\"KSM\\"}}"'
    // let startNodeValue = "50"
    // // await runArbFallback('search_best_path_a_to_b "2001{\\"Native\\":\\"BNC\\"}" "2000{\\"NativeAssetId\\":{\\"Token\\":\\"KSM\\"}}" 1');
    // // let functionArgs = `${lastNodeAssetKey} ${ksmTargetNode} ${lastNodeAssetValue}`
    // let functionArgs = `${startNode} ${ksmTargetNode} ${startNodeValue}`
    // console.log("Executing Arb Fallback with args: " + functionArgs)
    // let fallbackArbResults = await runAndReturnFallbackArb(functionArgs)
    // console.log("Fallback Arb Results: ")
    // console.log(JSON.stringify(fallbackArbResults, null, 2))

    await updateLps(true)
}
// run()
// runArbFallback('search_best_path_a_to_b "2001{\\"Native\\":\\"BNC\\"}" "2000{\\"NativeAssetId\\":{\\"Token\\":\\"KSM\\"}}" 1');
