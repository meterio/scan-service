#!/usr/bin/env node
require('../utils/validateEnv');
import { BigNumber } from 'bignumber.js';
import { Token } from '../const';
import { HeadRepo, TokenBalanceRepo, ContractRepo } from '../repo';
import { connectDB, disconnectDB } from '../utils/db';
import { ERC20 } from '@meterio/devkit';
import { Pos, checkNetworkWithDB, runWithOptions } from '../utils';

const runAsync = async (options) => {
  const { network, standby } = options;

  await connectDB(network, standby);
  const contractRepo = new ContractRepo();
  const tokenBalanceRepo = new TokenBalanceRepo();
  const pos = new Pos(network);
  await checkNetworkWithDB(network);

  const contracts = await contractRepo.findAll();
  for (const c of contracts) {
    const balances = await tokenBalanceRepo.findByTokenAddress(c.address);
    const { symbol, name, address } = c;
    let sum = new BigNumber(0);
    for (const bal of balances) {
      const { balance } = bal;
      sum = sum.plus(balance);
    }
    const holderCount = balances.length;
    if (!c.totalSupply.isEqualTo(sum)) {
      const res = await pos.explain(
        {
          clauses: [{ to: address, value: '0x0', data: ERC20.totalSupply.encode(), token: 0 }],
        },
        'best'
      );
      const decoded = ERC20.totalSupply.decode(res[0].data);
      const totalSupplyOnChain = decoded['0'].toString();
      console.log('----------------------------------------');
      console.log(`Total supply != Holder's holdings for token ${symbol} ${address}`);
      console.log(`total supply : ${c.totalSupply.toFixed(0)}`);
      console.log(`sum of holders: ${sum.toFixed(0)}`);
      console.log(`total supply on chain: ${totalSupplyOnChain}`);
      console.log(`diff: ${c.totalSupply.minus(sum).toFixed(0)}`);
      console.log(`holder count: ${holderCount}`);
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
