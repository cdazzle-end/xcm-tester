import fs from 'fs'
import { promises as fsPromises, constants } from 'fs';
import * as path from 'path';
// import pkg from 'mutexify';
// import * as mutex from 'mutexify'
// const { Mutex } = pkg;
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { ethers } from 'ethers';
import { privateKeyToAccount } from 'viem/accounts';
import { dexAbis, localRpc, movrContractAddress, routerFees } from './const.ts';
// import { dexAbis, localRpc, routerFees } from './const';
// const acquireMutex2 = require('mutexify')();
// 
// console.log(typeof mutex);

// Use import.meta.url to get the current module's URL
const currentUrl = import.meta.url;

// Convert the URL to a file path
const currentPath = fileURLToPath(currentUrl);

// Use dirname to get the directory path
const currentDir = dirname(currentPath);

const contractResultsPath = path.resolve(currentDir, '../batchResults/batch_contract_results.json');
const contractResultsTxReceiptsPath = path.resolve(currentDir, '../batchResults/batch_contract_results_receipts.json');
const contractErrorsPath = path.resolve(currentDir, '../batchResults/batch_contract_errors.json');

const doubleSwapResults = path.resolve(currentDir, '../batchResults/double_swap_results.json');
const doubleSwapTxReceiptsPath = path.resolve(currentDir, '../batchResults/double_swap_receipts.json');
const doubleSwapErrorsPath = path.resolve(currentDir, '../batchResults/double_swap_errors.json');

export async function logBatchContractResults(inputResultsObject: any, acquireMutex: any, inputErrObject?: any): Promise<void> {
    let release: Function | undefined;
    // console.log("M 1")
    // console.log(typeof acquireMutex); // Should print 'function'

    try {
        await new Promise<void>((resolve) => {
            acquireMutex((relFn: Function) => {
                release = relFn;
                resolve();
            });
        });
        if (!release) {
            console.error('Error acquiring mutex: Release function is undefined.');
            return;
        }
        const contractResultsDatabase = await readFromFile(contractResultsPath);
        const contractResultsTxReceiptsDatabase = await readFromFile(contractResultsTxReceiptsPath);
        const contractErrorsDatabase = await readFromFile(contractErrorsPath);

        const findByContractAddress = (array: any[], contractAddress: string) => array.find((item: any) => item.contractAddress === contractAddress);

        updateOrAppendData(contractResultsDatabase, inputResultsObject, 0, findByContractAddress);
        updateOrAppendData(contractResultsTxReceiptsDatabase, inputResultsObject, 1, findByContractAddress);
        updateOrAppendData(contractErrorsDatabase, inputResultsObject, 2, findByContractAddress, inputErrObject);

        await fsPromises.writeFile(contractResultsPath, JSON.stringify(convertBigIntToString(contractResultsDatabase), null, 2));
        await fsPromises.writeFile(contractResultsTxReceiptsPath, JSON.stringify(contractResultsTxReceiptsDatabase, null, 2));
        await fsPromises.writeFile(contractErrorsPath, JSON.stringify(contractErrorsDatabase, null, 2));

        
        
    } catch (error) {
        // Handle errors here
        console.error('Error:', error);
    } finally {
        // Release the lock
        if (release) {
            release();
        }
    }
}

export async function logDoubleSwapResults(inputResultsObject: any, acquireMutex: any, inputErrObject?: any): Promise<void> {
    let release: Function | undefined;
    // console.log("M 1")
    // console.log(typeof acquireMutex); // Should print 'function'

    try {
        await new Promise<void>((resolve) => {
            acquireMutex((relFn: Function) => {
                release = relFn;
                resolve();
            });
        });
        if (!release) {
            console.error('Error acquiring mutex: Release function is undefined.');
            return;
        }
        const doubleSwapResultsDatabase = await readFromFile(doubleSwapResults);
        const doubleSwapRecieptsDatabase = await readFromFile(doubleSwapTxReceiptsPath);
        const doubleSwapErrorsDatabase = await readFromFile(doubleSwapErrorsPath);

        const findByContractAddress = (array: any[], contractAddress: string) => array.find((item: any) => item.contractAddress === contractAddress);

        updateOrAppendData(doubleSwapResultsDatabase, inputResultsObject, 0, findByContractAddress);
        updateOrAppendData(doubleSwapRecieptsDatabase, inputResultsObject, 1, findByContractAddress);
        updateOrAppendData(doubleSwapErrorsDatabase, inputResultsObject, 2, findByContractAddress, inputErrObject);

        await fsPromises.writeFile(doubleSwapResults, JSON.stringify(convertBigIntToString(doubleSwapResultsDatabase), null, 2));
        await fsPromises.writeFile(doubleSwapTxReceiptsPath, JSON.stringify(doubleSwapRecieptsDatabase, null, 2));
        await fsPromises.writeFile(doubleSwapErrorsPath, JSON.stringify(doubleSwapErrorsDatabase, null, 2));

        
        
    } catch (error) {
        // Handle errors here
        console.error('Error:', error);
    } finally {
        // Release the lock
        if (release) {
            release();
        }
    }
}
function convertBigIntToString(obj: any): any {
    if (typeof obj === 'bigint') {
      return obj.toString();
    } else if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        obj[key] = convertBigIntToString(obj[key]);
      }
    }
    return obj;
  }

