import {getParaspellChainName, getAssetBySymbolOrId } from './utils'

async function run(){
    getAssetBySymbolOrId("Acala", "KSM")
}

run()