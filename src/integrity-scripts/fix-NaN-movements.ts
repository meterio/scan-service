#!/usr/bin/env node
require('../utils/validateEnv');

import { HeadRepo, LogEventRepo, MovementRepo, TxDigestRepo } from '../repo';
import { connectDB, disconnectDB } from '../utils/db';
import { checkNetworkWithDB, runWithOptions } from '../utils';
import { Token } from '../const';
import { ERC20, ERC20ABI } from '@meterio/devkit';
import { BigNumber } from 'bignumber.js';

const runAsync = async (options) => {
  const { network, standby } = options;

  await connectDB(network, standby);
  const headRepo = new HeadRepo();
  const movementRepo = new MovementRepo();
  const eventRepo = new LogEventRepo();
  await checkNetworkWithDB(network);

  const pos = await headRepo.findByKey('pos');
  const best = pos.num;
  const step = 100000;
  const start = 35000000;

  for (let i = start; i < best; i += step) {
    const start = i;
    const end = i + step - 1 > best ? best : i + step - 1;
    console.log(`searching for movements in blocks [${start}, ${end}]`);
    const mvts = await movementRepo.findByTokenInRange(Token.ERC20, start, end);
    for (const mvt of mvts) {
      if (mvt.amount.toString() != 'NaN') {
        continue;
      }
      console.log('found invalid movement: ', mvt);
      const evt = await eventRepo.findById(mvt.txHash, mvt.clauseIndex, mvt.logIndex);
      if (evt) {
        const decoded = ERC20.Transfer.decode(evt.data, evt.topics);
        const actualAmount = new BigNumber(decoded.value.toString());
        mvt.amount = actualAmount;
        await mvt.save();
        console.log(`updated movement amount from ${mvt.amount.toNumber()} to ${actualAmount.toNumber()}`);
      }
    }
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
