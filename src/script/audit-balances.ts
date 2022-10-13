#!/usr/bin/env node
require('../utils/validateEnv');
import { BigNumber } from 'bignumber.js';
import { Network } from '../const';
import { AccountRepo, HeadRepo } from '../repo';
import { connectDB, disconnectDB } from '../utils/db';
import { Pos, checkNetworkWithDB, fromWei, runWithOptions } from '../utils';

const runAsync = async (options) => {
  const { network, standby } = options;

  await connectDB(network, standby);
  const headRepo = new HeadRepo();
  const accountRepo = new AccountRepo();
  const pos = new Pos(network);
  await checkNetworkWithDB(network);

  const posHead = await headRepo.findByKey('pos');
  console.log('POS Head:', posHead);

  let revision = '';
  if (network === Network.TestNet) {
    revision = '' + posHead.num;
  } else {
    revision = '' + posHead.num;
  }
  console.log(`Adjust account balances based on revision: ${revision}`);

  const accounts = await accountRepo.findAll();
  console.log(`start checking ${accounts.length} accounts...`);
  let n = 1;
  for (const acc of accounts) {
    const chainAcc = await pos.getAccount(acc.address, revision);

    const balance = new BigNumber(chainAcc.balance);
    const energy = new BigNumber(chainAcc.energy);
    const boundedBalance = new BigNumber(chainAcc.boundbalance);
    const boundedEnergy = new BigNumber(chainAcc.boundenergy);
    if (
      acc.mtrgBalance.toFixed() !== balance.toFixed() ||
      acc.mtrBalance.toFixed() !== energy.toFixed() ||
      acc.mtrgBounded.toFixed() !== boundedBalance.toFixed() ||
      acc.mtrBounded.toFixed() !== boundedEnergy.toFixed()
    ) {
      const preMTR = acc.mtrBalance;
      const preMTRG = acc.mtrgBalance;
      const preBoundedMTR = acc.mtrBounded;
      const preBoundedMTRG = acc.mtrgBounded;

      console.log('-'.repeat(50));
      console.log(`Found mismatching Account(${acc.address}):`);
      if (!preMTR.isEqualTo(energy)) {
        console.log(`MTR: ${fromWei(preMTR)} -> ${fromWei(energy)} `);
      }
      if (!preMTRG.isEqualTo(balance)) {
        console.log(`MTRG: ${fromWei(preMTRG)} -> ${fromWei(balance)}`);
      }
      if (!preBoundedMTR.isEqualTo(boundedEnergy)) {
        console.log(`Bounded MTR: ${fromWei(preBoundedMTR)} -> ${fromWei(boundedEnergy)}`);
      }
      if (!preBoundedMTRG.isEqualTo(boundedBalance)) {
        console.log(`Bounded MTRG: ${fromWei(preBoundedMTRG)} -> ${fromWei(boundedBalance)}`);
      }
    }
    if (n % 500 == 0) {
      console.log(`checked ${n} accounts`);
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
