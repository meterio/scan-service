import * as https from 'https';
import * as http from 'http';
import * as querystring from 'querystring';

interface Params {
  query?: Record<string, string>;
  body?: any;
  headers?: Record<string, string>;
  validateResponseHeader?: (headers: Record<string, string>) => void;
}
type RequestFunc = (
  url: string,
  options: http.RequestOptions,
  callback?: (res: http.IncomingMessage) => void
) => http.ClientRequest;

export class Net {
  private agent: http.Agent | https.Agent;
  private request: RequestFunc;

  constructor(readonly baseURL: string, readonly timeout = 15 * 1000) {
    if (baseURL.startsWith('https://')) {
      this.agent = new https.Agent({
        keepAlive: true,
        maxSockets: 1000,
        maxFreeSockets: 50,
        timeout: timeout,
      });
      this.request = https.request;
    } else {
      this.agent = new http.Agent({
        keepAlive: true,
        maxSockets: 1000,
        maxFreeSockets: 50,
        timeout: timeout,
      });
      this.request = http.request;
    }
  }

  /**
   * Transient failures we are willing to replay. The public RPC sits behind
   * Cloudflare, which closes pooled keep-alive connections on its own schedule;
   * picking such a socket out of the pool surfaces as ECONNRESET / "socket hang
   * up". Those are not application errors and should not reach the sync loop,
   * where each one costs a recovery sleep plus a full dirty-data cleanup.
   */
  private static readonly RETRYABLE_CODES = new Set([
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'EPIPE',
    'EAI_AGAIN',
    'ENETUNREACH',
    'EHOSTUNREACH',
  ]);

  // 5xx from the edge is usually transient; 500 is left out because it is more
  // often a deterministic origin error and replaying it just wastes time.
  private static readonly RETRYABLE_STATUS = new Set([408, 425, 429, 502, 503, 504]);

  private static readonly MAX_ATTEMPTS = 3;
  private static readonly BASE_BACKOFF_MS = 250;

  private isRetryable(e: any): boolean {
    if (!e) {
      return false;
    }
    if (e.code && Net.RETRYABLE_CODES.has(e.code)) {
      return true;
    }
    if (typeof e.statusCode === 'number' && Net.RETRYABLE_STATUS.has(e.statusCode)) {
      return true;
    }
    return typeof e.message === 'string' && e.message.includes('socket hang up');
  }

  public async http<T>(method: 'GET' | 'POST', path: string, params?: Params): Promise<T> {
    let lastErr: any;
    for (let attempt = 1; attempt <= Net.MAX_ATTEMPTS; attempt++) {
      try {
        return await this.httpOnce<T>(method, path, params);
      } catch (e) {
        lastErr = e;
        // only GET is safe to replay blindly; POST may not be idempotent
        if (method !== 'GET' || attempt >= Net.MAX_ATTEMPTS || !this.isRetryable(e)) {
          throw e;
        }
        const backoff = Net.BASE_BACKOFF_MS * Math.pow(3, attempt - 1);
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
    throw lastErr;
  }

  private async httpOnce<T>(method: 'GET' | 'POST', path: string, params?: Params): Promise<T> {
    if (!params) {
      params = {};
    }

    const url = this.baseURL + '/' + path + (params.query ? '?' + querystring.stringify(params.query) : '');

    return new Promise((resolve, reject) => {
      const req = this.request(
        url,
        {
          method,
          headers: params!.headers || {},
          agent: this.agent,
          timeout: this.timeout,
        },
        (res) => {
          res.setEncoding('utf-8');

          if (params!.validateResponseHeader) {
            try {
              params!.validateResponseHeader(res.headers as Record<string, string>);
            } catch (e) {
              return reject(e);
            }
          }

          let resStr = '';
          res.on('data', (data) => {
            resStr += data;
          });

          res.on('end', () => {
            if (res.statusCode !== 200) {
              const err: any = new Error(`${method} ${url} ${res.statusCode} - ${resStr}`);
              err.statusCode = res.statusCode;
              reject(err);
              return;
            }
            try {
              const ret = JSON.parse(resStr);
              resolve(ret);
            } catch (e) {
              reject(e);
            }
          });
        }
      );

      // `timeout` on its own only emits an event - without destroying the request
      // the promise would never settle and the sync loop would stall forever.
      req.on('timeout', () => {
        const err: any = new Error(`${method} ${url} timed out after ${this.timeout}ms`);
        err.code = 'ETIMEDOUT';
        req.destroy(err);
      });

      req.on('error', (e) => {
        reject(e);
      });

      if (method === 'POST' && params!.body) {
        req.write(JSON.stringify(params!.body));
      }

      req.end();
    });
  }
}
