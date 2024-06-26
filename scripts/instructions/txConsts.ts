import { TNode } from '@paraspell/sdk';
import * as dotenv from 'dotenv'
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const mgxEvents = {
    "swap": "0x0d01"
}

export const localRpcs = {
    "Kusama": "ws://172.26.130.75:8013",
    "Karura": "ws://172.26.130.75:8008",
    "Moonriver": "ws://172.26.130.75:8000",
    "BifrostKusama": "ws://172.26.130.75:8009",
    "Basilisk": "ws://172.26.130.75:8010",
    "Mangata": "ws://172.26.130.75:8011",
    "ParallelHeiko": "ws://172.26.130.75:8012",
    "AssetHubKusama": "ws://172.26.130.75:8014",
    "Kintsugi": "ws://172.26.130.75:8015",
    // "CrustShadow": "ws://172.26.130.75:8016",
    // "Calamari": "ws://172.26.130.75:8017",
    // "Altair": "ws://172.26.130.75:8018",
    // "InvArchTinker": "ws://172.26.130.75:8019",
    "Acala": "ws://172.26.130.75:9000",
    "HydraDX": "ws://172.26.130.75:9001",
    "Interlay": "ws://172.26.130.75:9002",
    "Aster": "ws://172.26.130.75:9003",
    "Moonbeam": "ws://172.26.130.75:9004",
    "Phala": "ws://172.26.130.75:9005",
    "Polkadex": "ws://172.26.130.75:9006",
    "AssetHubPolkadot": "ws://172.26.130.75:9007",
    "Polkadot": "ws://172.26.130.75:9008",
    "Zeitgeist": "ws://172.26.130.75:9009",
    "BifrostPolkadot": "ws://172.26.130.75:9010",
    "Parallel": "ws://172.26.130.75:9011",
    "Unique": "ws://172.26.130.75:9012",
    // "BifrostPolkadot": "ws://172.26.130.75:9010",
    // "BifrostPolkadot": "ws://172.26.130.75:9010",
    // "BifrostPolkadot": "ws://172.26.130.75:9010",
}
export const testNets = [
    "Kusama", 
    "Karura", 
    "Moonriver", 
    "BifrostKusama", 
    "Basilisk", 
    "Mangata", 
    "ParallelHeiko",
    "AssetHubKusama",
    "Kintsugi",
    // "CrustShadow",
    // "Altair",
    // "Calamari",
    // "InvArchTinker"
    "Polkadot",
    "Acala",
    "Moonbeam",
    "Phala",
    "HydraDX",
    "Interlay",
    "Astar",
    "Polkadex",
    "AssetHubPolkadot",
    "Parallel",
    "Unique"
]

export const ksmRpc = "wss://kusama-rpc.dwellir.com"
export const dotRpc = "wss://polkadot-rpc.dwellir.com"
export const alithAddress = "0xf24FF3a9CF04c71Dbc94D0b566f7A27B94566cac"
export const alithPk = process.env.ALITH_PK
export const arb_wallet_kusama = process.env.ARB_WALLET
export const live_wallet_3 = process.env.LIVE_WALLET_3_PK
export const mainWalletAddress = "GXeHEVY5SSJFQqcFmANaY3mTsRpcE9EUVzDcGpowbbe41ZZ"
export const mainWalletEthAddress = '0xAe8Da4A9792503f1eC97eD035e35133A9E65a61f'
export const ksmTargetNode = '"2000{\\"NativeAssetId\\":{\\"Token\\":\\"KSM\\"}}"'
export const dotTargetNode = '"2000{\\"NativeAssetId\\":{\\"Token\\":\\"DOT\\"}}"'
export const testBncNode = '"2001{\\"Native\\":\\"BNC\\"}"'
export const testZlkNode = '"2001{\\"Native\\":\\"ZLK\\"}"'
export const karRpc = "wss://karura-rpc-0.aca-api.network"
export const acaRpc = "wss://acala-rpc-0.aca-api.network"
export const movrRpc = "wss://rpc.moonriver.moonbeam.network"
export const kusamaNodeKeys = [
    '2000{"NativeAssetId":{"Token":"KSM"}}',
    '2001{"Token":"KSM"}',
    '2023"42259045809535163221576417993425387648"',
    '2085"100"',
    '2007"340282366920938463463374607431768211455"',
    '2110"4"',
    '2090"1"'
]

export const dotNodeKeys = [
    '"2000{\\"NativeAssetId\\":{\\"Token\\":\\"DOT\\"}}"'
]