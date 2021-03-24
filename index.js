// Disable Experimental QUIC Warning
const { emitWarning } = process;
process.emitWarning = (warning, ...args) => {
  if (args[0] === "ExperimentalWarning") return;
  return emitWarning(warning, ...args);
};

// Exports Constants Directly
const constants = require("./src/constants.js");
for (const constant in constants) {
  exports[constant] = constants[constant];
}

exports.Tunnel = require("./src/tunnel.js");
exports.ServerTunnel = require("./src/server-tunnel.js");
exports.Server = require("./src/server.js");
