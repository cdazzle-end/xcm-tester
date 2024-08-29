import { acalaStableLpsPath, arbFinderPath, glmrLpsPath, kusamaAssetRegistryPath, lpRegistryPath } from "./config/filePathConsts.ts"
import fs from 'fs'

async function testFilePaths(){
    // const acaFilePath = acalaFileTest
}

async function main(){

    // await testBalanceAdapters()
    // await testDepositEventListeners()
    await testFilePaths()
    process.exit(0)
}

main()