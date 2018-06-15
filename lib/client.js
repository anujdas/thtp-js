const http = require('http');
const https = require('https');
const fetch = require('node-fetch');
const { TCompactProtocol, Thrift } = require('thrift');

const Encoding = require('./encoding');
const Errors = require('./errors');
const { camelize, deserialize, serialize } = require('./utils');

class ThtpClient {
  /**
   * @param {TService} TService The Thrift service class to implement
   * @param {String} serviceName The fully-qualified name of the TService,
   *   e.g., "Company.Services.CalculatorService"
   * @param {String} uri The network location of the service, e.g., "https://localhost:9000"
   * @param {TProtocol} [TProtocol=Thrift.TCompactProtocol] The preferred Thrift protocol
   * @param {Integer} [timeout=5000] The timeout when awaiting a response, in milliseconds
   * @param {Integer} [maxSockets=10] The max number of connections to use (aka concurrency)
  */
  constructor(TService, serviceName, uri, {
    TProtocol = TCompactProtocol,
    timeout = 5000,
    maxSockets = 10,
  }) {
    this.TProtocol = TProtocol;

    const shortName = serviceName.split('.').slice(-1)[0]; // last component of full name
    this.mkTArgs = (rpc, ...args) => new TService[`${shortName}_${rpc}_args`](...args);
    this.mkTResult = (rpc, ...args) => new TService[`${shortName}_${rpc}_result`](...args);

    // define methods for each RPC (detected based on heuristic)
    const TClient = TService.Client.prototype;
    Object.keys(TClient).forEach((rpc) => {
      if (TClient.hasOwnProperty(`send_${rpc}`) && TClient.hasOwnProperty(`recv_${rpc}`)) {
        this[camelize(rpc)] = args => this.postRpc(rpc, args);
      }
    });

    // set up HTTP config and pool
    this.baseUrl = `${uri}/${serviceName}/`;
    const httpLib = this.baseUrl.startsWith('https://') ? https : http;
    const contentType = Encoding.getContentType(this.TProtocol);
    this.reqOpts = {
      method: 'POST',
      headers: { 'Content-Type': contentType, 'User-Agent': this.name },
      agent: new httpLib.Agent({ keepAlive: true, maxSockets }),
      timeout,
    };
  }

  /**
   * @param {String} rpc The name of the RPC to execute
   * @param {Object<String, TStruct>} args The arguments to the RPC
   * @return {Object} The RPC return value frmo the server, if successful
   * @throw {Object} The error from the server if processing was unsuccessful
  */
  async postRpc(rpc, args) {
    const serializedArgs = await serialize(this.mkTArgs(rpc, args), this.TProtocol);
    const reqOpts = Object.assign({}, this.reqOpts, { body: serializedArgs });

    let response;
    try {
      response = await fetch(`${this.baseUrl}${rpc}`, reqOpts);
    } catch (e) {
      throw Errors.wrapFetchError(e);
    }

    if (response.status === 200) {
      return this.readReply(rpc, response); // 200 means the response matches the schema
    } else {
      throw await this.readException(response); // 500 means an unknown error was encountered
    }
  }

  /**
   * @param {String} rpc The name of the RPC executed
   * @param {Response} response The HTTP response object
   * @return {Promise<Object>} The RPC return value frmo the server, if successful
   * @throw {Promise<Error>} The error from the server if processing was unsuccessful
  */
  async readReply(rpc, response) {
    // deserialise reply into result struct
    const TProtocol = Encoding.getTProtocol(response.headers.get('content-type'));
    const resultStruct = await deserialize(await response.buffer(), this.mkTResult(rpc), TProtocol);
    // results have at most one field set; find it and return/raise it
    for (const [field, structValue] of Object.entries(resultStruct)) {
      if (structValue !== null) { // this could be the set field
        if (field === 'success') {
          return structValue; // 'success' is special and means no worries
        } else {
          throw structValue; // any other set field must be an exception
        }
      }
    }
    // if no field is set and there's no `success` field, the RPC returned `void``
    if (!('success' in resultStruct)) {
      return null;
    } else {
      // otherwise, we don't recognise the response (our schema is out of date, or it's invalid)
      throw new Errors.BadResponseError();
    }
  }

  /**
   * @param {Response} response The HTTP response object
   * @return {Promise<Thrift.TApplicationException>} The non-schema error from the server
  */
  async readException(response) {
    const TProtocol = Encoding.getTProtocol(response.headers.get('content-type'));
    const TResult = Thrift.TApplicationException;
    return deserialize(await response.buffer(), new TResult(), TProtocol);
  }
}

module.exports = ThtpClient;
