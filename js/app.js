/* Winsprout app UI */
(function () {
  "use strict";
  var WS = window.WS, SY = window.WSSync;
  var $ = function (id) { return document.getElementById(id); };
  var TODAY = WS.key(new Date());
  var TAB = (function () { try { var v = new URLSearchParams(location.search).get("view"); return ["today", "week", "report", "talents", "badges", "settings"].indexOf(v) >= 0 ? v : ""; } catch (e) { return ""; } })();
  if (TAB) document.documentElement.classList.add("ws-tab");
  // Opened from the Teams app tab (?host=teams): one page with Winsprout's own tab row, so switching is instant
  var IN_TEAMS_TAB = (function () { try { return new URLSearchParams(location.search).get("host") === "teams"; } catch (e) { return false; } })();
  if (IN_TEAMS_TAB) document.documentElement.classList.add("ws-teams");
  var DEFAULT = { v: 1, settings: { workdays: [1, 2, 3, 4, 5], weeklyGoal: 5, reminder: "17:30", name: "", u: 0 }, wins: [], talents: [], shows: [], shares: [] };
  var data = normalise(SY.load()) || JSON.parse(JSON.stringify(DEFAULT));
  var ui = { view: "today", weekOf: TODAY, logDay: TODAY, editing: null, cat: "delivered", imp: 2, period: "last12", from: "", to: "",
    share: { tid: "", title: "", msg: "", links: [""], images: [], cheer: true, copied: false, needIT: false, kind: "chat", chatId: "", teamId: "", channelId: "", chats: null, teams: null, channels: {}, ready: null, checked: false, loading: false, posting: false, err: "" } };

  function normalise(d) {
    if (!d || typeof d !== "object" || !Array.isArray(d.wins)) return null;
    d.settings = Object.assign({}, DEFAULT.settings, d.settings || {});
    if (!Array.isArray(d.talents)) d.talents = [];
    if (!Array.isArray(d.shows)) d.shows = [];
    if (!Array.isArray(d.shares)) d.shares = [];
    d.v = 1;
    return d;
  }
  function settings() { return data.settings; }
  function save() { SY.queueSave(data); }

  /* ---------- small DOM helpers ---------- */
  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === "text") e.textContent = v;
      else if (k === "class") e.className = v;
      else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? "" : v);
    });
    (kids || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return e;
  }
  function svg(tag, attrs, kids) {
    var e = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return e;
  }
  var toastTimer;
  function toast(msg) {
    var t = $("toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove("show"); }, 3200);
  }
  /* ---------- celebrations and motion (switched off when the person asks for reduced motion) ---------- */
  var fx = (function () {
    var calm = false;
    try { calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { /* old browser */ }
    var api = { ringFrom: null, newId: null };
    api.enter = function (el) {
      if (calm || !el) return;
      el.classList.remove("enter"); void el.offsetWidth; el.classList.add("enter");
      clearTimeout(el._enterT); el._enterT = setTimeout(function () { el.classList.remove("enter"); }, 700); // so later redraws don't replay it
    };
    api.bump = function (el) {
      if (calm || !el) return;
      el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump");
    };
    // burst of little stars, leaves and confetti from the Add button (or the screen centre)
    api.burst = function (rect, power) {
      if (calm) return;
      var cv = document.createElement("canvas"), dpr = window.devicePixelRatio || 1, W = window.innerWidth, H = window.innerHeight;
      cv.className = "fxcanvas"; cv.setAttribute("aria-hidden", "true");
      cv.width = W * dpr; cv.height = H * dpr; document.body.appendChild(cv);
      var g = cv.getContext("2d"); if (!g) { cv.remove(); return; } g.scale(dpr, dpr);
      var ox = rect ? rect.left + rect.width / 2 : W / 2, oy = rect ? rect.top + rect.height / 2 : H / 3;
      var colors = ["#5b2fc9", "#7b4cfd", "#b39bff", "#e9a400", "#ffcf40", "#2fa36b"], n = power > 1 ? 90 : 46, parts = [];
      for (var i = 0; i < n; i++) {
        var a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * (power > 1 ? 1.5 : 1.1), sp = (power > 1 ? 7 : 5.5) + Math.random() * 5;
        parts.push({ x: ox, y: oy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 3 + Math.random() * 4, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3,
          c: colors[i % colors.length], shape: i % 5 === 0 ? "star" : i % 3 === 0 ? "leaf" : "rect" });
      }
      var t0 = performance.now(), life = power > 1 ? 1500 : 1100;
      function star(r) { g.beginPath(); for (var k = 0; k < 10; k++) { var rr = k % 2 ? r * 0.45 : r, an = Math.PI / 5 * k - Math.PI / 2; g.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } g.closePath(); g.fill(); }
      (function frame(now) {
        var t = now - t0; g.clearRect(0, 0, W, H);
        parts.forEach(function (p) {
          p.vy += 0.22; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
          g.save(); g.globalAlpha = Math.max(0, 1 - t / life); g.translate(p.x, p.y); g.rotate(p.rot); g.fillStyle = p.c;
          if (p.shape === "star") star(p.r * 1.4);
          else if (p.shape === "leaf") { g.beginPath(); g.ellipse(0, 0, p.r * 1.3, p.r * 0.6, 0, 0, Math.PI * 2); g.fill(); }
          else g.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
          g.restore();
        });
        if (t < life) requestAnimationFrame(frame); else cv.remove();
      })(t0);
    };
    // "New badge" celebration card (also announced to screen readers)
    function card(icon, small, title, sub, onShare) {
      var old = $("fxBadge"); if (old) old.remove();
      var c = h("div", { id: "fxBadge", class: "fxbadge", role: "status" }, [
        h("span", { class: "fxicon", "aria-hidden": "true", text: icon }),
        h("div", null, [h("small", { text: small }), h("b", { text: title }), h("span", { class: "small muted", text: sub })]),
        onShare ? h("button", { class: "btn small", type: "button", onclick: function () { c.remove(); onShare(); } }, ["📣 Share"]) : null,
        h("button", { class: "icon", type: "button", "aria-label": "Close", onclick: function () { c.remove(); } }, ["✕"])
      ]);
      document.body.appendChild(c);
      if (!calm) api.burst(null, 2);
      var t = setTimeout(function () { c.classList.add("out"); setTimeout(function () { c.remove(); }, 400); }, 6500);
      c.addEventListener("mouseenter", function () { clearTimeout(t); });
      c.addEventListener("focusin", function () { clearTimeout(t); });
    }
    api.badge = function (b) { card(b.icon, "New badge", b.name, b.how, function () { shareBadge(b); }); };
    api.levelUp = function (L, b) {
      card(L.icon, "You grew!", "Level " + L.n + ": " + L.name, b ? "Plus a new badge: " + b.icon + " " + b.name : (L.next ? L.next.left + " points to " + L.next.name : "Top level reached"), function () {
        openShare({ kind: "level", icon: L.icon, heading: "I grew in Winsprout", title: L.icon + " " + L.name + " (level " + L.n + " of " + WS.LEVELS.length + ")", detail: L.points + " points from my wins at work" });
      });
    };
    return api;
  })();

  function plural(n, w) { return n + " " + w + (n === 1 ? "" : "s"); }
  function allBadges() { return WS.badges(data.wins, TODAY, settings().workdays, data.shows, data.shares); }
  function curLevel() { return WS.level(WS.points(data.wins, data.shows)); }
  function snapshot() { var had = {}; allBadges().forEach(function (b) { if (b.got) had[b.id] = 1; }); return { had: had, level: curLevel().n }; }
  // after something is saved: celebrate a new level first, then a new badge; otherwise show the normal message
  function celebrate(before, fallback) {
    var L = curLevel(), fresh = allBadges().filter(function (b) { return b.got && !before.had[b.id]; });
    if (L.n > before.level) fx.levelUp(L, fresh[0]);
    else if (fresh.length) fx.badge(fresh[0]);
    else if (fallback) toast(fallback);
  }

  /* ---------- tabs ---------- */
  var VIEWS = ["today", "week", "report", "talents", "badges", "settings"];
  function show(view, focus) {
    ui.view = view;
    VIEWS.forEach(function (v) {
      var on = v === view;
      $("t-" + v).setAttribute("aria-selected", on ? "true" : "false");
      $("t-" + v).tabIndex = on ? 0 : -1;
      $("v-" + v).hidden = !on;
    });
    render();
    fx.enter($("v-" + view));
    if (focus) $("t-" + view).focus();
    if (!TAB) SY.set("view", view);
  }
  VIEWS.forEach(function (v, i) {
    var b = $("t-" + v);
    b.addEventListener("click", function () { show(v); });
    b.addEventListener("keydown", function (e) {
      var j = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? VIEWS.length - 1 : null;
      if (j === null) return;
      e.preventDefault(); show(VIEWS[(j + VIEWS.length) % VIEWS.length], true);
    });
  });

  function render() {
    var map = { today: renderToday, week: renderWeek, report: renderReport, talents: renderTalents, badges: renderBadges, settings: renderSettings };
    var root = $("v-" + ui.view);
    root.textContent = "";
    map[ui.view](root);
  }

  /* ---------- storage pill ---------- */
  function renderPill() {
    var st = SY.status(), p = $("storePill");
    var label = {
      local: "Saved on this device", connecting: "Connecting…", syncing: "Syncing…", saving: "Saving…",
      cloud: "Saved to your OneDrive", offline: "Offline: will sync later"
    }[st.state] || "Saved on this device";
    p.textContent = (st.state === "cloud" ? "✓ " : "") + label;
    p.className = "pill " + st.state;
    p.setAttribute("aria-label", label + ". Open storage settings");
  }
  $("storePill").addEventListener("click", function () { goTo("settings"); });
  /* Inside Teams each screen is its own Teams tab (?view=…); move between them with Teams' own navigation */
  function goTo(view) {
    var T = window.microsoftTeams;
    if (TAB && T && T.pages && T.pages.currentApp && T.pages.currentApp.navigateTo) {
      try { T.pages.currentApp.navigateTo({ pageId: view }).catch(function () { show(view); }); return; } catch (e) { /* older Teams */ }
    }
    show(view);
  }
  SY.onChange(function () { renderPill(); if (ui.view === "settings") render(); });

  /* ---------- TODAY ---------- */
  function goalRing(done, goal) {
    var r = 26, c = 2 * Math.PI * r, f = Math.min(done / Math.max(goal, 1), 1);
    return svg("svg", { width: 68, height: 68, viewBox: "0 0 68 68", class: "ring", role: "img", "aria-label": done + " of " + goal + " wins this week" }, [
      svg("circle", { cx: 34, cy: 34, r: r, class: "ring-bg" }),
      (function () {
        var from = fx.ringFrom === null ? 0 : fx.ringFrom, fg = svg("circle", { cx: 34, cy: 34, r: r, class: "ring-fg", "stroke-dasharray": (c * Math.min(from, 1)) + " " + c, transform: "rotate(-90 34 34)" });
        fx.ringFrom = f;
        requestAnimationFrame(function () { requestAnimationFrame(function () { fg.setAttribute("stroke-dasharray", (c * f) + " " + c); }); });
        return fg;
      })(),
      svg("text", { x: 34, y: 39, "text-anchor": "middle", class: "ring-txt" }, [done + "/" + goal])
    ]);
  }

  function renderToday(root) {
    var s = settings(), st = WS.streak(data.wins, TODAY, s.workdays), wk = WS.weekStats(data.wins, TODAY);
    var todays = (WS.byDay(data.wins)[ui.logDay] || []);
    var hour = new Date().getHours();
    var hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    var prompt = WS.PROMPTS[(new Date().getDate()) % WS.PROMPTS.length];

    root.appendChild(h("div", { class: "hero" }, [
      h("div", null, [
        h("h1", { text: hello + (s.name ? ", " + s.name.split(" ")[0] : "") }),
        h("p", { class: "muted", text: st ? "🔥 " + plural(st, "working day") + " in a row. Keep it growing." : "Log one win today to start your streak." })
      ]),
      h("div", { class: "goal" }, [goalRing(wk.total, s.weeklyGoal), h("span", { class: "small muted", text: "this week" })])
    ]));
    root.appendChild(levelBar(curLevel(), false));

    // log form
    var input = h("textarea", { id: "winText", rows: 2, maxlength: 500, placeholder: prompt, "aria-label": "What did you get done?" });
    var catRow = h("div", { class: "chips", role: "radiogroup", "aria-label": "Type of win" });
    WS.CATEGORIES.forEach(function (c) {
      catRow.appendChild(h("button", { type: "button", role: "radio", class: "chip", "aria-checked": ui.cat === c.id ? "true" : "false", onclick: function () { ui.cat = c.id; render(); setTimeout(function () { $("winText").focus(); }, 0); } }, [c.emoji + " " + c.label]));
    });
    var impRow = h("div", { class: "seg", role: "radiogroup", "aria-label": "How big was it?" });
    [1, 2, 3].forEach(function (i) {
      impRow.appendChild(h("button", { type: "button", role: "radio", "aria-checked": ui.imp === i ? "true" : "false", onclick: function () { ui.imp = i; render(); } }, [WS.IMPACT[i]]));
    });
    var dayInput = h("input", { type: "date", id: "logDay", value: ui.logDay, max: TODAY, "aria-label": "Day of this win" });
    dayInput.addEventListener("change", function () { if (dayInput.value && dayInput.value <= TODAY) { ui.logDay = dayInput.value; render(); } });
    var add = h("button", { class: "btn", type: "submit" }, ["Add win"]);
    var form = h("form", { class: "card log", "aria-label": "Log a win" }, [
      h("label", { for: "winText", class: "lbl", text: ui.logDay === TODAY ? "What are you proud of today?" : "What did you get done on " + WS.nice(ui.logDay) + "?" }),
      input, catRow,
      h("div", { class: "row between wrap" }, [h("div", { class: "row" }, [h("span", { class: "small muted", text: "Size" }), impRow]), h("div", { class: "row wrap" }, [dayInput, add])])
    ]);
    form.addEventListener("submit", function (e) { e.preventDefault(); addWin(input.value); });
    input.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addWin(input.value); } });
    root.appendChild(form);

    // list for that day
    root.appendChild(h("h2", { text: ui.logDay === TODAY ? "Today's wins" : "Wins on " + WS.nice(ui.logDay) }));
    if (!todays.length) root.appendChild(h("p", { class: "empty", text: "Nothing yet. Even small wins count: a question answered, a fix, a thank-you." }));
    else root.appendChild(winList(todays));
    setTimeout(function () { if (ui.view === "today" && !ui.editing) { var t = $("winText"); if (t && document.activeElement === document.body) t.focus(); } }, 0);
  }

  function addWin(text) {
    text = String(text || "").trim();
    if (!text) { toast("Write a few words about your win first."); $("winText").focus(); return; }
    var before = snapshot();
    var nw = WS.makeWin(ui.logDay, text, ui.cat, ui.imp), big = nw.imp === 3, prevStreak = WS.streak(data.wins, TODAY, settings().workdays);
    data.wins.push(nw); fx.newId = nw.id;
    save();
    var addBtn = document.querySelector(".log .btn[type=submit]"), origin = addBtn ? addBtn.getBoundingClientRect() : null;
    var st = WS.streak(data.wins, TODAY, settings().workdays);
    ui.imp = 2;
    render();
    fx.newId = null; // the slide-in plays once
    fx.burst(origin, big ? 2 : 1);
    if (st > prevStreak) fx.bump(document.querySelector(".hero .muted"));
    celebrate(before, big ? "🚀 Big win saved. Be proud of this one!" + (st > 1 ? " " + st + "-day streak." : "") : (st > 1 ? "🌱 Win saved. " + st + "-day streak!" : "🌱 Win saved."));
    var t = $("winText"); if (t) t.focus();
  }

  function winList(list) {
    var ul = h("ul", { class: "wins" });
    list.forEach(function (w) {
      var c = WS.catById(w.c);
      if (ui.editing === w.id) {
        var ta = h("textarea", { rows: 2, maxlength: 500, "aria-label": "Edit win" }); ta.value = w.t;
        var sel = h("select", { "aria-label": "Type of win" });
        WS.CATEGORIES.forEach(function (x) { var o = h("option", { value: x.id, text: x.emoji + " " + x.label }); if (x.id === w.c) o.selected = true; sel.appendChild(o); });
        var imp = h("select", { "aria-label": "Size" });
        [1, 2, 3].forEach(function (i) { var o = h("option", { value: String(i), text: WS.IMPACT[i] }); if (i === w.imp) o.selected = true; imp.appendChild(o); });
        ul.appendChild(h("li", { class: "win editing" }, [ta, h("div", { class: "row" }, [sel, imp,
          h("button", { class: "btn small", type: "button", onclick: function () {
            var t = ta.value.trim(); if (!t) { toast("A win needs a few words."); return; }
            w.t = t.slice(0, 500); w.c = sel.value; w.imp = +imp.value; w.u = Date.now(); ui.editing = null; save(); render(); toast("Saved.");
          } }, ["Save"]),
          h("button", { class: "btn ghost small", type: "button", onclick: function () { ui.editing = null; render(); } }, ["Cancel"])
        ])]));
        setTimeout(function () { ta.focus(); }, 0);
        return;
      }
      ul.appendChild(h("li", { class: "win" + (w.imp === 3 ? " big" : "") + (fx.newId === w.id ? " new" : "") }, [
        h("span", { class: "wico", "aria-hidden": "true", text: c.emoji }),
        h("div", { class: "wbody" }, [h("p", { class: "wtext", text: w.t }), h("p", { class: "small muted", text: c.label + " · " + WS.IMPACT[w.imp] + (ui.view !== "today" ? " · " + WS.short(w.d) : "") })]),
        h("div", { class: "wact" }, [
          h("button", { class: "icon share", type: "button", title: "Share as a proud moment", "aria-label": "Share as a proud moment: " + w.t, onclick: function () {
            openShare({ kind: "win", icon: w.imp === 3 ? "🚀" : "🌟", heading: "Proud moment", title: w.t, detail: c.label + (w.imp === 3 ? " · Big win" : "") + " · " + WS.nice(w.d) });
          } }, ["📣"]),
          h("button", { class: "icon", type: "button", "aria-label": "Edit: " + w.t, onclick: function () { ui.editing = w.id; render(); } }, ["✎"]),
          h("button", { class: "icon", type: "button", "aria-label": "Delete: " + w.t, onclick: function () {
            ask("Delete this win?", "Delete", function () { w.del = true; w.u = Date.now(); save(); render(); toast("Deleted."); });
          } }, ["🗑"])
        ])
      ]));
    });
    return ul;
  }
  /* in-app confirm box (browser pop-ups are unreliable inside Teams) */
  function ask(msg, okLabel, onYes) {
    var back = document.activeElement, box = $("ask");
    function close() { box.hidden = true; document.removeEventListener("keydown", key, true); if (back && back.focus && document.body.contains(back)) back.focus(); }
    function key(e) {
      if (e.key === "Escape") { e.preventDefault(); close(); }
      if (e.key === "Tab") { var f = [yes, no], i = f.indexOf(document.activeElement); e.preventDefault(); f[(i + 1) % 2].focus(); }
    }
    $("askMsg").textContent = msg;
    var yes = $("askYes"), no = $("askNo");
    yes.textContent = okLabel || "OK";
    yes.onclick = function () { close(); onYes(); };
    no.onclick = close;
    box.onclick = function (e) { if (e.target === box) close(); };
    box.hidden = false;
    document.addEventListener("keydown", key, true);
    no.focus();
  }

  /* ---------- WEEK ---------- */
  function renderWeek(root) {
    var s = WS.weekStats(data.wins, ui.weekOf), days = s.days, goal = settings().weeklyGoal;
    var isThis = WS.weekStart(TODAY) === days[0];
    root.appendChild(h("div", { class: "row between wrap" }, [
      h("h1", { text: isThis ? "This week" : "Week of " + WS.short(days[0]) }),
      h("div", { class: "row" }, [
        h("button", { class: "btn ghost small", type: "button", "aria-label": "Previous week", onclick: function () { ui.weekOf = WS.addDays(days[0], -7); render(); } }, ["‹ Prev"]),
        h("button", { class: "btn ghost small", type: "button", disabled: isThis ? true : null, "aria-label": "Next week", onclick: function () { ui.weekOf = WS.addDays(days[0], 7); render(); } }, ["Next ›"])
      ])
    ]));
    root.appendChild(h("p", { class: "muted", text: WS.short(days[0]) + " – " + WS.nice(days[6]) }));

    var tiles = h("div", { class: "tiles" }, [
      tile(s.total, "wins", s.total >= goal ? "Goal reached 🎉" : (goal - s.total) + " to weekly goal"),
      tile(s.big.length, "big wins", ""),
      tile(Object.keys(s.cats).length, "kinds of work", ""),
      tile(WS.streak(data.wins, TODAY, settings().workdays), "day streak", "")
    ]);
    root.appendChild(tiles);
    root.appendChild(h("div", { class: "card" }, [h("h2", { text: "Wins per day" }), barChart(s.perDay.map(function (p) { return { label: WS.DAY[WS.dow(p.day)], value: p.count, sub: WS.short(p.day), today: p.day === TODAY }; }))]));
    root.appendChild(h("div", { class: "card" }, [h("h2", { text: "What kind of work" }), catBars(s.cats)]));

    var m = WS.byDay(data.wins), all = [];
    days.forEach(function (k) { (m[k] || []).forEach(function (w) { all.push(w); }); });
    root.appendChild(h("div", { class: "row between wrap" }, [h("h2", { text: "All wins this week" }),
      h("button", { class: "btn small", type: "button", disabled: all.length ? null : true, onclick: function () { copyText(WS.weekText(data.wins, ui.weekOf), "Week summary copied. Paste it in a Teams chat with your manager.", false); } }, ["Copy week summary"])]));
    root.appendChild(all.length ? winList(all) : h("p", { class: "empty", text: "No wins logged this week." }));
  }

  function tile(n, label, note) {
    return h("div", { class: "tile" }, [h("b", { text: String(n) }), h("span", { text: label }), note ? h("small", { class: "muted", text: note }) : null]);
  }

  function barChart(items) {
    var W = 560, H = 190, pad = 28, max = Math.max(1, Math.max.apply(null, items.map(function (i) { return i.value; })));
    var bw = (W - pad * 2) / items.length;
    var g = svg("svg", { viewBox: "0 0 " + W + " " + H, class: "chart", role: "img", "aria-label": items.map(function (i) { return i.label + " " + i.value; }).join(", ") });
    var baseY = H - 34;
    g.appendChild(svg("line", { x1: pad, x2: W - pad, y1: baseY, y2: baseY, class: "axis" }));
    items.forEach(function (it, i) {
      var bh = (baseY - 18) * (it.value / max), x = pad + i * bw + bw * 0.18, w = bw * 0.64;
      g.appendChild(svg("rect", { x: x, y: baseY - bh, width: w, height: Math.max(bh, it.value ? 3 : 0), rx: 5, class: "bar" + (it.today ? " today" : "") }));
      if (it.value) g.appendChild(svg("text", { x: x + w / 2, y: baseY - bh - 6, "text-anchor": "middle", class: "val" }, [String(it.value)]));
      g.appendChild(svg("text", { x: x + w / 2, y: baseY + 15, "text-anchor": "middle", class: "lab" }, [it.label]));
      if (it.sub) g.appendChild(svg("text", { x: x + w / 2, y: baseY + 28, "text-anchor": "middle", class: "sub" }, [it.sub]));
    });
    return g;
  }

  function catBars(cats) {
    var total = Object.keys(cats).reduce(function (s, k) { return s + cats[k]; }, 0);
    if (!total) return h("p", { class: "empty", text: "Log a few wins to see this." });
    var wrap = h("div", { class: "cats" });
    WS.CATEGORIES.forEach(function (c) {
      var n = cats[c.id] || 0; if (!n) return;
      var pct = Math.round(n / total * 100);
      wrap.appendChild(h("div", { class: "cat" }, [
        h("span", { class: "cname", text: c.emoji + " " + c.label }),
        h("span", { class: "track", "aria-hidden": "true" }, [h("span", { class: "fill", style: "width:" + pct + "%" })]),
        h("span", { class: "cnum", text: n + " (" + pct + "%)" })
      ]));
    });
    return wrap;
  }

  /* ---------- REPORT ---------- */
  function currentPeriod() {
    var p = WS.periods(TODAY);
    if (ui.period === "custom") return { from: ui.from || p.last12.from, to: ui.to || TODAY };
    return p[ui.period] || p.last12;
  }
  function renderReport(root) {
    var p = WS.periods(TODAY), per = currentPeriod();
    var rep = WS.report(data.wins, per.from, per.to, data.shows);
    root.appendChild(h("h1", { text: "My achievements report" }));
    root.appendChild(h("p", { class: "muted", text: "Use this for appraisals, 1:1s or your CV. You decide who sees it." }));

    var sel = h("select", { id: "period", "aria-label": "Report period" });
    Object.keys(p).forEach(function (k) { var o = h("option", { value: k, text: p[k].label }); if (k === ui.period) o.selected = true; sel.appendChild(o); });
    var oc = h("option", { value: "custom", text: "Custom dates" }); if (ui.period === "custom") oc.selected = true; sel.appendChild(oc);
    sel.addEventListener("change", function () { ui.period = sel.value; render(); });
    var row = h("div", { class: "row wrap" }, [h("label", { for: "period", class: "small", text: "Period" }), sel]);
    if (ui.period === "custom") {
      var f = h("input", { type: "date", value: per.from, max: TODAY, "aria-label": "From" }), t = h("input", { type: "date", value: per.to, max: TODAY, "aria-label": "To" });
      f.addEventListener("change", function () { ui.from = f.value; render(); });
      t.addEventListener("change", function () { ui.to = t.value; render(); });
      row.appendChild(f); row.appendChild(h("span", { text: "to" })); row.appendChild(t);
    }
    root.appendChild(row);

    root.appendChild(h("div", { class: "tiles" }, [
      tile(rep.total, "wins", WS.nice(rep.from) + " – " + WS.nice(rep.to)),
      tile(rep.big.length, "big wins", ""),
      tile(rep.activeDays, "days with wins", ""),
      tile(WS.bestStreak(rep.list, settings().workdays), "best streak", "")
    ]));

    var cloud = SY.status().state === "cloud";
    root.appendChild(h("div", { class: "row wrap actions" }, [
      h("button", { class: "btn", type: "button", disabled: rep.total ? null : true, onclick: function () { wordReport(rep, cloud); } }, [cloud ? "Save Word report to my OneDrive" : "Download Word report"]),
      h("button", { class: "btn ghost", type: "button", disabled: rep.total ? null : true, onclick: function () { copyReport(rep); } }, ["Copy report"])
    ]));
    if (ui.savedReport && ui.savedReport.url) root.appendChild(h("p", { class: "row wrap small" }, ["✓ Saved " + ui.savedReport.name + " to OneDrive › Apps › Winsprout.",
      h("button", { class: "btn ghost small", type: "button", onclick: function () { SY.openLink(ui.savedReport.url); } }, ["Open in Word for the web ", h("span", { class: "popout", "aria-hidden": "true", text: "↗" })])]));
    if (!rep.total) { root.appendChild(h("p", { class: "empty", text: "No wins in this period yet. Your report fills up as you log wins." })); return; }

    var months = rep.monthKeys.map(function (mk) { return { label: WS.MON[+mk.slice(5, 7) - 1], value: (rep.months[mk] || []).length, sub: mk.slice(2, 4) === TODAY.slice(2, 4) ? "" : "'" + mk.slice(2, 4) }; });
    root.appendChild(h("div", { class: "card" }, [h("h2", { text: "Wins by month" }), barChart(months.slice(-13))]));
    root.appendChild(h("div", { class: "card" }, [h("h2", { text: "What kind of work" }), catBars(rep.cats)]));
    if (rep.big.length) {
      root.appendChild(h("h2", { text: "Highlights (big wins)" }));
      root.appendChild(winList(rep.big));
    }
    if (rep.shows.length) {
      root.appendChild(h("h2", { text: "Talents shared with colleagues" }));
      root.appendChild(showList(rep.shows, false));
    }
    root.appendChild(h("h2", { text: "Everything, month by month" }));
    rep.monthKeys.slice().reverse().forEach(function (mk) {
      var list = rep.months[mk] || []; if (!list.length) return;
      root.appendChild(h("details", { class: "month" }, [h("summary", { text: WS.MON[+mk.slice(5, 7) - 1] + " " + mk.slice(0, 4) + " · " + plural(list.length, "win") }), winList(list)]));
    });
  }

  function reportName(rep) { return "Winsprout achievements " + rep.from + " to " + rep.to + ".docx"; }
  function wordReport(rep, cloud) {
    var dates = WS.badgeDates(data.wins, settings().workdays, data.shows, data.shares);
    rep.extra = { level: curLevel(), badges: allBadges().filter(function (b) { return b.got && dates[b.id] && dates[b.id] >= rep.from && dates[b.id] <= rep.to; })
      .map(function (b) { return { icon: b.icon, name: b.name, how: b.how, date: dates[b.id] }; }) };
    var bytes = WS.reportDocx(rep, settings().name);
    if (cloud) {
      toast("Saving to your OneDrive…");
      SY.saveReport(bytes, reportName(rep)).then(function (url) {
        ui.savedReport = { name: reportName(rep), url: url || "" };
        render();
        toast("Saved to OneDrive › Apps › Winsprout.");
      }, function () { toast("Couldn't save to OneDrive. Downloading instead."); download(bytes, reportName(rep), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"); });
      return;
    }
    download(bytes, reportName(rep), "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  }
  function download(bytes, name, type) {
    try {
      var url = URL.createObjectURL(new Blob([bytes], { type: type }));
      var a = h("a", { href: url, download: name }); document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      toast("Downloaded " + name);
    } catch (e) { toast("Your browser blocked the download. Use Copy instead."); }
  }
  function reportText(rep) {
    var L = [(settings().name ? settings().name + " — " : "") + "My achievements, " + WS.nice(rep.from) + " to " + WS.nice(rep.to), "",
      plural(rep.total, "win") + " on " + plural(rep.activeDays, "day") + ", " + plural(rep.big.length, "big win") + "."];
    WS.CATEGORIES.forEach(function (c) { if (rep.cats[c.id]) L.push("• " + c.label + ": " + rep.cats[c.id]); });
    if (rep.big.length) { L.push("", "Highlights"); rep.big.forEach(function (w) { L.push("• " + WS.short(w.d) + " — " + w.t); }); }
    rep.monthKeys.forEach(function (mk) {
      var list = rep.months[mk] || []; if (!list.length) return;
      L.push("", WS.MON[+mk.slice(5, 7) - 1] + " " + mk.slice(0, 4));
      list.forEach(function (w) { L.push("• " + (w.imp === 3 ? "★ " : "") + w.t); });
    });
    if (rep.shows && rep.shows.length) {
      L.push("", "Talents shared with colleagues");
      rep.shows.forEach(function (x) { L.push("• " + WS.short(x.d) + " — " + x.tn + ": " + x.title); });
    }
    return L.join("\n");
  }
  function copyReport(rep) { copyText(reportText(rep), "Report copied. Paste it into Word, Outlook or your appraisal form.", true); }
  function copyText(text, okMsg, html) {
    var done = false;
    function onCopy(e) { try { e.clipboardData.setData("text/plain", text); if (html) e.clipboardData.setData("text/html", html); e.preventDefault(); done = true; } catch (x) { done = false; } }
    document.addEventListener("copy", onCopy);
    try { document.execCommand("copy"); } catch (e) { /* not allowed */ }
    document.removeEventListener("copy", onCopy);
    if (done) { toast(okMsg); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { toast(okMsg); }, function () { showCopyBox(text); });
    else showCopyBox(text);
  }
  function showCopyBox(text) {
    var ta = h("textarea", { class: "copybox", rows: 8, readonly: true, "aria-label": "Text to copy" }); ta.value = text;
    $("v-" + ui.view).appendChild(ta); ta.focus(); ta.select();
    toast("Copying was blocked. Select the text below and press Ctrl+C.");
  }

  /* ---------- TALENTS ---------- */
  function myTalents() { return WS.live(data.talents); }

  function renderTalents(root) {
    var sh = ui.share, mine = myTalents();
    root.appendChild(h("h1", { text: "Talents" }));
    root.appendChild(h("p", { class: "muted", text: "Storytelling, singing, speaking, art… Share them with your colleagues whenever you like. No need to wait for an HR event." }));

    /* my talents */
    var card = h("div", { class: "card" }, [h("h2", { text: "My talents" })]);
    var chips = h("div", { class: "chips", role: "group", "aria-label": "Pick your talents" });
    WS.TALENTS.forEach(function (t) {
      var on = WS.hasTalent(data.talents, t.n);
      chips.appendChild(h("button", { type: "button", class: "chip", "aria-pressed": on ? "true" : "false", onclick: function () { toggleTalent(t.n); } }, [t.e + " " + t.n]));
    });
    card.appendChild(chips);
    var own = h("input", { type: "text", id: "ownTalent", maxlength: 40, placeholder: "e.g. Magic tricks" });
    var addOwn = function () {
      var v = own.value.trim();
      if (!v) { toast("Type a talent first."); own.focus(); return; }
      if (WS.hasTalent(data.talents, v)) { toast("You already have that one."); return; }
      data.talents.push(WS.makeTalent(v)); save(); render(); toast("Added " + v + ".");
      var o = $("ownTalent"); if (o) o.focus();
    };
    own.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); addOwn(); } });
    card.appendChild(h("div", { class: "row wrap" }, [h("label", { for: "ownTalent", class: "small", text: "Add your own" }), own,
      h("button", { class: "btn ghost small", type: "button", onclick: addOwn }, ["Add"])]));
    if (mine.length) {
      var ul = h("ul", { class: "talents" });
      mine.forEach(function (t) {
        var note = h("input", { type: "text", maxlength: 120, value: t.note || "", placeholder: "One line about it (optional)", "aria-label": "About your " + t.n });
        note.addEventListener("change", function () { t.note = note.value.trim(); t.u = Date.now(); save(); toast("Saved."); });
        ul.appendChild(h("li", { class: "talent" }, [
          h("span", { class: "tname" }, [h("span", { "aria-hidden": "true", text: t.e + " " }), t.n]), note,
          h("button", { class: "icon", type: "button", "aria-label": "Remove " + t.n, onclick: function () { t.del = true; t.u = Date.now(); save(); render(); toast("Removed " + t.n + "."); } }, ["🗑"])
        ]));
      });
      card.appendChild(ul);
      var line = h("input", { type: "text", id: "talentLine", maxlength: 140, value: settings().talentLine || "", placeholder: "e.g. Happy to tell a story at our next team event!" });
      line.addEventListener("input", function () { settings().talentLine = line.value; cardPreview(); });
      line.addEventListener("change", function () { settings().talentLine = line.value.trim(); settings().u = Date.now(); save(); });
      card.appendChild(h("label", { for: "talentLine", class: "lbl", text: "A line for your talent card (optional)" }));
      card.appendChild(line);
      card.appendChild(h("p", { class: "lbl", id: "tcLabel", text: "Your talent card" }));
      card.appendChild(h("div", { class: "preview tcard", id: "tcPreview", role: "region", "aria-labelledby": "tcLabel" }));
      card.appendChild(h("div", { class: "row wrap actions" }, [h("button", { class: "btn small", type: "button", onclick: function () {
        var c = WS.talentCard(settings().name, data.talents, data.shows, (settings().talentLine || "").trim());
        copyText(c.text, "Talent card copied. Paste it in a Teams chat, Outlook or your profile.", c.html);
      } }, ["Copy my talent card"]), h("span", { class: "small muted", text: "Pastes with formatting in Teams and Outlook." })]));
      setTimeout(cardPreview, 0);
    } else card.appendChild(h("p", { class: "empty", text: "Pick one or more talents above. Only you see this list until you share something." }));
    root.appendChild(card);

    /* share a talent moment */
    var form = h("form", { class: "card", "aria-label": "Share a talent moment" }, [h("h2", { text: "Share a talent moment" })]);
    if (!mine.length) {
      form.appendChild(h("p", { class: "muted", text: "Add a talent first, then share a story, a song, a drawing or a short talk with your colleagues." }));
      root.appendChild(form); root.appendChild(historyCard()); return;
    }
    if (!sh.tid || !mine.some(function (t) { return t.id === sh.tid; })) sh.tid = mine[0].id;
    var tsel = h("select", { id: "shTalent" });
    mine.forEach(function (t) { var o = h("option", { value: t.id, text: t.e + " " + t.n }); if (t.id === sh.tid) o.selected = true; tsel.appendChild(o); });
    tsel.addEventListener("change", function () { sh.tid = tsel.value; preview(); });
    var title = h("input", { type: "text", id: "shTitle", maxlength: 100, value: sh.title, placeholder: "e.g. A 2-minute story about my first job", required: true });
    title.addEventListener("input", function () { sh.title = title.value; preview(); });
    var msg = h("textarea", { id: "shMsg", rows: 3, maxlength: 600, placeholder: "Say a few words (optional)" }); msg.value = sh.msg;
    msg.addEventListener("input", function () { sh.msg = msg.value; preview(); });
    var photo = h("input", { type: "file", id: "shPhoto", multiple: true, accept: "image/png,image/jpeg,image/webp,image/gif", disabled: sh.images.length >= WS.MAX_PHOTOS ? true : null });
    photo.addEventListener("change", function () { loadPhotos(Array.prototype.slice.call(photo.files || [])); });

    form.appendChild(h("label", { for: "shTalent", class: "lbl", text: "Talent" })); form.appendChild(tsel);
    form.appendChild(h("label", { for: "shTitle", class: "lbl", text: "Title" })); form.appendChild(title);
    form.appendChild(h("label", { for: "shMsg", class: "lbl", text: "Message" })); form.appendChild(msg);
    var media = h("fieldset", { class: "media" }, [h("legend", { class: "lbl", text: "Photo, video or audio (add at least one)" })]);
    media.appendChild(h("label", { for: "shPhoto", class: "small", text: "Photos from your device (up to " + WS.MAX_PHOTOS + ")" }));
    media.appendChild(photo);
    if (sh.images.length) {
      var thumbs = h("ul", { class: "thumbs" });
      sh.images.forEach(function (im, i) {
        thumbs.appendChild(h("li", null, [h("img", { src: "data:" + im.type + ";base64," + im.base64, alt: im.name }),
          h("button", { class: "icon", type: "button", "aria-label": "Remove photo " + im.name, onclick: function () { sh.images.splice(i, 1); render(); } }, ["✕"])]));
      });
      media.appendChild(thumbs);
    }
    media.appendChild(h("p", { class: "small", text: "Links to your videos or audio (up to " + WS.MAX_LINKS + ")" }));
    sh.links.forEach(function (val, i) {
      var li = h("input", { type: "url", id: i ? "shLink" + (i + 1) : "shLink", maxlength: 500, value: val, placeholder: "https://…", "aria-label": "Video or audio link " + (i + 1) });
      li.addEventListener("input", function () { sh.links[i] = li.value; preview(); });
      var rowKids = [li];
      if (sh.links.length > 1) rowKids.push(h("button", { class: "icon", type: "button", "aria-label": "Remove link " + (i + 1), onclick: function () { sh.links.splice(i, 1); render(); } }, ["✕"]));
      media.appendChild(h("div", { class: "row linkrow" }, rowKids));
    });
    if (sh.links.length < WS.MAX_LINKS) media.appendChild(h("button", { class: "btn ghost small addlink", type: "button", onclick: function () { sh.links.push(""); render(); var n = $("shLink" + sh.links.length); if (n) n.focus(); } }, ["+ Add another link"]));
    media.appendChild(h("p", { class: "small muted", text: "Put your clip on your own OneDrive, Stream or YouTube first, then paste its link. Check that colleagues are allowed to open it: some companies block YouTube or outside sharing." }));
    form.appendChild(media);
    var cheer = h("input", { type: "checkbox", id: "shCheer" }); cheer.checked = sh.cheer !== false;
    cheer.addEventListener("change", function () { sh.cheer = cheer.checked; preview(); });
    form.appendChild(h("label", { class: "check", for: "shCheer" }, [cheer, " Invite colleagues to react and reply (adds \"" + WS.CHEER + "\")"]));

    /* where to post */
    form.appendChild(h("h3", { class: "lbl", text: "Where to share" }));
    form.appendChild(destination());

    form.appendChild(h("p", { class: "lbl", id: "pvLabel", text: "Preview" }));
    form.appendChild(h("div", { class: "preview", id: "shPreview", role: "region", "aria-labelledby": "pvLabel" }));
    var canPost = SY.canShare() && sh.ready === true;
    form.appendChild(h("div", { class: "row wrap actions" }, [
      canPost ? h("button", { class: "btn", type: "submit", disabled: sh.posting ? true : null }, [sh.posting ? "Posting…" : "Post to Teams"]) : null,
      h("button", { class: canPost ? "btn ghost" : "btn", type: "button", onclick: function () {
        var f = shareFields(), bad = checkShare(f); if (bad) { toast(bad); return; }
        sh.copied = true; render();
        copyText(WS.talentText(f), f.images.length ? "Copied. Paste it in Teams, then add your " + (f.images.length > 1 ? "photos" : "photo") + " there." : "Copied. Paste it into any Teams chat or channel.");
      } }, ["Copy post"])
    ]));
    if (sh.copied) form.appendChild(h("div", { class: "row wrap" }, [h("span", { class: "small muted", text: "Posted it yourself?" }),
      h("button", { class: "btn ghost small", type: "button", onclick: function () {
        var f = shareFields(), bad = checkShare(f); if (bad) { toast(bad); return; }
        recordShow(f, "Posted by me", "");
      } }, ["Add it to my talent moments"])]));
    if (sh.err) form.appendChild(h("p", { class: "small warn", role: "alert", text: sh.err }));
    if (sh.needIT) form.appendChild(itPanel(true));
    form.addEventListener("submit", function (e) { e.preventDefault(); postShare(); });
    root.appendChild(form);
    preview();
    root.appendChild(historyCard());

    if (SY.canShare() && !sh.checked) {
      sh.checked = true;
      SY.shareReady().then(function (ok) { if (ok) { sh.ready = true; loadDest(); } });
    }
  }

  function cardPreview() {
    var box = $("tcPreview"); if (!box) return;
    var c = WS.talentCard(settings().name, data.talents, data.shows, (settings().talentLine || "").trim());
    box.innerHTML = c.html; // built from escaped text only (WS.escHtml), links limited to https
    box.querySelectorAll("a").forEach(function (a) { a.target = "_blank"; a.rel = "noopener"; });
  }

  function toggleTalent(name) {
    var t = WS.live(data.talents).filter(function (x) { return x.n.toLowerCase() === name.toLowerCase(); })[0];
    if (t) { t.del = true; t.u = Date.now(); toast("Removed " + name + "."); }
    else { data.talents.push(WS.makeTalent(name)); toast("Added " + name + "."); }
    save(); render();
  }

  function shareFields() {
    var sh = ui.share, t = myTalents().filter(function (x) { return x.id === sh.tid; })[0] || { n: "", e: "✨" };
    var links = sh.links.map(function (l) { return String(l || "").trim(); }).filter(Boolean);
    return { tn: t.n, te: t.e, title: sh.title.trim(), msg: sh.msg.trim(), links: links, images: sh.images.slice(), cheer: sh.cheer !== false };
  }

  function preview() {
    var box = $("shPreview"); if (!box) return;
    var f = shareFields(); box.textContent = "";
    box.appendChild(h("p", null, [h("b", { text: f.te + " Talent moment: " + f.tn })]));
    box.appendChild(h("p", null, [h("b", { text: f.title || "Your title" })]));
    if (f.msg) f.msg.split(/\r?\n/).forEach(function (line) { box.appendChild(h("p", { text: line })); });
    f.links.forEach(function (l, i) {
      var ok = WS.safeLink(l);
      if (!ok) { box.appendChild(h("p", { class: "small warn", text: "Link " + (f.links.length > 1 ? i + 1 + " " : "") + "must start with https://" })); return; }
      box.appendChild(h("p", null, ["▶ ", h("a", { href: ok, target: "_blank", rel: "noopener" }, ["Watch or listen" + (f.links.length > 1 ? " (" + (i + 1) + ")" : "") + " (opens in your browser) ", h("span", { class: "popout", "aria-hidden": "true", text: "↗" })])]));
    });
    f.images.forEach(function (im, i) { box.appendChild(h("img", { src: "data:" + im.type + ";base64," + im.base64, alt: (f.title || "Photo") + (f.images.length > 1 ? " (" + (i + 1) + ")" : ""), class: "pimg" })); });
    if (f.cheer) box.appendChild(h("p", { text: WS.CHEER }));
    box.appendChild(h("p", { class: "small muted" }, [h("em", { text: "Shared from Winsprout" })]));
  }

  function loadPhotos(files) {
    var room = WS.MAX_PHOTOS - ui.share.images.length;
    if (files.length > room) toast("You can add up to " + WS.MAX_PHOTOS + " photos. Only the first " + room + " were added.");
    files.slice(0, Math.max(0, room)).forEach(loadPhoto);
  }
  function loadPhoto(file) {
    if (!/^image\//.test(file.type)) { toast("Choose photos (JPG, PNG, WEBP or GIF). Video and audio go in as links."); return; }
    if (file.size > 15 * 1024 * 1024) { toast(file.name + " is too big. Choose photos under 15 MB."); return; }
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function () {
      var max = 1280, w = img.naturalWidth, hgt = img.naturalHeight, sc = Math.min(1, max / Math.max(w, hgt));
      var cv = document.createElement("canvas"); cv.width = Math.round(w * sc); cv.height = Math.round(hgt * sc);
      var cx = cv.getContext("2d"); cx.fillStyle = "#fff"; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      // keep each photo small enough that 4 fit in one Teams message
      var q = 0.82, b64 = cv.toDataURL("image/jpeg", q).split(",")[1];
      while (b64.length > 800000 && q > 0.35) { q -= 0.12; b64 = cv.toDataURL("image/jpeg", q).split(",")[1]; }
      var dw = Math.min(cv.width, 480), dh = Math.round(cv.height * dw / cv.width);
      if (ui.share.images.length >= WS.MAX_PHOTOS) return;
      ui.share.images.push({ base64: b64, type: "image/jpeg", w: dw, h: dh, name: file.name.slice(0, 60) });
      render();
    };
    img.onerror = function () { URL.revokeObjectURL(url); toast("Couldn't read that photo."); };
    img.src = url;
  }

  function destination() {
    var sh = ui.share, box = h("div", { class: "dest" });
    if (!SY.canShare()) {
      box.appendChild(h("p", { class: "small muted", text: "Posting straight to a chat or channel works when Winsprout is opened inside Microsoft Teams with a work or school account. You can copy your post and paste it anywhere." }));
      return box;
    }
    if (sh.ready !== true) {
      box.appendChild(h("p", { class: "small muted", text: "The first time, Microsoft asks you to allow Winsprout to see your chat and channel names and post messages that you choose to send. Winsprout never reads your messages. Some companies need IT to approve this." }));
      if (!sh.needIT) box.appendChild(itPanel(false));
      box.appendChild(h("button", { class: "btn ghost", type: "button", onclick: function () {
        sh.err = "";
        SY.connectShare().then(function () { sh.ready = true; sh.needIT = false; loadDest(); }, function (e) {
          var m = String(e && (e.errorCode || e.message) || "");
          if (/user_cancelled|popup_window_error|cancel/i.test(m) && !/AADSTS/.test(m)) { sh.err = "Permission wasn't given. Press the button again when you're ready."; refreshDest(); return; }
          sh.needIT = true;
          sh.err = "Microsoft didn't allow Winsprout to post for you. Your company probably needs IT to approve it first (see below). You can still copy your post.";
          refreshDest();
        });
      } }, ["Choose a chat or channel"]));
      return box;
    }
    var seg = h("div", { class: "seg", role: "radiogroup", "aria-label": "Share to" });
    [["chat", "A chat"], ["channel", "A team channel"]].forEach(function (k) {
      seg.appendChild(h("button", { type: "button", role: "radio", "aria-checked": sh.kind === k[0] ? "true" : "false", onclick: function () { sh.kind = k[0]; refreshDest(); } }, [k[1]]));
    });
    box.appendChild(seg);
    if (sh.loading) { box.appendChild(h("p", { class: "small muted", text: "Loading your chats and teams…" })); return box; }
    if (sh.kind === "chat") {
      var cs = h("select", { id: "shChat", "aria-label": "Chat" });
      cs.appendChild(h("option", { value: "", text: (sh.chats && sh.chats.length) ? "Choose a chat…" : "No recent chats found" }));
      (sh.chats || []).forEach(function (c) { var o = h("option", { value: c.id, text: c.label }); if (c.id === sh.chatId) o.selected = true; cs.appendChild(o); });
      cs.addEventListener("change", function () { sh.chatId = cs.value; });
      box.appendChild(cs);
    } else {
      var ts = h("select", { id: "shTeam", "aria-label": "Team" });
      ts.appendChild(h("option", { value: "", text: (sh.teams && sh.teams.length) ? "Choose a team…" : "You're not in any teams" }));
      (sh.teams || []).forEach(function (t) { var o = h("option", { value: t.id, text: t.label }); if (t.id === sh.teamId) o.selected = true; ts.appendChild(o); });
      ts.addEventListener("change", function () { sh.teamId = ts.value; sh.channelId = ""; if (sh.teamId && !sh.channels[sh.teamId]) loadChannels(sh.teamId); else refreshDest(); });
      box.appendChild(ts);
      if (sh.teamId) {
        var list = sh.channels[sh.teamId];
        var chs = h("select", { id: "shChannel", "aria-label": "Channel", disabled: list ? null : true });
        chs.appendChild(h("option", { value: "", text: list ? "Choose a channel…" : "Loading channels…" }));
        (list || []).forEach(function (c) { var o = h("option", { value: c.id, text: c.label }); if (c.id === sh.channelId) o.selected = true; chs.appendChild(o); });
        chs.addEventListener("change", function () { sh.channelId = chs.value; });
        box.appendChild(chs);
      }
    }
    return box;
  }

  function loadDest() {
    var sh = ui.share; sh.loading = true; refreshDest();
    Promise.all([SY.listChats().catch(function () { return []; }), SY.listTeams().catch(function () { return []; })]).then(function (r) {
      sh.chats = r[0]; sh.teams = r[1]; sh.loading = false; refreshDest();
    });
  }
  function loadChannels(teamId) {
    refreshDest();
    SY.listChannels(teamId).then(function (list) { ui.share.channels[teamId] = list; }, function () { ui.share.channels[teamId] = []; toast("Couldn't load channels for that team."); })
      .then(function () { refreshDest(); });
  }

  function destLabel() {
    var sh = ui.share, find = function (arr, id) { return (arr || []).filter(function (x) { return x.id === id; })[0]; };
    if (sh.kind === "chat") { var c = find(sh.chats, sh.chatId); return c ? c.label : ""; }
    var t = find(sh.teams, sh.teamId), ch = find(sh.channels[sh.teamId], sh.channelId);
    return t && ch ? t.label + " › " + ch.label : "";
  }

  function postShare() {
    var sh = ui.share, f = shareFields();
    if (sh.posting) return;
    var bad = checkShare(f); if (bad) { toast(bad); return; }
    var dest = sh.kind === "chat" ? { kind: "chat", chatId: sh.chatId } : { kind: "channel", teamId: sh.teamId, channelId: sh.channelId };
    var label = destLabel();
    if (!label) { toast(sh.kind === "chat" ? "Choose a chat to post in." : "Choose a team and channel to post in."); return; }
    ask("Post this talent moment to " + label + "? Everyone there will see it.", "Post", function () { doPost(dest, label, f); });
  }
  function doPost(dest, label, f) {
    var sh = ui.share;
    sh.posting = true; sh.err = ""; render();
    var had = snapshot();
    SY.post(dest, WS.talentMessage(f)).then(function (res) {
      sh.posting = false;
      recordShow(f, label, res && res.webUrl, had);
    }, function (e) {
      sh.posting = false;
      var st = e && e.status;
      if (st === 403) sh.needIT = true;
      sh.err = st === 403 ? "Teams didn't allow this post. Either your company needs IT to approve Winsprout (see below), or you can't post in that chat or channel. You can still use Copy post."
        : st === 413 ? "The photo is too large for Teams. Remove it or choose a smaller one."
        : "Couldn't post right now. Check your connection and try again, or use Copy post.";
      render();
    });
  }

  function checkShare(f) {
    if (!f.title) { setTimeout(function () { var t = $("shTitle"); if (t) t.focus(); }, 0); return "Give your talent moment a title first."; }
    for (var i = 0; i < f.links.length; i++) if (!WS.safeLink(f.links[i])) { setTimeout(function () { var l = $("shLink"); if (l) l.focus(); }, 0); return "Each link must start with https://"; }
    if (!f.images.length && !f.links.length) { setTimeout(function () { var p = $("shPhoto"); if (p) p.focus(); }, 0); return "Add a photo, or a link to your video or audio."; }
    return "";
  }

  function recordShow(f, label, url, had) {
    var sh = ui.share;
    var before = had || snapshot();
    data.shows.push(WS.makeShow({ d: TODAY, tn: f.tn, te: f.te, title: f.title, msg: f.msg, links: f.links, images: f.images, to: label, url: url }));
    save();
    sh.title = ""; sh.msg = ""; sh.links = [""]; sh.images = []; sh.copied = false; sh.err = "";
    render();
    fx.burst(null, 2);
    celebrate(before, url ? "🎉 Posted to " + label + "." : "Added to your talent moments.");
  }

  /* Help for companies where IT must approve Winsprout */
  function itPanel(open) {
    var link = SY.adminConsentUrl();
    var msg = ["Hi IT team,", "",
      "Please approve the Microsoft Teams app \"Winsprout\" (publisher: RuBuild Services) so I can share talent posts in Teams chats and channels.", "",
      "It asks for these Microsoft Graph delegated permissions (it acts only as the signed-in user, never in the background):",
      "• Chat.ReadBasic, Team.ReadBasic.All, Channel.ReadBasic.All: show chat, team and channel names so I can pick where to post",
      "• ChatMessage.Send, ChannelMessage.Send: post the message I write, after I confirm",
      "• Files.ReadWrite.AppFolder, User.Read: back up my own data to my OneDrive app folder",
      "Winsprout doesn't read messages, and RuBuild Services has no server that receives data.", "",
      "Who can approve: a Global Administrator, Privileged Role Administrator, Cloud Application Administrator or Application Administrator.",
      link ? "One-click approval link for our company: " + link : "Approve in the Microsoft Entra admin center: Enterprise apps > All applications > Winsprout > Permissions > Grant admin consent.",
      "If Winsprout is blocked in Teams, a Teams admin can allow it in the Teams admin center: Teams apps > Manage apps > Winsprout > Allow.",
      "Details for IT: https://rubuild.com/winsprout/it-admins.html", "", "Thank you!"].join("\n");
    return h("details", { class: "it", open: open ? true : null }, [
      h("summary", { text: "Does your company need IT to approve apps?" }),
      h("p", { class: "small", text: "If Microsoft shows \"Need admin approval\", someone in your IT team must approve Winsprout once for the whole company. Only an admin with one of these roles can do it: Global Administrator, Privileged Role Administrator, Cloud Application Administrator or Application Administrator. Your IT helpdesk will know who that is." }),
      h("p", { class: "small", text: "If Microsoft offers a \"Request approval\" button, use it: your request goes straight to those admins. Otherwise, send IT this ready-made request:" }),
      h("button", { class: "btn ghost small", type: "button", onclick: function () { copyText(msg, "Request copied. Paste it into an email or chat to your IT helpdesk."); } }, ["Copy request for IT"]),
      h("p", { class: "small muted", text: "Until it's approved, use Copy post and paste it into Teams yourself. Then press \"Add it to my talent moments\" so it still counts for your badges." })
    ]);
  }

  function historyCard() {
    var card = h("div", { class: "card" }, [h("h2", { text: "My talent moments" })]);
    var list = WS.live(data.shows).slice().reverse();
    if (!list.length) card.appendChild(h("p", { class: "empty", text: "Nothing shared yet. Your first post earns the 🎤 On stage badge." }));
    else card.appendChild(showList(list, true));
    return card;
  }
  function showList(list, actions) {
    var ul = h("ul", { class: "wins" });
    list.forEach(function (x) {
      ul.appendChild(h("li", { class: "win" }, [
        h("span", { class: "wico", "aria-hidden": "true", text: x.te }),
        h("div", { class: "wbody" }, [h("p", { class: "wtext", text: x.title }), h("p", { class: "small muted", text: x.tn + " · " + WS.short(x.d) + (x.to ? " · " + x.to : "") })]),
        actions ? h("div", { class: "wact" }, [
          x.url ? h("button", { class: "btn ghost small", type: "button", onclick: function () { SY.openLink(x.url); } }, ["Open in Teams"]) : null,
          h("button", { class: "icon", type: "button", "aria-label": "Remove from my list: " + x.title, onclick: function () {
            ask("Remove this from your list? The post stays in Teams; delete it there if you want it gone.", "Remove", function () { x.del = true; x.u = Date.now(); save(); render(); toast("Removed from your list."); });
          } }, ["🗑"])
        ]) : null
      ]));
    });
    return ul;
  }

  /* ---------- BADGES ---------- */
  function levelBar(L, big) {
    var nextTxt = L.next ? L.next.left + " points to " + L.next.icon + " " + L.next.name : "Top level reached. Amazing!";
    return h("div", { class: "level" + (big ? " big" : "") }, [
      h("span", { class: "lvicon", "aria-hidden": "true", text: L.icon }),
      h("div", { class: "lvbody" }, [
        h("div", { class: "lvtop" }, [h("b", { text: (big ? "Level " + L.n + " of " + WS.LEVELS.length + ": " : "") + L.name }), h("span", { class: "small muted", text: L.points + " points · " + nextTxt })]),
        h("div", { class: "lvbar", role: "progressbar", "aria-label": "Progress to next level", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(L.pct) }, [h("span", { style: "width:" + L.pct + "%" })])
      ])
    ]);
  }

  function renderBadges(root) {
    var list = allBadges(), got = list.filter(function (b) { return b.got; }).length, L = curLevel();
    var dates = WS.badgeDates(data.wins, settings().workdays, data.shows, data.shares);
    root.appendChild(h("h1", { text: "Badges and growth" }));
    var lv = h("div", { class: "card" }, [levelBar(L, true),
      h("p", { class: "small muted", text: "Every win helps you grow: Small 1 point, Solid 2, Big 3, and 3 for each talent moment you share." })]);
    if (L.n > 1) lv.appendChild(h("button", { class: "btn ghost small", type: "button", onclick: function () {
      openShare({ kind: "level", icon: L.icon, heading: "I grew in Winsprout", title: L.icon + " " + L.name + " (level " + L.n + " of " + WS.LEVELS.length + ")", detail: L.points + " points from my wins at work" });
    } }, ["📣 Share my level"]));
    root.appendChild(lv);
    root.appendChild(h("p", { class: "muted", text: got + " of " + list.length + " badges earned · " + plural(WS.live(data.wins).length, "win") + " so far · best streak " + WS.bestStreak(data.wins, settings().workdays) }));
    var next = list.filter(function (b) { return !b.got; }).sort(function (a, b) { return b.cur / b.target - a.cur / a.target || a.left - b.left; }).slice(0, 3);
    if (next.length) {
      root.appendChild(h("h2", { text: "Next up" }));
      var nu = h("ul", { class: "badges next" });
      next.forEach(function (b) { nu.appendChild(badgeTile(b, dates)); });
      root.appendChild(nu);
    }
    root.appendChild(h("h2", { text: "All badges" }));
    var grid = h("ul", { class: "badges" });
    list.slice().sort(function (a, b) { return (b.got ? 1 : 0) - (a.got ? 1 : 0); }).forEach(function (b) { grid.appendChild(badgeTile(b, dates)); });
    root.appendChild(grid);
  }
  function badgeTile(b, dates) {
    var kids = [h("span", { class: "bicon", "aria-hidden": "true", text: b.icon }), h("b", { text: b.name }), h("small", { text: b.how })];
    if (b.got) {
      if (dates[b.id]) kids.push(h("small", { class: "earned", text: "Earned " + WS.nice(dates[b.id]) }));
      kids.push(h("button", { class: "btn ghost small", type: "button", "aria-label": "Share badge: " + b.name, onclick: function () { shareBadge(b); } }, ["📣 Share"]));
    } else {
      var pct = Math.round(b.cur / b.target * 100);
      kids.push(h("span", { class: "bprog", "aria-hidden": "true" }, [h("span", { style: "width:" + pct + "%" })]));
      kids.push(h("small", { class: "left", text: b.target > 1 ? b.cur + " of " + b.target + " · " + b.left + " to go" : "Not yet" }));
    }
    kids.push(h("span", { class: "sr", text: b.got ? "Earned" : "Not earned yet" }));
    return h("li", { class: "badge" + (b.got ? " got" : "") }, kids);
  }
  function shareBadge(b) {
    openShare({ kind: "badge", icon: "🏅", heading: "I earned a badge in Winsprout", title: b.icon + " " + b.name, detail: b.how });
  }

  /* ---------- SHARE A PROUD MOMENT (win, badge or level) ---------- */
  var shareItem = null, shareBack = null;
  function openShare(item) {
    shareBack = document.activeElement;
    shareItem = Object.assign({ note: "", cheer: true, copied: false, err: "", posting: false }, item);
    var sh = ui.share;
    if (SY.canShare() && !sh.checked) { sh.checked = true; SY.shareReady().then(function (ok) { if (ok) { sh.ready = true; loadDest(); } }); }
    renderShareModal(true);
  }
  function closeShare() {
    shareItem = null; var m = $("shareModal"); if (m) m.remove();
    document.removeEventListener("keydown", shareKeys, true);
    if (shareBack && shareBack.focus && document.body.contains(shareBack)) shareBack.focus();
  }
  function shareKeys(e) { if (e.key === "Escape" && shareItem) { e.preventDefault(); closeShare(); } }
  function refreshDest() { if (shareItem) renderShareModal(false); else if (ui.view === "talents") render(); }
  function proudFields() { var it = shareItem; return { icon: it.icon, heading: it.heading, title: it.title, detail: it.detail, note: it.note.trim(), cheer: it.cheer }; }
  function renderShareModal(first) {
    var it = shareItem; if (!it) return;
    var focusId = !first && document.activeElement && document.activeElement.id;
    var old = $("shareModal"); if (old) old.remove();
    var f = proudFields(), sh = ui.share;
    var pv = h("div", { class: "preview", id: "spPreview" });
    function drawPreview() {
      var g = proudFields(); pv.textContent = "";
      pv.appendChild(h("p", null, [h("b", { text: g.icon + " " + g.heading })])); pv.appendChild(h("p", null, [h("b", { text: g.title })]));
      if (g.detail) pv.appendChild(h("p", { class: "small muted", text: g.detail }));
      if (g.note) g.note.split(/\r?\n/).forEach(function (l) { pv.appendChild(h("p", { text: l })); });
      if (g.cheer) pv.appendChild(h("p", { text: WS.CHEER }));
      pv.appendChild(h("p", { class: "small muted" }, [h("em", { text: "Shared from Winsprout" })]));
    }
    drawPreview();
    var note = h("textarea", { id: "spNote", rows: 2, maxlength: 400, placeholder: "Add a few words, e.g. thanks to the team who helped (optional)" }); note.value = it.note;
    note.addEventListener("input", function () { it.note = note.value; drawPreview(); });
    var cheer = h("input", { type: "checkbox", id: "spCheer" }); cheer.checked = it.cheer;
    cheer.addEventListener("change", function () { it.cheer = cheer.checked; drawPreview(); });
    var canPost = SY.canShare() && sh.ready === true, label = destLabel();
    var box = h("div", { class: "askbox sharebox", role: "dialog", "aria-modal": "true", "aria-labelledby": "spTitle" }, [
      h("div", { class: "row between" }, [h("h2", { id: "spTitle", text: "📣 Share a proud moment" }), h("button", { class: "icon", type: "button", "aria-label": "Close", onclick: closeShare }, ["✕"])]),
      h("p", { class: "small muted", text: "Post it to your manager, your team or any chat you choose. It goes from your own account, only when you press Post." }),
      pv,
      h("label", { for: "spNote", class: "lbl", text: "A few words (optional)" }), note,
      h("label", { class: "check", for: "spCheer" }, [cheer, " Invite colleagues to react and reply"]),
      h("h3", { class: "lbl", text: "Where to share" }), destination()
    ]);
    if (it.err) box.appendChild(h("p", { class: "small warn", role: "alert", text: it.err }));
    var acts = h("div", { class: "row wrap actions" }, [
      canPost ? h("button", { class: "btn", type: "button", id: "spPost", disabled: it.posting || !label ? true : null, onclick: postProud }, [it.posting ? "Posting…" : label ? "Post to " + label : "Choose where to post"]) : null,
      h("button", { class: canPost ? "btn ghost" : "btn", type: "button", onclick: function () { it.copied = true; copyText(WS.proudText(proudFields()), "Copied. Paste it into any Teams chat or email."); renderShareModal(false); } }, ["Copy"]),
      it.copied ? h("button", { class: "btn ghost", type: "button", onclick: function () { recordShare("Shared by me", ""); } }, ["I shared it myself"]) : null
    ]);
    box.appendChild(acts);
    // re-render the modal when the chat/team pickers change, so the Post button shows where it goes
    box.addEventListener("change", function (e) { if (e.target && /^(shChat|shTeam|shChannel)$/.test(e.target.id)) setTimeout(function () { renderShareModal(false); var el = $(e.target.id); if (el) el.focus(); }, 0); });
    var wrap = h("div", { id: "shareModal", class: "ask share" }, [box]);
    wrap.addEventListener("click", function (e) { if (e.target === wrap) closeShare(); });
    document.body.appendChild(wrap);
    document.addEventListener("keydown", shareKeys, true);
    var fe = focusId && $(focusId); if (fe) fe.focus(); else if (first) note.focus();
  }
  function postProud() {
    var it = shareItem, sh = ui.share; if (!it || it.posting) return;
    var dest = sh.kind === "chat" ? { kind: "chat", chatId: sh.chatId } : { kind: "channel", teamId: sh.teamId, channelId: sh.channelId };
    var label = destLabel(); if (!label) { toast("Choose where to post first."); return; }
    it.posting = true; it.err = ""; renderShareModal(false);
    SY.post(dest, WS.proudMessage(proudFields())).then(function (res) { recordShare(label, res && res.webUrl); }, function (e) {
      if (!shareItem) return;
      it.posting = false;
      if (e && e.status === 403) sh.needIT = true;
      it.err = e && e.status === 403 ? "Teams didn't allow this post. Your company may need IT to approve Winsprout, or you can't post there. Use Copy instead." : "Couldn't post right now. Try again, or use Copy.";
      renderShareModal(false);
    });
  }
  function recordShare(label, url) {
    var it = shareItem; if (!it) return;
    var before = snapshot();
    data.shares.push(WS.makeShare({ d: TODAY, kind: it.kind, title: it.title, to: label, url: url }));
    save(); closeShare(); render();
    fx.burst(null, 2);
    celebrate(before, url ? "🎉 Shared with " + label + ". Be proud!" : "Saved to your proud moments.");
  }

  /* ---------- SETTINGS ---------- */
  function renderSettings(root) {
    var s = settings(), st = SY.status();
    root.appendChild(h("h1", { text: "Settings" }));

    // storage
    var store = h("div", { class: "card" }, [h("h2", { text: "Where your wins are saved" })]);
    if (st.state === "cloud" || st.state === "saving" || st.state === "syncing") {
      store.appendChild(h("p", { text: "✓ Backed up to your own OneDrive (Apps › Winsprout)" + (st.account && st.account.username ? " as " + st.account.username : "") + ". Your wins follow you to any device. RuBuild can't see them." }));
    } else {
      store.appendChild(h("p", { text: "Right now your wins are saved only in this browser on this device. Connect your OneDrive to keep them safe and use them on other devices." }));
      if (st.pca) store.appendChild(h("button", { class: "btn", type: "button", onclick: function () {
        SY.connect().then(function (merged) {
          if (merged) {
            data = normalise(merged) || data;
            var acc = SY.status().account;
            if (!settings().name && acc && acc.name) { settings().name = acc.name; settings().u = Date.now(); save(); }
            toast("Connected. Your wins are now backed up to OneDrive."); render(); renderPill();
          } }, function () { toast("Couldn't connect to OneDrive. You can keep using Winsprout on this device."); });
      } }, ["Back up to my OneDrive"]));
      else store.appendChild(h("p", { class: "small muted", text: "OneDrive backup is available when Winsprout is opened inside Microsoft Teams with a work or school account." }));
      if (st.lastError) store.appendChild(h("p", { class: "small warn", text: st.lastError }));
    }
    root.appendChild(store);

    // profile
    var name = h("input", { type: "text", id: "sName", value: s.name || "", maxlength: 60, autocomplete: "name" });
    name.addEventListener("change", function () { s.name = name.value.trim(); s.u = Date.now(); save(); toast("Saved."); });
    root.appendChild(h("div", { class: "card" }, [h("h2", { text: "Your name on reports" }), h("label", { for: "sName", class: "lbl", text: "Name (optional)" }), name]));

    // workdays & goal
    var wd = h("div", { class: "chips", role: "group", "aria-label": "Working days" });
    [1, 2, 3, 4, 5, 6, 0].forEach(function (d) {
      var on = s.workdays.indexOf(d) >= 0;
      wd.appendChild(h("button", { type: "button", class: "chip", "aria-pressed": on ? "true" : "false", onclick: function () {
        if (on) { if (s.workdays.length === 1) { toast("Keep at least one working day."); return; } s.workdays = s.workdays.filter(function (x) { return x !== d; }); }
        else s.workdays = s.workdays.concat([d]).sort();
        s.u = Date.now(); save(); render();
      } }, [WS.DAY[d]]));
    });
    var goal = h("input", { type: "number", id: "sGoal", min: 1, max: 50, value: String(s.weeklyGoal) });
    goal.addEventListener("change", function () { var v = Math.max(1, Math.min(50, parseInt(goal.value, 10) || 5)); s.weeklyGoal = v; s.u = Date.now(); goal.value = v; save(); toast("Weekly goal: " + v + " wins."); });
    root.appendChild(h("div", { class: "card" }, [h("h2", { text: "Streaks and goal" }),
      h("p", { class: "small muted", text: "Days off never break your streak. Pick your working days:" }), wd,
      h("label", { for: "sGoal", class: "lbl", text: "Weekly goal (wins per week)" }), goal]));

    // reminder
    var time = h("input", { type: "time", id: "sTime", value: s.reminder || "17:30" });
    time.addEventListener("change", function () { s.reminder = time.value || "17:30"; s.u = Date.now(); save(); });
    root.appendChild(h("div", { class: "card" }, [h("h2", { text: "Daily reminder" }),
      h("p", { class: "small muted", text: "Adds a 5-minute reminder to your Outlook calendar on your working days. It shows as free time, so it never blocks meetings." }),
      h("div", { class: "row wrap" }, [h("label", { for: "sTime", class: "small", text: "Time" }), time,
        h("button", { class: "btn", type: "button", onclick: function () {
          var link = window.WS_CONFIG.appId ? "https://teams.microsoft.com/l/entity/" + window.WS_CONFIG.appId + "/today" : "https://rubuild.com/winsprout/";
          download(new TextEncoder().encode(WS.reminderICS(s.reminder, s.workdays, link, TODAY)), "Winsprout daily reminder.ics", "text/calendar");
        } }, ["Add reminder to my calendar"])]),
      h("p", { class: "small muted", text: "Open the downloaded file and choose Save (Outlook) to add it." })]));

    // data
    var file = h("input", { type: "file", accept: "application/json,.json", class: "sr", id: "importFile" });
    file.addEventListener("change", function () {
      var f = file.files && file.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        try { var inc = normalise(JSON.parse(r.result)); if (!inc) throw new Error("bad"); data = normalise(WS.merge(data, inc)); save(); render(); toast("Imported " + plural(WS.live(inc.wins).length, "win") + "."); }
        catch (e) { toast("That file isn't a Winsprout backup."); }
      };
      r.readAsText(f);
    });
    root.appendChild(h("div", { class: "card" }, [h("h2", { text: "Your data" }),
      h("div", { class: "row wrap" }, [
        h("button", { class: "btn ghost", type: "button", onclick: function () { download(new TextEncoder().encode(JSON.stringify(data, null, 1)), "winsprout-backup-" + TODAY + ".json", "application/json"); } }, ["Download a backup"]),
        h("label", { for: "importFile", class: "btn ghost", role: "button", tabindex: "0", onkeydown: function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); file.click(); } } }, ["Import a backup"]), file,
        h("button", { class: "btn danger", type: "button", onclick: deleteAll }, ["Delete all my data"])
      ])]));
    root.appendChild(h("p", { class: "small muted", text: "Winsprout " + (window.WS_CONFIG.version || "") + " · by RuBuild Services" }));
  }

  function deleteAll() {
    ask("Delete all your wins and talents from this device" + (SY.status().state === "cloud" ? " and your OneDrive" : "") + "? This can't be undone.", "Delete everything", reallyDeleteAll);
  }
  function reallyDeleteAll() {
    var cloud = SY.status().state === "cloud";
    data = JSON.parse(JSON.stringify(DEFAULT));
    SY.saveLocal(data);
    (cloud ? SY.deleteRemote() : Promise.resolve(true)).then(function () { toast("All your data was deleted."); render(); }, function () { toast("Deleted here. Couldn't reach OneDrive; try again later."); render(); });
  }

  /* ---------- theme ---------- */
  function applyTheme(t) {
    var root = document.documentElement;
    // Always light (owner's choice). Only Teams' high-contrast mode is followed, for people with low vision.
    if (t === "contrast") root.setAttribute("data-ws-theme", "contrast");
    else root.removeAttribute("data-ws-theme");
  }

  /* ---------- start ---------- */
  ui.view = TAB || (IN_TEAMS_TAB ? "today" : (VIEWS.indexOf(SY.get("view", "today")) >= 0 ? SY.get("view", "today") : "today"));
  // another Teams tab may have changed the data: refresh when this tab is shown again
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState !== "visible") return;
    var fresh = normalise(SY.load());
    if (fresh && JSON.stringify(fresh) !== JSON.stringify(data)) { data = fresh; render(); }
  });
  show(ui.view);
  renderPill();
  fx.newId = null;
  SY.start().then(function (merged) {
    var st = SY.status();
    var before = JSON.stringify(data) + "|" + settings().name;
    if (st.inTeams && st.context && st.context.app) {
      applyTheme(st.context.app.theme);
      try { window.microsoftTeams.app.registerOnThemeChangeHandler(applyTheme); } catch (e) { /* older host */ }
    }
    if (merged) { data = normalise(merged) || data; }
    if (!settings().name && st.account && st.account.name) { settings().name = st.account.name; }
    renderPill();
    // redraw only if something changed, so the screen doesn't jump
    if (JSON.stringify(data) + "|" + settings().name !== before) render();
  });
  // Teams app caching: when Teams brings a kept-in-memory Winsprout back, show the right screen with fresh data
  document.addEventListener("ws-resume", function (e) {
    var v = e.detail && e.detail.view;
    var fresh = normalise(SY.load()); if (fresh) data = fresh;
    if (v && VIEWS.indexOf(v) >= 0) show(v); else render();
    renderPill();
  });
  window.__WS_APP__ = { data: function () { return data; }, show: show, render: render };
})();
