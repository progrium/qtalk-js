// @ts-ignore
import * as rpc from "./mod.ts";

export interface Handler {
  respondRPC(r: rpc.Responder, c: rpc.Call): void;
}

export function HandlerFunc(fn: (r: rpc.Responder, c: rpc.Call) => void): Handler {
  return {respondRPC: fn}
}

export function NotFoundHandler(): Handler {
  return HandlerFunc((r: rpc.Responder, c: rpc.Call) => {
    r.return(new Error(`not found: ${c.selector}`));
  });
}

function cleanSelector(s: string): string {
  if (s === "") {
    return "/";
  }
  if (s[0] != "/") {
    s = "/"+s;
  }
  s = s.replace(".", "/");
  return s;
}


export class RespondMux {
  handlers: {[index: string]: Handler};

  constructor() {
    this.handlers = {};
  }

  respondRPC(r: rpc.Responder, c: rpc.Call) {
    const h = this.handler(c);
    h.respondRPC(r, c);
  }

  handler(c: rpc.Call): Handler {
    const h = this.match(c.selector);
    if (!h) {
      return NotFoundHandler();
    }
    return h;
  }

  remove(selector: string): Handler|null {
    selector = cleanSelector(selector);
    const h = this.match(selector);
    delete this.handlers[selector];
    return h || null;
  }

  match(selector: string): Handler|null {
    selector = cleanSelector(selector);

    if (this.handlers.hasOwnProperty(selector)) {
      return this.handlers[selector];
    }

    return null;
  }

  handle(selector: string, handler: Handler) {
    if (selector === "") {
      throw "invalid selector";
    }
    selector = cleanSelector(selector);

    if (!handler) {
      throw "invalid handler";
    }
    if (this.match(selector)) {
      throw "selector already registered";
    }
    this.handlers[selector] = handler;
  }
}

