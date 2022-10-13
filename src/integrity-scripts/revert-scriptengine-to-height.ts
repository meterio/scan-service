#!/usr/bin/env node
require('../utils/validateEnv');
import { Network } from '../const';
import {
  AuctionRepo,
  AuctionSummaryRepo,
  BidRepo,
  BlockRepo,
  BoundRepo,
  EpochRewardRepo,
  EpochRewardSummaryRepo,
  HeadRepo,
  UnboundRepo,
} from '../repo';
import { connectDB, disconnectDB } from '../utils/db';
import { checkNetworkWithDB, runWithOptions } from '../utils';

const revertHeight = 4200000;

const runAsync = async (options) => {
  const { network, standby } = options;
  if (network === Network.MainNet) {
    console.log('NO REVERT ALLOWED ON MAINNET!!!');
    process.exit(-1);
  }

  await connectDB(network, standby);
  const blockRepo = new BlockRepo();
  const blk = await blockRepo.findByNumber(revertHeight);
  if (!blk) {
    console.log('could not find this block: ', revertHeight);
    process.exit(-1);
  }

  await checkNetworkWithDB(network);

  const headRepo = new HeadRepo();
  const auctionRepo = new AuctionRepo();
  const auctionSummaryRepo = new AuctionSummaryRepo();
  const bidRepo = new BidRepo();
  const boundRepo = new BoundRepo();
  const unboundRepo = new UnboundRepo();
  const epochRewardRepo = new EpochRewardRepo();
  const epochRewardSummaryRepo = new EpochRewardSummaryRepo();
  let res: any;

  console.log('update auctions');
  res = await auctionRepo.deleteAfter(revertHeight);
  console.log(`deleted ${res.deletedCount} auctions: ${res.ok}`);

  console.log('update auctionSummaries');
  res = await auctionSummaryRepo.deleteAfter(revertHeight);
  console.log(`deleted ${res.deletedCount} auctionSummary: ${res.ok}`);

  console.log('update bids');
  res = await bidRepo.deleteAfter(revertHeight);
  console.log(`deleted ${res.deletedCount} bids: ${res.ok}`);

  console.log('update bounds');
  res = await boundRepo.deleteAfter(revertHeight);
  console.log(`deleted ${res.deletedCount} bounds: ${res.ok}`);

  console.log('update unbounds');
  res = await unboundRepo.deleteAfter(revertHeight);
  console.log(`deleted ${res.deletedCount} unbounds: ${res.ok}`);

  console.log('update epochRewards');
  res = await epochRewardRepo.deleteAfter(revertHeight);
  console.log(`deleted ${res.deletedCount} epochRewards: ${res.ok}`);

  console.log('update epochRewardSummaries');
  res = await epochRewardSummaryRepo.deleteAfter(revertHeight);
  console.log(`deleted ${res.deletedCount} epochRewardSummaries: ${res.ok}`);

  const seHead = await headRepo.findByKey('scriptengine');

  console.log('update heads');
  for (const head of [seHead]) {
    if (head.num > revertHeight) {
      head.num = blk.number;
      head.hash = blk.hash;
      await head.save();
      console.log(`update head ${head.key} to ${head.num}`);
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
