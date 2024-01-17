import fs from 'fs';
import { privateKeyToAccount } from "viem/accounts";

export const ignoreList = [
    "0x06C08321a530360Ec1B3cC36CFe8b4ee419ce928",
    "0x423937ced38e44d7953098e92341dee103e945a8",
    "0xe41b4a4aa9f6c125e9045cb27cff112b6276d3b1",
    "0xd99111c3444dece8a29ebc38f437b53e9ced1cf9",
    "0x4f62d1f50b9f71e932e0e3410e32a7a211217031",
    "0x9e540174dde235ee828a0bc192a5b70453bd3e8c",
    "0xef049c45d83d007cc28222f9f375954ffac5471c",
    "0x06c08321a530360ec1b3cc36cfe8b4ee419ce928"
]

export const mnemonic = 'bottom drive obey lake curtain smoke basket hold race lonely fit walk';
export let privateKey = "0x5fb92d6e98884f76de468fa3f6278f8807c48bebc13595d45af5bdc4da702133"
export let noPrefixPrivateKey = privateKey.slice(2)

export const wsLocalChain = "ws://172.26.130.75:8000"
export const defaultWebsocket = "wss://moonriver.public.blastapi.io"
export const defaultRpc = "https://moonriver.public.blastapi.io"
export const localRpc = "http://127.0.0.1:8545/"

// export const rpcUrl = wsLocalChain
export const account = privateKeyToAccount(`0x${noPrefixPrivateKey}`);
// export const rpcUrl = 'INSERT_RPC_API_ENDPOINT'

export let dazzlePolk = "0xAe8Da4A9792503f1eC97eD035e35133A9E65a61f"
export const liveWallet = "0x13E8ABE5BE7E43A8a2c3B4C3Ff9752D665c9719E"
export const liveWalletPk = "0xb7ee929656517d31fcd447ef58132dee0643960c288987451a217ff6c38d77dd"
export const addressFrom = '0xf24FF3a9CF04c71Dbc94D0b566f7A27B94566cac'; //Alith
export const addressTo = '0x3Cd0A705a2DC65e5b1E1205896BaA2be8A07c6e0'; //Baltathazar
export const xTokensContract = "0x0000000000000000000000000000000000000804"
export const wmovrUsdcDexAddress = "0xe537f70a8b62204832b8ba91940b77d3f79aeb81"
export const movrContractAddress = "0x98878B06940aE243284CA214f92Bb71a2b032B8A"
export const usdcContractAddress = "0xE3F5a90F9cb311505cd691a46596599aA1A0AD7D"
export const solarDexRouterAddress = "0xAA30eF758139ae4a7f798112902Bf6d65612045f"
export const zenlinkDexRouterAddress = "0x2f84b9713a96FB356683de7B44dd2d37658b189d"
export const wmovrRmrkDexAddress = "0xdfeefa89639125d22ca86e28ce87b164f41afae6"
export const wmovrRmrkZenlinkAddress = "0x24336393742050233B8eCF873454F724D4083356"
export const xcKsmContractAddress = "0xFfFFfFff1FcaCBd218EDc0EbA20Fc2308C778080"
export const wmovrKsmDexAddress = "0xea3d1e9e69addfa1ee5bbb89778decd862f1f7c5"

export const test_account = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
export const test_account_pk = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"

export const boxContractAddress = "0x2bdCC0de6bE1f7D2ee689a0342D76F52E8EFABa3"
// export const batchContractAddress = "0xFD471836031dc5108809D173A067e8486B9047A3"
export const batchContractAddress2 = "0xcb0A9835CDf63c84FE80Fcc59d91d7505871c98B"
// export const ignoreList = JSON.parse(fs.readFileSync('./ignoreList.json', 'utf8'));

export const dexAbis = [
    JSON.parse(fs.readFileSync('./abi/solarDexAbi.json', 'utf8')),
    JSON.parse(fs.readFileSync('./abi/zenlinkDexAbi.json', 'utf8')),
    JSON.parse(fs.readFileSync('./abi/uniswapDexV2Abi.json', 'utf8'))
]
export const routerAbis = [
    JSON.parse(fs.readFileSync('./abi/solarRouterAbi.json', 'utf8')),
    JSON.parse(fs.readFileSync('./abi/zenRouterAbi.json', 'utf8')),
    JSON.parse(fs.readFileSync('./abi/huckleberryRouterAbi.json', 'utf8'))
]
export const solarRouterAddress = "0xAA30eF758139ae4a7f798112902Bf6d65612045f"
export const zenlinkRouterAddress = "0x2f84b9713a96FB356683de7B44dd2d37658b189d"
export const huckleberryRouterAddress = "0x2d4e873f9Ab279da9f1bb2c532d4F06f67755b77"
export const routerContracts = [
    solarRouterAddress,
    zenlinkRouterAddress,
    huckleberryRouterAddress
]

export const movrContractAbi = JSON.parse(fs.readFileSync('./abi/movrContractAbi.json', 'utf8'));
export const usdcContractAbi = JSON.parse(fs.readFileSync('./abi/usdcContractAbi.json', 'utf8'));
export const solarFee = 25 // 0.25%
export const zenFee = 30 // 0.3%
export const routerFees = [solarFee, zenFee]
