"""Build the TeNSorE Lab website from data/lab.json and data/publications.json.

    python3 tools/build.py          # writes index.html, research.html, people.html,
                                    # publications.html, news.html, join.html in the repo root

Edit the JSON files (or refresh publications with tools/update_publications.py), rebuild, commit, push.
Standard library only.
"""
import json, re, html, pathlib, datetime, unicodedata

ROOT = pathlib.Path(__file__).resolve().parent.parent
LAB = json.loads((ROOT / "data" / "lab.json").read_text())
PUBS = json.loads((ROOT / "data" / "publications.json").read_text())
L = LAB["lab"]
SITE = "https://tensorelab.github.io/"
TODAY = datetime.date.today()

NAV = [("index.html", "Home"), ("research.html", "Research"), ("people.html", "People"),
       ("publications.html", "Publications"), ("news.html", "News & Events"), ("join.html", "Join us")]

E = lambda s: html.escape(str(s or ""), quote=True)


def md(s):
    """**bold** and *italic* only."""
    s = E(s)
    s = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", s)
    return re.sub(r"\*(.+?)\*", r"<i>\1</i>", s)


def initials(name):
    parts = [p for p in re.sub(r"^(Dr|Prof)\.?\s+", "", name).split() if p[0].isalpha()]
    return (parts[0][0] + parts[-1][0]).upper() if len(parts) > 1 else parts[0][:2].upper()


ICONS = {
    "hex": '<path d="M12 2.8 20 7.4v9.2l-8 4.6-8-4.6V7.4z"/><path d="M12 7.5 16 9.8v4.4l-4 2.3-4-2.3V9.8z"/>',
    "flame": '<path d="M12 21c-3.9 0-6.5-2.6-6.5-6.1 0-3.1 2.2-4.9 3.4-7.3.4 1.7 1.3 2.7 2.4 3.2C11 7.2 12.4 4.6 14.9 3c-.3 2.9 3.6 5.2 3.6 10.2C18.5 17.9 16 21 12 21z"/><path d="M12 21c-1.6 0-2.7-1.1-2.7-2.6 0-1.6 1.4-2.4 1.9-3.9.9 1 2.6 1.9 2.6 3.9 0 1.5-.8 2.6-1.8 2.6z"/>',
    "wave": '<path d="M2 9c2.5 0 2.5-3 5-3s2.5 3 5 3 2.5-3 5-3 2.5 3 5 3"/><path d="M2 15c2.5 0 2.5-3 5-3s2.5 3 5 3 2.5-3 5-3 2.5 3 5 3"/><path d="M6 20h12"/>',
    "building": '<path d="M4 21V8l8-5 8 5v13"/><path d="M9 21v-5h6v5"/><path d="M8 10h2M14 10h2M8 13h2M14 13h2"/><path d="M2 21h20"/>',
    "drops": '<path d="M8 13.5c-2.2 0-4-1.7-4-3.9C4 7.3 8 3 8 3s4 4.3 4 6.6c0 2.2-1.8 3.9-4 3.9z"/><path d="M16.5 21c-2.2 0-4-1.7-4-3.9 0-2.3 4-6.6 4-6.6s4 4.3 4 6.6c0 2.2-1.8 3.9-4 3.9z"/>',
    "drop": '<path d="M12 21.5c-3.6 0-6.5-2.8-6.5-6.3C5.5 11.4 12 3 12 3s6.5 8.4 6.5 12.2c0 3.5-2.9 6.3-6.5 6.3z"/><path d="M9 15.5c0 1.6 1.3 3 3 3"/>',
    "bolt": '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    "tool": '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
    "mail": '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6 8.5 7 8.5-7"/>',
}
icon = lambda k: f'<svg viewBox="0 0 24 24" aria-hidden="true">{ICONS[k]}</svg>'

LOGO = ('<svg viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">'
        '<stop offset="0" stop-color="#0b4a52"/><stop offset="1" stop-color="#1a8a8f"/></linearGradient></defs>'
        '<rect width="32" height="32" rx="8" fill="url(#lg)"/>'
        '<path d="M6 10.5h20M6 21.5h20" stroke="#e8fbf9" stroke-width="1.8" stroke-linecap="round"/>'
        '<circle cx="10.5" cy="16" r="2.1" fill="#e8fbf9"/><circle cx="16.5" cy="14.6" r="1.5" fill="#9fe3de"/>'
        '<circle cx="21.8" cy="17" r="2.1" fill="#e8fbf9"/></svg>')

