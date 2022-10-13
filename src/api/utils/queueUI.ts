import * as Logger from 'bunyan';
import express from 'express';

const { QUEUE_UI_PORT } = process.env;
const { UI, setQueues } = require('bull-board');

export const initQueueUI = (queues: any) => {
  const app = express();
  const logger = Logger.createLogger({ name: 'queue' });
  setQueues(queues);
  app.use('/queue', UI);

  // define a route handler for the default home page
  app.get('/', (req: any, res: any) => {
    res.send('Queue UI');
  });

  // start the Express server
  return app.listen(QUEUE_UI_PORT, () => {
    logger.info(`Queue UI started, at http://0.0.0.0:${QUEUE_UI_PORT}`);
  });
};
