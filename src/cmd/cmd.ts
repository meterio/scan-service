import { Logger } from 'pino';
export abstract class CMD {
  protected log: Logger;
  abstract start();
  abstract stop();
}
