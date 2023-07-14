#!/usr/bin/env node
require('../utils/validateEnv');

import { BigNumber } from 'bignumber.js';
import { IInternalTx } from '../model';
import { HeadRepo, TxRepo, InternalTxRepo, ContractRepo } from '../repo';
import { connectDB, disconnectDB } from '../utils/db';
import { ZeroAddress } from '../const';
import { checkNetworkWithDB, runWithOptions } from '../utils';
import { GetBucketRequestPaymentRequest } from '@aws-sdk/client-s3';

const runAsync = async (options) => {
  const { network, standby } = options;

  await connectDB(network, standby);
  const headRepo = new HeadRepo();
  const contractRepo = new ContractRepo();
  const internalTxRepo = new InternalTxRepo();
  await checkNetworkWithDB(network);

  const posHead = await headRepo.findByKey('pos');
  const best = posHead.num;
  const step = 500000;

  for (let i = 0; i < best; i += step) {
    let internalTxs: IInternalTx[] = [];
    const start = i;
    const end = i + step - 1 > best ? best : i + step - 1;

    const cs = await contractRepo.findFirstSeenInRange(start, end);
    console.log(`searching for contracts in blocks [${start}, ${end}]`);
    for (const c of cs) {
      if (!c.rank) {
        c.rank = 0;
        console.log(`update contract ${c.address} rank to 0`);
        await c.save();
      }
    }

    await internalTxRepo.bulkInsert(...internalTxs);
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
