#!/usr/bin/env python3
import json
import os
import sys

TELEGRAM_LIMIT = 4096


def esc(value: object) -> str:
    return (
        str(value)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def is_best(offer, marketplace, best):
    if not best:
        return False

    return (
        marketplace == best.get("marketplace")
        and offer.get("url") == best.get("url")
        and offer.get("price", {}).get("amount") == best.get("price", {}).get("amount")
        and offer.get("price", {}).get("currency") == best.get("price", {}).get("currency")
    )


def format_offer(offer: dict, indent: str = "    ") -> list[str]:
    price = offer.get("price") or {}
    title = esc(offer.get("source") or offer.get("title") or "Offer")
    amount = esc(price.get("amount", "?"))
    currency = esc(price.get("currency", ""))
    url = offer.get("url")
    lines = [
        f"{indent}🔹 {title}",
        f"{indent}    💰 {amount} {currency}".rstrip(),
    ]
    if url:
        lines.append(f'{indent}    🔗 <a href="{esc(url)}">Link</a>')
    return lines


def format_message(data: dict, query: str, region: str) -> str:
    best = data.get("best")
    title = esc((best or {}).get("title") or query)
    lines = [
        f"🎮 <b>{title}</b>",
        f"🌍 {esc(region)}",
        "",
    ]

    others: list[str] = []
    for source in data.get("result") or []:
        marketplace = source.get("source") or "source"
        offers = [
            offer
            for offer in source.get("data") or []
            if not is_best(offer, marketplace, best)
        ]
        if not offers:
            continue

        others.append(f"📦 <b>{esc(marketplace)}</b>")
        for offer in offers:
            others.extend(format_offer(offer))
        others.append("")

    if others:
        lines.append("📋 ALL OFFERS")
        lines.extend(others)
    else:
        lines.append("📋 ALL OFFERS")
        lines.append("    — none")
        lines.append("")

    if not best:
        lines.append("😕 No best offer")
        return "\n".join(lines).strip()

    price = best.get("price") or {}
    shop = " / ".join(
        part
        for part in (best.get("marketplace"), best.get("source"))
        if part
    )
    lines.extend(
        [
            "━━━━━━━━━━━━",
            "🏆 <b>BEST OFFER</b>",
            f"    💰 <b>{esc(price.get('amount', '?'))} {esc(price.get('currency', ''))}</b>".rstrip(),
            f"    🏪 {esc(shop)}",
        ]
    )
    if best.get("url"):
        lines.append(f'    🔗 <a href="{esc(best["url"])}">Link</a>')

    text = "\n".join(lines).strip()
    if len(text) <= TELEGRAM_LIMIT:
        return text

    return text[: TELEGRAM_LIMIT - 1] + "…"


def main() -> None:
    data = json.loads(sys.stdin.read())
    print(
        format_message(
            data,
            os.environ.get("QUERY", ""),
            os.environ.get("REGION", ""),
        )
    )


if __name__ == "__main__":
    main()
