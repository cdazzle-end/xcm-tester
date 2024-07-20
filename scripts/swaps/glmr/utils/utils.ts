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
import { dexAbis, localRpc, wGlmrContractAddress, routerFees, dexAbiMap, maxTickData, minTickData, q96, wsProvider, xcTokenAbi, glmrLpsPath } from './const.ts';
import { erc20Abi } from 'viem';
import bn, { BigNumber } from 'bignumber.js'
import { GlobalState, MyLp, Slot0, V3CalculationResult } from './types.ts';
import { TickMath } from '@uniswap/v3-sdk';
// import { dexAbis, localRpc, routerFees } from './const';
// const acquireMutex2 = require('mutexify')();
// 
// console.log(typeof mutex);

// Use import.meta.url to get the current module's URL
const currentUrl = import.meta.url;
const __dirname = path.dirname(fileURLToPath(import.meta.url))
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

export async function wrapGlmr(wallet: ethers.Wallet, inputAmount: bigint){
    let glmrAbiPath = path.join(__dirname, './../abi/glmrContractAbi.json')
    let glmrAbi = JSON.parse(fs.readFileSync(glmrAbiPath, 'utf8'));
    console.log("Wrapping GLMR")

    const glmrToken = new ethers.Contract(wGlmrContractAddress, glmrAbi, wallet);
    const currentGlmrBalance = await glmrToken.balanceOf(wallet.address)
    const depositTransaction = {
        to: wGlmrContractAddress, // The address of the WMOVR contract
        value: inputAmount // The amount of MOVR to deposit
    };
    let tx = await wallet.sendTransaction(depositTransaction);
    let receipt = await tx.wait();
    return receipt
}
export async function logLiveWalletTransaction(receipt: ethers.TransactionReceipt, txNote: string){
    let txData = {
        txHash: receipt.hash,
        txNote: txNote,
        txReceipt: receipt,
    }
    let receipts = JSON.parse(fs.readFileSync('./liveWalletReceipts.json', 'utf8'));
    let receiptsArray;
    if(Array.isArray(receipts)){
        receiptsArray = receipts
    } else {
        receiptsArray = [receipts]
    }
    receiptsArray.push(txData)
    fs.writeFileSync('./liveWalletReceipts.json', JSON.stringify(receiptsArray, null, 2))
}
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
    // console.log("Logging double swap results")
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

        // console.log("Input object: ", inputResultsObject)
        // console.log("Input Error: ", inputErrObject)
        updateOrAppendSwapTxData(doubleSwapResultsDatabase, inputResultsObject, 0, findByContractAddress);
        updateOrAppendSwapTxData(doubleSwapRecieptsDatabase, inputResultsObject, 1, findByContractAddress);
        updateOrAppendSwapTxData(doubleSwapErrorsDatabase, inputResultsObject, 2, findByContractAddress, inputErrObject);

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

