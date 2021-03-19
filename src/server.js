const net = require("net");
const events = require("events");
const util = require("util");
const http = require("http");
const http2 = require("http2");

const constants = require("./constants.js");

function Server({ key, cert, ca }) {
  // We do have to keep tunnels in a store for a fast handleRequest method
  this._tunnels = []; // { proto, port, ... }
  this._tunnelsByHost = {}; // HTTP Tunnels

  this._http2 = http2
    .createSecureServer({ key, cert, ca, allowHTTP1: true })
    .on("request", (req, res) => {
      // When http1 and http2
      // console.log(req.headers);
    })
    .on("stream", (stream, headers) => {
      // Only http2
      console.log("[HTTP2] Stream", headers);

      // If x-config exists it means this is a tunnel connection
      if (headers["x-config"]) {
        const tunnel = new ServerTunnel(
          JSON.parse(headers["x-config"])
        )._setTransport(constants.H2, stream);
        this.addTunnel(tunnel);
        return;
      }

      // lort.me without subdomain
      if (headers[":authority"] === "lort.me") {
        stream.respond({
          ":status": 200,
          "content-type": "text/html; charset=utf-8",
        });
        stream.end(
          `Hi! <a style="color: gray;" href="https://localport.co/">maybe you are looking for our website.</a>`
        );
        return;
      }

      // HTTP tunnel requests
      this.handleRequest(stream, headers);
    });
}

// Tunnel added to here after getting config
// Here opens TCP server if needed
// Here listens to events on tunnel to do things when needed
Server.prototype.handleTunnel = function (tunnel) {
  if (tunnel.proto === "tcp") {
    tunnel.tcpServer = net.createServer((socket) => {
      // idk if this is necessary
      // socket.on("error", (error) => this.emit("error", error));

      tunnel.createStream(socket).then((stream) => {
        socket.pipe(stream).pipe(socket);
      });
    });
    tunnel.tcpServer.listen(tunnel.remotePort);
    tunnel.remotePort = tunnel.tcpServer.address().port;

    tunnel.on("close", () => tunnel.tcpServer.close());
  } else {
    for (domain in tunnel.domains) {
      this._tunnelsByHost[tunnel.domains[0]] = tunnel;
    }

    tunnel.on("close", () => {
      for (domain in tunnel.domains) {
        delete this._tunnelsByHost[tunnel.domains[0]];
      }
    });
  }

  tunnel.emit("ready");
};

Server.prototype.handleRequest = function (stream, headers) {
  // Find which tunnel is assosiated with that subdomain (URL)
  let tunnel = this._tunnelsByHost[headers[":authority"]];

  // If no tunnel found with that address send 404 dudududdeee.
  if (!tunnel) {
    stream.respond({ ":status": 404 });
    stream.end("TUNNEL " + http.STATUS_CODES[404]);
    return;
  }

  tunnel
    .createStream()
    .then((pushStream) => {
      headers_proxied = { ...headers };
      delete headers_proxied[":status"];
      delete headers_proxied[":method"];
      delete headers_proxied[":path"];
      delete headers_proxied[":authority"];
      delete headers_proxied[":scheme"];
      const req_proxied = http
        .request({
          hostname: tunnel.addr,
          path: headers[":path"],
          method: headers[":method"],
          headers: { ...headers_proxied, host: tunnel.addr || "localhost" },

          createConnection: () => pushStream,
        })
        .on("response", (res_proxied) => {
          stream.respond({ ":status": res_proxied.statusCode });
          // res_proxied.headers
          res_proxied.pipe(stream);
        });
      stream.pipe(req_proxied);
    })
    .catch((error) => {
      console.log(error);
      // If can't open socket on remote, send error
      stream.respond({ ":status": 500 });
      stream.end("TUNNEL " + http.STATUS_CODES[500], "utf-8");
    });
};

Server.prototype.use = function (server, config) {
  server(this, config);
};

Server.prototype.listen = function (port) {
  this._http2.listen(port);
};

util.inherits(Server, events.EventEmitter);

module.exports = Server;

/*
server = {};
      server.socket = net.createQuicSocket({ endpoint: { port } });
      server.socket
        .on("session", (session) => {
          const tunnel = new ServerTunnel()._setTransport(
            constants.QUIC,
            session
          );
          this.emit("tunnel", tunnel);

          session.on("stream", (stream) => {
            console.log("[SESSION][STREAM]");
            // Let's see what the peer has to say...
            stream.setEncoding("utf8");
            stream.on("data", console.log);
            stream.on("end", () => {
              console.log("[SESSION][STREAM] END");
            });
          });

          session.on("close", () => tunnel.emit("close"));
        })
        .listen({ alpn: constants.ALPN, key, cert, ca, idleTimeout: 15 });
      break;
  
*/

/*
// Tunnel connections
  // Do not listen because all tunnels handled by a outside tls server
  // Then emitted to here
  this.server = net.createServer((socket) => {
    socket.read(1); // Remove the first 0 byte

    // Rewrite here in the future
    socket.on("message", (message) => {
      console.log(message);
    });

    socket.on("readable", () => {
      let msgLength = socket.read(2);
      if (!msgLength) return;

      let msg = socket.read(msgLength.readUInt16BE());
      if (!msg) {
        socket.unshifted = 1;
        socket.unshift(msgLength);
        return;
      }

      socket.emit("message", msg);
    });

    socket.on("error", (error) => console.log(error));

    socket.on("close", () => {
      console.log("[Tunnel] Close");
    });
  });

*/
