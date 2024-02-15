import '@moonbeam-network/api-augment/moonriver'
import { calculateSwapAmountRouterFormula, checkForSubstrateToken, getBestSwapRoute, logBatchContractResults, getContractAbi, checkApproval, getTokenContractData, logDoubleSwapResults, getContractAbiIndex, checkAndApproveToken } from './utils/utils.ts';
import { batchArtifact, batchContractAddress2, boxContractAddress, dexAbis, ignoreList, localRpc, movrContractAbi, movrContractAddress, solarFee, test_account_pk, usdcContractAbi, usdcContractAddress, wmovrUsdcDexAddress, xcKsmContractAddress, zenFee } from './utils/const.ts';
import * as mutex from 'mutexify'
import { ApiPromise, Keyring, WsProvider } from '@polkadot/api';
// import { MangataInstance, Mangata, MultiswapBuyAsset, MultiswapSellAsset } from "@mangata-finance/sdk"
// import { BN } from '@polkadot/util';
import { createPublicClient, http, createWalletClient, formatEther, webSocket, erc20Abi } from 'viem';
import { moonriver } from 'viem/chains';
import { ethers } from 'ethers'
import * as fs from 'fs';
import { WebSocketProvider, Web3} from 'web3'
import { privateKeyToAccount } from 'viem/accounts';
import path from 'path';
// import { contract } from 'web3/lib/commonjs/eth.exports';
import BN from 'bn.js';
import {toBigInt} from 'ethers'
import { BigNumberish } from 'ethers';

import { ErrorData, GenericTx, SwapResultData, TxData } from 'utils/types.ts';
// import __dirname from './dirname.js';


const routerFees = [
    solarFee,
    zenFee
]

async function testBox(){
    const provider = new ethers.JsonRpcProvider(localRpc);
    const wallet = new ethers.Wallet(test_account_pk, provider);

    // Create instance of the Box contract
    const boxArtifact = JSON.parse(fs.readFileSync('./contractArtifacts/Box.json', 'utf8')) as any;
    const boxAbi = boxArtifact.abi;
    const boxBytecode = boxArtifact.bytecode;
    const Box = await new ethers.ContractFactory(boxAbi, boxBytecode, wallet)
    const box = await Box.attach('0x2bdCC0de6bE1f7D2ee689a0342D76F52E8EFABa3') as any;
    
    // Store a new value
    await box.store(3);
    
    // Retrieve the value
    const value = await box.retrieve();
    console.log(`The new value is: ${value}`);
}
async function testBoxContract(){
    const provider = new ethers.JsonRpcProvider(localRpc);
    const wallet = new ethers.Wallet(test_account_pk, provider);

    // Create instance of the Box contract
    const boxArtifact = JSON.parse(fs.readFileSync('./contractArtifacts/Box.json', 'utf8')) as any;
    const boxAbi = boxArtifact.abi;
    const boxContract = await new ethers.Contract(boxContractAddress, boxAbi, wallet)
    
    // Store a new value
    await boxContract.store(4);
    
    // Retrieve the value
    const value = await boxContract.retrieve();
    console.log(`The new value is: ${value}`);
}

async function testBalance(){
    const provider = new ethers.JsonRpcProvider(localRpc);
    const wallet = new ethers.Wallet(test_account_pk, provider);
    const balance = await provider.getBalance("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266")
    console.log(`The balance is: ${balance}`);
}

// async function testBatch(){
//     const provider = new ethers.JsonRpcProvider(localRpc);
//     const walletProvider = new ethers.Wallet(test_account_pk, provider);

//     const solarDexAbi = JSON.parse(fs.readFileSync('./abi/solarDexAbi.json', 'utf8'));


//     const movrTokenContract = new ethers.Contract(movrContractAddress, movrContractAbi, walletProvider)
//     const usdcTokenContract = new ethers.Contract(usdcContractAddress, usdcContractAbi, walletProvider)
//     const movrUsdcDexContract = new ethers.Contract(wmovrUsdcDexAddress,solarDexAbi, walletProvider )
//     const [reserves0, reserves1, timestamp] = await movrUsdcDexContract.getReserves()
//     const amountIn = ethers.parseUnits("0.01", 18);

//     // Create instance of the Box contract
//     const batchArtifact = JSON.parse(fs.readFileSync('./contractArtifacts/Batch.json', 'utf8')) as any;
//     const batchAbi = batchArtifact.abi;
//     const batchContract = await new ethers.Contract(batchContractAddress, batchAbi, walletProvider)

//     const approval = await checkApproval(movrTokenContract, walletProvider.address, batchContractAddress)
//     if(!approval){
//         console.log("Approving tokens")
//         const approveResults = await movrTokenContract.approve(batchContractAddress, ethers.MaxUint256)
//         const approveReceipt = await approveResults.wait()
//         // console.log(JSON.stringify(approveReceipt, null, 2))
//     }
//     const movrBalance = await movrTokenContract.balanceOf(walletProvider.address)
//     const dexMovrBalance = await movrTokenContract.balanceOf(wmovrUsdcDexAddress)
//     const usdcBalance = await usdcTokenContract.balanceOf(walletProvider.address)
//     const dexUsdcBalance = await usdcTokenContract.balanceOf(wmovrUsdcDexAddress)
//     console.log(`Wallet Address: ${walletProvider.address} Movr Balance: ${movrBalance} Usdc Balance: ${usdcBalance}`)
//     console.log(`Dex Address: ${wmovrUsdcDexAddress} Movr Balance: ${dexMovrBalance} Usdc Balance: ${dexUsdcBalance}`)

//     // let txResults = await batchContract.transferToken(movrContractAddress,wmovrUsdcDexAddress, amountIn)
//     // let txReceipt = await txResults.wait()




//     const amountOutMin = calculateSwapAmountRouterFormula(amountIn, reserves0, reserves1, 100, 25)
//     const amount0Out = 0;
//     const amount1Out = amountOutMin;
//     const to = walletProvider.address;
//     const data = '0x'
    

//     const swapFunction = "swap(uint, uint, address, bytes)"; // Replace with actual function
//     const swapParams = [
//         amount0Out, // Amount out token 0
//         amount1Out, // Amount out token 1
//         to, // Recipient address
//         data // Transaction deadline
//     ];
//     const swapCallData = movrUsdcDexContract.interface.encodeFunctionData(swapFunction, swapParams);



