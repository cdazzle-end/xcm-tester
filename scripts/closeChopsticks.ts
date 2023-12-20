import fs from 'fs'
import * as paraspell from '@paraspell/sdk'
import { Observable } from 'rxjs'
import { timeout } from 'rxjs/operators'
import { WsProvider, ApiPromise, Keyring } from '@polkadot/api'
import { FixedPointNumber } from '@acala-network/sdk-core'
import { u8aToHex } from '@polkadot/util'
import { EventRecord, Phase, Event, Hash } from '@polkadot/types/interfaces'
import { ISubmittableResult, IU8a } from '@polkadot/types/types'
import { TNode, getAssetsObject, getNode } from '@paraspell/sdk'
// import { getAssetBySymbolOrId } from './test'
// import * as bridge from '@polkawallet/bridge'
// import * as adapters from '@polkawallet/bridge/adapters/index'
import {BifrostAdapter} from '@polkawallet/bridge/adapters/bifrost'
import { BalanceData } from '@polkawallet/bridge'
import { exec, execSync, spawn, ChildProcess } from 'child_process';
import path from 'path';
import { getAdapter } from './adapters'
import { RegistryError } from '@polkadot/types/types/registry';
// import * as s from 'json-stringify-safe';
import flatted from 'flatted';

async function killProcess(pid: number){
    try{
        process.kill(pid, "SIGTERM")
    }catch(e){
        console.log("Error killing process: " + e)
    }
}
function killProcessInWslForce(pid: number) {
    exec(`wsl kill -9 ${pid}`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error: ${error.message}`);
            return;
        }
        if (stderr) {
            console.error(`stderr: ${stderr}`);
            return;
        }
        console.log(`stdout: ${stdout}`);
    });
}
function killProcessInWslTerm(wslPid: number) {
    exec(`wsl kill -TERM ${wslPid}`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error: ${error.message}`);
        }
        if (stderr) {
            console.error(`stderr: ${stderr}`);
        }
        if (stdout) {
            console.log(`stdout: ${stdout}`);
        }
    });
}
function isProcessRunning(pid: number) {
    try {
        process.kill(pid, 0); // Signal 0 doesn't kill the process
        return true;
    } catch (e: any) {
        if (e.code === 'ESRCH') {
            return false; // No process with this PID
        }
        // Handle other potential errors (e.g., lack of permission)
        throw e;
    }
}

function isProcessRunningTerminal(pid: number){
    exec(`wsl ps -p ${pid}`, (error, stdout, stderr) => {
        if (error) {
            console.log(`Error: ${error.message}`);
            console.log(`Process with PID ${pid} is not running`);
            return;
        }
        if (stdout.includes(`${pid}`)) {
            console.log(`Process with PID ${pid} is running`);
        } else {
            console.log(`Process with PID ${pid} is not running`);
        }
        if (stderr) {
            console.log(`stderr: ${stderr}`);
        }
    });
}

 
// killProcessInWsl(11512); // Replace with the PID from WSL

async function run(){
    killProcessInWslTerm(29173)
    // killProcessInWsl(11512)
    // console.log(isProcessRunning(26412))
    // console.log(isProcessRunningTerminal(688))
}

run()