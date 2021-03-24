const net = require("net");
const tls = require("tls");
const http2 = require("http2");
const { EventEmitter } = require("events");
const { inherits } = require("util");

const constants = require("./constants.js");

/**
 * @typedef {Object} TunnelConfig
 * @property {string} [token] Token for auth
 * @property {string} [proto="http"] Forwarding protocol, could be TCP or HTTP
 * @property {string} [addr="localhost"] Local addr to forward;
 * @property {number} [port=3000] Local port to forward;
 * @property {string} [remoteAddr] Remote addr to listen on server
 * @property {number} [remotePort] Remote port to listen on server
 * @property {string} [hostHeader] Rewrite host header (for shared web hosts, wordpress etc)
 * @property {string[]} [domains] lort.me subdomain or custom domains
 * @property {Object} [server] server to connect
 */

/**
 * @param {TunnelConfig} config
 * @return {Tunnel} Tunnel Instance
 */
function Tunnel(config = {}) {
  this._id = config._id;
  this.token = config.token;

  this.proto = config.proto || "http";
  this.addr = config.addr || "localhost";
  this.port = config.port || 3000;

  // TCP Only
  this.remoteAddr = config.remoteAddr;
  this.remotePort = config.remotePort;

  // HTTP Only
  this.hostHeader = config.hostHeader;
  this.domains = config.domains;

  this.server = config.server || { host: "lort.me", port: 443 };

  // Local http2 server that reverse connected
  this._http2server = http2.createServer();
  this._http2server.on("error", (error) => this.emit("error", error));

  this._http2server.on("stream", (stream, headers) => {
    console.log("[CLIENT]: Event 'stream'", headers);

    // CONFIG request, send Config
    if (headers[":method"] === "CONFIG") {
      this._isConfigSent = true;
      stream.respond({ ":status": 200 });
      stream.end(
        JSON.stringify({
          token: this.token,
          proto: this.proto,
          addr: this.addr,
          port: this.port,
          remoteAddr: this.remoteAddr,
          remotePort: this.remotePort,
          hostHeader: this.hostHeader,
          domains: this.domains,
        })
      );
      return;
    }

    // Forward requests (":method": "CONNECT")
    this.forward(stream, headers);
  });

  this.transport = undefined; // Info about transport protocol, ssh, h2, quic etc.
  this._isConfigSent = false;
  this._stdout = undefined; // Logging for CLI
}

Tunnel.prototype.forward = function (stream, headers) {
  // const auth = new URL(`tcp://${headers[":authority"]}`);
  const auth = new URL(`tcp://${this.addr}:${this.port}`);
  // It's a very good idea to verify that hostname and port are
  // things this proxy should be connecting to.
  const socket = new net.Socket();
  socket.on("error", (error) => {
    stream.close(http2.constants.NGHTTP2_CONNECT_ERROR);
  });
  socket.connect(auth.port, auth.hostname, function () {
    socket.pipe(stream).pipe(socket);
  });
};

Tunnel.prototype.start = function () {
  this._socket = tls.connect({
    port: this.server.port,
    host: this.server.host,
    // servername: this.server.host,
  });
  this._socket.on("error", (error) => this.emit("error", error));

  this._http2server.emit("connection", this._socket);
};

Tunnel.prototype.close = function () {
  this._socket.close();
};

inherits(Tunnel, EventEmitter);

module.exports = Tunnel;

/*
  // Send Config
  let config = JSON.stringify({
    token: this.token,
    proto: this.proto,
    addr: this.addr,
    port: this.port,
    remoteAddr: this.remoteAddr,
    remotePort: this.remotePort,
    hostHeader: this.hostHeader,
    domains: this.domains,
  });
  let buffer = new Buffer.alloc(2 + config.length);
  buffer.writeUInt16LE(config.length, 0);
  buffer.write(config, 2);
  this._socket.write(buffer);
*/
