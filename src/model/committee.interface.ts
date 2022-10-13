import { CommitteeMember } from './block.interface';
import { BlockConcise } from './blockConcise.interface';
export interface Committee {
  epoch: number;
  kblockHeight: number;
  members: CommitteeMember[];
  startBlock: BlockConcise;
  endBlock?: BlockConcise;
}
