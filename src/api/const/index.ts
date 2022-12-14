export * from '../../const/address';
// export * from './abi';
export * from '../../const/types';
export * from './presets';

export const enumVals = (es: any) => {
  return Object.keys(es).map((key) => es[key] as string);
};

export const RECENT_WINDOW = 5;
export const LIMIT_WINDOW = 10;
export const UNIT_SHANNON = 1e9;
export const UNIT_WEI = 1e18;

export const SWAP_GAS_NEED = {
  privateKey: process.env.SWAPPER_PRIVATE_KEY,
  rpc: process.env.SWAPPER_RPC_URL,
};

export const TWITTER_NEED = {
  privateKey: process.env.SWAPPER_PRIVATE_KEY,
  twitterContract: process.env.TWITTER_CONTRACT,
  rpc: process.env.SWAPPER_RPC_URL,
  nftWalletContract: process.env.NFT_WALLET_CONTRACT,
}