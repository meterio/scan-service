import BigNumber from 'bignumber.js';
import { FileChangeInfo } from 'fs/promises';
import { ContractType, Token } from '../const';

import { BlockConcise } from './blockConcise.interface';

export interface NFT {
  address: string;
  tokenId: string;
  value: number;
  type: string; // ERC721 or ERC1155

  // creation info
  minter: string;
  creationTxHash: string;
  block: BlockConcise;

  // ownership
  owner: string;

  // media
  tokenURI?: string;
  tokenJSON?: string; // stringified data from tokenURI
  mediaURI?: string;
  mediaType?: string;
  status: string;
}
