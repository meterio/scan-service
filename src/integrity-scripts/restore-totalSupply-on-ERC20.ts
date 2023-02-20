#!/usr/bin/env node
require('../utils/validateEnv');

import { HeadRepo, ContractRepo } from '../repo';
import { connectDB, disconnectDB } from '../utils/db';
import { checkNetworkWithDB, runWithOptions, Pos } from '../utils';
import { ContractType } from '../const';
import BigNumber from 'bignumber.js';

const runAsync = async (options) => {
  const { network, standby } = options;

  await connectDB(network, standby);
  const contractRepo = new ContractRepo();
  const headRepo = new HeadRepo();

  const posHead = await headRepo.findByKey('pos');
  await checkNetworkWithDB(network);
  const pos = new Pos(network);

  const erc20s = await contractRepo.findByType(ContractType.ERC20);
  for (const c of erc20s) {
    const erc20Data = await pos.fetchERC20Data(c.address, '' + posHead.num);
    if (!c.totalSupply.isEqualTo(erc20Data.totalSupply)) {
      console.log(`token ${c.address} totalSupply: ${c.totalSupply.toString()} -> ${erc20Data.totalSupply}`);
      c.totalSupply = new BigNumber(erc20Data.totalSupply);
      await c.save();
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
