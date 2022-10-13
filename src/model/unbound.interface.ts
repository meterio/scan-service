import BigNumber from 'bignumber.js';

import { Token } from '../const';
import { BlockConcise } from './blockConcise.interface';

export interface Unbound {
  owner: string;
  amount: BigNumber;
  token: Token;

  block: BlockConcise;
  txHash: string;
  clauseIndex: number;
  logIndex: number;
}
