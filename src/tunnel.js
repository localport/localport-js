const http2 = require("http2");
const { EventEmitter } = require("events");
const { inherits } = require("util");

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
function Tunnel(config) {
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

  this.transport = undefined; // Info about transport protocol, ssh, h2, quic etc.
  this._TCPServer = undefined; // TCP Server that started on server, listens on {remoteAddr}:{remotePort}
  this._stdout = undefined; // Logging for CLI
}

Tunnel.prototype.forward = function () {
  // Must not specify the ':path' and ':scheme' headers
  // for CONNECT requests or an error will be thrown.
  this._client.request({
    ":method": "CONNECT",
    ":authority": `localhost:3000`,
  });

  req.on("response", (headers) => {
    console.log(headers[http2.constants.HTTP2_HEADER_STATUS]);
  });
  req.setEncoding("utf8");
  req.on("data", (chunk) => console.log(chunk.toString()));
};

Tunnel.prototype.start = function () {
  this._client = http2.connect({
    port: this.server.port,
    host: this.server.host,
    servername: this.server.host,
  });
  this._client.on("error", (error) => this.emit("error", error));

  this._client.on("stream", (stream) => {});

  const stream = this._client.request({
    "x-config": JSON.stringify(this.config),
  });
};

Tunnel.prototype.close = function () {
  this._socket.close();
};

// SERVER ONLY METHODS
// Initializes transport properties, events etc.
Tunnel.prototype._setTransport = function (proto, session) {
  this.transport = { proto, session };
  switch (proto) {
    case constants.H2:
      break;
    case constants.QUIC:
      session.on("close", () => this.emit("close"));
      break;
    case constants.SSH:
      session
        .on("authentication", (ctx) => {
          // Anonymous tunnels not supported (method none)
          if (ctx.method !== "publickey") return ctx.reject(["publickey"]);
          // If no signature accept directly without checking public key
          if (!ctx.signature) return ctx.accept();

          ctx.publickey = ctx.key;
          this.emit("auth", ctx);
        })
        .once("session", (accept, reject) => {
          const session = accept();
          session.once("pty", (accept, reject, info) => accept());
          session.once("shell", (accept, reject) => {
            const stream = accept();
            // Close tunnel when pressed ctrl+c
            stream.on(
              "data",
              (data) => data.length === 1 && data[0] === 0x03 && stream.end()
            );
            this.stdout = stream;
            this.emit("stdout");
          });
        })
        .on("error", (error) => this.emit("error", error))
        .on("end", () => this.emit("close"));
      break;
  }

  return this;
};

inherits(Tunnel, EventEmitter);

module.exports = Tunnel;