//     let batchTx = await batchContract.transferAndSwap(movrContractAddress, wmovrUsdcDexAddress, amountIn, swapCallData)
//     let batchReceipt = await batchTx.wait()

//     const movrBalanceAfter = await movrTokenContract.balanceOf(walletProvider.address)
//     const dexBalanceAfter = await movrTokenContract.balanceOf(wmovrUsdcDexAddress)
//     const usdcBalanceAfter = await usdcTokenContract.balanceOf(walletProvider.address)
//     const dexUsdcBalanceAfter = await usdcTokenContract.balanceOf(wmovrUsdcDexAddress)
//     console.log(`Wallet Address: ${walletProvider.address} Movr Balance: ${movrBalanceAfter} Usdc Balance: ${usdcBalanceAfter}`)
//     console.log(`Dex Address: ${wmovrUsdcDexAddress} Movr Balance: ${dexBalanceAfter} Usdc Balance: ${dexUsdcBalanceAfter}`)


// }
async function allMovrPoolsBatchContract(){
    // clearBatchResults()
    let wallets = JSON.parse(fs.readFileSync('./wallets.json', 'utf8'));
    const loggingProvider = new ethers.JsonRpcProvider(localRpc);
    let walletProviders = wallets.map((wallet: any) => {
        return new ethers.Wallet(wallet.private_key, loggingProvider)
    })

    const allLps = JSON.parse(fs.readFileSync('./lpsCleaned.json', 'utf8'));
    let movrLps = allLps.filter((lp: any) => lp.poolAssets[0] == "MOVR" || lp.poolAssets[1] == "MOVR")

    movrLps = movrLps.filter((lp: any) =>{
        if(checkForSubstrateToken(lp.poolAssets[0]) || checkForSubstrateToken(lp.poolAssets[1])){
            return false
        }
        return true
    })
    movrLps = movrLps.filter((lp: any) => {
        return !ignoreList.includes(lp.contractAddress);
    });
    // let nonce = await wallet.getNonce() 
    let transactions = []
    let walletIndex = 0
    for(const lp of movrLps){
        let wallet = walletProviders[walletIndex]
        // let nonce;
        let latestNonce = await wallet.getNonce();
        transactions.forEach((tx, index) => {
            // let [tx0, tx1] = txPair
            if(tx.walletIndex == walletIndex && latestNonce <= tx.nonce){
                latestNonce = tx.nonce + 1;
            }
        })
        let contractSwapTx = {
            type: "contractSwap",
            to: lp.contractAddress,
            wallet: wallet,
            walletIndex: walletIndex,
            nonce: latestNonce
        }
        transactions.push(contractSwapTx)
        walletIndex < walletProviders.length - 1 ? walletIndex++ : walletIndex = 0
    }

    let batchResults = await executeBatchContractTransactions(transactions)
    console.log("MOVR LPS LENGTH", movrLps.length)
    console.log("TRANSACTIONS LENGTH", transactions.length)
    const results = JSON.parse(fs.readFileSync('./batchResults/batch_contract_results.json', 'utf8'));
    console.log("RESULTS FILE LENGTH", results.length)
    console.log("BatchResults Length ", batchResults.length)
}
const acquireMutex = mutex.default();
async function executeBatchContractTransactions(transactions: GenericTx[], slippage = 100, batchSize = 20){
    const provider = new ethers.JsonRpcProvider(localRpc);
    const wallet = new ethers.Wallet(test_account_pk, provider);

    let wmovrContractAbi = JSON.parse(fs.readFileSync('./../movrContract.json', 'utf8'));
    let inputMovrAmount = ethers.parseUnits("0.01", 18)
    
    
    let txResults = []
    for (let i = 0; i < transactions.length; i += batchSize){
        
        const transactionBatch = transactions.slice(i, i + batchSize);
        transactionBatch.forEach((tx, index) => {
            console.log("Tx Index", index + i)
            // console.log(JSON.stringify(tx, null, 2))
        })
        const batchPromises = transactionBatch.map(async (tx, index) => {
            
            
            let wallet = tx.wallet
            const walletIndex = tx.walletIndex
            let wmovrToken = new ethers.Contract(movrContractAddress, wmovrContractAbi, wallet);
            const batchArtifact = JSON.parse(fs.readFileSync('./contractArtifacts/Batch.json', 'utf8')) as any;
            const batchAbi = batchArtifact.abi;
            const txAbiIndex = getContractAbiIndex(tx.to)
            const txAbi = dexAbis[txAbiIndex]

            let resultDefault = {
                success: false,
                wallet: wallet.address,
                walletIndex: tx.walletIndex,
                nonce: tx.nonce,
                contractAddress: tx.to,
                inTokenSymbol: null,
                outTokenSymbol: null,
                token0Address: null,
                token1Address: null,
                abiIndex: txAbiIndex,
                slippage: slippage,
                movrBefore: null,
                movrAfter: null,
                movrDifference: null,
                otherTokenBefore: null,
                otherTokenAfter: null,
                otherTokenDifference: null,
                calculatedAmountOut: null,
                swapTxReceipt: null,
                failureReason: "Default"
            }
            let defaultError = {
                wallet: wallet.address,
                walletIndex: tx.walletIndex,
                nonce: tx.nonce,
                contractAddress: tx.to,
                inTokenSymbol: null,
                outTokenSymbol: null,
                abiIndex: txAbiIndex,
                error: null
            }

            const batchContract = await new ethers.Contract(batchContractAddress2, batchAbi, wallet)

            
            resultDefault.failureReason = "Dex contract instantiation"
            let dexContract, reserves0, reserves1, timestamp;

            // Get dex contract
            try{
                dexContract = await new ethers.Contract(tx.to, txAbi, wallet);
                resultDefault.failureReason = "Dex contract get reserves";
                [reserves0, reserves1, timestamp] = await dexContract.getReserves()
                // console.log(reserves0)
            } catch (e){
                defaultError.error = e
                await logBatchContractResults(resultDefault, acquireMutex, defaultError)
                return resultDefault
            }
            const token0 = await dexContract.token0()
            const token1 = await dexContract.token1()
            resultDefault.token0Address = token0
            resultDefault.token1Address = token1
            const erc20Abi = JSON.parse(fs.readFileSync('./abi/usdcContractAbi.json', 'utf8'))
            const outTokenAddress = token0 == movrContractAddress ? token1 : token0
            let outTokenContract, outTokenSymbol;

            // Get out token contract
            try{
                outTokenContract = new ethers.Contract(outTokenAddress, erc20Abi, wallet);
                outTokenSymbol = await outTokenContract.symbol()
                resultDefault.outTokenSymbol = outTokenSymbol
                defaultError.outTokenSymbol = outTokenSymbol
                resultDefault.inTokenSymbol = "MOVR"
                defaultError.inTokenSymbol = "MOVR"
            } catch(e){
                resultDefault.failureReason = "Out token contract instantiation"
                defaultError.error = e
                console.log(e)
                await logBatchContractResults(resultDefault, acquireMutex, defaultError)
                return resultDefault
            }

           
            // console.log(`EXECUTING SWAP (${tx.walletIndex}) ${tx.nonce}:: MOVR -- ${outTokenSymbol} Dex: ${tx.to}`)

            let movrBalanceBefore = await wmovrToken.balanceOf(wallet.address)
            let outTokenBalanceBefore = await outTokenContract.balanceOf(wallet.address)
            resultDefault.movrBefore = movrBalanceBefore
            resultDefault.otherTokenBefore = outTokenBalanceBefore
            
            // Approving batch contract to use input movr amounr
            try{
                let approved = await checkApproval(wmovrToken, wallet.address, batchContractAddress2)
                if(!approved){
                    // console.log("Approving tokens")
                    // console.log(`(${tx.walletIndex}) APPROVED: FALSE`)
                    const approveResults = await wmovrToken.approve(batchContractAddress2, inputMovrAmount)
                    const approveReceipt = await approveResults.wait()
                    transactions.forEach((transaction, index) => {
                        if(transaction.walletIndex == walletIndex ){
                            transaction.nonce = transaction.nonce + 1;
                        }
                    })
                } else {
                    // console.log(`(${tx.walletIndex}) APPROVED: TRUE`)
                }

            } catch (e){
                resultDefault.failureReason = "Approval failed"
                defaultError.error = e
                await logBatchContractResults(resultDefault, acquireMutex, defaultError)
                return resultDefault
            }
            
            // Swap with specified ABI parameters
            let calculatedAmountOut;
            let swapTx;
            try{
                if(txAbiIndex == 0){
                    // console.log(`(${tx.walletIndex}) Solar Dex`)
                    if(token0 == movrContractAddress){
                        // console.log("Token 0 is movr")
                        calculatedAmountOut = calculateSwapAmountRouterFormula(inputMovrAmount, reserves0, reserves1, slippage, 25)
                        const swapParams = [0, calculatedAmountOut, wallet.address, '0x'];
                        const swapFunction = "swap(uint, uint, address, bytes)";
                        const swapCallData = dexContract.interface.encodeFunctionData(swapFunction, swapParams);
                        swapTx = await batchContract.transferAndSwap(movrContractAddress, outTokenContract, tx.to, inputMovrAmount, swapCallData, calculatedAmountOut, {nonce: tx.nonce})
                    } else {
                        // console.log("Token 1 is movr")
                        calculatedAmountOut = calculateSwapAmountRouterFormula(inputMovrAmount, reserves1, reserves0, slippage, 25)
                        const swapParams = [calculatedAmountOut, 0, wallet.address, '0x'];
                        const swapFunction = "swap(uint, uint, address, bytes)";
                        const swapCallData = dexContract.interface.encodeFunctionData(swapFunction, swapParams);
                        swapTx = await batchContract.transferAndSwap(movrContractAddress, outTokenContract, tx.to, inputMovrAmount, swapCallData, calculatedAmountOut, {nonce: tx.nonce})
                    }
                    
                } else if (txAbiIndex == 1){
                    // console.log(`(${tx.walletIndex}) Zenlink Dex`)
                    if(token0 == movrContractAddress){
                        calculatedAmountOut = calculateSwapAmountRouterFormula(inputMovrAmount, reserves0, reserves1, slippage, 30)
                        const swapParams = [0, calculatedAmountOut, wallet.address];
                        const swapFunction = "swap(uint, uint, address)";
                        const swapCallData = dexContract.interface.encodeFunctionData(swapFunction, swapParams);
                        swapTx = await batchContract.transferAndSwap(movrContractAddress, outTokenContract, tx.to, inputMovrAmount, swapCallData, calculatedAmountOut, {nonce: tx.nonce})
                    } else {
                        calculatedAmountOut = calculateSwapAmountRouterFormula(inputMovrAmount, reserves1, reserves0, slippage, 30)
                        const swapParams = [calculatedAmountOut, 0, wallet.address];
                        const swapFunction = "swap(uint, uint, address)";
                        const swapCallData = dexContract.interface.encodeFunctionData(swapFunction, swapParams);
                        swapTx = await batchContract.transferAndSwap(movrContractAddress, outTokenContract, tx.to, inputMovrAmount, swapCallData, calculatedAmountOut, {nonce: tx.nonce})
                    }
                    
                } else if (txAbiIndex == 2){
                    // throw new Error("Huckleberry Dex Abi (2) not implemented")
                    resultDefault.failureReason = "Huckleberry Dex Abi (2) not implemented"
                    await logBatchContractResults(resultDefault, acquireMutex, defaultError)
                    return resultDefault
                }
            } catch (e){
                resultDefault.failureReason = "Swap failed"
                defaultError.error = e
                transactions.forEach((transaction, index) => {
                    if(transaction.walletIndex == walletIndex ){
                        transaction.nonce = transaction.nonce - 1;
                    }
                })
                await logBatchContractResults(resultDefault, acquireMutex, defaultError)
                return resultDefault
            }
            
            let swapTxReceipt = await swapTx.wait()
            let movrBalanceAfter = await wmovrToken.balanceOf(wallet.address)
            let outTokenBalanceAfter = await outTokenContract.balanceOf(wallet.address)
            // console.log(`BALANCES (${tx.walletIndex}) ${movrBalanceBefore} --- ${outTokenBalanceBefore} 
            // POST BALANCES: (${tx.walletIndex}) ${movrBalanceAfter} --- ${outTokenBalanceAfter} 
            // SUCCESS 
            // ---------------------------------------`)
            // console.log(`POST BALANCES: (${tx.walletIndex}) ${movrBalanceAfter} --- ${outTokenBalanceAfter}`)
            // console.log("SUCCESS")
            // console.log("---------------------------------------")

            
            resultDefault.movrAfter = movrBalanceAfter
            resultDefault.otherTokenAfter = outTokenBalanceAfter
            resultDefault.calculatedAmountOut = calculatedAmountOut
            resultDefault.swapTxReceipt = swapTxReceipt
            resultDefault.failureReason = null

            const movrBalanceDifference = movrBalanceBefore - movrBalanceAfter
            const outTokenBalanceDifference = outTokenBalanceAfter - outTokenBalanceBefore
            resultDefault.movrDifference = movrBalanceDifference
            resultDefault.otherTokenDifference = outTokenBalanceDifference
            if (resultDefault.otherTokenDifference < calculatedAmountOut){
                resultDefault.failureReason = "Out token difference is less than calculated amount out"
                defaultError.error = "Out token difference is less than calculated amount out"
                await logBatchContractResults(resultDefault, acquireMutex, defaultError)
                return resultDefault
            }


            // if(outTokenBalanceDifference != calculatedAmountOut){
            //     resultDefault.failureReason = "Movr balance difference does not match calculated amount out"
            //     defaultError.error = "Movr balance difference does not match calculated amount out"
            //     await logBatchContractResults(resultDefault, acquireMutex, defaultError)
            //     return resultDefault
            // }
            resultDefault.success = true
            
            

            // console.log("LOGGING RESULTS")
            await logBatchContractResults(resultDefault, acquireMutex)
            
            return resultDefault
        })

        const batchResults = await Promise.all(batchPromises)
        batchResults.forEach((result, index) => {
            txResults.push(result)
        })
        // txResults
    }

    console.log("TxResults Length", txResults.length)
    return txResults


}

