/* TeNSorE Lab — shared behaviour: embedded-mode detection, mobile menu, scroll reveal,
   the hero particle field, and the publication filters. No dependencies. */
(function () {
  var root = document.documentElement;
  var embedded = false;
  try { embedded = window.self !== window.top; } catch (e) { embedded = true; }
  root.classList.toggle("embedded", embedded);
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduce && "IntersectionObserver" in window) root.classList.add("anim");

  document.addEventListener("DOMContentLoaded", function () {
    // Inside an embed frame (e.g. Google Sites) top-level navigation is blocked: open links in a new tab.
    if (embedded) document.querySelectorAll("a[href]").forEach(function (a) {
      if (!a.getAttribute("href").startsWith("#")) a.target = "_blank", a.rel = "noopener";
    });

    var bar = document.querySelector(".topbar"), btn = document.querySelector(".menu-btn");
    if (bar && btn) btn.addEventListener("click", function () {
      var open = bar.classList.toggle("open"); btn.setAttribute("aria-expanded", open);
    });

    // Scroll reveal (with a safety net so nothing stays hidden).
    var items = document.querySelectorAll(".reveal");
    if (root.classList.contains("anim")) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
      }, { rootMargin: "0px 0px -6% 0px" });
      items.forEach(function (el) { io.observe(el); });
      setTimeout(function () { items.forEach(function (el) { el.classList.add("in"); }); }, 2500);
    }

    heroField();
    pubFilters();
  });

  // Drifting particles with faint links: a nod to molecules in a nanochannel.
  function heroField() {
    var c = document.querySelector(".hero canvas");
    if (!c || reduce) return;
    var ctx = c.getContext("2d"), dpr = Math.min(window.devicePixelRatio || 1, 2), W, H, P = [];
    function size() {
      W = c.clientWidth; H = c.clientHeight; c.width = W * dpr; c.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.round(Math.min(90, W * H / 9000)); P = [];
      for (var i = 0; i < n; i++) P.push({ x: Math.random() * W, y: Math.random() * H, vx: .15 + Math.random() * .35, vy: (Math.random() - .5) * .12, r: 1 + Math.random() * 1.8 });
    }
    size(); window.addEventListener("resize", size);
    var visible = true;
    new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }).observe(c);
    (function frame() {
      if (visible) {
        ctx.clearRect(0, 0, W, H);
        for (var i = 0; i < P.length; i++) {
          var p = P[i]; p.x += p.vx * (0.6 + 0.8 * Math.sin(p.y / H * Math.PI)); p.y += p.vy;
          if (p.x > W + 5) p.x = -5; if (p.y < 0 || p.y > H) p.vy *= -1;
          for (var j = i + 1; j < P.length; j++) {
            var q = P[j], dx = p.x - q.x, dy = p.y - q.y, d2 = dx * dx + dy * dy;
            if (d2 < 7000) { ctx.strokeStyle = "rgba(220,250,248," + (0.22 * (1 - d2 / 7000)) + ")"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }
          }
          ctx.fillStyle = "rgba(230,252,250,.75)"; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
        }
      }
      requestAnimationFrame(frame);
    })();
  }

  function pubFilters() {
    var box = document.getElementById("pubs");
    if (!box) return;
    var q = document.getElementById("q"), th = document.getElementById("theme"), shown = document.getElementById("shown");
    var type = "all";
    document.querySelectorAll(".seg button").forEach(function (b) {
      b.addEventListener("click", function () {
        document.querySelectorAll(".seg button").forEach(function (x) { x.setAttribute("aria-pressed", x === b); });
        type = b.dataset.type; apply();
      });
    });
    // deep links: publications.html?theme=droplets or #theme=droplets
    var m = (location.search + location.hash).match(/theme=([a-z0-9]+)/);
    if (m && th.querySelector('option[value="' + m[1] + '"]')) th.value = m[1];
    q.addEventListener("input", apply); th.addEventListener("change", apply);
    function apply() {
      var words = q.value.toLowerCase().split(/\s+/).filter(Boolean), t = th.value, n = 0;
      box.querySelectorAll(".pub").forEach(function (li) {
        var ok = (type === "all" || li.dataset.type === type) &&
                 (!t || (" " + li.dataset.themes + " ").indexOf(" " + t + " ") >= 0) &&
                 words.every(function (w) { return li.dataset.text.indexOf(w) >= 0; });
        li.hidden = !ok; if (ok) n++;
      });
      box.querySelectorAll(".ygroup").forEach(function (g) {
        var k = g.querySelectorAll(".pub:not([hidden])").length;
        g.hidden = !k; g.querySelector(".year span").textContent = k + (k === 1 ? " paper" : " papers");
      });
      shown.textContent = n + " shown";
      document.getElementById("none").hidden = n > 0;
    }
    apply();
  }
})();
