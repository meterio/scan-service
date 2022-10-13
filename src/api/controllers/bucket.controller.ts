import { BucketRepo } from '../../repo';
import { Request, Response, Router } from 'express';
import { try$ } from 'express-toolbox';
import { Network } from '../../const';
import { BaseController } from './baseController';

class BucketController extends BaseController {
  public path = '/api/buckets';
  public router = Router();
  private bucketRepo = new BucketRepo();

  constructor(network: Network, standby: boolean) {
    super(network, standby);
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}/:id`, try$(this.getBucketByID));
  }

  private getBucketByID = async (req: Request, res: Response) => {
    const { id } = req.params;
    const bkt = await this.bucketRepo.findByID(id);
    if (!bkt) {
      return res.json({ bucket: {} });
    }
    return res.json({ bucket: bkt.toJSON() });
  };
}
export default BucketController;
