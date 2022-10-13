import { BigNumber } from 'bignumber.js';
import { ABIFragmentRepo, MovementRepo, TxDigestRepo } from '../../repo';
import { Request, Response, Router } from 'express';
import { try$ } from 'express-toolbox';
import { Parser } from 'json2csv';
import moment from 'moment';
import { Network } from '../../const';
import { BaseController } from './baseController';
import { extractPageAndLimitQueryParam, fromWei } from '../utils/utils';

class DownloadController extends BaseController {
  public path = '/api/download';
  public router = Router();
  private txDigestRepo = new TxDigestRepo();
  private abiFragmentRepo = new ABIFragmentRepo();
  private movementRepo = new MovementRepo();

  constructor(network: Network, standby: boolean) {
    super(network, standby);
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}/:address/:start/:end/txs`, try$(this.downloadTxs));
    this.router.get(`${this.path}/:address/:start/:end/erc20Txs`, try$(this.downloadErc20Txs));
    this.router.get(`${this.path}/:address/:start/:end/nftTxs`, try$(this.downloadNftTxs));
  }

  private download = (res: Response, fileName: string, fields: { label: string; value: string }[], data: any) => {
    const json2csv = new Parser({ fields });
    const csv = json2csv.parse(data);
    res.header('Content-Type', 'text/csv');
    res.attachment(fileName);
    return res.send(csv);
  };

  private downloadTxs = async (req: Request, res: Response) => {
    const { address, start, end } = req.params;
    const { page, limit } = extractPageAndLimitQueryParam(req);

    const paginate = await this.txDigestRepo.paginateByAccountInRange(Number(start), Number(end), address, page, limit);

    const fileName = `txs-${address}.csv`;

    const fields = [
      { value: 'txHash', label: 'Hash' },
      { value: 'methodName', label: 'Method' },
      { value: 'blocknum', label: 'Block' },
      { value: 'timestamp', label: 'Time' },
      { value: 'from', label: 'From' },
      { value: 'direct', label: 'Direct' },
      { value: 'to', label: 'To' },
      { value: 'amount', label: 'Amount' },
      { value: 'symbol', label: 'Symbol' },
    ];

    if (!paginate.result) {
      this.download(res, fileName, fields, []);
    }
    const methods = await this.abiFragmentRepo.findAllFunctions();
    let methodMap = {};
    methods.forEach((m) => {
      methodMap[m.signature] = m.name;
    });
    const txs = paginate.result
      .map((tx) => tx.toJSON())
      .map((tx) => ({ ...tx, method: methodMap[tx.method] || tx.method }));

    return this.download(
      res,
      fileName,
      fields,
      txs.map((tx) => {
        let direct = '';
        if (tx.from === tx.to) {
          direct = 'Self';
        } else if (tx.from === address.toLowerCase()) {
          direct = 'Out';
        } else {
          direct = 'In';
        }

        let amount = new BigNumber(String(tx.mtr));
        let symbol = 'MTR';
        if (amount.isZero()) {
          amount = new BigNumber(String(tx.mtrg));
          symbol = 'MTRG';
        }

        return {
          txHash: tx.txHash,
          methodName: tx.method,
          blocknum: tx.block.number,
          timestamp: moment(tx.block.timestamp * 1000).format('YYYY-MM-DD HH:mm:ss'),
          from: tx.from,
          direct,
          to: tx.to,
          amount: fromWei(String(amount)),
          symbol,
        };
      })
    );
  };

  private downloadErc20Txs = async (req: Request, res: Response) => {
    const { address, start, end } = req.params;
    const { page, limit } = extractPageAndLimitQueryParam(req);

    const paginate = await this.movementRepo.paginateERC20TxsByAccountInRange(
      Number(start),
      Number(end),
      address,
      page,
      limit
    );

    const fileName = `erc20Txs-${address}.csv`;

    const fields = [
      { value: 'txHash', label: 'Hash' },
      { value: 'blocknum', label: 'Block' },
      { value: 'timestamp', label: 'Time' },
      { value: 'from', label: 'From' },
      { value: 'direct', label: 'Direct' },
      { value: 'to', label: 'To' },
      { value: 'amount', label: 'Amount' },
      { value: 'symbol', label: 'Symbol' },
    ];

    return this.download(
      res,
      fileName,
      fields,
      paginate.result.map((tx) => {
        let direct = '';
        if (tx.from === tx.to) {
          direct = 'Self';
        } else if (tx.from === address.toLowerCase()) {
          direct = 'Out';
        } else {
          direct = 'In';
        }

        const amount = new BigNumber(String(tx.amount));

        return {
          txHash: tx.txHash,
          blocknum: tx.block.number,
          timestamp: moment(tx.block.timestamp * 1000).format('YYYY-MM-DD HH:mm:ss'),
          from: tx.from,
          direct,
          to: tx.to,
          amount: `${amount.gt(0) ? amount.div(`1e${tx.contract.decimals}`).toFixed() : 0}`,
          symbol: tx.contract.symbol,
        };
      })
    );
  };

  private downloadNftTxs = async (req: Request, res: Response) => {
    const { address, start, end } = req.params;
    const { page, limit } = extractPageAndLimitQueryParam(req);

    const paginate = await this.movementRepo.paginateNFTTxsByAccountInRange(
      Number(start),
      Number(end),
      address,
      page,
      limit
    );

    const fileName = `nftTxs-${address}.csv`;

    const fields = [
      { value: 'txHash', label: 'Hash' },
      { value: 'blocknum', label: 'Block' },
      { value: 'timestamp', label: 'Time' },
      { value: 'from', label: 'From' },
      { value: 'direct', label: '' },
      { value: 'to', label: 'To' },
      { value: 'nft', label: 'Token ID' },
    ];

    return this.download(
      res,
      fileName,
      fields,
      paginate.result.map((tx) => {
        let direct = '';
        if (tx.from === tx.to) {
          direct = 'Self';
        } else if (tx.from === address.toLowerCase()) {
          direct = 'Out';
        } else {
          direct = 'In';
        }

        return {
          txHash: tx.txHash,
          blocknum: tx.block.number,
          timestamp: moment(tx.block.timestamp * 1000).format('YYYY-MM-DD HH:mm:ss'),
          from: tx.from,
          direct,
          to: tx.to,
          nft: tx.nftTransfers.map((nft) => `${nft.tokenId} for ${nft.value}`).join(','),
        };
      })
    );

    // return res.json({
    //   totalRows: paginate.count,
    //   txs: paginate.result.map((m) => {
    //     delete m.__v;
    //     delete m._id;
    //     m.name = m.contract.name;
    //     m.symbol = m.contract.symbol;
    //     m.decimals = m.contract.decimals;
    //     m.contractType = m.contract.type;
    //     delete m.contract;
    //     return m;
    //   }),
    // });
  };
}
export default DownloadController;
