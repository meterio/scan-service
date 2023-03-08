#!/usr/bin/env node
require('../utils/validateEnv');

import { HeadRepo, LogEventRepo, MovementRepo, ContractRepo } from '../repo';
import { Token } from '../const';
import { connectDB, disconnectDB } from '../utils/db';
import { ERC20 } from '@meterio/devkit';

import { checkNetworkWithDB, runWithOptions } from '../utils';

const runAsync = async (options) => {
  const { network, standby } = options;

  await connectDB(network, standby);
  const headRepo = new HeadRepo();
  const mvtRepo = new MovementRepo();
  const evtRepo = new LogEventRepo();
  await checkNetworkWithDB(network);

  const pos = await headRepo.findByKey('pos');
  const best = pos.num;
  const step = 100000;

  await mvtRepo.deleteByToken(Token.ERC721);

  for (let i = 0; i < best; i += step) {
    const start = i;
    const end = i + step - 1 > best ? best : i + step - 1;

    console.log(`find MTRG movements in blocks [${start}, ${end}]`);
    const MTRGMovements = await mvtRepo.findByTokenInRange(Token.MTRG, start, end);
    console.log(`found ${MTRGMovements.length} movements`);
    for (const m of MTRGMovements) {
      const evt = await evtRepo.findById(m.txHash, m.clauseIndex, m.logIndex);
      if (evt && evt.topics && evt.topics.length >= 1 && evt.topics[0] == ERC20.Transfer.signature) {
        m.token = Token.ERC20;
        console.log(`update movement token from MTRG to ERC20 for tx: ${evt.txHash}`);
      }
    }

    console.log(`find MTR movements in blocks [${start}, ${end}]`);
    const MTRMovements = await mvtRepo.findByTokenInRange(Token.MTR, start, end);
    console.log(`found ${MTRMovements.length} movements`);
    for (const m of MTRMovements) {
      const evt = await evtRepo.findById(m.txHash, m.clauseIndex, m.logIndex);
      if (evt && evt.topics && evt.topics.length >= 1 && evt.topics[0] == ERC20.Transfer.signature) {
        m.token = Token.ERC20;
        console.log(`update movement token from MTR to ERC20 for tx: ${evt.txHash}`);
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