async function executeBatchTransactions(transactions: GenericTx[], batchSize = 10){

}
async function swapTokensForMovr(){
    // clearBatchResults()
    let wallets = JSON.parse(fs.readFileSync('./wallets.json', 'utf8'));
    const loggingProvider = new ethers.JsonRpcProvider(localRpc);
    let walletProviders = wallets.map((wallet: any) => {
        return new ethers.Wallet(wallet.private_key, loggingProvider)
    })

    let allLps = JSON.parse(fs.readFileSync('./lpsCleaned.json', 'utf8'));
    let movrLps = allLps.filter((lp: any) => lp.poolAssets[0] == "MOVR" || lp.poolAssets[1] == "MOVR")

    movrLps = movrLps.filter((lp: any) =>{
        if(checkForSubstrateToken(lp.poolAssets[0]) || checkForSubstrateToken(lp.poolAssets[1])){
            return false
        }
        return true
    })
    movrLps = movrLps.filter((lp: any) => {
        return !ignoreList.includes(lp.contractAddress);
    });
    // let nonce = await wallet.getNonce() 
    let transactions = []
    let walletIndex = 0
    // walletProviders = walletProviders.slice(0, 1)
    // TEST FAILED ADDRESSES
    // let failedDexAddresses = getSwapFailures()
    // failedDexAddresses.filter((failedDexAddress: any) => {
    //     return !ignoreList.includes(failedDexAddress.contractAddress);
    // })
    // console.log("Failed Dex Addresses Length", JSON.stringify(failedDexAddresses))
    // for(const lp of failedDexAddresses){
    for(const lp of movrLps){
        let wallet = walletProviders[walletIndex]
        // let nonce;
        let latestNonce = await wallet.getNonce();
        transactions.forEach((tx, index) => {
            if(tx.walletIndex == walletIndex && latestNonce <= tx.nonce){
                latestNonce = tx.nonce + 1;
            }
        })
        let contractSwapTx = {
            type: "contractSwap",
            to: lp.contractAddress,
            wallet: wallet,
            walletIndex: walletIndex,
            nonce: latestNonce
        }
        transactions.push(contractSwapTx)
        walletIndex < walletProviders.length - 1 ? walletIndex++ : walletIndex = 0
    }
    console.log(JSON.stringify(transactions, null, 2))
    let batchResults = await executeDoubleSwaps(transactions)
}
function getSwapFailures(){
    const resultData = JSON.parse(fs.readFileSync('./batchResults/double_swap_results.json', 'utf8'));
    let failedDexAddresses = []
    resultData.forEach((result: any) => {
        if(result.success == false){
            // console.log(result)
            let contractSwapTx = {
                contractAddress: result.contractAddress,
            }
            failedDexAddresses.push(contractSwapTx)
        }
    })
    return failedDexAddresses
}
async function executeSwapOne(tx, wallet, tokenIn, tokenOut, token0, token1, txAbi, txAbiIndex, inputAmount, slippage, transactions): Promise<SwapResultData>{
    let transactionData: TxData = {
        success: false,
        wallet: wallet.address,
        walletIndex: tx.walletIndex,
        tokenIn: tokenIn,
        tokenOut: tokenOut,
        nonce: tx.nonce,
        contractAddress: tx.to,
        token0: token0,
        token1: token1,
        abiIndex: txAbiIndex,
        slippage: slippage,
        failureStatus: "None",
        swapData: null,
        swapTxReceipt: null
    }
    let errorData: ErrorData = {
        wallet: wallet.address,
        walletIndex: tx.walletIndex,
        nonce: tx.nonce,
        contractAddress: tx.to,
        tokenIn: tokenIn,
        tokenOut: tokenOut,
        inTokenSymbol: null,
        outTokenSymbol: null,
        abiIndex: txAbiIndex,
        error: null
    }
    let resultData: SwapResultData = {
        transactionData: transactionData,
        errorData: errorData
    }
    let tokenInContract, tokenInContractAbi, tokenInBalanceBefore;

    const nativeMovrBalance = await wallet.provider.getBalance(wallet.address)
    if(tokenIn == movrContractAddress){
        
        tokenInContract = await new ethers.Contract(movrContractAddress, movrContractAbi, wallet)
        tokenInBalanceBefore = await tokenInContract.balanceOf(wallet.address)

        // Make sure we have enough movr or wrapped movr
        if(tokenInBalanceBefore < inputAmount && nativeMovrBalance < inputAmount ){
            throw new Error("Not enough movr to swap")
        }

        // Wrap movr if we have native movr
        if(tokenInBalanceBefore < inputAmount && nativeMovrBalance > inputAmount ){
            // console.log(`Wrapping ${inputMovrAmount} movr`)
            await wrapMovr(wallet, inputAmount)
            transactions.forEach((transaction, index) => {
                if(transaction.walletIndex == tx.walletIndex ){
                    transaction.nonce = transaction.nonce + 1;
                }
            })
        }
    } else{
        tokenInContract = await new ethers.Contract(tokenIn, erc20Abi, wallet)
        tokenInBalanceBefore = await tokenInContract.balanceOf(wallet.address)

        // Make sure we have enough tokenIn
        if(tokenInBalanceBefore < inputAmount){
            throw new Error(`Not enough ${tokenIn} to swap`)
        }
    }

    
    // Approving batch contract to use input movr amounr
    try{
        let approved = await checkAndApproveToken(tokenIn, wallet, batchContractAddress2, inputAmount)

        // Approved means we had to approve the token
        if(approved == true){
            transactions.forEach((transaction, index) => {
                if(transaction.walletIndex == tx.walletIndex ){
                    transaction.nonce = transaction.nonce + 1;
                }
            })
        }
    } catch (e){
        transactionData.failureStatus = "Approval failed"
        errorData.error = e
        console.log("Approval failed")
        console.log(e)
        await logDoubleSwapResults(transactionData, acquireMutex, errorData)
        return resultData
    }


    // Swap with specified ABI parameters
    let swapTxData: SwapData
    let swapTxReceipt;
    let currentNonceDynamic = await wallet.getNonce()
    let swapIndex;
    if(tokenIn == movrContractAddress){
        swapIndex = 1;
    }else{
        swapIndex = 2;
    }
    console.log(`SWAP ${swapIndex}: Contract: ${tx.to} In: ${tokenIn} -> Out: ${tokenOut} `)
    // let swapResult;
    try{
        transactionData.failureStatus = "Executing swap"
        let swapResult = await swapAForB(tokenIn, tokenOut, tx.to, inputAmount, wallet, currentNonceDynamic, 100)
        swapTxData = swapResult[0]
        swapTxReceipt = swapResult[1]
    } catch (e){
        console.error(`SWAP failed. Contract: ${tx.to}`)
        console.error("Initial swap attempt failed, retrying in 2 seconds:", e);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for 2 seconds
        transactions.forEach((transaction, index) => {
            if(transaction.walletIndex == tx.walletIndex ){
                transaction.nonce = transaction.nonce - 1;
            }
        })
        try {
            currentNonceDynamic = await wallet.getNonce()
            transactionData.failureStatus = "Executing swap"
            let swapResult = await swapAForB(tokenIn, tokenOut, tx.to, inputAmount, wallet, currentNonceDynamic, 200)
            swapTxData = swapResult[0]
            swapTxReceipt = swapResult[1]
        } catch (e) {
            console.error(`SWAP failed FINAL. Contract: ${tx.to}`)
            transactionData.failureStatus = "Swap failed"
            errorData.error = e
            console.log("Swap failed")
            console.log(e)
            transactions.forEach((transaction, index) => {
                if(transaction.walletIndex == tx.walletIndex ){
                    transaction.nonce = transaction.nonce - 1;
                }
            })
            await logDoubleSwapResults(transactionData, acquireMutex, errorData)
            return resultData
        }
    }

    if(swapTxData){
        transactionData.swapData = swapTxData
        transactionData.swapTxReceipt = swapTxReceipt
        const tokenInBalanceChange = swapTxData.tokenInBalanceBefore - swapTxData.tokenInBalanceAfter
        const tokenOutBalanceChange = swapTxData.tokenOutBalanceAfter - swapTxData.tokenOutBalanceBefore
        if(tokenInBalanceChange == inputAmount && tokenOutBalanceChange >= swapTxData.calculatedAmountOut && tokenOutBalanceChange > 0){
            transactionData.success = true
            console.log(`SWAP ${swapIndex} SUCCESS`)
            // Add 1 to nonce for next transaction and execute other token swap
            transactions.forEach((transaction, index) => {
               if(transaction.walletIndex == tx.walletIndex ){
                   transaction.nonce = transaction.nonce + 1;
               }
           })
           await logDoubleSwapResults(transactionData, acquireMutex)
           return resultData
        } else {
            transactionData.failureStatus = "Swap executed but Token output does not match"
            errorData.error = "Token balance change does not match calculated amount out"
            console.log("Swap executed but Token output does not match")
            await logDoubleSwapResults(transactionData, acquireMutex, errorData)
            return resultData
        }
    }
    transactionData.failureStatus = "Swap executed but swapTxData is null"
    errorData.error = "Swap executed but swapTxData is null"
    return resultData


}

