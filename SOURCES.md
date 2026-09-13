# Data sources

Keywise does not scrape storefronts. Each `/search` request asks these public APIs and returns `{ result, best }`. `result` is one block per source. `best` is the cheapest offer in the region currency, or `null` if every source is empty. A missing key or a failed request yields `{ "source": "...", "data": [] }` and does not fail the whole response.

## CheapShark

- Site: [cheapshark.com](https://www.cheapshark.com/)
- Docs: [apidocs.cheapshark.com](https://apidocs.cheapshark.com/)
- Auth: none
- Region: USD / US storefronts only; `region` is ignored
- Used for: title search, official-store deals, Steam App ID for GG.deals

## GG.deals

- Site: [gg.deals](https://gg.deals/)
- Docs: [gg.deals/api](https://gg.deals/api/)
- Auth: `GGDEALS_API_KEY` ([hobby API](https://gg.deals/api/), attribution required)
- Region: query `region` (default `pl`), via Prices API
- Used for: lowest official-store price and lowest keyshop price for a Steam App ID

GG.deals does not search by title. Keywise resolves the Steam App ID through CheapShark first.

## IsThereAnyDeal

- Site: [isthereanydeal.com](https://isthereanydeal.com/)
- Docs: [docs.isthereanydeal.com](https://docs.isthereanydeal.com/)
- Auth: `IS_THERE_ANY_DEAL_API_KEY` ([register an app](https://isthereanydeal.com/apps/))
- Region: query `region` mapped to an ISO country (`pl` → `PL`, `eu` → `DE`)
- Used for: title search and per-shop prices (`/games/search/v1`, `/games/prices/v3`)

OAuth client id is not used. Price endpoints need only the API key.
