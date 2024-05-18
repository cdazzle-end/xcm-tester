import fs from 'fs';
import { privateKeyToAccount } from "viem/accounts";
import * as dotenv from "dotenv";
// dotenv.config()
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
// console.log(__dirname)

export const ignoreList = [
    "0x06C08321a530360Ec1B3cC36CFe8b4ee419ce928",
    "0x423937ced38e44d7953098e92341dee103e945a8",
    "0xe41b4a4aa9f6c125e9045cb27cff112b6276d3b1",
    "0xd99111c3444dece8a29ebc38f437b53e9ced1cf9",
    "0x4f62d1f50b9f71e932e0e3410e32a7a211217031",
    "0x9e540174dde235ee828a0bc192a5b70453bd3e8c",
    "0xef049c45d83d007cc28222f9f375954ffac5471c",
    "0x06c08321a530360ec1b3cc36cfe8b4ee419ce928",
    "0xD053Ed287F7dF209bf32f40E71D04095A8dA2989",
    "0x6e555293c3417e314d9ffdf339fbdabb2fe699e6",
    "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199",
    "0x4c05b9ab3bf4222b576c3cafc0d10891badd34ad",
    "0xd053ed287f7df209bf32f40e71d04095a8da2989",
    "0xe5fff70b2e265f6784e2300bb88a29d5cb012b8a",
    "0x711ab763e638ad40554ad7c685afbb3a43aebf48",
    "0xa797283915E42a0243d9C536f55046b547723B13",
    // "0x92b8ccdcd31a3343e77d6f9e717a43d12a2ec7a6"
    // "0x3933b0214b3b117fb52646343076d229817a4e4b"

]

export const mnemonic = 'bottom drive obey lake curtain smoke basket hold race lonely fit walk';
export let privateKey = "0x5fb92d6e98884f76de468fa3f6278f8807c48bebc13595d45af5bdc4da702133"
export let noPrefixPrivateKey = privateKey.slice(2)

export const wsLocalChain = "ws://172.26.130.75:8000"
export const defaultWebsocket = "wss://moonriver.public.blastapi.io"
export const defaultRpc = "https://moonriver.public.blastapi.io"
// export const localRpc = "http://127.0.0.1:8545/"
export const localRpc = "http://127.0.0.1:101010101/"

// export const rpcUrl = wsLocalChain
export const account = privateKeyToAccount(`0x${noPrefixPrivateKey}`);
// export const rpcUrl = 'INSERT_RPC_API_ENDPOINT'

export let dazzlePolk = "0xAe8Da4A9792503f1eC97eD035e35133A9E65a61f"
export const liveWallet = "0x13E8ABE5BE7E43A8a2c3B4C3Ff9752D665c9719E"
export const liveWallet3 = "0x1A73c8A6aBd21b5cD8969a531E2Ace452cbA5f73"
export const liveWallet3Pk = process.env.LIVE_WALLET_3_PK
export const addressFrom = '0xf24FF3a9CF04c71Dbc94D0b566f7A27B94566cac'; //Alith
export const addressTo = '0x3Cd0A705a2DC65e5b1E1205896BaA2be8A07c6e0'; //Baltathazar
export const xTokensContract = "0x0000000000000000000000000000000000000804"
export const wmovrUsdcDexAddress = "0xe537f70a8b62204832b8ba91940b77d3f79aeb81"
export const wmovrFraxDexAddress = "0x2cc54b4A3878e36E1C754871438113C1117a3ad7"
export const movrContractAddress = "0x98878B06940aE243284CA214f92Bb71a2b032B8A"
export const usdcFraxDexAddress = "0x310C4d18640aF4878567c4A31cB9cBde7Cd234A3" //SushiSwap
export const usdcContractAddress = "0xE3F5a90F9cb311505cd691a46596599aA1A0AD7D"
export const fraxContractAddress = "0x1A93B23281CC1CDE4C4741353F3064709A16197d"
export const solarDexRouterAddress = "0xAA30eF758139ae4a7f798112902Bf6d65612045f"
export const zenlinkDexRouterAddress = "0x2f84b9713a96FB356683de7B44dd2d37658b189d"
export const wmovrRmrkDexAddress = "0xdfeefa89639125d22ca86e28ce87b164f41afae6"
export const wmovrRmrkZenlinkAddress = "0x24336393742050233B8eCF873454F724D4083356"

export const wmovrKsmDexAddress = "0xea3d1e9e69addfa1ee5bbb89778decd862f1f7c5"

