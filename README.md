# Share local ports to world wide net

### A reverse tunnel to easily open ports for servers running on localhost 🚀

- Lightweight, Have pure javascript library with 0 dependency
- Uses QUIC/HTTP2 Multiplexing, so no need to open new socket for every connection
- TCP and HTTP Forwarding
- Built-in file server for quick directory listing
- Option to set allowed or blocked IPs
- Option to set HTTP Auth Header automatically

### Quick Start

1. `yarn global add localport`
2. `lort http 3000`

More examples in [docs](https://localport.co/docs)

### How it works

1. client: starts local proxy server, which uses http2 (CONNECT METHOD)
2. client -> server: open tls socket, sends config
3. server -> client: connects to client's proxy over tls opened before
4. server listens to requests (or connections if tunnel is tcp)

update: this does not work. idk why, it just says protocol error on server after injecting connection

1. server: starts http2 server
2. client -> server: connects to http2 server
3. client -> server: requests to "/" with config
4. server: checks config, opens needed ports etc
5. server: when receiced request it opens a pushstream to client

### Development & Building

(uses `pkg` for building binaries)

1. `yarn install`
2. `yarn dev` edit `example.js` as you want, import and test manually with
   (yeah no automatic tests sorry, no typescript either, we are always welcome to pr's :) )
3. `yarn build:arm` ex. for testing on other device
4. commit
