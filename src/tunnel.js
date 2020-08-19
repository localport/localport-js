const tls = require('tls');

const { EventEmitter } = require('events');
const { inherits } = require('util');

function Tunnel(config){
	// Release the pointer to json object
  this.config = JSON.parse(JSON.stringify(config));

  this.socket = new tls.TLSSocket();

  this.socket.on('data', this.ondata);
  this.socket.on('error', error => this.emit('error', error))
  this.socket.on('close', () => this.emit('close'));
}

Tunnel.prototype.ondata = function(data) {
  console.log(data)
}

Tunnel.prototype.start = function(){
  this.socket.connect({
    port: 443, host: 'lort.me', servername: 'lort.me'
  });
  // Write 0 as it is specifies this connection is tunnel
  this.socket.write(new Uint8Array([0]))
  this.socket.write(JSON.stringify(this.config))
}

inherits(Tunnel, EventEmitter);

module.exports = Tunnel;
