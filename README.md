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

You see more examples in [docs](https://localport.co/docs)

### Development & Building

(uses `pkg` for building binaries)

1. `yarn install`
2. `yarn dev` edit `example.js` as you want, import and test manually with
   (yeah no automatic tests sorry, no typescript either, maybe in the future)
3. `yarn build:arm` ex. for testing on other device
4. create pr