// Function to update or append data in a database array
function updateOrAppendSwapTxData(database: any[], inputResultsObject: any, databaseIndex: number, findFunction: (array: any[], key: string) => any,  errorInputObject?: any,) {
    let dataToUpdate;
    
    if(databaseIndex === 0){
        dataToUpdate = {
            success: inputResultsObject.success,
            wallet: inputResultsObject.wallet,
            walletIndex: inputResultsObject.walletIndex,
            nonce: inputResultsObject.nonce,
            contractAddress: inputResultsObject.contractAddress,
            token0: inputResultsObject.token0,
            token1: inputResultsObject.token1,
            tokenIn: inputResultsObject.tokenIn,
            tokenOut: inputResultsObject.tokenOut,
            abiIndex: inputResultsObject.abiIndex,
            slippage: inputResultsObject.slippage,
            failureReason: inputResultsObject.failureStatus,
            swapData: inputResultsObject.swapData,
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
                success: true,
                error: errorInputObject,
            }
        } else {
            const errorObject = parseError(errorInputObject)
            dataToUpdate = {
                contractAddress: inputResultsObject.contractAddress,
                success: false,
                tokenIn: inputResultsObject.tokenIn,
                tokenOut: inputResultsObject.tokenOut,
                error: errorObject,
            }
        }
        
        // console.log(JSON.stringify(errorObject, null, 2))
        
    }

    // const existingObject = findFunction(database, inputResultsObject.contractAddress);
    let matchingObjects = database.filter((item: any) => item.contractAddress === inputResultsObject.contractAddress)
    // console.log("Matching objects: ", matchingObjects.length)
    const existingObject = matchingObjects.find((item: any) => item.tokenIn === inputResultsObject.tokenIn && item.tokenOut === inputResultsObject.tokenOut)
    // console.log("Existing object: ", existingObject)

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
function lookupXcLocalIdByAddress(address: string){
    const assetRegistry = JSON.parse(fs.readFileSync(path.join(__dirname, '../allAssets.json'), 'utf8'));
    // console.log(assetRegistry)
    const xcToken = assetRegistry.find((asset: any) => asset.tokenData.chain == 2023 && asset.tokenData.contractAddress.toString().toLowerCase() == address.toLowerCase())
    return xcToken.tokenData.localId
}
function lookupXcAddressByLocalId(localId: string){
    const assetRegistry = JSON.parse(fs.readFileSync('./allAssets.json', 'utf8'));
    const xcToken = assetRegistry.find((asset: any) => asset.tokenData.chainId == 2023 && asset.tokenData.localId == localId)
    return xcToken.tokenData.contractAddress
}
export async function getBestSwapRoute(tokenInContract: string, tokenOutContract:string, amount: bigint, rpc: string){
    // console.log(`Get best swap route for ${tokenInContract} to ${tokenOutContract}`)
    let tokenContractToDexAddress = {}
    // let tokenInId = lookupXcLocalIdByAddress(tokenInContract)
    // let tokenOutId = lookupXcLocalIdByAddress(tokenOutContract)
    let dexSwapData = JSON.parse(fs.readFileSync(path.join(__dirname, '../dexInfo.json'), 'utf8'));
    dexSwapData.forEach((lp: any) => {
        // If object is empty, initialize array
        if (!tokenContractToDexAddress[lp.token0]) {
            tokenContractToDexAddress[lp.token0] = [];
        }
        if (!tokenContractToDexAddress[lp.token1]) {
            tokenContractToDexAddress[lp.token1] = [];
        }
        if(lp.token0.toLowerCase() == tokenOutContract.toLowerCase()){
            tokenOutContract = lp.token0
        }
        if(lp.token1.toLowerCase() == tokenOutContract.toLowerCase()){
            tokenOutContract = lp.token1
        }
        if(lp.token0.toLowerCase() == tokenInContract.toLowerCase()){
            tokenInContract = lp.token0
        }
        if(lp.token1.toLowerCase() == tokenInContract.toLowerCase()){
            tokenInContract = lp.token1
        }
        let token0Array = tokenContractToDexAddress[lp.token0].map((address: string) => address.toLowerCase())
        let token1Array = tokenContractToDexAddress[lp.token1].map((address: string) => address.toLowerCase())
        if (!token0Array.includes(lp.contractAddress.toLowerCase())) {
            tokenContractToDexAddress[lp.token0].push(lp.contractAddress);
        }
        if (!token1Array.includes(lp.contractAddress.toLowerCase())) {
        tokenContractToDexAddress[lp.token1].push(lp.contractAddress);
        }
    })
    const dexAddressesForTokenA = tokenContractToDexAddress[tokenInContract] || [];
    const dexAddressesForTokenB = tokenContractToDexAddress[tokenOutContract] || [];
 
    const provider = new ethers.JsonRpcProvider(rpc);

    // Find common Dex addresses
    const commonDexAddresses = dexAddressesForTokenA.filter(address => dexAddressesForTokenB.includes(address));

    let dexOutputs = await Promise.all(commonDexAddresses.map(async (dexAddress: string) => {
        const dexData = dexSwapData.find((dataObject: any) => dataObject.contractAddress == dexAddress)
        const dexAbi = dexAbis[dexData.abiIndex]
        

        let dexContract = new ethers.Contract(dexAddress, dexAbi, provider)
        let [reserves0, reserves1, timestamp] = await dexContract.getReserves()
        let token0 = await dexContract.token0()
        let tokenInReserves: bigint, tokenOutReserves: bigint;
        if(token0 == tokenInContract){
            tokenInReserves = reserves0;
            tokenOutReserves = reserves1;
        } else {
            tokenInReserves = reserves1;
            tokenOutReserves = reserves0;
        }
        // console.log(`Calculate swap parameters Best route: ${tokenInReserves}, ${tokenOutReserves}, ${amount}`)
        const outputAmount = calculateSwapAmountRouterFormula(amount, tokenInReserves, tokenOutReserves, 100, Number.parseFloat(routerFees[dexData.abiIndex].toString()))
        // console.log(`Output amount: ${outputAmount}`)
        return [dexAddress, outputAmount]
    }))
    let bestDex = ['', 0]
    dexOutputs.forEach((output: any) => {
        if(output[1] > bestDex[1]){
            bestDex = output
        }
    })
    // console.log("Best dex: ", bestDex)
    return bestDex
}

