export * from './csv';
export * from './integrity';
export * from './net';
export * from './pos-rest';
export * from './pow-rpc';
export * from './utils';

import { LIMIT_WINDOW } from '../const';

export const formalizePageAndLimit = (page?: number, limit?: number) => {
  // convert page (1 .. n) to (0 .. n-1)
  if (!!page && page > 0) {
    page = page - 1;
  } else {
    page = 0;
  }
  if (!limit) {
    limit = LIMIT_WINDOW;
  }
  return { page, limit };
};