# ---------------------------------------------------------------- lab members (for author highlighting)
def _plain(s):
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()


MEMBERS = [LAB["pi"]["name"]] + [p["name"] for p in LAB["postdocs"]] + [p[0] for p in LAB["phd"]] + \
          [p["name"] for k in ("alumni_phd", "alumni_ms", "alumni_mtech") for p in LAB[k]]
MEMBER_NAMES = []          # (surname, given) in plain lowercase ascii
for n in MEMBERS:
    parts = re.sub(r"^(Dr|Prof)\.?\s+", "", n).split()
    MEMBER_NAMES.append((_plain(parts[-1]), _plain(parts[0])))
    MEMBER_NAMES.append((_plain(parts[0]), _plain(parts[-1])))   # "Patwari Aditya Shivaji" style ordering
# Initial-only matches that would wrongly pick up frequent non-member co-authors (e.g. Prof. Suman Chakraborty)
AMBIGUOUS = {("chakraborty", "s"), ("kumar", "a"), ("roy", "a"), ("roy", "r"), ("biswas", "d"), ("biswas", "p")}


def is_member(author):
    a = author.strip()
    if "," in a:                                   # "Sarkar, S." -> "S. Sarkar"
        last, first = [x.strip() for x in a.split(",", 1)]
        a = f"{first} {last}"
    parts = [p for p in re.split(r"[\s.]+", a) if p]
    if len(parts) < 2:
        return False
    sur, given = _plain(parts[-1]), _plain(parts[0])
    for s_, g_ in MEMBER_NAMES:
        if s_ != sur:
            continue
        if len(given) == 1:                        # initial only
            if g_[0] == given and (sur, given) not in AMBIGUOUS:
                return True
        elif given[:4] == g_[:4]:                  # full given name: first 4 letters (tolerates typos/spellings)
            return True
    return False


# ---------------------------------------------------------------- publications helpers
THEMES = LAB["themes"]


def _kre(k):
    k = _plain(k).strip()
    return re.compile(r"(?<![a-z0-9])" + re.escape(k) + r"(e?s)?(?![a-z0-9])")


THEME_RE = {th["id"]: [_kre(k) for k in th["keys"]] for th in THEMES}


def themes_of(p):
    t = _plain(p["title"]).replace("-", " ").replace("–", " ")
    t2 = _plain(p["title"])
    return [th["id"] for th in THEMES if any(r.search(t) or r.search(t2) for r in THEME_RE[th["id"]])]


for p in PUBS["publications"]:
    p["themes"] = themes_of(p)
TYPE_LABEL = {"journal": "Journal", "conference": "Conference", "preprint": "Preprint", "other": "Other"}


def pub_li(p, compact=False):
    au = ", ".join(f'<span class="lab">{E(a)}</span>' if is_member(a) else E(a) for a in p["authors"])
    bits = [f"<i>{E(p['venue'])}</i>" if p.get("venue") else ""]
    if p.get("volume"):
        bits.append(E(p["volume"]) + (f" ({E(p['issue'])})" if p.get("issue") else ""))
    if p.get("pages"):
        bits.append(E(p["pages"]))
    if p.get("year"):
        bits.append(str(p["year"]))
    ve = ", ".join(b for b in bits if b)
    link = f"https://doi.org/{p['doi']}" if p.get("doi") else p.get("url")
    if compact:
        return (f'<li><a href="{E(link)}">{E(p["title"])}</a> <span class="note">{E(p.get("venue"))}, {p.get("year") or ""}</span></li>'
                if link else f'<li>{E(p["title"])} <span class="note">{E(p.get("venue"))}, {p.get("year") or ""}</span></li>')
    tags = [f'<span class="tag {p["type"]}">{TYPE_LABEL[p["type"]]}</span>']
    tags += [f'<span class="tag th">{E(next(t["name"] for t in THEMES if t["id"] == i).split(" and ")[0])}</span>' for i in p["themes"]]
    if link:
        tags.append(f'<a class="doi" href="{E(link)}">{"DOI" if p.get("doi") else "Link"} ↗</a>')
    text = _plain(" ".join([p["title"], " ".join(p["authors"]), p.get("venue") or "", str(p.get("year") or ""), p.get("doi") or ""]))
    return (f'<li class="pub" data-type="{p["type"]}" data-themes="{" ".join(p["themes"])}" data-text="{E(text)}">'
            f'<div class="ti">{E(p["title"])}</div>' + (f'<div class="au">{au}</div>' if au else "") +
            f'<div class="ve">{ve}</div><div class="tags">{"".join(tags)}</div></li>')


