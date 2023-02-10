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
  tokensCount?: BigNumber;

  master: string;
  owner?: string;
  code: string;

  verified: Boolean;
  verifiedFrom?: string;
  status?: string;

  creationTxHash: string;
  creationInputHash?: string;
  firstSeen: BlockConcise;

  // proxy
  isProxy?: Boolean;
  proxyType?: string;
  implAddr?: string;
  prevImplAddr?: string;
  adminAddr?: string;
  beaconAddr?: string;
}
