# thtp-js

`thtp-js` provides a THTP (Thrift-RPC over HTTP) client for Javascript. Written
in ES6, it provides most of the features of the Ruby client, namely persistent
pooled connections, timeouts, and transparent serialisation/deserialisation of
Thrift requests and responses.

For more details about uses cases, the protocol, or server implementation,
check out [THTP](https://github.com/anujdas/thtp).

## Client

The THTP client requires Thrift definitions which have been augmented to expose
the args and result structs for each RPC. This can be achieved by adding a step
to the Thrift compilation process: once `thrift` has been run and `js:node`
definitions have been created, run

```bash
# Set to wherever your definitions are outputted
output_dir=target/gen-nodejs
# Modify files (saving originals as *.bak)
find $output_dir -iname '*Service.js' -type f -exec sed -i.bak -E 's/^var ([A-Za-z0-9_]*(_args|_result)) =/var \1 = exports.\1 =/' {} \;
```

For each rpc `Service.do_action`, this will export `Service_do_thing_args` and
`Service_do_thing_result`, the structs that Thrift-RPC uses under the hood to
manage request/response bodies.