# ---------------------------------------------------------------- page shell
def page(fname, title, desc, body):
    act = ' class="active"'
    nav = "".join(f'<a href="{h}"{act if h == fname else ""}>{E(t)}</a>' for h, t in NAV)
    full = f"{title} | {L['short']}" if fname != "index.html" else f"{L['short']} | IIT Kharagpur"
    url = SITE + ("" if fname == "index.html" else fname)
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{E(full)}</title>
<meta name="description" content="{E(desc)}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="website"><meta property="og:title" content="{E(full)}">
<meta property="og:description" content="{E(desc)}"><meta property="og:url" content="{url}">
<link rel="icon" href="images/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Source+Serif+4:ital,opsz,wght@0,8..60,500;0,8..60,600;1,8..60,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/site.css">
<script src="assets/site.js"></script>
</head>
<body>
<header class="topbar"><div class="in">
<a class="brand" href="index.html">{LOGO}<span><b>{E(L['short'])}</b><small>IIT Kharagpur</small></span></a>
<button class="menu-btn" aria-expanded="false" aria-label="Menu">Menu</button>
<nav aria-label="Main">{nav}</nav>
</div></header>
<main>
{body}
</main>
<footer><div class="wrap">
<span>{E(L['name'])} · <a href="{L['school_url']}">{E(L['school'])}</a>, <a href="{L['institute_url']}">IIT Kharagpur</a></span>
<span><a href="mailto:{L['email']}">{L['email']}</a> · Updated {TODAY.strftime('%B %Y')}</span>
</div></footer>
</body>
</html>
"""


def phead(eyebrow, h1, lead):
    return f'<div class="phead"><div class="wrap"><div class="eyebrow">{E(eyebrow)}</div><h1>{E(h1)}</h1><p>{lead}</p></div></div>'


def reveal(i):
    return f' class="card reveal" style="--d:{min(i, 8) * 60}ms"'


# ---------------------------------------------------------------- pages
def home():
    pubs = PUBS["publications"]
    yr = TODAY.year
    recent = [p for p in pubs if p["type"] == "journal"][:5]
    n_members = 1 + len(LAB["postdocs"]) + len(LAB["phd"])
    facts = [(len(pubs), "publications"), (sum(1 for p in pubs if (p["year"] or 0) >= yr - 2), f"papers since {yr - 2}"),
             (n_members, "people in the group"), (len(LAB["alumni_phd"]) + len(LAB["alumni_ms"]), "PhD & MS graduates")]
    theme_cards = "".join(
        f'<a href="research.html#{t["id"]}"{reveal(i)}><div class="ico">{icon(t["icon"])}</div><h3>{E(t["name"])}</h3>'
        f'<p>{E(t["short"])}</p><div class="n">{sum(t["id"] in p["themes"] for p in pubs)} papers →</div></a>'
        for i, t in enumerate(THEMES))
    pi = LAB["pi"]
    news = "".join(f'<li><time>{E(n["when"]) or "&nbsp;"}</time><div class="what">{md(n["text"])}</div></li>' for n in LAB["news"])
    ev = LAB["events"][0]
    news += f'<li><time>{E(ev["when"])}</time><div class="what"><b>{E(ev["title"])}</b><p>{E(ev["text"])}</p></div></li>'
    body = f"""