async function executeDoubleSwaps(transactions, batchSize = 20, slippage = 100){
    const provider = new LoggingProvider(localRpc);
    const wallet = new ethers.Wallet(test_account_pk, provider);

    let wmovrContractAbi = JSON.parse(fs.readFileSync('./../movrContract.json', 'utf8'));
    let inputMovrAmount = ethers.parseUnits("0.6", 18)

    let txResults = []
    for (let i = 1; i < transactions.length; i += batchSize){
        
        const transactionBatch = transactions.slice(i, i + batchSize);
        transactionBatch.forEach((tx, index) => { 
            console.log("Tx Index", index + i)
            console.log(JSON.stringify(tx, null, 2))
        })
        const batchPromises = transactionBatch.map(async (tx, index) => {
            let wallet = tx.wallet
            const walletIndex = tx.walletIndex
            const txAbiIndex = getContractAbiIndex(tx.to)
            const txAbi = dexAbis[txAbiIndex]
            let dexContract, reserves0, reserves1, timestamp, token0, token1, failureStatus, error;

            // Get dex contract
            // transactionData.failureStatus = "Instantiating dex contract"
            try{
                dexContract = await new ethers.Contract(tx.to, txAbi, wallet);
                [reserves0, reserves1, timestamp] = await dexContract.getReserves()
                token0 = await dexContract.token0()
                token1 = await dexContract.token1()
                
            } catch (e){
                error = e;
                failureStatus = "Failed to instantiating batch contract";
                console.log("Failed to instantiate dex contract")
                console.log(e)

                throw new Error(e)
            }
            const tokenInOne = token0 == movrContractAddress ? token0 : token1
            const tokenOutOne = token0 == movrContractAddress ? token1 : token0
            

            // Start swap one function here
            let txDataOne = await executeSwapOne(tx, wallet, tokenInOne, tokenOutOne, token0, token1, txAbi, txAbiIndex, inputMovrAmount, slippage, transactions);

            const tokenInTwo = tokenOutOne
            const tokenOutTwo = tokenInOne

            let tokenTwoInput;
            if(txDataOne.transactionData.success == true){
                tokenTwoInput = txDataOne.transactionData.swapData.tokenOutBalanceChange
            } else {
                const tokenTwoContract = await new ethers.Contract(tokenInTwo, erc20Abi, wallet)
                const tokenTwoDecimals = await tokenTwoContract.decimals()
                tokenTwoInput = ethers.parseUnits("1", tokenTwoDecimals)
            }
            // let tokenTwoInput = txDataOne.transactionData.swapData.tokenOutBalanceChange

            let txDataTwo = await executeSwapOne(tx, wallet, tokenInTwo, tokenOutTwo, token0, token1, txAbi, txAbiIndex, tokenTwoInput, slippage, transactions)

            
        })

        

        const batchResults = await Promise.all(batchPromises)
        batchResults.forEach((result, index) => {
            txResults.push(result)
        })
        // txResults
    }

    console.log("TxResults Length", txResults.length)
    return txResults
}

