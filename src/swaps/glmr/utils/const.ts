import fs from 'fs';
import { privateKeyToAccount } from "viem/accounts";
import * as dotenv from "dotenv";
// dotenv.config()
import path from 'path';
import { fileURLToPath } from 'url';
import bn from 'bignumber.js'
import { ethers } from 'ethers';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
// console.log(__dirname)

export const ignoreList = [
    // "0x06C08321a530360Ec1B3cC36CFe8b4ee419ce928",
    // "0x423937ced38e44d7953098e92341dee103e945a8",
    // "0xe41b4a4aa9f6c125e9045cb27cff112b6276d3b1",
    // "0xd99111c3444dece8a29ebc38f437b53e9ced1cf9",
    // "0x4f62d1f50b9f71e932e0e3410e32a7a211217031",
    // "0x9e540174dde235ee828a0bc192a5b70453bd3e8c",
    // "0xef049c45d83d007cc28222f9f375954ffac5471c",
    // "0x06c08321a530360ec1b3cc36cfe8b4ee419ce928",
    // "0xD053Ed287F7dF209bf32f40E71D04095A8dA2989",
    // "0x6e555293c3417e314d9ffdf339fbdabb2fe699e6",
    // "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199",
    // "0x4c05b9ab3bf4222b576c3cafc0d10891badd34ad",
    // "0xd053ed287f7df209bf32f40e71d04095a8da2989",
    // "0xe5fff70b2e265f6784e2300bb88a29d5cb012b8a",
    // "0x711ab763e638ad40554ad7c685afbb3a43aebf48",
    // "0xa797283915E42a0243d9C536f55046b547723B13",
    // "0x92b8ccdcd31a3343e77d6f9e717a43d12a2ec7a6"
    // "0x3933b0214b3b117fb52646343076d229817a4e4b"

]

export const mnemonic = 'bottom drive obey lake curtain smoke basket hold race lonely fit walk';
export let privateKey = "0x5fb92d6e98884f76de468fa3f6278f8807c48bebc13595d45af5bdc4da702133"
export let noPrefixPrivateKey = privateKey.slice(2)

export const wsLocalChain = "ws://172.26.130.75:9009"
export const defaultWebsocket = "wss://moonbeam.public.blastapi.io"
export const defaultRpc = "https://moonbeam.public.blastapi.io"
export const localRpc = "http://127.0.0.1:8545/"
// export const localRpc = "http://127.0.0.1:2020202020/"

// export const rpcUrl = wsLocalChain
export const account = privateKeyToAccount(`0x${noPrefixPrivateKey}`);
// export const rpcUrl = 'INSERT_RPC_API_ENDPOINT'

