import '@moonbeam-network/api-augment/moonriver'
import { calculateSwapAmountRouterFormula, checkForSubstrateToken, getBestSwapRoute, logBatchContractResults, getContractAbi, checkApproval, getTokenContractData, logDoubleSwapResults, getContractAbiIndex } from './utils/utils.ts';
import { batchContractAddress2, boxContractAddress, dexAbis, ignoreList, localRpc, movrContractAddress, solarFee, test_account_pk, xcKsmContractAddress, zenFee } from './utils/const.ts';
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

import { GenericTx } from 'utils/types.ts';
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
                    console.log(`(${tx.walletIndex}) APPROVED: FALSE`)
                    const approveResults = await wmovrToken.approve(batchContractAddress2, inputMovrAmount)
                    const approveReceipt = await approveResults.wait()
                    transactions.forEach((transaction, index) => {
                        if(transaction.walletIndex == walletIndex ){
                            transaction.nonce = transaction.nonce + 1;
                        }
                    })
                } else {
                    console.log(`(${tx.walletIndex}) APPROVED: TRUE`)
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
                    console.log(`(${tx.walletIndex}) Solar Dex`)
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
                    console.log(`(${tx.walletIndex}) Zenlink Dex`)
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

    let batchResults = await executeDoubleSwaps(transactions)
    console.log("MOVR LPS LENGTH", movrLps.length)
    console.log("TRANSACTIONS LENGTH", transactions.length)
    const results = JSON.parse(fs.readFileSync('./batchResults/batch_contract_results.json', 'utf8'));
    console.log("RESULTS FILE LENGTH", results.length)
    console.log("BatchResults Length ", batchResults.length)
}
async function executeDoubleSwaps(transactions, batchSize = 1, slippage = 100){
    const provider = new ethers.JsonRpcProvider(localRpc);
    const wallet = new ethers.Wallet(test_account_pk, provider);

    let wmovrContractAbi = JSON.parse(fs.readFileSync('./../movrContract.json', 'utf8'));
    let inputMovrAmount = ethers.parseUnits("1", 18)
    
    
    let txResults = []
    for (let i = 0; i < transactions.length; i += batchSize){
        
        const transactionBatch = transactions.slice(i, i + batchSize);
        transactionBatch.forEach((tx, index) => {
            console.log("Tx Index", index + i)
            // console.log(JSON.stringify(tx, null, 2))
        })
        const batchPromises = transactionBatch.map(async (tx, index) => {
            
            console.log("DEX: ", tx.to)
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
                movrBefore2: null,
                movrAfter2: null,
                otherTokenAfter2: null,
                otherTokenBefore2: null,
                calculatedAmountOut: null,
                swapTxReceipt: null,
                failureReason: "Default",
                otherTokenDifference2: null,
                movrDifference2: null,
                swap2success: false
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
                // await logBatchContractResults(resultDefault, defaultError)
                await logDoubleSwapResults(resultDefault, acquireMutex, defaultError)
                return resultDefault
            }
            const token0 = await dexContract.token0()
            const token1 = await dexContract.token1()
            resultDefault.token0Address = token0
            resultDefault.token1Address = token1
            const erc20Abi = JSON.parse(fs.readFileSync('./abi/usdcContractAbi.json', 'utf8'))
            const outTokenAddress = token0 == movrContractAddress ? token1 : token0
            // const outTokenDecimals = token0 == movrContractAddress ? 18 : 6
            let otherTokenContract, outTokenSymbol, outTokenDecimals;

            // Get out token contract
            try{
                otherTokenContract = new ethers.Contract(outTokenAddress, erc20Abi, wallet);
                outTokenSymbol = await otherTokenContract.symbol()
                outTokenDecimals = await otherTokenContract.decimals()
                resultDefault.outTokenSymbol = outTokenSymbol
                defaultError.outTokenSymbol = outTokenSymbol
                resultDefault.inTokenSymbol = "MOVR"
                defaultError.inTokenSymbol = "MOVR"
            } catch(e){
                resultDefault.failureReason = "Out token contract instantiation"
                defaultError.error = e
                console.log(e)
                await logDoubleSwapResults(resultDefault, acquireMutex, defaultError)
                // await logBatchContractResults(resultDefault, acquireMutex, defaultError)
                return resultDefault
            }

           
            // console.log(`EXECUTING SWAP (${tx.walletIndex}) ${tx.nonce}:: MOVR -- ${outTokenSymbol} Dex: ${tx.to}`)

            let movrBalanceBefore = await wmovrToken.balanceOf(wallet.address)
            let outTokenBalanceBefore = await otherTokenContract.balanceOf(wallet.address)
            resultDefault.movrBefore = movrBalanceBefore
            resultDefault.otherTokenBefore = outTokenBalanceBefore
            
            // Approving batch contract to use input movr amounr
            try{
                let approved = await checkApproval(wmovrToken, wallet.address, batchContractAddress2)
                if(!approved){
                    // console.log("Approving tokens")
                    console.log(`(${tx.walletIndex}) APPROVED: FALSE`)
                    const approveResults = await wmovrToken.approve(batchContractAddress2, inputMovrAmount)
                    const approveReceipt = await approveResults.wait()
                    transactions.forEach((transaction, index) => {
                        if(transaction.walletIndex == walletIndex ){
                            transaction.nonce = transaction.nonce + 1;
                        }
                    })
                } else {
                    console.log(`(${tx.walletIndex}) APPROVED: TRUE`)
                }

            } catch (e){
                resultDefault.failureReason = "Approval failed"
                defaultError.error = e
                await logDoubleSwapResults(resultDefault, acquireMutex, defaultError)
                // await logBatchContractResults(resultDefault, acquireMutex, defaultError)
                return resultDefault
            }
            
            // Swap with specified ABI parameters
            let calculatedAmountOut;
            let swapTx;
            try{
                if(txAbiIndex == 0){
                    console.log(`(${tx.walletIndex}) Solar Dex`)
                    if(token0 == movrContractAddress){
                        // console.log("Token 0 is movr")
                        calculatedAmountOut = calculateSwapAmountRouterFormula(inputMovrAmount, reserves0, reserves1, slippage, 25)
                        const swapParams = [0, calculatedAmountOut, wallet.address, '0x'];
                        const swapFunction = "swap(uint, uint, address, bytes)";
                        const swapCallData = dexContract.interface.encodeFunctionData(swapFunction, swapParams);
                        swapTx = await batchContract.transferAndSwap(movrContractAddress, otherTokenContract, tx.to, inputMovrAmount, swapCallData, calculatedAmountOut, {nonce: tx.nonce})
                    } else {
                        // console.log("Token 1 is movr")
                        calculatedAmountOut = calculateSwapAmountRouterFormula(inputMovrAmount, reserves1, reserves0, slippage, 25)
                        const swapParams = [calculatedAmountOut, 0, wallet.address, '0x'];
                        const swapFunction = "swap(uint, uint, address, bytes)";
                        const swapCallData = dexContract.interface.encodeFunctionData(swapFunction, swapParams);
                        swapTx = await batchContract.transferAndSwap(movrContractAddress, otherTokenContract, tx.to, inputMovrAmount, swapCallData, calculatedAmountOut, {nonce: tx.nonce})
                    }
                    
                } else if (txAbiIndex == 1){
                    console.log(`(${tx.walletIndex}) Zenlink Dex`)
                    if(token0 == movrContractAddress){
                        calculatedAmountOut = calculateSwapAmountRouterFormula(inputMovrAmount, reserves0, reserves1, slippage, 30)
                        const swapParams = [0, calculatedAmountOut, wallet.address];
                        const swapFunction = "swap(uint, uint, address)";
                        const swapCallData = dexContract.interface.encodeFunctionData(swapFunction, swapParams);
                        swapTx = await batchContract.transferAndSwap(movrContractAddress, otherTokenContract, tx.to, inputMovrAmount, swapCallData, calculatedAmountOut, {nonce: tx.nonce})
                    } else {
                        calculatedAmountOut = calculateSwapAmountRouterFormula(inputMovrAmount, reserves1, reserves0, slippage, 30)
                        const swapParams = [calculatedAmountOut, 0, wallet.address];
                        const swapFunction = "swap(uint, uint, address)";
                        const swapCallData = dexContract.interface.encodeFunctionData(swapFunction, swapParams);
                        swapTx = await batchContract.transferAndSwap(movrContractAddress, otherTokenContract, tx.to, inputMovrAmount, swapCallData, calculatedAmountOut, {nonce: tx.nonce})
                    }
                    
                } else if (txAbiIndex == 2){
                    // throw new Error("Huckleberry Dex Abi (2) not implemented")
                    resultDefault.failureReason = "Huckleberry Dex Abi (2) not implemented"
                    // await logBatchContractResults(resultDefault, acquireMutex, defaultError)
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
                await logDoubleSwapResults(resultDefault, acquireMutex, defaultError)
                // await logBatchContractResults(resultDefault, acquireMutex, defaultError)
                return resultDefault
            }

           
            
            let swapTxReceipt = await swapTx.wait()
            let movrBalanceAfter = await wmovrToken.balanceOf(wallet.address)
            let outTokenBalanceAfter: bigint = await otherTokenContract.balanceOf(wallet.address)
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
            const outTokenBalanceDifference: bigint = outTokenBalanceAfter - outTokenBalanceBefore
            resultDefault.movrDifference = movrBalanceDifference
            resultDefault.otherTokenDifference = outTokenBalanceDifference
            if (resultDefault.otherTokenDifference < calculatedAmountOut){
                resultDefault.failureReason = "Out token difference is less than calculated amount out"
                defaultError.error = "Out token difference is less than calculated amount out"
                // await logBatchContractResults(resultDefault, acquireMutex, defaultError)
                return resultDefault
            }

            resultDefault.success = true
            
             // Add 1 to nonce for next transaction and execute other token swap
             transactions.forEach((transaction, index) => {
                if(transaction.walletIndex == walletIndex ){
                    transaction.nonce = transaction.nonce + 1;
                }
            })
            // ---------------------------------------------------------------
            // Approve for other token
            try{
                let approved = await checkApproval(otherTokenContract, wallet.address, batchContractAddress2)
                if(!approved){
                    // console.log("Approving tokens")
                    console.log(`(${tx.walletIndex}) APPROVED: FALSE`)
                    const approveResults = await otherTokenContract.approve(batchContractAddress2, outTokenBalanceDifference)
                    const approveReceipt = await approveResults.wait()
                    transactions.forEach((transaction, index) => {
                        if(transaction.walletIndex == walletIndex ){
                            transaction.nonce = transaction.nonce + 1;
                        }
                    })
                } else {
                    console.log(`(${tx.walletIndex}) APPROVED: TRUE`)
                }

            } catch (e){
                resultDefault.failureReason = "Approval failed"
                defaultError.error = e
                await logDoubleSwapResults(resultDefault, acquireMutex, defaultError)
                // await logBatchContractResults(resultDefault, acquireMutex, defaultError)
                return resultDefault
            }
            let otherTokenBalance2Before = await otherTokenContract.balanceOf(wallet.address)
            let movrBalance2Before = await wmovrToken.balanceOf(wallet.address)
            resultDefault.movrBefore2 = movrBalance2Before
            resultDefault.otherTokenBefore2 = otherTokenBalance2Before
            try{
                const otherTokenInput = outTokenBalanceDifference
                let calculatedMovrOut;
                if(txAbiIndex == 0){
                    console.log(`(${tx.walletIndex}) Solar Dex`)
                    if(token0 == movrContractAddress){
                        // console.log("Token 0 is movr")
                        calculatedMovrOut = calculateSwapAmountRouterFormula(otherTokenInput, reserves0, reserves1, slippage, 25)
                        const swapParams = [calculatedMovrOut, 0, wallet.address, '0x'];
                        const swapFunction = "swap(uint, uint, address, bytes)";
                        const swapCallData = dexContract.interface.encodeFunctionData(swapFunction, swapParams);
                        swapTx = await batchContract.transferAndSwap(otherTokenContract, movrContractAddress, tx.to, otherTokenInput, swapCallData, calculatedMovrOut, {nonce: tx.nonce})
                    } else {
                        // console.log("Token 1 is movr")
                        calculatedMovrOut = calculateSwapAmountRouterFormula(otherTokenInput, reserves0, reserves1, slippage, 25)
                        const swapParams = [0, calculatedMovrOut, wallet.address, '0x'];
                        const swapFunction = "swap(uint, uint, address, bytes)";
                        const swapCallData = dexContract.interface.encodeFunctionData(swapFunction, swapParams);
                        swapTx = await batchContract.transferAndSwap(otherTokenContract, movrContractAddress, tx.to, otherTokenInput, swapCallData, calculatedMovrOut, {nonce: tx.nonce})
                    }
                    
                } else if (txAbiIndex == 1){
                    console.log(`(${tx.walletIndex}) Zenlink Dex`)
                    if(token0 == movrContractAddress){
                        calculatedMovrOut = calculateSwapAmountRouterFormula(otherTokenInput, reserves0, reserves1, slippage, 25)
                        const swapParams = [calculatedMovrOut, 0, wallet.address, '0x'];
                        const swapFunction = "swap(uint, uint, address)";
                        const swapCallData = dexContract.interface.encodeFunctionData(swapFunction, swapParams);
                        swapTx = await batchContract.transferAndSwap(otherTokenContract, movrContractAddress, tx.to, otherTokenInput, swapCallData, calculatedMovrOut, {nonce: tx.nonce})
                    } else {
                        calculatedMovrOut = calculateSwapAmountRouterFormula(otherTokenInput, reserves0, reserves1, slippage, 25)
                        const swapParams = [0, calculatedMovrOut, wallet.address, '0x'];
                        const swapFunction = "swap(uint, uint, address)";
                        const swapCallData = dexContract.interface.encodeFunctionData(swapFunction, swapParams);
                        swapTx = await batchContract.transferAndSwap(otherTokenContract, movrContractAddress, tx.to, otherTokenInput, swapCallData, calculatedMovrOut, {nonce: tx.nonce})
                    }
                    
                } else if (txAbiIndex == 2){
                    // throw new Error("Huckleberry Dex Abi (2) not implemented")
                    resultDefault.failureReason = "Huckleberry Dex Abi (2) not implemented"
                    // await logBatchContractResults(resultDefault, acquireMutex, defaultError)
                    return resultDefault
                }

                resultDefault.calculatedAmountOut = calculatedMovrOut
            } catch (e){
                resultDefault.failureReason = "Swap failed"
                defaultError.error = e
                transactions.forEach((transaction, index) => {
                    if(transaction.walletIndex == walletIndex ){
                        transaction.nonce = transaction.nonce - 1;
                    }
                })
                await logDoubleSwapResults(resultDefault, acquireMutex, defaultError)
                return resultDefault
            }

            let otherTokenBalance2After = await otherTokenContract.balanceOf(wallet.address)
            let movrBalance2After = await wmovrToken.balanceOf(wallet.address)
            resultDefault.movrAfter2 = movrBalance2After
            resultDefault.otherTokenAfter2 = otherTokenBalance2After

            let movrBalanceDifference2 = movrBalance2After - movrBalance2Before
            let otherTokenBalanceDifference2 = otherTokenBalance2Before - otherTokenBalance2After
            resultDefault.movrDifference2 = movrBalanceDifference2
            resultDefault.otherTokenDifference2 = otherTokenBalanceDifference2

            if(otherTokenBalance2After >= otherTokenBalance2Before){
                throw new Error("Didnt successfully swap other token for movr")
            }
            if(movrBalance2After <= movrBalance2Before){
                throw new Error("Didnt successfully swap other token for movr")
            }
            
            resultDefault.swap2success = true
            // console.log("LOGGING RESULTS")
            // await logBatchContractResults(resultDefault, acquireMutex)
            await logDoubleSwapResults(resultDefault, acquireMutex, defaultError)
            
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

async function logDoubleSwap(){

}

async function swapAForB(tokenAContract: string, tokenBContract:string, inputAmount: number){

    const provider = new ethers.JsonRpcProvider(localRpc);
    const wallet = new ethers.Wallet(test_account_pk, provider);

    const tokenAData = await getTokenContractData(tokenAContract)
    const tokenBData = await getTokenContractData(tokenBContract)

    const inputAmountFormatted = ethers.parseUnits(inputAmount.toString(), tokenAData.decimals)
    await getBestSwapRoute(tokenAContract, tokenBContract, inputAmountFormatted)
}

async function allWalletsWrapMovr(){
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
async function testKsm(){
    // const chopsticksRpc = "ws://172.26.130.75:8000"

    // const provider = new ethers.WebSocketProvider(localRpc);
    const provider = new ethers.JsonRpcProvider(blastRpc);
    const wallet = new ethers.Wallet(test_account_pk, provider);

    const ksmContractAbi = JSON.parse(fs.readFileSync('./abi/xcTokenAbi.json', 'utf8'));
    const ksmContract = new ethers.Contract(xcKsmContractAddress, ksmContractAbi, wallet)

    const ksmBalance = await ksmContract.decimals()
    console.log(`KSM Balance: ${ksmBalance}`)
    // let ksmCall = ksmContract.interface.encodeFunctionData("decimals")
    // console.log(ksmCall)
    // const symbol = await ksmContract.symbol()
    // const name = await ksmContract.name()
    // console.log(`Symbol: ${symbol} Name: ${name}`)
}
// testKsm()
// executeDoubleSwaps()
swapTokensForMovr()
// testBatch()
// testBoxContract()
// testBalance()
// allMovrPoolsBatchContract()

// swapAForB(movrContractAddress, usdcContractAddress,1)
// cleanLpsOfDuplicates()
// allWalletsWrapMovr()