const { TLSSocket } = require("tls");
const { EventEmitter } = require("events");
const { inherits } = require("util");

function Tunnel(config) {
  // Release the pointer to json object
  this.config = JSON.parse(JSON.stringify(config));

  // This socket is for messaging
  // Transmission of packets for multiplexing
  this._socket = new TLSSocket();

  this._socket.on("readable", this._readable);
  this._socket.on("error", (error) => this.emit("error", error));
  this._socket.on("close", () => this.emit("close"));

  // This is the sockets that are opened from main socket
  // i.e. connections to localhost & port
  this.activeSockets = {};
}

Tunnel.prototype._readable = function () {
  let msgLength = this._socket.read(2);
  if (!msgLength) return;

  let msg = this._socket.read(msgLength.readUInt16BE());
  if (!msg) {
    this._socket.unshift(msgLength);
    return;
  }

  this._onmessage(msg);
};

// 0x0* -> info, operations
// 0x1* -> socket data (multiplexing etc)
Tunnel.prototype._onmessage = function (message) {
  console.log(message);

  switch (message[0]) {
    case 0x01: // Tunnel info
      this.emit("ready", JSON.parse(message.slice(1).toString()));
      break;
    case 0x02: // Tunnel close
      this.close();
      break;

    case 0x10: // Open socket
      let socketId = message[1];
      break;
    case 0x11: // Write to socket
      this.emit("ready", message.slice(1));
      break;
    case 0x12: // Close socket
      this.emit("ready", message.slice(1));
      break;
  }
};

Tunnel.prototype._send = function (msg) {
  let msgLength = Buffer.byteLength(msg);
  let buffer = Buffer.alloc(2 + msgLength);
  buffer.writeUInt16BE(msgLength);
  buffer.write(msg, 2);
  this._socket.write(buffer, null);
};

Tunnel.prototype.start = function () {
  this._socket.connect({
    port: 443,
    host: "lort.me",
    servername: "lort.me",
  });
  // Write 0 as it is specifies this connection is tunnel
  this._socket.write(new Uint8Array([0]));
  this._socket.write(JSON.stringify(this.config));
};

Tunnel.prototype.close = function () {
  this._socket.close();
};

inherits(Tunnel, EventEmitter);

module.exports = Tunnel;
