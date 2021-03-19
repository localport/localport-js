const Tunnel = require("./tunnel.js");
const constants = require("./constants.js");

// SERVER ONLY METHODS
class ServerTunnel extends Tunnel {
  constructor(config) {
    super(config);

    this.tcpServer = undefined; // TCP Server that started on server, listens on {remoteAddr}:{remotePort}
  }
}

ServerTunnel.prototype.createStream = function () {
  return new Promise((resolve, reject) => {
    switch (this.transport.proto) {
      case constants.H2:
        // CONNECT METHOD GIVES PROTOCOL ERROR
        this.transport.session.pushStream(
          {
            ":method": "CONNECT1",
            ":authority": `${this.addr}:${this.port}`,
          },
          (err, stream, headers) => (err ? reject(err) : resolve(stream))
        );
        break;
      case constants.SSH:
        this.transport.session.forwardOut(
          this.remoteAddr || this.domains[0],
          this.remotePort || 80,
          "",
          0,
          (err, stream) => (err ? reject(err) : resolve(stream))
        );
        break;
    }
  });
};

module.exports = ServerTunnel;
