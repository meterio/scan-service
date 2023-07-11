#!/usr/bin/env node
require('../utils/validateEnv');

import { abi } from '@meterio/devkit';
import { BigNumber } from 'bignumber.js';
import { connectDB, disconnectDB } from '../utils/db';
import { Token } from '../const';
import { HeadRepo, TokenBalanceRepo } from '../repo';
import { Pos, checkNetworkWithDB, runWithOptions } from '../utils';

const balanceOfABI: abi.Function.Definition = {
  inputs: [{ name: 'account', type: 'address' }],
  name: 'balanceOf',
  outputs: [{ name: '', type: 'uint256' }],
  stateMutability: 'view',
  type: 'function',
  payable: false,
};

const runAsync = async (options) => {
  const { network, standby } = options;

  await connectDB(network, standby);
  const headRepo = new HeadRepo();
  const tokenBalanceRepo = new TokenBalanceRepo();
  const pos = new Pos(network);
  await checkNetworkWithDB(network);

  const posHead = await headRepo.findByKey('pos');
  console.log('POS Head:', posHead);

  const balances = await tokenBalanceRepo.findAll();
  console.log(`start checking ${balances.length} balances ...`);

  const balanceOfFunc = new abi.Function(balanceOfABI);
  let n = 1;
  for (const bal of balances) {
    const { address, tokenAddress, balance } = bal;
    try {
      const outputs = await pos.explain(
        {
          clauses: [{ to: tokenAddress, value: '0x0', data: balanceOfFunc.encode(address), token: Token.MTR }],
        },
        posHead.hash
      );
      const decoded = balanceOfFunc.decode(outputs[0].data);
      const chainBal = new BigNumber(decoded[0].toString());
      if (!chainBal.isEqualTo(balance)) {
        console.log(`found NON-matching balance: chain ${chainBal} db:${balance}`);
        console.log(`tokenAddr: ${tokenAddress}, addr: ${address} `);
      }
      n++;
      if (n % 500 == 0) {
        console.log(`checked ${n} balances`);
      }
    } catch {
      continue;
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
