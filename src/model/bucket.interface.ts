import BigNumber from 'bignumber.js';

import { Token } from '../const';

export interface Bucket {
  id: string;
  owner: string;
  value: BigNumber;
  token: Token;
  nonce: number;
  createTime: number;
  unbounded: boolean;
  candidate: string;
  rate: number;
  option: number;
  bonusVotes: BigNumber;
  totalVotes: BigNumber;
  matureTime: number;
  calcLastTime: number;
}
