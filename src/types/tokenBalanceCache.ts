import { BigNumber } from 'bignumber.js';
import { Network } from '../const';
import { INFTBalance, IBlockConcise, ITokenBalance } from '../model';
import { ContractRepo, MovementRepo, TokenBalanceRepo } from '../repo';
import { ZeroAddress } from '../const';
import { Pos } from '../utils';
import PromisePool from '@supercharge/promise-pool/dist';
import { Document, Types } from 'mongoose';

const printNFT = (bals: INFTBalance[], deltas: INFTBalance[]) => {
  if (bals.length <= 0) {
    return '[]';
  }
  let m = {};
  let matches = [];
  for (const bal of bals) {
    m[bal.tokenId] = bal.value;
  }
  for (const d of deltas) {
    if (d.tokenId in m) {
      matches.push(`${d.tokenId}=>${m[d.tokenId]}`);
    }
  }
  return matches.length === 0 ? '[...]' : `[${matches.join(', ')} ${matches.length === bals.length ? '' : '...'}]`;
};

const printDelta = (deltas: INFTBalance[]) => {
  let tokens = [];
  for (const d of deltas) {
    tokens.push(`${d.tokenId}=>${d.value}`);
  }
  return `[${tokens.join(', ')}]`;
};

export const mergeNFTBalances = (origin: INFTBalance[], delta: INFTBalance[], plus = true) => {
  let resultMap: { [key: number]: number } = {};
  for (const i in origin) {
    const { tokenId, value } = origin[i];
    resultMap[tokenId] = value;
  }
  for (const i in delta) {
    const { tokenId, value } = delta[i];
    if (resultMap.hasOwnProperty(tokenId)) {
      if (plus) {
        resultMap[tokenId] += value;
      } else {
        resultMap[tokenId] -= value;
      }
    } else {
      if (plus) {
        resultMap[tokenId] = value;
      } else {
        // FIXME: error!
      }
    }
  }
  let bals: INFTBalance[] = [];
  for (const tokenId in resultMap) {
    const value = resultMap[tokenId];
    if (value > 0) {
      bals.push({ tokenId, value });
    }
  }
  return bals;
};

export class TokenBalanceCache {
  private bals: { [key: string]: ITokenBalance & Document<unknown, {}, ITokenBalance> & { _id: Types.ObjectId } } = {};
  private tokenBalanceRepo = new TokenBalanceRepo();
  private contractRepo = new ContractRepo();
  private movementRepo = new MovementRepo();
  private pos: Pos;

  // normally we could just update the nftBalances in bals map
  // but mongoose is really slow on large array init (even just an update in memory!!)
  // so here save nft into a separate map would boost the performance
  private nfts: { [key: string]: INFTBalance[] } = {};

  constructor(net: Network) {
    this.pos = new Pos(net);
  }

  public list() {
    return Object.values(this.bals);
  }

  private async fixTokenBalance(addrStr: string, tokenAddr: string, blockConcise: IBlockConcise) {
    const key = `${addrStr}_${tokenAddr}`.toLowerCase();
    let bal = this.bals[key];

    const chainBal = await this.pos.getERC20BalanceOf(addrStr, tokenAddr, blockConcise.number.toString());

    const preBal = bal.balance;
    if (!preBal.isEqualTo(chainBal)) {
      bal.balance = new BigNumber(chainBal);
      console.log(`Fixed balance on ${bal.address} for token ${bal.tokenAddress}:`);
      console.log(`  Balance: ${preBal.toFixed()} -> ${bal.balance.toFixed()}`);
      bal.lastUpdate = blockConcise;
      this.bals[key] = bal;
    }
  }

  private async setDefault(addrStr: string, tokenAddr: string, blockConcise: IBlockConcise) {
    const key = `${addrStr}_${tokenAddr}`.toLowerCase();
    if (this.bals[key]) {
      return;
    }
    const balInDB = await this.tokenBalanceRepo.findByAddress(addrStr, tokenAddr);
    if (!balInDB) {
      const newBal = await this.tokenBalanceRepo.create(addrStr, tokenAddr, blockConcise);
      this.bals[key] = newBal;
    } else {
      this.bals[key] = balInDB;
    }

    // be careful NOT just save nftBalances, that's only a reference, does NOT boost performance at all
    this.nfts[key] = mergeNFTBalances(this.bals[key].nftBalances, []);
  }

