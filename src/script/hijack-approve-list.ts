#!/usr/bin/env node
require('../utils/validateEnv');

import { ethers } from 'ethers';
import { ERC721, abi } from '@meterio/devkit';
import { BigNumber } from 'bignumber.js';
import { Movement } from '../model';
import { HeadRepo, LogEventRepo, MovementRepo, ContractRepo, TxRepo } from '../repo';
import { Token, ContractType } from '../const';
import { connectDB, disconnectDB } from '../utils/db';
import { NFTBalanceAuditor } from '../types';

import { checkNetworkWithDB, runWithOptions } from '../utils';

const runAsync = async (options) => {
  const { network, standby } = options;

  await connectDB(network, standby);
  const headRepo = new HeadRepo();
  const evtRepo = new LogEventRepo();
  const mvtRepo = new MovementRepo();
  const contractRepo = new ContractRepo();
  const txRepo = new TxRepo();
  await checkNetworkWithDB(network);

  const pos = await headRepo.findByKey('pos');
  const best = pos.num;
  const step = 10000;
  const start = 33745109;

  await mvtRepo.deleteByToken(Token.ERC721);

  const iface = new ethers.utils.Interface([
    'function approve(address _spender, uint256 _value) returns (bool success)',
  ]);

  for (let i = start; i < best; i += step) {
    const start = i;
    const end = i + step - 1 > best ? best : i + step - 1;

    const txs = await txRepo.findInRange(start, end);
    console.log(`searching for tx in blocks [${start}, ${end}]`);
    for (const tx of txs) {
      if (tx.clauses && tx.clauses[0].data.startsWith('0x095ea7b3')) {
        const decoded = iface.decodeFunctionData('approve', tx.clauses[0].data);
        const spender = decoded._spender;

        const token = tx.clauses[0].to;
        const origin = tx.origin;
        if (spender === '0x005bD665285143be22D23DFC01C180588b1886d1') {
          console.log(
            `${origin} approves spender ${spender.substring(0, 6)}..${spender.substring(42 - 4)} on token ${token} `
          );
          console.log(tx.hash);
        }
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
