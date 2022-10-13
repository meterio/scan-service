import { BlockConcise } from './blockConcise.interface';

export interface LogTransfer {
  sender: string;
  recipient: string;
  amount: string;
  token: number;

  block: BlockConcise;
  txHash: string;
  clauseIndex: number;
  logIndex: number;
}
