import BigNumber from 'bignumber.js';

import { Token } from '../const';

export interface AuctionDist {
  address: string;
  amount: BigNumber;
  token: Token;
}

export interface AuctionTx {
  txid: string;
  address: string;
  amount: string;
  type: string;
  timestamp: number;
  nonce: number;
}

export interface AuctionSummary {
  id: string;
  startHeight: number;
  startEpoch: number;
  endHeight: number;
  endEpoch: number;
  sequence: number;
  createTime: number;
  releasedMTRG: BigNumber;
  reservedMTRG: BigNumber;
  reservedPrice: BigNumber;
  receivedMTR: BigNumber;
  actualPrice: BigNumber;
  leftoverMTRG: BigNumber;
  txs: AuctionTx[];
  distMTRG: AuctionDist[];
}
