# Keywise

Backend service-script that looks up digital game prices on the internet and sends the result to a Telegram chat.

It asks CheapShark, GG.deals, and IsThereAnyDeal, picks the best offer for the region, and posts a formatted message to the chat configured in `.env.local`. See [SOURCES.md](SOURCES.md) for APIs, keys, and regions.

```
./scripts/search.sh "<game>" [region]
        │
        ▼
  start local HTTP API
        │
        ▼
  fetch prices from the web
        │
        ▼
  send message to Telegram
        │
        ▼
  stop the server
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

CheapShark works without a key. Missing GG.deals or ITAD keys skip that source instead of failing the request. Telegram delivery needs both `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`.

## Run

```bash
./scripts/search.sh "elden ring" pl
```

The script starts the backend, calls `/search`, sends `best` plus the other offers to Telegram, then stops the process. `region` is optional and defaults to `pl`.

Known regions: `au`, `be`, `br`, `ca`, `ch`, `de`, `dk`, `es`, `eu`, `fi`, `fr`, `gb`, `ie`, `it`, `nl`, `no`, `pl`, `se`, `us`. CheapShark always returns USD; GG.deals and IsThereAnyDeal use the region.

Do not use `yarn search` — that is a Yarn builtin. To go through Yarn:

```bash
yarn run search "elden ring" pl
```

## HTTP API

The same backend can stay up for local calls:

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

```bash
yarn build
yarn start:prod
```

```bash
yarn test
yarn test:e2e
```

## License

[MIT](LICENSE) © Aliaksei Malinouski
