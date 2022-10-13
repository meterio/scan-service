import { BlockConcise } from './blockConcise.interface';

export interface LogEvent {
  address: string;
  topics: string[];
  data: string;
  txHash: string;
  block: BlockConcise;
  clauseIndex: number;
  logIndex: number;
}
