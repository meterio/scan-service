import BigNumber from 'bignumber.js';
import { FileChangeInfo } from 'fs/promises';
import { ContractType, DeployStatus, Token } from '../const';

import { BlockConcise } from './blockConcise.interface';

export interface Contract {
  type: ContractType;
  address: string;

  name?: string;
  symbol?: string;
  decimals?: number;
  officialSite?: string;
  totalSupply: BigNumber;

  // deprecated
  holdersCount: BigNumber;
  // deprecated
  transfersCount: BigNumber;
  // deprecated
  tokensCount?: BigNumber;

  master: string;
  owner?: string;
  code: string;

  verified: Boolean;
  verifiedFrom?: string;
  status?: string;

  creationTxHash: string;
  creationInputHash?: string;
  codeHash?: string;
  firstSeen: BlockConcise;

  // proxy
  isProxy?: Boolean;
  proxyType?: string;
  implAddr?: string;
  prevImplAddr?: string;
  adminAddr?: string;
  beaconAddr?: string;

  // selfdestruct
  deployStatus?: DeployStatus;
  destructTxHash?: string;
  destructBlock?: BlockConcise;

  // token list related fields
  rank?: number;
  logoURI?: string;
}
