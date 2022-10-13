export interface Known {
  ecdsaPK: string; // primary key
  blsPK: string;

  // updatable attributes
  name: string;
  description: string;
  address: string;
  ipAddress: string;
  port: number;
}
