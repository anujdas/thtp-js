// Failed to connect to remote host
class ConnectionFailedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConnectionFailedError';
    Error.captureStackTrace(this, ConnectionFailedError);
  }
}

// Exceeded timeout for a single request
class RpcTimeoutError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RpcTimeoutError';
    Error.captureStackTrace(this, RpcTimeoutError);
  }
}

// RPC returned an unrecognised value
class BadResponseError extends Error {
  constructor() {
    super('Bad response for rpc');
    this.name = 'BadResponseError';
    Error.captureStackTrace(this, BadResponseError);
  }
}

const wrapFetchError = (err) => {
  if (err.type === 'request-timeout') {
    return new RpcTimeoutError(err.message);
  } else if (err.type === 'system' && err.errno === 'ECONNREFUSED') {
    return new ConnectionFailedError(err.message);
  } else {
    return err;
  }
};

module.exports = {
  BadResponseError,
  ConnectionFailedError,
  RpcTimeoutError,
  wrapFetchError,
};
