// twitch.js
// STREAMER MODE: Twitch chat votes on your upgrade cards.
//   * Read-only and ANONYMOUS: tmi.js joins the channel as a guest ("justinfan"). No login, no
//     token, no secrets; the game never posts in chat and never shows chat messages on screen.
//   * When the upgrade picker opens, viewers type !1, !2 or !3. One vote per viewer (they can
//     change it). A tally bar fills on each card and a 15 s timer runs. When it ends the most-voted
//     card is picked (ties: the earlier card). The streamer can still pick a card themselves at any time.
//   * With no votes at all, nothing is auto-picked: the streamer picks as normal.
// Default channel: CalebGCameron (change it in the Streamer Mode panel; saved on this device).
const $ = (id) => document.getElementById(id);
const KEY = 'coreburn-twitch';
export const VOTE_SECONDS = 15;

export class Twitch {
  constructor() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { saved = {}; }
    this.channel = saved.channel || 'CalebGCameron';
    this.enabled = !!saved.enabled;
    this.client = null;
    this.status = 'off'; // 'off' | 'connecting' | 'live' | 'error'
    this.vote = null;
    this.chip = $('tw-chip');
    if (this.enabled) this.connect();
    this.renderChip();
  }

  save() { localStorage.setItem(KEY, JSON.stringify({ channel: this.channel, enabled: this.enabled })); }

  static cleanChannel(s) { return String(s || '').trim().replace(/^#/, '').replace(/^https?:\/\/(www\.)?twitch\.tv\//i, '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 25); }

  async connect() {
    this.disconnect();
    const ch = Twitch.cleanChannel(this.channel);
    if (!ch) return;
    this.status = 'connecting'; this.renderChip();
    try {
      const { default: tmi } = await import('./vendor/tmi.esm.js?v=1.33.0-p5c3'); // only loaded when Streamer Mode is on
      const client = this.client = new tmi.Client({ channels: [ch], connection: { reconnect: true, secure: true } });
      client.on('message', (_c, tags, msg, self) => { if (!self) this.onChat(tags, msg); });
      client.on('connected', () => { this.status = 'live'; this.renderChip(); });
      client.on('disconnected', () => { if (this.client === client) { this.status = 'connecting'; this.renderChip(); } });
      await client.connect();
    } catch (err) {
      console.warn('[twitch] could not connect', err);
      this.status = 'error'; this.renderChip();
    }
  }

  disconnect() {
    if (this.client) { const c = this.client; this.client = null; c.disconnect().catch(() => {}); }
    this.status = 'off'; this.renderChip();
  }

  setEnabled(on, channel = this.channel) {
    this.enabled = on; this.channel = Twitch.cleanChannel(channel) || 'CalebGCameron';
    this.save();
    if (on) this.connect(); else this.disconnect();
  }

  get active() { return this.enabled && this.status === 'live'; }

  renderChip() {
    if (!this.chip) return;
    this.chip.classList.toggle('hidden', !this.enabled);
    this.chip.dataset.status = this.status;
    this.chip.textContent = `TWITCH #${Twitch.cleanChannel(this.channel).toLowerCase()} · ${{ live: 'chat votes on', connecting: 'connecting…', error: 'offline', off: 'off' }[this.status]}`;
  }

  // chat line: only "!1" / "!2" / "!3" (optionally followed by text) count
  onChat(tags, msg) {
    if (!this.vote) return;
    const m = /^\s*!([1-3])\b/.exec(msg);
    if (!m) return;
    const i = Number(m[1]) - 1;
    if (i >= this.vote.count) return;
    const who = tags['user-id'] || tags.username || Math.random();
    this.vote.ballots.set(who, i);
    this.renderVote();
  }

  // The picker opened: start a vote over its cards. onWinner(index) is called when time runs out.
  startVote(count, onWinner) {
    if (!this.active) return; // only while actually connected to chat
    this.vote = { count, ballots: new Map(), left: VOTE_SECONDS, onWinner };
    const box = $('tw-vote');
    box.classList.remove('hidden');
    $('upgrade-cards').classList.add('voting');
    document.querySelectorAll('#upgrade-cards .ucard').forEach((card, i) => {
      const bar = document.createElement('div');
      bar.className = 'tw-tally';
      bar.innerHTML = `<i></i><span>!${i + 1} · 0</span>`;
      card.appendChild(bar);
    });
    this.renderVote();
  }

  // real seconds (called every frame while the picker is open)
  update(dt) {
    const v = this.vote;
    if (!v) return;
    v.left -= dt;
    if (v.left <= 0) {
      const tally = this.tally();
      const total = tally.reduce((a, b) => a + b, 0);
      if (total > 0) {
        const win = tally.indexOf(Math.max(...tally));
        this.endVote();
        v.onWinner(win);
        return;
      }
      v.left = 0; // no votes: wait for the streamer
    }
    this.renderVote();
  }

  tally() {
    const t = new Array(this.vote.count).fill(0);
    for (const i of this.vote.ballots.values()) t[i]++;
    return t;
  }

  renderVote() {
    const v = this.vote;
    if (!v) return;
    const tally = this.tally(), total = tally.reduce((a, b) => a + b, 0);
    const secs = Math.ceil(v.left);
    if (v.shownSecs !== secs || v.shownTotal !== total) {
      v.shownSecs = secs; v.shownTotal = total;
      $('tw-vote').textContent = total === 0 && v.left <= 0
        ? 'CHAT: no votes, streamer picks · type !1 !2 or !3'
        : `CHAT VOTE · type !1 !2 or !3 · ${secs}s · ${total} vote${total === 1 ? '' : 's'}`;
    }
    const lead = Math.max(...tally);
    document.querySelectorAll('#upgrade-cards .tw-tally').forEach((el, i) => {
      el.querySelector('i').style.width = `${total ? (tally[i] / total) * 100 : 0}%`;
      el.querySelector('span').textContent = `!${i + 1} · ${tally[i]}`;
      el.classList.toggle('lead', total > 0 && tally[i] === lead);
    });
  }

  endVote() {
    this.vote = null;
    $('tw-vote').classList.add('hidden');
    $('upgrade-cards').classList.remove('voting');
    document.querySelectorAll('#upgrade-cards .tw-tally').forEach((el) => el.remove());
  }
}
