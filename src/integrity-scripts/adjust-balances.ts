#!/usr/bin/env node
require('../utils/validateEnv');
import { BigNumber } from 'bignumber.js';
import { Token } from '../const';
import { AccountRepo, HeadRepo } from '../repo';
import { connectDB, disconnectDB } from '../utils/db';

import { PrototypeAddress, ZeroAddress, prototype } from '../const';
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

  const revision = '' + posHead.num;
  console.log(`Adjust account balances based on revision: ${revision}`);

  const accounts = await accountRepo.findAll();
  console.log('start checking...');
  for (const acc of accounts) {
    let chainAcc: Flex.Meter.Account;
    let chainCode: Flex.Meter.Code;
    let chainMaster: string | null = null;
    try {
      chainAcc = await pos.getAccount(acc.address, revision);
      chainCode = await pos.getCode(acc.address, revision);
      // Get master
      let ret = await pos.explain(
        {
          clauses: [
            {
              to: PrototypeAddress,
              value: '0x0',
              data: prototype.master.encode(acc.address),
              token: Token.MTR,
            },
          ],
        },
        revision
      );
      let decoded = prototype.master.decode(ret[0].data);
      if (decoded['0'] !== ZeroAddress) {
        chainMaster = decoded['0'];
      }
    } catch {
      continue;
    }

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
      acc.mtrBalance = energy;
      acc.mtrgBalance = balance;
      acc.mtrBounded = boundedEnergy;
      acc.mtrgBounded = boundedBalance;

      await acc.save();

      console.log('-'.repeat(50));
      console.log(`Fixing Account(${acc.address}):`);
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