async function executeSwaps(){

}

async function logDoubleSwap(){

}
interface SwapData {
    swapTx: any,
    calculatedAmountOut: bigint,
    dexAddress: string,
    tokenIn: string,
    tokenInSymbol: string,
    tokenInBalanceBefore: bigint,
    tokenInBalanceAfter: bigint,
    tokenInBalanceChange: bigint,
    tokenOut: string,
    tokenOutSymbol: string,
    tokenOutBalanceBefore: bigint,
    tokenOutBalanceAfter: bigint,
    tokenOutBalanceChange: bigint,
    // swapTxReceipt?: any
}
async function swapAForB(tokenInContract: string, tokenOutContract:string, dexAddress:string, inputAmount: bigint, wallet: ethers.Wallet, inputNonce: any, slippage = 100): Promise<[SwapData, any]>{

    const tokenAData = await getTokenContractData(tokenInContract, wallet.address)
    const tokenBData = await getTokenContractData(tokenOutContract, wallet.address)

    
    // const [dexAddress, calculatedOutput] = await getBestSwapRoute(tokenAContract, tokenBContract, inputAmount)

    // let dexAddress

    const dexAbiIndex = getContractAbiIndex(dexAddress.toString())
    const dexAbi = dexAbis[dexAbiIndex]

    let dexContract = new ethers.Contract(dexAddress.toString(), dexAbi, wallet);
    let reserves0, reserves1, timestamp;
    let token0, token1, symbol0, symbol1, tokenInIndex, token0In, token1In;
    
    let tokenInReserves: bigint, tokenOutReserves: bigint;
    try{
        [reserves0, reserves1, timestamp] = await dexContract.getReserves()
        token0 = await dexContract.token0()
        token1 = await dexContract.token1()
        if(token0 == tokenInContract){
            tokenInReserves = reserves0;
            tokenOutReserves = reserves1;
            tokenInIndex = 0;
            token0In = inputAmount;
            token1In = 0;
        } else {
            tokenInReserves = reserves1;
            tokenOutReserves = reserves0;
            tokenInIndex = 1;
            token0In = 0;
            token1In = inputAmount;
        }

    } catch (e){
        throw new Error("Dex contract failed getting reserves or tokens")
    }

    const batchContract = await new ethers.Contract(batchContractAddress2, batchArtifact.abi, wallet)
    let calculatedAmountOut, swapParams, swapFunction, swapCallData, swapTx;
    if(dexAbiIndex == 0){
        if(tokenInContract == token0){
            calculatedAmountOut = calculateSwapAmountRouterFormula(inputAmount, tokenInReserves, tokenOutReserves, slippage, 25) 
            swapParams = [0, calculatedAmountOut, wallet.address, '0x'];
            
        } else {
            calculatedAmountOut = calculateSwapAmountRouterFormula(inputAmount, tokenInReserves, tokenOutReserves, slippage, 25)
            swapParams = [calculatedAmountOut, 0, wallet.address, '0x'];
        }

        swapFunction = "swap(uint, uint, address, bytes)";
        swapCallData = dexContract.interface.encodeFunctionData(swapFunction, swapParams);
        
        
    } else if (dexAbiIndex == 1){
        if(tokenInContract == token0){
            calculatedAmountOut = calculateSwapAmountRouterFormula(inputAmount, tokenInReserves, tokenOutReserves, slippage, 30)
            swapParams = [0, calculatedAmountOut, wallet.address];
            
        } else {
            calculatedAmountOut = calculateSwapAmountRouterFormula(inputAmount, tokenInReserves, tokenOutReserves, slippage, 30)
            swapParams = [calculatedAmountOut, 0, wallet.address];
            
        }
        swapFunction = "swap(uint, uint, address)";
        swapCallData = dexContract.interface.encodeFunctionData(swapFunction, swapParams);
    } else if (dexAbiIndex == 2){
        console.log("WRONG ABI INDEX")
        throw new Error("Huckleberry Dex Abi (2) not implemented")
    }
    const amount0Out: bigint = swapParams[0]
    const amount1Out: bigint = swapParams[1]
    const to: string = swapParams[2]
    const data: string = swapParams[3]

    try{
        console.log("Executing batch swap contract")
        if(dexAbiIndex == 0){
            swapTx = await batchContract.transferAndSwapHigh(tokenInContract, tokenOutContract, dexAddress, inputAmount, calculatedAmountOut, amount0Out, amount1Out, to, data, {nonce: inputNonce})
    
        } else if (dexAbiIndex == 1){
            swapTx = await batchContract.zenlinkTransferAndSwap(tokenInContract, tokenOutContract, dexAddress, inputAmount, calculatedAmountOut, token0In, token1In, amount0Out, amount1Out, to, reserves0, reserves1, {nonce: inputNonce})
        }
    } catch (e) {
        // console.log(dexAddress)\
        console.log(`Token A: ${tokenInContract} Token B: ${tokenOutContract} Dex Address: ${dexAddress} Input Amount: ${inputAmount} Calculated Amount Out: ${calculatedAmountOut} Amount 0 Out: ${amount0Out} Amount 1 Out: ${amount1Out} To: ${to} Data: ${data}`)
        console.log("EEEEEEEEEEEEEEEEEEEEEEEEE")
        console.log(e)
        throw new Error(e)
    }
    // console.log("Swap tx: ", swapTx)
    const swapTxReceipt = await swapTx.wait()
    // console.log(swapTxReceipt)
    const tokenADataAfter = await getTokenContractData(tokenInContract, wallet.address)
    const tokenBDataAfter = await getTokenContractData(tokenOutContract, wallet.address)

    const tokenInBalanceChange = tokenAData.tokenBalance - tokenADataAfter.tokenBalance
    const tokenOutBalanceChange = tokenBDataAfter.tokenBalance - tokenBData.tokenBalance

    let swapData: SwapData = {
        swapTx: swapTx,
        calculatedAmountOut: calculatedAmountOut,
        dexAddress: dexAddress.toString(),
        tokenIn: tokenInContract,
        tokenInSymbol: tokenAData.symbol,
        tokenInBalanceBefore: tokenAData.tokenBalance,
        tokenInBalanceAfter: tokenADataAfter.tokenBalance,
        tokenOut: tokenOutContract,
        tokenOutSymbol: tokenBData.symbol,
        tokenOutBalanceBefore: tokenBData.tokenBalance,
        tokenOutBalanceAfter: tokenBDataAfter.tokenBalance,
        tokenInBalanceChange: tokenInBalanceChange,
        tokenOutBalanceChange: tokenOutBalanceChange,
        // swapTxReceipt: swapTxReceipt
    }
    return [swapData, swapTxReceipt]
}

