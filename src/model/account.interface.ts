import BigNumber from 'bignumber.js';

import { BlockConcise } from './blockConcise.interface';

export interface Account {
  address: string;
  name: string;
  alias: string[];

  mtrBalance: BigNumber;
  mtrgBalance: BigNumber;

  mtrBounded: BigNumber;
  mtrgBounded: BigNumber;

  mtrRank: number;
  mtrgRank: number;

  firstSeen: BlockConcise;
  lastUpdate: BlockConcise;
}
