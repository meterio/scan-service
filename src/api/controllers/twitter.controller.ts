import { Request, Response, Router } from 'express';
import { try$ } from 'express-toolbox';
import { Network } from '../../const';
import { BaseController } from './baseController';

import OAuth from 'oauth-1.0a'
import crypto from 'crypto'
import axios from 'axios';

const oauthCallback = process.env.FRONTEND_URL;
const CONSUMER_KEY = process.env.CONSUMER_KEY;
const CONSUMER_SECRET = process.env.CONSUMER_SECRET;

const requestTokenURL = 'https://api.twitter.com/oauth/request_token';
const authorizeURL = new URL('https://api.twitter.com/oauth/authorize');
const accessTokenURL = 'https://api.twitter.com/oauth/access_token';

const oauth = new OAuth({
  consumer: {
    key: CONSUMER_KEY,
    secret: CONSUMER_SECRET
  },
  signature_method: 'HMAC-SHA1',
  hash_function: (baseString, key) => crypto.createHmac('sha1', key).update(baseString).digest('base64')
});

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
    
    const authHeader = oauth.toHeader(oauth.authorize({
      url: requestTokenURL,
      method: 'POST'
    }));
    const result = await axios.post(requestTokenURL, {
      oauth_callback: oauthCallback
    }, {
      headers: {
        Authorization: authHeader["Authorization"]
      }
    })
    res.json({
      result
    })
  };
}

export default TwitterController;
