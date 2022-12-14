#!/usr/bin/env node
require('../utils/validateEnv');

import { BigNumber } from 'bignumber.js';
import { HeadRepo, MovementRepo, LogEventRepo } from '../repo';
import { connectDB, disconnectDB } from '../utils/db';
import { checkNetworkWithDB, runWithOptions } from '../utils';
import { Interface } from 'ethers/lib/utils';
import { ERC1155ABI, ERC721ABI } from '@meterio/devkit';

const runAsync = async (options) => {
  const { network, standby } = options;

  await connectDB(network, standby);
  const headRepo = new HeadRepo();
  const movementRepo = new MovementRepo();
  const eventRepo = new LogEventRepo();
  await checkNetworkWithDB(network);

  const moves = await movementRepo.findInvalidNFTMovements();

  const iface = new Interface([ERC721ABI.Transfer, ERC1155ABI.TransferSingle, ERC1155ABI.TransferBatch]);
  for (const move of moves) {
    console.log(JSON.stringify(move.toJSON()));

    // invalid, check again
    const event = await eventRepo.findById(move.txHash, move.clauseIndex, move.logIndex);
    if (!event) {
      console.log(`could not find event ${move.txHash}, ${move.clauseIndex}, ${move.logIndex}`);
      continue;
    }
    try {
      const decoded = iface.parseLog(event);
      const beforeUpdate = JSON.stringify(move);
      switch (decoded.name) {
        case 'Transfer':
          const e721Id = new BigNumber(decoded.args.tokenId.toString()).toFixed();
          move.tokenAddress = event.address.toLowerCase();
          move.from = decoded.args.from.toLowerCase();
          move.to = decoded.args.to.toLowerCase();
          move.amount = new BigNumber(0);
          move.nftTransfers = [{ tokenId: e721Id, value: 1 }];
          break;
        case 'TransferSingle':
          const e1155Id = new BigNumber(decoded.args.id.toString()).toFixed();
          const e1155Value = new BigNumber(decoded.args.value.toString()).toNumber();
          move.tokenAddress = event.address.toLowerCase();
          move.from = decoded.args.from.toLowerCase();
          move.to = decoded.args.to.toLowerCase();
          move.amount = new BigNumber(0);

          move.nftTransfers = [{ tokenId: e1155Id, value: e1155Value }];
          break;
        case 'TransferBatch':
          const nftTransfers = [];
          for (const [i, id] of decoded.args.ids.entries()) {
            const value = Number(decoded.args.values[i]);
            const tokenId = new BigNumber(id.toString()).toFixed();
            nftTransfers.push({ tokenId, value });
            move.nftTransfers = nftTransfers;
          }
          move.tokenAddress = event.address.toLowerCase();
          move.from = decoded.args.from.toLowerCase();
          move.to = decoded.args.to.toLowerCase();
          move.amount = new BigNumber(0);

          break;
        default:
          continue;
      }
      console.log(
        `* Update move ${move.txHash}:${move.clauseIndex}:${
          move.logIndex
        }\nfrom: ${beforeUpdate}\n>>to:${JSON.stringify(move)}\n`
      );
      await move.save();
    } catch (e) {
      console.log(`could not decode event: `, event);
      continue;
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
