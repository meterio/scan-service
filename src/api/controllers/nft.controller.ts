import { ContractRepo, NFTRepo } from '../../repo';
import { Request, Response, Router } from 'express';
import { try$ } from 'express-toolbox';
import { getCuratedNFTs } from '../const';
import { extractPageAndLimitQueryParam } from '../utils/utils';
import { ContractType, Network } from '../../const';
import { BaseController } from './baseController';
import CuratedRepo from '../../repo/curated.repo';
import isAdmin from '../middleware/auth.middleware';
const addrPattern = new RegExp('^0x[0-9a-fA-F]{40}$');
class NFTController extends BaseController {
  public path = '/api/nfts';
  public adminPath = '/admin/nfts';
  public router = Router();

  private nftRepo = new NFTRepo();
  private contractRepo = new ContractRepo();
  private curatedRepo = new CuratedRepo();

  constructor(network: Network, standby: boolean) {
    super(network, standby);
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // @deprecated
    this.router.get(`${this.path}/curated`, try$(this.getCuratedCollections));
    this.router.get(`${this.path}/:address/tokens`, try$(this.getTokensInCollection));
    this.router.get(`${this.path}/:address/:tokenId`, try$(this.getTokenDetail));

    // added for nft market
    this.router.get(`${this.path}/collections`, try$(this.getAllCollections));
    this.router.get(`${this.path}/tokens/after/:blockNum`, try$(this.getTokensAfterBlock));

    // @deprecated
    this.router.post(`${this.adminPath}/curated`, [isAdmin], try$(this.addAddressToCurated));
    // @deprecated
    this.router.delete(`${this.adminPath}/curated/:address`, [isAdmin], try$(this.deleteAddressFromCurated));
  }

  private deleteAddressFromCurated = async (req: Request, res: Response) => {
    const { address } = req.params;
    const result = await this.curatedRepo.deleteByID(address);
    res.json({
      result,
    });
  };

  private addAddressToCurated = async (req: Request, res: Response) => {
    const { name, address } = req.body;
    console.log('address', address);
    console.log(addrPattern.test(address));
    if (address && addrPattern.test(address)) {
      const result = await this.curatedRepo.create({
        name,
        address: address.toLowerCase(),
      });
      res.json({
        result,
      });
    } else {
      res.json({ error: 'not recognized address' });
    }
  };

  private getAllCollections = async (req: Request, res: Response) => {
    const { page, limit } = extractPageAndLimitQueryParam(req);
    // const curatedAddrs = getCuratedNFTs(this.network);
    const paginate = await this.contractRepo.paginateERC721And1155(page, limit);
    /*
    - getAllCollections - this gives all NFT that stored on your DB
    request: page, limit
    return: collection list [nftAddress, nftCreator, createTxHash, createBlockNumber, nftName, nftSymbol, nftType]

    */
    if (paginate.result) {
      return res.json({
        totalRows: paginate.count,
        collections: paginate.result.map((c) => ({
          address: c.address,
          name: c.name,
          symbol: c.symbol,
          type: ContractType[c.type],
          createTxHash: c.creationTxHash,
          createBlockNum: c.firstSeen.number,
          createTimestamp: c.firstSeen.number,
          creator: c.master,
        })),
      });
    }
    return res.json({ totalRows: 0, collections: [] });
  };

  private getCuratedCollections = async (req: Request, res: Response) => {
    const { page, limit } = extractPageAndLimitQueryParam(req);
    // const curatedAddrs = getCuratedNFTs(this.network);
    const collections = await this.curatedRepo.findAll();
    const curatedAddrs = collections.map((c) => c.address);
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
          type: ContractType[c.type],
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

  private getTokensAfterBlock = async (req: Request, res: Response) => {
    const { blockNum } = req.params;
    const { page, limit } = extractPageAndLimitQueryParam(req);

    const paginate = await this.nftRepo.paginateAfterBlock(Number(blockNum), page, limit);
    return res.json({
      totalRows: paginate.count,
      nfts: paginate.result.map((n) => {
        let tokenJSON = {};
        try {
          tokenJSON = JSON.parse(n.tokenJSON);
        } catch (e) {
          console.log('error parsing json');
        }

        return {
          collectionAddress: n.address,
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
}

export default NFTController;
