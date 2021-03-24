const ssh2 = require("ssh2");

const ServerTunnel = require("./localport.ServerTunnel.js");

module.exports = (server, { port, hostKeys }) => {
  return new ssh2.Server({ hostKeys }, (client) => {
    const tunnel = new ServerTunnel({});
    tunnel.createStream = function () {
      return new Promise((resolve, reject) => {
        this.transport.session.forwardOut(
          this.remoteAddr || this.domains[0],
          this.remotePort || 80,
          "",
          0,
          (err, stream) => (err ? reject(err) : resolve(stream))
        );
      });
    }.bind(tunnel);
    tunnel.transport = { proto: constants.SSH, session: client };
    server.emit("tunnel", tunnel);

    client
      .on("authentication", (ctx) => {
        // Anonymous tunnels not supported (method none)
        // Cuz when i accept method none, it doesn't check for publickey
        // So using a account with ssh needs "-i key_file"
        if (ctx.method !== "publickey") return ctx.reject(["publickey"]);
        // If no signature accept directly without checking public key, check sig later
        if (!ctx.signature) return ctx.accept();

        ctx.publickey = ctx.key;
        tunnel.emit("ssh auth", ctx);
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
          tunnel.stdout = stream;
          tunnel.emit("stdout");
        });
      })
      .on("request", (accept, reject, name, info) => {
        if (name !== "tcpip-forward") return reject();

        // "-R bindAddr:bindPort:unknown:unknown"
        tunnel.proto = info.bindPort === 80 ? "http" : "tcp";
        tunnel.addr = undefined; // idk how i can get that, ssh is hiding info :(
        tunnel.port = undefined;

        // TCP: Set remoteAddr and remotePort as they are TCP only
        // HTTP: Set domains
        if (tunnel.proto === "tcp") {
          tunnel.remoteAddr = info.bindAddr;
          tunnel.remotePort = info.bindPort;
        } else {
          tunnel.domains = [info.bindAddr];
        }

        tunnel.once("ready", () => accept(tunnel.remotePort));
        server.handleTunnel(tunnel);
      })
      .on("error", (error) => tunnel.emit("error", error))
      .on("end", () => tunnel.emit("close"));
  })
    .on("error", (error) => server.emit("error", error))
    .listen(port);
};
