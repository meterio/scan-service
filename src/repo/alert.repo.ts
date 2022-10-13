import { RECENT_WINDOW } from '../const';
import { Alert } from '../model/alert.interface';
import alertModel from '../model/alert.model';

export default class AlertRepo {
  private model = alertModel;
  public async findAll() {
    return this.model.find();
  }

  public async findRecent() {
    return this.model.find().sort({ createdAt: -1 }).limit(RECENT_WINDOW);
  }

  public async existMsg(network: string, epoch: number, number: number, channel: string, msg: string) {
    return this.model.exists({
      network,
      epoch,
      number,
      channel,
      msg,
    });
  }

  public async findByNumber(num: number) {
    return this.model.findOne({
      number: num,
    });
  }

  public async create(alert: Alert) {
    return this.model.create(alert);
  }

  public async bulkInsert(...alert: Alert[]) {
    return this.model.create(alert);
  }

  public async delete(hash: string) {
    return this.model.deleteOne({ hash });
  }
}