<div class="hero"><canvas aria-hidden="true"></canvas><div class="wrap">
<div class="eyebrow">{E(L['school'])} · IIT Kharagpur</div>
<h1>{E(L['name'])}</h1>
<p class="lead">{E(L['intro'])}</p>
<div class="cta"><a class="btn solid" href="research.html">Our research</a><a class="btn ghost" href="publications.html">Publications</a><a class="btn ghost" href="join.html">Join the lab</a></div>
<div class="facts">{"".join(f'<div><b>{n}</b><span>{E(t)}</span></div>' for n, t in facts)}</div>
</div></div>
<div class="wrap">
<section><div class="eyebrow">How we work</div><h2 class="sec">From molecules to systems</h2>
<div class="scales reveal">{"".join(f'<div><i>{i + 1}</i><b>{E(a)}</b><p>{E(b)}</p></div>' for i, (a, b) in enumerate(L['approach']))}</div></section>
<section><div class="eyebrow">Research themes</div><h2 class="sec">What we study</h2>
<div class="grid g4">{theme_cards}<a href="publications.html" class="card reveal" style="--d:420ms"><div class="ico">{icon('tool')}</div><h3>All publications</h3><p>Search and filter every paper by theme, type and year.</p><div class="n">{len(pubs)} papers →</div></a></div></section>
<section><div class="grid g2">
<div><div class="eyebrow">Principal investigator</div><h2 class="sec">{E(pi['name'])}</h2>
<div class="card pi reveal"><div class="avatar">{initials(pi['name'])}</div><div>
<div class="t">{E(pi['title'])}, {E(L['school'])}</div><div class="note">{E(pi['roles'][0])}</div>
<p class="lead2" style="margin:10px 0 0">{E(pi['bio'][0])}</p>
<div class="links"><a href="people.html#pi">Profile</a>{"".join(f'<a href="{E(u)}">{E(t)}</a>' for t, u in pi['links'])}</div></div></div></div>
<div><div class="eyebrow">Latest</div><h2 class="sec">News</h2><ul class="list reveal">{news}</ul>
<p class="more"><a href="news.html">All news and events →</a></p></div>
</div></section>
<section><div class="eyebrow">Recent work</div><h2 class="sec">Recent journal papers</h2>
<ol class="pubs">{"".join(pub_li(p) for p in recent)}</ol>
<p class="more"><a href="publications.html">All {len(pubs)} publications →</a></p></section>
</div>"""
    return page("index.html", L["short"], L["intro"], body)


def research():
    pubs = PUBS["publications"]
    toc = "".join(f'<a href="#{t["id"]}">{E(t["name"])}</a>' for t in THEMES) + '<a href="#projects">Projects</a><a href="#facilities">Facilities</a>'
    blocks = []
    for t in THEMES:
        rel = [p for p in pubs if t["id"] in p["themes"]]
        relh = (f'<details class="rel"><summary>{len(rel)} related publications</summary><ol>{"".join(pub_li(p, True) for p in rel[:8])}</ol>'
                f'<p class="note"><a href="publications.html?theme={t["id"]}">See all {len(rel)} in Publications →</a></p></details>') if rel else ""
        blocks.append(f'<div class="theme reveal" id="{t["id"]}"><div class="ico">{icon(t["icon"])}</div><div><h3>{E(t["name"])}</h3>'
                      f'<p>{E(t["text"])}</p>{relh}</div></div>')

    def projlist(d):
        out = ""
        for role, items in d.items():
            out += f'<h3 class="sub">{E(role)}</h3><ul class="list plain">' + "".join(
                f'<li><div class="what"><b>{E(a)}</b>{f"<div class=fund>{E(b)}</div>" if b else ""}</div></li>' for a, b in items) + "</ul>"
        return out
    fac = "".join(f'<div class="card fac reveal" style="--d:{i * 40}ms"><div class="ico">{icon("tool")}</div><div><b>{E(a)}</b><span>{E(b)}</span></div></div>'
                  for i, (a, b) in enumerate(LAB["facilities"]))
    body = phead("Research", "Research themes", E(L["intro"])) + f"""
<div class="wrap"><div class="toc">{toc}</div>
<section>{"".join(blocks)}</section>
<section id="projects"><div class="eyebrow">Funding</div><h2 class="sec">Projects</h2>
<h3 class="sub" style="color:var(--accent)">Current</h3>{projlist(LAB['projects_current'])}
<h3 class="sub" style="color:var(--accent);margin-top:34px">Completed</h3>{projlist(LAB['projects_completed'])}</section>
<section id="facilities"><div class="eyebrow">Infrastructure</div><h2 class="sec">Research facilities</h2>
<div class="grid g3">{fac}</div>
<p class="note">Also available: <a href="{LAB['facilities_note'][1]}">{E(LAB['facilities_note'][0])}</a>.</p></section>
</div>"""
    return page("research.html", "Research", "Research themes, projects and facilities of the TeNSorE Lab, IIT Kharagpur.", body)


def people():
    pi = LAB["pi"]
    pd = "".join(f'<div class="card person reveal"><div class="avatar sm">{initials(p["name"])}</div><div>'
                 + (f'<b><a href="{E(p["url"])}">{E(p["name"])}</a></b>' if p.get("url") else f'<b>{E(p["name"])}</b>')
                 + f'<span>{E(p["role"])}</span></div></div>' for p in LAB["postdocs"])
    phd = "".join(f'<div class="card person reveal" style="--d:{(i % 8) * 40}ms"><div class="avatar sm">{initials(n)}</div><div><b>{E(n)}</b><span>{E(a)}</span></div></div>'
                  for i, (n, a) in enumerate(sorted(LAB["phd"])))

    def alum(lst, label):
        return "".join(f'<div class="card alum reveal"><div class="y">{label} · {E(a.get("year") or a.get("years"))}</div><b>{E(a["name"])}</b>'
                       + (f'<div class="th">{E(a["thesis"])}</div>' if a.get("thesis") else "")
                       + (f'<div class="now">{E(a["now"])}</div>' if a.get("now") else "") + "</div>" for a in lst)
    mt = "".join(f'<li><b>{E(a["name"])}</b><span>{E(" · ".join(x for x in (a.get("years"), a.get("now")) if x))}</span></li>' for a in LAB["alumni_mtech"])
    col = ""
    for grp, items in LAB["collaborators"].items():
        col += f'<h3 class="sub">{E(grp)}</h3><ul class="collab">' + "".join(
            f'<li>{f"<a href={chr(34)}{E(u)}{chr(34)}>{E(n)}</a>" if u else E(n)}<span>{E(a)}</span></li>' for n, a, u in items) + "</ul>"
    body = phead("People", "The group", f"{1 + len(LAB['postdocs']) + len(LAB['phd'])} people: the PI, {len(LAB['postdocs'])} postdoctoral fellows and {len(LAB['phd'])} PhD scholars, plus alumni and collaborators.") + f"""
