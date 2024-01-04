import fs from 'fs'
import { options } from "@acala-network/api";
import * as paraspell from '@paraspell/sdk'
// import { timeout } from 'rxjs/operators'
import { WsProvider, ApiPromise, Keyring, ApiRx } from '@polkadot/api'
// import { FixedPointNumber } from '@acala-network/sdk-core'
// import { u8aToHex } from '@polkadot/util'
// import { EventRecord, Phase, Event, Hash } from '@polkadot/types/interfaces'
// import { ISubmittableResult, IU8a } from '@polkadot/types/types'
import { TNode, getAssetsObject, getNode, getNodeEndpointOption, getAllNodeProviders, getTNode } from '@paraspell/sdk'
// import { BalanceData, getAdapter } from '@polkawallet/bridge'
// import { exec, execSync, spawn, ChildProcess } from 'child_process';
import path from 'path';
import { firstValueFrom, combineLatest, map, Observable, race, EMPTY } from "rxjs";
// import { getAdapter } from './adapters'

// import { RegistryError } from '@polkadot/types/types/registry';
// import { encodeAddress, decodeAddress } from "@polkadot/keyring";
import { wsLocalFrom, wsLocalDestination, assetSymbol, fromChain, toChain } from './testParams'
// import { mnemonicToLegacySeed, hdEthereum } from '@polkadot/util-crypto';

import { getAssetBySymbolOrId, getParaspellChainName, getAssetRegistryObject, readLogData, getEndpointsForChain, connectFirstApi, getAssetRegistryObjectBySymbol } from './utils'
import { ResultDataObject, MyAssetRegistryObject, MyAsset, AssetNodeData, InstructionType, SwapInstruction, TransferInstruction, TransferToHomeThenDestInstruction } from './types'
import { AssetNode } from './AssetNode'
import { prodRelayPolkadot, prodRelayKusama, createWsEndpoints, prodParasKusamaCommon, prodParasKusama } from '@polkadot/apps-config/endpoints'
import { buildInstructions } from './instructionUtils';
// import { ApiOptions } from '@polkadot/api/types';

export const allConnectionPromises = new Map<string, Promise<ApiPromise>>();
export const allConnections = new Map<string, ApiPromise>();
export let promiseApis: Record<number, ApiPromise> = {};
export let observableApis: Record<number, ApiRx> = {};
const aliceAddress = "HNZata7iMYWmk5RvZRTiAsSDhV8366zq2YGb3tLH5Upf74F"



// const mgxRpc = 'wss://kusama-rpc.mangata.online'
const dazzleMgxAddres = '5G22cv9fT5RNVm2AV4MKgagmKH9aoZL4289UDcYrToP9K6hQ'
const localHost = "ws://172.26.130.75:"
const aliceErc20 = "0xf24FF3a9CF04c71Dbc94D0b566f7A27B94566cac"

const fromNode = getNode(fromChain)
const toNode = getNode(toChain)


let scriptPid: string | null = null;
let chopsticksPid: string | null = null;




function constructRoute() {
    const resultsFolderPath = path.join(__dirname, '/../../test2/arb-dot-2/arb_handler/result_log_data');
    const testResultFile = path.join(resultsFolderPath, '2023-06-17_18-26-43.json');
    const testResults: ResultDataObject[] = JSON.parse(fs.readFileSync(testResultFile, 'utf8'));

    let assetPath: AssetNode[] = testResults.map(result => readLogData(result))
    return assetPath
}

function buildInstructionSet(assetPath: AssetNode[]) {
    let instructions: (SwapInstruction | TransferInstruction)[] = [];
    for (let i = 0; i < assetPath.length - 1; i++) {
        let assetNodes = [assetPath[i], assetPath[i + 1]]
        let newInstructions = buildInstructions(assetNodes)
        newInstructions.forEach((instruction) => {
            instructions.push(instruction)
        })
    }
    return instructions
}


// Build extrinsics from instructions
function buildExtrinsicSet(instructionSet: (SwapInstruction | TransferInstruction)[]) {
    let extrinsicSet = []

    for(const instruction of instructionSet){
        switch(instruction.type){
            case InstructionType.Swap:
                extrinsicSet.push(buildSwapExtrinsic(instruction))
                break;
            case InstructionType.TransferToHomeChain:
                break;
            case InstructionType.TransferAwayFromHomeChain:
                break;
            case InstructionType.TransferToHomeThenDestination:
                break;

        }
    }
}
function buildTransferExtrinsic(instruction: TransferInstruction) {
    switch(instruction.type){
        case InstructionType.TransferToHomeChain:
            break;
        case InstructionType.TransferAwayFromHomeChain:
            break;
        case InstructionType.TransferToHomeThenDestination:
            break;
    }
}
function buildSwapExtrinsic(instruction: SwapInstruction) {

}

function run() {
    let assetPath = constructRoute()
    let instructions = buildInstructionSet(assetPath)
    instructions.forEach((instruction) => {
        // console.log(InstructionType[instruction.type])
        if(instruction.type == 0){
            console.log(`(${InstructionType[instruction.type]})${instruction.chain} ${JSON.stringify(instruction.assetNodes[0].getAssetLocalId())} -> ${JSON.stringify(instruction.assetNodes[1].getAssetLocalId())}`)
        } else {
            console.log(`(${InstructionType[instruction.type]})${instruction.fromChainId} ${JSON.stringify(instruction.assetNodes[0].getAssetLocalId())} ${JSON.stringify(instruction.startAssetNode.paraspellAsset)} -> ${instruction.toChainId} ${JSON.stringify(instruction.assetNodes[1].getAssetLocalId())} ${JSON.stringify(instruction.destinationAssetNode.paraspellAsset)}`)
        }
    })
}

run()

async function testProviders(){
    let endpoints = getEndpointsForChain(2000)
    const api = await connectFirstApi(endpoints, 2000)
    // let api = promiseApis[2000]
    await api.promise.isReady
    if(api.promise.isConnected){
        console.log("API promise isConnected = true")
    } else {
        console.log("Not connected to Karura")
        await api.promise.disconnect()
    }

    await api.observable.isReady
    if(api.observable.isConnected){
        console.log("Api observable isConnected = true")
    } else {
        console.log("Not connected to Karura")
        await api.observable.disconnect()
    }

    console.log("Waiting 10 seconds...")
    await delay(10000)

    // Check API connections
    allConnections.forEach((connection, endpoint) => {
        if (connection.isConnected) {
            console.log(`API with endpoint ${endpoint} is still connected.`);
            if(endpoint == api.promiseEndpoint){
                console.log("Primary connection promise")
            } else {
                console.log("Disconnecting api")
                connection.disconnect();
            }
        } else {
            console.log(`API with endpoint ${endpoint} is not connected.`);
        }
    });

    console.log("Waiting 10 seconds...")
    await delay(10000)

    allConnections.forEach((connection, endpoint) => {
        if (connection.isConnected) {
            console.log(`API with endpoint ${endpoint} is still connected.`);
            if(endpoint == api.promiseEndpoint){
                console.log("Primary connection promise. Disconnecting...")
                connection.disconnect();
            } else {
                console.log("Disconnecting api")
                connection.disconnect();
            }
        } else {
            console.log(`API with endpoint ${endpoint} is not connected.`);
        }
    });
}
function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}