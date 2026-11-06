"""Refresh data/publications.json from Prof. Chirodeep Bakli's public ORCID record.

ORCID gives titles, venues, years and DOIs; for records whose author list is missing in ORCID,
the authors (and volume/issue/pages) are filled in from Crossref by DOI. Standard library only.

Usage (from the repository root):
    python3 tools/update_publications.py      # writes data/publications.json
    python3 tools/build.py                    # regenerates the HTML pages
"""
import json, re, time, unicodedata, urllib.request, urllib.parse, pathlib

ORCID = "0000-0002-5882-143X"
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "publications.json"
UA = "tensorelab-website-builder/1.0 (https://tensorelab.github.io)"
FIXES = {k: v for k, v in json.loads((ROOT / "data" / "publication_fixes.json").read_text()).items()
         if not k.startswith("_")}


def get_json(url, accept="application/json"):
    req = urllib.request.Request(url, headers={"Accept": accept, "User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def norm(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def clean(s):
    s = re.sub(r"<[^>]+>", "", s or "")            # Crossref titles sometimes carry <i>/<sub> tags
    return re.sub(r"\s+", " ", s).strip()


def crossref(doi):
    try:
        m = get_json("https://api.crossref.org/works/" + urllib.parse.quote(doi))["message"]
    except Exception as e:
        print(f"  crossref failed for {doi}: {e}")
        return {}
    authors = []
    for a in m.get("author", []):
        n = " ".join(x for x in (a.get("given"), a.get("family")) if x) or a.get("name", "")
        if n:
            authors.append(n)
    return {"authors": authors, "volume": m.get("volume"), "issue": m.get("issue"),
            "pages": m.get("page") or m.get("article-number"),
            "venue": (m.get("container-title") or [None])[0]}


def main():
    groups = get_json(f"https://pub.orcid.org/v3.0/{ORCID}/works")["group"]
    codes = [str(g["work-summary"][0]["put-code"]) for g in groups]
    works = []
    for i in range(0, len(codes), 100):
        works += [b["work"] for b in get_json(f"https://pub.orcid.org/v3.0/{ORCID}/works/" + ",".join(codes[i:i + 100]))["bulk"]]
    pubs, seen = [], set()
    for w in works:
        title = clean(w["title"]["title"]["value"])
        key = norm(title)
        if key in seen:
            continue
        seen.add(key)
        doi = next((x["external-id-value"] for x in (w.get("external-ids") or {}).get("external-id", [])
                    if x["external-id-type"] == "doi"), None)
        url = (w.get("url") or {}).get("value")
        d = w.get("publication-date") or {}
        year = int(d["year"]["value"]) if d.get("year") else None
        authors = [c["credit-name"]["value"] for c in (w.get("contributors") or {}).get("contributor", [])
                   if c.get("credit-name")]
        p = {"title": title, "authors": authors, "year": year,
             "venue": clean((w.get("journal-title") or {}).get("value")),
             "type": {"journal-article": "journal", "conference-paper": "conference"}.get(w["type"], "other"),
             "doi": doi.lower() if doi else None, "url": url}
        if doi:
            cr = crossref(doi)
            time.sleep(0.2)
            if not p["authors"]:
                p["authors"] = cr.get("authors", [])
            p["venue"] = p["venue"] or clean(cr.get("venue"))
            for k in ("volume", "issue", "pages"):
                p[k] = cr.get(k)
        # type from the venue: proceedings -> conference, arXiv -> preprint
        v = (p["venue"] or "").lower()
        if "arxiv" in v:
            p["type"] = "preprint"
        elif any(k in v for k in ("proceedings", "conference", "conf.")):
            p["type"] = "conference"
        for start, fix in FIXES.items():
            if title.lower().startswith(start.lower()):
                p.update(fix)
        pubs.append(p)
    pubs.sort(key=lambda p: (-(p["year"] or 0), p["title"].lower()))
    if OUT.exists() and json.loads(OUT.read_text()).get("publications") == pubs:
        print(f"{len(pubs)} publications, unchanged")
        return
    OUT.write_text(json.dumps({"source": f"https://orcid.org/{ORCID}", "updated": time.strftime("%Y-%m-%d"),
                               "publications": pubs}, indent=1, ensure_ascii=False))
    print(f"{len(pubs)} publications -> {OUT}  (no authors: {sum(not p['authors'] for p in pubs)})")


if __name__ == "__main__":
    main()
