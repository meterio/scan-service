import { NextFunction, Request, Response } from 'express';
import HttpException from '../exception/HttpException';

// deprecated
function isAdmin(req: Request, res: Response, next: NextFunction) {
  const pass = req.get('X-API-ADMIN-PASSPHRASE');
  console.log(pass === process.env.API_ADMIN_PASSPHRASE);
  if (pass === process.env.API_ADMIN_PASSPHRASE) {
    return next();
  } else {
    return next(new HttpException(401, 'Not authorized as admin'));
  }
}
export default isAdmin;
