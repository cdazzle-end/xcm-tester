export class TokenNotFound extends Error {
    constructor(token: string, network?: string) {
      super();
  
      if (network) {
        this.message = `can't find ${token} in ${network}`;
      } else {
        this.message = `can't find ${token} in current network`;
      }
  
      this.name = "TokenNotFound";
    }
  }

export class InvalidAddress extends Error {
    constructor(address: string) {
        super();

        this.message = `Address ${address} is invalid.`;
        this.name = "InvalidAddress";
    }
}
  
export class ApiNotFound extends Error {
    constructor(network: string) {
      super();
  
      this.message = `Api not set for ${network} adapter`;
      this.name = "ApiNotFound";
    }
  }
export class AdapterNotFound extends Error {
    constructor(network: string) {
        super();

        this.message = `${network} adapter not find`;
        this.name = "AdapterNotFound";
    }
}