import { Token } from '../../const';

class TokenNotSupported extends Error {
  public token: Token;
  public message: string;

  constructor(token: Token) {
    const message = `token value ${token} is not supported`;
    super(message);
    this.token = token;
    this.message = message;
  }
}

export default TokenNotSupported;