export let dazzlePolk = "0xAe8Da4A9792503f1eC97eD035e35133A9E65a61f"
export const liveWallet = "0x13E8ABE5BE7E43A8a2c3B4C3Ff9752D665c9719E"
export const liveWallet3 = "0x1A73c8A6aBd21b5cD8969a531E2Ace452cbA5f73"
export const liveWallet3Pk = process.env.LIVE_WALLET_3_PK
export const addressFrom = '0xf24FF3a9CF04c71Dbc94D0b566f7A27B94566cac'; //Alith
export const addressTo = '0x3Cd0A705a2DC65e5b1E1205896BaA2be8A07c6e0'; //Baltathazar
export const glmrDotAlgebraDex = "0xB13B281503F6eC8A837Ae1a21e86a9caE368fCc5"
export const glmrFraxDexContract = "0xd3bE0E32147ae91378F035fF96f3e2cAb96aC48b" // FraxSwap
export const glmrMantaDexContract = "0xF50d2fC5C03b14A4e47E22A27Bbbf6EaA62eF13F" // Algebra
export const glmrWellContract = "0xb536c1F9A157B263B70A9a35705168ACC0271742" // Stella
export const glmrGlintContract = "0x99588867e817023162F4d4829995299054a5fC57" // Beam
export const glmrRmrkContract = "0x583aF38702c2A53619558ACBc758a77d0C0918e9" // Algebra
export const glmrSTDotContract = "0xaC6CCDe03B940EbcEA55115B3F573cB93CFC96c0" // Algebra
export const glmrWormUsdcContract = "0xaB8C35164a8e3EF302d18DA953923eA31f0Fe393" // Algebra
export const glmrWormUsdcContractBeamV3 = "0xF7e2F39624AAd83AD235A090bE89b5fa861c29B8" //BeamV3
export const glmrUsdcFrax = "0x72DB5EB3907b3CC44D962FdCA44cFC329672bcDC" // Possible 3pool
export const glmrPoopContract = "0xa049a6260921B5ee3183cFB943133d36d7FdB668"
// export const xTokensContract = "0x0000000000000000000000000000000000000804"
// export const wmovrUsdcDexAddress = "0xe537f70a8b62204832b8ba91940b77d3f79aeb81"
// export const wmovrFraxDexAddress = "0x2cc54b4A3878e36E1C754871438113C1117a3ad7"
// export const movrContractAddress = "0x98878B06940aE243284CA214f92Bb71a2b032B8A"
// export const usdcFraxDexAddress = "0x310C4d18640aF4878567c4A31cB9cBde7Cd234A3" //SushiSwap
// export const usdcContractAddress = "0xE3F5a90F9cb311505cd691a46596599aA1A0AD7D"
export const fraxContractAddress = "0x322E86852e492a7Ee17f28a78c663da38FB33bfb"
// export const solarDexRouterAddress = "0xAA30eF758139ae4a7f798112902Bf6d65612045f"
// export const zenlinkDexRouterAddress = "0x2f84b9713a96FB356683de7B44dd2d37658b189d"
// export const wmovrRmrkDexAddress = "0xdfeefa89639125d22ca86e28ce87b164f41afae6"
// export const wmovrRmrkZenlinkAddress = "0x24336393742050233B8eCF873454F724D4083356"

// export const wmovrKsmDexAddress = "0xea3d1e9e69addfa1ee5bbb89778decd862f1f7c5"

//XC TOKENS
export const wGlmrContractAddress = "0xAcc15dC74880C9944775448304B263D191c6077F"
export const wEthContractAddress = "0xab3f0245B83feB11d15AAffeFD7AD465a59817eD"
export const usdcContractAddress = "0x931715FEE2d06333043d11F658C8CE934aC61D0c"