export function calculateSwapAmountRouterFormula(input: bigint, inputReserve: bigint, outputReserve: bigint, slippageTolerance: number, fee: number): bigint{
    const feeMultiplier: bigint = BigInt(10000) - BigInt(fee)
    const slipMultiplier: bigint = BigInt(10000) - BigInt(slippageTolerance)

    // FEE MULTIPLIER
    // const amountInWithFee = input * feeMultiplier
    // const numerator = amountInWithFee * outputReserve
    // const denominator = (inputReserve * BigInt(10000)) + amountInWithFee
    // const formulatAmountOut = numerator / denominator

    const amountInWithSlippage:bigint = BigInt(input) * BigInt(slipMultiplier)
    const slipNumerator: bigint = amountInWithSlippage * outputReserve
    const slipDenominator: bigint = (BigInt(inputReserve) * BigInt(10000)) + amountInWithSlippage
    const slippageAmountOut: bigint = slipNumerator / slipDenominator
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
    // const contractData = JSON.parse(fs.readFileSync('./resultLogs/abiResults.json', 'utf8'));
    const contractData = JSON.parse(fs.readFileSync('./batchResults/batch_contract_results_archive.json', 'utf8'));
    // const contract = contractData.find((contract: any) => contract.contractAddress == contractAddress && contract.txType == "swap")
    const contract = contractData.find((contract: any) => {
        // console.log(`Database contract address: ${contract["contractAddress"]} --- Input contract address: ${contractAddress}`)
        return contract["contractAddress"] == contractAddress
    })
    
    if(!contract){
        console.log("Contract not found: ", contractAddress)
    }else {
        // console.log("Contract found")
    }
    return contract["abiIndex"]
}
export function getContractAbi(contractAddress: string){

    return dexAbis[getContractAbiIndex(contractAddress)]
}
export async function getTokenContractData(tokenContractAddress: string, walletAddress?: string){
    console.log("GetTokenContractData")
    const provider = new ethers.JsonRpcProvider(localRpc);
    const tokenAbi = tokenContractAddress === wGlmrContractAddress ? JSON.parse(fs.readFileSync('./abi/glmrContractAbi.json', 'utf8')) : JSON.parse(fs.readFileSync('./abi/usdcContractAbi.json', 'utf8'));
    const tokenContract = new ethers.Contract(tokenContractAddress, tokenAbi, provider)
    const tokenSymbol = await tokenContract.symbol()
    const tokenDecimals = await tokenContract.decimals()
    let tokenBalance: bigint;

    if(walletAddress){
        tokenBalance = await tokenContract.balanceOf(walletAddress)
        // console.log("Token balance: ", tokenBalance)
    }

    const tokenData ={
        symbol: tokenSymbol,
        decimals: tokenDecimals,
        tokenBalance: tokenBalance
    }

    return tokenData
}
export async function checkApproval(tokenContract: ethers.Contract, walletAddress: string, spenderAddress: string) {
    const allowance = await tokenContract.allowance(walletAddress, spenderAddress);
    if (allowance) {
        console.log(`The spender address ${spenderAddress} is approved to spend tokens for the user ${walletAddress}.`);
        return true
    } else {
        console.log(`The spender address ${spenderAddress} is NOT approved to spend tokens for the user ${walletAddress}.`);
        return false
    }
}

export async function checkAndApproveToken(tokenContractAddress: string, wallet: ethers.Wallet, spender: string, inputAmount: bigint){
    const tokenContract = new ethers.Contract(tokenContractAddress, erc20Abi, wallet)
    const allowance = await tokenContract.allowance(wallet.address, spender);
    // console.log(`ALLOWANCE CHECK 1: Batch contract address: ${spender} -- Wallet address: ${wallet.address} -- Token Contract ${tokenContractAddress}-- Allowance: ${allowance} -- Input Amount: ${inputAmount}`)
    if (allowance < inputAmount) {
        console.log(`Approving ${spender} to spend ${inputAmount} tokens for the user ${wallet.address}.`);
        // console.log(`The spender address ${spender} is NOT approved to spend tokens for the user ${wallet.address}. Approving...`);
        const approveTx = await tokenContract.approve(spender, inputAmount)
        let approvalReceipt = await approveTx.wait()
        return approvalReceipt
    } else {
        console.log(`The spender address ${spender} is approved to spend tokens for the user ${wallet.address}.`);
        // console.log(`The spender address ${spender} is approved to spend tokens for the user ${wallet.address}.`);
        return false
    }

}

export async function approveMax(tokenContractAddress: string, wallet: ethers.Wallet, spender: string){
    let max = ethers.MaxUint256
    const tokenContract = new ethers.Contract(tokenContractAddress, erc20Abi, wallet)
    const allowance = await tokenContract.allowance(wallet.address, spender);
    // console.log(`ALLOWANCE CHECK 1: Batch contract address: ${spender} -- Wallet address: ${wallet.address} -- Token Contract ${tokenContractAddress}-- Allowance: ${allowance} -- Input Amount: ${inputAmount}`)
    if (allowance < max) {
        console.log(`Approving ${spender} to spend ${max} tokens for the user ${wallet.address}.`);
        // console.log(`The spender address ${spender} is NOT approved to spend tokens for the user ${wallet.address}. Approving...`);
        const approveTx = await tokenContract.approve(spender, max)
        let approvalReceipt = await approveTx.wait()
        return approvalReceipt
    } else {
        console.log(`The spender address ${spender} is approved to spend tokens for the user ${wallet.address}.`);
        // console.log(`The spender address ${spender} is approved to spend tokens for the user ${wallet.address}.`);
        return false
    }
}

