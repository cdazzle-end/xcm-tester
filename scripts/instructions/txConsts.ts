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
]

export const ksmRpc = "wss://kusama-rpc.dwellir.com"
export const alithAddress = "0xf24FF3a9CF04c71Dbc94D0b566f7A27B94566cac"
export const alithPk = process.env.ALITH_PK
export const arb_wallet = process.env.ARB_WALLET
export const mainWalletAddress = "GXeHEVY5SSJFQqcFmANaY3mTsRpcE9EUVzDcGpowbbe41ZZ"
export const ksmTargetNode = '"2000{\\"NativeAssetId\\":{\\"Token\\":\\"KSM\\"}}"'
export const testBncNode = '"2001{\\"Native\\":\\"BNC\\"}"'