export const xcDotContractAddress = "0xFfFFfFff1FcaCBd218EDc0EbA20Fc2308C778080"
export const xcAcaContractAddress = "0xffffFFffa922Fef94566104a6e5A35a4fCDDAA9f"
export const rmrkContractAddress = "0x524d524B4c9366be706D3A90dcf70076ca037aE3"
export const xcUsdcContractAddress = "0xFFfffffF7D2B0B761Af01Ca8e25242976ac0aD7D"
export const wormUsdcContractAddress = "0x931715FEE2d06333043d11F658C8CE934aC61D0c"
export const glintContractAddress = "0xcd3B51D98478D53F4515A306bE565c6EebeF1D58" //beam
export const glmrSTDotContractAddress = "0xbc7E02c4178a7dF7d3E564323a5c359dc96C4db4"
// export const xcKsmContractAddress = "0xFfFFfFff1FcaCBd218EDc0EbA20Fc2308C778080"
// export const xcKsmLocalId = "42259045809535163221576417993425387648"
// export const xcRmrkContractAddress = "0xffffffFF893264794d9d57E1E0E21E0042aF5A0A"
// export const xcRmrkLocalId = "182365888117048807484804376330534607370"
// export const xcKintContractAddress = "0xfffFFFFF83F4f317d3cbF6EC6250AeC3697b3fF2"
// export const xcKintLocalId = "175400718394635817552109270754364440562"
// export const xcCsmContractAddress = "0xffFfFFFf519811215E05eFA24830Eebe9c43aCD7"
// export const xcCsmLocalId = "108457044225666871745333730479173774551"
// export const xcKarContractAddress = "0xFfFFFFfF08220AD2E6e157f26eD8bD22A336A0A5"
// export const xcKarLocalId = "10810581592933651521121702237638664357"
// export const xcXrtContractAddress = "0xFffFFffF51470Dca3dbe535bD2880a9CcDBc6Bd9"
// export const xcXrtLocalId = "108036400430056508975016746969135344601"
// export const xcTokens = [xcKsmContractAddress, xcRmrkContractAddress, xcKintContractAddress, xcCsmContractAddress]
// export const xcLocalIds = [xcKsmLocalId, xcRmrkLocalId, xcKintLocalId, xcCsmLocalId]

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
    JSON.parse(fs.readFileSync(path.join(__dirname, '../abi/algebraDex.json'), 'utf8')),
    JSON.parse(fs.readFileSync(path.join(__dirname, '../abi/beamDex.json'), 'utf8')),
    JSON.parse(fs.readFileSync(path.join(__dirname, '../abi/beamV3Dex.json'), 'utf8')),
    // JSON.parse(fs.readFileSync(path.join(__dirname, '../abi/zenlinkDexAbi.json'), 'utf8')),
    JSON.parse(fs.readFileSync(path.join(__dirname, '../abi/uniswapDexV2Abi.json'), 'utf8')),
    JSON.parse(fs.readFileSync(path.join(__dirname, '../abi/stellaDexAbi.json'), 'utf8')),
    JSON.parse(fs.readFileSync(path.join(__dirname, '../abi/fraxDexAbi.json'), 'utf8')),
]
export const routerAbis = [
    // JSON.parse(fs.readFileSync(path.join(__dirname, '../abi/solarRouterAbi.json'), 'utf8')),
    // JSON.parse(fs.readFileSync(path.join(__dirname, '../abi/zenRouterAbi.json'), 'utf8')),
    // JSON.parse(fs.readFileSync(path.join(__dirname, '../abi/huckleberryRouterAbi.json'), 'utf8')),
]
// export const solarRouterAddress = "0xAA30eF758139ae4a7f798112902Bf6d65612045f"
// export const zenlinkRouterAddress = "0x2f84b9713a96FB356683de7B44dd2d37658b189d"
// export const huckleberryRouterAddress = "0x2d4e873f9Ab279da9f1bb2c532d4F06f67755b77"
// export const routerContracts = [
//     solarRouterAddress,
//     zenlinkRouterAddress,
//     huckleberryRouterAddress
// ]

// export const movrContractAbi = JSON.parse(fs.readFileSync(path.join(__dirname,'../abi/movrContractAbi.json'), 'utf8'));

// export const usdcContractAbi = JSON.parse(fs.readFileSync(path.join(__dirname,'../abi/usdcContractAbi.json'), 'utf8'));
export const solarFee = BigInt(25) // 0.25%
// // export const zenFee = BigInt(30) // 0.3%
// export const solarFee = 25 // 0.25%
export const zenFee = 30 // 0.3%
// // export const routerFees: bigint[] = [solarFee, zenFee]
export const routerFees = [solarFee, zenFee]

// export const testDataContractAddress = "0xcc2a7cef44caa59847699104629e034ea7d89f6a"
// export const testTxData = "0x42643f97000000000000000000000000e3f5a90f9cb311505cd691a46596599aa1a0ad7d00000000000000000000000098878b06940ae243284ca214f92bb71a2b032b8a000000000000000000000000cc2a7cef44caa59847699104629e034ea7d89f6a000000000000000000000000000000000000000000000000000000000000090600000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a4022c0d9f00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000976ea74026e726554db657fa54763abd0c3a0aa90000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"

