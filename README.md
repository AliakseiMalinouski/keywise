# Keywise

HTTP service API that compares digital game prices across several keys marketplaces, returns `{ result, best }`. An optional `steam` profile URL or SteamID64 also returns `{ wishlist }`.

The [frontend](https://keywise-frontend.vercel.app) calls this API from the browser. CORS is enabled. See [SOURCES.md](SOURCES.md) for APIs, keys, and regions.

```
GET /search?q=<game>&region=<code>&steam=<id-or-url>
        │
        ▼
      Marketplaces
        │
        ▼
  { result, best, wishlist? }
```

## Install

Requires Node.js 24+ and Yarn 4.18.0 (pinned in the repo).

```bash
yarn install
```

Copy `.env.example` to `.env.local` and fill in the keys you have:

```bash
GGDEALS_API_KEY=
IS_THERE_ANY_DEAL_API_KEY=
STEAM_API_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

CheapShark works without a key. Missing GG.deals or ITAD keys skip that source instead of failing the request. `STEAM_API_KEY` is preferred to resolve `steamcommunity.com/id/...` vanity URLs; without it Keywise falls back to the public profile page. Telegram delivery needs both `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`. Those Telegram variables are only used by `scripts/search.sh`, not by the HTTP API.

## HTTP API

```bash
yarn start:dev
```

```
GET /search?q=<game>&region=<code>&steam=<id-or-url>
```

`q` is required. `region` is optional and defaults to `pl`. `steam` is optional: a SteamID64 or a `steamcommunity.com` profile URL. The response is `{ result, best }` and, when `steam` is set, `wishlist`. `result` is one block per source. `best` is the cheapest offer in the region currency (`pl` → PLN), or `null` if every source is empty. `wishlist` is the user's Steam wishlist; the searched game is marked `selected: true` when it appears there.

```bash
curl "http://localhost:3000/search?q=elden%20ring&region=pl"
curl "http://localhost:3000/search?q=elden%20ring&region=pl&steam=76561198012345678"
```

The server listens on `PORT` or `3000`.

Known regions: `au`, `be`, `br`, `ca`, `ch`, `de`, `dk`, `es`, `eu`, `fi`, `fr`, `gb`, `ie`, `it`, `nl`, `no`, `pl`, `se`, `us`

```bash
yarn build
yarn start:prod
```

```bash
yarn test
yarn test:e2e
```

Production is deployed on Vercel as a NestJS service. Set `GGDEALS_API_KEY`, `IS_THERE_ANY_DEAL_API_KEY`, and `STEAM_API_KEY` in the project env. 

## License

[MIT](LICENSE) © Aliaksei Malinouski
