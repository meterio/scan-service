#!/usr/bin/env node
require('../utils/validateEnv');

/***
 * list balances snapshot at tipping block num
 * including: address, balance (snapshot), tipping timestamp - first seen timestamp
 */
import * as path from 'path';
import { BigNumber } from 'bignumber.js';
import { connectDB, disconnectDB } from '../utils/db';
import { AccountRepo } from '../repo';
import { Pos, fromWei, saveCSV, runWithOptions } from '../utils';

const tippingBlockNum = 14063032;

const runAsync = async (options) => {
  const { network, standby } = options;
  const pos = new Pos(network);
  const keyBlock = await pos.getBlock(tippingBlockNum, 'regular');

  await connectDB(network, standby);
  const accountRepo = new AccountRepo();
  const accts = await accountRepo.findAll();
  const balances = [];
  for (const acct of accts) {
    const b = await pos.getBalanceOnRevision(tippingBlockNum, acct.address);
    if (
      new BigNumber(b.balance).isGreaterThanOrEqualTo(10e18) ||
      new BigNumber(b.boundbalance).isGreaterThanOrEqualTo(10e18)
    ) {
      balances.push({
        address: acct.address,
        mtrg: fromWei(b.balance, 2),
        mtr: fromWei(b.energy, 2),
        boundedMTRG: fromWei(b.boundbalance, 2),
        ndays: Math.floor((keyBlock.timestamp - acct.firstSeen.timestamp) / 3600 / 24),
      });
    }
  }

  saveCSV(
    balances,
    ['address', 'mtrg', 'boundedMTRG', 'mtr', 'ndays'],
    path.join(__dirname, '..', '..', 'balances-snapshot.csv')
  );
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
