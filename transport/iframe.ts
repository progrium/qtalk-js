
var frames: {[index: string]: Conn} = {};

window.addEventListener("message", (event) => {
  if (!event.source) return;
  // @ts-ignore
  const frameID = (event.source.window.frameElement) ? event.source.window.frameElement.id : "";
  if (!frames[frameID]) {
      console.warn("incoming message with no established connection for frame ID:", frameID);
      return;
  }
  const conn = frames[frameID];
  const chunk = new Uint8Array(event.data);
  conn.chunks.push(chunk);
  if (conn.waiters.length > 0) {
    const waiter = conn.waiters.shift();
    if (waiter) waiter();
  }
});

export class Conn {
  waiters: Array<() => void>
  chunks: Array<Uint8Array>;
  isClosed: boolean
  frame: Window;

  constructor(frame?: HTMLIFrameElement|null) {
    this.isClosed = false;
    this.waiters = [];
    this.chunks = [];
    if (frame && frame.contentWindow) {
      this.frame = frame.contentWindow;
      frames[frame.id] = this;
    } else {
      this.frame = window.parent;
      frames[""] = this;
    }
  }

  read(p: Uint8Array): Promise<number | null> {
    return new Promise((resolve) => {
      var tryRead = () => {
        if (this.isClosed) {
          resolve(null);
          return;
        }
        if (this.chunks.length === 0) {
          this.waiters.push(tryRead);
          return;
        }
        let written = 0;
        while (written < p.length) {
          const chunk = this.chunks.shift();
          if (chunk === null || chunk === undefined) {
            resolve(null);
            return;
          }
          const buf = chunk.slice(0, p.length-written);
          p.set(buf, written)
          written += buf.length;
          if (chunk.length > buf.length) {
            const restchunk = chunk.slice(buf.length);
            this.chunks.unshift(restchunk);
          }
        }
        resolve(written);
        return;
      }
      tryRead();
    });
  }

  write(p: Uint8Array): Promise<number> {
    this.frame.postMessage(p.buffer, "*");
    return Promise.resolve(p.byteLength);
  }

  close() {
    if (this.isClosed) return;
    this.isClosed = true;
    this.waiters.forEach(waiter => waiter());
  }
}