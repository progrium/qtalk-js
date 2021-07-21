// @ts-ignore
import * as rpc from "./mod.ts";
// @ts-ignore
import * as codec_ from "../codec/mod.ts";
// @ts-ignore
import * as mux from "../mux/mod.ts";


export async function Respond(ch: mux.Channel, codec: codec_.Codec, handler?: rpc.Handler): Promise<void> {
  const framer = new codec_.FrameCodec(codec);
  const dec = framer.decoder(ch);
  const frame = await dec.decode();

  const call = new rpc.Call(frame.Selector, dec);
  call.caller = new rpc.Client(ch.session, codec);
  
  const header = new rpc.ResponseHeader();
  const resp = new responder(ch, framer, header);
  
  if (!handler) {
    handler = new rpc.RespondMux();
  }
  
  await handler.respondRPC(resp, call);
  
  return Promise.resolve();
}


class responder implements rpc.Responder {
  header: rpc.ResponseHeader;
  ch: mux.Channel;
  codec: codec_.FrameCodec;
  
  constructor(ch: mux.Channel, codec: codec_.FrameCodec, header: rpc.ResponseHeader) {
    this.ch = ch;
    this.codec = codec;
    this.header = header;
  }
  
  send(v: any): Promise<void> {
    return this.codec.encoder(this.ch).encode(v);
  }

  return(v: any): Promise<void> {
    return this.respond(v, false);
  }

  async continue(v: any): Promise<mux.Channel> {
    await this.respond(v, true);
    return this.ch;
  }

  async respond(v: any, continue_: boolean): Promise<void> {
    this.header.Continue = continue_;

    // if v is error, set v to null
	  // and put error in header
    if (v instanceof Error) {
      this.header.Error = v.message;
      v = null;
    }

    await this.send(this.header);
    await this.send(v);

    if (!continue_) {
      await this.ch.close();
    }

    return Promise.resolve();
  }
  
}