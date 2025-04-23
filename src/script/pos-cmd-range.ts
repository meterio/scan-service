#!/usr/bin/env node
require('../utils/validateEnv');

import { connectDB, disconnectDB } from '../utils/db';
import { PosCMD } from '../cmd/pos.cmd';
import { Pos, runWithOptions } from '../utils';
import { BlockRepo, TxRepo } from '../repo';
import { findSourceMap } from 'module';

const runAsync = async (options) => {
  // const blockQueue = new BlockQueue('block');
  const { network, standby } = options;
  let shutdown = false;
  const startNum = 57622700;
  const endNum = 57625700;
  await connectDB(network, standby);
  const cmd = new PosCMD(network);
  const posREST = new Pos(network);
  const blockRepo = new BlockRepo();
  const txReop = new TxRepo();

  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGQUIT'];
  signals.forEach((sig) => {
    process.on(sig, async (s) => {
      process.stdout.write(`Got signal: ${s}, terminating...\n`);
      if (!shutdown) {
        shutdown = true;
        await disconnectDB();
        await cmd.stop();
        process.exit(0);
      }
    });
  });

  for (let blockNum = startNum; blockNum <= endNum; blockNum++) {
    const blockInDB = await blockRepo.findByNumber(blockNum);
    if (blockInDB) {
      console.log(`skip exisitng block ${blockNum}`);
      continue;
    }

    const blk = await posREST.getBlock(blockNum, 'expanded');
    console.log(`Process block ${blockNum} with pos cmd`);

    const result = await cmd.processBlock(blk);
    if (blockNum % 20 == 0) {
      console.log('save cache to db');
      try {
        await blockRepo.bulkInsert(...cmd.blocksCache);
        await txReop.bulkInsert(...cmd.txsCache);
      } catch (e) {
        console.log('ignore e', e.message);
      } finally {
        cmd.cleanCache();
      }
    }
  }
};

(async () => {
  // const blockQueue = new BlockQueue('block');
  try {
    await runWithOptions(runAsync);
    await disconnectDB();
  } catch (e) {
    console.log(`process error: ${e.name} ${e.message} - ${e.stack}`);
    process.exit(-1);
  }
})();
