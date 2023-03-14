import { ZeroAddress } from '../const';
import { LogTransfer } from '../model/logTransfer.interface';
import logTransferModel from '../model/logTransfer.model';

export default class LogTransferRepo {
  private model = logTransferModel;

  public async findAll() {
    return this.model.find();
  }

  public async findByTxHash(txHash: string) {
    return this.model.find({ txHash });
  }

  public async findByClause(txHash: string, clauseIndex: number) {
    return this.model.find({ txHash, clauseIndex });
  }

  public async findByBlockNum(blockNum: number) {
    return this.model.find({ 'block.number': blockNum });
  }

  public async exist(txHash: string, clauseIndex: number, logIndex: number) {
    return this.model.exists({ txHash, clauseIndex, logIndex });
  }

  public async create(evt: LogTransfer) {
    return this.model.create(evt);
  }

  public async bulkInsert(...evts: LogTransfer[]) {
    return this.model.create(evts);
  }

  public async bulkUpsert(...trs: LogTransfer[]) {
    for (const t of trs) {
      await this.model.findOneAndUpdate({ txHash: t.txHash, clauseIndex: t.clauseIndex, logIndex: t.logIndex }, t, {
        new: true,
        upsert: true,
        overwrite: true,
      });
    }
    return true;
  }

  public async deleteAfter(blockNum: number) {
    return this.model.deleteMany({ 'block.number': { $gt: blockNum } });
  }

  public async findBeforeNum(blockNum: number) {
    return this.model.find({ 'block.number': { $gt: blockNum } });
  }

  public async findMintInRange(token: number, start, end: number) {
    return this.model
      .find({ sender: ZeroAddress, token, 'block.number': { $gte: start, $lte: end } })
      .sort({ 'block.number': 1 });
  }

  public async findBurnInRange(token: number, start, end: number) {
    return this.model
      .find({ recipient: ZeroAddress, token, 'block.number': { $gte: start, $lte: end } })
      .sort({ 'block.number': 1 });
  }
}
