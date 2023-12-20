// import fs from 'fs'
// import * as paraspell from '@paraspell/sdk'
// import { Observable } from 'rxjs'
// import { timeout } from 'rxjs/operators'
// import { WsProvider, ApiPromise, Keyring } from '@polkadot/api'
// import { FixedPointNumber } from '@acala-network/sdk-core'
// import { u8aToHex } from '@polkadot/util'
// import { EventRecord, Phase, Event, Hash } from '@polkadot/types/interfaces'
// import { ISubmittableResult, IU8a } from '@polkadot/types/types'
// import { TNode, getAssetsObject, getNode } from '@paraspell/sdk'
// // import * as bridge from '@polkawallet/bridge'
// // import * as adapters from '@polkawallet/bridge/adapters/index'
// // import * as adapters from '@polkawallet/bridge/adapters/index'
// import { BifrostAdapter } from '@polkawallet/bridge/adapters/bifrost'
// import { AstarAdapter } from '@polkawallet/bridge/adapters/astar'
// import { AcalaAdapter } from '@polkawallet/bridge/adapters/acala'
// import { BasiliskAdapter } from '@polkawallet/bridge/adapters/hydradx'
// import { AltairAdapter} from '@polkawallet/bridge/adapters/centrifuge'
// import { ShadowAdapter } from '@polkawallet/bridge/adapters/crust'
// import * as adapters from '@polkawallet/bridge/adapters'
// import { IntegriteeAdapter } from '@polkawallet/bridge/adapters/integritee'
// import { KintsugiAdapter } from '@polkawallet/bridge/adapters/interlay'
// import { KicoAdapter } from '@polkawallet/bridge/adapters/kico'
// import { PichiuAdapter } from '@polkawallet/bridge/adapters/kylin'
// import { CalamariAdapter } from '@polkawallet/bridge/adapters/manta'
// import { ParallelAdapter, HeikoAdapter } from '@polkawallet/bridge/adapters/parallel'
// import { KhalaAdapter } from '@polkawallet/bridge/adapters/phala'
// import { MoonbeamAdapter, MoonriverAdapter } from '@polkawallet/bridge/adapters/moonbeam'
// import { TuringAdapter } from '@polkawallet/bridge/adapters/oak'
// import { InterlayAdapter } from '@polkawallet/bridge/adapters/interlay'
// import { ZeitgeistAdapter } from '@polkawallet/bridge/adapters/zeitgeist'
// import { UniqueAdapter } from '@polkawallet/bridge/adapters/unique'
// import { StatemintAdapter } from '@polkawallet/bridge/adapters/statemint'
// import { StatemineAdapter } from '@polkawallet/bridge/adapters/statemint'
// import { QuartzAdapter } from '@polkawallet/bridge/adapters/unique'
// import { KaruraAdapter } from '@polkawallet/bridge/adapters/acala'
// import { KusamaAdapter } from '@polkawallet/bridge/adapters/polkadot'
// // import { TinkernetAdapter} from '@polkawallet/bridge/src/adapters/tinkernet'
// import { ShidenAdapter } from '@polkawallet/bridge/adapters/astar'
// import { CrabAdapter } from '@polkawallet/bridge/adapters/darwinia'
// import { ListenAdapter } from '@polkawallet/bridge/adapters/listen'
// import { RobonomicsAdapter } from '@polkawallet/bridge/adapters/robonomics'
// import { TinkernetAdapter } from '@polkawallet/bridge/adapters/tinkernet'
// import { MangataAdapter } from '../src/balance_adapters/mangata'
// // import { ZeitgeistAdapter } from '@polkawallet/bridge/adapters/zeitgeist'
// // import { BalanceData } from '@polkawallet/bridge/src/'
// // import * as bridge from '@polkawallet/bridge/src/'
// import { exec, execSync, spawn, ChildProcess } from 'child_process';
// import path from 'path';

// export function getAdapter(paraId: number){
//     if(paraId == 0){
//         return new KusamaAdapter()
//     }
    
//     if(paraId == 1000){
//         return new StatemineAdapter()
//     }
//     if(paraId == 2001){
//         return new BifrostAdapter()
//     }
//     if(paraId == 2000){
//         return new KaruraAdapter()
//     }
//     if(paraId == 2004){
//         return new KhalaAdapter()
//     }
//     if(paraId == 2095){
//         return new QuartzAdapter()
//     }
//     if(paraId == 2092){
//         return new KintsugiAdapter()
//     }
//     if(paraId == 2023){
//         return new MoonriverAdapter()
//     }
//     if(paraId == 2085){
//         return new HeikoAdapter()
//     }
//     if(paraId == 2107){
//         return new KicoAdapter()
//     }
//     if(paraId == 2012){
//         return new ShadowAdapter()
//     }
//     if(paraId == 2084){
//         return new CalamariAdapter()
//     }
//     if(paraId == 2015){
//         return new IntegriteeAdapter()
//     }
//     if(paraId == 2088){
//         return new AltairAdapter()
//     }
//     if(paraId == 2105){
//         return new CrabAdapter()
//     }
//     if(paraId == 2114){
//         return new TuringAdapter()
//     }
//     if(paraId == 2007){
//         return new ShidenAdapter()
//     }
//     if(paraId == 2102){
//         return new PichiuAdapter()
//     }
//     if(paraId == 2090){
//         return new BasiliskAdapter()
//     }
//     if(paraId == 2118){
//         return new ListenAdapter()
//     }
    
//     if(paraId == 2048){
//         return new RobonomicsAdapter()
//     }
//     if(paraId == 2125){
//         return new TinkernetAdapter()
//     }
//     if(paraId == 2110){
//         return new MangataAdapter()
//     }
//     throw new Error("No adapter for paraId " + paraId)
// }