import {
  AnyApi,
  FixedPointNumber,
  FixedPointNumber as FN,
} from "@acala-network/sdk-core";
import {
  firstValueFrom,
  combineLatest,
  from,
  Observable,
  of,
  timeout,
  TimeoutError,
} from "rxjs";
import { catchError, map } from "rxjs/operators";

import { SubmittableExtrinsic } from "@polkadot/api/types";
import { ISubmittableResult } from "@polkadot/types/types";

import { ChainId, chains } from "./configs";
import {
  AdapterNotFound,
  TokenNotFound,
} from "./errors";
import {
  BalanceChangeStatue,
  BalanceData,
  BasicToken,
  Chain,
  BalanceChangeConfig,
  RouteConfigs,
  TokenBalance,
} from "./types";

const DEFAULT_TX_CHECKING_TIMEOUT = 2 * 60 * 1000;

export abstract class BaseCrossChainAdapter {
  protected routers: RouteConfigs[];
  protected tokens: Record<string, BasicToken>;
  protected api?: AnyApi;
  readonly chain: Chain;
  // @ts-ignore
  private findAdapter!: (chain: Chain | ChainId) => BaseCrossChainAdapter;

  constructor(
    chain: Chain,
    routers: RouteConfigs[],
    tokens: Record<string, BasicToken>
  ) {
    this.chain = chain;
    this.routers = routers;
    this.tokens = tokens;
  }

  public abstract init(api: AnyApi, ...others: any[]): Promise<void>;

  public getApi() {
    return this.api;
  }

  public injectFindAdapter(
    func: (chain: ChainId | Chain) => BaseCrossChainAdapter
  ): void {
    this.findAdapter = func;
  }

  public getSS58Prefix(): number {
    return Number(this.api?.registry.chainSS58?.toString());
  }

  public getToken<R extends BasicToken = BasicToken>(
    token: string,
    chain?: ChainId
  ): R {
    let tokenConfig: BasicToken;

    if (!chain) return this.tokens[token] as R;

    if (chain === this.chain.id) {
      tokenConfig = this.tokens[token];
    } else {
      const destAdapter = this.findAdapter(chain);

      if (!destAdapter) {
        throw new AdapterNotFound(token);
      }

      tokenConfig = destAdapter.tokens[token];
    }

    if (!tokenConfig) throw new TokenNotFound(token, chain);

    return tokenConfig as R;
  }

  public getDestED(token: string, destChain: ChainId): TokenBalance {
    const tokenConfig = this.getToken(token, destChain);

    return {
      token,
      balance: FN.fromInner(tokenConfig.ed, tokenConfig.decimals),
    };
  }

  public subscribeBalanceChange(
    configs: BalanceChangeConfig
  ): Observable<BalanceChangeStatue> {
    const { address, amount, token, tolerance } = configs;
    // allow 1% tolerance as default
    const target = amount.mul(new FN(1 - (tolerance || 0.01)));

    let savedBalance: FN | undefined;

    return this.subscribeTokenBalance(token, address).pipe(
      timeout(configs.timeout || DEFAULT_TX_CHECKING_TIMEOUT),
      map((balance) => {
        if (!savedBalance) {
          savedBalance = balance.available;
        }

        const diff = balance.available.minus(savedBalance);

        if (savedBalance && diff.gte(target)) {
          return BalanceChangeStatue.SUCCESS;
        }

        return BalanceChangeStatue.CHECKING;
      }),
      catchError((e: Error) => {
        if (e instanceof TimeoutError) {
          return of(BalanceChangeStatue.TIMEOUT);
        }

        return of(BalanceChangeStatue.UNKNOWN_ERROR);
      })
    );
  }

  public watchBalanceChange(
    config: BalanceChangeConfig,
    callback: (error?: Error, status?: BalanceChangeStatue) => void
  ) {
    const subscriber = this.subscribeBalanceChange(config).subscribe({
      next: (status) => callback(undefined, status),
      error: (e) => callback(e, undefined),
    });

    return subscriber.unsubscribe;
  }

  public abstract subscribeTokenBalance(
    token: string,
    address: string
  ): Observable<BalanceData>;

  public getTokenBalance(token: string, address: string): Promise<BalanceData> {
    return firstValueFrom(this.subscribeTokenBalance(token, address));
  }
}
