

interface DmpEvent {
    xcm: XcmEvent,
    deposit: DepositEvent,
    fee: FeeEvent
}
interface HrmpEvent {
    xcm: XcmEvent,
    deposit: DepositEvent,
    fee: FeeEvent
}
interface XcmEvent {
    section: string,
    method: string,
    idIndex: number

}
interface DepositEvent {
    section: string,
    method: string,
    amountIndex: number,
    addressIndex: number,
    index: number
}
interface FeeEvent {
    section: string,
    method: string,
    amountIndex: number,
    index: number
}
export interface TransferEvent {
    section: string,
    method: string,
    amountIndex: number,
    addressIndex: number
    eventIndex?: number
}

export interface XcmDepositEventData {
    xcm: XcmEvent,
    deposit: DepositEvent,
    fee: FeeEvent
}

export type TokenType = 'tokens' | 'native' 
export type TransferType = 'hrmp' | 'ump' | 'dmp'

export interface DepositEventDictionary {
    [key: string]: {
        ump?: XcmDepositEventData,
        dmp?: XcmDepositEventData,
        hrmp?: {
            tokens: XcmDepositEventData,
            native?: XcmDepositEventData
            
        },
    }

}
export interface TransferEventDictionary {
    [key: string]: {
        balanceEvents?: {
            nativeCurrency: TransferEvent,
            nativeTokens?: TransferEvent,
            foreignTokens?: TransferEvent
        }
        feeEvents: TransferEvent[]
    }
}

// REVIEW Temporary values until can create a better system. Only needed at the moment for Hydra -> Asset Hub when sending via xTokens.transferMultiassets
// Can find the relevant xcmp deposit events with normal dictionary. Then just need to filter for different event indexes with this 
// Also use this to get fee asset ID
export const multiassetsDepositEventDictionary = {
    "AssetHubPolkadot": {
        deposit: {
            section: "assets",
            method: "Issued", // returns assetId, owner, amount
            amountIndex: 2,
            addressIndex: 1,
            index: 1 // fee asset will be first asset event and deposit asset will be second asset event 
        },
        fee: {
            section: "assetConversion",
            method: "SwapCreditExecuted", // returns *amountIn, amountOut, path
            amountIndex: 0, // actual fee amount in USDT, which is converted to DOT
            index: 0   
        },
        feeAssetId: {
            section: "assets",
            method: "Issued",
            amountIndex: 2, // unused (total amount sent - actual fee amount)
            addressIndex: 1, // unused
            assetIdIndex: 0, // this is all we need for this event
            index: 0, // When transfer multiassets, fee asset will be first asset event and deposit asset will be second asset event 
        }
    },  
}

