# thtp-js

## Client

The THTP client requires Thrift definitions which have been augmented to expose
the args and result structs for each RPC. This can be achieved by adding a step
to the Thrift compilation process: once `thrift` has been run and `js:node` definitions have been created, run

```bash
# Set to wherever your definitions are outputted
output_dir=target/gen-nodejs
# Modifies files in place
find $output_dir -iname '*Service.js' -type f -exec sed -i '' -E 's/^var ([A-Za-z0-9_]*(_args|_result)) =/var \1 = exports.\1 =/' {} \;
```
