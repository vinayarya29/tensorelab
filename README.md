# tensorelab.github.io

Website of the **TeNSorE Lab** (Thermofluidics and Nanotechnology for Sustainable Energy Systems
Laboratory), School of Energy Science and Engineering, IIT Kharagpur. PI: Dr. Chirodeep Bakli.
Served by GitHub Pages at https://www.vinayarya.in/tensorelab/ (repo vinayarya29/tensorelab; the old vinayarya29.github.io/tensorelab/ address redirects there).
Separate from Vinay Arya's personal site (vinayarya29.github.io).

| Page | File |
|---|---|
| Home | `index.html` |
| Research (themes, projects, facilities) | `research.html` |
| People (PI, postdocs, PhD, alumni, collaborators) | `people.html` |
| Publications (search + filters) | `publications.html` |
| News & Events (news, workshops, lecture archive) | `news.html` |
| Join us / Contact | `join.html` |

**The HTML pages are generated — don't edit them by hand.** Edit the data, then rebuild:

- `data/lab.json`: everything except publications (people, themes and their keywords, projects,
  facilities, news, events, lectures, collaborators, openings). News text supports `**bold**`.
- `data/publications.json`: generated from Dr. Bakli's ORCID record (+ Crossref for missing authors).
- `data/publication_fixes.json`: manual corrections applied on top of ORCID.
- `data/publication_themes.json`: hand-assigned research theme(s) of each paper (by DOI). New papers
  that are not listed fall back to the keyword rules (`keys`) of each theme in `lab.json`.

```sh
python3 tools/update_publications.py   # refresh publications from ORCID (needs internet)
python3 tools/build.py                 # regenerate the six pages
git add -A && git commit -m "Update" && git push
```

Images (`images/`): the lab emblem (`tensore-logo.png`, supplied by the user); theme figures
(`images/themes/`), lab photos (`images/lab/`) and research-highlight slides (`images/highlights/`,
rendered by PowerPoint from `TENSORE_Lab work.pptx`). Theme figures, photos and highlights are
listed in `data/lab.json` (`image`, `lab_photos`, `highlights`).

After adding or replacing images run `python3 tools/optimize_images.py` (needs Pillow): it writes
WebP copies at display sizes (`<name>.<width>.webp`) and `images/manifest.json`, which the builder
uses for `srcset`/`width`/`height`.

Python 3.8+ standard library only (except the image optimiser). Lab members are highlighted in author lists automatically
(from the names in `lab.json`); research themes are assigned to papers by keywords in their titles.

Sources (Nov 2026): members, projects, roles and awards from the IIT Kharagpur faculty page
(https://www.iitkgp.ac.in/department/ES/faculty/es-chirodeep); themes, facilities, events,
lectures, collaborators and M.Tech alumni from https://sites.google.com/view/tensore;
publications from https://orcid.org/0000-0002-5882-143X.

## Admin page (no coding needed)

`admin.html` (https://vinayarya29.github.io/tensorelab/admin.html, not linked from the menu) lets an
admin add/remove/reorder **news** and **events**, **refresh publications** from ORCID, set the
**themes of new papers**, and edit everything else (people, projects, …) in a checked JSON editor.

- It is opened with the admin password. The password decrypts a GitHub fine-grained token (access to
  this repository only) stored encrypted in `assets/admin-key.json` (PBKDF2-SHA256 600k → AES-256-GCM).
  First-time setup / changing the password / renewing an expired token: "Set up or change the password".
- Every save is a commit. `.github/workflows/build.yml` rebuilds the pages when `data/` changes;
  `.github/workflows/publications.yml` refreshes publications every Monday and on demand.