function parseError(error: any, errorObject: any = {}){
    Object.entries(error).forEach(([key, value]) => {
        // console.log(`${key}: ${value}`)
        if(typeof value === 'object' && value !== null){
            // console.log("Object found")
            errorObject = parseError(value, errorObject)
        } else if (typeof value ===  'bigint') {
            errorObject[key] = value.toString()
        } else {
            errorObject[key] = value
        } 
    })
    return errorObject
}
// Function to update or append data in a database array
function updateOrAppendData(database: any[], inputResultsObject: any, databaseIndex: number, findFunction: (array: any[], key: string) => any,  errorInputObject?: any,) {
    let dataToUpdate;
    if(databaseIndex === 0){
        dataToUpdate = {
            success: inputResultsObject.success,
            wallet: inputResultsObject.wallet,
            walletIndex: inputResultsObject.walletIndex,
            nonce: inputResultsObject.nonce,
            contractAddress: inputResultsObject.contractAddress,
            token0: inputResultsObject.token0Address,
            token1: inputResultsObject.token1Address,
            abiIndex: inputResultsObject.abiIndex,
            slippage: inputResultsObject.slippageTolerance,
            movrBefore: inputResultsObject.movrBefore,
            movrAfter: inputResultsObject.movrAfter,
            movrDifference: inputResultsObject.movrDifference,
            otherTokenBefore: inputResultsObject.otherTokenBefore,
            otherTokenAfter: inputResultsObject.otherTokenAfter,
            otherTokenDifference: inputResultsObject.otherTokenDifference,
            movrBefore2: inputResultsObject.movrBefore2,
            movrAfter2: inputResultsObject.movrAfter2,
            otherTokenBefore2: inputResultsObject.otherTokenBefore2,
            otherTokenAfter2: inputResultsObject.otherTokenAfter2,
            calculatedAmountOut: inputResultsObject.calculatedAmountOut,
            failureReason: inputResultsObject.failureReason,
            otherTokenDifference2: inputResultsObject.otherTokenDifference2,
            movrDifference2: inputResultsObject.movrDifference2,
            swap2success: inputResultsObject.swap2success,
        };
    } else if (databaseIndex === 1){
        dataToUpdate = {
            contractAddress: inputResultsObject.contractAddress,
            swapTxReceipt: inputResultsObject.swapTxReceipt,
        }
    } else if (databaseIndex === 2){
        if(!errorInputObject){
            dataToUpdate = {
                contractAddress: inputResultsObject.contractAddress,
                // error: errorObject,
            }
        } else {
            const errorObject = parseError(errorInputObject)
            dataToUpdate = {
                contractAddress: inputResultsObject.contractAddress,
                error: errorObject,
            }
        }
        
        // console.log(JSON.stringify(errorObject, null, 2))
        
    }

    const existingObject = findFunction(database, inputResultsObject.contractAddress);

    if (existingObject) {
        // Update existing object
        Object.assign(existingObject, dataToUpdate);
    } else {
        // Append new object
        database.push(dataToUpdate);
    }
}
async function readFromFile(filePath): Promise<any[]> {
    try {
      await fsPromises.access(filePath, constants.F_OK);
      const fileContent = await fsPromises.readFile(filePath, 'utf-8');
      return JSON.parse(fileContent);
    } catch (error) {
      // If the file doesn't exist or there's an error reading it, return an empty array
      fsPromises.writeFile(filePath, '[]');
      return [];
    }
}