async function testZenDex(){
    let provider = new ethers.JsonRpcProvider(localRpc);
    let wallets = JSON.parse(fs.readFileSync('./wallets.json', 'utf8'));
    let walletProviders = wallets.map((wallet: any) => {
        return new ethers.Wallet(wallet.private_key, provider)
    })
    // let wallet = new ethers.Wallet(test_account_pk, provider);
    const wallet = walletProviders[0]
    const movrEthDex = "0x92b8ccdcd31a3343e77d6f9e717a43d12a2ec7a6";
    const movrEthDexAbi = dexAbis[1];
    const dexContract = await new ethers.Contract(movrEthDex, movrEthDexAbi, wallet);
    const batchContract = await new ethers.Contract(batchContractAddress2, batchArtifact.abi, wallet)

    const [reserves0, reserves1, timestamp] = await dexContract.getReserves()
    console.log(`Reserves0: ${reserves0} Reserves1: ${reserves1} Time: ${timestamp}`)
    const token0 = await dexContract.token0()
    const token1 = await dexContract.token1()
    const token0Contract = await new ethers.Contract(token0, erc20Abi, wallet);
    const token1Contract = await new ethers.Contract(token1, erc20Abi, wallet);
    const wmovrBalance = await token1Contract.balanceOf(wallet.address)
    const ethBalance = await token0Contract.balanceOf(wallet.address)
    let inputEthAmount: bigint = BigInt(5970043798704150)
    console.log(`ETH Balance: ${ethBalance}`)
    console.log(`Wmovr Balance: ${wmovrBalance}`)

    if(inputEthAmount > ethBalance){
        throw new Error("Not enough eth to swap")
    }

    const calculatedAmountOut = calculateSwapAmountRouterFormula(inputEthAmount, reserves0, reserves1, 100, 30)
    await checkAndApproveToken(token0, wallet, movrEthDex, inputEthAmount)
    await checkAndApproveToken(token0, wallet, batchContractAddress2, inputEthAmount)
    const swapParams = [0, calculatedAmountOut, wallet.address];

    const dexBalanceEth = await token0Contract.balanceOf(movrEthDex)
    const dexBalanceWmovr = await token1Contract.balanceOf(movrEthDex)

    // let transferTx = await token0Contract.transfer(movrEthDex, inputEthAmount)
    // let transferTxReceipt = await transferTx.wait()

    // const dexBalanceEthAfter = await token0Contract.balanceOf(movrEthDex)
    // const dexBalanceWmovrAfter = await token1Contract.balanceOf(movrEthDex)

    // const dexEthBalanceChange = dexBalanceEthAfter - dexBalanceEth
    // console.log(`Dex Eth Balance Change: ${dexEthBalanceChange}`)

    // let swapTx = await dexContract.swap(0, calculatedAmountOut, wallet.address)
    // let swapTxReceipt = await swapTx.wait()
    let swapTx = await batchContract.zenlinkTransferAndSwap(token0, token1, movrEthDex, inputEthAmount, calculatedAmountOut, inputEthAmount, 0, 0, calculatedAmountOut, wallet.address, reserves0, reserves1)
    let swapTxReceipt = await swapTx.wait()

    const wmovrBalanceAfter = await token1Contract.balanceOf(wallet.address)
    const ethBalanceAfter = await token0Contract.balanceOf(wallet.address)
    console.log(`ETH Balance: ${ethBalanceAfter}`)
    console.log(`Wmovr Balance: ${wmovrBalanceAfter}`)

}

