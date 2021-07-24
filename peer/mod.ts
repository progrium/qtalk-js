// @ts-ignore
export * from "./peer.ts";

// @ts-ignore
import * as peer from "./peer.ts";
// @ts-ignore
import * as io from "../io.ts";
// @ts-ignore
import * as mux from "../mux/mod.ts";
// @ts-ignore
import * as codec from "../codec/mod.ts";
// @ts-ignore
import * as websocket from "../transport/websocket.ts";

export var options = {
  transport: websocket,
}

export async function connect(addr: string, codec: codec.Codec): Promise<peer.Peer> {
  const conn = await options.transport.connect(addr);
  return open(conn, codec);
}

export function open(conn: io.ReadWriteCloser, codec: codec.Codec): peer.Peer {
  const sess = new mux.Session(conn);
  return new peer.Peer(sess, codec);
}