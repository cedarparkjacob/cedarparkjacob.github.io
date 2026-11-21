#!/usr/bin/env python3
"""Build a static English/Japanese Pokémon TCG catalog from TCGdex set endpoints."""
import concurrent.futures, json, pathlib, time, urllib.request
from datetime import datetime, timezone
from urllib.parse import quote
from urllib.error import HTTPError

API = "https://api.tcgdex.net/v2"
LANGUAGES = ("en", "ja")
OUT = pathlib.Path("pokecards/data/catalog.json")
HEADERS = {"User-Agent": "Ludden-PokeCards-Catalog/1.1"}

def get_json(url, attempts=5):
    last = None
    for attempt in range(attempts):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=35) as response:
                return json.loads(response.read().decode("utf-8"))
        except Exception as exc:
            last = exc
            time.sleep(min(2 ** attempt, 12))
    raise RuntimeError(f"Failed to fetch {url}: {last}")

def category(value):
    value = (value or "").lower()
    return "pokemon" if value == "pokemon" else "trainer" if value == "trainer" else "energy"

def build_language(lang):
    print(f"Loading {lang} set index…", flush=True)
    set_index = get_json(f"{API}/{lang}/sets")
    sets = []
    brief_cards = []
    for item in set_index:
        set_id = item["id"]
        try:
            detail = get_json(f"{API}/{lang}/sets/{quote(set_id, safe='')}")
        except HTTPError as exc:
            if exc.code == 404:
                print(f"{lang}: skipping unavailable set endpoint {set_id}", flush=True)
                continue
            raise
        sets.append({
            "code": f"{lang}:{set_id}",
            "source_id": set_id,
            "name": detail.get("name") or item.get("name") or set_id,
            "language": lang,
            "release_date": detail.get("releaseDate"),
            "logo": detail.get("logo"),
            "symbol": detail.get("symbol"),
            "is_promo": "promo" in (detail.get("name") or "").lower()
        })
        for card in detail.get("cards", []):
            brief_cards.append((lang, set_id, card.get("id")))
    print(f"{lang}: {len(sets)} sets, {len(brief_cards)} cards; loading card details…", flush=True)
    def load_one(task):
        language, set_id, card_id = task
        if not card_id:
            return None
        data = get_json(f"{API}/{language}/cards/{quote(card_id, safe='')}")
        image = data.get("image") or ""
        return {
            "id": f"{language}:{data.get('id') or card_id}",
            "source_id": data.get("id") or card_id,
            "language": language,
            "name": data.get("name") or card_id,
            "image": image.rstrip("/") + "/high.webp" if image else "",
            "set": f"{language}:{(data.get('set') or {}).get('id') or set_id}",
            "set_name": (data.get("set") or {}).get("name") or "",
            "number_label": str(data.get("localId") or ""),
            "natdex_number": (data.get("dexId") or [None])[0],
            "card_type": category(data.get("category")),
            "rarity": data.get("rarity") or "",
            "rarity_name": data.get("rarity") or "",
            "illustrator": data.get("illustrator") or "",
            "is_foil": False,
            "is_reprint": False,
            "types": data.get("types") or [],
            "hp": data.get("hp"),
            "stage": data.get("stage"),
            "attacks": data.get("attacks") or [],
            "weaknesses": data.get("weaknesses") or [],
            "retreat": data.get("retreat"),
            "regulation_mark": data.get("regulationMark") or "",
            "suffix": data.get("suffix") or "",
            "variants": data.get("variants") or {}
        }
    cards = []
    errors = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
        futures = [pool.submit(load_one, task) for task in brief_cards]
        for i, future in enumerate(concurrent.futures.as_completed(futures), 1):
            try:
                card = future.result()
                if card:
                    cards.append(card)
            except Exception as exc:
                errors.append(str(exc))
            if i % 250 == 0:
                print(f"{lang}: {i}/{len(futures)} details processed", flush=True)
    if errors:
        print(f"{lang}: {len(errors)} card-detail requests failed; first: {errors[0]}", flush=True)
    expected = len(brief_cards)
    if not cards:
        raise RuntimeError(f"No {lang} cards were built.")
    if len(cards) < expected * 0.97:
        raise RuntimeError(f"{lang} catalog incomplete: {len(cards)}/{expected} cards loaded; refusing to publish.")
    return sets, cards

def main():
    all_sets, all_cards = [], []
    for lang in LANGUAGES:
        sets, cards = build_language(lang)
        all_sets.extend(sets)
        all_cards.extend(cards)
    order = {item["code"]: i for i, item in enumerate(all_sets)}
    all_cards.sort(key=lambda c: (order.get(c["set"], 99999), c["number_label"], c["name"]))
    ids = [card["id"] for card in all_cards]
    if len(ids) != len(set(ids)):
        raise RuntimeError("Duplicate card IDs detected.")
    payload = {
        "schema_version": 1,
        "source": "TCGdex set endpoints + individual card detail endpoints",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "sets": all_sets,
        "cards": all_cards
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Built {len(all_cards)} cards across {len(all_sets)} sets.", flush=True)

if __name__ == "__main__":
    main()
