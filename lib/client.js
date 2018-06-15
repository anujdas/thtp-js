const http = require('http');
const https = require('https');
const fetch = require('node-fetch');
const Thrift = require('thrift');

const Encoding = require('./encoding');
const Errors = require('./errors');
const Utils = require('./utils');

class ThtpClient {
  /**
   * @param {TService} TService The Thrift service class to implement
   * @param {String} serviceName The name of the TService, e.g., "CalculatorService"
   * @param {String} uri The network location of the service, e.g., "https://localhost:9000"
   * @param {String} [namespace=null] The full path to the serivce, e.g., "Company.Services"
   * @param {TProtocol} [TProtocol=Thrift.TCompactProtocol] The preferred Thrift protocol
   * @param {Integer} [timeout=5000] The timeout when awaiting a response, in milliseconds
   * @param {Integer} [maxSockets=10] The max number of connections to use (aka concurrency)
  */
  constructor(TService, serviceName, uri, {
    namespace = null,
    TProtocol = Thrift.TCompactProtocol,
    timeout = 5000,
    maxSockets = 10,
  }) {
    this.service = serviceName;
    this.TService = TService;
    this.TProtocol = TProtocol;

    const servicePath = namespace === null ? serviceName : `${namespace}.${serviceName}`;
    this.baseUrl = `${uri}/${servicePath}/`;
    const httpLib = this.baseUrl.startsWith('https://') ? https : http;
    const contentType = Encoding.getContentType(this.TProtocol);
    this.reqOpts = {
      method: 'POST',
      headers: { 'Content-Type': contentType, 'User-Agent': this.name },
      agent: new httpLib.Agent({ keepAlive: true, maxSockets }),
      timeout,
    };

    // define methods for each RPC (detected based on heuristic)
    const TClient = this.TService.Client.prototype;
    Object.keys(TClient).forEach((rpc) => {
      if (TClient.hasOwnProperty(`send_${rpc}`) && TClient.hasOwnProperty(`recv_${rpc}`)) {
        this[Utils.camelize(rpc)] = args => this.postRpc(rpc, args);
      }
    });
  }

  /**
   * @param {String} rpc The name of the RPC to execute
   * @param {Object<String, TStruct>} args The arguments to the RPC
   * @return {Object} The RPC return value frmo the server, if successful
   * @throw {Object} The error from the server if processing was unsuccessful
  */
  async postRpc(rpc, args) {
    const argsStruct = new this.TService[`${this.service}_${rpc}_args`](args);
    const serializedArgs = await Utils.serialize(argsStruct, this.TProtocol);
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
    const TResult = this.TService[`${this.service}_${rpc}_result`];
    const resultStruct = await Utils.deserialize(await response.buffer(), new TResult(), TProtocol);
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
    const TResult = Thrift.Thrift.TApplicationException;
    return Utils.deserialize(await response.buffer(), new TResult(), TProtocol);
  }
}

module.exports = ThtpClient;
