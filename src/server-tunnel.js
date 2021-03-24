const Tunnel = require("./tunnel.js");
const constants = require("./constants.js");

// SERVER ONLY METHODS
class ServerTunnel extends Tunnel {
  constructor(config) {
    super(config);

    delete this._http2server;

    this.tcpServer = undefined; // TCP Server that started on server, listens on {remoteAddr}:{remotePort}
  }
}

ServerTunnel.prototype.openStream = function () {
  return new Promise((resolve, reject) => {
    let stream = this.transport.request({
      ":method": "CONNECT",
      ":authority": `${this.addr}:${this.port}`,
    });
    resolve(stream);
  });
};

module.exports = ServerTunnel;
