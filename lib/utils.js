const Thrift = require('thrift');

/**
 * Camelcases a string, e.g., "do_something_neat" -> "doSomethingNeat"
 *
 * @param {String} string The string to be camelized
 * @return {String} The input string with transformation applied
*/
const camelize = string => string.replace(/_([^_]|$)/g, (_, letter) => letter.toUpperCase());

/**
 * Serializes a Thrift struct to a binary Buffer
 *
 * @param {Object} struct The Thrift struct instance to be serialized
 * @param {TProtocol} TProtocol The Thrift protocol to serialize with
 * @return {Promise<Buffer>} A binary buffer containing the struct's protocol representation
*/
const serialize = async (struct, TProtocol) => {
  return new Promise((resolve) => {
    const transport = new Thrift.TBufferedTransport(null, buf => resolve(buf));
    const protocol = new TProtocol(transport);
    struct.write(protocol);
    transport.flush();
  });
};

/**
 * Deserializes a Thrift struct from a binary Buffer
 *
 * @param {Buffer} buffer A binary buffer containing the struct's protocol representation
 * @param {Object} struct The Thrift struct instance to be populated
 * @param {TProtocol} TProtocol The Thrift protocol to deserialize with
 * @return {Promise<Object>} The populated struct
*/
const deserialize = async (buffer, struct, TProtocol) => {
  return new Promise((resolve) => {
    Thrift.TBufferedTransport.receiver((reader) => {
      const protocol = new TProtocol(reader);
      struct.read(protocol);
      resolve(struct);
    })(buffer);
  });
};

module.exports = {
  camelize,
  serialize,
  deserialize,
};