export async function calculateAlgebraSwap(tokenIn: string, tokenOut: string, amountIn: number, contractAddress: string){
    const pool = await new ethers.Contract(contractAddress, dexAbiMap['algebra'], wsProvider);
    let token0 = await pool.token0();
    let token1 = await pool.token1();
    let token0Contract = await new ethers.Contract(token0, xcTokenAbi, wsProvider);
    let token1Contract = await new ethers.Contract(token1, xcTokenAbi, wsProvider);
    let token0Symbol = await token0Contract.symbol();
    let token1Symbol = await token1Contract.symbol();
    let token0Decimals = await token0Contract.decimals();
    let token1Decimals = await token1Contract.decimals();
    let activeLiquidity = await pool.liquidity();
    let tickSpacing = await pool.tickSpacing();

    let poolInfo: GlobalState = await pool.globalState();
    // let currentTick =new bn(poolInfo.tick)
    // let activeLiquidityBn = new bn(activeLiquidity)
    let tickSpacingBn = new bn(tickSpacing)

    

    // Get pool data from glmr_lps.json
    let poolData: MyLp[] = JSON.parse(fs.readFileSync(glmrLpsPath, 'utf8'))
    let contractData = poolData.find((lp: MyLp) => lp.contractAddress.toLowerCase() == contractAddress.toLowerCase())

    // Get CURRENT TICK | ACTIVE LIQUIDITY | FEE RATE | UPPER/LOWER TICKS from pool data
    let currentTick = new bn(contractData.currentTick)
    let activeLiquidityBn = new bn(contractData.activeLiquidity)
    let poolFeeRate = new bn(contractData.feeRate).div(new bn(1).times(new bn(10).pow(6)))
    let lowerTicks = contractData.lowerTicks
    let upperTicks = contractData.upperTicks

    let inputTokenDecimals, outputTokenDecimals, inputTokenSymbol, outputTokenSymbol, inputTokenIndex
    if(token0 == tokenIn){
        inputTokenDecimals = token0Decimals
        inputTokenSymbol = token0Symbol
        outputTokenDecimals = token1Decimals
        outputTokenSymbol = token1Symbol
        inputTokenIndex = 0
    } else {
        inputTokenDecimals = token1Decimals
        inputTokenSymbol = token1Symbol
        outputTokenDecimals = token0Decimals
        outputTokenSymbol = token0Symbol
        inputTokenIndex = 1
    }

    // Set RETURN VALUES
    let totalTokenOut = new bn(0)
    let totalTokenIn = new bn(0)

    // Set PRICE RANGE LIQUIDITY
    let priceRangeLiquidity = activeLiquidityBn

    // Set INPUT AMOUNT
    let tokenInAmountRemaining = new bn(amountIn).times(new bn(10).pow(new bn(inputTokenDecimals)))
    tokenInAmountRemaining = tokenInAmountRemaining.times(new bn(1).minus(poolFeeRate))

    // Set index for initialized ticks upper/lower to 0
    let tickRangeIndex = 0
    let finalTargetPrice;
    while(tokenInAmountRemaining.gt(0)){
        console.log("******************************************************************")
        console.log(`Token In Amount Remaining: ${tokenInAmountRemaining}`)
        console.log(`${priceRangeLiquidity} Active Liquidity`)

        // Get CURRENT TICK BOUNDARIES
        let tickLower = lowerTicks[tickRangeIndex]
        let tickUpper = upperTicks[tickRangeIndex]
        tickRangeIndex++

        // Check LAST TICK
        tickLower = !tickLower ? minTickData : tickLower
        tickUpper = !tickUpper ? maxTickData : tickUpper

        // Get TICK PRICES LOWER | CURRENT | UPPER
        let currentSqrtPriceX96 = new bn(TickMath.getSqrtRatioAtTick(currentTick.toNumber()).toString())
        let sqrtPriceUpperX96 = new bn(TickMath.getSqrtRatioAtTick(tickUpper.tick).toString())
        let sqrtPriceLowerX96 = new bn(TickMath.getSqrtRatioAtTick(tickLower.tick).toString())
        let currentSqrtPrice = currentSqrtPriceX96.div(q96)

        console.log(`Fee Rate: ${poolFeeRate}`)
        console.log(`Lower: ${tickLower.tick} | Current Tick: ${currentTick} | Upper: ${tickUpper.tick}`)
        
        if(inputTokenIndex == 0){
            // Swapping 0 -> 1
            console.log("Swapping 0 -> 1")
            console.log(`Lower Tick: ${tickLower.tick}`)


            // Get TARGET PRICE from PRICE CHANGE
            let changeInPriceRecipricol = tokenInAmountRemaining.div(priceRangeLiquidity)
            let changeInPrice = new bn(1).div(currentSqrtPrice).plus(changeInPriceRecipricol)
            let targetSqrtPrice = changeInPrice.pow(-1)
            let targetSqrtPriceX96 = targetSqrtPrice.times(q96)
            finalTargetPrice = targetSqrtPrice
            console.log(`Recipricol: ${changeInPriceRecipricol} | Price Chagne: ${changeInPrice} | Target Sqrt Price: ${targetSqrtPriceX96} | Lower Sqrt Price: ${sqrtPriceLowerX96} | Current Sqrt Price: ${currentSqrtPriceX96}`)
            console.log(`Target Sqrt P: ${targetSqrtPriceX96} --- Lower Sqrt Price: ${sqrtPriceLowerX96} --- Current Sqrt Price: ${currentSqrtPriceX96}`)

            // Check if TARGET PRICE exceeds TICK BOUNDRY
            let priceExceedsRange = targetSqrtPriceX96.lt(sqrtPriceLowerX96.toString())
            console.log("Target Price is less than range: ", priceExceedsRange)
            if(priceExceedsRange){
                
                // Calculate AMOUNT IN | AMOUNT OUT
                let amountToken0In = calculateAmount0(priceRangeLiquidity, sqrtPriceLowerX96.div(q96), currentSqrtPrice)
                let amountToken1Out = calculateAmount1(priceRangeLiquidity, sqrtPriceLowerX96.div(q96), currentSqrtPrice)

                // Accumulate TOKENS IN/OUT
                tokenInAmountRemaining = tokenInAmountRemaining.minus(amountToken0In)
                totalTokenIn = totalTokenIn.plus(amountToken0In)
                totalTokenOut = totalTokenOut.plus(amountToken1Out)

                // Get DELTA LIQUIDITY
                let deltaLiquidity = new bn(tickLower.liquidityDelta)
                console.log(`Active Liquidity: ${priceRangeLiquidity} | Delta Tick Liquidity: ${deltaLiquidity}`)

                // ****** When crossing a lower tick range, subtract. Look at glmr_lp registry and examine delta liquidity.

                // Apply DELTA LIQUIDITY to ACTIVE LIQUIDITY
                priceRangeLiquidity = priceRangeLiquidity.minus(deltaLiquidity)

                // Set CURRENT TICK to LOWER TICK
                currentTick = new bn(tickLower.tick)

                // Check ACTIVE LIQUIDITY
                if(priceRangeLiquidity.eq(0)){
                    console.log("Price range liquidity is 0")  // Should EDIT this so that it returns when no more initialized ticks AND liquidity = 0
                    break
                }

            } else {
                let amountToken0In = calculateAmount0(priceRangeLiquidity, targetSqrtPrice, currentSqrtPrice)
                let amountToken1Out = calculateAmount1(priceRangeLiquidity, targetSqrtPrice, currentSqrtPrice)
                finalTargetPrice = targetSqrtPrice
                tokenInAmountRemaining = new bn(0)
                totalTokenIn = totalTokenIn.plus(amountToken0In)
                totalTokenOut = totalTokenOut.plus(amountToken1Out)  
            }
        } else {
            console.log("Swapping 1 -> 0")
            console.log(`Higher Tick: ${tickLower.tick}`)

            // Get TARGET PRICE from PRICE CHANGE
            let changeInSqrtP = tokenInAmountRemaining.div(priceRangeLiquidity)
            let targetSqrtPriceX96 = currentSqrtPrice.plus(changeInSqrtP).times(q96)
            finalTargetPrice = targetSqrtPriceX96.div(q96)
            // Check TARGET exceeds TICK BOUNDRY
            let priceExceedsRange = targetSqrtPriceX96.gt(sqrtPriceUpperX96.toString())
            if(priceExceedsRange){
                // Calculate AMOUNT IN | AMOUNT OUT
                let amountToken1In = calculateAmount1(priceRangeLiquidity, sqrtPriceUpperX96.div(q96), currentSqrtPrice)
                let amountToken0Out = calculateAmount0(priceRangeLiquidity, sqrtPriceUpperX96.div(q96), currentSqrtPrice)
                
                // Accumulate TOKENS IN/OUT
                tokenInAmountRemaining = tokenInAmountRemaining.minus(amountToken1In)
                totalTokenOut = totalTokenOut.plus(amountToken0Out)
                totalTokenIn = totalTokenIn.plus(amountToken1In)

                // Get DELTA LIQUIDITY
                let totalDelta = new bn(tickUpper.liquidityDelta)
                console.log(`Active Liquidity: ${priceRangeLiquidity} | Delta Tick Liquidity: ${totalDelta}`)
                
                // ****** When crossing a upper tick range, add. Look at glmr_lp registry and examine delta liquidity.

                // Apply DELTA LIQUIDITY to ACTIVE LIQUIDITY
                priceRangeLiquidity = priceRangeLiquidity.plus(totalDelta)
                
                // Set CURRENT TICK to UPPER TICK
                currentTick = new bn(tickUpper.tick)

                // Check ACTIVE LIQUIDITY
                if(priceRangeLiquidity.eq(0)){
                    console.log("Price range liquidity is 0")
                    break
                }
            } else {
                let amountDotIn = calculateAmount1(priceRangeLiquidity, targetSqrtPriceX96.div(q96), currentSqrtPrice)
                let amountGlmrOut = calculateAmount0(priceRangeLiquidity, targetSqrtPriceX96.div(q96), currentSqrtPrice)
                finalTargetPrice = targetSqrtPriceX96.div(q96)
                tokenInAmountRemaining = new bn(0)
                totalTokenOut = totalTokenOut.plus(amountGlmrOut)
                totalTokenIn = totalTokenIn.plus(amountDotIn)
            }
        }
    }
    let tokenInFormatted = totalTokenIn.div(new bn(10).pow(inputTokenDecimals))
    let tokenOutFormatted = totalTokenOut.div(new bn(10).pow(outputTokenDecimals))
    console.log(`${inputTokenSymbol} in: ${tokenInFormatted} | Total ${outputTokenSymbol} Out: ${tokenOutFormatted}`)

    let calculationResult: V3CalculationResult = {
        inputAmount: totalTokenIn.integerValue(),
        outputAmount: totalTokenOut.integerValue(),
        targetPrice: finalTargetPrice.times(q96).integerValue(),
    }
    return calculationResult

}

