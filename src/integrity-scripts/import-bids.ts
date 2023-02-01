#!/usr/bin/env node
require('../utils/validateEnv');

import { Candidate, Bid } from '../model';
import { HeadRepo, BlockRepo, CandidateRepo, AuctionRepo, BidRepo } from '../repo';
import { connectDB, disconnectDB } from '../utils/db';
import { checkNetworkWithDB, Pos, runWithOptions } from '../utils';
import BigNumber from 'bignumber.js';

const runAsync = async (options) => {
  const { network, standby } = options;

  await connectDB(network, standby);
  const auctionRepo = new AuctionRepo();
  const bidRepo = new BidRepo();
  const blockRepo = new BlockRepo();
  await checkNetworkWithDB(network);
  const pos = new Pos(network);

  const from = 33066877;
  const to = 33011082;

  let cur = from;
  for (; cur > to; ) {
    const blk = await blockRepo.findByNumber(cur);
    const lastK = await blockRepo.findByNumber(blk.lastKBlockHeight);

    const prePresent = await pos.getPresentAuctionByRevision(lastK.number - 1);
    const present = await pos.getPresentAuctionByRevision(lastK.number);

    let visited = {};
    for (const atx of prePresent.auctionTxs) {
      visited[atx.txid] = true;
    }

    for (const tx of present.auctionTxs) {
      if (tx.txid in visited) {
        continue;
      }
      const savedBid = await bidRepo.findById(tx.txid);
      if (!savedBid) {
        let bid: Bid = {
          id: tx.txid,
          address: tx.address,
          amount: tx.amount,
          type: tx.type,
          timestamp: tx.timestamp,
          nonce: new BigNumber(tx.nonce),

          auctionID: present.auctionID,
          epoch: lastK.epoch,
          blockNum: lastK.number,
          txHash: lastK.txHashs[lastK.txHashs.length - 2],
          clauseIndex: 0,

          pending: true,
        };
        console.log('save new bid: ', bid.id);
        await bidRepo.create(bid);
      }

      cur = blk.lastKBlockHeight;
    }

    const auction = await auctionRepo.findByID(present.auctionID);
    if (auction) {
      auction.bidCount = present.auctionTxs.length;
      auction.receivedMTR = new BigNumber(present.receivedMTR);
      auction.actualPrice = auction.receivedMTR.times(1e18).dividedBy(auction.releasedMTRG).dividedBy(1e18);
      if (auction.actualPrice.isLessThan(present.reservedPrice)) {
        auction.actualPrice = new BigNumber(present.reservedPrice);
      }
      console.log('update auction: ', auction.id);
      await auction.save();
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
