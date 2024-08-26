# Arb Executor Notes

## Fee Structure

Fee reserves are logged per execution in results/xcmReserveFees [example](./scripts/instructions/logResults/chopsticks/polkadot/xcmReserveFees/2024-07-19/Polkadot_21-17-34.json)
as ReserveFeeData

arb-finder uses feeBook to calculate xcm fees [feeBook](deprecated/eventFeeBook.json)

### Arb-Finder types
arb-finder rust structs that parse [feeBook]
pub struct TransferDepositFeeBook{
    #[serde(rename = "polkadot-transfer")]
    pub polkadot_transfer: HashMap<String, ChainTransferData>,
    #[serde(rename = "polkadot-deposit")]
    pub polkadot_deposit: HashMap<String, ChainDepositData>,
}
pub struct ChainTransferData {
    #[serde(flatten)]
    pub assets: HashMap<String, TransferData>,
}
pub struct ChainDepositData {
    #[serde(flatten)]
    pub assets: HashMap<String, DepositData>,
}
pub struct TransferData {
    pub transferAmount: Option<String>,
    pub transferDecimals: Option<String>,
    pub transferAssetSymbol: Option<String>,
    // #[serde(deserialize_with = "deserialize_to_string")]
    transferAssetId: serde_json::Value,
    pub feeAmount: Option<String>,
    pub feeDecimals: Option<String>,
    pub feeAssetSymbol: Option<String>,
    // #[serde(deserialize_with = "deserialize_to_string")]
    feeAssetId: serde_json::Value,
}
pub struct DepositData {
    pub depositAmount: Option<String>,
    pub feeAmount: Option<String>,
    pub feeDecimals: Option<String>,
    pub feeAssetSymbol: Option<String>,
    // #[serde(deserialize_with = "deserialize_to_string")]
    feeAssetId: serde_json::Value,
}

### Arb-Executor Fee Types



export interface DepositEventData {
    depositAmount: bn
    depositAssetSymbol: string,
    depositAssetId: string,
    depositAssetDecimals: number,
    feeAmount: bn,
    feeAssetSymbol: string,
    feeAssetId: string,
    feeAssetDecimals: number,
    node: TNode | "Polkadot" | "Kusama"
}

export interface TransferEventData {
    transferAmount: bn,
    transferAssetSymbol: string,
    transferAssetId: string,
    transferAssetDecimals: number,
    feeAmount: bn,
    feeAssetSymbol: string,
    feeAssetId: string,
    feeAssetDecimals: number,
    node: TNode | "Polkadot" | "Kusama"
}

export interface ReserveFeeData {
    chainId: number,
    feeAssetId: string,
    feeAssetAmount: string,
    reserveAssetId: string,
    reserveAssetAmount: string
}

### Execution Flow

Fees are logged at the end of each successful xcm transfer

executeSingleTransferExtrinsic

 - logEventFeeBook - (TransferEventData and DepositEventData from transfer event listeners. FeeBook used  by arb finder)
 - updateAccumulatedFeeData - Updates globalState.accumulatedFees (used in logAccumulatedFees()), accumulatedFees.json file (test file), feeTracker.json/chopsticksFeeTracker.json
 - updateXcmFeeReserves - Adds ReserveFeeData from latest transfer to globalState.xcmFeeReserves