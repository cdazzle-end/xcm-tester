import path, { join } from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


export const arbFinderPath = `C:/Users/dazzl/CodingProjects/substrate/arb-finder/`

export const assetRegistryPath = `C:/Users/dazzl/CodingProjects/substrate/polkadot_assets/assets/`
export const lpRegistryPath = `C:/Users/dazzl/CodingProjects/substrate/polkadot_assets/lps/`

// export const lpRegistryPath = path.join(assetRegistryPath, '/lps/lp_registry/')
export const acalaStableLpsPath = path.join(lpRegistryPath, `/lp_registry/aca_stable_lps.json`)
export const glmrLpsPath = path.join(lpRegistryPath, '/lp_registry/glmr_lps.json')

// export const assetRegistryPath = path.join(polkadotAssetsPath, `/assets/`)
export const polkadotAssetRegistryPath = path.join(assetRegistryPath, '/asset_registry/allAssetsPolkadotCollected.json')
export const kusamaAssetRegistryPath = path.join(assetRegistryPath, '/asset_registry/allAssetsKusamaCollected.json')
