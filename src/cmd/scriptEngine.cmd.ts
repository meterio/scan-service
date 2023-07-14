import * as devkit from '@meterio/devkit';
import pino from 'pino';
import { BigNumber } from 'bignumber.js';
import { Network } from '../const';
import {
  IAuctionTx,
  IAuctionDist,
  IBid,
  IBlock,
  IEpochReward,
  IEpochRewardSummary,
  IKnown,
  ITx,
  IRewardInfo,
  ICandidate,
} from '../model';
import {
  AuctionRepo,
  AuctionSummaryRepo,
  BidRepo,
  EpochRewardRepo,
  EpochRewardSummaryRepo,
  KnownRepo,
  ValidatorRewardRepo,
  CandidateRepo,
} from '../repo';
import { GetNetworkConfig, Token } from '../const';

import { TxBlockReviewer } from './blockReviewer';
import { PassThrough } from 'stream';

const NORMAL_INTERVAL = 10000;
export class ScriptEngineCMD extends TxBlockReviewer {
  protected auctionRepo = new AuctionRepo();
  protected auctionSummaryRepo = new AuctionSummaryRepo();
  protected bidRepo = new BidRepo();
  protected epochRewardRepo = new EpochRewardRepo();
  protected epochRewardSummaryRepo = new EpochRewardSummaryRepo();
  protected validatorRewardRepo = new ValidatorRewardRepo();
  protected knownRepo = new KnownRepo();
  protected candidateRepo = new CandidateRepo();

  constructor(net: Network) {
    super(net, NORMAL_INTERVAL);
    this.log = pino({
      transport: {
        target: 'pino-pretty',
      },
    });
    this.name = 'scriptengine';
  }

  public async cleanUpIncompleteData(head: any): Promise<void> {
    const blockNum = head.num;
    const auction = await this.auctionRepo.deleteAfter(blockNum);
    const bid = await this.bidRepo.deleteAfter(blockNum);
    const auctionSummary = await this.auctionSummaryRepo.deleteAfter(blockNum);
    const epochReward = await this.epochRewardRepo.deleteAfter(blockNum);
    const epochRewardSummary = await this.epochRewardSummaryRepo.deleteAfter(blockNum);
    this.log.info(
      {
        auction,
        auctionSummary,
        bid,
        epochReward,
        epochRewardSummary,
      },
      `deleted dirty data higher than head ${blockNum}`
    );
  }

