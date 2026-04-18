import { io, type Socket } from "socket.io-client";
import { API_BASE_URL } from "./api.js";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_BASE_URL || "/", { transports: ["websocket", "polling"] });
  }
  return socket;
}
