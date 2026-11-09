/* TeNSorE Lab admin page. Talks to the GitHub REST API directly from the browser:
   reads/writes data/lab.json and data/publication_themes.json, and starts the
   "Refresh publications" workflow. Every save is a commit; the "Build site" workflow
   then regenerates the HTML. No server, no third parties. */
(function () {
  var REPO = "vinayarya29/tensorelab", BRANCH = "main", API = "https://api.github.com/repos/" + REPO;
  var KEY = "tensorelab-admin-token";
  var token = "", lab = null, labSha = null, themesDoc = null, themesSha = null, pubs = null;
  var $ = function (id) { return document.getElementById(id); };

  function status(id, msg, kind) { var el = $(id); el.textContent = msg; el.className = "status" + (kind ? " " + kind : ""); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function md(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\*(.+?)\*/g, "<i>$1</i>"); }
  // UTF-8 safe base64
  function b64e(str) { var b = new TextEncoder().encode(str), s = ""; for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s); }
  function b64d(b64) { var s = atob(b64.replace(/\n/g, "")), b = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return new TextDecoder().decode(b); }

  function gh(path, opts) {
    opts = opts || {};
    return fetch(path.indexOf("http") === 0 ? path : API + path, {
      method: opts.method || "GET",
      headers: { "Authorization": "Bearer " + token, "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
      body: opts.body ? JSON.stringify(opts.body) : undefined, cache: "no-store"
    }).then(function (r) {
      if (r.status === 204) return null;
      return r.json().then(function (j) { if (!r.ok) throw new Error((j && j.message) || ("HTTP " + r.status)); return j; });
    });
  }
  function readJSON(path) {
    return gh("/contents/" + path + "?ref=" + BRANCH).then(function (f) { return { data: JSON.parse(b64d(f.content)), sha: f.sha }; });
  }
  function writeJSON(path, data, sha, message) {
    return gh("/contents/" + path, { method: "PUT", body: { message: message, content: b64e(JSON.stringify(data, null, 1) + "\n"), sha: sha, branch: BRANCH } })
      .then(function (r) { return r.content.sha; });
  }
  function saveLab(message, statusId) {
    status(statusId, "Saving…");
    return writeJSON("data/lab.json", lab, labSha, message).then(function (sha) {
      labSha = sha; render(); status(statusId, "Saved. The site updates in about 3–4 minutes.", "ok");
    }).catch(function (e) {
      status(statusId, "Not saved: " + e.message + (/sha|match/i.test(e.message) ? " (someone else changed the data; reload the page)" : ""), "err");
      throw e;
    });
  }

  // ---------------------------------------------------------------- password lock
  // The GitHub token is stored in assets/admin-key.json, encrypted with the admin password
  // (PBKDF2-SHA256, 600k iterations -> AES-256-GCM). Only the password unlocks it.
  var KEYFILE = "assets/admin-key.json", ITER = 600000;
  var u8 = function (b64) { return Uint8Array.from(atob(b64), function (c) { return c.charCodeAt(0); }); };
  var tob64 = function (buf) { var a = new Uint8Array(buf), s = ""; for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s); };
  function deriveKey(pw, salt, iter) {
    return crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveKey"]).then(function (k) {
      return crypto.subtle.deriveKey({ name: "PBKDF2", salt: salt, iterations: iter, hash: "SHA-256" }, k, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    });
  }
  function encryptToken(tok, pw) {
    var salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    return deriveKey(pw, salt, ITER).then(function (k) { return crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, k, new TextEncoder().encode(tok)); })
      .then(function (ct) { return { v: 1, kdf: "PBKDF2-SHA256", iter: ITER, salt: tob64(salt), iv: tob64(iv), ct: tob64(ct) }; });
  }
  function decryptToken(blob, pw) {
    return deriveKey(pw, u8(blob.salt), blob.iter).then(function (k) { return crypto.subtle.decrypt({ name: "AES-GCM", iv: u8(blob.iv) }, k, u8(blob.ct)); })
      .then(function (pt) { return new TextDecoder().decode(pt); });
  }

  function unlock(t) {
    token = t;
    return gh("").then(function (repo) {
      if (!repo.permissions || !repo.permissions.push) throw new Error("the stored token can no longer write to the repository");
      try { sessionStorage.setItem(KEY, token); } catch (e) {}
      $("locked").hidden = true; $("unlocked").hidden = false;
      return load();
    });
  }
  $("pw-go").addEventListener("click", openWithPassword);
  $("pw").addEventListener("keydown", function (e) { if (e.key === "Enter") openWithPassword(); });
  // Read the encrypted key from the published site; if it is missing or does not match (e.g. GitHub Pages has
  // not finished publishing a just-changed password), fall back to the copy in the repository itself.
  var RAW = "https://raw.githubusercontent.com/" + REPO + "/" + BRANCH + "/" + KEYFILE;
  function fetchKey(url) {
    return fetch(url + "?t=" + Date.now(), { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error("missing"); return r.json(); });
  }
  function tryKey(url, pw) { return fetchKey(url).then(function (blob) { return decryptToken(blob, pw); }); }
  function openWithPassword() {
    var pw = $("pw").value; if (!pw) return;
    status("pw-status", "Checking… (this takes a few seconds)");
    tryKey(KEYFILE, pw).catch(function () { return tryKey(RAW, pw); }).catch(function () {
      return fetchKey(RAW).then(function () { throw new Error("wrong password"); },
                                function () { throw new Error("no password has been set up yet — use “Set up or change the password”"); });
    }).then(unlock).then(function () { status("pw-status", ""); }).catch(function (e) {
      token = ""; status("pw-status", "Could not open: " + e.message + (/expired|Bad credentials/i.test(e.message) ? " — the GitHub token has expired; set up the password again with a new token" : ""), "err");
    });
  }
  $("show-setup").addEventListener("click", function (e) { e.preventDefault(); $("pw-card").hidden = true; $("setup-card").hidden = false; });
  $("hide-setup").addEventListener("click", function () { $("pw-card").hidden = false; $("setup-card").hidden = true; });
  $("setup-go").addEventListener("click", function () {
    var tok = $("tok").value.trim(), p1 = $("newpw").value, p2 = $("newpw2").value;
    if (!tok) return status("setup-status", "Paste the GitHub token.", "err");
    if (p1.length < 6) return status("setup-status", "Use at least 6 characters.", "err");
    if (p1.length < 10 && !confirm("Short passwords are easier to guess. Use it anyway?")) return;
    if (p1 !== p2) return status("setup-status", "The passwords do not match.", "err");
    token = tok; status("setup-status", "Checking the token…");
    gh("").then(function (repo) {
      if (!repo.permissions || !repo.permissions.push) throw new Error("this token cannot write to " + REPO);
      return encryptToken(tok, p1);
    }).then(function (blob) {
      return gh("/contents/" + KEYFILE + "?ref=" + BRANCH).then(function (f) { return f.sha; }, function () { return undefined; }).then(function (sha) {
        var body = { message: "Set admin password", content: b64e(JSON.stringify(blob) + "\n"), branch: BRANCH };
        if (sha) body.sha = sha;
        return gh("/contents/" + KEYFILE, { method: "PUT", body: body });
      });
    }).then(function () {
      $("tok").value = $("newpw").value = $("newpw2").value = "";
      status("setup-status", "Password saved.", "ok");
      return unlock(token);
    }).catch(function (e) { token = ""; status("setup-status", "Not saved: " + e.message, "err"); });
  });
  $("signout").addEventListener("click", function () { try { sessionStorage.removeItem(KEY); localStorage.removeItem(KEY); } catch (e) {} location.reload(); });

  function load() {
    return Promise.all([readJSON("data/lab.json"), readJSON("data/publication_themes.json"), readJSON("data/publications.json")])
      .then(function (r) {
        lab = r[0].data; labSha = r[0].sha; themesDoc = r[1].data; themesSha = r[1].sha; pubs = r[2].data;
        $("who").textContent = "Signed in. Editing " + REPO + " (" + pubs.publications.length + " publications, updated " + pubs.updated + ").";
        render(); renderUnassigned(); runs();
        $("raw").value = JSON.stringify(lab, null, 1);
      });
  }

  // ---------------------------------------------------------------- lists (news, events)
  function listHTML(arr, fmt, editable) {
    if (!arr.length) return '<li><span></span><span class="status">Nothing yet.</span><span></span></li>';
    return arr.map(function (x, i) {
      return "<li>" + fmt(x) + '<span class="ops">' + (editable ? '<button data-op="edit" data-i="' + i + '" title="Edit">Edit</button>' : "") + '<button data-op="up" data-i="' + i + '" ' + (i ? "" : "disabled") + ' title="Move up">↑</button>' +
        '<button data-op="down" data-i="' + i + '" ' + (i < arr.length - 1 ? "" : "disabled") + ' title="Move down">↓</button>' +
        '<button data-op="del" data-i="' + i + '" class="danger" title="Delete">Delete</button></span></li>';
    }).join("");
  }
  function liUrn(x) {
    var m = /urn:li:(share|activity|ugcPost):(\d+)/.exec(x) || /(activity)-(\d{15,})/.exec(x);
    return m ? "urn:li:" + m[1] + ":" + m[2] : null;
  }
  function render() {
    lab.linkedin_posts = lab.linkedin_posts || [];
    $("li-list").innerHTML = listHTML(lab.linkedin_posts, function (u) {
      return '<time>Post</time><span><a href="https://www.linkedin.com/feed/update/' + esc(u) + '/" target="_blank" rel="noopener">' + esc(u) + "</a></span>";
    });
    $("news-list").innerHTML = listHTML(lab.news || [], function (n) { return "<time>" + esc(n.when || "—") + "</time><span>" + (n.title ? "<b>" + esc(n.title) + "</b><br><span class=status>" + md(n.text || "") + "</span>" : md(n.text)) + "</span>"; }, true);
    $("ev-list").innerHTML = listHTML(lab.events || [], function (e) { return "<time>" + esc(e.when) + "</time><span><b>" + esc(e.title) + "</b>" + (e.text ? "<br><span class=status>" + esc(e.text) + "</span>" : "") + "</span>"; }, true);
  }
  // editing[key] = index of the item loaded into the form (null = the form adds a new item)
  var editing = { news: null, events: null };
  var FORMS = {
    news: { fields: { "n-when": "when", "n-title": "title", "n-text": "text" }, add: "n-add", cancel: "n-cancel", addLabel: "Add news", status: "n-status" },
    events: { fields: { "e-when": "when", "e-title": "title", "e-text": "text" }, add: "e-add", cancel: "e-cancel", addLabel: "Add event", status: "e-status" }
  };
  function setEditing(key, i) {
    var f = FORMS[key]; editing[key] = i;
    Object.keys(f.fields).forEach(function (id) { $(id).value = i == null ? "" : (lab[key][i][f.fields[id]] || ""); });
    $(f.add).textContent = i == null ? f.addLabel : "Save changes";
    $(f.cancel).hidden = i == null;
    status(f.status, i == null ? "" : "Editing item " + (i + 1) + " — change it and press Save changes.");
    if (i != null) { $(Object.keys(f.fields)[1]).focus(); $(f.add).scrollIntoView({ block: "center", behavior: "smooth" }); }
  }
  $("n-cancel").addEventListener("click", function () { setEditing("news", null); });
  $("e-cancel").addEventListener("click", function () { setEditing("events", null); });
  function wireList(listId, key, label, statusId) {
    $(listId).addEventListener("click", function (ev) {
      var b = ev.target.closest("button"); if (!b) return;
      var arr = lab[key], i = +b.dataset.i, op = b.dataset.op, msg;
      if (op === "edit") return setEditing(key, i);
      if (key in editing && editing[key] != null) setEditing(key, null);  // list order changes; drop a half-done edit
      if (op === "del") { if (!confirm("Delete this " + label + "?")) return; msg = "Delete " + label + ": " + String(arr[i].title || arr[i].text || arr[i]).slice(0, 60); arr.splice(i, 1); }
      else { var j = op === "up" ? i - 1 : i + 1; var t = arr[i]; arr[i] = arr[j]; arr[j] = t; msg = "Reorder " + label + "s"; }
      saveLab(msg, statusId).catch(function () { load(); });
    });
  }
  wireList("news-list", "news", "news item", "n-status");
  wireList("ev-list", "events", "event", "e-status");
  wireList("li-list", "linkedin_posts", "LinkedIn post", "li-status");
  $("li-add").addEventListener("click", function () {
    var urn = liUrn($("li-in").value);
    if (!urn) return status("li-status", "That does not look like a LinkedIn post link or embed code.", "err");
    if (lab.linkedin_posts.indexOf(urn) >= 0) return status("li-status", "That post is already on the site.", "err");
    lab.linkedin_posts.unshift(urn);
    saveLab("Add LinkedIn post " + urn, "li-status").then(function () { $("li-in").value = ""; }).catch(function () { lab.linkedin_posts.shift(); });
  });

  $("n-add").addEventListener("click", function () {
    var when = $("n-when").value.trim(), title = $("n-title").value.trim(), text = $("n-text").value.trim();
    if (!title && !text) return status("n-status", "Write a heading and the details first.", "err");
    lab.news = lab.news || [];
    var i = editing.news, item = { when: when, title: title, text: text };
    if (!title) delete item.title;
    if (i != null) {
      var old = lab.news[i]; lab.news[i] = Object.assign({}, old, item); if (!title) delete lab.news[i].title;
      return saveLab("Edit news: " + (title || text).replace(/\*/g, "").slice(0, 60), "n-status").then(function () { setEditing("news", null); status("n-status", "Saved. Live in about 3–4 minutes.", "ok"); })
        .catch(function () { lab.news[i] = old; });
    }
    lab.news.unshift(item);
    saveLab("Add news: " + (title || text).replace(/\*/g, "").slice(0, 60), "n-status").then(function () { $("n-when").value = ""; $("n-title").value = ""; $("n-text").value = ""; })
      .catch(function () { lab.news.shift(); });
  });
  $("e-add").addEventListener("click", function () {
    var when = $("e-when").value.trim(), title = $("e-title").value.trim(), text = $("e-text").value.trim();
    if (!when || !title) return status("e-status", "Give the event a date and a title.", "err");
    lab.events = lab.events || [];
    var i = editing.events, item = { when: when, title: title, text: text };
    if (i != null) {
      var old = lab.events[i]; lab.events[i] = Object.assign({}, old, item);
      return saveLab("Edit event: " + title.slice(0, 60), "e-status").then(function () { setEditing("events", null); status("e-status", "Saved. Live in about 3–4 minutes.", "ok"); })
        .catch(function () { lab.events[i] = old; });
    }
    lab.events.unshift(item);
    saveLab("Add event: " + title.slice(0, 60), "e-status").then(function () { $("e-when").value = ""; $("e-title").value = ""; $("e-text").value = ""; })
      .catch(function () { lab.events.shift(); });
  });

  // ---------------------------------------------------------------- publications
  $("p-refresh").addEventListener("click", function () {
    status("p-status", "Starting…");
    gh("/actions/workflows/publications.yml/dispatches", { method: "POST", body: { ref: BRANCH } }).then(function () {
      status("p-status", "Started. New papers appear on the site in about 5 minutes.", "ok"); setTimeout(runs, 4000);
    }).catch(function (e) { status("p-status", "Could not start: " + e.message, "err"); });
  });
  function runs() {
    gh("/actions/runs?per_page=6").then(function (r) {
      $("runs").innerHTML = (r.workflow_runs || []).map(function (w) {
        var st = w.status === "completed" ? (w.conclusion === "success" ? "✓ done" : "✗ " + w.conclusion) : "… " + w.status.replace("_", " ");
        return "<li>" + esc(w.name) + " · " + st + " · " + new Date(w.created_at).toLocaleString() + ' · <a href="' + w.html_url + '" target="_blank" rel="noopener">details</a></li>';
      }).join("") || "<li>No recent runs.</li>";
      if ((r.workflow_runs || []).some(function (w) { return w.status !== "completed"; })) setTimeout(runs, 15000);
    }).catch(function () {});
  }

  function pubKey(p) { return p.doi || p.title.toLowerCase().slice(0, 60); }
  function renderUnassigned() {
    var manual = themesDoc.themes, todo = pubs.publications.filter(function (p) { return !manual[pubKey(p)]; });
    if (!todo.length) { $("unassigned").innerHTML = '<p class="status ok">Every paper has hand-picked themes.</p>'; $("t-save").disabled = true; return; }
    $("unassigned").innerHTML = todo.map(function (p, k) {
      return '<div class="pubrow" data-key="' + esc(pubKey(p)) + '"><b>' + esc(p.title) + "</b> <span class=status>" + esc(p.venue || "") + ", " + (p.year || "") + "</span>" +
        '<div class="ths">' + lab.themes.map(function (t) { return '<label><input type="checkbox" value="' + t.id + '">' + esc(t.name) + "</label>"; }).join("") + "</div></div>";
    }).join("");
    $("t-save").disabled = false;
  }
  $("t-save").addEventListener("click", function () {
    var n = 0;
    document.querySelectorAll("#unassigned .pubrow").forEach(function (row) {
      var ids = Array.prototype.map.call(row.querySelectorAll("input:checked"), function (c) { return c.value; });
      if (ids.length) { themesDoc.themes[row.dataset.key] = ids; n++; }
    });
    if (!n) return status("t-status", "Tick at least one theme.", "err");
    status("t-status", "Saving…");
    writeJSON("data/publication_themes.json", themesDoc, themesSha, "Set themes for " + n + " paper(s)").then(function (sha) {
      themesSha = sha; renderUnassigned(); status("t-status", "Saved " + n + ". The site updates in about 3–4 minutes.", "ok");
    }).catch(function (e) { status("t-status", "Not saved: " + e.message, "err"); });
  });

  // ---------------------------------------------------------------- raw editor
  $("raw-save").addEventListener("click", function () {
    var data;
    try { data = JSON.parse($("raw").value); } catch (e) { return status("raw-status", "Not valid JSON: " + e.message, "err"); }
    if (!data.lab || !data.themes || !data.pi) return status("raw-status", "The data looks incomplete (lab, pi or themes missing). Not saved.", "err");
    var old = lab; lab = data;
    saveLab("Edit site data", "raw-status").catch(function () { lab = old; });
  });
  $("raw-reload").addEventListener("click", function () { $("raw").value = JSON.stringify(lab, null, 1); status("raw-status", "Reverted to the saved data."); });

  // stay unlocked for this browser tab session only
  var t0 = ""; try { t0 = sessionStorage.getItem(KEY) || ""; localStorage.removeItem(KEY); } catch (e) {}
  if (t0) unlock(t0).catch(function () { try { sessionStorage.removeItem(KEY); } catch (e) {} });
})();
