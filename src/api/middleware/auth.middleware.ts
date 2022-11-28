import { NextFunction, Request, Response } from 'express';
import HttpException from '../exception/HttpException';

function isAdmin(req: Request, res: Response, next: NextFunction) {
  const pass = req.get('X-METER-ADMIN-PASSPHRASE');
  if (pass === process.env.API_ADMIN_PASSPHASE) {
    return next();
  } else {
    return next(new HttpException(401, 'Not authorized as admin!'));
  }
}
export default isAdmin;
