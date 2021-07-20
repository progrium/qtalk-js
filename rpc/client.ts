// @ts-ignore
import * as rpc from "./mod.ts";
// @ts-ignore
import * as codec from "../codec/mod.ts";
// @ts-ignore
import * as mux from "../mux/mod.ts";


export class Client implements rpc.Caller {
  session: mux.Session;
  codec: codec.Codec;

  constructor(session: mux.Session, codec: codec.Codec) {
    this.session = session;
    this.codec = codec;    
  }

  async call(selector: string, args: any): Promise<rpc.Response> {
    const ch = await this.session.open();
    try {
      const framer = new codec.FrameCodec(this.codec);
      const enc = framer.encoder(ch);
      const dec = framer.decoder(ch);
      
      // request
      await enc.encode({Selector: selector});
      await enc.encode(args);

      // response
      const header: rpc.ResponseHeader = await dec.decode();
      const resp: rpc.Response = new rpc.Response(ch, framer);

      resp.error = header.Error;
      if (resp.error !== undefined && resp.error !== null) {
        console.error(header);
        return resp;
      }

      resp.reply = await dec.decode();

      resp.continue = header.Continue;
      if (!resp.continue) {
        await ch.close();
      }
      
      return resp;
    } catch (e) {
      await ch.close();
      console.error(e, selector, args);
      return Promise.reject(e);
      
    }
  }
}

export function CallProxy(caller: rpc.Caller): any {
  return new Proxy(caller, {
    get: (t,p,r) => {
      const prop = p as string;
      if (prop.startsWith("$")) {
        return async (...args: any[]) => {
          let params: any = args;
          if (args.length === 1) {
            params = args[0];
          }
          if (args.length === 0) {
            params = undefined;
          }
          const resp = await caller.call(prop.slice(1), params);
          if (resp.error) {
            throw resp.error;
          }
          return resp.reply;
        }
      }
      return Reflect.get(t, p, r);
    }
  })
}