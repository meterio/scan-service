#!/usr/bin/env node
require('../utils/validateEnv');

import { HeadRepo, LogEventRepo, MovementRepo, ContractRepo } from '../repo';
import { Token } from '../const';
import { connectDB, disconnectDB } from '../utils/db';
import { ERC20 } from '@meterio/devkit';

import { checkNetworkWithDB, runWithOptions } from '../utils';
import BigNumber from 'bignumber.js';

const runAsync = async (options) => {
  const { network, standby } = options;

  await connectDB(network, standby);
  const headRepo = new HeadRepo();
  const mvtRepo = new MovementRepo();
  const evtRepo = new LogEventRepo();
  await checkNetworkWithDB(network);

  const pos = await headRepo.findByKey('pos');
  const best = pos.num;
  const step = 10000;

  await mvtRepo.deleteByToken(Token.ERC721);

  for (let i = 0; i < best; i += step) {
    const start = i;
    const end = i + step - 1 > best ? best : i + step - 1;

    console.log(`find MTRG movements in blocks [${start}, ${end}]`);
    const MTRGMovements = await mvtRepo.findByTokenInRange(Token.MTRG, start, end);
    console.log(`found ${MTRGMovements.length} movements`);
    for (const m of MTRGMovements) {
      const evt = await evtRepo.findById(m.txHash, m.clauseIndex, m.logIndex);
      try {
        if (evt && evt.topics && evt.topics.length >= 1 && evt.topics[0] == ERC20.Transfer.signature) {
          const decoded = ERC20.Transfer.decode(evt.data, evt.topics);
          if (
            decoded.to.toLowerCase() === m.to.toLowerCase() &&
            decoded.from.toLowerCase() === m.from.toLowerCase() &&
            new BigNumber(decoded.value.toString()).isEqualTo(m.amount)
          ) {
            m.token = Token.ERC20;
            console.log(`update movement token from MTRG to ERC20 for tx: ${evt.txHash}`);
            await m.save();
          }
        }
      } catch (e) {
        console.log('error happened: ', e);
        continue;
      }
    }

    console.log(`find MTR movements in blocks [${start}, ${end}]`);
    const MTRMovements = await mvtRepo.findByTokenInRange(Token.MTR, start, end);
    console.log(`found ${MTRMovements.length} movements`);
    for (const m of MTRMovements) {
      try {
        const evt = await evtRepo.findById(m.txHash, m.clauseIndex, m.logIndex);
        if (evt && evt.topics && evt.topics.length >= 1 && evt.topics[0] == ERC20.Transfer.signature) {
          const decoded = ERC20.Transfer.decode(evt.data, evt.topics);
          if (
            decoded.to.toLowerCase() === m.to.toLowerCase() &&
            decoded.from.toLowerCase() === m.from.toLowerCase() &&
            new BigNumber(decoded.value.toString()).isEqualTo(m.amount)
          ) {
            m.token = Token.ERC20;
            console.log(`update movement token from MTR to ERC20 for tx: ${evt.txHash}`);
            await m.save();
          }
        }
      } catch (e) {
        console.log('error happened: ', e);
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
