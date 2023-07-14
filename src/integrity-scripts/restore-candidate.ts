#!/usr/bin/env node
require('../utils/validateEnv');

import { ICandidate } from '../model';
import { HeadRepo, BlockRepo, CandidateRepo } from '../repo';
import { connectDB, disconnectDB } from '../utils/db';
import { checkNetworkWithDB, Pos, runWithOptions } from '../utils';

const runAsync = async (options) => {
  const { network, standby } = options;

  await connectDB(network, standby);
  const headRepo = new HeadRepo();
  const blockRepo = new BlockRepo();
  const candidateRepo = new CandidateRepo();
  await checkNetworkWithDB(network);
  const pos = new Pos(network);

  const head = await headRepo.findByKey('pos');
  const best = head.num;
  const step = 100000;

  for (let i = 0; i < best; i += step) {
    const start = i;
    const end = i + step - 1 > best ? best : i + step - 1;

    const kblocks = await blockRepo.findKBlockInRangeSortAsc(start, end);
    console.log(`searching for candidates in blocks [${start}, ${end}]`);
    let candidates: ICandidate[] = [];
    for (const kb of kblocks) {
      const epoch = kb.qc.epochID;
      const candidateList = await pos.getCandidatesOnRevision(kb.number);
      for (const c of candidateList) {
        candidates.push({ ...c, ipAddress: c.ipAddr, epoch } as ICandidate);
      }
    }
    if (candidates.length > 0) {
      console.log(`prepare to save ${candidates.length} candidates`);
      await candidateRepo.bulkUpsert(...candidates);
      console.log('done');
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