  public async minus(addrStr: string, tokenAddr: string, amount: string | BigNumber, blockConcise: IBlockConcise) {
    if (addrStr === ZeroAddress || new BigNumber(amount).isLessThanOrEqualTo(0)) {
      return;
    }
    await this.setDefault(addrStr, tokenAddr, blockConcise);
    const formattedAmount = new BigNumber(amount);
    const key = `${addrStr}_${tokenAddr}`.toLowerCase();
    console.log(`Token ${tokenAddr} on ${addrStr} minus: ${this.bals[key].balance} - ${formattedAmount} `);
    this.bals[key].balance = this.bals[key].balance.minus(formattedAmount);
    if (this.bals[key].balance.isLessThan(0) || Number.isNaN(this.bals[key].balance.toNumber())) {
      console.log(`Got invalid balance: ${this.bals[key].balance}`);
      await this.fixTokenBalance(addrStr, tokenAddr, blockConcise);
    }
    console.log(`Got => ${this.bals[key].balance}`);
    this.bals[key].lastUpdate = blockConcise;
  }

  public async plus(addrStr: string, tokenAddr: string, amount: string | BigNumber, blockConcise: IBlockConcise) {
    if (addrStr === ZeroAddress || new BigNumber(amount).isLessThanOrEqualTo(0)) {
      return;
    }
    await this.setDefault(addrStr, tokenAddr, blockConcise);
    const formattedAmount = new BigNumber(amount);
    const key = `${addrStr}_${tokenAddr}`.toLowerCase();
    console.log(`Token ${tokenAddr} on ${addrStr} plus: ${this.bals[key].balance} + ${formattedAmount} `);
    this.bals[key].balance = this.bals[key].balance.plus(formattedAmount);
    if (this.bals[key].balance.isLessThan(0) || Number.isNaN(this.bals[key].balance.toNumber())) {
      console.log(`Got invalid balance: ${this.bals[key].balance}`);
      await this.fixTokenBalance(addrStr, tokenAddr, blockConcise);
    }
    console.log(`Got => ${this.bals[key].balance}`);
    this.bals[key].lastUpdate = blockConcise;
  }

  public async plusNFT(addrStr: string, tokenAddr: string, nftDeltas: INFTBalance[], blockConcise: IBlockConcise) {
    if (addrStr === ZeroAddress) {
      return;
    }
    await this.setDefault(addrStr, tokenAddr, blockConcise);
    const key = `${addrStr}_${tokenAddr}`.toLowerCase();
    console.log(
      `NFT ${tokenAddr} on ${addrStr} plus: ${printNFT(this.nfts[key], nftDeltas)} + ${printDelta(nftDeltas)} `
    );
    const newNFTBalances = mergeNFTBalances(this.nfts[key], nftDeltas);
    console.log(`Got => ${printNFT(newNFTBalances, nftDeltas)}`);

    this.nfts[key] = newNFTBalances;
    this.bals[key].lastUpdate = blockConcise;
  }

  public async minusNFT(addrStr: string, tokenAddr: string, nftDeltas: INFTBalance[], blockConcise: IBlockConcise) {
    if (addrStr === ZeroAddress) {
      return;
    }
    await this.setDefault(addrStr, tokenAddr, blockConcise);
    const key = `${addrStr}_${tokenAddr}`.toLowerCase();
    console.log(
      `NFT ${tokenAddr} on ${addrStr} minus: ${printNFT(this.nfts[key], nftDeltas)} - ${printDelta(nftDeltas)} `
    );
    const newNFTBalances = mergeNFTBalances(this.nfts[key], nftDeltas, false);
    console.log(`Got => ${printNFT(newNFTBalances, nftDeltas)}`);
    this.nfts[key] = newNFTBalances;
    this.bals[key].lastUpdate = blockConcise;
  }

  public async saveToDB() {
    const count = Object.keys(this.bals).length;
    if (count > 0) {
      console.log(`saving ${count} NFTBalances`);
      for (const key in this.nfts) {
        if (key in this.bals) {
          this.bals[key].nftBalances = this.nfts[key];
          console.log(`get ${key} with ${this.nfts[key].length} nft balances`);
        }
      }
      await Promise.all(
        Object.values(this.bals).map((b) => {
          b.nftBalances = b.nftBalances.map((b) => ({ tokenId: b.tokenId, value: b.value }));
          const count = b.nftBalances.length;
          if (b.balance.isLessThanOrEqualTo(0) && b.nftBalances.length <= 0) {
            return this.tokenBalanceRepo.deleteByID(b.address, b.tokenAddress);
          } else {
            console.log(`saving tokenBalance for addr: ${b.address} tokenAddr: ${b.tokenAddress} with ${count} nfts`);
            return b.save();
          }
        })
      );
      console.log(`saved ${count} NFTBalances to DB`);

      await PromisePool.withConcurrency(4)
        .for(Object.values(this.bals))
        .process(async (b) => {
          await this.updateCounts(b.tokenAddress);
        });
    }
  }

