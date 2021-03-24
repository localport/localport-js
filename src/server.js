const net = require("net");
const tls = require("tls");
const http = require("http");
const http2 = require("http2");
const events = require("events");
const util = require("util");

const constants = require("./constants.js");
const ServerTunnel = require("./server-tunnel.js");

function Server({ key, cert, ca }) {
  // We do have to keep tunnels in a store for a fast handleRequest method
  this._tunnels = []; // { proto, port, ... }
  this._tunnelsByHost = {}; // HTTP Tunnels

  // TLS Connections emitted these to handle tunnel requests
  // HTTP1 listens cause 80 port is not encrypted and can be directly listened
  this._http1server = http.createServer().listen(80);
  this._http2server = http2.createServer();

  this._server = tls
    .createServer({ key, cert, ca, ALPNProtocols: ["h2", "http/1.1"] })
    .on("secureConnection", (socket) => {
      switch (socket.alpnProtocol) {
        case "h2":
          this._http2server.emit("connection", socket);
          break;
        case "http/1.1":
          this._http1server.emit("connection", socket);
          break;
        default:
          // Handle Tunnel Connections
          // use this socket to create a reverse-http2 connection
          transport = http2.connect("http://localhost", {
            createConnection: () => socket,
          });
          let request = transport.request({ ":method": "CONFIG" });
          let config = "";
          request.on("data", (data) => (config += data));
          request.on("end", () => {
            let tunnel = new ServerTunnel(JSON.parse(config));
            tunnel.transport = transport;
            this.handleTunnel(tunnel);
          });
      }
    });
}

// Tunnel added to here after getting config
// Here opens TCP server if needed
// Here listens to events on tunnel to do things when needed
Server.prototype.handleTunnel = function (tunnel) {
  console.log("GOT TUNNEL");
  if (tunnel.proto === "tcp") {
    tunnel.tcpServer = net.createServer((socket) => {
      // idk if this is necessary
      // socket.on("error", (error) => this.emit("error", error));

      tunnel.openStream().then((stream) => {
        socket.pipe(stream).pipe(socket);
      });
    });
    tunnel.tcpServer.listen(tunnel.remotePort);
    tunnel.remotePort = tunnel.tcpServer.address().port;

    tunnel.remoteAddr = "lort.me";
    tunnel.remotePort = tunnel.remotePort;

    tunnel.on("close", () => tunnel.tcpServer.close());
  } else {
    console.log(tunnel.domains);
    for (domain of tunnel.domains) {
      this._tunnelsByHost[domain] = tunnel;
    }

    tunnel.on("close", () => {
      for (domain of tunnel.domains) {
        delete this._tunnelsByHost[domain];
      }
    });
  }

  console.log(tunnel.remoteAddr + ":" + tunnel.remotePort);
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
  this._server.listen(port);
};

util.inherits(Server, events.EventEmitter);

module.exports = Server;

/*

          let length = null;
          let config = null;
          socket.on("readable", () => {
            // Read tunnel config
            if (!length) length = socket.read(2);
            if (!length) return;
            if (!config) config = socket.read(length.readUInt16LE(0));
            if (!config) return;
            socket.removeAllListeners("readable"); // Do not emit readable to here anymore

            // this.handleTunnel(tunnel);
          });
*/
