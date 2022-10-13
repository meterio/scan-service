import { BigNumber } from 'bignumber.js';

import { fromWei } from '../../utils';

export class Balance {
  private mtr: BigNumber;
  private mtrg: BigNumber;
  private mtrBounded: BigNumber;
  private mtrgBounded: BigNumber;

  constructor(
    addr: string,
    mtr: number | string | BigNumber,
    mtrg: number | string | BigNumber,
    mtrBounded: number | string | BigNumber,
    mtrgBounded: number | string | BigNumber
  ) {
    this.mtr = new BigNumber(mtr);
    this.mtrg = new BigNumber(mtrg);
    this.mtrBounded = new BigNumber(mtrBounded);
    this.mtrgBounded = new BigNumber(mtrgBounded);
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
  public boundMTR(amount: number | string | BigNumber) {
    this.mtrBounded.plus(amount);
    this.mtr.minus(amount);
  }
  public unboundMTR(amount: number | string | BigNumber) {
    this.mtrBounded.minus(amount);
    this.mtr.plus(amount);
  }
  public boundMTRG(amount: number | string | BigNumber) {
    this.mtrgBounded.plus(amount);
    this.mtrg.minus(amount);
  }
  public unboundMTRG(amount: number | string | BigNumber) {
    this.mtrgBounded.minus(amount);
    this.mtrg.plus(amount);
  }

  public MTR() {
    return this.mtr;
  }
  public MTRG() {
    return this.mtrg;
  }
  public MTRBounded() {
    return this.mtrBounded;
  }
  public MTRGBounded() {
    return this.mtrgBounded;
  }

  public String() {
    return `{ MTR: ${fromWei(this.mtr)}, MTRG: ${fromWei(this.mtrg)}, MTRBounded: ${fromWei(
      this.mtrBounded
    )}, MTRGBounded: ${fromWei(this.mtrgBounded)}  }`;
  }
}
