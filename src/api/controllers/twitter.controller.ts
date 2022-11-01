import { Request, Response, Router } from 'express';
import { try$ } from 'express-toolbox';
import { Network } from '../../const';
import { BaseController } from './baseController';

import { OAuth } from 'oauth'

const oauthCallback = process.env.FRONTEND_URL;
const CONSUMER_KEY = process.env.CONSUMER_KEY;
const CONSUMER_SECRET = process.env.CONSUMER_SECRET;
const _oauth = new OAuth(
  'https://api.twitter.com/oauth/request_token',
  'https://api.twitter.com/oauth/access_token',
  CONSUMER_KEY, // consumer key
  CONSUMER_SECRET, // consumer secret
  '1.0',
  oauthCallback,
  'HMAC-SHA1',
);

class TwitterController extends BaseController {
  public path = '/api/twitter';
  public router = Router();

  constructor(network: Network, standby: boolean) {
    super(network, standby);
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}/requestToken`, try$(this.getOAuthRequestToken));
  }

  private getOAuthRequestToken = async (req: Request, res: Response) => {
    const token = await _oauth.getOAuthRequestToken()
    console.log('token', token)
    res.json({
      token
    })
  };
}

export default TwitterController;