// Events related to the transfer on the receiving chain
export const depositEventDictionary: DepositEventDictionary = {
    "AssetHubPolkadot": {
        dmp: {
            xcm:{
                section: "messageQueue", 
                method: "Processed", // returns id, origin, weightUsed, success
                idIndex: 0,
            },
            deposit: {
                section: "balances",
                method: "Minted", // returns who, amount
                amountIndex: 1,
                addressIndex: 0,
                index: 0
            },
            fee: {
                section: "balances",
                method: "Deposit", // returns who, amount
                amountIndex: 1,
                index: 0
            }
        },
        hrmp: {
            tokens: {
                xcm:{
                    section: "messageQueue", 
                    method: "Processed", // returns id, origin, weightUsed, success
                    idIndex: 0
                },
                deposit: { 
                    section: "assets",
                    method: "Issued", // returns assetId, owner, amount
                    amountIndex: 2,
                    addressIndex: 1,
                    index: 0
                },
                // Converts the asset to native asset. We care about how much of our asset was converted to native asset.
                fee: {
                    section: "assetConversion",
                    method: "SwapCreditExecuted", // returns *amountIn, amountOut, path
                    amountIndex: 0,
                    index: 0    
                }
            },
            native: {
                xcm:{
                    section: "messageQueue", 
                    method: "Processed", // returns id, origin, weightUsed, success
                    idIndex: 0
                },
                deposit: { 
                    section: "assets",
                    method: "Issued", // returns assetId, owner, amount
                    amountIndex: 2,
                    addressIndex: 1,
                    index: 0
                },
                // Converts the asset to native asset. We care about how much of our asset was converted to native asset.
                fee: {
                    section: "assetConversion",
                    method: "SwapCreditExecuted", // returns *amountIn, amountOut, path
                    amountIndex: 0,
                    index: 0    
                }
            }

        }
    },  
    "Acala": {
        dmp: {
            xcm: {
                section: "messageQueue", 
                method: "Processed", // returns id, origin, weightUsed, success
                idIndex: 0
            },
            deposit: {
                section: "tokens",
                method: "Deposited",
                amountIndex: 2,
                addressIndex: 1,
                index: 1
            },
            fee: {
                section: "tokens",
                method: "Deposited",
                amountIndex: 2,
                index: 0
            }
        },
        // If asset is ACA, then the events are balances.Deposit instead
        hrmp: {
            native:{
                xcm: {
                    section: "messageQueue", 
                    method: "Processed", // returns id, origin, weightUsed, success
                    idIndex: 0
                },
                deposit: {
                    section: "balances",
                    method: "Deposit",
                    amountIndex: 1,
                    addressIndex: 0,
                    index: 1
                },
                fee: {
                    section: "balances",
                    method: "Deposit",
                    amountIndex: 1,
                    index: 0
                }
            },
            tokens: {
                xcm: {
                    section: "messageQueue", 
                    method: "Processed", // returns id, origin, weightUsed, success
                    idIndex: 0
                },
                deposit: {
                    section: "tokens",
                    method: "Deposited",
                    amountIndex: 2,
                    addressIndex: 1,
                    index: 1
                },
                fee: {
                    section: "tokens",
                    method: "Deposited",
                    amountIndex: 2,
                    index: 0
                }
            }

        }
    },
    "Moonbeam": {
        dmp: {
            xcm:{
                section: "messageQueue", 
                method: "Processed", // returns id, origin, weightUsed, success
                idIndex: -1,
            },
            deposit: {
                section: "assets",
                method: "Issued",
                amountIndex: 2,
                addressIndex: 1,
                index: 1
            },
            fee: {
                section: "assets",
                method: "Issued",
                amountIndex: 2,
                index: 0
            }
        },
        hrmp: {
            native: {
                xcm:{
                    section: "messageQueue", 
                    method: "Processed", // returns id, origin, weightUsed, success
                    idIndex: 0,
                },
                deposit: {
                    section: "balances",
                    method: "Minted",
                    amountIndex: 1,
                    addressIndex: 0,
                    index: 0
                },
                fee: {
                    section: "balances",
                    method: "Issued",
                    amountIndex: 0,
                    index: 0
                }
            },
            tokens: {
                xcm:{
                    section: "messageQueue", 
                    method: "Processed", // returns id, origin, weightUsed, success
                    idIndex: 0,
                },
                deposit: {
                    section: "assets",
                    method: "Issued",
                    amountIndex: 2,
                    addressIndex: 1,
                    index: 1
                },
                fee: {
                    section: "assets",
                    method: "Issued",
                    amountIndex: 2,
                    index: 0
                }
            },
        }
    },
    "HydraDX": {
        dmp: {
            // ** Hydra DMP message ID does not match polkadot xcmPallet messageId, so we need to identify events with address
            xcm: {
                section: "dmpQueue", 
                method: "ExecutedDownward", // returns hash, id, outcome
                idIndex: -1,
            },
            deposit: {
                section: "currencies",
                method: "Deposited", // currencyId, address, amount
                amountIndex: 2,
                addressIndex: 1,
                index: 1
            },
            fee: {
                section: "currencies",
                method: "Deposited", // currencyId, address, amount
                amountIndex: 2,
                index: 0    
            }
        },
        hrmp: {
            native: {
                xcm: {
                    section: "messageQueue", 
                    method: "Processed", // returns id, origin, weightUsed, success
                    idIndex: 0,
                },
                deposit: {
                    section: "currencies",
                    method: "Deposited", // currencyId, address, amount
                    amountIndex: 2,
                    addressIndex: 1,
                    index: 1
                },
                fee: {
                    section: "currencies",
                    method: "Deposited", // currencyId, address, amount
                    amountIndex: 2,
                    index: 0    
                }
            },
            tokens: {
                xcm: {
                    section: "messageQueue", 
                    method: "Processed", // returns id, origin, weightUsed, success
                    idIndex: 0,
                },
                deposit: {
                    section: "currencies",
                    method: "Deposited", // currencyId, address, amount
                    amountIndex: 2,
                    addressIndex: 1,
                    index: 1
                },
                fee: {
                    section: "currencies",
                    method: "Deposited", // currencyId, address, amount
                    amountIndex: 2,
                    index: 0    
                }
            }

        }

    },
    "Polkadot": {
        ump: {
            xcm: {
                section: "messageQueue", 
                method: "Processed", // returns id, origin, weightUsed, success
                idIndex: 0,
            },
            deposit: {
                section: "balances",
                method: "Minted", // returns who, amount
                amountIndex: 1,
                addressIndex: -1, // REVIEW Setting to -1 temporary. Does polkadot deposit need address index?
                index: 0
            },
            fee: {
                section: "balances",
                method: "Deposit", // returns who, amount
                amountIndex: 1,
                index: 0
            }
        },
    },
    "Interlay": {
        dmp: {
            xcm: {
                section: "dmpQueue", 
                method: "ExecutedDownward", // returns hash, id, outcome
                idIndex: -1,
            },
            deposit: {
                section: "tokens",
                method: "Deposited", // returns CurrencyId, who, amount
                amountIndex: 2,
                addressIndex: 1,
                index: 1
            },
            fee: {
                section: "tokens",
                method: "Deposited", // returns CurrencyId, who, amount
                amountIndex: 2,
                index: 0
            }
        },
        hrmp: {
            native: {
                xcm: {
                    section: "xcmpQueue", 
                    method: "Success", // returns id, origin, weightUsed, success
                    idIndex: 0,
                },
                deposit: {
                    section: "tokens",
                    method: "Deposited",
                    amountIndex: 2,
                    addressIndex: 1,
                    index: 1,
                },
                fee: {
                    section: "tokens",
                    method: "Deposited",
                    amountIndex: 2,
                    index: 0
                }
            },
            tokens: {
                xcm: {
                    section: "xcmpQueue", 
                    method: "Success", // returns id, origin, weightUsed, success
                    idIndex: 0,
                },
                deposit: {
                    section: "tokens",
                    method: "Deposited",
                    amountIndex: 2,
                    addressIndex: 1,
                    index: 1,
                },
                fee: {
                    section: "tokens",
                    method: "Deposited",
                    amountIndex: 2,
                    index: 0
                }
            }

        },

    },
    "Parallel": {
        dmp: {
            xcm: {
                section: "dmpQueue", 
                method: "ExecutedDownward", // returns hash, id, outcome
                idIndex: -1,
            },
            deposit: {
                section: "assets",
                method: "Issued", // returns CurrencyId, who, amount
                amountIndex: 2,
                addressIndex: 1,
                index: 1
            },
            fee: {
                section: "assets",
                method: "Issued", // returns CurrencyId, who, amount
                amountIndex: 2,
                index: 0
            }
        },
        hrmp: {
            native: {
                xcm: {
                    section: "xcmpQueue", 
                    method: "Success", // returns id, origin, weightUsed, success
                    idIndex: 0,
                },
                deposit: {
                    section: "assets",
                    method: "Issued",
                    amountIndex: 2,
                    addressIndex: 1,
                    index: 1,
                },
                fee: {
                    section: "assets",
                    method: "Issued",
                    amountIndex: 2,
                    index: 0
                }
            },
            tokens: {
                xcm: {
                    section: "xcmpQueue", 
                    method: "Success", // returns id, origin, weightUsed, success
                    idIndex: 0,
                },
                deposit: {
                    section: "assets",
                    method: "Issued",
                    amountIndex: 2,
                    addressIndex: 1,
                    index: 1,
                },
                fee: {
                    section: "assets",
                    method: "Issued",
                    amountIndex: 2,
                    index: 0
                }
            }

        }
    },
    "BifrostPolkadot": {
        dmp: {
            xcm: {
                section: "messageQueue",
                method: "Processed",
                idIndex: 0,
            },
            deposit: {
                section: "tokens",
                method: "Deposited",
                amountIndex: 2,
                addressIndex: 1,
                index:1
            },
            fee: {
                section: "tokens",
                method: "Deposited",
                amountIndex: 2,
                index: 0
            }
        },
        hrmp: {
            native: {
                xcm: {
                    section: "messageQueue",
                    method: "Processed",
                    idIndex: -1,
                },
                deposit: {
                    section: "balances",
                    method: "Deposit",
                    amountIndex: 1,
                    addressIndex: 0,
                    index:1
                },
                fee: {
                    section: "balances",
                    method: "Deposit",
                    amountIndex: 1,
                    index: 0
                }
            },
            tokens: {
                xcm: {
                    section: "messageQueue",
                    method: "Processed",
                    idIndex: -1,
                },
                deposit: {
                    section: "tokens",
                    method: "Deposited",
                    amountIndex: 2,
                    addressIndex: 1,
                    index:1
                },
                fee: {
                    section: "tokens",
                    method: "Deposited",
                    amountIndex: 2,
                    index: 0
                }
            }

        },

    },
    "Unique": {
        dmp: {
            xcm: {
                section: "dmpQueue",
                method: "ExecutedDownward",
                idIndex: 1, // messageHash, messageId are different
            },
            deposit: {
                section: "common",
                method: "ItemCreated",
                amountIndex: 3,
                addressIndex: 2, // 2[0]
                index: 0
            },
            fee: {
                section: "common",
                method: "ItemCreated",
                amountIndex: -1,
                index: -1
            }
        },
        hrmp: {
            native: {
                xcm: {
                    section: "xcmpQueue",
                    method: "Success",
                    idIndex: 1,
                },
                deposit: {
                    section: "balances",
                    method: "Minted",
                    amountIndex: 1,
                    addressIndex: 0,
                    index: 0
                },
                fee: {
                    section: "balances",
                    method: "Minted",
                    amountIndex: -1,
                    index: -1
                }
            },
            tokens: {
                xcm: {
                    section: "xcmpQueue",
                    method: "Success",
                    idIndex: 1,
                },
                deposit: {
                    section: "balances",
                    method: "Minted",
                    amountIndex: 1,
                    addressIndex: 0,
                    index: 0
                },
                fee: {
                    section: "balances",
                    method: "Minted",
                    amountIndex: -1,
                    index: -1
                }
            }

        },
    },

    "Phala": {
        hrmp: {
            native: {
                xcm: {
                    section: "xcmpQueue",
                    method: "Success",
                    idIndex: 1,
                },
                deposit: {
                    section: "balances",
                    method: "Deposit",
                    amountIndex: 1,
                    addressIndex: 0,
                    index: 1
                },
                fee: {
                    section: "balances",
                    method: "Deposit",
                    amountIndex: 1,
                    index:0
                }
            },
            tokens: {
                xcm: {
                    section: "xcmpQueue",
                    method: "Success",
                    idIndex: 1,
                },
                deposit: {
                    section: "balances",
                    method: "Deposit",
                    amountIndex: 1,
                    addressIndex: 0,
                    index: 1
                },
                fee: {
                    section: "balances",
                    method: "Deposit",
                    amountIndex: 1,
                    index:0
                }
            }

        },
    },


    "Crust": {
        hrmp: {
            native: {
                xcm: {
                    section: "xcmpQueue",
                    method: "Success",
                    idIndex: 1,
                },
                deposit: {
                    section: "balances",
                    method: "Deposit",
                    amountIndex: 1,
                    addressIndex: 0,
                    index: 0
                },
                fee: {
                    section: "balances",
                    method: "Withdraw",
                    amountIndex: 1,
                    index: 0
                }
            },
            tokens: {
                xcm: {
                    section: "xcmpQueue",
                    method: "Success",
                    idIndex: 1,
                },
                deposit: {
                    section: "balances",
                    method: "Deposit",
                    amountIndex: 1,
                    addressIndex: 0,
                    index: 0
                },
                fee: {
                    section: "balances",
                    method: "Withdraw",
                    amountIndex: 1,
                    index: 0
                }
            }

        }
    },
    "Centrifuge": {
        hrmp: {
            native: {
                xcm: {
                    section: "xcmpQueue",
                    method: "Success",
                    idIndex: 0,
                },
                deposit: {
                    section: "balances",
                    method: "Minted",
                    amountIndex: 1,
                    addressIndex: 0,
                    index: 1
                },
                fee: {
                    section: "balances",
                    method: "Minted",
                    amountIndex: 1,
                    index:0
                }
            },
            tokens: {
                xcm: {
                    section: "xcmpQueue",
                    method: "Success",
                    idIndex: 0,
                },
                deposit: {
                    section: "balances",
                    method: "Minted",
                    amountIndex: 1,
                    addressIndex: 0,
                    index: 1
                },
                fee: {
                    section: "balances",
                    method: "Minted",
                    amountIndex: 1,
                    index:0
                }
            }

        },
    },
    "Nodle": {
        hrmp: {
            native: {
                xcm: {
                    section: "xcmpQueue",
                    method: "Success",
                    idIndex: 1,
                },
                deposit: {
                    section: "balances",
                    method: "Deposit",
                    amountIndex: 1,
                    addressIndex: 0,
                    index: 0
                },
                fee: {
                    section: "balances",
                    method: "Withdraw",
                    amountIndex: 1,
                    index:0
                }
            },
            tokens: {
                xcm: {
                    section: "xcmpQueue",
                    method: "Success",
                    idIndex: 1,
                },
                deposit: {
                    section: "balances",
                    method: "Deposit",
                    amountIndex: 1,
                    addressIndex: 0,
                    index: 0
                },
                fee: {
                    section: "balances",
                    method: "Withdraw",
                    amountIndex: 1,
                    index:0
                }
            }

        },
    },
    "Pendulum": {
        // dmp: {
        //     xcm: {
        //         section: "dmpQueue",
        //         method: "ExecutedDownward",
        //         idIndex: -1,
        //     },
        //     deposit: {
        //         section: "tokens",
        //         method: "Deposited",
        //         amountIndex: 2,
        //         addressIndex: 1,
        //         index: 1
        //     },
        //     fee: {
        //         section: "tokens",
        //         method: "Deposited",
        //         amountIndex: 2,
        //         index:0
        //     }   
        // },
        hrmp: {
            native: {
                xcm: {
                    section: "xcmpQueue",
                    method: "Success",
                    idIndex: 0,
                },
                deposit: {
                    section: "balances",
                    method: "Deposit",
                    amountIndex: 1,
                    addressIndex: 0,
                    index: 1
                },
                fee: {
                    section: "balances",
                    method: "Deposit",
                    amountIndex: 1,
                    index: 0
                }
            },
            tokens: {
                xcm: {
                    section: "xcmpQueue",
                    method: "Success",
                    idIndex: 0,
                },
                deposit: {
                    section: "balances",
                    method: "Deposit",
                    amountIndex: 1,
                    addressIndex: 0,
                    index: 1
                },
                fee: {
                    section: "balances",
                    method: "Deposit",
                    amountIndex: 1,
                    index: 0
                }
            }

        },
    },
    "Zeitgeist": {
        hrmp: {
            native: {
                xcm: {
                    section: "xcmpQueue",
                    method: "Success",
                    idIndex: 0,
                },
                deposit: {
                    section: "balances",
                    method: "Deposit",
                    amountIndex: 1,
                    addressIndex: 0,
                    index: 1
                },
                fee: {
                    section: "balances",
                    method: "Deposit",
                    amountIndex: 1,
                    index: 0
                }
            },
            tokens: {
                xcm: {
                    section: "xcmpQueue",
                    method: "Success",
                    idIndex: 0,
                },
                deposit: {
                    section: "balances",
                    method: "Deposit",
                    amountIndex: 1,
                    addressIndex: 0,
                    index: 1
                },
                fee: {
                    section: "balances",
                    method: "Deposit",
                    amountIndex: 1,
                    index: 0
                }
            }

        }
    },
    "Subsocial": {

        hrmp: {
            native: {
                xcm: {
                    section: "xcmpQueue",
                    method: "Success",
                    idIndex: 0,
                },
                deposit: {
                    section: "balances",
                    method: "Deposit",
                    amountIndex: 1,
                    addressIndex: 0,
                    index: 1
                },
                fee: {
                    section: "balances",
                    method: "Deposit",
                    amountIndex: 1,
                    index: 0
                }
            },
            tokens: {
                xcm: {
                    section: "xcmpQueue",
                    method: "Success",
                    idIndex: 0,
                },
                deposit: {
                    section: "balances",
                    method: "Deposit",
                    amountIndex: 1,
                    addressIndex: 0,
                    index: 1
                },
                fee: {
                    section: "balances",
                    method: "Deposit",
                    amountIndex: 1,
                    index: 0
                }
            }

        }
    },
    "Kilt": {
        hrmp: {
            native: {
                xcm: {
                    section: "xcmpQueue",
                    method: "Success",
                    idIndex: 1,
                },
                deposit: {
                    section: "balances",
                    method: "Deposit",
                    amountIndex: 1,
                    addressIndex: 0,
                    index: 1
                },
                fee: {
                    section: "balances",
                    method: "Deposit",
                    amountIndex: 1,
                    index: 0
                }
            },
            tokens: {
                xcm: {
                    section: "xcmpQueue",
                    method: "Success",
                    idIndex: 1,
                },
                deposit: {
                    section: "balances",
                    method: "Deposit",
                    amountIndex: 1,
                    addressIndex: 0,
                    index: 1
                },
                fee: {
                    section: "balances",
                    method: "Deposit",
                    amountIndex: 1,
                    index: 0
                }
            }

        },
    },
    "Darwinia": {
        hrmp: {
            native: {
                xcm: {
                    section: "xcmpQueue",
                    method: "Success",
                    idIndex: 0,
                },
                deposit: {
                    section: "assets",
                    method: "Issued",
                    amountIndex: 1,
                    addressIndex: 0,
                    index: 1
                },
                fee: {
                    section: "assets",
                    method: "Issued",
                    amountIndex: 1,
                    index: 0
                }
            },
            tokens: {
                xcm: {
                    section: "xcmpQueue",
                    method: "Success",
                    idIndex: 0,
                },
                deposit: {
                    section: "assets",
                    method: "Issued",
                    amountIndex: 1,
                    addressIndex: 0,
                    index: 1
                },
                fee: {
                    section: "assets",
                    method: "Issued",
                    amountIndex: 1,
                    index: 0
                }
            }

        }
    },
    "Polkadex": {
        dmp: {
            xcm:{
                section: "dmpQueue", 
                method: "ExecutedDownward", // returns id, origin, weightUsed, success
                idIndex: -1,
            },
            deposit: {
                section: "xcmHelper",
                method: "AssetDeposited",
                amountIndex: 4,
                addressIndex: 0, // Multilocation.interior.x1.accountId32.id
                index: 0
            },
            fee: {
                section: "xcmHelper",
                method: "AssetDeposited",
                amountIndex: -1,
                index: -1
            }
        },
        hrmp: {
            native: {
                xcm:{
                    section: "xcmpQueue", 
                    method: "Success", // returns id, origin, weightUsed, success
                    idIndex: 1,
                },
                deposit: {
                    section: "xcmHelper",
                    method: "AssetDeposited",
                    amountIndex: 4,
                    addressIndex: 0, // Multilocation.interior.x1.accountId32.id
                    index: 0
                },
                fee: {
                    section: "xcmHelper",
                    method: "AssetDeposited",
                    amountIndex: -1,
                    index: -1
                }
            },
            tokens: {
                xcm:{
                    section: "xcmpQueue", 
                    method: "Success", // returns id, origin, weightUsed, success
                    idIndex: 1,
                },
                deposit: {
                    section: "xcmHelper",
                    method: "AssetDeposited",
                    amountIndex: 4,
                    addressIndex: 0, // Multilocation.interior.x1.accountId32.id
                    index: 0
                },
                fee: {
                    section: "xcmHelper",
                    method: "AssetDeposited",
                    amountIndex: -1,
                    index: -1
                }
            }

        },
    }
}

