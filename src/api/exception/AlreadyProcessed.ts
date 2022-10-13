class AlreadyProcessed extends Error {
  public txHash: String;
  public message: string;

  constructor(txHash: string) {
    const message = `Transaction ${txHash} has already been processed`;
    super(message);
    this.txHash = txHash;
    this.message = message;
  }
}

export default AlreadyProcessed;
