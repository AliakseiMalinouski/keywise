# Data sources

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

## Steam

- Site: [steampowered.com](https://store.steampowered.com/)
- Docs: [partner.steamgames.com/doc/webapi](https://partner.steamgames.com/doc/webapi)
- Auth: `STEAM_API_KEY` for `ISteamUser/ResolveVanityURL` when set
- Used for: optional `/search?steam=` wishlist lookup; Steam review summary and recent reviews in `rating`

A SteamID64 or `/profiles/{steamid}` URL is used as-is. A `/id/{name}` URL is resolved with the API key, or from the public Steam profile page if the key is missing. The wishlist itself comes from `IWishlistService/GetWishlist`, which does not need a key. The list is public-wishlist only; a private wishlist comes back empty. Titles are filled from `IStoreBrowseService/GetItems` when Steam returns them. The searched game is matched to a Steam App ID through CheapShark and marked `selected: true` when it is on the list.

For every `/search` request, Keywise resolves the game through the public store search API (`/api/storesearch/`), then loads review summary and the latest reviews through `IUserReviewsService/GetAppReviews`. `STEAM_API_KEY` is optional but raises the rate limit when set.
