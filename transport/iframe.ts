
export class Conn {
  waiters: Array<() => void>
  chunks: Array<Uint8Array>;
  isClosed: boolean
  frame: Window;

  constructor(frame?: HTMLIFrameElement) {
    this.isClosed = false;
    this.waiters = [];
    this.chunks = [];
    if (frame && frame.contentWindow) {
      this.frame = frame.contentWindow;
    } else {
      this.frame = window.parent;
    }
    window.addEventListener("message", (event) => {
      const chunk = new Uint8Array(event.data);
      this.chunks.push(chunk);
      if (this.waiters.length > 0) {
        const waiter = this.waiters.shift();
        if (waiter) waiter();
      }
    })
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