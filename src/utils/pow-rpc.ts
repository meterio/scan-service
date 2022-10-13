import '@meterio/flex';

import { BigNumber } from 'bignumber.js';
import { Network } from '../const';
import { PowBlock, PowTx } from '../model';
import Client from 'bitcoin-core';
import LRU from 'lru-cache';

import { GetNetworkConfig } from '../const';

var bitcoin = require('bitcoinjs-lib');

export namespace Pow {
  export type ExpandedBlock = Omit<Required<Flex.Meter.Block>, 'transactions'> & {
    transactions: Array<Omit<Flex.Meter.Transaction, 'meta'> & Omit<Flex.Meter.Receipt, 'meta'>>;
  };
  export type Block<T extends 'expanded' | 'regular'> = T extends 'expanded'
    ? ExpandedBlock
    : Required<Flex.Meter.Block>;
  export type Transaction = Flex.Meter.Transaction;
  export type Receipt = Flex.Meter.Receipt;
  export type Account = Flex.Meter.Account;
  export type Code = Flex.Meter.Code;
  export type Storage = Flex.Meter.Storage;
  export type Event = Flex.Meter.Event;
  export type VMOutput = Flex.Meter.VMOutput;
}

export class Pow {
  private cache: LRU<string, any>;
  private btc: Client;

  // default genesis ID to mainnet
  constructor(network: Network) {
    const conf = GetNetworkConfig(network);
    const client = new Client({
      username: conf.powUser,
      password: conf.powPass,
      host: conf.powHost,
      port: conf.powPort,
    });
    this.btc = client;
    this.cache = new LRU<string, any>({ max: 1024 * 4 });
  }

  public async getBlock(height: number): Promise<PowBlock | null> {
    const cacheOrLoad = async (func: () => Promise<PowBlock | null>) => {
      let key = 'b' + height.toString();

      if (this.cache.has(key!)) {
        return this.cache.get(key!) as PowBlock;
      }

      const b = await func();

      // cache the block
      this.cache.set(key, b);
      return b;
    };
    return cacheOrLoad(() => {
      return this.getBlockRPC(height);
    });
  }

  public async getTx(txhash: string): Promise<PowTx | null> {
    const cacheOrLoad = async (func: () => Promise<PowTx | null>) => {
      let key = 't' + txhash;

      if (this.cache.has(key!)) {
        return this.cache.get(key!) as PowTx;
      }

      const tx = await func();

      // cache the tx
      this.cache.set(key, tx);
      return tx;
    };
    return cacheOrLoad(() => {
      return this.getTransactionRPC(txhash);
    });
  }

  public async getBlockchainInfo() {
    return this.btc.getBlockchainInfo();
  }

  public async getMiningInfo() {
    return this.btc.getMiningInfo();
  }

  private async getBlockRPC(height: number): Promise<PowBlock | null> {
    const hash = await this.btc.getBlockHash(height);
    const blk = await this.btc.getBlock(hash);
    const result = {
      ...blk,
      difficulty: new BigNumber(blk.difficulty),
      nonce: new BigNumber(blk.nonce),
      medianTime: new BigNumber(blk.mediantime),
      strippedSize: blk.strippedsize,
      previousBlockHash: blk.previousblockhash,
      nextBlockHash: blk.nextblockhash,
      chainWork: blk.chainwork,
      merkleRoot: blk.merkleroot,
    };
    return result;
  }

  private async getTransactionRPC(txhash: string): Promise<PowTx | null> {
    const raw = await this.btc.getRawTransaction(txhash);
    if (!raw || raw.length <= 0) {
      return;
    }
    var tx = bitcoin.Transaction.fromHex(raw);
    let powTx: PowTx = {
      hash: txhash,
      version: tx.version,
      locktime: tx.locktime,
      ins: [],
      outs: [],
    };
    for (const i of tx.ins) {
      powTx.ins.push({
        hash: '0x' + i.hash.toString('hex'),
        index: i.index,
        script: '0x' + i.script.toString('hex'),
        sequence: i.sequence,
        witness: i.witness,
      });
    }
    for (const o of tx.outs) {
      powTx.outs.push({
        value: o.value,
        script: '0x' + o.script.toString('hex'),
      });
    }
    return powTx;
  }
}
