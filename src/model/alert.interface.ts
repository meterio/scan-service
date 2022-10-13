export interface Alert {
  network: string;
  number: number;
  epoch: number;
  channel: string;
  msg: string;
  createdAt?: number;
}
