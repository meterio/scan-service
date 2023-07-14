#!/usr/bin/env node
require('../utils/validateEnv');

import { BlockRepo } from '../repo';
import { connectDB, disconnectDB } from '../utils/db';

import { checkNetworkWithDB, isTraceable, Pos, runWithOptions, saveCSV, sleep } from '../utils';

const runAsync = async (options) => {
  const { network, standby } = options;

  await connectDB(network, standby);
  const blockRepo = new BlockRepo();
  await checkNetworkWithDB(network);

  //   const posHead = await headRepo.findByKey('pos');
  //   const best = posHead.num;
  const best = 25000000;
  const step = 100000;

  let trieRoots = [];
  let visited = {};
  for (let i = 0; i < best; i += step) {
    const start = i;
    const end = i + step - 1 > best ? best : i + step - 1;

    console.log(`searching for distinct trie in blocks [${start}, ${end}]`);
    const results = await blockRepo.findDistinctStateRoot(start, end);
    let count = 0;
    for (const r of results) {
      if (r.stateRoot in visited) {
        continue;
      }
      visited[r.stateRoot] = true;
      trieRoots.push({
        number: r.number,
        stateRoot: r.stateRoot,
        txCount: r.txCount,
      });
      count++;
    }
    if (count > 0) {
      console.log(`found ${count} distinct tries, accumulated ${trieRoots.length} tries`);
    }
  }

  console.log(`found ${trieRoots.length} distinct tries`);
  saveCSV(trieRoots, ['number', 'stateRoot', 'txCount'], './tries.csv');
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
