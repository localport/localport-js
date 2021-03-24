const net = require("net");
const stream = require("stream");
const crypto = require("crypto");
const { EventEmitter } = require("events");
const { inherits } = require("util");

/*
- Class: 'Multplex'
  - Constructor(source: stream.Duplex)
  - Event: 'ready'
  - Event: 'stream' (stream: stream.Duplex, headers: string[])
  - multplex.openStream(headers: string[]): stream.Duplex
- Class: 'Stream' extends stream.Duplex

Message Format 1:
[--] [----] [LENGTH]
TYPE LENGTH DATA
-----------------------------
TYPE BYTE || TYPE NAME  || DATA
0:        || Handshake? || 
1-65535:  || StreamID   || Stream[Open-Headers][Close][Error-Error][Data-Data]

Message Format 2:
[-]  [--]     [----] [LENGTH]
TYPE StreamID LENGTH DATA
-----------------------------
TYPE BYTE      || DATA
0: StreamOpen  || Headers
1: StreamClose ||
2: StreamError || Error
3: StreamData  || Data
*/

class Stream extends stream.Duplex {
  constructor({ session, _id, headers }) {
    super();
    this.session = session;
    this._id = _id;
    this.headers = headers;
  }

  _write(chunk, encoding, callback) {
    let buffer = Buffer.alloc(6);
    buffer.writeUInt16LE(this._id, 0);
    buffer.writeUInt32LE(chunk.length, 2);
    buffer = Buffer.concat([buffer, chunk]);
    this.session.socket.write(buffer);
    callback();
  }

  _read(size) {}
}

function Multplex(socket) {
  this.socket = socket;

  this._streams = {}; // Streams mapped by id

  this._msgBuffer = Buffer.from([]);
  socket.on("data", (data) => {
    this._msgBuffer = Buffer.concat([this._msgBuffer, data]);
    if (this._msgBuffer.length < 6) return; // Min msg size is 6 (0-1 type, 2-5 length)

    while (true) {
      // If buffer is smaller than min fixed length
      if (this._msgBuffer.length < 6) break;

      let msg = {
        type: this._msgBuffer.readUInt16LE(0),
        length: this._msgBuffer.readUInt32LE(2),
      };

      // If message data not loaded fully
      if (this._msgBuffer.length - 6 < msg.length) break;

      // Set message data
      msg.data = this._msgBuffer.slice(6, 6 + msg.length);
      // Remove message from msgBuffer
      this._msgBuffer = this._msgBuffer.slice(6 + msg.length);

      this._handleMessage(msg);
    }
  });
}

Multplex.prototype._handleMessage = function (message) {
  // console.log(message.type, message.length, message.data.slice(0, 10));
  if (message.type === 0) {
    let stream = new Stream({
      session: this,
      headers: message.data.toString(),
    });
    this.emit("stream", stream, stream.headers);
  }
};

Multplex.prototype.openStream = function (headers) {
  // Send 'openStream' Message
  let buffer = Buffer.alloc(6 + headers.length);
  buffer.writeUInt16LE(0, 0);
  buffer.writeUInt32LE(headers.length, 2);
  buffer.write(headers, 6);
  this.socket.write(buffer);

  let stream = new Stream({ session: this, headers });
  return stream;
};

inherits(Multplex, EventEmitter);

net
  .createServer(function (socket) {
    console.log("[SERVER]: Event 'connection'");

    let multplex = new Multplex(socket);

    multplex.on("stream", function (stream, headers) {
      console.log(
        `[SERVER][MULTPLEX]: Event 'stream' - ${headers.slice(0, 64)}`
      );
      stream.on("data", (data) => {
        console.log("[SERVER][MULTPLEX]: Event 'data'", data.toString());
      });
      stream.on("close", () => console.log("SERVER: CLOSE"));
    });
  })
  .listen(7000, function () {
    var multplex = new Multplex(net.createConnection(7000));

    multplex.socket.on("drain", () => {
      console.log("DRAIN");
    });

    for (i = 1; i <= 1; i += 1) {
      let stream = multplex.openStream("HEADER" + i);
      stream.write(crypto.randomBytes(i * 65535 * 0.3));
    }
    multplex.openStream("HEADER5");
  });
