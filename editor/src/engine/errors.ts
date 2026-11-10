export type OpErrorCode = 'unpatchable' | 'not-found' | 'invalid' | 'unsupported';

/** Raised when an operation cannot be resolved to splices. `code` is stable; `message` is for people. */
export class OpError extends Error {
  code: OpErrorCode;
  constructor(code: OpErrorCode, message: string) {
    super(message);
    this.name = 'OpError';
    this.code = code;
  }
}
