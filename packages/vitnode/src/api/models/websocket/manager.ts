import type { Context } from "hono";

export interface WebsocketManagerConfig {
  addConnection: (id: string, socket: WebSocket) => void;
  removeConnection: (id: string) => void;
  getConnection: (id: string) => WebSocket | undefined;
  getAllConnections: () => Map<string, WebSocket>;
}

export class WebsocketManager implements WebsocketManagerConfig {
  constructor(c: Context) {
    this.c = c;
  }

  protected readonly c: Context;
  private readonly connections = new Map<string, WebSocket>();

  addConnection(id: string, socket: WebSocket) {
    this.connections.set(id, socket);
  }

  removeConnection(id: string) {
    this.connections.delete(id);
  }

  getConnection(id: string): WebSocket | undefined {
    return this.connections.get(id);
  }

  getAllConnections(): Map<string, WebSocket> {
    return this.connections;
  }
}
