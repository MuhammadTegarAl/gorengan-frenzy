# Hasan Frenzy

Static snake-style browser game with gorengan pickups and directional Hasan face sprites.

## Local Preview

```bash
python3 -m http.server 8765
```

Open `http://127.0.0.1:8765`.

## Deploy With GitHub + Vercel

1. Create a new GitHub repo, for example `hasan-frenzy`.
2. Push this folder to that repo.
3. In Vercel, choose **Add New Project**.
4. Import the GitHub repo.
5. Keep the framework preset as **Other**.
6. Leave build command empty.
7. Leave output directory empty.
8. Deploy.

Entry file: `index.html`

## Supabase Setup

1. Open the Supabase SQL editor.
2. Run `supabase-schema.sql`.
3. Copy your Project URL and anon public key.
4. Put them in `supabase-config.js`.

```js
window.HASAN_SUPABASE_CONFIG = {
  url: "https://YOUR_PROJECT.supabase.co",
  anonKey: "YOUR_ANON_PUBLIC_KEY"
};
```

The leaderboard stores one best score per `username + level`. The admin reset button calls a Supabase RPC and requires this password:

```text
H4sanFrenzy
```
