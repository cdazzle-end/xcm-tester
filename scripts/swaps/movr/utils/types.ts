import { ethers } from "ethers";

export interface GenericTx {
    type: string, // transfer or swap
    to: string, //Contract address
    wallet: ethers.Wallet,
    walletIndex: number,
    nonce: any
}