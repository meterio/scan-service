import { Request, Response, Router } from 'express';
import { try$ } from 'express-toolbox';
import { Network } from '../../const';
import { TWITTER_NEED } from '../const';
import { BaseController } from './baseController';

import OAuth from 'oauth-1.0a'
import crypto from 'crypto'
import axios from 'axios';
import qs from 'querystring'
import { ERC721Twitter__factory } from '../typechain';
import { ethers } from 'ethers';
import { twitterSign, walletSign } from '../utils/permitSign';

const CALLBACK_URL = process.env.CALLBACK_URL;
const CONSUMER_KEY = process.env.CONSUMER_KEY;
const CONSUMER_SECRET = process.env.CONSUMER_SECRET;

const requestTokenURL = 'https://api.twitter.com/oauth/request_token';
const authorizeURL = 'https://api.twitter.com/oauth/authenticate';
const accessTokenURL = 'https://api.twitter.com/oauth/access_token';
const invalidateURL = 'https://api.twitter.com/1.1/oauth/invalidate_token';
const userURL = 'https://api.twitter.com/2/users';
const tweetsURL = `https://api.twitter.com/2/tweets`;

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
    this.router.get(`${this.path}/user/:oauth_token/:oauth_token_secret/:id`, try$(this.getUseById));
    this.router.get(`${this.path}/mint/:address/:tokenId/:username`, try$(this.mint));
    this.router.get(`${this.path}/create/:oauth_token/:oauth_token_secret`, try$(this.create));
    this.router.get(`${this.path}/invalidateToken/:oauth_token/:oauth_token_secret`, try$(this.invalidateToken));
    this.router.get(`${this.path}/username/:id`, try$(this.getUsernameById));
    this.router.get(`${this.path}/sinatureNFTWallet/:userAddr/:userId/:chainId`, try$(this.getNFTWalletSinature));
    this.router.get(`${this.path}/sinatureTwitter/:userAddr/:tokenId/:username/:chainId`, try$(this.getTwitterSinature));
  }

  private getTwitterSinature = async (req: Request, res: Response) => {
    const { userAddr, tokenId, username, chainId } = req.params
    
    const { twitterContract, privateKey, rpc } = TWITTER_NEED;
    try {
      const signer = new ethers.Wallet(privateKey, new ethers.providers.JsonRpcProvider(rpc))
      const signature = await twitterSign(signer, twitterContract, userAddr, tokenId, username, Number(chainId))
      res.json({
        result: signature
      })
    } catch(e) {
      console.log('get twitter signature', e)
      res.json({
        error: e.message
      })
    }
  }

  private getNFTWalletSinature = async (req: Request, res: Response) => {
    const { userAddr, userId, chainId } = req.params
    const { nftWalletContract, privateKey, rpc } = TWITTER_NEED;
    try {
      const signer = new ethers.Wallet(privateKey, new ethers.providers.JsonRpcProvider(rpc))
      const sinature = await walletSign(signer, nftWalletContract, userAddr, userId, Number(chainId))
      res.json({
        result: sinature
      })
    } catch(e) {
      console.log('get nft wallet signature', e)
      res.json({
        error: e.message
      })
    }
  }

  private getUsernameById = async (req: Request, res: Response) => {
    const { id } = req.params

    const { twitterContract, rpc } = TWITTER_NEED;

    const twitter = ERC721Twitter__factory.connect(
      twitterContract,
      new ethers.providers.JsonRpcProvider(rpc)
    );

    try {
      const result = await twitter['username(uint256)'](id)
      res.json({
        result
      })
    } catch(e) {
      res.json({
        error: e.message
      })
    }
  }

  private create = async (req: Request, res: Response) => {
    const { text } = req.query
    const { oauth_token, oauth_token_secret } = req.params
    if (!text) {
      throw new Error('text is need')
    }

    const token = {
      key: oauth_token,
      secret: oauth_token_secret
    };
  
    const authHeader = oauth.toHeader(oauth.authorize({
      url: tweetsURL,
      method: 'POST'
    }, token));

    try {
      const result = await axios.post(tweetsURL, {
        text
      }, {
        responseType: 'json',
        headers: {
          Authorization: authHeader["Authorization"],
          'user-agent': "v2CreateTweetJS",
          'content-type': "application/json",
          'accept': "application/json"
        }
      })
      console.log('create tweet result', result)
      if (result.data) {
        res.json(result.data)
      } else {
        res.json({
          error: 'create tweet failed'
        })
      }
    } catch(e) {
      res.json({
        error: e.response.data
      })
    }
    
  }

  private mint = async (req: Request, res: Response) => {
    const { address, tokenId, username } = req.params;

    if (!address || !tokenId || !username) {
      throw new Error('check address/tokenId/username please')
    }

    const { twitterContract, privateKey, rpc } = TWITTER_NEED;

    const twitter = ERC721Twitter__factory.connect(
      twitterContract,
      new ethers.Wallet(privateKey, new ethers.providers.JsonRpcProvider(rpc))
    );

    try {
      const tx = await twitter['mint(address,uint256,string)'](address, tokenId, username);
      const receipt = await tx.wait();

      res.json(receipt)
    } catch(e) {
      res.json({
        error: e
      })
    }
  }

  private getOAuthRequestToken = async (req: Request, res: Response) => {

    const _requestTokenURL = `${requestTokenURL}?oauth_callback=${encodeURIComponent(CALLBACK_URL)}&x_auth_access_type=write`
    
    const authHeader = oauth.toHeader(oauth.authorize({
      url: _requestTokenURL,
      method: 'POST'
    }));
    try {
      const result = await axios.post(_requestTokenURL, null, {
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
        data.authorizeURL = `${authorizeURL}?oauth_token=${data.oauth_token}`;
      }
      res.json({
        ...data
      })
    } catch(e) {
      res.json({
        error: e.response.data
      })
    }
  };

  private getOAuthAccessToken = async (req: Request, res: Response) => {
    const { oauth_token, oauth_verifier } = req.params

    const authHeader = oauth.toHeader(oauth.authorize({
      url: accessTokenURL,
      method: 'POST'
    }));

    try {
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
    } catch(e) {
      res.json({
        error: e.response.data
      })
    }
  }

  private invalidateToken = async (req: Request, res: Response) => {
    const { oauth_token, oauth_token_secret } = req.params

    const token = {
      key: oauth_token,
      secret: oauth_token_secret
    };

    const authHeader = oauth.toHeader(oauth.authorize({
      url: invalidateURL,
      method: 'POST'
    }, token));

    try {
      const result = await axios.post(invalidateURL, null, {
        headers: {
          Authorization: authHeader["Authorization"]
        }
      })
      res.json({
        result
      })
    } catch(e) {
      res.json({
        error: e.response.data
      })
    }
  }

  private getUseById = async (req: Request, res: Response) => {
    const { oauth_token, oauth_token_secret, id } = req.params

    const endpointURL = new URL(`${userURL}/${id}`)
    endpointURL.searchParams.append('user.fields', 'id,name,profile_image_url,description,created_at')

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
      ...result.data
    })
  }
}

export default TwitterController;
