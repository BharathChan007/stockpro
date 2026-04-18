import type { Server as IoServer } from "socket.io";

let ioRef: IoServer | null = null;

export function setIo(io: IoServer) {
  ioRef = io;
}

export function broadcastStockUpdate() {
  ioRef?.emit("stock:update", { at: new Date().toISOString() });
}
