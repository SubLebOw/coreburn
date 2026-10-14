// leaderboard-config.js
// ONLINE LEADERBOARDS are OFF until a (free) Supabase project is connected. Until then the game
// keeps leaderboards ON THIS DEVICE only, and everything else works the same.
//
// To turn them on (one time, ~5 minutes, free tier, no credit card):
//   1. Create a free account at https://supabase.com and a new project (any name/region).
//   2. In the project: SQL Editor -> New query -> paste ALL of supabase/leaderboard.sql -> Run.
//   3. Project Settings -> API: copy the "Project URL" and the "anon public" key into the two
//      fields below, set enabled: true, then release as usual.
// The anon key is a PUBLIC, read-mostly key made for browser code: the database only lets it READ
// scores and call submit_score() (which checks every score). Never put the service_role key here.
export const LEADERBOARD_CONFIG = {
  enabled: false,
  supabaseUrl: '',     // e.g. 'https://abcdefghijklm.supabase.co'
  supabaseAnonKey: '', // the "anon public" key
};