export async function calculateUni3Swap(tokenIn: string, tokenOut: string, amountIn: number, contractAddress: string){
    console.log("getUni3Swap")
    let provider = localRpc
    wsProvider
    let rpcProvider = new ethers.JsonRpcProvider(localRpc)
    const pool = await new ethers.Contract(contractAddress, dexAbiMap['uni3'], rpcProvider);
    let token0 = await pool.token0();
    let token1 = await pool.token1();
    let token0Contract = await new ethers.Contract(token0, xcTokenAbi, wsProvider);
    let token1Contract = await new ethers.Contract(token1, xcTokenAbi, wsProvider);
    let token0Symbol = await token0Contract.symbol();
    let token1Symbol = await token1Contract.symbol();
    let token0Decimals = await token0Contract.decimals();
    let token1Decimals = await token1Contract.decimals();
    let activeLiquidity = new bn(await pool.liquidity());
    let tickSpacing = new bn(await pool.tickSpacing());
    // let feeRate = new bn(await pool.fee()).div(1e6)
    let feeRate = new bn(await pool.fee())
    // let feeRate = new bn(fee.div(1e6))


    // let [tickLower, tickUpper] = 
    // let poolInfo: GlobalState = await pool.globalState();
    let poolInfo: Slot0 = await pool.slot0()
    let currentTick =new bn(poolInfo.tick)
    let poolData: MyLp[] = JSON.parse(fs.readFileSync(glmrLpsPath, 'utf8'))
    // console.log(`Searching for contract: ${contractAddress}`)
    let contractData = poolData.find((lp: MyLp) => lp.contractAddress.toLowerCase() == contractAddress.toLowerCase())

    let lowerTicks = contractData.lowerTicks
    let upperTicks = contractData.upperTicks

    // console.log(`Upper ticks: ${JSON.stringify(upperTicks, null, 2)} ) - Lower ticks: ${JSON.stringify(lowerTicks, null, 2)}`)
    let sqrtPriceX96 = new bn(poolInfo.sqrtPriceX96)

    let inputTokenDecimals, outputTokenDecimals, inputTokenSymbol, outputTokenSymbol, inputTokenIndex
    if(token0 == tokenIn){
        inputTokenDecimals = token0Decimals
        inputTokenSymbol = token0Symbol
        outputTokenDecimals = token1Decimals
        outputTokenSymbol = token1Symbol
        inputTokenIndex = 0
    } else {
        inputTokenDecimals = token1Decimals
        inputTokenSymbol = token1Symbol
        outputTokenDecimals = token0Decimals
        outputTokenSymbol = token0Symbol
        inputTokenIndex = 1
    }
    // console.log(`Input Token: ${inputTokenIndex} ${inputTokenSymbol} - Output Token: ${outputTokenSymbol}`)
    let tickLower = lowerTicks[0]
    let tickUpper = upperTicks[0]
    // let [tickLower, tickUpper] = await getUpperLowerInitializedTicks(currentTick, tickSpacing, pool)
    // console.log(`Lower tick: ${tickLower.tick} - Current Tick:  ${currentTick} -Upper tick: ${tickUpper.tick}`)
    let sqrtPriceLowerX96 = TickMath.getSqrtRatioAtTick(tickLower.tick)
    let sqrtPriceUpperX96 = TickMath.getSqrtRatioAtTick(tickUpper.tick)
    // console.log(`Lower sqrt: ${sqrtPriceLowerX96} - Current sqrt: ${sqrtPriceX96} -Upper sqrt: ${sqrtPriceUpperX96}`)

    let totalTokenOut = new bn(0)
    let totalTokenIn = new bn(0)
    let priceRangeLiquidity = activeLiquidity
    let currentSqrtPriceX96 = new bn(sqrtPriceX96)

    // console.log(amountIn)
    // console.log(inputTokenDecimals)
    let tokenInAmountRemaining = new bn(amountIn).times(new bn(10).pow(new bn(inputTokenDecimals)))
    // console.log(tokenInAmountRemaining)
    // console.log(feeRate)
    let feeRatio = feeRate.div(1e6)
    tokenInAmountRemaining = tokenInAmountRemaining.times(new bn(1).minus(feeRatio))
    // console.log(tokenInAmountRemaining)

    let finalTargetPrice;
    let tickRangeIndex = 0
    while(tokenInAmountRemaining.gt(0)){
        // console.log("******************************************************************")
        // console.log(`Token In Amount Remaining: ${tokenInAmountRemaining}`)
        let currentSqrtPrice = currentSqrtPriceX96.div(q96)
        
        if(inputTokenIndex == 0){
            // Swapping 0 -> 1
            let changeInPriceRecipricol = tokenInAmountRemaining.div(priceRangeLiquidity)
            let changeInPrice = new bn(1).div(currentSqrtPrice).plus(changeInPriceRecipricol)
            let targetSqrtPrice = changeInPrice.pow(-1)
            let targetSqrtPriceX96 = targetSqrtPrice.times(q96)
            // console.log(`Target Sqrt P: ${targetSqrtPriceX96} --- Lower Sqrt Price: ${sqrtPriceLowerX96}`)
            

            // console.log(`Target Sqrt P: ${targetSqrtPriceX96} --- Lower Sqrt Price: ${sqrtPriceLowerX96}`)
            let priceExceedsRange = targetSqrtPriceX96.lt(sqrtPriceLowerX96.toString())
            finalTargetPrice = new bn(sqrtPriceLowerX96.toString())
            // console.log("Target Price is less than range: ", priceExceedsRange)
            if(priceExceedsRange){
                let sqrtPriceLowerX96Bn = new bn(sqrtPriceLowerX96.toString())
                let amountToken0In = calculateAmount0(priceRangeLiquidity, sqrtPriceLowerX96Bn.div(q96), currentSqrtPrice)
                let amountToken1Out = calculateAmount1(priceRangeLiquidity, sqrtPriceLowerX96Bn.div(q96), currentSqrtPrice)

                
                tokenInAmountRemaining = tokenInAmountRemaining.minus(amountToken0In)
                totalTokenIn = totalTokenIn.plus(amountToken0In)
                totalTokenOut = totalTokenOut.plus(amountToken1Out)

                // console.log(`Amount of token in: ${amountToken0In}`)
                // console.log(`Amount of token out: ${amountToken1Out}`)

                // console.log(`Queryong tick: ${tickLower.tick}`)
                // let lowerTickData = await pool.ticks(tickLower)

                let totalLiquidity = new bn(tickLower.liquidityDelta)
                priceRangeLiquidity = priceRangeLiquidity.plus(totalLiquidity)

                currentSqrtPriceX96 = new bn(sqrtPriceLowerX96Bn)
                tickRangeIndex++
                tickLower = lowerTicks[tickRangeIndex]
                // tickLower = await getNextLowerInitializedTick(tickLower, tickSpacing, pool)
                // tickLower = new bn(tickLower.minus(tickSpacing))
                sqrtPriceLowerX96 = TickMath.getSqrtRatioAtTick(tickLower.tick)
                
            } else {
                let amountToken0In = calculateAmount0(priceRangeLiquidity, targetSqrtPrice, currentSqrtPrice)
                let amountToken1Out = calculateAmount1(priceRangeLiquidity, targetSqrtPrice, currentSqrtPrice)
                
                // console.log(`Amount of token out: ${amountToken1Out}`)

                // finalTargetPrice = targetSqrtPriceX96
                tokenInAmountRemaining = new bn(0)
                totalTokenIn = totalTokenIn.plus(amountToken0In)
                totalTokenOut = totalTokenOut.plus(amountToken1Out)  
            }
        } else {
            // Swapping 1 -> 0
            let changeInSqrtP = tokenInAmountRemaining.div(priceRangeLiquidity)

            let targetSqrtPriceX96 = currentSqrtPrice.plus(changeInSqrtP).times(q96)
            finalTargetPrice = new bn(sqrtPriceUpperX96.toString())
            if(targetSqrtPriceX96.gt(sqrtPriceUpperX96.toString())){
                let sqrtPriceUpperX96Bn = new bn(sqrtPriceUpperX96.toString())
                let amountToken1In = calculateAmount1(priceRangeLiquidity, sqrtPriceUpperX96Bn.div(q96), currentSqrtPrice)
                let amountToken0Out = calculateAmount0(priceRangeLiquidity, sqrtPriceUpperX96Bn.div(q96), currentSqrtPrice)

                // console.log(`Amount of token out: ${amountToken0Out}`)
                
                
                tokenInAmountRemaining = tokenInAmountRemaining.minus(amountToken1In)
                totalTokenOut = totalTokenOut.plus(amountToken0Out)
                totalTokenIn = totalTokenIn.plus(amountToken1In)

                // let upperTickData = await pool.ticks(tickUpper.toNumber())
                let totalLiquidity = new bn(tickUpper.liquidityDelta)
                priceRangeLiquidity = priceRangeLiquidity.plus(totalLiquidity)
                currentSqrtPriceX96 = new bn(sqrtPriceUpperX96Bn)

                tickRangeIndex++
                tickUpper = upperTicks[tickRangeIndex]
                // tickUpper = await getNextUpperInitializedTick(tickUpper, tickSpacing, pool)
                // tickUpper = new bn(tickUpper.plus(tickSpacing))
                sqrtPriceUpperX96 = TickMath.getSqrtRatioAtTick(tickUpper.tick)
            } else {
                let amountToken1In = calculateAmount1(priceRangeLiquidity, targetSqrtPriceX96.div(q96), currentSqrtPrice)
                let amountToken0Out = calculateAmount0(priceRangeLiquidity, targetSqrtPriceX96.div(q96), currentSqrtPrice)

                // console.log(`Amount of token out: ${amountToken0Out}`)

                // finalTargetPrice = targetSqrtPriceX96
                tokenInAmountRemaining = new bn(0)
                totalTokenOut = totalTokenOut.plus(amountToken0Out)
                totalTokenIn = totalTokenIn.plus(amountToken1In)
            }
        }
    }

    let calculationResult: V3CalculationResult = {
        inputAmount: totalTokenIn.integerValue(),
        outputAmount: totalTokenOut.integerValue(),
        targetPrice: finalTargetPrice.integerValue(),
    }
    let tokenInFormatted = totalTokenIn.div(new bn(10).pow(inputTokenDecimals))
    let tokenOutFormatted = totalTokenOut.div(new bn(10).pow(outputTokenDecimals))
    console.log(`${inputTokenSymbol} in: ${tokenInFormatted} | Total ${outputTokenSymbol} Out: ${tokenOutFormatted}`)     
    
    return calculationResult
}