export const simpleAbis = [

]

// let uniV3SwapSimpleAbi = [
//     // "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline)",
//     "function swap(address recipient, bool zeroForOne, int256 amountSpecified, uint160 sqrtPriceLimitX96, bytes data)",
//     "function token0() view returns (address)",
//     "function token1() view returns (address)",
//     "function "
    
//     recipient (address)
//     zeroForOne (bool)
//     amountSpecified (int256)
//     sqrtPriceLimitX96 (uint160)
//     data (bytes)


// ]

export const multicall1 = "0x83e3b61886770de2F64AAcaD2724ED4f08F7f36B"
export const multicall2 = "0x6477204E12A7236b9619385ea453F370aD897bb2"
export const multicall3 = "0xcA11bde05977b3631167028862bE2a173976CA11"
export const multicallAbi1 = fs.readFileSync(path.join(__dirname, '../abi/multicall1.json'), 'utf8')

export const multicallAbi2 = fs.readFileSync(path.join(__dirname, '../abi/multicall2.json'), 'utf8')

export const multicallAbi3 = fs.readFileSync(path.join(__dirname, '../abi/multicall3.json'), 'utf8')

import { TickData } from './types.ts';
export const rpc1 = 'wss://moonbeam.public.blastapi.io';
export const rpc2 = 'wss://moonbeam-rpc.dwellir.com';
// const rpc3 = 'wss://moonriver.api.onfinality.io/public-ws';
export const rpc4 = 'wss://moonbeam.unitedbloc.com'
export const testZenContract = "0x94F9EB420174B8d7396A87c27073f74137B40Fe2"
export const testUni3Contract = "0x3Ecb97daE88c33717CE92596a593b41556a2ebc0"

export const wsProvider = new ethers.WebSocketProvider(rpc2);
export const httpEndpoint1 = "https://moonbeam.public.blastapi.io"
export const httpEndpoint2 = "https://1rpc.io/glmr"
export const httpEndpoint3 = "https://moonbeam-rpc.dwellir.com"
export const httpEndpoint4 = "https://moonbeam-mainnet.gateway.pokt.network/v1/lb/629a2b5650ec8c0039bb30f0"
export const httpEndpoint5 = "https://moonbeam.unitedbloc.com"

export const glmrDotPool = "0xB13B281503F6eC8A837Ae1a21e86a9caE368fCc5"


export const httpProvider = new ethers.JsonRpcProvider(httpEndpoint4)
export const live_wallet_3 = process.env.LIVE_WALLET_3_PK

export const dexContractAbi = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function getReserves() view returns (uint, uint, uint)",
    "function token0() view returns (address)",
    "function token1() view returns (address)"
]

//getReserves returns 2 uint instead of 3
export const altDexContractAbi = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function getReserves() view returns (uint, uint)",
    "function token0() view returns (address)",
    "function token1() view returns (address)"
]

export const tokenContractAbi = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "event Transfer(address indexed src, address indexed dst, uint val)"
]

// export const dexAbis = [
    
//     JSON.parse(fs.readFileSync(path.join(__dirname, './glmr_abis/solarDexAbi.json'), 'utf8')),
//     JSON.parse(fs.readFileSync(path.join(__dirname, './glmr_abis/uniswapDexV3.json'), 'utf8')),
//     JSON.parse(fs.readFileSync(path.join(__dirname, './glmr_abis/algebraDex.json'), 'utf8')),
//     JSON.parse(fs.readFileSync(path.join(__dirname, './glmr_abis/beamDex.json'), 'utf8')),
//     JSON.parse(fs.readFileSync(path.join(__dirname, './glmr_abis/beamV3Dex.json'), 'utf8')),
//     JSON.parse(fs.readFileSync(path.join(__dirname, './glmr_abis/stellaDexAbi.json'), 'utf8')),
//     JSON.parse(fs.readFileSync(path.join(__dirname, './glmr_abis/zenlinkDexAbi.json'), 'utf8')),
//     JSON.parse(fs.readFileSync(path.join(__dirname, './glmr_abis/zenlinkDex2Abi.json'), 'utf8')),
// ]

