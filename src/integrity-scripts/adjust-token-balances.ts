#!/usr/bin/env node
require('../utils/validateEnv');

import { ERC20 } from '@meterio/devkit';
import { BigNumber } from 'bignumber.js';
import { ContractType, Token } from '../const';
import { ContractRepo, TokenBalanceRepo } from '../repo';
import { connectDB, disconnectDB } from '../utils/db';
import { Pos, checkNetworkWithDB, runWithOptions } from '../utils';

const runAsync = async (options) => {
  const { network, standby } = options;

  await connectDB(network, standby);
  const contractRepo = new ContractRepo();
  const tokenBalanceRepo = new TokenBalanceRepo();
  const pos = new Pos(network);
  await checkNetworkWithDB(network);

  const e721s = await contractRepo.findByType(ContractType.ERC721);
  const e1155s = await contractRepo.findByType(ContractType.ERC1155);
  let addrs = [];
  e721s.concat(e1155s).forEach((t) => {
    addrs[t.address] = true;
  });
  for (const addr in addrs) {
    const balances = await tokenBalanceRepo.findByTokenAddress(addr);
    console.log(`start checking for token ${addr} ...`);

    for (const bal of balances) {
      const { address, tokenAddress, balance } = bal;
      try {
        const outputs = await pos.explain(
          { clauses: [{ to: tokenAddress, value: '0x0', data: ERC20.balanceOf.encode(address), token: 0 }] },
          'best'
        );
        const decoded = ERC20.balanceOf.decode(outputs[0].data);
        const chainBal = new BigNumber(decoded[0].toString());
        if (!chainBal.isEqualTo(balance)) {
          console.log(`found NON-matching balance: chain ${chainBal} db:${balance}`);
          console.log(`tokenAddr: ${tokenAddress}, addr: ${address}`);
          if (chainBal.isEqualTo(0)) {
            await bal.deleteOne();
            console.log('deleted');
          } else {
            bal.balance = chainBal;
            await bal.save();
            console.log(`updated`);
          }
          console.log('----------------------------------------');
        }
      } catch {
        continue;
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
