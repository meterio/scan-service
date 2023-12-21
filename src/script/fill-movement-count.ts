#!/usr/bin/env node
require('../utils/validateEnv');

import { connectDB, disconnectDB } from '../utils/db';
import { TxRepo, MovementRepo } from '../repo';
import { runWithOptions } from '../utils';

const runAsync = async (options) => {
  const { network, standby } = options;

  await connectDB(network, standby);
  const txRepo = new TxRepo();
  const movementRepo = new MovementRepo();

  const txs = await txRepo.findAll();
  const txHashs = txs.map((a) => a.hash);
  console.log('tx hash length', txHashs.length)

  for (const hash of txHashs) {
    const movementCount = await movementRepo.countByTxHash(hash)
    console.log(`${movementCount} for ${hash}`)
    // await txRepo.updateMovementCount(hash, movementCount)
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
