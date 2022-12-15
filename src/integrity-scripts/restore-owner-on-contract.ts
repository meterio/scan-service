#!/usr/bin/env node
require('../utils/validateEnv');

import { ContractRepo } from '../repo';
import { connectDB, disconnectDB } from '../utils/db';
import { checkNetworkWithDB, runWithOptions } from '../utils';

const runAsync = async (options) => {
  const { network, standby } = options;

  await connectDB(network, standby);
  const contractRepo = new ContractRepo();
  await checkNetworkWithDB(network);

  const contracts = await contractRepo.findEmptyOwners();

  for (const c of contracts) {
    c.master = c.master.toLowerCase();
    c.owner = c.owner.toLowerCase();
    await c.save();
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
