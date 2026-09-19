# Keywise

HTTP API that compares digital game prices across CheapShark, GG.deals, and IsThereAnyDeal and returns `{ result, best }`.

The [frontend](https://github.com/AliakseiMalinouski/keywise_frontend) calls this API from the browser. CORS is enabled. See [SOURCES.md](SOURCES.md) for APIs, keys, and regions.

A local helper script can still start the server, call `/search`, and post the result to Telegram.

```
GET /search?q=<game>&region=<code>
        │
        ▼
  CheapShark + GG.deals + IsThereAnyDeal
        │
        ▼
  { result, best }
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
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

CheapShark works without a key. Missing GG.deals or ITAD keys skip that source instead of failing the request. Telegram delivery needs both `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`. Those Telegram variables are only used by `scripts/search.sh`, not by the HTTP API.

## HTTP API

```bash
yarn start:dev
```

```
GET /search?q=<game>&region=<code>
```

`q` is required. `region` is optional and defaults to `pl`. The response is `{ result, best }`. `result` is one block per source. `best` is the cheapest offer in the region currency (`pl` → PLN), or `null` if every source is empty.

```bash
curl "http://localhost:3000/search?q=elden%20ring&region=pl"
```

The server listens on `PORT` or `3000`.

Known regions: `au`, `be`, `br`, `ca`, `ch`, `de`, `dk`, `es`, `eu`, `fi`, `fr`, `gb`, `ie`, `it`, `nl`, `no`, `pl`, `se`, `us`. CheapShark always returns USD; GG.deals and IsThereAnyDeal use the region.

```bash
yarn build
yarn start:prod
```

```bash
yarn test
yarn test:e2e
```

Production is deployed on Vercel as a NestJS function. Set `GGDEALS_API_KEY` and `IS_THERE_ANY_DEAL_API_KEY` in the project env. Do not set Telegram keys there unless you add Telegram to the server.

## Telegram script (optional)

```bash
./scripts/search.sh "elden ring" pl
```

The script starts the backend, calls `/search`, sends `best` plus the other offers to Telegram, then stops the process. `region` is optional and defaults to `pl`.

Do not use `yarn search` — that is a Yarn builtin. To go through Yarn:

```bash
yarn run search "elden ring" pl
```

### Desktop file (macOS)

Create a file on the Desktop, for example `Keywise.command`. Put this template in it, set `cd` to your local clone, and set the region at the end (`pl`, `us`, …):

```bash
#!/bin/bash
cd /path/to/keywise || exit 1

GAME="$(osascript -e 'Tell application "System Events" to display dialog "Game:" default answer "elden ring"' -e 'text returned of result')"
[[ -n "$GAME" ]] || exit 0

./scripts/search.sh "$GAME" pl
```

Make it executable and double-click it:

```bash
chmod +x ~/Desktop/Keywise.command
```

A dialog asks for the game name, then the script starts the backend, sends the result to Telegram, and stops.

## License

[MIT](LICENSE) © Aliaksei Malinouski
