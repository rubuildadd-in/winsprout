/* Winsprout core logic: dates, streaks, badges, stats, merge, Word report, calendar reminder.
   Pure functions, no network. Works in the browser (window.WS) and in Node (module.exports). */
(function (g) {
  "use strict";
  var WS = {};

  WS.CATEGORIES = [
    { id: "delivered", label: "Delivered", emoji: "📦" },
    { id: "fixed", label: "Fixed", emoji: "🔧" },
    { id: "helped", label: "Helped someone", emoji: "🤝" },
    { id: "customer", label: "Customer win", emoji: "⭐" },
    { id: "learned", label: "Learned", emoji: "📚" },
    { id: "idea", label: "Idea / improvement", emoji: "💡" }
  ];
  WS.IMPACT = { 1: "Small", 2: "Solid", 3: "Big" };
  WS.catById = function (id) {
    for (var i = 0; i < WS.CATEGORIES.length; i++) if (WS.CATEGORIES[i].id === id) return WS.CATEGORIES[i];
    return WS.CATEGORIES[0];
  };

  /* ---------- dates (local calendar days as YYYY-MM-DD) ---------- */
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  WS.key = function (d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
  WS.parse = function (k) { var p = k.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); };
  WS.addDays = function (k, n) { var d = WS.parse(k); d.setDate(d.getDate() + n); return WS.key(d); };
  WS.dow = function (k) { return WS.parse(k).getDay(); }; // 0 Sun .. 6 Sat
  WS.weekStart = function (k) { var dw = WS.dow(k); return WS.addDays(k, dw === 0 ? -6 : 1 - dw); }; // Monday
  WS.weekDays = function (k) { var s = WS.weekStart(k), out = []; for (var i = 0; i < 7; i++) out.push(WS.addDays(s, i)); return out; };
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  WS.MON = MON; WS.DAY = DAY;
  WS.nice = function (k) { var d = WS.parse(k); return d.getDate() + " " + MON[d.getMonth()] + " " + d.getFullYear(); };
  WS.short = function (k) { var d = WS.parse(k); return d.getDate() + " " + MON[d.getMonth()]; };

  /* ---------- wins ---------- */
  WS.live = function (wins) { return (wins || []).filter(function (w) { return !w.del; }); };
  WS.newId = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); };
  WS.makeWin = function (dayKey, text, cat, imp) {
    var now = Date.now();
    return { id: WS.newId(), d: dayKey, t: String(text).trim().slice(0, 500), c: cat || "delivered", imp: imp === 3 ? 3 : imp === 1 ? 1 : 2, ts: now, u: now };
  };
  WS.byDay = function (wins) {
    var m = {};
    WS.live(wins).forEach(function (w) { (m[w.d] = m[w.d] || []).push(w); });
    return m;
  };

  /* Streak: consecutive working days with at least one win.
     Non-working days never break the streak. If today has no win yet, the streak from yesterday is still alive. */
  WS.streak = function (wins, today, workdays) {
    workdays = workdays || [1, 2, 3, 4, 5];
    var days = WS.byDay(wins), n = 0, k = today, guard = 0;
    var isWork = function (key) { return workdays.indexOf(WS.dow(key)) >= 0; };
    if (!days[k]) k = WS.addDays(k, -1); // today not logged yet: count from yesterday
    while (guard++ < 2000) {
      if (days[k]) { n++; k = WS.addDays(k, -1); continue; }
      if (!isWork(k)) { k = WS.addDays(k, -1); continue; }
      break;
    }
    return n;
  };
  WS.bestStreak = function (wins, workdays) {
    workdays = workdays || [1, 2, 3, 4, 5];
    var keys = Object.keys(WS.byDay(wins)).sort();
    if (!keys.length) return 0;
    var best = 0, run = 0, k = keys[0], end = keys[keys.length - 1], days = WS.byDay(wins);
    while (k <= end) {
      if (days[k]) { run++; if (run > best) best = run; }
      else if (workdays.indexOf(WS.dow(k)) >= 0) run = 0;
      k = WS.addDays(k, 1);
    }
    return best;
  };

  WS.weekStats = function (wins, anyDayInWeek) {
    var days = WS.weekDays(anyDayInWeek), m = WS.byDay(wins), cats = {}, total = 0, big = [];
    var perDay = days.map(function (k) {
      var list = m[k] || [];
      list.forEach(function (w) { cats[w.c] = (cats[w.c] || 0) + 1; if (w.imp === 3) big.push(w); });
      total += list.length;
      return { day: k, count: list.length };
    });
    return { days: days, perDay: perDay, cats: cats, total: total, big: big };
  };

  WS.range = function (wins, from, to) {
    return WS.live(wins).filter(function (w) { return w.d >= from && w.d <= to; })
      .sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : a.ts - b.ts; });
  };
  WS.report = function (wins, from, to, shows) {
    var list = WS.range(wins, from, to), cats = {}, months = {}, activeDays = {};
    list.forEach(function (w) {
      cats[w.c] = (cats[w.c] || 0) + 1;
      var mk = w.d.slice(0, 7);
      (months[mk] = months[mk] || []).push(w);
      activeDays[w.d] = 1;
    });
    var monthKeys = [], k = from.slice(0, 7);
    while (k <= to.slice(0, 7) && monthKeys.length < 60) {
      monthKeys.push(k);
      var y = +k.slice(0, 4), mo = +k.slice(5, 7) + 1;
      if (mo > 12) { mo = 1; y++; }
      k = y + "-" + pad(mo);
    }
    var big = list.filter(function (w) { return w.imp === 3; });
    return { from: from, to: to, list: list, total: list.length, shows: WS.range(shows || [], from, to), cats: cats, months: months, monthKeys: monthKeys, big: big, activeDays: Object.keys(activeDays).length };
  };

  /* Appraisal period presets */
  WS.periods = function (today) {
    var y = +today.slice(0, 4), m = +today.slice(5, 7);
    var fyStart = m >= 4 ? y : y - 1;
    return {
      last12: { label: "Last 12 months", from: WS.addDays(today, -364), to: today },
      fy: { label: "Financial year (Apr–Mar) " + fyStart + "–" + String(fyStart + 1).slice(2), from: fyStart + "-04-01", to: today },
      cal: { label: "This calendar year " + y, from: y + "-01-01", to: today },
      quarter: { label: "Last 3 months", from: WS.addDays(today, -91), to: today }
    };
  };

  /* ---------- badges ---------- */
  WS.badges = function (wins, today, workdays, shows) {
    var showCount = WS.live(shows).length;
    var live = WS.live(wins), best = WS.bestStreak(wins, workdays), cats = {}, big = 0, maxDay = 0;
    var days = WS.byDay(wins);
    Object.keys(days).forEach(function (k) { if (days[k].length > maxDay) maxDay = days[k].length; });
    live.forEach(function (w) { cats[w.c] = (cats[w.c] || 0) + 1; if (w.imp === 3) big++; });
    var catTypes = Object.keys(cats).length;
    var weeks = {};
    live.forEach(function (w) { var ws = WS.weekStart(w.d); weeks[ws] = (weeks[ws] || 0) + 1; });
    var bestWeek = 0; Object.keys(weeks).forEach(function (k) { if (weeks[k] > bestWeek) bestWeek = weeks[k]; });
    var list = [
      ["first", "🌱", "First sprout", "Log your first win", live.length >= 1],
      ["three", "🌿", "Taking root", "Win streak of 3 working days", best >= 3],
      ["week", "🔥", "Full week", "Win streak of 5 working days", best >= 5],
      ["twenty", "🌳", "Steady grower", "Win streak of 20 working days", best >= 20],
      ["w25", "🎯", "25 wins", "Log 25 wins", live.length >= 25],
      ["w100", "🏆", "Century", "Log 100 wins", live.length >= 100],
      ["w250", "👑", "Unstoppable", "Log 250 wins", live.length >= 250],
      ["big", "🚀", "Big moment", "Log a Big win", big >= 1],
      ["big10", "🌟", "Game changer", "Log 10 Big wins", big >= 10],
      ["helper", "🤝", "Team player", "Help someone 10 times", (cats.helped || 0) >= 10],
      ["learner", "📚", "Always learning", "Log 10 things you learned", (cats.learned || 0) >= 10],
      ["fixer", "🔧", "Fixer", "Fix 10 problems", (cats.fixed || 0) >= 10],
      ["all", "🎨", "All-rounder", "Log a win in every category", catTypes >= WS.CATEGORIES.length],
      ["power", "⚡", "Power day", "Log 5 wins in one day", maxDay >= 5],
      ["bigweek", "📈", "Big week", "Log 15 wins in one week", bestWeek >= 15],
      ["stage", "🎤", "On stage", "Share your first talent moment", showCount >= 1],
      ["encore", "👏", "Encore", "Share 5 talent moments", showCount >= 5]
    ];
    return list.map(function (b) { return { id: b[0], icon: b[1], name: b[2], how: b[3], got: !!b[4] }; });
  };

  /* ---------- merge local and OneDrive copies (by id, newest edit wins; deletions kept as tombstones) ---------- */
  function mergeList(x, y, sort) {
    var map = {};
    (x || []).concat(y || []).forEach(function (w) {
      if (!w || !w.id) return;
      var cur = map[w.id];
      if (!cur || (w.u || 0) > (cur.u || 0)) map[w.id] = w;
    });
    var out = Object.keys(map).map(function (k) { return map[k]; });
    return sort ? out.sort(sort) : out.sort(function (p, q) { return (p.ts || p.u || 0) - (q.ts || q.u || 0); });
  }
  var byDayThenTime = function (x, y) { return x.d < y.d ? -1 : x.d > y.d ? 1 : x.ts - y.ts; };
  WS.merge = function (a, b) {
    a = a || {}; b = b || {};
    var sa = a.settings || {}, sb = b.settings || {};
    var settings = (sb.u || 0) > (sa.u || 0) ? sb : sa;
    return { v: 1, settings: settings, wins: mergeList(a.wins, b.wins, byDayThenTime),
      talents: mergeList(a.talents, b.talents), shows: mergeList(a.shows, b.shows, byDayThenTime) };
  };
  WS.sameData = function (a, b) { return JSON.stringify(a) === JSON.stringify(b); };

  /* ---------- text summaries ---------- */
  WS.weekText = function (wins, anyDay, name) {
    var s = WS.weekStats(wins, anyDay), days = s.days;
    var lines = ["My week " + WS.short(days[0]) + " – " + WS.short(days[6]) + ": " + s.total + " win" + (s.total === 1 ? "" : "s")];
    var parts = WS.CATEGORIES.filter(function (c) { return s.cats[c.id]; }).map(function (c) { return s.cats[c.id] + " " + c.label.toLowerCase(); });
    if (parts.length) lines.push(parts.join(" · "));
    var m = WS.byDay(wins);
    days.forEach(function (k) {
      (m[k] || []).forEach(function (w) { lines.push("• " + (w.imp === 3 ? "★ " : "") + w.t); });
    });
    void name;
    return lines.join("\n");
  };

  /* ---------- Word (.docx) report, built locally ---------- */
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function para(text, style, bold) {
    return '<w:p>' + (style ? '<w:pPr><w:pStyle w:val="' + style + '"/></w:pPr>' : '') +
      '<w:r>' + (bold ? '<w:rPr><w:b/></w:rPr>' : '') + '<w:t xml:space="preserve">' + esc(text) + '</w:t></w:r></w:p>';
  }
  WS.reportDocxParts = function (rep, name) {
    var body = [];
    body.push(para((name ? name + " — " : "") + "My Achievements", "Title"));
    body.push(para(WS.nice(rep.from) + " to " + WS.nice(rep.to), "Subtitle"));
    body.push(para("Summary", "Heading1"));
    var pl = function (n, w) { return n + " " + w + (n === 1 ? "" : "s"); };
    body.push(para(pl(rep.total, "win") + " logged on " + pl(rep.activeDays, "day") + ", including " + pl(rep.big.length, "big win") + "."));
    WS.CATEGORIES.forEach(function (c) { if (rep.cats[c.id]) body.push(para(c.label + ": " + rep.cats[c.id], "ListBullet")); });
    if (rep.big.length) {
      body.push(para("Highlights", "Heading1"));
      rep.big.forEach(function (w) { body.push(para(WS.short(w.d) + " — " + w.t, "ListBullet")); });
    }
    body.push(para("Month by month", "Heading1"));
    rep.monthKeys.forEach(function (mk) {
      var list = rep.months[mk] || [];
      if (!list.length) return;
      body.push(para(MON[+mk.slice(5, 7) - 1] + " " + mk.slice(0, 4) + " (" + list.length + ")", "Heading2"));
      list.forEach(function (w) { body.push(para(WS.short(w.d) + " · " + WS.catById(w.c).label + (w.imp === 3 ? " · Big" : "") + " — " + w.t, "ListBullet")); });
    });
    if (rep.shows && rep.shows.length) {
      body.push(para("Talents shared with colleagues", "Heading1"));
      rep.shows.forEach(function (x) { body.push(para(WS.short(x.d) + " — " + x.tn + ": " + x.title + (x.to ? " (shared in " + x.to + ")" : ""), "ListBullet")); });
    }
    body.push(para("Created with Winsprout from my own daily notes.", "Footer"));
    var doc = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + body.join("") +
      '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>';
    function style(id, name, size, color, bold, extra) {
      return '<w:style w:type="paragraph" w:styleId="' + id + '"><w:name w:val="' + name + '"/><w:basedOn w:val="Normal"/>' +
        '<w:pPr><w:spacing w:before="' + (extra || 120) + '" w:after="80"/></w:pPr><w:rPr>' + (bold ? '<w:b/>' : '') +
        '<w:color w:val="' + color + '"/><w:sz w:val="' + size + '"/></w:rPr></w:style>';
    }
    var styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults>' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr><w:spacing w:after="80"/></w:pPr></w:style>' +
      style("Title", "Title", 44, "4A23A8", true, 0) + style("Subtitle", "Subtitle", 24, "5E5778", false, 0) +
      style("Heading1", "heading 1", 30, "4A23A8", true, 280) + style("Heading2", "heading 2", 24, "5B2FC9", true, 200) +
      '<w:style w:type="paragraph" w:styleId="ListBullet"><w:name w:val="List Bullet"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="360" w:hanging="240"/></w:pPr></w:style>' +
      style("Footer", "Footer Note", 18, "7A7390", false, 360) + '</w:styles>';
    // bullets as a simple "• " prefix keeps the file small and valid without a numbering part
    doc = doc.replace(/<w:pStyle w:val="ListBullet"\/><\/w:pPr><w:r>(<w:rPr>.*?<\/w:rPr>)?<w:t xml:space="preserve">/g, function (m) { return m + "• "; });
    return {
      "[Content_Types].xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>',
      "_rels/.rels": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
      "word/_rels/document.xml.rels": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
      "word/document.xml": doc,
      "word/styles.xml": styles
    };
  };

  /* minimal ZIP (stored, no compression) */
  var CRC = (function () { var t = [], c; for (var n = 0; n < 256; n++) { c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(bytes) { var c = 0xFFFFFFFF; for (var i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function utf8(s) {
    if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(s);
    return Uint8Array.from(Buffer.from(s, "utf8"));
  }
  WS.zip = function (files) {
    var chunks = [], central = [], offset = 0;
    function u16(v) { return [v & 255, (v >>> 8) & 255]; }
    function u32(v) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]; }
    Object.keys(files).forEach(function (name) {
      var data = utf8(files[name]), nm = utf8(name), crc = crc32(data);
      var head = [].concat([0x50, 0x4b, 0x03, 0x04], u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(nm.length), u16(0));
      chunks.push(Uint8Array.from(head), nm, data);
      central.push(Uint8Array.from([].concat([0x50, 0x4b, 0x01, 0x02], u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(nm.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset))), nm);
      offset += head.length + nm.length + data.length;
    });
    var csize = central.reduce(function (s, a) { return s + a.length; }, 0);
    var end = Uint8Array.from([].concat([0x50, 0x4b, 0x05, 0x06], u16(0), u16(0), u16(Object.keys(files).length), u16(Object.keys(files).length), u32(csize), u32(offset), u16(0)));
    var all = chunks.concat(central, [end]), len = all.reduce(function (s, a) { return s + a.length; }, 0);
    var out = new Uint8Array(len), p = 0;
    all.forEach(function (a) { out.set(a, p); p += a.length; });
    return out;
  };
  WS.reportDocx = function (rep, name) { return WS.zip(WS.reportDocxParts(rep, name)); };

  /* ---------- calendar reminder (.ics) ---------- */
  WS.reminderICS = function (time, workdays, link, startKey) {
    var hm = (time || "17:30").split(":"), hh = pad(+hm[0] || 17), mm = pad(+hm[1] || 0);
    var map = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
    var byday = (workdays && workdays.length ? workdays : [1, 2, 3, 4, 5]).map(function (d) { return map[d]; }).join(",");
    var start = (startKey || WS.key(new Date())).replace(/-/g, "");
    var stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    var desc = "Take 30 seconds to log today's wins in Winsprout." + (link ? "\\n" + link : "");
    return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//RuBuild Services//Winsprout//EN", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
      "UID:winsprout-daily-" + start + "@rubuild.com", "DTSTAMP:" + stamp, "DTSTART:" + start + "T" + hh + mm + "00", "DURATION:PT5M",
      "RRULE:FREQ=WEEKLY;BYDAY=" + byday, "SUMMARY:🌱 Log today's wins", "DESCRIPTION:" + desc, "TRANSP:TRANSPARENT",
      "X-MICROSOFT-CDO-BUSYSTATUS:FREE", "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Log today's wins", "TRIGGER:PT0M", "END:VALARM",
      "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  };

  /* ---------- prompts to help people remember wins ---------- */
  WS.PROMPTS = [
    "What did you finish today?", "Who did you help today?", "What problem did you solve?",
    "What did a customer or colleague thank you for?", "What did you learn today?",
    "What went better than expected?", "What did you improve or simplify?", "What decision did you move forward?"
  ];

  /* ---------- talents and talent moments ---------- */
  WS.TALENTS = [
    ["Storytelling", "📖"], ["Singing", "🎤"], ["Public speaking", "🎙️"], ["Music", "🎸"], ["Dance", "💃"],
    ["Drawing & art", "🎨"], ["Photography", "📷"], ["Writing & poetry", "✍️"], ["Cooking & baking", "🍳"],
    ["Sports & fitness", "🏅"], ["Comedy", "😄"], ["Crafts & DIY", "🧵"], ["Gardening", "🪴"],
    ["Teaching & mentoring", "🧑‍🏫"], ["Languages", "🗣️"], ["Gaming", "🎮"]
  ].map(function (t) { return { n: t[0], e: t[1] }; });
  WS.talentEmoji = function (name) {
    for (var i = 0; i < WS.TALENTS.length; i++) if (WS.TALENTS[i].n.toLowerCase() === String(name).toLowerCase()) return WS.TALENTS[i].e;
    return "✨";
  };
  WS.makeTalent = function (name, note) {
    var n = String(name || "").trim().replace(/\s+/g, " ").slice(0, 40), now = Date.now();
    return { id: WS.newId(), n: n, e: WS.talentEmoji(n), note: String(note || "").trim().slice(0, 120), u: now };
  };
  WS.hasTalent = function (talents, name) {
    return WS.live(talents).some(function (t) { return t.n.toLowerCase() === String(name).trim().toLowerCase(); });
  };
  /* a shared talent moment: what was posted and where (the post itself lives in Teams) */
  WS.makeShow = function (o) {
    var now = Date.now();
    return { id: WS.newId(), d: o.d, tn: String(o.tn || "").slice(0, 40), te: o.te || "✨", title: String(o.title || "").trim().slice(0, 100),
      msg: String(o.msg || "").trim().slice(0, 600), link: WS.safeLink(o.link), to: String(o.to || "").slice(0, 120), url: WS.safeLink(o.url), ts: now, u: now };
  };
  /* only plain https links are allowed in posts */
  WS.safeLink = function (url) {
    url = String(url || "").trim();
    if (!/^https:\/\/[^\s<>"']+$/i.test(url)) return "";
    try { var u = new URL(url); return u.protocol === "https:" && u.hostname.indexOf(".") > 0 ? u.href : ""; } catch (e) { return ""; }
  };
  WS.escHtml = function (s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); };
  /* Teams chat/channel message (Microsoft Graph chatMessage). Photo, if any, goes inline as hosted content. */
  WS.talentMessage = function (o) {
    var e = WS.escHtml, parts = [];
    parts.push("<p><b>" + e(o.te || "✨") + " Talent moment: " + e(o.tn) + "</b></p>");
    parts.push("<p><b>" + e(o.title) + "</b></p>");
    if (o.msg) parts.push("<p>" + e(o.msg).replace(/\r?\n/g, "<br>") + "</p>");
    var link = WS.safeLink(o.link);
    if (link) parts.push("<p>▶ <a href=\"" + e(link) + "\">Watch or listen</a></p>");
    var msg = { body: { contentType: "html", content: "" } };
    if (o.image && o.image.base64) {
      parts.push('<p><img src="../hostedContents/1/$value" alt="' + e(o.title) + '"' + (o.image.w ? ' width="' + o.image.w + '" height="' + o.image.h + '"' : "") + "></p>");
      msg.hostedContents = [{ "@microsoft.graph.temporaryId": "1", contentBytes: o.image.base64, contentType: o.image.type || "image/jpeg" }];
    }
    parts.push("<p><em>Shared from Winsprout</em></p>");
    msg.body.content = parts.join("");
    return msg;
  };
  WS.talentText = function (o) {
    var L = [(o.te || "✨") + " Talent moment: " + o.tn, o.title];
    if (o.msg) L.push(o.msg);
    var link = WS.safeLink(o.link); if (link) L.push("Watch or listen: " + link);
    return L.join("\n");
  };

  g.WS = WS;
  if (typeof module !== "undefined" && module.exports) module.exports = WS;
})(typeof window !== "undefined" ? window : globalThis);
