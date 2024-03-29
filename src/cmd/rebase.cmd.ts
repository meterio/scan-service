import * as devkit from '@meterio/devkit';
import pino from 'pino';
import { Network } from '../const';
import { ethers } from 'ethers';
import * as fs from 'fs';
import { IBlock, ITx } from '../model';
import { CandidateRepo } from '../repo';
import { GetNetworkConfig } from '../const';

import { TxBlockListener } from './blockListener';

const NORMAL_INTERVAL = 10000;
export class RebaseCMD extends TxBlockListener {
  protected candidateRepo = new CandidateRepo();

  constructor(net: Network) {
    super(net, NORMAL_INTERVAL);
    this.log = pino({
      transport: {
        target: 'pino-pretty',
      },
    });
    this.network = net;
    this.name = 'rebase';
  }

  async sendRebaseTx() {
    const config = GetNetworkConfig(this.network);
    if (!config.stMTRGRebaseEnabled) {
      this.log.info('skip rebasing becuz its not enabled');
      return;
    }

    if (!process.env.REBASE_KEYSTORE || !process.env.REBASE_PASSPHRASE) {
      this.log.warn('please set env REBASE_KEYSTORE and REBASE_PASSPHRASE');
      return;
    }
    const content = fs.readFileSync(process.env.REBASE_KEYSTORE);
    const keystore = JSON.parse(content.toString());
    console.log(JSON.stringify(keystore));
    console.log('passphrase: ', process.env.REBASE_PASSPHRASE);

    const encrypted = await devkit.cry.Keystore.decrypt(keystore, process.env.REBASE_PASSPHRASE);
    console.log('encrypted');
    const pk = '0x' + encrypted.toString('hex');
    const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
    const signer = new ethers.Wallet(pk, provider);
    const iface = new ethers.utils.Interface(['function rebase()', 'function sync()']);

    // send rebase tx
    const rebaseData = iface.encodeFunctionData('rebase', []);
    const rebaseTx = {
      to: config.stMTRGAddress,
      value: 0,
      data: rebaseData,
      gasLimit: 120000,
    };
    console.log(`prepare to send rebase tx:`, rebaseTx);
    const rebaseReceipt = await signer.sendTransaction(rebaseTx);
    console.log(`received rebase receipt:`, rebaseReceipt);

    // send sync tx
    const syncData = iface.encodeFunctionData('sync', []);
    const syncTx = {
      to: config.stMTRG_MTRG_Pair,
      value: 0,
      data: syncData,
      gasLimit: 180000,
    };
    console.log(`prepare to send receipt tx:`, rebaseTx);
    const syncReceipt = await signer.sendTransaction(syncTx);
    console.log(`received rebase receipt:`, syncReceipt);
  }

  async processTx(tx: ITx, txIndex: number, blk: IBlock) {
    const epoch = blk.epoch;
    const blockNum = blk.number;
    if (tx.reverted) {
      return;
    }

    // process outputs
    for (const [clauseIndex, o] of tx.outputs.entries()) {
      for (const evt of o.events) {
        if (evt.topics && evt.topics[0] === devkit.ScriptEngine.NativeAuctionEnd.signature) {
          this.log.info(`identified a auction end at ${blockNum} in epoch ${epoch}`);
          const posHead = await this.headRepo.findByKey('pos');
          if (posHead && posHead.num > blockNum + 100) {
            this.log.info(`skip sending rebase tx because ${blockNum} is far behind pos head ${posHead.num}`);
          } else {
            await this.sendRebaseTx();
          }
        }
      }
    }
    this.log.info(`processed tx ${tx.hash}`);
  }

  async processBlock(blk: IBlock) {
    this.log.info(`start to process block ${blk.number}`);
    for (const [txIndex, txHash] of blk.txHashs.entries()) {
      const txModel = await this.txRepo.findByHash(txHash);
      if (!txModel) {
        throw new Error('could not find tx, maybe the block is still being processed');
      }
      try {
        await this.processTx(txModel, txIndex, blk);
      } catch (e) {
        this.log.error({ err: e }, `Error while processing tx ${txModel.id}`);
      }
    }

    this.log.info({ hash: blk.hash }, `processed block ${blk.number}`);
  }
}
