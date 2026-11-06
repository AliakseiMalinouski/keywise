# Keywise

HTTP API that compares digital PC game key prices across CheapShark, GG.deals, and IsThereAnyDeal, and attaches Steam review data for the matched title. The [frontend](https://www.keywise.online/) calls this API from the browser. CORS is enabled. Marketplace details are in [SOURCES.md](SOURCES.md).

```
GET /search?q=<game>&region=<code>&steam=<id-or-url>&reviewLang=<codes>
        │
        ▼
  CheapShark · GG.deals · IsThereAnyDeal · Steam
        │
        ▼
  { result, best, rating, image?, wishlist? }
```

## Search

`q` is the game title and is required. `region` selects the storefront and defaults to `pl`. `steam` is optional: a SteamID64 or a `steamcommunity.com` profile URL. `reviewLang` is optional and filters Steam reviews in `rating.reviews`. It accepts one Steam language code (`english`, `russian`, `polish`, …), several comma-separated codes (`english,polish`), or `all`. Unknown codes are ignored. If none of the given codes are valid, reviews fall back to `all`.

The response is `{ result, best, rating, image? }`. When `steam` is set, it also includes `wishlist`.

`result` is one block per marketplace. A source that cannot be queried is left out of `result`; the rest of the search still returns. `best` is the cheapest offer among the returned blocks, priced in the region currency (`pl` → PLN), or `null` when every source is empty. When Steam resolves the game, `best.image` is its library hero. CheapShark prices stay in USD and ignore `region`. GG.deals and IsThereAnyDeal follow the requested storefront (`eu` is priced as Germany).

`rating` is the Steam review summary and recent reviews for the matched game, or `null` when Steam cannot resolve the title. `image` is a Steam store capsule for that game. It is omitted when the game cannot be resolved. `wishlist` is the profile's public Steam wishlist. A private wishlist, an invalid `steam` value, or a profile Steam cannot resolve comes back as an empty list. The searched game is marked `selected: true` when it is on the list.

The same title, region, and review language reuse the last response for 5 minutes.

Known regions: `au`, `be`, `br`, `ca`, `ch`, `de`, `dk`, `es`, `eu`, `fi`, `fr`, `gb`, `ie`, `it`, `nl`, `no`, `pl`, `se`, `us`.

## License

[MIT](LICENSE) © Aliaksei Malinouski