export async function getBestSwapRoute(tokenInContract: string, tokenOutContract:string, amount: bigint){
    let tokenContractToDexAddress = {}
    const  dexSwapData = JSON.parse(fs.readFileSync('./batchResults/batch_contract_results.json', 'utf8'));
    dexSwapData.forEach((lp: any) => {
        if (!tokenContractToDexAddress[lp.token0]) {
            tokenContractToDexAddress[lp.token0] = [];
        }
        if (!tokenContractToDexAddress[lp.token1]) {
            tokenContractToDexAddress[lp.token1] = [];
        }
        if (!tokenContractToDexAddress[lp.token0].includes(lp.contractAddress)) {
            tokenContractToDexAddress[lp.token0].push(lp.contractAddress);
        }
        if (!tokenContractToDexAddress[lp.token1].includes(lp.contractAddress)) {
        tokenContractToDexAddress[lp.token1].push(lp.contractAddress);
        }
    })
    const dexAddressesForTokenA = tokenContractToDexAddress[tokenInContract] || [];
    const dexAddressesForTokenB = tokenContractToDexAddress[tokenOutContract] || [];

    const provider = new ethers.JsonRpcProvider(localRpc);

    // Find common Dex addresses
    const commonDexAddresses = dexAddressesForTokenA.filter(address => dexAddressesForTokenB.includes(address));

    let dexOutputs = await Promise.all(commonDexAddresses.map(async (dexAddress: string) => {
        const dexData = dexSwapData.find((dataObject: any) => dataObject.contractAddress == dexAddress)
        const dexAbi = dexAbis[dexData.abiIndex]

        let dexContract = new ethers.Contract(dexAddress, dexAbi, provider)
        let [reserves0, reserves1, timestamp] = await dexContract.getReserves()

        const outputAmount = calculateSwapAmountRouterFormula(amount, reserves0, reserves1, 100, routerFees[dexData.abiIndex])
        return [dexAddress, outputAmount]
    }))
    let bestDex = [ '', 0]
    dexOutputs.forEach((output: any) => {
        if(output[1] > bestDex[1]){
            bestDex = output
        }
    })
    return bestDex
}

export function calculateSwapAmountRouterFormula(input: bigint, inputReserve: bigint, outputReserve: bigint, slippageTolerance: number, fee: number): bigint{
    const feeMultiplier = BigInt(10000) - BigInt(fee)
    const slipMultiplier = BigInt(10000) - BigInt(slippageTolerance)

    // FEE MULTIPLIER
    // const amountInWithFee = input * feeMultiplier
    // const numerator = amountInWithFee * outputReserve
    // const denominator = (inputReserve * BigInt(10000)) + amountInWithFee
    // const formulatAmountOut = numerator / denominator

    const amountInWithSlippage = input * slipMultiplier
    const slipNumerator = amountInWithSlippage * outputReserve
    const slipDenominator = (inputReserve * BigInt(10000)) + amountInWithSlippage
    const slippageAmountOut = slipNumerator / slipDenominator
    return slippageAmountOut
}

export function checkForSubstrateToken(address: string){
    if(address.startsWith("0x") || address == "MOVR"){
        // console.log("Not a substrate token")
        return false
    } else {
        const assetRegistry = JSON.parse(fs.readFileSync('./allAssets.json', 'utf8'));
        const substrateToken = assetRegistry.find((asset: any) => asset.tokenData.localId == address)
        if(substrateToken){
            return true
        } else {
            throw new Error("Cant find substrate token")
        }
    }
}
export function getContractAbiIndex(contractAddress: string){
    const contractData = JSON.parse(fs.readFileSync('./resultLogs/abiResults.json', 'utf8'));
    const contract = contractData.find((contract: any) => contract.contractAddress == contractAddress && contract.txType == "swap")
    if(!contract){
        console.log("Contract not found: ", contractAddress)
    }else {
        // console.log("Contract found")
    }
    return contract["txResultData"]["abiIndex"]
}
export function getContractAbi(contractAddress: string){

    return dexAbis[getContractAbiIndex(contractAddress)]
}
export async function getTokenContractData(tokenContractAddress: string){
    const provider = new ethers.JsonRpcProvider(localRpc);
    const tokenAbi = tokenContractAddress === movrContractAddress ? JSON.parse(fs.readFileSync('./abi/movrContractAbi.json', 'utf8')) : JSON.parse(fs.readFileSync('./abi/usdcContractAbi.json', 'utf8'));
    const tokenContract = new ethers.Contract(tokenContractAddress, tokenAbi, provider)
    const tokenSymbol = await tokenContract.symbol()
    const tokenDecimals = await tokenContract.decimals()
    const tokenData ={
        symbol: tokenSymbol,
        decimals: tokenDecimals
    }
    return tokenData
}
export async function checkApproval(tokenContract: ethers.Contract, walletAddress: string, spenderAddress: string) {
    const allowance = await tokenContract.allowance(walletAddress, spenderAddress);
    if (allowance) {
        // console.log(`The spender address ${spenderAddress} is approved to spend tokens for the user ${walletAddress}.`);
        return true
    } else {
        // console.log(`The spender address ${spenderAddress} is NOT approved to spend tokens for the user ${walletAddress}.`);
        return false
    }
}