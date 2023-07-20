import * as path from 'path';

import { connectDB } from '../utils/db';

import Controller from './interfaces/controller.interface';
import errorMiddleware from './middleware/error.middleware';

import express = require('express');
import cors = require('cors');
import cookieParser = require('cookie-parser');
import { Network } from '../const';
import morgan from 'morgan';

// function loggerMiddleware(request: express.Request, response: express.Response, next: express.NextFunction) {
//   const p = `${request.method} ${request.path}`;
//   console.log(p);
//   next();
// }

class App {
  public app: express.Application;
  private network: Network;
  private standby: boolean;

  constructor(controllers: Controller[], network: Network, standby: boolean) {
    this.app = express();

    this.network = network;
    this.standby = standby;
    this.initializeMiddlewares();
    this.initializeControllers(controllers);
    this.initializeErrorHandling();
  }

  public async listen(port: number) {
    const res = await this.connectToTheDatabase();
    // console.log(res);
    this.app.listen(port, () => {
      console.log(`App listening on the port ${port}`);
    });
  }

  public getServer() {
    return this.app;
  }

  private initializeMiddlewares() {
    this.app.set('view engine', 'ejs');
    this.app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));
    this.app.use(cors());
    this.app.use(express.urlencoded({ extended: false }));
    this.app.use(express.json());
    this.app.use(cookieParser());
    this.app.use(express.static(path.join(__dirname, 'public')));
  }

  private initializeErrorHandling() {
    this.app.use(errorMiddleware);
  }

  private initializeControllers(controllers: Controller[]) {
    controllers.forEach((controller) => {
      this.app.use('/', controller.router);
    });
  }

  private async connectToTheDatabase() {
    await connectDB(this.network, this.standby);
  }
}

export default App;
