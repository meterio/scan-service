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
  console.log('best ', best)
  const step = 100000;
  
  for (let i = 0; i < best; i += step) {
    const start = i;
    const end = i + step - 1 > best ? best : i + step - 1;

    const txs = await txRepo.findInRange(start, end);
    const txHashs = txs.map((a) => a.hash);
    console.log(`tx hash ${start}-${end} length:`, txHashs.length)

    await PromisePool.withConcurrency(20)
      .for(txHashs)
      .process(async hash => {
        const movementCount = await movementRepo.countByTxHash(hash)
        console.log(`${movementCount} for ${hash}`)
        await txRepo.updateMovementCount(hash, movementCount)
        console.log(`saved for ${movementCount} to tx ${hash}`)
    })
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
