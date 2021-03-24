# Share local ports to web

### A reverse tunnel to easily open ports for servers running on localhost 🚀

- Lightweight, pure javascript library with 0 dependency
- Uses QUIC/HTTP2 Multiplexing, so no need to open new socket for every connection
- TCP and HTTP (+WebSocket) Forwarding
- Built-in file server for quick directory listing
- Option to set allowed or blocked IPs
- Option to set HTTP authentication header for security
- Option to set host header for shared servers

### Quick Start

1. `yarn global add localport`
2. `lort http 3000`

More examples and API reference in [docs](https://localport.co/docs)

### How it works

<details><summary>Show</summary>

> weirdly, reverse-http2 now works? why didn't it work before... idk  
> sending data (config) before http2.connect doesn't work, (yes again protocol error)  
> so i'm gonna send config over http2 requests
> this method gonna add some latency to tunnel negotiation

1. client: creates local http2 server
2. client -> server: tls connection
3. client -> server: sends config
4. server -> client: http2.connect over tls opened before
5. server -> client: http2 request with method CONFIG
6. client -> server: sends config (response to that request)
7. server: checks config, if success request ends fine, else error
</details>

### Development & Building

(uses `pkg` for building binaries)

1. `yarn install`
2. `yarn dev` edit `example.js` as you want, import and test manually with
   (yeah no automatic tests sorry, no typescript either, we are always welcome to pr's :) )
3. `yarn build:arm` ex. for testing on other device
4. commit