function calculateAmount0(liq: BigNumber, pa: BigNumber, pb: BigNumber){
    if(pa > pb){
        [pa, pb] = [pb, pa]
    }
    let amount = liq.times(pb.minus(pa).div(pb).div(pa))
    return amount
}

function calculateAmount1(liq: BigNumber, pa: BigNumber, pb: BigNumber){
    if(pa > pb){
        [pa, pb] = [pb, pa]
    }
    let amount = liq.times(pb.minus(pa))
    return amount
}

export function getPoolFeeRate(poolAddress: string): number {
    let poolData: MyLp[] = JSON.parse(fs.readFileSync(glmrLpsPath, 'utf8'))
    let contractData = poolData.find((lp: MyLp) => lp.contractAddress.toLowerCase() == poolAddress.toLowerCase())
    return Number.parseInt(contractData.feeRate)
}

export function getGlmrPoolData(poolAddress: string): MyLp {
    let poolData: MyLp[] = JSON.parse(fs.readFileSync(glmrLpsPath, 'utf8'))
    // console.log(JSON.stringify(poolData, null, 2))
    let contractData = poolData.find((lp: MyLp) => {
        // console.log(`Database contract address: ${lp.contractAddress.toLowerCase()} --- Input contract address: ${poolAddress}`)
        return lp.contractAddress.toLowerCase() == poolAddress.toLowerCase()
    })
    return contractData
}
