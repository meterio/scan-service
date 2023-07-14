#!/usr/bin/env node
require('../utils/validateEnv');

import { connectDB, disconnectDB } from '../utils/db';
import { IPowInfo } from '../model';
import { BlockRepo } from '../repo';
import { Pos, runWithOptions } from '../utils';

const runAsync = async (options) => {
  const { network, standby } = options;
  const pos = new Pos(network);
  await connectDB(network, standby);
  const blockRepo = new BlockRepo();
  let kblks = await blockRepo.findKBlocksWithoutPowBlocks();
  while (!!kblks && kblks.length > 0) {
    for (let kb of kblks) {
      console.log('fix for kblock: ', kb.number, kb.epoch);
      const info = await pos.getEpochInfo(kb.epoch);
      let powBlocks: IPowInfo[] = [];
      for (const pb of info.powBlocks) {
        powBlocks.push({
          hash: pb.hash,
          prevBlock: pb.previousBlockHash,
          height: pb.height,
          beneficiary: pb.Beneficiary || pb.beneficiary,
        });
      }
      kb.powBlocks = powBlocks;
      await kb.save();
      console.log(`updated with ${powBlocks.length} powblocks`);
    }
    kblks = await blockRepo.findKBlocksWithoutPowBlocks();
  }
  await disconnectDB();
};

(async () => {
  try {
    await runWithOptions(runAsync);
    await disconnectDB();
  } catch (e) {
    console.log(`start error: ${e.name} ${e.message} - ${e.stack}`);
    process.exit(-1);
  }
})();