async function allWalletscMovr(){
    let wallets = JSON.parse(fs.readFileSync('./wallets.json', 'utf8'));
    const loggingProvider = new ethers.JsonRpcProvider(localRpc);
    let walletProviders = wallets.map((wallet: any) => {
        return new ethers.Wallet(wallet.private_key, loggingProvider)
    })
    let movrContractPath = path.join('./../movrContract.json')
    let movrContractAbi = JSON.parse(fs.readFileSync(movrContractPath, 'utf8'));

    const movrMinAmount = ethers.parseUnits("1", 18);
    walletProviders.forEach(async (wallet: any, index: number) => {
        const movrToken = new ethers.Contract(movrContractAddress, movrContractAbi, wallet);
        const currentMovrBalance = await movrToken.balanceOf(wallet.address)
        console.log(`Wallet Address: ${wallet.address} Movr Balance: ${currentMovrBalance}`)

        const wrapAmount = ethers.parseUnits("100", 18);
        if(currentMovrBalance < movrMinAmount){
            const depositTransaction = {
                to: movrContractAddress, // The address of the WMOVR contract
                value: wrapAmount // The amount of MOVR to deposit
            };
            let tx = await wallet.sendTransaction(depositTransaction);
            let receipt = await tx.wait();
            console.log(receipt);
        }
    })
}
async function wrapMovr(wallet: ethers.Wallet, inputAmount: bigint){
    let movrContractPath = path.join('./../movrContract.json')
    let movrContractAbi = JSON.parse(fs.readFileSync(movrContractPath, 'utf8'));


    const movrToken = new ethers.Contract(movrContractAddress, movrContractAbi, wallet);
    const currentMovrBalance = await movrToken.balanceOf(wallet.address)
    const depositTransaction = {
        to: movrContractAddress, // The address of the WMOVR contract
        value: inputAmount // The amount of MOVR to deposit
    };
    let tx = await wallet.sendTransaction(depositTransaction);
    let receipt = await tx.wait();
    const afterMovrBalance = await movrToken.balanceOf(wallet.address)
}
function cleanLpsOfDuplicates(){
    const contractAddressOccurrences = {};
    const allLps = JSON.parse(fs.readFileSync('./lps.json', 'utf8'));
    const cleanedLps = [];

    allLps.forEach((lp: any) => {
        const contractAddress = lp.contractAddress;

        if (contractAddressOccurrences[contractAddress]) {
            console.log(`Duplicate found for contractAddress: ${contractAddress}`);
            // Skip adding to cleanedLps for duplicates
        } else {
            // First occurrence, mark it and add to cleanedLps
            contractAddressOccurrences[contractAddress] = true;
            cleanedLps.push(lp);
        }
    });
    fs.writeFileSync('./lpsCleaned.json', JSON.stringify(cleanedLps, null, 2))

}
// xcKsmContractAddress
const blastRpc = "https://moonriver.public.blastapi.io"
async function testSwap(){
    // const chopsticksRpc = "ws://172.26.130.75:8000"

    // const provider = new ethers.WebSocketProvider(localRpc);
    const provider = new ethers.JsonRpcProvider(localRpc);
    const wallet = new ethers.Wallet(test_account_pk, provider);
    // let wallets = JSON.parse(fs.readFileSync('./wallets.json', 'utf8'));
    // const loggingProvider = new ethers.JsonRpcProvider(localRpc);
    // let walletProviders = wallets.map((wallet: any) => {
    //     return new ethers.Wallet(wallet.private_key, provider)
    // })
    const batchContract = await new ethers.Contract(batchContractAddress2, batchArtifact.abi, wallet)
    const movrContract = await new ethers.Contract(movrContractAddress, movrContractAbi, wallet)
    const usdcContract = await new ethers.Contract(usdcContractAddress, usdcContractAbi, wallet)
    const dexContract = await new ethers.Contract(wmovrUsdcDexAddress, dexAbis[0], wallet)

    const [reserves0, reserves1, time] = await dexContract.getReserves()
    console.log(`Reserves0: ${reserves0} Reserves1: ${reserves1} Time: ${time}`)
    // await wrapMovr(wallet, ethers.parseUnits("1", 18))

    const wmovrBalance = await movrContract.balanceOf(wallet.address)
    const movrBalance = await wallet.provider.getBalance(wallet.address)
    const usdcBalance = await usdcContract.balanceOf(wallet.address)
    console.log(`BEFORE Movr Balance: ${movrBalance} Wmovr Balance ${wmovrBalance} USDC Balance: ${usdcBalance}`)
    const inputAmount = ethers.parseUnits("0.1", 18);
    const calculatedAmountOut = calculateSwapAmountRouterFormula(inputAmount, reserves0, reserves1, 100, 25)

    console.log(`Batch function parameters: ${movrContractAddress} ${usdcContractAddress} ${wmovrUsdcDexAddress} ${inputAmount} ${calculatedAmountOut} ${0} ${calculatedAmountOut} ${wallet.address} 0x`)
    const testData = await batchContract.testCall()
    // console.log(testData)
    // console.log(JSON.stringify(batchContract.interface, null, 2))
    let approved = await checkAndApproveToken(movrContractAddress, wallet, batchContractAddress2, inputAmount)
    let batchSwapTx = await batchContract.transferAndSwapHigh(movrContractAddress, usdcContractAddress, wmovrUsdcDexAddress, inputAmount, calculatedAmountOut, 0, calculatedAmountOut, wallet.address, '0x')
    // let batchSwapTxReceipt = await batchSwapTx.wait()
    // console.log(batchSwapTxReceipt)

    const movrBalanceAfter = await wallet.provider.getBalance(wallet.address)
    const wmovrBalanceAfter = await movrContract.balanceOf(wallet.address)
    const usdcBalanceAfter = await usdcContract.balanceOf(wallet.address)
    console.log(`AFTER Movr Balance: ${movrBalanceAfter} WMovr Balance: ${wmovrBalanceAfter} USDC Balance: ${usdcBalanceAfter}`)

    // function transferAndSwapHigh(
    //     address inputToken,
    //     address outputToken,
    //     address dex, 
    //     uint256 amountIn, 
    //     uint256 expectedAmount,
    //     uint256 amount0Out,
    //     uint256 amount1Out,
    //     address to,
    //     bytes memory data
    // ) public {
    // let ksmCall = ksmContract.interface.encodeFunctionData("decimals")
    // console.log(ksmCall)
    // const symbol = await ksmContract.symbol()
    // const name = await ksmContract.name()
    // console.log(`Symbol: ${symbol} Name: ${name}`)
}
async function traceTransaction(txHash) {
    const provider = new ethers.JsonRpcProvider(localRpc);
    try {
        // Ensure txHash is a valid transaction hash
        if (!ethers.isHexString(txHash, 32)) {
            throw new Error("Invalid transaction hash");
        }

        // Request a transaction trace
        // const trace = await provider.send("debug_traceTransaction", [txHash]);
        const trace = await provider.send("debug_traceCall", [txHash]);
        console.log(trace);
    } catch (error) {
        console.error("Error during transaction trace:", error);
    }
}
class LoggingProvider extends ethers.JsonRpcProvider {
    async call(transaction) {
      // Log the transaction data
      console.log("eth_call transaction data:", transaction);
      return super.call(transaction);
    }
  }
// traceTransaction("0x401c12371be8cb77dc8569421b3a56989891bbf1b8ca6722dc6f1b5de02bf8ee")
// testKsm()
// executeDoubleSwaps()
swapTokensForMovr()
// testZenDex()
// testSwap()
// testBatch()
// testBoxContract()
// testBalance()
// allMovrPoolsBatchContract()

// swapAForB(movrContractAddress, usdcContractAddress,1)
// cleanLpsOfDuplicates()
// allWalletsWrapMovr()