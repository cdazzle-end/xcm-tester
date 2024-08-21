import path from "path";
import fs from "fs";
import {
    LastNode,
    Relay,
    ExtrinsicSetResultDynamic,
    TransactionState,
    TransferProperties,
    SwapProperties,
    ExecutionSuccess,
    ExecutionState,
    SingleSwapResultData,
    SingleTransferResultData,
    FeeData,
    FeeTracker,
    FeeTrackerEntry,
    ReserveFeeData,
} from "./types.ts";
import { fileURLToPath } from "url";
import { BigNumber as bn } from "bignumber.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class GlobalState {
    private static instance: GlobalState;
    private state: ExecutionState;
    private stateFilePath: string;

    private constructor(relay: "kusama" | "polkadot") {
        this.stateFilePath = path.join(
            __dirname,
            `./executionState/${relay}.json`
        );
        this.state = this.loadState();
    }

    public static getInstance(relay?: "kusama" | "polkadot"): GlobalState {
        if (!GlobalState.instance && relay) {
            GlobalState.instance = new GlobalState(relay);
        } else if (!GlobalState.instance && !relay) {
            throw new Error("Relay must be specified when creating the initial instance");
        }
        return GlobalState.instance;
    }

    private getDefaultState(): ExecutionState {
        return {
            tracking: true,
            relay: null,
            lastNode: null,
            lastFilePath: null,
            extrinsicSetResults: null,
            transactionState: null,
            transactionProperties: null,
            executionSuccess: false,
            executionAttempts: 0,
            accumulatedFeeData: null,
            xcmFeeReserves: null,
        };
      }

    public resetState() {
        this.state = this.getDefaultState();
        this.saveState();
      }
    

    private loadState(): ExecutionState {
        try {
            return JSON.parse(fs.readFileSync(this.stateFilePath, "utf8"));
        } catch (error) {
            // If file doesn't exist or is invalid, return default state
            return {
                tracking: true,
                relay: null,
                lastNode: null,
                lastFilePath: null,
                extrinsicSetResults: null,
                transactionState: null,
                transactionProperties: null,
                executionSuccess: false,
                executionAttempts: 0,
                accumulatedFeeData: null,
                xcmFeeReserves: null,
            };
        }
    }



    private saveState() {
        fs.writeFileSync(
            this.stateFilePath,
            JSON.stringify(this.state, null, 2),
            "utf8"
        );
    }

    getState(): Readonly<ExecutionState> {
        return this.state;
    }

    updateState(newState: Partial<ExecutionState>) {
        this.state = { ...this.state, ...newState };
        if (this.state.tracking) {
            this.saveState();
        }
    }

    // Add specific methods for updating individual properties
    setLastNode(node: LastNode) {
        this.updateState({ lastNode: node });
    }

    setLastFile(filePath: string) {
        this.updateState({ lastFilePath: filePath });
    }

    setLastExtrinsicSet(extrinsicSet: ExtrinsicSetResultDynamic) {
        this.updateState({ extrinsicSetResults: extrinsicSet });
    }

    setResultData(resultData: SingleSwapResultData | SingleTransferResultData) {
        if (this.state.extrinsicSetResults == null) {
            this.state.extrinsicSetResults = {
                allExtrinsicResults: [],
                success: false,
                lastSuccessfulNode: null,
            };
        }
        this.state.extrinsicSetResults.allExtrinsicResults.push(resultData);
        this.state.extrinsicSetResults.success = resultData.success;
        this.state.extrinsicSetResults.lastSuccessfulNode = this.state.lastNode;
        this.saveState();
    }

    setTransactionState(transactionState: TransactionState) {
        this.updateState({ transactionState });
    }

    setTransactionProperties(properties: TransferProperties | SwapProperties) {
        this.updateState({ transactionProperties: properties });
    }

    setExecutionSuccess(success: boolean) {
        if (success) {
            this.updateState({ executionSuccess: true, executionAttempts: 0 });
        } else {
            this.updateState({
                executionSuccess: false,
                executionAttempts: this.state.executionAttempts + 1,
            });
        }
    }

    setExecutionRelay(relay: Relay) {
        this.updateState({ relay });
        this.stateFilePath = path.join(
            __dirname,
            `./executionState/${relay}.json`
        );
        this.saveState();
    }
    /**
     * Updates globalState.xcmFeeReserves: ReserveFeeData[]
     * - Adds ReserveFeeData fom latest xcm transfer
     * 
     * NOT USED YET Need to implement function to pay back reserves
     * 
     * @param reserveFees - ReserveFeeData
     * @param relay Which relay to use
     */
    updateXcmFeeReserves(reserveFees: ReserveFeeData[]){
        if (this.state.xcmFeeReserves == null) {
            this.state.xcmFeeReserves = []
        }
        reserveFees.forEach((reserveFeeData) => this.state.xcmFeeReserves!.push(reserveFeeData))
        this.saveState()
    }
}