  async processTx(tx: ITx, txIndex: number, blk: IBlock) {
    const epoch = blk.epoch;
    const blockNum = blk.number;
    if (tx.reverted) {
      return;
    }
    const config = GetNetworkConfig(this.network);
    const se = devkit.ScriptEngine;
    // process outputs
    for (const [clauseIndex, o] of tx.outputs.entries()) {
      const clause = tx.clauses[clauseIndex];

      if (!clause) {
        this.log.info('clause is EMPTY: ', tx.hash, ', txIndex=', txIndex, ', clauseIndex=', clauseIndex);
        continue;
      }
      if (!se.IsScriptEngineData(clause.data)) {
        this.log.info(`skip non-scriptengine tx ${tx.hash}`);
        continue;
      }
      const scriptData = se.decodeScriptData(clause.data);
      this.log.info(`start to process scriptengine tx ${tx.hash}`);
      if (scriptData.header.modId === se.ModuleID.Auction) {
        if (!config.auctionEnabled) {
          continue;
        }
        // auction
        const body = se.decodeAuctionBody(scriptData.payload);
        // this.log.info({ opCode: body.opCode }, 'handle auction data');
        switch (body.opCode) {
          case se.AuctionOpCode.End:
            // end auction
            this.log.info('handle auction end');
            const endedAuction = await this.pos.getLastAuctionSummary(blockNum);
            if (endedAuction.actualPrice === '<nil>') {
              this.log.info('Error: empty auction, something wrong happened');
              break;
            }
            const tgtAuction = await this.auctionRepo.findByID(endedAuction.auctionID);
            if (tgtAuction.pending !== true) {
              this.log.info('Error: try to end an already ended auction');
              break;
            }

            const dists: IAuctionDist[] = endedAuction.distMTRG.map((d) => ({
              address: d.addr,
              amount: new BigNumber(d.amount),
              token: Token.MTRG,
            }));
            const txs: IAuctionTx[] = endedAuction.auctionTxs.map((t) => ({ ...t }));

            // upsert auction summary
            const sExist = await this.auctionSummaryRepo.existID(endedAuction.auctionID);
            if (!sExist) {
              const summary = {
                id: endedAuction.auctionID,
                startHeight: endedAuction.startHeight,
                startEpoch: endedAuction.startEpoch,
                endHeight: endedAuction.endHeight,
                endEpoch: endedAuction.endEpoch,
                sequence: endedAuction.sequence,
                createTime: blk.timestamp,
                releasedMTRG: new BigNumber(endedAuction.releasedMTRG),
                reservedMTRG: new BigNumber(endedAuction.reservedMTRG),
                reservedPrice: new BigNumber(endedAuction.reservedPrice),
                receivedMTR: new BigNumber(endedAuction.receivedMTR),
                actualPrice: new BigNumber(endedAuction.actualPrice),
                leftoverMTRG: new BigNumber(endedAuction.leftoverMTRG),
                txs,
                distMTRG: dists,
              };
              await this.auctionSummaryRepo.create(summary);
            }

            // update bids
            let autobidTotal = new BigNumber(0);
            let userbidTotal = new BigNumber(0);
            for (const [i, t] of txs.entries()) {
              // const d = dists[i];
              let bid = await this.bidRepo.findById(t.txid);
              if (!bid) {
                this.log.info('Bid not found! probably missed one bid');
                const newBid: IBid = {
                  id: t.txid,
                  address: t.address,
                  amount: t.amount,
                  type: t.type,
                  timestamp: t.timestamp,
                  nonce: new BigNumber(t.nonce),

                  auctionID: tgtAuction.id,
                  epoch,
                  blockNum,
                  txHash: tx.hash,
                  clauseIndex,

                  pending: true,
                };
                bid = await this.bidRepo.create(newBid);
              }
              // if (bid.address.toLowerCase() !== d.address.toLowerCase()) {
              //   this.log.info('Address mismatch! probably the order is different');
              //   continue;
              // }
              bid.pending = false;
              bid.hammerPrice = new BigNumber(endedAuction.actualPrice);
              bid.lotAmount = new BigNumber(t.amount).dividedBy(endedAuction.actualPrice);
              await bid.save();

              if (t.type === 'autobid') {
                autobidTotal = autobidTotal.plus(t.amount);
              } else if (t.type === 'userbid') {
                userbidTotal = userbidTotal.plus(t.amount);
              }
            }

            // update auction
            tgtAuction.auctionEndEpoch = epoch;
            tgtAuction.auctionEndHeight = blockNum;
            tgtAuction.pending = false;
            // override totals based on summary
            tgtAuction.receivedMTR = new BigNumber(endedAuction.receivedMTR);
            tgtAuction.actualPrice = new BigNumber(endedAuction.actualPrice);
            tgtAuction.leftoverMTRG = new BigNumber(endedAuction.leftoverMTRG);
            tgtAuction.autobidTotal = autobidTotal;
            tgtAuction.userbidTotal = userbidTotal;

            await tgtAuction.save();
            this.log.info(`ended auction ${tgtAuction}`);
            break;
          case se.AuctionOpCode.Start:
            this.log.info('handle auction start');
            // TODO: handle the "auction not started" case
            // start auction
            const curAuction = await this.pos.getPresentAuctionByRevision(blockNum);
            const auction = {
              id: curAuction.auctionID,
              startHeight: curAuction.startHeight,
              startEpoch: curAuction.startEpoch,
              endHeight: curAuction.endHeight,
              endEpoch: curAuction.endEpoch,

              auctionStartHeight: blockNum,
              auctionStartEpoch: epoch,
              auctionStartTxHash: tx.hash,
              auctionStartClauseIndex: clauseIndex,

              sequence: curAuction.sequence,
              createTime: blk.timestamp,
              releasedMTRG: new BigNumber(curAuction.releasedMTRG),
              reservedMTRG: new BigNumber(curAuction.reservedMTRG),
              reservedPrice: new BigNumber(curAuction.reservedPrice),
              receivedMTR: new BigNumber(curAuction.receivedMTR),
              actualPrice: new BigNumber(0),
              leftoverMTRG: new BigNumber(0),

              pending: true,
              bidCount: 0,
              userbidTotal: new BigNumber(0),
              autobidTotal: new BigNumber(0),
            };
            await this.auctionRepo.create(auction);
            this.log.info(`started auction ${auction.id}`);
            break;
          case se.AuctionOpCode.Bid:
            // TODO: handle the tx reverted case
            // auction bid

            this.log.info('handle auction bid');
            const atx = se.getAuctionTxFromAuctionBody(body);
            const presentAuction = await this.auctionRepo.findPresent();
            const bid: IBid = {
              id: atx.ID(),
              address: '0x' + atx.address.toString('hex').toLowerCase(),
              amount: atx.amount,
              type: atx.type == 0 ? 'userbid' : 'autobid',
              timestamp: atx.timestamp,
              nonce: new BigNumber(atx.nonce),

              auctionID: presentAuction.id,
              epoch,
              blockNum,
              txHash: tx.hash,
              clauseIndex,

              pending: true,
            };
            await this.bidRepo.create(bid);

            // update present auction
            const present = await this.auctionRepo.findPresent();
            switch (bid.type) {
              case 'autobid':
                present.autobidTotal = present.autobidTotal.plus(bid.amount);
                break;
              case 'userbid':
                present.userbidTotal = present.userbidTotal.plus(bid.amount);
                break;
            }
            present.bidCount = present.bidCount + 1;
            present.receivedMTR = present.receivedMTR.plus(bid.amount);
            present.actualPrice = present.receivedMTR.times(1e18).dividedBy(present.releasedMTRG).dividedBy(1e18);
            if (present.actualPrice.isLessThan(present.reservedPrice)) {
              present.actualPrice = present.reservedPrice;
            }
            await present.save();
            this.log.info(`append bid ${bid.id} to auction ${present.id}`);
            break;
        }
      }

      if (scriptData.header.modId === se.ModuleID.Staking) {
        const body = se.decodeStakingBody(scriptData.payload);
        // this.log.info({ opCode: body.opCode }, `handle staking data`);

        // handle staking candidate / candidate update
        if (body.opCode === se.StakingOpCode.Candidate || body.opCode === se.StakingOpCode.CandidateUpdate) {
          this.log.info(`handle staking candidate or candidateUpdate`);
          const pk = body.candidatePubKey.toString();
          const items = pk.split(':::');
          if (items.length !== 2) {
            continue;
          }
          const ecdsaPK = items[0];
          const blsPK = items[1];
          const address = body.candidateAddr.toLowerCase();

          const exist = await this.knownRepo.exist(ecdsaPK);
          if (!exist) {
            const known: IKnown = {
              ecdsaPK,
              blsPK,
              name: body.candidateName.toString(),
              description: body.candidateDescription.toString(),
              address,
              ipAddress: body.candidateIP.toString(),
              port: body.candidatePort,
            };
            await this.knownRepo.create(known);
          } else {
            let known = await this.knownRepo.findByECDSAPK(ecdsaPK);
            let updated = false;
            if (body.candidateName.toString() != '') {
              known.name = body.candidateName.toString();
              updated = true;
            }
            if (body.candidateAddr.toString() != '') {
              known.address = '0x' + body.candidateAddr.toLowerCase();
              updated = true;
            }
            if (body.candidateIP.toString() != '') {
              known.ipAddress = body.candidateIP.toString();
              updated = true;
            }
            if (body.candidatePort.toString() != '') {
              known.port = body.candidatePort;
              updated = true;
            }
            if (updated) {
              await known.save();
            }
          }
        }

        // handle staking governing
        if (body.opCode === se.StakingOpCode.Governing) {
          this.log.info(`handle staking governing`);
          let autobidTotal = new BigNumber(0);
          let transferTotal = new BigNumber(0);
          let autobidCount = 0;
          let transferCount = 0;
          const config = GetNetworkConfig(this.network);
          if (config.auctionEnabled) {
            const prePresent = await this.pos.getPresentAuctionByRevision(blockNum - 1);
            const present = await this.pos.getPresentAuctionByRevision(blockNum);
            // const candidateList = await this.pos.getCandidatesOnRevision(blockNum);

            // const candidatesInEpoch: Candidate[] = [];
            // for (const c of candidateList) {
            //   candidatesInEpoch.push({
            //     ...c,
            //     epoch,
            //     ipAddress: c.ipAddr,
            //   } as Candidate);
            // }
            // await this.candidateRepo.bulkUpsert(...candidatesInEpoch);

            let visited = {};
            for (const atx of prePresent.auctionTxs) {
              visited[atx.txid] = true;
            }
            const auction = await this.auctionRepo.findByID(present.auctionID);
            if (auction) {
              auction.bidCount = present.auctionTxs.length;
              auction.receivedMTR = new BigNumber(present.receivedMTR);
              auction.actualPrice = auction.receivedMTR.times(1e18).dividedBy(auction.releasedMTRG).dividedBy(1e18);
              if (auction.actualPrice.isLessThan(present.reservedPrice)) {
                auction.actualPrice = new BigNumber(present.reservedPrice);
              }
              await auction.save();
            }
            for (const atx of present.auctionTxs) {
              if (atx.type != 'autobid') {
                continue;
              }
              if (atx.txid in visited) {
                continue;
              }
              let savedBid = await this.bidRepo.findById(atx.txid);

              if (!savedBid) {
                this.log.info({ txid: atx.txid }, 'saved new bid');
                let bid: IBid = {
                  id: atx.txid,
                  address: atx.address,
                  amount: atx.amount,
                  type: atx.type,
                  timestamp: atx.timestamp,
                  nonce: new BigNumber(atx.nonce),

                  auctionID: present.auctionID,
                  epoch,
                  blockNum,
                  txHash: tx.hash,
                  clauseIndex,

                  pending: true,
                };
                savedBid = await this.bidRepo.create(bid);
              }
              let reward: IEpochReward = {
                epoch,
                blockNum,
                txHash: tx.hash,
                clauseIndex,
                bidID: atx.txid,

                address: atx.address,
                amount: new BigNumber(atx.amount),
                type: 'autobid',
              };
              if (savedBid) {
                reward.txHash = savedBid.txHash;
                reward.clauseIndex = savedBid.clauseIndex;
              }
              await this.epochRewardRepo.create(reward);
              autobidCount++;
              autobidTotal = autobidTotal.plus(atx.amount);
            }
          }

          const vreward = await this.pos.getLastValidatorReward(blockNum);
          for (const r of vreward.rewards) {
            const reward: IEpochReward = {
              epoch,
              blockNum,
              txHash: tx.hash,
              clauseIndex,
              address: r.address,
              amount: new BigNumber(r.amount),
              type: 'transfer',
            };
            await this.epochRewardRepo.create(reward);
            transferCount++;
            transferTotal = transferTotal.plus(r.amount);
          }

          // upsert validator rewards
          const vExist = await this.validatorRewardRepo.existEpoch(epoch);
          const rewards: IRewardInfo[] = vreward.rewards.map((info) => {
            return { amount: new BigNumber(info.amount), address: info.address };
          });
          if (!vExist) {
            await this.validatorRewardRepo.create({
              epoch: epoch,
              baseReward: new BigNumber(vreward.baseReward),
              totalReward: new BigNumber(vreward.totalReward),
              rewards,
            });
          }

          // update epoch reward summary
          const sExist = await this.epochRewardSummaryRepo.existEpoch(epoch);
          if (!sExist) {
            const epochSummary: IEpochRewardSummary = {
              epoch,
              blockNum,
              timestamp: blk.timestamp,
              autobidTotal,
              autobidCount,
              transferCount,
              transferTotal,
              totalReward: autobidTotal.plus(transferTotal),
            };
            await this.epochRewardSummaryRepo.create(epochSummary);
          }
        }
      }
    }
    this.log.info(`processed tx ${tx.hash}`);
  }

  async processBlock(blk: IBlock) {
    this.log.info(`start to process block ${blk.number}`);
    const number = blk.number;
    const epoch = blk.epoch;
    for (const [txIndex, txHash] of blk.txHashs.entries()) {
      const txModel = await this.txRepo.findByHash(txHash);
      if (!txModel) {
        throw new Error('could not find tx, maybe the block is still being processed');
      }
      await this.processTx(txModel, txIndex, blk);
    }

    this.log.info({ hash: blk.hash }, `processed block ${blk.number}`);
  }
}
