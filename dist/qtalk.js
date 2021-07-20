function copy(src, dst, off = 0) {
    off = Math.max(0, Math.min(off, dst.byteLength));
    const dstBytesAvailable = dst.byteLength - off;
    if (src.byteLength > dstBytesAvailable) {
        src = src.subarray(0, dstBytesAvailable);
    }
    dst.set(src, off);
    return src.byteLength;
}
const MIN_READ = 32 * 1024;
const MAX_SIZE = 2 ** 32 - 2;
class Buffer1 {
    _buf;
    _off = 0;
    constructor(ab){
        this._buf = ab === undefined ? new Uint8Array(0) : new Uint8Array(ab);
    }
    bytes(options = {
        copy: true
    }) {
        if (options.copy === false) return this._buf.subarray(this._off);
        return this._buf.slice(this._off);
    }
    empty() {
        return this._buf.byteLength <= this._off;
    }
    get length() {
        return this._buf.byteLength - this._off;
    }
    get capacity() {
        return this._buf.buffer.byteLength;
    }
    truncate(n) {
        if (n === 0) {
            this.reset();
            return;
        }
        if (n < 0 || n > this.length) {
            throw Error("bytes.Buffer: truncation out of range");
        }
        this._reslice(this._off + n);
    }
    reset() {
        this._reslice(0);
        this._off = 0;
    }
    _tryGrowByReslice(n) {
        const l = this._buf.byteLength;
        if (n <= this.capacity - l) {
            this._reslice(l + n);
            return l;
        }
        return -1;
    }
    _reslice(len) {
        this._buf = new Uint8Array(this._buf.buffer, 0, len);
    }
    readSync(p) {
        if (this.empty()) {
            this.reset();
            if (p.byteLength === 0) {
                return 0;
            }
            return null;
        }
        const nread = copy(this._buf.subarray(this._off), p);
        this._off += nread;
        return nread;
    }
    read(p) {
        const rr = this.readSync(p);
        return Promise.resolve(rr);
    }
    writeSync(p) {
        const m = this._grow(p.byteLength);
        return copy(p, this._buf, m);
    }
    write(p) {
        const n = this.writeSync(p);
        return Promise.resolve(n);
    }
    _grow(n) {
        const m = this.length;
        if (m === 0 && this._off !== 0) {
            this.reset();
        }
        const i = this._tryGrowByReslice(n);
        if (i >= 0) {
            return i;
        }
        const c = this.capacity;
        if (n <= Math.floor(c / 2) - m) {
            copy(this._buf.subarray(this._off), this._buf);
        } else if (c + n > MAX_SIZE) {
            throw new Error("The buffer cannot be grown beyond the maximum size.");
        } else {
            const buf = new Uint8Array(Math.min(2 * c + n, MAX_SIZE));
            copy(this._buf.subarray(this._off), buf);
            this._buf = buf;
        }
        this._off = 0;
        this._reslice(Math.min(m + n, MAX_SIZE));
        return m;
    }
    grow(n) {
        if (n < 0) {
            throw Error("Buffer.grow: negative count");
        }
        const m = this._grow(n);
        this._reslice(m);
    }
    async readFrom(r) {
        let n = 0;
        const tmp = new Uint8Array(MIN_READ);
        while(true){
            const shouldGrow = this.capacity - this.length < MIN_READ;
            const buf = shouldGrow ? tmp : new Uint8Array(this._buf.buffer, this.length);
            const nread = await r.read(buf);
            if (nread === null) {
                return n;
            }
            if (shouldGrow) this.writeSync(buf.subarray(0, nread));
            else this._reslice(this.length + nread);
            n += nread;
        }
    }
    readFromSync(r) {
        let n = 0;
        const tmp = new Uint8Array(MIN_READ);
        while(true){
            const shouldGrow = this.capacity - this.length < MIN_READ;
            const buf = shouldGrow ? tmp : new Uint8Array(this._buf.buffer, this.length);
            const nread = r.readSync(buf);
            if (nread === null) {
                return n;
            }
            if (shouldGrow) this.writeSync(buf.subarray(0, nread));
            else this._reslice(this.length + nread);
            n += nread;
        }
    }
}
export { Buffer1 as Buffer };
class JSONCodec1 {
    debug;
    constructor(debug1 = false){
        this.debug = debug1;
    }
    encoder(w) {
        return new JSONEncoder1(w, this.debug);
    }
    decoder(r) {
        return new JSONDecoder1(r, this.debug);
    }
}
class JSONEncoder1 {
    w;
    enc;
    debug;
    constructor(w1, debug2 = false){
        this.w = w1;
        this.enc = new TextEncoder();
        this.debug = debug2;
    }
    async encode(v) {
        if (this.debug) {
            console.log("<<", v);
        }
        let buf = this.enc.encode(JSON.stringify(v));
        let nwritten = 0;
        while(nwritten < buf.length){
            nwritten += await this.w.write(buf.subarray(nwritten));
        }
    }
}
class JSONDecoder1 {
    r;
    dec;
    debug;
    constructor(r1, debug3 = false){
        this.r = r1;
        this.dec = new TextDecoder();
        this.debug = debug3;
    }
    async decode(len) {
        const buf = new Uint8Array(len);
        const bufn = await this.r.read(buf);
        if (bufn === null) {
            return Promise.resolve(null);
        }
        let v = JSON.parse(this.dec.decode(buf));
        if (this.debug) {
            console.log(">>", v);
        }
        return Promise.resolve(v);
    }
}
export { JSONCodec1 as JSONCodec };
export { JSONEncoder1 as JSONEncoder };
export { JSONDecoder1 as JSONDecoder };
class FrameCodec1 {
    codec;
    constructor(codec1){
        this.codec = codec1;
    }
    encoder(w) {
        return new FrameEncoder1(w, this.codec);
    }
    decoder(r) {
        return new FrameDecoder1(r, this.codec.decoder(r));
    }
}
class FrameEncoder1 {
    w;
    codec;
    constructor(w2, codec2){
        this.w = w2;
        this.codec = codec2;
    }
    async encode(v) {
        const data = new Buffer1();
        const enc = this.codec.encoder(data);
        await enc.encode(v);
        const lenPrefix = new DataView(new ArrayBuffer(4));
        lenPrefix.setUint32(0, data.length);
        const buf = new Uint8Array(data.length + 4);
        buf.set(new Uint8Array(lenPrefix.buffer), 0);
        buf.set(data.bytes(), 4);
        let nwritten = 0;
        while(nwritten < buf.length){
            nwritten += await this.w.write(buf.subarray(nwritten));
        }
    }
}
class FrameDecoder1 {
    r;
    dec;
    constructor(r2, dec1){
        this.r = r2;
        this.dec = dec1;
    }
    async decode(len) {
        const prefix = new Uint8Array(4);
        const prefixn = await this.r.read(prefix);
        if (prefixn === null) {
            return null;
        }
        const prefixv = new DataView(prefix.buffer);
        const size = prefixv.getUint32(0);
        return await this.dec.decode(size);
    }
}
export { FrameCodec1 as FrameCodec };
export { FrameEncoder1 as FrameEncoder };
export { FrameDecoder1 as FrameDecoder };
function HandlerFunc1(fn) {
    return {
        respondRPC: fn
    };
}
function NotFoundHandler1() {
    return HandlerFunc1((r3, c)=>{
        r3.return(new Error(`not found: ${c.selector}`));
    });
}
function cleanSelector(s) {
    if (s === "") {
        return "/";
    }
    if (s[0] != "/") {
        s = "/" + s;
    }
    s = s.replace(".", "/");
    return s;
}
class RespondMux1 {
    handlers;
    constructor(){
        this.handlers = {
        };
    }
    respondRPC(r, c) {
        const h = this.handler(c);
        h.respondRPC(r, c);
    }
    handler(c) {
        const h = this.match(c.selector);
        if (!h) {
            return NotFoundHandler1();
        }
        return h;
    }
    remove(selector) {
        selector = cleanSelector(selector);
        const h = this.match(selector);
        delete this.handlers[selector];
        return h || null;
    }
    match(selector) {
        selector = cleanSelector(selector);
        if (this.handlers.hasOwnProperty(selector)) {
            return this.handlers[selector];
        }
        return null;
    }
    handle(selector, handler) {
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
export { HandlerFunc1 as HandlerFunc };
export { NotFoundHandler1 as NotFoundHandler };
export { RespondMux1 as RespondMux };
class Call1 {
    selector;
    caller;
    decoder;
    constructor(selector1, decoder){
        this.selector = selector1;
        this.decoder = decoder;
    }
    receive() {
        return this.decoder.decode();
    }
}
class ResponseHeader1 {
    Error;
    Continue;
    constructor(){
        this.Error = undefined;
        this.Continue = false;
    }
}
class Response1 {
    error;
    continue;
    reply;
    channel;
    codec;
    constructor(channel, codec3){
        this.channel = channel;
        this.codec = codec3;
        this.error = undefined;
        this.continue = false;
    }
    send(v) {
        this.codec.encoder(this.channel).encode(v);
    }
    receive() {
        return this.codec.decoder(this.channel).decode();
    }
}
export { Response1 as Response };
class Client1 {
    session;
    codec;
    constructor(session1, codec4){
        this.session = session1;
        this.codec = codec4;
    }
    async call(selector, args) {
        const ch = await this.session.open();
        try {
            const framer = new FrameCodec1(this.codec);
            const enc = framer.encoder(ch);
            const dec1 = framer.decoder(ch);
            await enc.encode({
                Selector: selector
            });
            await enc.encode(args);
            const header = await dec1.decode();
            const resp = new Response1(ch, framer);
            resp.error = header.Error;
            if (resp.error !== undefined && resp.error !== null) {
                console.error(header);
                return resp;
            }
            resp.reply = await dec1.decode();
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
async function Respond1(ch, codec5, handler) {
    const framer = new FrameCodec1(codec5);
    const dec1 = framer.decoder(ch);
    const frame = await dec1.decode();
    const call = new Call1(frame.Selector, dec1);
    call.caller = new Client1(ch.session, codec5);
    const header = new ResponseHeader1();
    const resp = new responder1(ch, framer, header);
    if (!handler) {
        handler = new RespondMux1();
    }
    await handler.respondRPC(resp, call);
    return Promise.resolve();
}
function CallProxy1(caller) {
    return new Proxy(caller, {
        get: (t, p, r3)=>{
            const prop = p;
            if (prop.startsWith("$")) {
                return async (...args)=>{
                    let params = args;
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
                };
            }
            return Reflect.get(t, p, r3);
        }
    });
}
class responder1 {
    header;
    ch;
    codec;
    constructor(ch1, codec5, header){
        this.ch = ch1;
        this.codec = codec5;
        this.header = header;
    }
    send(v) {
        return this.codec.encoder(this.ch).encode(v);
    }
    return(v) {
        return this.respond(v, false);
    }
    async continue(v) {
        await this.respond(v, true);
        return this.ch;
    }
    async respond(v, continue_) {
        this.header.Continue = continue_;
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
export { Call1 as Call };
export { ResponseHeader1 as ResponseHeader };
export { Client1 as Client };
export { CallProxy1 as CallProxy };
export { Respond1 as Respond };
class Peer1 {
    session;
    caller;
    codec;
    responder;
    constructor(session2, codec6){
        this.session = session2;
        this.codec = codec6;
        this.caller = new Client1(session2, codec6);
        this.responder = new RespondMux1();
    }
    async respond() {
        while(true){
            const ch1 = await this.session.accept();
            if (ch1 === null) {
                break;
            }
            Respond1(ch1, this.codec, this.responder);
        }
    }
    async call(selector, params) {
        return this.caller.call(selector, params);
    }
    handle(selector, handler) {
        this.responder.handle(selector, handler);
    }
    respondRPC(r, c) {
        this.responder.respondRPC(r, c);
    }
}
export { Peer1 as Peer };
function concat(list, totalLength) {
    const buf = new Uint8Array(totalLength);
    let offset = 0;
    list.forEach((el)=>{
        buf.set(el, offset);
        offset += el.length;
    });
    return buf;
}
class queue {
    q;
    waiters;
    closed;
    constructor(){
        this.q = [];
        this.waiters = [];
        this.closed = false;
    }
    push(obj) {
        if (this.closed) throw "closed queue";
        if (this.waiters.length > 0) {
            const waiter = this.waiters.shift();
            if (waiter) waiter(obj);
            return;
        }
        this.q.push(obj);
    }
    shift() {
        if (this.closed) return Promise.resolve(null);
        return new Promise((resolve)=>{
            if (this.q.length > 0) {
                resolve(this.q.shift() || null);
                return;
            }
            this.waiters.push(resolve);
        });
    }
    close() {
        if (this.closed) return;
        this.closed = true;
        this.waiters.forEach((waiter)=>{
            waiter(null);
        });
    }
}
class ReadBuffer {
    gotEOF;
    readBuf;
    readers;
    constructor(){
        this.readBuf = new Uint8Array(0);
        this.gotEOF = false;
        this.readers = [];
    }
    read(p) {
        return new Promise((resolve)=>{
            let tryRead = ()=>{
                if (this.readBuf === undefined) {
                    resolve(null);
                    return;
                }
                if (this.readBuf.length == 0) {
                    if (this.gotEOF) {
                        this.readBuf = undefined;
                        resolve(null);
                        return;
                    }
                    this.readers.push(tryRead);
                    return;
                }
                const data = this.readBuf.slice(0, p.length);
                this.readBuf = this.readBuf.slice(data.length);
                if (this.readBuf.length == 0 && this.gotEOF) {
                    this.readBuf = undefined;
                }
                p.set(data);
                resolve(data.length);
            };
            tryRead();
        });
    }
    write(p) {
        if (this.readBuf) {
            this.readBuf = concat([
                this.readBuf,
                p
            ], this.readBuf.length + p.length);
        }
        while(!this.readBuf || this.readBuf.length > 0){
            let reader = this.readers.shift();
            if (!reader) break;
            reader();
        }
        return Promise.resolve(p.length);
    }
    eof() {
        this.gotEOF = true;
        this.flushReaders();
    }
    close() {
        this.readBuf = undefined;
        this.flushReaders();
    }
    flushReaders() {
        while(true){
            const reader = this.readers.shift();
            if (!reader) return;
            reader();
        }
    }
}
const CloseID = 106;
var payloadSizes = new Map([
    [
        100,
        12
    ],
    [
        101,
        16
    ],
    [
        102,
        4
    ],
    [
        103,
        8
    ],
    [
        104,
        8
    ],
    [
        105,
        4
    ],
    [
        106,
        4
    ], 
]);
var debug4 = {
    messages: false,
    bytes: false
};
class Encoder {
    w;
    constructor(w3){
        this.w = w3;
    }
    async encode(m) {
        if (debug4.messages) {
            console.log("<<ENC", m);
        }
        const buf = Marshal(m);
        if (debug4.bytes) {
            console.log("<<ENC", buf);
        }
        let nwritten = 0;
        while(nwritten < buf.length){
            nwritten += await this.w.write(buf.subarray(nwritten));
        }
        return nwritten;
    }
}
class Decoder {
    r;
    constructor(r3){
        this.r = r3;
    }
    async decode() {
        const packet = await readPacket(this.r);
        if (packet === null) {
            return Promise.resolve(null);
        }
        if (debug4.bytes) {
            console.log(">>DEC", packet);
        }
        const msg = Unmarshal(packet);
        if (debug4.messages) {
            console.log(">>DEC", msg);
        }
        return msg;
    }
}
function Marshal(obj) {
    if (obj.ID === 106) {
        const m = obj;
        const data = new DataView(new ArrayBuffer(5));
        data.setUint8(0, m.ID);
        data.setUint32(1, m.channelID);
        return new Uint8Array(data.buffer);
    }
    if (obj.ID === 104) {
        const m = obj;
        const data = new DataView(new ArrayBuffer(9));
        data.setUint8(0, m.ID);
        data.setUint32(1, m.channelID);
        data.setUint32(5, m.length);
        const buf = new Uint8Array(9 + m.length);
        buf.set(new Uint8Array(data.buffer), 0);
        buf.set(m.data, 9);
        return buf;
    }
    if (obj.ID === 105) {
        const m = obj;
        const data = new DataView(new ArrayBuffer(5));
        data.setUint8(0, m.ID);
        data.setUint32(1, m.channelID);
        return new Uint8Array(data.buffer);
    }
    if (obj.ID === 100) {
        const m = obj;
        const data = new DataView(new ArrayBuffer(13));
        data.setUint8(0, m.ID);
        data.setUint32(1, m.senderID);
        data.setUint32(5, m.windowSize);
        data.setUint32(9, m.maxPacketSize);
        return new Uint8Array(data.buffer);
    }
    if (obj.ID === 101) {
        const m = obj;
        const data = new DataView(new ArrayBuffer(17));
        data.setUint8(0, m.ID);
        data.setUint32(1, m.channelID);
        data.setUint32(5, m.senderID);
        data.setUint32(9, m.windowSize);
        data.setUint32(13, m.maxPacketSize);
        return new Uint8Array(data.buffer);
    }
    if (obj.ID === 102) {
        const m = obj;
        const data = new DataView(new ArrayBuffer(5));
        data.setUint8(0, m.ID);
        data.setUint32(1, m.channelID);
        return new Uint8Array(data.buffer);
    }
    if (obj.ID === 103) {
        const m = obj;
        const data = new DataView(new ArrayBuffer(9));
        data.setUint8(0, m.ID);
        data.setUint32(1, m.channelID);
        data.setUint32(5, m.additionalBytes);
        return new Uint8Array(data.buffer);
    }
    throw `marshal of unknown type: ${obj}`;
}
async function readPacket(r4) {
    const head = new Uint8Array(1);
    const headn = await r4.read(head);
    if (headn === null) {
        return Promise.resolve(null);
    }
    const msgID = head[0];
    const size = payloadSizes.get(msgID);
    if (size === undefined || msgID < 100 || msgID > 106) {
        return Promise.reject(`bad packet: ${msgID}`);
    }
    const rest = new Uint8Array(size);
    const restn = await r4.read(rest);
    if (restn === null) {
        return Promise.reject("unexpected EOF");
    }
    if (msgID === 104) {
        const view = new DataView(rest.buffer);
        const length = view.getUint32(4);
        const data = new Uint8Array(length);
        const datan = await r4.read(data);
        if (datan === null) {
            return Promise.reject("unexpected EOF");
        }
        return concat([
            head,
            rest,
            data
        ], length + rest.length + 1);
    }
    return concat([
        head,
        rest
    ], rest.length + 1);
}
function Unmarshal(packet) {
    const data = new DataView(packet.buffer);
    switch(packet[0]){
        case 106:
            return {
                ID: packet[0],
                channelID: data.getUint32(1)
            };
        case 104:
            let dataLength = data.getUint32(5);
            let rest = new Uint8Array(packet.buffer.slice(9));
            return {
                ID: packet[0],
                channelID: data.getUint32(1),
                length: dataLength,
                data: rest
            };
        case 105:
            return {
                ID: packet[0],
                channelID: data.getUint32(1)
            };
        case 100:
            return {
                ID: packet[0],
                senderID: data.getUint32(1),
                windowSize: data.getUint32(5),
                maxPacketSize: data.getUint32(9)
            };
        case 101:
            return {
                ID: packet[0],
                channelID: data.getUint32(1),
                senderID: data.getUint32(5),
                windowSize: data.getUint32(9),
                maxPacketSize: data.getUint32(13)
            };
        case 102:
            return {
                ID: packet[0],
                channelID: data.getUint32(1)
            };
        case 103:
            return {
                ID: packet[0],
                channelID: data.getUint32(1),
                additionalBytes: data.getUint32(5)
            };
        default:
            throw `unmarshal of unknown type: ${packet[0]}`;
    }
}
const minPacketLength1 = 9;
const channelMaxPacket1 = 1 << 15;
const maxPacketLength1 = Number.MAX_VALUE;
const channelWindowSize1 = 64 * channelMaxPacket1;
class Channel1 {
    localId;
    remoteId;
    maxIncomingPayload;
    maxRemotePayload;
    session;
    ready;
    sentEOF;
    sentClose;
    remoteWin;
    myWindow;
    readBuf;
    writers;
    constructor(sess){
        this.localId = 0;
        this.remoteId = 0;
        this.maxIncomingPayload = 0;
        this.maxRemotePayload = 0;
        this.sentEOF = false;
        this.sentClose = false;
        this.remoteWin = 0;
        this.myWindow = 0;
        this.ready = new queue();
        this.session = sess;
        this.writers = [];
        this.readBuf = new ReadBuffer();
    }
    ident() {
        return this.localId;
    }
    async read(p) {
        let n = await this.readBuf.read(p);
        if (n !== null) {
            try {
                await this.adjustWindow(n);
            } catch (e) {
                if (e !== "EOF") {
                    throw e;
                }
            }
        }
        return n;
    }
    write(p) {
        if (this.sentEOF) {
            return Promise.reject("EOF");
        }
        return new Promise((resolve, reject)=>{
            let n = 0;
            const tryWrite = ()=>{
                if (this.sentEOF || this.sentClose) {
                    reject("EOF");
                    return;
                }
                if (p.byteLength == 0) {
                    resolve(n);
                    return;
                }
                const space = Math.min(this.maxRemotePayload, p.length);
                const reserved = this.reserveWindow(space);
                if (reserved == 0) {
                    this.writers.push(tryWrite);
                    return;
                }
                const toSend = p.slice(0, reserved);
                this.send({
                    ID: 104,
                    channelID: this.remoteId,
                    length: toSend.length,
                    data: toSend
                }).then(()=>{
                    n += toSend.length;
                    p = p.slice(toSend.length);
                    if (p.length == 0) {
                        resolve(n);
                        return;
                    }
                    this.writers.push(tryWrite);
                });
            };
            tryWrite();
        });
    }
    reserveWindow(win) {
        if (this.remoteWin < win) {
            win = this.remoteWin;
        }
        this.remoteWin -= win;
        return win;
    }
    addWindow(win) {
        this.remoteWin += win;
        while(this.remoteWin > 0){
            const writer = this.writers.shift();
            if (!writer) break;
            writer();
        }
    }
    async closeWrite() {
        this.sentEOF = true;
        await this.send({
            ID: 105,
            channelID: this.remoteId
        });
        this.writers.forEach((writer)=>writer()
        );
        this.writers = [];
    }
    async close() {
        if (!this.sentClose) {
            await this.send({
                ID: 106,
                channelID: this.remoteId
            });
            this.sentClose = true;
            while(await this.ready.shift() !== null){
            }
            return;
        }
        this.shutdown();
    }
    shutdown() {
        this.readBuf.close();
        this.writers.forEach((writer)=>writer()
        );
        this.ready.close();
        this.session.rmCh(this.localId);
    }
    async adjustWindow(n) {
        this.myWindow += n;
        await this.send({
            ID: 103,
            channelID: this.remoteId,
            additionalBytes: n
        });
    }
    send(msg) {
        if (this.sentClose) {
            throw "EOF";
        }
        this.sentClose = msg.ID === CloseID;
        return this.session.enc.encode(msg);
    }
    handle(msg) {
        if (msg.ID === 104) {
            this.handleData(msg);
            return;
        }
        if (msg.ID === 106) {
            this.close();
            return;
        }
        if (msg.ID === 105) {
            this.readBuf.eof();
        }
        if (msg.ID === 102) {
            this.session.rmCh(msg.channelID);
            this.ready.push(false);
            return;
        }
        if (msg.ID === 101) {
            if (msg.maxPacketSize < 9 || msg.maxPacketSize > maxPacketLength1) {
                throw "invalid max packet size";
            }
            this.remoteId = msg.senderID;
            this.maxRemotePayload = msg.maxPacketSize;
            this.addWindow(msg.windowSize);
            this.ready.push(true);
            return;
        }
        if (msg.ID === 103) {
            this.addWindow(msg.additionalBytes);
        }
    }
    handleData(msg) {
        if (msg.length > this.maxIncomingPayload) {
            throw "incoming packet exceeds maximum payload size";
        }
        if (this.myWindow < msg.length) {
            throw "remote side wrote too much";
        }
        this.myWindow -= msg.length;
        this.readBuf.write(msg.data);
    }
}
export { Channel1 as Channel };
class Session1 {
    conn;
    channels;
    incoming;
    enc;
    dec;
    done;
    constructor(conn){
        this.conn = conn;
        this.enc = new Encoder(conn);
        this.dec = new Decoder(conn);
        this.channels = [];
        this.incoming = new queue();
        this.done = this.loop();
    }
    async open() {
        const ch1 = this.newChannel();
        ch1.maxIncomingPayload = channelMaxPacket1;
        await this.enc.encode({
            ID: 100,
            windowSize: ch1.myWindow,
            maxPacketSize: ch1.maxIncomingPayload,
            senderID: ch1.localId
        });
        if (await ch1.ready.shift()) {
            return ch1;
        }
        throw "failed to open";
    }
    accept() {
        return this.incoming.shift();
    }
    async close() {
        for (const ids of Object.keys(this.channels)){
            const id = parseInt(ids);
            if (this.channels[id] !== undefined) {
                this.channels[id].shutdown();
            }
        }
        this.conn.close();
        await this.done;
    }
    async loop() {
        try {
            while(true){
                const msg = await this.dec.decode();
                if (msg === null) {
                    this.close();
                    return;
                }
                if (msg.ID === 100) {
                    await this.handleOpen(msg);
                    continue;
                }
                const cmsg = msg;
                const ch1 = this.getCh(cmsg.channelID);
                if (ch1 === undefined) {
                    throw `invalid channel (${cmsg.channelID}) on op ${cmsg.ID}`;
                }
                await ch1.handle(cmsg);
            }
        } catch (e) {
            throw new Error(`session loop: ${e}`);
        }
    }
    async handleOpen(msg) {
        if (msg.maxPacketSize < 9 || msg.maxPacketSize > maxPacketLength1) {
            await this.enc.encode({
                ID: 102,
                channelID: msg.senderID
            });
            return;
        }
        const c = this.newChannel();
        c.remoteId = msg.senderID;
        c.maxRemotePayload = msg.maxPacketSize;
        c.remoteWin = msg.windowSize;
        c.maxIncomingPayload = channelMaxPacket1;
        this.incoming.push(c);
        await this.enc.encode({
            ID: 101,
            channelID: c.remoteId,
            senderID: c.localId,
            windowSize: c.myWindow,
            maxPacketSize: c.maxIncomingPayload
        });
    }
    newChannel() {
        const ch1 = new Channel1(this);
        ch1.remoteWin = 0;
        ch1.myWindow = channelWindowSize1;
        ch1.localId = this.addCh(ch1);
        return ch1;
    }
    getCh(id) {
        const ch1 = this.channels[id];
        if (ch1 && ch1.localId !== id) {
            console.log("bad ids:", id, ch1.localId, ch1.remoteId);
        }
        return ch1;
    }
    addCh(ch) {
        this.channels.forEach((v, i)=>{
            if (v === undefined) {
                this.channels[i] = ch;
                return i;
            }
        });
        this.channels.push(ch);
        return this.channels.length - 1;
    }
    rmCh(id) {
        delete this.channels[id];
    }
}
export { minPacketLength1 as minPacketLength };
export { maxPacketLength1 as maxPacketLength };
export { Session1 as Session };
export { channelMaxPacket1 as channelMaxPacket };
export { channelWindowSize1 as channelWindowSize };
function connect2(addr, onclose) {
    return new Promise((resolve)=>{
        const socket = new WebSocket(addr);
        socket.onopen = ()=>resolve(new Conn(socket))
        ;
        if (onclose) socket.onclose = onclose;
    });
}
class Conn {
    ws;
    waiters;
    chunks;
    isClosed;
    constructor(ws){
        this.isClosed = false;
        this.waiters = [];
        this.chunks = [];
        this.ws = ws;
        this.ws.binaryType = "arraybuffer";
        this.ws.onmessage = (event)=>{
            const chunk = new Uint8Array(event.data);
            this.chunks.push(chunk);
            if (this.waiters.length > 0) {
                const waiter = this.waiters.shift();
                if (waiter) waiter();
            }
        };
        const onclose = this.ws.onclose;
        this.ws.onclose = (e)=>{
            if (onclose) onclose.bind(this.ws)(e);
            this.close();
        };
    }
    read(p) {
        return new Promise((resolve)=>{
            var tryRead = ()=>{
                if (this.isClosed) {
                    resolve(null);
                    return;
                }
                if (this.chunks.length === 0) {
                    this.waiters.push(tryRead);
                    return;
                }
                let written = 0;
                while(written < p.length){
                    const chunk = this.chunks.shift();
                    if (chunk === null || chunk === undefined) {
                        resolve(null);
                        return;
                    }
                    const buf = chunk.slice(0, p.length - written);
                    p.set(buf, written);
                    written += buf.length;
                    if (chunk.length > buf.length) {
                        const restchunk = chunk.slice(buf.length);
                        this.chunks.unshift(restchunk);
                    }
                }
                resolve(written);
                return;
            };
            tryRead();
        });
    }
    write(p) {
        this.ws.send(p);
        return Promise.resolve(p.byteLength);
    }
    close() {
        if (this.isClosed) return;
        this.isClosed = true;
        this.waiters.forEach((waiter)=>waiter()
        );
        this.ws.close();
    }
}
const mod = function() {
    return {
        connect: connect2,
        Conn: Conn
    };
}();
var options1 = {
    transport: mod
};
async function connect1(addr, codec7) {
    const conn1 = await options1.transport.connect(addr);
    const sess1 = new Session1(conn1);
    return new Peer1(sess1, codec7);
}
export { options1 as options,  };
export { connect1 as connect };
