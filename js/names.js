// names.js
// Leaderboard names: 3-16 characters (letters, digits, space, _ . -) and a profanity filter that
// also catches common l33t-speak and spacing tricks ("f.u.c.k", "5h1t", "fuuuck").
// The same rules are checked again on the server (supabase/leaderboard.sql).

// Word stems that are never allowed anywhere in a name (kept short and generic on purpose)
const BLOCK = ['fuck', 'fuk', 'shit', 'cunt', 'bitch', 'nigg', 'nigga', 'fag', 'retard', 'whore', 'slut', 'rape', 'nazi', 'hitler', 'kike', 'spic', 'chink', 'twat', 'wank', 'dick', 'cock', 'pussy', 'penis', 'vagina', 'porn', 'tranny', 'dyke', 'coon', 'paki', 'kys', 'asshole', 'bastard', 'molest', 'pedo'];
// Short words only blocked as a whole word ("ass" is fine inside "Assassin" or "Bass")
const WHOLE = ['ass', 'cum', 'sex', 'tit', 'tits', 'nig', 'jap', 'gay'];

const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', 9: 'g', '@': 'a', $: 's', '!': 'i', '|': 'l' };

export function normalizeName(raw) {
  return String(raw || '').replace(/[^A-Za-z0-9 _.-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
}

export function isClean(name) {
  const lower = String(name).toLowerCase();
  const leet = lower.replace(/[0-9@$!|]/g, (c) => LEET[c] || c);
  const squashed = leet.replace(/[^a-z]/g, '').replace(/(.)\1+/g, '$1'); // drop separators, collapse repeats
  const plain = leet.replace(/[^a-z]/g, '');
  if (BLOCK.some((w) => squashed.includes(w.replace(/(.)\1+/g, '$1')) || plain.includes(w))) return false;
  const words = leet.split(/[^a-z]+/).filter(Boolean);
  if (words.some((w) => WHOLE.includes(w) || WHOLE.includes(w.replace(/(.)\1+/g, '$1')))) return false;
  return true;
}

// Returns { ok, name, error }
export function checkName(raw) {
  const name = normalizeName(raw);
  if (name.length < 3) return { ok: false, name, error: 'At least 3 letters or digits' };
  if (!isClean(name)) return { ok: false, name, error: 'Please pick a different name' };
  return { ok: true, name };
}
