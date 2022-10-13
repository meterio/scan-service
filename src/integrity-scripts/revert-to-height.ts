#!/usr/bin/env node
require('../utils/validateEnv');

import { Network } from '../const';
import {
  AccountRepo,
  AuctionRepo,
  AuctionSummaryRepo,
  BidRepo,
  BlockRepo,
  BoundRepo,
  BucketRepo,
  CommitteeRepo,
  EpochRewardRepo,
  EpochRewardSummaryRepo,
  HeadRepo,
  MovementRepo,
  TxRepo,
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
  const accountRepo = new AccountRepo();
  const auctionRepo = new AuctionRepo();
  const auctionSummaryRepo = new AuctionSummaryRepo();
  const bidRepo = new BidRepo();
  const boundRepo = new BoundRepo();
  const unboundRepo = new UnboundRepo();
  const bucketRepo = new BucketRepo();
  const committeeRepo = new CommitteeRepo();
  const epochRewardRepo = new EpochRewardRepo();
  const epochRewardSummaryRepo = new EpochRewardSummaryRepo();
  const movementRepo = new MovementRepo();
  const txRepo = new TxRepo();

  console.log('update accounts');
  await accountRepo.deleteAfter(revertHeight);

  console.log('update auctions');
  await auctionRepo.deleteAfter(revertHeight);

  console.log('update auctionSummaries');
  await auctionSummaryRepo.deleteAfter(revertHeight);

  console.log('update bids');
  await bidRepo.deleteAfter(revertHeight);

  console.log('update bounds');
  await boundRepo.deleteAfter(revertHeight);

  console.log('update unbounds');
  await unboundRepo.deleteAfter(revertHeight);

  console.log('update buckets');
  await bucketRepo.deleteAfterTimestamp(blk.timestamp);

  console.log('update committees');
  await committeeRepo.deleteAfter(revertHeight);

  console.log('update epochRewards');
  await epochRewardRepo.deleteAfter(revertHeight);

  console.log('update epochRewardSummaries');
  await epochRewardSummaryRepo.deleteAfter(revertHeight);

  console.log('update transfers');
  await movementRepo.deleteAfter(revertHeight);

  console.log('update txs');
  await txRepo.deleteAfter(revertHeight);

  console.log('update blocks');
  await blockRepo.deleteAfter(revertHeight);

  const posHead = await headRepo.findByKey('pos');
  const acctHead = await headRepo.findByKey('account');
  const seHead = await headRepo.findByKey('scriptengine');

  console.log('update heads');
  for (const head of [posHead, acctHead, seHead]) {
    if (head.num > revertHeight) {
      head.num = blk.number;
      head.hash = blk.hash;
      await head.save();
    }
  }
  console.log('POS Head:', posHead);
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
