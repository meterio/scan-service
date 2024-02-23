#!/usr/bin/env node
require('../utils/validateEnv');

import { NFTRepo, HeadRepo } from '../repo';
import { connectDB, disconnectDB } from '../utils/db';
import { checkNetworkWithDB, runWithOptions } from '../utils';
import { NFTCache } from '../types/nftCache';
import { sleep } from '../utils';
import { PromisePool } from '@supercharge/promise-pool';

const runAsync = async (options) => {
  const { network, standby } = options;

  await connectDB(network, standby);
  const nftRepo = new NFTRepo();
  const headRepo = new HeadRepo();
  await checkNetworkWithDB(network);

  const poshead = await headRepo.findByKey('pos');
  const best = poshead.num;
  const step = 10000;

  const nftCache = new NFTCache(network);

  const scanStart = 0;
  const scanEnd = best;

  for (let i = scanStart; i < scanEnd; i += step) {
    const start = i;
    const end = i + step - 1 > scanEnd ? scanEnd : i + step - 1;
    const uncached = await nftRepo.findUncached(start, end);
    console.log(`Found ${uncached.length} uncached nfts`);
    await PromisePool.withConcurrency(20)
      .for(uncached)
      .process(async (nft, index, pool) => {
        try {
          await Promise.any([sleep(10000), nftCache.updateNFTInfo(nft, 2)]);
          if (nft.status != 'new') {
            console.log(`${index}/${uncached.length} updated NFT ${nft.address}[${nft.tokenId}]`, nft);
            await nft.save();
          }
        } catch (e) {
          console.log(`could not cache nft image for [${nft.tokenId}] on ${nft.address} `, e);
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
