#!/usr/bin/env node
require('../utils/validateEnv');

import { NFTRepo } from '../repo';
import { connectDB, disconnectDB } from '../utils/db';
import { checkNetworkWithDB, runWithOptions } from '../utils';
import { NFTCache } from '../types/nftCache';

const runAsync = async (options) => {
  const { network, standby } = options;

  await connectDB(network, standby);
  const nftRepo = new NFTRepo();
  await checkNetworkWithDB(network);

  const uncached = await nftRepo.findUncached();

  console.log(`Found ${uncached.length} uncached nfts`);
  const nftCache = new NFTCache(network);
  for (const nft of uncached) {
    try {
      await nftCache.updateNFTInfo(nft);
      console.log(`updated NFT ${nft.address}[${nft.tokenId}]`, nft);
      await nft.save();
    } catch (e) {
      console.log(`could not cache nft image for [${nft.tokenId}] on ${nft.address} `, e);
    }
  }

  let cacheFailed = await nftRepo.findCacheFailed();
  console.log(`Found ${cacheFailed.length} cache failed nfts`);

  for (const nft of cacheFailed) {
    try {
      await nftCache.updateNFTInfo(nft);
      console.log(`updated NFT ${nft.address}[${nft.tokenId}]`, nft);
      await nft.save();
    } catch (e) {
      console.log(`could not cache nft image for [${nft.tokenId}] on ${nft.address} `, e);
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
