#!/usr/bin/env node
require('../utils/validateEnv');

import { ERC20 } from '@meterio/devkit';
import { BigNumber } from 'bignumber.js';
import { Token, ContractType } from '../const';
import { ContractRepo } from '../repo';
import { Pos, checkNetworkWithDB, runWithOptions } from '../utils';
import { connectDB, disconnectDB } from '../utils/db';

const runAsync = async (options) => {
  const { network, standby } = options;

  await connectDB(network, standby);
  const contractRepo = new ContractRepo();
  const pos = new Pos(network);
  await checkNetworkWithDB(network);

  const contracts = await contractRepo.findByType(ContractType.ERC20);
  console.log(`start checking ${contracts.length} contracts...`);
  let updateCount = 0;
  for (const p of contracts) {
    try {
      const ret = await pos.explain(
        { clauses: [{ to: p.address, value: '0x0', data: ERC20.totalSupply.encode(), token: Token.MTR }] },
        'best'
      );
      const decoded = ERC20.totalSupply.decode(ret[0].data);
      const amount = decoded['0'].toString();
      let updated = false;
      if (!p.totalSupply.isEqualTo(amount)) {
        console.log(`Update total supply for token ${p.symbol} from ${p.totalSupply.toFixed(0)} to ${amount}`);
        p.totalSupply = new BigNumber(amount);
        updated = true;
      }
      if (updated) {
        updateCount++;
        await p.save();
      }
    } catch (e) {
      console.log('ignore error: ', e);
    }
  }
  console.log(`Updated ${updateCount} token contracts`);
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
