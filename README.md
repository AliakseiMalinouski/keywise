# Keywise

HTTP backend that compares digital game prices from CheapShark, GG.deals, and IsThereAnyDeal. See [SOURCES.md](SOURCES.md) for APIs, keys, and regions.

## API

```
GET /search?q=<game>&region=<code>
```

`q` is required. `region` is optional and defaults to `pl`. Known values: `au`, `be`, `br`, `ca`, `ch`, `de`, `dk`, `es`, `eu`, `fi`, `fr`, `gb`, `ie`, `it`, `nl`, `no`, `pl`, `se`, `us`. CheapShark always returns USD; GG.deals and IsThereAnyDeal use the region.

Example:

```bash
curl "http://localhost:3000/search?q=elden%20ring&region=pl"
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
```

CheapShark works without a key. Missing GG.deals or ITAD keys skip that source instead of failing the request.

## Local run

```bash
yarn start:dev
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
