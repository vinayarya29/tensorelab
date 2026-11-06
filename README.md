# tensorelab.github.io

Website of the **TeNSorE Lab** (Thermofluidics and Nanotechnology for Sustainable Energy Systems
Laboratory), School of Energy Science and Engineering, IIT Kharagpur. PI: Dr. Chirodeep Bakli.
Served by GitHub Pages. Separate from Vinay Arya's personal site (vinayarya29.github.io).

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

```sh
python3 tools/update_publications.py   # refresh publications from ORCID (needs internet)
python3 tools/build.py                 # regenerate the six pages
git add -A && git commit -m "Update" && git push
```

Python 3.8+ standard library only. Lab members are highlighted in author lists automatically
(from the names in `lab.json`); research themes are assigned to papers by keywords in their titles.

Sources (Nov 2026): members, projects, roles and awards from the IIT Kharagpur faculty page
(https://www.iitkgp.ac.in/department/ES/faculty/es-chirodeep); themes, facilities, events,
lectures, collaborators and M.Tech alumni from https://sites.google.com/view/tensore;
publications from https://orcid.org/0000-0002-5882-143X.
