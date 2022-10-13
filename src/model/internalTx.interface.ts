import BigNumber from 'bignumber.js';

import { Token } from '../const';
import { BlockConcise } from './blockConcise.interface';

export interface InternalTx {
  // tx basic
  txHash: string;
  block: BlockConcise;
  txIndex: number;
  name: string;
  from: string;
  to: string;
  value: BigNumber;

  // clause
  clauseIndex: number;

  // tx digest
  signature?: string;
  fee: BigNumber;

  // receipt
  gasUsed: number;
  reverted: boolean;
}
