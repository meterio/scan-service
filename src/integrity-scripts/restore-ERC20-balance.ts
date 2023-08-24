#!/usr/bin/env node
require('../utils/validateEnv');

import { ERC20 } from '@meterio/devkit';
import { BigNumber } from 'bignumber.js';
import { ContractType } from '../const';
import { ContractRepo, TokenBalanceRepo } from '../repo';
import { connectDB, disconnectDB } from '../utils/db';
import PromisePool from '@supercharge/promise-pool/dist';
import { Pos, checkNetworkWithDB, runWithOptions } from '../utils';

const runAsync = async (options) => {
  const { network, standby } = options;

  await connectDB(network, standby);
  const tokenBalanceRepo = new TokenBalanceRepo();
  const contractRepo = new ContractRepo();
  await checkNetworkWithDB(network);

  const pos = new Pos(network);

  const erc20Contracts = await contractRepo.findByType(ContractType.ERC20);
  for (const c of erc20Contracts) {
    console.log(`Fixing balance for token ${c.address}`);
    const bals = await tokenBalanceRepo.findByTokenAddress(c.address);

    await PromisePool.withConcurrency(20)
      .for(bals)
      .process(async (bal, index, pool) => {
        try {
          const outputs = await pos.explain(
            {
              clauses: [{ to: c.address, value: '0x0', data: ERC20.balanceOf.encode(bal.address), token: 0 }],
            },
            'best'
          );
          const decoded = ERC20.balanceOf.decode(outputs[0].data);
          const chainBal = new BigNumber(decoded[0].toString());
          if (!chainBal.isEqualTo(bal.balance)) {
            console.log(
              `found mismatch: token ${c.address} on ${bal.address} balance:${
                bal.balance
              }, chain balance:${chainBal.toFixed()}`
            );
            if (chainBal.isGreaterThan(0)) {
              console.log(`set balance to ${chainBal.toNumber()}`);
              bal.balance = chainBal;
              await bal.save();
            } else {
              if (!bal.nftBalances || bal.nftBalances.length <= 0) {
                console.log(`delete balance`);
                await bal.deleteOne();
              }
            }
          }
        } catch (e) {
          console.log(`could not correct balance `, e);
        }
      });
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
