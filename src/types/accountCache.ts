import { BigNumber } from 'bignumber.js';
import { AccountRepo } from '../repo';
import { IAccount, IBlockConcise } from '../model';
import { getAccountName, ZeroAddress, Network, Token } from '../const';
import { Pos, fromWei } from '../utils';

export class AccountCache {
  private accts: { [key: string]: IAccount & { save(); toJSON() } } = {};
  private repo = new AccountRepo();
  private network: Network;
  private pos: Pos;

  constructor(network: Network) {
    this.network = network;
    this.pos = new Pos(network);
  }

  public list() {
    return Object.values(this.accts);
  }

  private async fixAccount(addrStr: string, blockConcise: IBlockConcise) {
    const addr = addrStr.toLowerCase();
    const chainAcc = await this.pos.getAccount(addr, blockConcise.number.toString());
    let acct = this.accts[addr];

    const balance = new BigNumber(chainAcc.balance);
    const energy = new BigNumber(chainAcc.energy);
    const boundedBalance = new BigNumber(chainAcc.boundbalance);
    const boundedEnergy = new BigNumber(chainAcc.boundenergy);
    if (
      acct.mtrgBalance.toFixed() !== balance.toFixed() ||
      acct.mtrBalance.toFixed() !== energy.toFixed() ||
      acct.mtrgBounded.toFixed() !== boundedBalance.toFixed() ||
      acct.mtrBounded.toFixed() !== boundedEnergy.toFixed()
    ) {
      const preMTR = acct.mtrBalance;
      const preMTRG = acct.mtrgBalance;
      const preBoundedMTR = acct.mtrBounded;
      const preBoundedMTRG = acct.mtrgBounded;
      acct.mtrBalance = energy;
      acct.mtrgBalance = balance;
      acct.mtrBounded = boundedEnergy;
      acct.mtrgBounded = boundedBalance;
      acct.lastUpdate = blockConcise;

      this.accts[addr] = acct;
      console.log(`Fixed Account ${acct.address}:`);
      if (!preMTR.isEqualTo(energy)) {
        console.log(`  MTR: ${fromWei(preMTR)} -> ${fromWei(energy)} `);
      }
      if (!preMTRG.isEqualTo(balance)) {
        console.log(`  MTRG: ${fromWei(preMTRG)} -> ${fromWei(balance)}`);
      }
      if (!preBoundedMTR.isEqualTo(boundedEnergy)) {
        console.log(`  Bounded MTR: ${fromWei(preBoundedMTR)} -> ${fromWei(boundedEnergy)}`);
      }
      if (!preBoundedMTRG.isEqualTo(boundedBalance)) {
        console.log(`  Bounded MTRG: ${fromWei(preBoundedMTRG)} -> ${fromWei(boundedBalance)}`);
      }
    }
  }

  public async minus(addrStr: string, token: Token, amount: string | BigNumber, blockConcise: IBlockConcise) {
    if (addrStr === ZeroAddress || new BigNumber(amount).isLessThanOrEqualTo(0)) {
      return;
    }

    await this.setDefault(addrStr, blockConcise);
    const addr = addrStr.toLowerCase();
    const formattedAmount = new BigNumber(amount);
    if (token === Token.MTR) {
      console.log(`Account ${addr} minus MTR: ${this.accts[addr].mtrBalance} - ${formattedAmount} `);
      this.accts[addr].mtrBalance = this.accts[addr].mtrBalance.minus(formattedAmount);
      if (this.accts[addr].mtrBalance.isLessThan(0)) {
        console.log(`Got negative balance: ${this.accts[addr].mtrBalance}`);
        await this.fixAccount(addr, blockConcise);
      }
      console.log(`Got => ${this.accts[addr].mtrBalance}`);
    }
    if (token === Token.MTRG) {
      console.log(`Account ${addr} minus MTRG: ${this.accts[addr].mtrgBalance} - ${formattedAmount} `);
      this.accts[addr].mtrgBalance = this.accts[addr].mtrgBalance.minus(formattedAmount);
      if (this.accts[addr].mtrgBalance.isLessThan(0)) {
        console.log(`Got negative balance: ${this.accts[addr].mtrgBalance}`);
        await this.fixAccount(addr, blockConcise);
      }
      console.log(`Got => ${this.accts[addr].mtrgBalance}`);
    }
    this.accts[addr].lastUpdate = blockConcise;
  }

  private async setDefault(addrStr: string, blockConcise: IBlockConcise) {
    const address = addrStr.toLowerCase();
    if (this.accts[address]) {
      return;
    }
    const acctInDB = await this.repo.findByAddress(address);
    if (!acctInDB) {
      const name = getAccountName(this.network, address);
      const newAcct = await this.repo.create(name, address, blockConcise);
      this.accts[address] = newAcct;
    } else {
      this.accts[address] = acctInDB;
    }
  }

  public async plus(addrStr: string, token: Token, amount: string | BigNumber, blockConcise: IBlockConcise) {
    if (new BigNumber(amount).isLessThanOrEqualTo(0)) {
      return;
    }
    await this.setDefault(addrStr, blockConcise);
    const formattedAmount = new BigNumber(amount);
    const addr = addrStr.toLowerCase();
    if (token === Token.MTR) {
      console.log(`Account ${addr} plus MTR: ${this.accts[addr].mtrBalance} + ${formattedAmount} `);
      this.accts[addr].mtrBalance = this.accts[addr].mtrBalance.plus(formattedAmount);
      if (this.accts[addr].mtrBalance.isLessThan(0)) {
        console.log(`Got negative balance: ${this.accts[addr].mtrBalance}`);
        await this.fixAccount(addr, blockConcise);
      }
      console.log(`Got => ${this.accts[addr].mtrBalance}`);
    }
    if (token === Token.MTRG) {
      console.log(`Account ${addr} plus MTRG: ${this.accts[addr].mtrgBalance} + ${formattedAmount} `);
      this.accts[addr].mtrgBalance = this.accts[addr].mtrgBalance.plus(formattedAmount);
      if (this.accts[addr].mtrgBalance.isLessThan(0)) {
        console.log(`Got negative balance: ${this.accts[addr].mtrgBalance}`);
        await this.fixAccount(addr, blockConcise);
      }
      console.log(`Got => ${this.accts[addr].mtrgBalance}`);
    }
    this.accts[addr].lastUpdate = blockConcise;
  }

