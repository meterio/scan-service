import { Request, Response, Router } from 'express';
import { try$ } from 'express-toolbox';
import { Network } from '../../const';
import { BaseController } from './baseController';

import OAuth from 'oauth-1.0a'
import crypto from 'crypto'
import axios from 'axios';
import qs from 'querystring'

const CALLBACK_URL = process.env.CALLBACK_URL;
const CONSUMER_KEY = process.env.CONSUMER_KEY;
const CONSUMER_SECRET = process.env.CONSUMER_SECRET;

const requestTokenURL = 'https://api.twitter.com/oauth/request_token';
const authorizeURL = new URL('https://api.twitter.com/oauth/authorize');
const accessTokenURL = 'https://api.twitter.com/oauth/access_token';
const verifyCredentialsURL = 'https://api.twitter.com/1.1/account/verify_credentials.json';
const userURL = 'https://api.twitter.com/2/users'

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
    this.router.get(`${this.path}/accessToken/:oauth_token/:oauth_verifier`, try$(this.getOAuthAccessToken));
    this.router.get(`${this.path}/verifyCredentials/:oauth_token/:oauth_token_secret`, try$(this.verifyCredentials))
    this.router.get(`${this.path}/user/:oauth_token/:oauth_token_secret/:id`, try$(this.getUseById))
  }

  private getOAuthRequestToken = async (req: Request, res: Response) => {
    
    const authHeader = oauth.toHeader(oauth.authorize({
      url: requestTokenURL,
      method: 'POST'
    }));
    const result = await axios.post(requestTokenURL, {
      oauth_callback: CALLBACK_URL
    }, {
      headers: {
        Authorization: authHeader["Authorization"]
      }
    })
    let data = {
      oauth_token: '',
      oauth_token_secret: '',
      oauth_callback_confirmed: false,
      authorizeURL: ''
    }
    if (result.data) {
      const parseRes = qs.parse(result.data)
      data = { ...data, ...parseRes }
      authorizeURL.searchParams.append('oauth_token', data.oauth_token)
      data.authorizeURL = authorizeURL.href;
    }
    res.json({
      ...data
    })
  };

  private getOAuthAccessToken = async (req: Request, res: Response) => {
    const { oauth_token, oauth_verifier } = req.params

    const authHeader = oauth.toHeader(oauth.authorize({
      url: accessTokenURL,
      method: 'POST'
    }));

    const result = await axios.post(accessTokenURL, null, {
      params: {
        oauth_token,
        oauth_verifier
      },
      headers: {
        Authorization: authHeader["Authorization"]
      }
    })

    let data = {
      oauth_token: '',
      oauth_token_secret: ''
    }

    if (result.data) {
      const parseRes = qs.parse(result.data)
      data = { ...data, ...parseRes }
    }

    res.json({
      ...data
    })
  }

  private verifyCredentials = async (req: Request, res: Response) => {
    const { oauth_token, oauth_token_secret } = req.params
    const token = {
      key: oauth_token,
      secret: oauth_token_secret
    };

    const authHeader = oauth.toHeader(oauth.authorize({
      url: verifyCredentialsURL,
      method: 'GET'
    }, token));

    const result = await axios.get(verifyCredentialsURL, {
      headers: {
        Authorization: authHeader["Authorization"]
      }
    })

    res.json({
      result: result.data
    })
  }

  private getUseById = async (req: Request, res: Response) => {
    const { oauth_token, oauth_token_secret, id } = req.params

    const endpointURL = new URL(`${userURL}/${id}`)
    endpointURL.searchParams.append('user.fields', 'id,name,profile_image_url,description')

    const token = {
      key: oauth_token,
      secret: oauth_token_secret
    };
  
    const authHeader = oauth.toHeader(oauth.authorize({
      url: endpointURL.href,
      method: 'GET'
    }, token));
  
    const result = await axios.get(endpointURL.href, {
      headers: {
        Authorization: authHeader["Authorization"],
        'user-agent': "v2UserLookupJS"
      }
    });

    res.json({
      result: result.data
    })
  }
}

export default TwitterController;
