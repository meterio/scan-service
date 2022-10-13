export interface Candidate {
  epoch: number;
  pubKey: string;

  // updatable attributes
  name: string;
  description: string;
  address: string;
  ipAddress: string;
  port: number;
  totalVotes: string;
}
