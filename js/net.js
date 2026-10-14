// net.js
// Online co-op networking: WebRTC peer-to-peer via PeerJS, with no game server of our own.
//
//   - The HOST opens a "room": a PeerJS id like coreburn-r1-QZKM. The 4 letters are the room code.
//   - FRIENDS connect to that id. The free public PeerJS server (0.peerjs.com) only introduces the
//     two browsers to each other (signalling); after that the game data flows directly between
//     the devices over a WebRTC data channel. Google's public STUN servers help them find a route
//     through home routers (NAT).
//   - No accounts, no keys, no paid services. Limits: see README (co-op section).
//
// Messages are small JSON objects with a `t` (type) field. See coop.js for what they mean.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O (they look like 1 and 0)
const PREFIX = 'coreburn-r1-';
export const MAX_PLAYERS = 4;
const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] };
const TIMEOUT = 12000;

// Optional override for testing with your own PeerJS server, e.g. in the browser console:
//   localStorage.setItem('coreburn-peer', JSON.stringify({ host: 'localhost', port: 9000, path: '/', secure: false }))
function peerOptions() {
  let custom = {};
  try { custom = JSON.parse(localStorage.getItem('coreburn-peer') || '{}') || {}; } catch { custom = {}; }
  return { ...custom, config: ICE, debug: 0 };
}

let loading = null;
function loadPeerJS() {
  if (window.Peer) return Promise.resolve(window.Peer);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = new URL('./vendor/peerjs.min.js', import.meta.url).href;
      s.onload = () => (window.Peer ? resolve(window.Peer) : reject(new Error('Networking failed to load')));
      s.onerror = () => { loading = null; reject(new Error('Networking failed to load')); };
      document.head.appendChild(s);
    });
  }
  return loading;
}

export const normalizeCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
const randomCode = () => Array.from({ length: 4 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');

function friendlyError(err) {
  const type = err && err.type;
  if (type === 'peer-unavailable') return 'Room not found. Check the code.';
  if (type === 'network' || type === 'server-error' || type === 'socket-error' || type === 'socket-closed') return 'Can\'t reach the co-op server. Check your connection.';
  if (type === 'browser-incompatible') return 'This browser doesn\'t support online co-op.';
  return (err && err.message) || 'Connection failed';
}

// ---------- Host ----------
export class NetHost {
  constructor() {
    this.conns = new Set();
    this.onJoin = () => {};    // (conn)
    this.onMessage = () => {}; // (conn, msg)
    this.onLeave = () => {};   // (conn)
    this.onError = () => {};   // (message)
  }

  async open() {
    const Peer = await loadPeerJS();
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = randomCode();
      try {
        this.peer = await new Promise((resolve, reject) => {
          const peer = new Peer(PREFIX + code, peerOptions());
          const timer = setTimeout(() => { peer.destroy(); reject({ type: 'network' }); }, TIMEOUT);
          peer.once('open', () => { clearTimeout(timer); resolve(peer); });
          peer.once('error', (e) => { clearTimeout(timer); peer.destroy(); reject(e); });
        });
        this.code = code;
        break;
      } catch (e) {
        if (e && e.type === 'unavailable-id') continue; // code already in use: roll another
        throw new Error(friendlyError(e));
      }
    }
    if (!this.peer) throw new Error('Could not create a room, try again');
    this.peer.on('connection', (conn) => this.accept(conn));
    this.peer.on('error', (e) => { if (e.type !== 'peer-unavailable') this.onError(friendlyError(e)); });
    // lost the signalling server: existing players stay connected, but nobody new can join
    this.peer.on('disconnected', () => { if (!this.closed) try { this.peer.reconnect(); } catch { /* ignore */ } });
    return this.code;
  }

  accept(conn) {
    conn.on('open', () => {
      if (this.closed || this.conns.size >= MAX_PLAYERS - 1 || this.locked) {
        conn.send({ t: 'bye', reason: this.locked ? 'That game has already started.' : 'That room is full (4 players max).' });
        setTimeout(() => conn.close(), 300);
        return;
      }
      this.conns.add(conn);
      conn.lastSeen = performance.now();
      this.onJoin(conn);
    });
    conn.on('data', (msg) => { conn.lastSeen = performance.now(); if (this.conns.has(conn) && msg && msg.t) this.onMessage(conn, msg); });
    const gone = () => { if (this.conns.delete(conn)) this.onLeave(conn); };
    conn.on('close', gone);
    conn.on('error', gone);
  }

  // drop players we haven't heard from for a while (closed tab, lost signal)
  checkTimeouts(ms = 8000) {
    const now = performance.now();
    for (const c of [...this.conns]) if (now - c.lastSeen > ms) { this.conns.delete(c); try { c.close(); } catch { /* ignore */ } this.onLeave(c); }
  }

  send(conn, msg) { if (conn.open) try { conn.send(msg); } catch { /* ignore */ } }
  broadcast(msg) { for (const c of this.conns) this.send(c, msg); }

  close(reason = 'The host closed the room.') {
    if (this.closed) return;
    this.closed = true;
    this.broadcast({ t: 'bye', reason });
    setTimeout(() => { try { this.peer && this.peer.destroy(); } catch { /* ignore */ } }, 300);
  }
}

// ---------- Client ----------
export class NetClient {
  constructor() {
    this.onMessage = () => {}; // (msg)
    this.onClose = () => {};   // (reason)
  }

  async join(code) {
    const Peer = await loadPeerJS();
    code = normalizeCode(code);
    if (code.length !== 4) throw new Error('Room codes are 4 letters.');
    this.peer = await new Promise((resolve, reject) => {
      const peer = new Peer(peerOptions());
      const timer = setTimeout(() => { peer.destroy(); reject(new Error(friendlyError({ type: 'network' }))); }, TIMEOUT);
      peer.once('open', () => { clearTimeout(timer); resolve(peer); });
      peer.once('error', (e) => { clearTimeout(timer); peer.destroy(); reject(new Error(friendlyError(e))); });
    });
    this.conn = await new Promise((resolve, reject) => {
      const conn = this.peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
      const timer = setTimeout(() => reject(new Error('Could not connect to that room (it may be behind a strict firewall).')), TIMEOUT);
      conn.once('open', () => { clearTimeout(timer); resolve(conn); });
      this.peer.once('error', (e) => { clearTimeout(timer); reject(new Error(friendlyError(e))); });
    });
    this.code = code;
    this.lastSeen = performance.now();
    this.conn.on('data', (msg) => {
      this.lastSeen = performance.now();
      if (msg && msg.t === 'bye') { this.close(msg.reason); return; }
      if (msg && msg.t) this.onMessage(msg);
    });
    this.conn.on('close', () => this.close('The host left the room.'));
    this.conn.on('error', () => this.close('Lost connection to the host.'));
    return code;
  }

  checkTimeout(ms = 8000) { if (!this.closed && performance.now() - this.lastSeen > ms) this.close('Lost connection to the host.'); }

  send(msg) { if (this.conn && this.conn.open) try { this.conn.send(msg); } catch { /* ignore */ } }

  close(reason) {
    if (this.closed) return;
    this.closed = true;
    try { this.conn && this.conn.close(); } catch { /* ignore */ }
    setTimeout(() => { try { this.peer && this.peer.destroy(); } catch { /* ignore */ } }, 200);
    this.onClose(reason);
  }
}
