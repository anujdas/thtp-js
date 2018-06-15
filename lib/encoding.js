const Thrift = require('thrift');

const BINARY_ENCODING = 'application/vnd.apache.thrift.binary',
  COMPACT_ENCODING = 'application/vnd.apache.thrift.compact',
  JSON_ENCODING = 'application/vnd.apache.thrift.json';

const getTProtocol = (contentType) => {
  switch (contentType) {
    case BINARY_ENCODING: return Thrift.TBinaryProtocol;
    case COMPACT_ENCODING: return Thrift.TCompactProtocol;
    case JSON_ENCODING: return Thrift.TJSONProtocol;
    default: return Thrift.TCompactProtocol;
  }
};

const getContentType = (TProtocol) => {
  switch (TProtocol) {
    case Thrift.TBinaryProtocol: return BINARY_ENCODING;
    case Thrift.TCompactProtocol: return COMPACT_ENCODING;
    case Thrift.TJSONProtocol: return JSON_ENCODING;
  }
};

module.exports = {
  BINARY_ENCODING,
  COMPACT_ENCODING,
  JSON_ENCODING,
  getTProtocol,
  getContentType,
};