<div class="wrap">
<section id="pi"><div class="eyebrow">Principal investigator</div><h2 class="sec">{E(pi['name'])}</h2>
<div class="card pi"><div class="avatar">{initials(pi['name'])}</div><div>
<div class="t">{E(pi['title'])}, {E(L['school'])}, IIT Kharagpur</div>
<ul class="chips">{"".join(f'<li>{E(r)}</li>' for r in pi['roles'])}</ul>
{"".join(f'<p class="lead2" style="margin:10px 0 0">{E(b)}</p>' for b in pi['bio'])}
<div class="grid g2" style="margin-top:8px"><div><div class="eyebrow">Research areas</div><ul class="chips">{"".join(f'<li>{E(a)}</li>' for a in pi['areas'])}</ul></div>
<div><div class="eyebrow">Awards and accolades</div><ul style="margin:8px 0 0;padding-left:1.1em;color:var(--soft)">{"".join(f'<li>{E(a)}</li>' for a in pi['awards'])}</ul></div></div>
<div class="links"><a href="mailto:{L['email']}">{L['email']}</a>{"".join(f'<a href="{E(u)}">{E(t)}</a>' for t, u in pi['links'])}</div>
</div></div></section>
<section><div class="eyebrow">Postdoctoral fellows</div><h2 class="sec">Postdocs <span class="count">{len(LAB['postdocs'])}</span></h2><div class="grid g3">{pd}</div></section>
<section><div class="eyebrow">Doctoral researchers</div><h2 class="sec">PhD scholars <span class="count">{len(LAB['phd'])}</span></h2><div class="grid g3">{phd}</div></section>
<section><div class="eyebrow">Alumni</div><h2 class="sec">Graduated</h2>
<div class="grid g2">{alum(LAB['alumni_phd'], 'PhD')}{alum(LAB['alumni_ms'], 'MS')}</div>
<h3 class="sub">M.Tech.</h3><ul class="collab">{mt}</ul></section>
<section id="collaborators"><div class="eyebrow">Network</div><h2 class="sec">Collaborators</h2>{col}</section>
</div>"""
    return page("people.html", "People", "PI, postdocs, PhD scholars, alumni and collaborators of the TeNSorE Lab, IIT Kharagpur.", body)


def publications():
    pubs = PUBS["publications"]
    years = {}
    for p in pubs:
        years.setdefault(p["year"] or 0, []).append(p)
    groups = "".join(f'<div class="ygroup"><h2 class="year">{y or "Undated"} <span></span></h2><ol class="pubs">{"".join(pub_li(p) for p in ps)}</ol></div>'
                     for y, ps in sorted(years.items(), reverse=True))
    counts = {k: sum(p["type"] == k for p in pubs) for k in ("journal", "conference", "preprint")}
    seg = f'<button data-type="all" aria-pressed="true">All {len(pubs)}</button>' + "".join(
        f'<button data-type="{k}" aria-pressed="false">{TYPE_LABEL[k]} {v}</button>' for k, v in counts.items() if v)
    opts = '<option value="">All themes</option>' + "".join(f'<option value="{t["id"]}">{E(t["name"])}</option>' for t in THEMES)
    body = phead("Publications", "Publications",
                 f'{len(pubs)} publications from <a href="{PUBS["source"]}">Dr. Bakli\'s ORCID record</a> (updated {E(PUBS["updated"])}). Lab members are highlighted; themes are assigned automatically from titles.') + f"""
