import * as paraspell from "@paraspell/sdk";
import { AssetNode } from "./AssetNode.ts";
import { IndexObject, InstructionType, JsonPathNode, MyAssetRegistryObject, Relay, SwapInstruction, TransferInstruction, TransferrableAssetObject, TransferToHomeThenDestInstruction } from "./types.ts";
import { getParaspellChainName, getAssetRegistryObjectBySymbol, getAssetBySymbolOrId, increaseIndex, constructRouteFromFile, constructRouteFromJson, getBalanceChainAsset } from "./utils.ts";
import fs from 'fs'
import path from 'path'
import { FixedPointNumber, Token } from "@acala-network/sdk-core";
import { fileURLToPath } from 'url';
// import { buildAndExecuteAllocationExtrinsics, globalState } from "./liveTest.ts";

async function testGetAssetRegistryObject(){
    let firstAssetObject = getAssetRegistryObjectBySymbol(2023, `xcksm`)
    let secondAssetObject = getAssetRegistryObjectBySymbol(2023, `ksm`)

    console.log(`First object: ${firstAssetObject.tokenData.chain} ${firstAssetObject.tokenData.symbol}`)
    console.log(`Second object: ${secondAssetObject.tokenData.chain} ${secondAssetObject.tokenData.symbol}`)
}

async function run(){
    await testGetAssetRegistryObject()
}
run()