//XC TOKENS
export const xcKsmContractAddress = "0xFfFFfFff1FcaCBd218EDc0EbA20Fc2308C778080"
export const xcKsmLocalId = "42259045809535163221576417993425387648"
export const xcRmrkContractAddress = "0xffffffFF893264794d9d57E1E0E21E0042aF5A0A"
export const xcRmrkLocalId = "182365888117048807484804376330534607370"
export const xcKintContractAddress = "0xfffFFFFF83F4f317d3cbF6EC6250AeC3697b3fF2"
export const xcKintLocalId = "175400718394635817552109270754364440562"
export const xcCsmContractAddress = "0xffFfFFFf519811215E05eFA24830Eebe9c43aCD7"
export const xcCsmLocalId = "108457044225666871745333730479173774551"
export const xcKarContractAddress = "0xFfFFFFfF08220AD2E6e157f26eD8bD22A336A0A5"
export const xcKarLocalId = "10810581592933651521121702237638664357"
export const xcXrtContractAddress = "0xFffFFffF51470Dca3dbe535bD2880a9CcDBc6Bd9"
export const xcXrtLocalId = "108036400430056508975016746969135344601"
export const xcTokens = [xcKsmContractAddress, xcRmrkContractAddress, xcKintContractAddress, xcCsmContractAddress]
export const xcLocalIds = [xcKsmLocalId, xcRmrkLocalId, xcKintLocalId, xcCsmLocalId]

export const test_account = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
export const test_account_pk = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"

export const boxContractAddress = "0x2bdCC0de6bE1f7D2ee689a0342D76F52E8EFABa3"
// export const batchContractAddress = "0xFD471836031dc5108809D173A067e8486B9047A3"
export const batchContractAddress2 = "0x7969c5eD335650692Bc04293B07F5BF2e7A673C0"
export const liveBatchContract = "0xf8059f4ee8366E6b03B60fC4fD096Df3Fc66D46b"

const batchArtifactPath = path.join(__dirname, '../contractArtifacts/Batch.json');
export const batchArtifact = JSON.parse(fs.readFileSync(batchArtifactPath, 'utf8')) as any;
// export const ignoreList = JSON.parse(fs.readFileSync('./ignoreList.json', 'utf8'));

export const dexAbis = [
    JSON.parse(fs.readFileSync(path.join(__dirname, '../abi/solarDexAbi.json'), 'utf8')),
    JSON.parse(fs.readFileSync(path.join(__dirname, '../abi/zenlinkDexAbi.json'), 'utf8')),
    JSON.parse(fs.readFileSync(path.join(__dirname, '../abi/uniswapDexV2Abi.json'), 'utf8'))
]
export const routerAbis = [
    JSON.parse(fs.readFileSync(path.join(__dirname, '../abi/solarRouterAbi.json'), 'utf8')),
    JSON.parse(fs.readFileSync(path.join(__dirname, '../abi/zenRouterAbi.json'), 'utf8')),
    JSON.parse(fs.readFileSync(path.join(__dirname, '../abi/huckleberryRouterAbi.json'), 'utf8')),
]
export const solarRouterAddress = "0xAA30eF758139ae4a7f798112902Bf6d65612045f"
export const zenlinkRouterAddress = "0x2f84b9713a96FB356683de7B44dd2d37658b189d"
export const huckleberryRouterAddress = "0x2d4e873f9Ab279da9f1bb2c532d4F06f67755b77"
export const routerContracts = [
    solarRouterAddress,
    zenlinkRouterAddress,
    huckleberryRouterAddress
]

export const movrContractAbi = JSON.parse(fs.readFileSync(path.join(__dirname,'../abi/movrContractAbi.json'), 'utf8'));

export const usdcContractAbi = JSON.parse(fs.readFileSync(path.join(__dirname,'../abi/usdcContractAbi.json'), 'utf8'));
// export const solarFee = BigInt(25) // 0.25%
// export const zenFee = BigInt(30) // 0.3%
export const solarFee = 25 // 0.25%
export const zenFee = 30 // 0.3%
// export const routerFees: bigint[] = [solarFee, zenFee]
export const routerFees = [solarFee, zenFee]

export const testDataContractAddress = "0xcc2a7cef44caa59847699104629e034ea7d89f6a"
export const testTxData = "0x42643f97000000000000000000000000e3f5a90f9cb311505cd691a46596599aa1a0ad7d00000000000000000000000098878b06940ae243284ca214f92bb71a2b032b8a000000000000000000000000cc2a7cef44caa59847699104629e034ea7d89f6a000000000000000000000000000000000000000000000000000000000000090600000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a4022c0d9f00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000976ea74026e726554db657fa54763abd0c3a0aa90000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"