<div class="wrap"><section style="padding-top:12px">
<div class="tools"><input type="search" id="q" placeholder="Search title, author, journal, year…" aria-label="Search publications">
<div class="seg" role="group" aria-label="Type">{seg}</div>
<select id="theme" aria-label="Theme">{opts}</select><span class="shown" id="shown"></span></div>
<div id="pubs">{groups}</div><p class="empty" id="none" hidden>No publications match. Try fewer words or another theme.</p>
</section></div>"""
    return page("publications.html", "Publications", f"{len(pubs)} publications of the TeNSorE Lab, IIT Kharagpur, with search and filters.", body)


def news():
    nl = "".join(f'<li><time>{E(n["when"]) or "&nbsp;"}</time><div class="what">{md(n["text"])}</div></li>' for n in LAB["news"])
    ev = "".join(f'<li><time>{E(e["when"])}</time><div class="what"><b>{E(e["title"])}</b>{f"<p>{E(e[chr(116)+chr(101)+chr(120)+chr(116)])}</p>" if e["text"] else ""}</div></li>' for e in LAB["events"])
    lc = LAB["lectures"]
    body = phead("News & Events", "News and events", "Milestones, workshops the lab has organised, and open lecture material.") + f"""
<div class="wrap">
<section><div class="eyebrow">Group news</div><h2 class="sec">News</h2><ul class="list">{nl}</ul></section>
<section><div class="eyebrow">Organised by the lab</div><h2 class="sec">Workshops and events</h2><ul class="list">{ev}</ul></section>
<section id="lectures"><div class="eyebrow">Teaching resources</div><h2 class="sec">Lecture archive</h2>
<div class="card"><b>{E(lc['program'])}</b><p style="margin:6px 0 12px">{E(lc['text'])}</p>
<ul class="chips">{"".join(f'<li>{E(t)}</li>' for t in lc['topics'])}</ul>
<p style="margin:14px 0 0"><a class="btn plain" href="{E(lc['url'])}">Open the lecture folder ↗</a></p></div></section>
</div>"""
    return page("news.html", "News & Events", "News, workshops and lectures from the TeNSorE Lab, IIT Kharagpur.", body)


def join():
    j = LAB["join"]
    routes = "".join(f'<div class="card reveal" style="--d:{i * 60}ms"><h3 style="margin-top:0">{E(r[0])}</h3><p>{E(r[1])}</p>'
                     + (f'<p style="margin-top:10px"><a href="{E(r[2])}">{E(r[2].split("//")[1])} ↗</a></p>' if len(r) > 2 else "") + "</div>"
                     for i, r in enumerate(j["routes"]))
    body = phead("Join us", "Join the lab", E(j["text"])) + f"""
<div class="wrap">
<section><div class="eyebrow">Ways to join</div><h2 class="sec">Openings</h2><div class="grid g2">{routes}</div></section>
<section id="contact"><div class="eyebrow">Contact</div><h2 class="sec">Get in touch</h2>
<div class="card contact-card"><div><h3>{E(LAB['pi']['name'])}</h3><p class="lead2" style="margin:0">Write to Dr. Bakli for positions, internships and collaborations. To reach a lab member, mention them in your email.</p>
<p style="margin:16px 0 0"><a class="btn plain" href="mailto:{L['email']}">{icon('mail').replace('<svg', '<svg width=18 height=18 fill=none stroke=currentColor stroke-width=1.8')} {L['email']}</a></p></div>
<div><dl class="kv"><dt>Address</dt><dd>{E(L['address'])}</dd><dt>School</dt><dd><a href="{L['school_url']}">{E(L['school'])}</a></dd>
<dt>Faculty page</dt><dd><a href="{LAB['pi']['links'][0][1]}">iitkgp.ac.in/department/ES/faculty/es-chirodeep</a></dd></dl></div></div></section>
</div>"""
    return page("join.html", "Join us", "Openings and contact details for the TeNSorE Lab, IIT Kharagpur.", body)


if __name__ == "__main__":
    (ROOT / "images" / "favicon.svg").write_text(LOGO.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '))
    for name, fn in (("index.html", home), ("research.html", research), ("people.html", people),
                     ("publications.html", publications), ("news.html", news), ("join.html", join)):
        (ROOT / name).write_text(fn())
        print("wrote", name)
