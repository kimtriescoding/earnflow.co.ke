let io = null;

export function getSocketServer() {
  return io;
}

export function setSocketServer(instance) {
  io = instance;
}
