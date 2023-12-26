#!/usr/bin/env node
require('../utils/validateEnv');

import { connectDB, disconnectDB } from '../utils/db';
import { TxRepo, MovementRepo, HeadRepo } from '../repo';
import { runWithOptions } from '../utils';
import PromisePool from '@supercharge/promise-pool';

const runAsync = async (options) => {
  const { network, standby } = options;

  await connectDB(network, standby);
  const headRepo = new HeadRepo();
  const txRepo = new TxRepo();
  const movementRepo = new MovementRepo();

  const poshead = await headRepo.findByKey('pos');
  const best = poshead.num;
  const step = 1000;

  for (let i = 0; i < best; i += step) {
    const start = i;
    const end = i + step - 1 > best ? best : i + step - 1;

    const movementCounts = await movementRepo.groupCountByTxHash(start, end);

    await PromisePool.withConcurrency(20)
      .for(movementCounts)
      .process(async (mc) => {
        const tx = await txRepo.findByHash(mc._id);
        if (tx.movementCount != mc.count) {
          tx.movementCount = mc.count;
          await tx.save();
          console.log(`update movement count to ${mc.count} for tx ${tx.hash}`);
        }
      });
  }
};

(async () => {
  try {
    await runWithOptions(runAsync);
    await disconnectDB();
  } catch (e) {
    console.log(`error: ${e.name} ${e.message} - ${e.stack}`);
    process.exit(-1);
  }
})();