  public async bound(addrStr: string, token: Token, amount: string | BigNumber, blockConcise: IBlockConcise) {
    await this.setDefault(addrStr, blockConcise);
    const addr = addrStr.toLowerCase();
    const formattedAmount = new BigNumber(amount);
    if (token === Token.MTR) {
      this.accts[addr].mtrBalance = this.accts[addr].mtrBalance.minus(formattedAmount);
      this.accts[addr].mtrBounded = this.accts[addr].mtrBounded.plus(formattedAmount);
    }
    if (token === Token.MTRG) {
      console.log(`Account ${addr} bound MTRG:`);
      console.log(`  Balance: ${this.accts[addr].mtrgBalance} - ${formattedAmount}`);
      console.log(`  Bounded: ${this.accts[addr].mtrgBounded} + ${formattedAmount} `);
      this.accts[addr].mtrgBalance = this.accts[addr].mtrgBalance.minus(formattedAmount);
      this.accts[addr].mtrgBounded = this.accts[addr].mtrgBounded.plus(formattedAmount);
      if (this.accts[addr].mtrgBalance.isLessThan(0)) {
        console.log(`Got negative balance: ${this.accts[addr].mtrgBalance}`);
        await this.fixAccount(addr, blockConcise);
      }
      console.log(`Got => Balance: ${this.accts[addr].mtrgBalance}, Bounded: ${this.accts[addr].mtrgBounded}`);
    }
    this.accts[addr].lastUpdate = blockConcise;
  }

  public async withdraw(
    ownerStr: string,
    recipientStr: string,
    token: Token,
    amount: string | BigNumber,
    blockConcise: IBlockConcise
  ) {
    await this.setDefault(ownerStr, blockConcise);
    await this.setDefault(recipientStr, blockConcise);
    const owner = ownerStr.toLowerCase();
    const recipient = recipientStr.toLowerCase();
    const formattedAmount = new BigNumber(amount);
    if (token === Token.MTR) {
      this.accts[owner].mtrBounded = this.accts[owner].mtrBounded.minus(formattedAmount);
      this.accts[recipient].mtrBounded = this.accts[recipient].mtrBounded.plus(formattedAmount);
    }
    if (token === Token.MTRG) {
      console.log(`Account ${owner} withdraw ${formattedAmount} MTRG to ${recipient}:`);
      console.log(`  Owner Bounded: ${this.accts[owner].mtrgBounded} - ${formattedAmount}`);
      console.log(`  Recipient Bounded: ${this.accts[recipient].mtrgBounded} + ${formattedAmount} `);
      this.accts[owner].mtrgBounded = this.accts[owner].mtrgBalance.minus(formattedAmount);
      this.accts[recipient].mtrgBounded = this.accts[recipient].mtrgBounded.plus(formattedAmount);
      if (this.accts[owner].mtrgBounded.isLessThan(0)) {
        console.log(`Got negative bounded: ${this.accts[owner].mtrgBounded}`);
        await this.fixAccount(owner, blockConcise);
      }
      console.log(
        `Got => Owner Bounded: ${this.accts[owner].mtrgBounded}, Recipient Bounded: ${this.accts[recipient].mtrgBounded}`
      );
    }
    this.accts[owner].lastUpdate = blockConcise;
    this.accts[recipient].lastUpdate = blockConcise;
  }

  public async unbound(addrStr: string, token: Token, amount: string | BigNumber, blockConcise: IBlockConcise) {
    await this.setDefault(addrStr, blockConcise);
    const addr = addrStr.toLowerCase();
    const formattedAmount = new BigNumber(amount);
    if (token === Token.MTR) {
      this.accts[addr].mtrBalance = this.accts[addr].mtrBalance.plus(formattedAmount);
      this.accts[addr].mtrBounded = this.accts[addr].mtrBounded.minus(formattedAmount);
    }
    if (token === Token.MTRG) {
      console.log(`Account ${addr} unbound MTRG:`);
      console.log(`  Balance: ${this.accts[addr].mtrgBalance} + ${formattedAmount}`);
      console.log(`  Bounded: ${this.accts[addr].mtrgBounded} - ${formattedAmount} `);
      this.accts[addr].mtrgBalance = this.accts[addr].mtrgBalance.plus(formattedAmount);
      this.accts[addr].mtrgBounded = this.accts[addr].mtrgBounded.minus(formattedAmount);
      console.log(`Got => Balance: ${this.accts[addr].mtrgBalance}, Bounded: ${this.accts[addr].mtrgBounded}`);
      if (this.accts[addr].mtrgBounded.isLessThan(0)) {
        console.log(`Got negative bounded: ${this.accts[addr].mtrgBounded}`);
        await this.fixAccount(addr, blockConcise);
      }
    }
    this.accts[addr].lastUpdate = blockConcise;
  }

  public async saveToDB() {
    const count = Object.keys(this.accts).length;
    if (count > 0) {
      await Promise.all(Object.values(this.accts).map((a) => a.save()));
      console.log(`saved ${count} accounts to DB`);
    }
  }

  public clean() {
    this.accts = {};
  }
}
