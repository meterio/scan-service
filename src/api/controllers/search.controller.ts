import { AccountRepo, AuctionRepo, BidRepo, BlockRepo, BucketRepo, ContractRepo, TxRepo } from '../../repo';
import { Request, Response, Router } from 'express';
import { try$ } from 'express-toolbox';
import { Network, ContractType } from '../../const';
import { BaseController } from './baseController';

const hashPattern = new RegExp('^0x[0-9a-fA-F]{64}$');
const addrPattern = new RegExp('^0x[0-9a-fA-F]{40}$');

class SearchController extends BaseController {
  public path = '/api/search';
  public router = Router();
  private blockRepo = new BlockRepo();
  private txRepo = new TxRepo();
  private accountRepo = new AccountRepo();
  private contractRepo = new ContractRepo();
  private auctionRepo = new AuctionRepo();
  private bidRepo = new BidRepo();
  private bucketRepo = new BucketRepo();

  constructor(network: Network, standby: boolean) {
    super(network, standby);
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}/:word`, try$(this.searchByWord));
  }

  private searchByWord = async (req: Request, res: Response) => {
    const { word } = req.params;

    // if it's hash, find it in tx and block collection
    if (hashPattern.test(word)) {
      const block = await this.blockRepo.findByHash(word);
      if (block) {
        console.log(`exact match for block hash: `, word);
        return res.json({ type: 'block', data: block.toJSON() });
      }

      const tx = await this.txRepo.findByHash(word);
      if (tx) {
        console.log(`exact match for tx hash: `, word);
        return res.json({ type: 'tx', data: tx.toJSON() });
      }

      const auction = await this.auctionRepo.findByID(word);
      if (auction) {
        console.log(`exact match for auction id: `, word);
        return res.json({ type: 'auction', data: auction.toJSON() });
      }

      const bid = await this.bidRepo.findById(word);
      if (bid) {
        console.log(`exact match for bid id: `, word);
        return res.json({ type: 'bid', data: bid.toJSON() });
      }

      const bucket = await this.bucketRepo.findByID(word);
      if (bucket) {
        console.log(`exact match for bucket id: `, word);
        return res.json({ type: 'bucket', data: bucket.toJSON() });
      }

      return res.json({ type: 'hash' });
    }

    // if it's address, find it in address collection
    if (addrPattern.test(word)) {
      const account = await this.accountRepo.findByAddress(word);
      if (account) {
        console.log(`exact match for address: `, word);
        return res.json({ type: 'address', data: account.toJSON() });
      }
      return res.json({ type: 'address', data: { address: word } });
    }

    // if it's number, try to find in block collection
    let number = -1;
    try {
      number = Number(word);
      const block = await this.blockRepo.findByNumber(number);
      if (block) {
        console.log(`exact match for block number: `, number);
        return res.json({ type: 'block', data: block.toJSON() });
      }
    } catch (e) {
      console.log('could not find by number');
    }

    // fuzzy search for account and contracts
    let suggestions = [];
    let visitedAddrs = {};
    const contract = await this.contractRepo.findBySymbol(word);
    if (contract) {
      visitedAddrs[contract.address] = true;
      suggestions.push({
        name: contract.name,
        address: contract.address,
        symbol: contract.symbol,
        type: 'address',
        tag: ContractType[contract.type],
        logoURI: contract.logoURI,
      });
    }

    const accounts = await this.accountRepo.findByFuzzyName(word);
    if (accounts && accounts.length > 0) {
      for (const a of accounts) {
        if (a.address in visitedAddrs) {
          continue;
        }
        visitedAddrs[a.address] = true;
        suggestions.push({
          name: a.name,
          address: a.address,
          symbol: '',
          type: 'address',
          tag: 'Account',
        });
      }
    }

    const contracts = await this.contractRepo.findByFuzzyName(word);
    if (contracts && contracts.length > 0) {
      for (const c of contracts) {
        if (c.address in visitedAddrs) {
          continue;
        }
        visitedAddrs[c.address] = true;
        suggestions.push({
          name: c.name,
          address: c.address,
          symbol: c.symbol,
          type: 'address',
          tag: ContractType[c.type],
          logoURI: c.logoURI,
        });
      }
    }
    if (suggestions.length > 0) {
      return res.json({ type: 'suggestions', data: suggestions.slice(0, 100) });
    }

    return res.json({ type: 'suggestions', data: [] });
  };
}

export default SearchController;
