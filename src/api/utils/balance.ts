import { BigNumber } from 'bignumber.js';
import { fromWei } from './utils';

export class Balance {
  private addr: string;
  private mtr: BigNumber;
  private mtrg: BigNumber;
  constructor(addr: string, mtr: number | string | BigNumber, mtrg: number | string | BigNumber) {
    this.addr = addr;
    this.mtr = new BigNumber(mtr);
    this.mtrg = new BigNumber(mtrg);
  }

  public plusMTR(amount: number | string | BigNumber) {
    this.mtr = this.mtr.plus(amount);
  }
  public plusMTRG(amount: number | string | BigNumber) {
    this.mtrg = this.mtrg.plus(amount);
  }
  public minusMTR(amount: number | string | BigNumber) {
    this.mtr = this.mtr.minus(amount);
  }
  public minusMTRG(amount: number | string | BigNumber) {
    this.mtrg = this.mtrg.minus(amount);
  }
  public MTR() {
    return this.mtr;
  }
  public MTRG() {
    return this.mtrg;
  }
  public Address() {
    return this.addr;
  }

  public String() {
    return `{ MTR: ${fromWei(this.mtr)}, MTRG: ${fromWei(this.mtrg)} }`;
  }
}