  async updateCounts(address: string) {
    const c = await this.contractRepo.findByAddress(address);
    let updated = false;
    const ownerCount = await this.tokenBalanceRepo.countERC20ByAddress(c.address);
    const transferCount = await this.movementRepo.countERC20TxsByAddress(c.address);
    if (c.holdersCount && !c.holdersCount.isEqualTo(ownerCount)) {
      c.holdersCount = new BigNumber(ownerCount);
      updated = true;
    }
    c.tokensCount = new BigNumber(0);
    if (c.transfersCount || !c.transfersCount.isEqualTo(transferCount)) {
      c.transfersCount = new BigNumber(transferCount);
      updated = true;
    }
    if (updated) {
      await c.save();
      console.log(
        `updated counts on erc20 ${c.address} holders=${c.holdersCount.toFixed(0)} transfers=${c.transfersCount.toFixed(
          0
        )}`
      );
    }
  }

  public clean() {
    this.bals = {};
  }
}

export class NFTBalanceAuditor {
  private bals: { [key: string]: INFTBalance[] } = {};
  private lastUpdates: { [key: string]: IBlockConcise } = {};
  private tbRepo = new TokenBalanceRepo();

  private setDefault(addrStr: string, tokenAddr: string, blockConcise: IBlockConcise) {
    const key = `${addrStr}_${tokenAddr}`.toLowerCase();
    if (this.bals[key]) {
      return;
    }
    this.bals[key] = [];
    this.lastUpdates[key] = blockConcise;
  }

  public plusNFT(addrStr: string, tokenAddr: string, nftDeltas: INFTBalance[], blockConcise: IBlockConcise) {
    this.setDefault(addrStr, tokenAddr, blockConcise);
    const key = `${addrStr}_${tokenAddr}`.toLowerCase();
    console.log(
      `NFT ${tokenAddr} on ${addrStr} plus: ${printNFT(this.bals[key], nftDeltas)} + ${printDelta(nftDeltas)} `
    );
    const newNFTBalances = mergeNFTBalances(this.bals[key], nftDeltas);
    for (const { tokenId, value } of this.bals[key]) {
      if (value < 0) {
        throw new Error(`got negative balance for NFT ${tokenAddr} tokenId:${tokenId}, value:${value} `);
      }
    }
    console.log(`Got => ${printNFT(newNFTBalances, nftDeltas)}`);
    this.bals[key] = newNFTBalances;
    this.lastUpdates[key] = blockConcise;
  }

  public minusNFT(addrStr: string, tokenAddr: string, nftDeltas: INFTBalance[], blockConcise: IBlockConcise) {
    if (addrStr === ZeroAddress) {
      return;
    }
    this.setDefault(addrStr, tokenAddr, blockConcise);
    const key = `${addrStr}_${tokenAddr}`.toLowerCase();
    console.log(
      `NFT ${tokenAddr} on ${addrStr} minus: ${printNFT(this.bals[key], nftDeltas)} - ${printDelta(nftDeltas)} `
    );
    const newNFTBalances = mergeNFTBalances(this.bals[key], nftDeltas, false);
    for (const { tokenId, value } of this.bals[key]) {
      if (value < 0) {
        throw new Error(`got negative balance for NFT ${tokenAddr} tokenId:${tokenId}, value:${value} `);
      }
    }
    console.log(`Got => ${printNFT(newNFTBalances, nftDeltas)}`);
    this.bals[key] = newNFTBalances;
    this.lastUpdates[key] = blockConcise;
  }

  public async updateDB() {
    if (Object.keys(this.bals).length > 0) {
      for (const key in this.bals) {
        const items = key.split('_');
        const addr = items[0];
        const tokenAddr = items[1];
        let tb = await this.tbRepo.findByID(addr, tokenAddr);
        console.log(`updating balances of NFT ${tokenAddr} on ${addr}`);
        if (!tb) {
          tb = await this.tbRepo.create(addr, tokenAddr, this.lastUpdates[key]);
        }
        tb.nftBalances = this.bals[key];
        if (tb.lastUpdate.number < this.lastUpdates[key].number) {
          tb.lastUpdate = this.lastUpdates[key];
        }
        await tb.save();
        console.log('done');
      }
    }
  }

  get(key) {
    return this.bals[key];
  }
}
