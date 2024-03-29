#!/usr/bin/env node
require('../utils/validateEnv');

import { ContractRepo } from '../repo';
import { connectDB, disconnectDB } from '../utils/db';
import { checkNetworkWithDB, runWithOptions } from '../utils';
import { Keccak } from 'sha3';

const runAsync = async (options) => {
  const { network, standby } = options;

  await connectDB(network, standby);
  const contractRepo = new ContractRepo();
  await checkNetworkWithDB(network);

  const incorrectVerified = await contractRepo.findIncorrectVerified();
  for (const ic of incorrectVerified) {
    ic.verified = false;
    ic.verifiedFrom = undefined;
    ic.status = '';
    console.log(`set to unverified for ${ic.address}`);
    await ic.save();
  }

  const contracts = await contractRepo.findEmptyCodeHash();
  for (const c of contracts) {
    const hash = new Keccak(256);
    hash.update(c.code.replace('0x', ''));
    const codeHash = hash.digest('hex');
    c.codeHash = codeHash;
    console.log(`update codeHash for ${c.address}`);
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
