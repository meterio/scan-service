import BigNumber from 'bignumber.js';

export interface Auction {
  id: string;
  startHeight: number;
  startEpoch: number;
  endHeight: number;
  endEpoch: number;

  auctionStartHeight: number;
  auctionStartEpoch: number;
  auctionStartTxHash: string;
  auctionStartClauseIndex: number;

  auctionEndHeight?: number;
  auctionEndEpoch?: number;
  auctionEndTxHash?: string;
  auctionEndClauseIndex?: number;

  sequence: number;
  createTime: number;
  releasedMTRG: BigNumber;
  reservedMTRG: BigNumber;
  reservedPrice: BigNumber;
  receivedMTR?: BigNumber;
  actualPrice?: BigNumber;
  leftoverMTRG?: BigNumber;

  pending: boolean;
  bidCount: number;
  autobidTotal: BigNumber;
  userbidTotal: BigNumber;
  toSummary?(): object;
}
