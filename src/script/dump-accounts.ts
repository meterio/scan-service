#!/usr/bin/env node
require('../utils/validateEnv');

import * as path from 'path';
import { Network } from '../const';
import { connectDB, disconnectDB } from '../utils/db';
import { AccountRepo } from '../repo';
import { checkNetworkWithDB, runWithOptions, saveCSV } from '../utils';

const runAsync = async (options) => {
  const { network, standby } = options;
  await connectDB(network, standby);
  const accountRepo = new AccountRepo();
  const accounts = await accountRepo.findAll();
  await checkNetworkWithDB(network);

  let accts = [];
  for (const acc of accounts) {
    if (acc.mtrBalance.isGreaterThan(0) || acc.mtrgBalance.isGreaterThan(0)) {
      accts.push({
        address: acc.address,
        mtr: acc.mtrBalance.dividedBy(1e18).toFixed(),
        mtrg: acc.mtrgBalance.dividedBy(1e18).toFixed(),
      });
    }
  }

  saveCSV(accts, ['address', 'mtr', 'mtrg'], path.join(__dirname, '..', '..', 'accounts.csv'));
  console.log('all done');
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
