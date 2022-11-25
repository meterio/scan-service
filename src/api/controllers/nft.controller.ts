import { ContractRepo, NFTRepo } from '../../repo';
import { Request, Response, Router } from 'express';
import { try$ } from 'express-toolbox';
import { getCuratedNFTs } from '../const';
import { extractPageAndLimitQueryParam } from '../utils/utils';
import { Network } from '../../const';
import { BaseController } from './baseController';
import CuratedCollectionRepo from '../../repo/curatedCollection.repo';

class NFTController extends BaseController {
  public path = '/api/nfts';
  public router = Router();

  private nftRepo = new NFTRepo();
  private contractRepo = new ContractRepo();
  private curatedCollectionRepo = new CuratedCollectionRepo();

  constructor(network: Network, standby: boolean) {
    super(network, standby);
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}/curated`, try$(this.getCuratedCollections));
    this.router.get(`${this.path}/:address/tokens`, try$(this.getTokensInCollection));
    this.router.get(`${this.path}/:address/:tokenId`, try$(this.getTokenDetail));

    this.router.get(`${this.path}/setCuratedCollectionAddr/:name/:address`, try$(this.setCuratedCollectionAddr))
    this.router.get(`${this.path}/curatedCollectionAddr`, try$(this.getCuratedCollectionAddr))
  }

  private setCuratedCollectionAddr = async (req: Request, res: Response) => {
    const { name, address } = req.params;
    const result = await this.curatedCollectionRepo.create({ name, address, network: this.network});
    res.json({
      result
    })
  }

  private getCuratedCollectionAddr = async (req: Request, res: Response) => {
    const collections = this.curatedCollectionRepo.findAllByNetwork(this.network);
    res.json({
      ...collections
    })
  }

  private getCuratedCollections = async (req: Request, res: Response) => {
    const { page, limit } = extractPageAndLimitQueryParam(req);
    const curatedAddrs = getCuratedNFTs(this.network);
    const paginate = await this.contractRepo.paginateWithAddressList(curatedAddrs, page, limit);
    /*
    - getAllCollections - this gives all NFT that stored on your DB
request: page, limit
return: collection list [nftAddress, nftCreator, createTxHash, createBlockNumber, nftName, nftSymbol, nftType]

    */
    if (paginate.result)
      return res.json({
        totalRows: paginate.count,
        collections: paginate.result.map((c) => ({
          address: c.address,
          name: c.name,
          symbol: c.symbol,
          type: c.type,
          createTxHash: c.creationTxHash,
          createBlockNum: c.firstSeen.number,
          createTimestamp: c.firstSeen.number,
          creator: c.master,
        })),
      });
  };

  /*
  - getAllNFTs - this gives all NFT token that stored on your DB
request: page, limit
return: nft list [nft Address, nftCreator, nftName, nftSymbol, nftType, nftTokenID, tokenURI, nft minter, created timestamp, nft token media URI, nft token media type(image or video), nft token JSON]

  */
  private getTokensInCollection = async (req: Request, res: Response) => {
    const { address } = req.params;
    const { page, limit } = extractPageAndLimitQueryParam(req);

    const contract = await this.contractRepo.findByAddress(address);
    if (!contract) {
      return res.json({ totalRows: 0, nfts: [], contract });
    }
    delete contract.code;
    const paginate = await this.nftRepo.paginateByAddress(address, page, limit);
    return res.json({
      collection: {
        address: contract.address,
        name: contract.name,
        symbol: contract.symbol,
        type: contract.type,
        createTxHash: contract.creationTxHash,
        createBlockNum: contract.firstSeen.number,
        createTimestamp: contract.firstSeen.number,
        creator: contract.master,
      },
      totalRows: paginate.count,
      nfts: paginate.result.map((n) => {
        let tokenJSON = {};
        try {
          tokenJSON = JSON.parse(n.tokenJSON);
        } catch (e) {
          console.log('error parsing json');
        }

        return {
          tokenId: n.tokenId,
          tokenURI: n.tokenURI || '',
          tokenJSON: tokenJSON,

          mediaURI: n.mediaURI || '',
          mediaType: n.mediaType || '',
          minter: n.minter,
          createTxHash: n.creationTxHash,
          createBlockNum: n.block.number,
          createTimestamp: n.block.timestamp,
          status: n.status,
        };
      }),
      // .filter((n) => n.mediaURI !== ''),
    });
  };

  private getTokenDetail = async (req: Request, res: Response) => {
    const { address, tokenId } = req.params;

    const token = await this.nftRepo.findByTokenId(address, tokenId);
    const contract = await this.contractRepo.findByAddress(address);

    if (!token || token.length <= 0 || !contract) {
      return res.json({ address, tokenId });
    }

    delete token[0]._id;
    delete contract.code;
    delete contract._id;
    return res.json({
      name: contract.name,
      symbol: contract.symbol,
      master: contract.master,
      ...token[0].toJSON(),
    });
  };
}

export default NFTController;
