import BigNumber from 'bignumber.js';
import { FileChangeInfo } from 'fs/promises';
import { ContractType, Token } from '../const';

import { BlockConcise } from './blockConcise.interface';

export interface Contract {
  type: ContractType;
  address: string;

  name?: string;
  symbol?: string;
  decimals?: number;
  officialSite?: string;
  totalSupply: BigNumber;

  holdersCount: BigNumber;
  transfersCount: BigNumber;

  master: string;
  code: string;

  verified: Boolean;
  verifiedFrom?: string;
  status?: string;

  creationTxHash: string;
  creationInputHash?: string;
  firstSeen: BlockConcise;
}
