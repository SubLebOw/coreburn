# Vendored libraries

- `peerjs.min.js`: [PeerJS](https://peerjs.com/) 1.5.4 (MIT licence, Copyright (c) 2015 Michelle Bu and Eric Zhang),
  taken unchanged from https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js. Used for online co-op
  (WebRTC data channels). It's only loaded when you open the CO-OP menu.

## tmi.esm.js
tmi.js 1.8.5 (MIT, see tmi.LICENSE), bundled with esbuild into one browser ES module
(`ws`/`node-fetch` stubbed: the browser's own WebSocket is used). Streamer Mode connects
anonymously (a read-only "justinfan" guest), so there are no tokens or secrets anywhere.
