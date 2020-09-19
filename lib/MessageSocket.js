const { Socket } = require("net");
const { Duplex } = require("stream");

class MessageSocket extends Duplex {
  constructor(socket) {
    super({}); // objectMode: true
    this._readingPaused = false;
    this._socket;
    if (socket) this._wrapSocket(socket);
  }

  connect({ host, port }) {
    this._wrapSocket(new Socket());
    this._socket.connect({ host, port });
    return this;
  }

  _wrapSocket(socket) {
    this._socket = socket;
    this._socket.on("close", (hadError) => this.emit("close", hadError));
    this._socket.on("connect", () => this.emit("connect"));
    this._socket.on("drain", () => this.emit("drain"));
    this._socket.on("end", () => this.emit("end"));
    this._socket.on("error", (err) => this.emit("error", err));
    this._socket.on('lookup', (err, address, family, host) => this.emit('lookup', err, address, family, host)); // prettier-ignore
    this._socket.on("ready", () => this.emit("ready"));
    this._socket.on("timeout", () => this.emit("timeout"));
    this._socket.on("readable", this._onReadable.bind(this));
  }

  _onReadable() {
    while (!this._readingPaused) {
      let msgLength = this._socket.read(2);
      if (!msgLength) return;

      let msg = this._socket.read(msgLength.readUInt16BE());
      if (!msg) {
        this._socket.unshift(msgLength);
        this._readingPaused = true;
        return;
      }

      let pushOk = this.push(msg);
      if (!pushOk) this._readingPaused = true;
    }
  }

  _read() {
    this._readingPaused = false;
    setImmediate(this._onReadable.bind(this));
  }

  _write(msg, encoding, cb) {
    // Write length to buffer
    let buffer = Buffer.alloc(2, 0);
    buffer.writeUInt16BE(Buffer.byteLength(msg));

    buffer = Buffer.concat([buffer, msg]);

    this._socket.write(buffer, cb);
  }

  /**
    Implements the writeable stream method `_final` used when
    .end() is called to write the final data to the stream.
   */
  _final(cb) {
    this._socket.end(cb);
  }
}

var net = require("net");
var StringDecoder = require("string_decoder").StringDecoder;
var decoder = new StringDecoder();

var MessageSocket2 = function (socket, opts) {
  this._socket = socket;
  this._contentLength = null;
  this._buffer = "";
  this._opts = opts || {};
  if (!this._opts.delimeter) {
    this._opts.delimeter = "#";
  }
  this._closed = false;
  socket.on("data", this._onData.bind(this));
  socket.on("connect", this._onConnect.bind(this));
  socket.on("close", this._onClose.bind(this));
  socket.on("err", this._onError.bind(this));
};

JsonSocket.prototype = {
  _onData: function (data) {
    data = decoder.write(data);
    try {
      this._handleData(data);
    } catch (e) {
      this.sendError(e);
    }
  },
  _handleData: function (data) {
    this._buffer += data;
    if (this._contentLength == null) {
      var i = this._buffer.indexOf(this._opts.delimeter);
      //Check if the buffer has a this._opts.delimeter or "#", if not, the end of the buffer string might be in the middle of a content length string
      if (i !== -1) {
        var rawContentLength = this._buffer.substring(0, i);
        this._contentLength = parseInt(rawContentLength);
        if (isNaN(this._contentLength)) {
          this._contentLength = null;
          this._buffer = "";
          var err = new Error(
            "Invalid content length supplied (" +
              rawContentLength +
              ") in: " +
              this._buffer
          );
          err.code = "E_INVALID_CONTENT_LENGTH";
          throw err;
        }
        this._buffer = this._buffer.substring(i + 1);
      }
    }
    if (this._contentLength != null) {
      var length = Buffer.byteLength(this._buffer, "utf8");
      if (length == this._contentLength) {
        this._handleMessage(this._buffer);
      } else if (length > this._contentLength) {
        var message = this._buffer.substring(0, this._contentLength);
        var rest = this._buffer.substring(this._contentLength);
        this._handleMessage(message);
        this._onData(rest);
      }
    }
  },
  _handleMessage: function (data) {
    this._contentLength = null;
    this._buffer = "";
    var message;
    try {
      message = JSON.parse(data);
    } catch (e) {
      var err = new Error(
        "Could not parse JSON: " + e.message + "\nRequest data: " + data
      );
      err.code = "E_INVALID_JSON";
      throw err;
    }
    message = message || {};
    this._socket.emit("message", message);
  },

  sendError: function (err) {
    this.sendMessage(this._formatError(err));
  },
  sendEndError: function (err) {
    this.sendEndMessage(this._formatError(err));
  },
  _formatError: function (err) {
    return { success: false, error: err.toString() };
  },

  sendMessage: function (message, callback) {
    if (this._closed) {
      if (callback) {
        callback(new Error("The socket is closed."));
      }
      return;
    }
    this._socket.write(this._formatMessageData(message), "utf-8", callback);
  },
  sendEndMessage: function (message, callback) {
    var that = this;
    this.sendMessage(message, function (err) {
      that.end();
      if (callback) {
        if (err) return callback(err);
        callback();
      }
    });
  },
  _formatMessageData: function (message) {
    var messageData = JSON.stringify(message);
    var length = Buffer.byteLength(messageData, "utf8");
    var data = length + this._opts.delimeter + messageData;
    return data;
  },

  _onClose: function () {
    this._closed = true;
  },
  _onConnect: function () {
    this._closed = false;
  },
  _onError: function () {
    this._closed = true;
  },
  isClosed: function () {
    return this._closed;
  },
};

var delegates = ["connect", "on", "end", "setTimeout", "setKeepAlive"];
delegates.forEach(function (method) {
  JsonSocket.prototype[method] = function () {
    this._socket[method].apply(this._socket, arguments);
    return this;
  };
});

module.exports = MessageSocket2;