// Events related to the transfer on the sending chain
export const transferEventDictionary: TransferEventDictionary = {
    "AssetHubPolkadot": {
        balanceEvents: {
            nativeCurrency: {
                section: "balances",
                method: "Burned",
                amountIndex: 2,
                addressIndex: 1,
                eventIndex: 1
            },
            nativeTokens: {
                section: "assets",
                method: "Transferred",
                amountIndex: 2,
                addressIndex: 1,
                eventIndex:0
            },
            foreignTokens: {
                section: "assets",
                method: "Transferred",
                amountIndex: 2,
                addressIndex: 1,
                eventIndex:0
            }
        },
        feeEvents: [
            {
                section: "transactionPayment",
                method: "TransactionFeePaid",
                addressIndex: 0,
                amountIndex: 1,
                eventIndex: 0
            },
            {
                section: "balances",
                method: "Burned",
                addressIndex: 0,
                amountIndex: 1,
                eventIndex: 0
            }
        ]
    },
    // Native tokens and foreign assets are different. Native tokens and ACA can be treated the same cuz they both have a currencies.transferred event
    "Acala": {
        balanceEvents: {
            // native: {
            //     section: "balances",
            //     method: "Transfer",
            //     amountIndex: 2,
            //     addressIndex: 0,
            //     eventIndex: 0
            // },
            nativeCurrency: {
                section: "currencies",
                method: "Transferred",
                amountIndex: 3,
                addressIndex: 1,
                eventIndex: 0
            },
            nativeTokens: {
                section: "currencies",
                method: "Transferred",
                amountIndex: 3,
                addressIndex: 1,
                eventIndex: 0
            },
            foreignTokens: {
                section: "tokens",
                method: "Withdrawn",
                amountIndex: 2,
                addressIndex: 1,
                eventIndex:0
            }
        },
        feeEvents: [
            {
                section: "transactionPayment",
                method: "TransactionFeePaid",
                addressIndex: 0,
                amountIndex: 1,
                eventIndex: 0
            }
        ]
    },
    "Moonbeam": {
        balanceEvents: {
            nativeCurrency: {
                section: "balances",
                method: "Transfer",
                amountIndex: 2,
                addressIndex: 0,
                eventIndex: 0
            },
            nativeTokens: {
                section: "assets",
                method: "Burned",
                amountIndex: 2,
                addressIndex: 1,
                eventIndex:0
            },
            foreignTokens: {
                section: "assets",
                method: "Burned",
                amountIndex: 2,
                addressIndex: 1,
                eventIndex:0
            }
        },
        feeEvents: [
            {
                section: "transactionPayment",
                method: "TransactionFeePaid",
                addressIndex: 0,
                amountIndex: 1,
                eventIndex: 0
            }
        ]
    },
    "HydraDX": {
        balanceEvents: {
            nativeCurrency: {
                section: "balances",
                method: "Transfer",
                amountIndex: 2,
                addressIndex: 0,
                eventIndex: 0
            },
            nativeTokens: {
                section: "tokens",
                method: "Withdrawn",
                amountIndex: 2,
                addressIndex: 1,
                eventIndex:0
            },
            foreignTokens: {
                section: "tokens",
                method: "Withdrawn",
                amountIndex: 2,
                addressIndex: 1,
                eventIndex:0
            }
        },
        feeEvents: [
            {
                section: "transactionPayment",
                method: "TransactionFeePaid",
                addressIndex: 0,
                amountIndex: 1,
                eventIndex: 0
            }
        ]
    },
    "Polkadot": {
        balanceEvents: {
            nativeCurrency: {
                section: "balances",
                method: "Transfer",
                amountIndex: 2,
                addressIndex: 0,
                eventIndex: 0
            }
        },
        feeEvents: [
            {
                section: "transactionPayment",
                method: "TransactionFeePaid",
                addressIndex: 0,
                amountIndex: 1,
                eventIndex: 0
            },
            {
                section: "balances",
                method: "Burned",
                addressIndex: 0,
                amountIndex: 1,
                eventIndex: 0
            }
        ]
    },
    
    "Interlay": {
        balanceEvents: {
            nativeCurrency: {
                section: "tokens",
                method: "Withdrawn",
                amountIndex: 2,
                addressIndex: 0,
                eventIndex: 0
            },
            nativeTokens: {
                section: "tokens",
                method: "Withdrawn",
                amountIndex: 2,
                addressIndex: 1,
                eventIndex:0
            },
            foreignTokens: {
                section: "tokens",
                method: "Withdrawn",
                amountIndex: 2,
                addressIndex: 1,
                eventIndex:0
            }
        },
        feeEvents: [
            {
                section: "transactionPayment",
                method: "TransactionFeePaid",
                addressIndex: 0,
                amountIndex: 1,
                eventIndex: 0
            }
        ]
    },
    "Parallel": {
        balanceEvents: {
            nativeCurrency: {
                section: "balances",
                method: "Transfer",
                amountIndex: 2,
                addressIndex: 0,
                eventIndex: 0
            },
            nativeTokens: {
                section: "assets",
                method: "Burned",
                amountIndex: 2,
                addressIndex: 1,
                eventIndex:0
            },
            foreignTokens: {
                section: "assets",
                method: "Burned",
                amountIndex: 2,
                addressIndex: 1,
                eventIndex:0
            }
        },
        feeEvents: [
            {
                section: "transactionPayment",
                method: "TransactionFeePaid",
                addressIndex: 0,
                amountIndex: 1,
                eventIndex: 0
            }
        ]
    },
    "BifrostPolkadot": {
        balanceEvents: {
            nativeCurrency: {
                section: "balances",
                method: "Transfer",
                amountIndex: 2,
                addressIndex: 0,
                eventIndex: 0
            },
            nativeTokens: {
                section: "tokens",
                method: "Transfer",
                amountIndex: 3,
                addressIndex: 1,
                eventIndex:0
            },
            foreignTokens: {
                section: "tokens",
                method: "Withdrawn",
                amountIndex: 2,
                addressIndex: 1,
                eventIndex:0
            }
        },
        feeEvents: [
            {
                section: "transactionPayment",
                method: "TransactionFeePaid",
                addressIndex: 0,
                amountIndex: 1,
                eventIndex: 0
            }
        ]
    },
    "Unique": {
        balanceEvents: {
            nativeCurrency: {
                section: "balances",
                method: "Transfer",
                amountIndex: 2,
                addressIndex: 0,
                eventIndex: 0
            },
            // tokens: {
            //     section: "assets",
            //     method: "Burned",
            //     amountIndex: 2,
            //     addressIndex: 1,
            //     eventIndex:0
            // }
        },
        feeEvents: [
            {
                section: "balances",
                method: "Withdraw",
                addressIndex: 0,
                amountIndex: 1,
                eventIndex: 0
            }
        ]
    },
    "Phala": {
        balanceEvents: {
            nativeCurrency: {
                section: "balances",
                method: "Withdraw",
                amountIndex: 1,
                addressIndex: 0,
                eventIndex: 0
            },
            // tokens: {
            //     section: "assets",
            //     method: "Burned",
            //     amountIndex: 2,
            //     addressIndex: 1,
            //     eventIndex:0
            // }
        },
        feeEvents: [
            {
                section: "transactionPayment",
                method: "TransactionFeePaid",
                addressIndex: 0,
                amountIndex: 1,
                eventIndex: 0
            }
        ]
    },
    "Crust": {
        balanceEvents: {
            nativeCurrency: {
                section: "balances",
                method: "Transfer",
                amountIndex: 2,
                addressIndex: 0,
                eventIndex: 0
            },
            // tokens: {
            //     section: "assets",
            //     method: "Burned",
            //     amountIndex: 2,
            //     addressIndex: 1,
            //     eventIndex:0
            // }
        },
        feeEvents: [
            {
                section: "transactionPayment",
                method: "TransactionFeePaid",
                addressIndex: 0,
                amountIndex: 1,
                eventIndex: 0
            }
        ]
    },
    "Centrifuge": {
        balanceEvents: {
            nativeCurrency: {
                section: "balances",
                method: "Transfer",
                amountIndex: 2,
                addressIndex: 0,
                eventIndex: 0
            },
            // tokens: {
            //     section: "assets",
            //     method: "Burned",
            //     amountIndex: 2,
            //     addressIndex: 1,
            //     eventIndex:0
            // }
        },
        feeEvents: [
            {
                section: "transactionPayment",
                method: "TransactionFeePaid",
                addressIndex: 0,
                amountIndex: 1,
                eventIndex: 0
            }
        ]
    },
    "Nodle": {
        balanceEvents: {
            nativeCurrency: {
                section: "balances",
                method: "Transfer",
                amountIndex: 2,
                addressIndex: 0,
                eventIndex: 0
            },
            // tokens: {
            //     section: "assets",
            //     method: "Burned",
            //     amountIndex: 2,
            //     addressIndex: 1,
            //     eventIndex:0
            // }
        },
        feeEvents: [
            {
                section: "transactionPayment",
                method: "TransactionFeePaid",
                addressIndex: 0,
                amountIndex: 1,
                eventIndex: 0
            }
        ]
    },
    "Pendulum": {
        balanceEvents: {
            nativeCurrency: {
                section: "balances",
                method: "Transfer",
                amountIndex: 2,
                addressIndex: 0,
                eventIndex: 0
            },
            // tokens: {
            //     section: "assets",
            //     method: "Burned",
            //     amountIndex: 2,
            //     addressIndex: 1,
            //     eventIndex:0
            // }
        },
        feeEvents: [
            {
                section: "transactionPayment",
                method: "TransactionFeePaid",
                addressIndex: 0,
                amountIndex: 1,
                eventIndex: 0
            }
        ]
    },
    "Zeitgeist": {
        balanceEvents: {
            nativeCurrency: {
                section: "balances",
                method: "Transfer",
                amountIndex: 2,
                addressIndex: 0,
                eventIndex: 0
            },
            // tokens: {
            //     section: "assets",
            //     method: "Burned",
            //     amountIndex: 2,
            //     addressIndex: 1,
            //     eventIndex:0
            // }
        },
        feeEvents: [
            {
                section: "transactionPayment",
                method: "TransactionFeePaid",
                addressIndex: 0,
                amountIndex: 1,
                eventIndex: 0
            }
        ]
    },
    "Subsocial": {
        balanceEvents: {
            nativeCurrency: {
                section: "balances",
                method: "Transfer",
                amountIndex: 2,
                addressIndex: 0,
                eventIndex: 0
            },
            // tokens: {
            //     section: "assets",
            //     method: "Burned",
            //     amountIndex: 2,
            //     addressIndex: 1,
            //     eventIndex:0
            // }
        },
        feeEvents: [
            {
                section: "transactionPayment",
                method: "TransactionFeePaid",
                addressIndex: 0,
                amountIndex: 1,
                eventIndex: 0
            }
        ]
    },
    "Kilt": {
        balanceEvents: {
            nativeCurrency: {
                section: "balances",
                method: "Transfer",
                amountIndex: 2,
                addressIndex: 0,
                eventIndex: 0
            },
            // tokens: {
            //     section: "assets",
            //     method: "Burned",
            //     amountIndex: 2,
            //     addressIndex: 1,
            //     eventIndex:0
            // }
        },
        feeEvents: [
            {
                section: "transactionPayment",
                method: "TransactionFeePaid",
                addressIndex: 0,
                amountIndex: 1,
                eventIndex: 0
            }
        ]
    },
    "Darwinia": {
        balanceEvents: {
            nativeCurrency: {
                section: "balances",
                method: "Transfer",
                amountIndex: 2,
                addressIndex: 0,
                eventIndex: 0
            },
            // tokens: {
            //     section: "assets",
            //     method: "Burned",
            //     amountIndex: 2,
            //     addressIndex: 1,
            //     eventIndex:0
            // }
        },
        feeEvents: [
            {
                section: "transactionPayment",
                method: "TransactionFeePaid",
                addressIndex: 0,
                amountIndex: 1,
                eventIndex: 0
            }
        ]   
    },
    // "Polkadex": {

    // }

}