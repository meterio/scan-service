class ProcessorException extends Error {
  public txHash: string;
  public action: string;
  public message: string;

  constructor(action: string, txHash: string, message: string) {
    super(message);
    this.txHash = txHash;
    this.action = action;
    this.message = message;
  }
}

export default ProcessorException;