export let dexAbiMap = {
    "solar": JSON.parse(fs.readFileSync(path.join(__dirname, '../abi/solarDexAbi.json'), 'utf8')),
    "uni3": JSON.parse(fs.readFileSync(path.join(__dirname, '../abi/uniswapDexV3.json'), 'utf8')),
    "algebra": JSON.parse(fs.readFileSync(path.join(__dirname, '../abi/algebraDex.json'), 'utf8')),
    "beam": JSON.parse(fs.readFileSync(path.join(__dirname, '../abi/beamDex.json'), 'utf8')),
    "beam3": JSON.parse(fs.readFileSync(path.join(__dirname, '../abi/beamV3Dex.json'), 'utf8')),
    "stella": JSON.parse(fs.readFileSync(path.join(__dirname, '../abi/stellaDexAbi.json'), 'utf8')),
    "zenlink": JSON.parse(fs.readFileSync(path.join(__dirname, '../abi/zenlinkDexAbi.json'), 'utf8')),
    "zenlink2": JSON.parse(fs.readFileSync(path.join(__dirname, '../abi/zenlinkDex2Abi.json'), 'utf8')),
    "manager": JSON.parse(fs.readFileSync(path.join(__dirname, '../abi/swapManager.json'), 'utf8'))
}

export let xcTokenAbi = JSON.parse(fs.readFileSync(path.join(__dirname, '../abi/xcTokenAbi.json'), 'utf8'))
// export const wGlmrContractAddress = "0xAcc15dC74880C9944775448304B263D191c6077F"
// export const xcDotContractAddress = "0xFfFFfFff1FcaCBd218EDc0EbA20Fc2308C778080"
// export const xcAcaContractAddress = "0xffffFFffa922Fef94566104a6e5A35a4fCDDAA9f"
// export const rmrkContractAddress = "0x524d524B4c9366be706D3A90dcf70076ca037aE3"
// export const xcUsdcContractAddress = "0xFFfffffF7D2B0B761Af01Ca8e25242976ac0aD7D"
// export const wormUsdcContractAddress = "0x931715FEE2d06333043d11F658C8CE934aC61D0c"
// export const glintContractAddress = "0xcd3B51D98478D53F4515A306bE565c6EebeF1D58" //beam
// export const glmrSTDotContractAddress = "0xbc7E02c4178a7dF7d3E564323a5c359dc96C4db4"
export const q96 = new bn(2).pow(96)

export const minTick = -887272
export const maxTick = 887272

export const minTickData: TickData = {
        tick: minTick,
        liquidityTotal: "0",
        liquidityDelta: "0",
        intialized: false
    }
export const maxTickData: TickData = {
        tick: maxTick,
        liquidityTotal: "0",
        liquidityDelta: "0",
        intialized: false
    }



export const swapManagerContractLocal = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707"
export const swapManagerContractLive = "0x4BF47cE8738d447B94727B6ae01BAB6389144E98"


export const uniFactoryContract = "0x28f1158795A3585CaAA3cD6469CD65382b89BB70"
export const uniPoolInitHash = "0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54"
export const algebraFactoryContract = "0xabE1655110112D0E45EF91e94f8d757e4ddBA59C"
export const algebraPoolInitHash = "0x424896f6cdc5182412012e0779626543e1dc4b12e1c45ee5718ae92f10ad97f2"
export const algebroPoolInitHashOther = "0x6ec6c9c8091d160c0aa74b2b14ba9c1717e95093bd3ac085cee99a49aab294a4"
export const algebraPoolDeployer = "0x965A857955d868fd98482E9439b1aF297623fb94"