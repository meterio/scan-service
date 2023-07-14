import { RECENT_WINDOW } from '../const';
import { Alert, IAlert } from '../model';

export class AlertRepo {
  private model = Alert;
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

  public async create(alert: IAlert) {
    return this.model.create(alert);
  }

  public async bulkInsert(...alert: IAlert[]) {
    return this.model.create(alert);
  }

  public async delete(hash: string) {
    return this.model.deleteOne({ hash });
  }
}
