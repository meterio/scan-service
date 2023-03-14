#!/usr/bin/env node
require('../utils/validateEnv');

import { connectDB, disconnectDB } from '../utils/db';
import { AccountRepo, HeadRepo, LogTransferRepo, NFTRepo } from '../repo';
import { checkNetworkWithDB, runWithOptions } from '../utils';
import { Token } from '../const';
import BigNumber from 'bignumber.js';

const calcMintBurn = async (transferRepo: LogTransferRepo, token, start, end: number) => {
  let totalMint = new BigNumber(0);
  let totalBurn = new BigNumber(0);

  console.log(`calc token ${token} total mint/burns in block [${start}, ${end}]`);
  const mints = await transferRepo.findMintInRange(token, start, end);
  for (const tr of mints) {
    totalMint = totalMint.plus(tr.amount);
  }
  const burns = await transferRepo.findBurnInRange(token, start, end);
  for (const tr of burns) {
    totalBurn = totalBurn.plus(tr.amount);
  }
  return { totalMint, totalBurn };
};

const runAsync = async (options) => {
  const { network, standby } = options;
  await connectDB(network, standby);

  const headRepo = new HeadRepo();
  const transferRepo = new LogTransferRepo();
  const accountRepo = new AccountRepo();

  await checkNetworkWithDB(network);

  const mtrInit = new BigNumber('0x2a558d32fd7a3a4a0000');
  const mtrgInit = new BigNumber('0x39e7139a8c08fa06000000');
  let mtrMints = new BigNumber(0);
  let mtrBurns = new BigNumber(0);
  let mtrgMints = new BigNumber(0);
  let mtrgBurns = new BigNumber(0);

  const pos = await headRepo.findByKey('pos');
  const best = pos.num;
  const step = 1000000;
  for (let i = 0; i < best; i += step) {
    const start = i;
    const end = i + step - 1 > best ? best : i + step - 1;
    const mtrDelta = await calcMintBurn(transferRepo, Token.MTR, start, end);
    const mtrgDelta = await calcMintBurn(transferRepo, Token.MTRG, start, end);

    mtrMints = mtrMints.plus(mtrDelta.totalMint);
    mtrBurns = mtrBurns.plus(mtrDelta.totalBurn);
    mtrgMints = mtrgMints.plus(mtrgDelta.totalMint);
    mtrgBurns = mtrgBurns.plus(mtrgDelta.totalBurn);
  }
  console.log(`MTR Total Mint: `, mtrMints.toFixed(0));
  console.log(`MTR Total Burn: `, mtrBurns.toFixed(0));
  console.log(`Calculated MTR Total: `, mtrInit.plus(mtrMints).minus(mtrBurns).toFixed(0));
  console.log(`MTRG Total Mint: `, mtrgMints.toFixed(0));
  console.log(`MTRG Total Burn: `, mtrgBurns.toFixed(0));
  console.log(`Calculated MTRG Total: `, mtrgInit.plus(mtrgMints).minus(mtrgBurns).toFixed(0));

  const accts = await accountRepo.findAll();
  let mtrTotal = new BigNumber(0);
  let mtrgTotal = new BigNumber(0);
  for (const a of accts) {
    mtrTotal = mtrTotal.plus(a.mtrBalance).plus(a.mtrBounded);
    mtrgTotal = mtrgTotal.plus(a.mtrgBalance).plus(a.mtrgBounded);
  }
  console.log('---------------------------------------------');
  console.log(`Account MTR Total: `, mtrTotal.toFixed(0));
  console.log(`Account MTRG Total: `, mtrgTotal.toFixed(0));
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
