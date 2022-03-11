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
        throw resp.error;
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

export function VirtualCaller(caller: rpc.Caller): any {
  function pathBuilder(path: string, callable: (p: string, a: any[]) => any): CallableFunction {
    return new Proxy(Object.assign(() => {}, {path, callable}), {
      get({path, callable}, prop: string) {
        return pathBuilder(path ? `${path}.${prop}`: prop, callable);
      },
      apply({path, callable}, thisArg, args = []) {
        return callable(path, args);
      }
    })
  }
  return pathBuilder("", (selector, args) => {
    return caller.call(selector, args).then((resp: rpc.Response) => resp.reply)
  })
}