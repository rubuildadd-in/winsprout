/* Winsprout storage: browser cache + the user's own OneDrive app folder (Apps/Winsprout).
   Sign-in uses Microsoft's nested app authentication inside Teams (no RuBuild server).
   Data never goes to RuBuild. */
(function (g) {
  "use strict";
  var CFG = g.WS_CONFIG || {};
  var SCOPES = ["Files.ReadWrite.AppFolder", "User.Read"];
  /* asked for only the first time someone shares a talent moment (incremental consent) */
  var SHARE_SCOPES = ["ChatMessage.Send", "Chat.ReadBasic", "Team.ReadBasic.All", "Channel.ReadBasic.All", "ChannelMessage.Send"];
  var FILE = "winsprout-data.json";
  var GRAPH = "https://graph.microsoft.com/v1.0";
  var mem = {};
  var S = { state: "local", account: null, listeners: [], pca: null, inTeams: false, context: null, saveTimer: null, busy: false, pending: false, lastError: "" };

  function emit() { S.listeners.forEach(function (fn) { try { fn(S.state, S); } catch (e) { /* ignore */ } }); }
  function setState(st, err) { S.state = st; S.lastError = err || ""; emit(); }

  /* ---- browser cache ---- */
  var cache = {
    get: function (k, d) {
      try { var v = g.localStorage.getItem("ws." + k); return v == null ? d : JSON.parse(v); }
      catch (e) { return k in mem ? mem[k] : d; }
    },
    set: function (k, v) {
      mem[k] = v;
      try { g.localStorage.setItem("ws." + k, JSON.stringify(v)); } catch (e) { /* storage blocked: memory only */ }
    }
  };

  /* ---- Teams + sign-in ---- */
  function initTeams() {
    if (!g.microsoftTeams || !g.microsoftTeams.app) return Promise.resolve(false);
    return Promise.race([
      g.microsoftTeams.app.initialize().then(function () {
        var app = g.microsoftTeams.app;
        // the screen is already drawn from this device's copy: tell Teams to stop its loading animation now
        try { if (app.notifyAppLoaded) app.notifyAppLoaded(); } catch (e) { /* older Teams */ }
        try { app.notifySuccess(); } catch (e) { /* older Teams */ }
        registerCaching(app);
        return app.getContext();
      }).then(function (ctx) {
        S.inTeams = true; S.context = ctx; return true;
      }),
      new Promise(function (r) { setTimeout(function () { r(false); }, 2500); })
    ]).catch(function () { return false; });
  }

  /* Teams app caching: lets Teams keep Winsprout in memory when you switch away, so coming back is instant */
  function registerCaching(app) {
    var lc = app && app.lifecycle;
    if (!lc || !lc.registerOnResumeHandler || !lc.registerBeforeSuspendOrTerminateHandler) return;
    try {
      lc.registerBeforeSuspendOrTerminateHandler(function () { clearTimeout(S.saveTimer); return Promise.resolve(); });
      lc.registerOnResumeHandler(function (d) {
        var view = "";
        try { view = new URL(d.contentUrl).searchParams.get("view") || ""; } catch (e) { /* no url */ }
        try { g.document.dispatchEvent(new CustomEvent("ws-resume", { detail: { view: view } })); } catch (e) { /* ignore */ }
        registerCaching(app); // handlers are cleared on suspend
        try { app.notifySuccess(); } catch (e) { /* ignore */ }
      });
    } catch (e) { /* not supported here */ }
  }

  function initAuth() {
    if (!CFG.clientId || !g.msal) return Promise.resolve(null);
    var conf = { auth: { clientId: CFG.clientId, authority: "https://login.microsoftonline.com/organizations", supportsNestedAppAuth: true, redirectUri: CFG.redirectUri }, cache: { cacheLocation: "localStorage" } };
    var create = S.inTeams && g.msal.createNestablePublicClientApplication ? g.msal.createNestablePublicClientApplication : g.msal.createStandardPublicClientApplication;
    if (!create) return Promise.resolve(null);
    return create(conf).then(function (pca) { S.pca = pca; return pca; }).catch(function (e) { S.lastError = String(e && e.message || e); return null; });
  }

  function pickAccount() {
    if (!S.pca) return null;
    var acc = S.pca.getActiveAccount && S.pca.getActiveAccount();
    if (acc) return acc;
    var all = S.pca.getAllAccounts ? S.pca.getAllAccounts() : [];
    if (S.context && S.context.user) {
      var oid = S.context.user.id, hint = S.context.user.loginHint;
      for (var i = 0; i < all.length; i++) if (all[i].localAccountId === oid || all[i].username === hint) return all[i];
    }
    return all[0] || null;
  }

  function token(interactive, scopes) {
    if (!S.pca) return Promise.reject(new Error("no-auth"));
    var acc = pickAccount();
    var req = { scopes: scopes || SCOPES, account: acc || undefined };
    if (!acc && S.context && S.context.user && S.context.user.loginHint) req.loginHint = S.context.user.loginHint;
    var silent = acc ? S.pca.acquireTokenSilent(req) : (S.inTeams && S.pca.ssoSilent ? S.pca.ssoSilent(req) : Promise.reject(new Error("interaction")));
    return silent.catch(function (e) {
      if (!interactive) throw e;
      return S.pca.acquireTokenPopup(req);
    }).then(function (res) {
      if (res.account && S.pca.setActiveAccount) S.pca.setActiveAccount(res.account);
      S.account = res.account || acc;
      return res.accessToken;
    });
  }

  function graph(method, path, body, type, scopes) {
    return token(false, scopes).then(function (t) {
      var opt = { method: method, headers: { Authorization: "Bearer " + t } };
      if (body !== undefined) { opt.body = body; opt.headers["Content-Type"] = type || "application/json"; }
      return fetch(GRAPH + path, opt);
    });
  }

  function json(what) {
    return function (r) {
      if (r.ok) return r.json();
      var err = new Error(what + " " + r.status); err.status = r.status;
      throw err;
    };
  }

  function loadRemote() {
    return graph("GET", "/me/drive/special/approot:/" + FILE + ":/content").then(function (r) {
      if (r.status === 404) return null;
      if (!r.ok) throw new Error("load " + r.status);
      return r.json();
    });
  }
  function saveRemote(data) {
    return graph("PUT", "/me/drive/special/approot:/" + FILE + ":/content", JSON.stringify(data)).then(function (r) {
      if (!r.ok) throw new Error("save " + r.status);
      return true;
    });
  }

  /* ---- public API ---- */
  var API = {
    onChange: function (fn) { S.listeners.push(fn); },
    status: function () { return S; },
    load: function () { return cache.get("data", null); },
    saveLocal: function (data) { cache.set("data", data); },
    get: cache.get, set: cache.set,

    // start: returns promise of merged data (local first; then OneDrive if signed in)
    start: function () {
      return initTeams().then(initAuth).then(function () {
        if (!S.pca) { setState("local"); return null; }
        return API.syncNow(false);
      });
    },

    // connect: user clicked "Back up to OneDrive"
    connect: function () {
      if (!S.pca) return Promise.reject(new Error("Sign-in isn't set up yet."));
      setState("connecting");
      return token(true).then(function () { return API.syncNow(false); }).catch(function (e) {
        setState("local", "Couldn't connect to OneDrive. " + (e && e.message ? e.message : ""));
        throw e;
      });
    },

    syncNow: function () {
      setState("syncing");
      return loadRemote().then(function (remote) {
        var local = cache.get("data", null);
        var merged = g.WS.merge(local || {}, remote || {});
        cache.set("data", merged);
        var needsUpload = !remote || !g.WS.sameData(remote, merged);
        return (needsUpload ? saveRemote(merged) : Promise.resolve(true)).then(function () {
          cache.set("cloud", true);
          setState("cloud");
          return merged;
        });
      }).catch(function (e) {
        var msg = String(e && e.message || e);
        setState(cache.get("cloud", false) ? "offline" : "local", /interaction|consent|no-auth|popup/i.test(msg) ? "" : msg);
        return null;
      });
    },

    // queue a OneDrive save after local changes
    queueSave: function (data) {
      cache.set("data", data);
      if (S.state !== "cloud" && S.state !== "saving" && S.state !== "offline") return;
      clearTimeout(S.saveTimer);
      S.saveTimer = setTimeout(function () {
        if (S.busy) { S.pending = true; return; }
        S.busy = true; setState("saving");
        saveRemote(cache.get("data", data)).then(function () { setState("cloud"); }, function () { setState("offline"); })
          .then(function () { S.busy = false; if (S.pending) { S.pending = false; API.queueSave(cache.get("data", data)); } });
      }, 1200);
    },

    // save a Word report into the user's OneDrive app folder; resolves with the file's web link
    saveReport: function (bytes, name) {
      return graph("PUT", "/me/drive/special/approot:/" + encodeURIComponent(name) + ":/content", bytes,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document").then(function (r) {
        if (!r.ok) throw new Error("report " + r.status);
        return r.json();
      }).then(function (item) { return item.webUrl; });
    },

    openLink: function (url) {
      if (S.inTeams && g.microsoftTeams.app && g.microsoftTeams.app.openLink) return g.microsoftTeams.app.openLink(url).catch(function () { g.open(url, "_blank", "noopener"); });
      g.open(url, "_blank", "noopener");
      return Promise.resolve();
    },

    /* ---- talent sharing (Teams chats and channels, sent from the user's own account) ---- */
    canShare: function () { return !!S.pca; },
    // ask for sharing permission (shows Microsoft's consent prompt the first time only)
    connectShare: function () {
      if (!S.pca) return Promise.reject(new Error("Sign-in isn't set up yet."));
      return token(true, SHARE_SCOPES).then(function () { return true; });
    },
    shareReady: function () {
      if (!S.pca) return Promise.resolve(false);
      return token(false, SHARE_SCOPES).then(function () { return true; }, function () { return false; });
    },
    tenantId: function () {
      var a = S.account || pickAccount();
      return (S.context && S.context.user && S.context.user.tenant && S.context.user.tenant.id) || (a && a.tenantId) || "";
    },
    // one-click admin approval link for the person's own company (an admin must open it)
    adminConsentUrl: function () {
      var t = API.tenantId();
      if (!CFG.clientId || !t) return "";
      return "https://login.microsoftonline.com/" + encodeURIComponent(t) + "/adminconsent?client_id=" + encodeURIComponent(CFG.clientId) +
        "&redirect_uri=" + encodeURIComponent("https://rubuild.com/winsprout/admin-consent.html");
    },
    myId: function () {
      var a = S.account || pickAccount();
      return (a && a.localAccountId) || (S.context && S.context.user && S.context.user.id) || "";
    },
    listChats: function () {
      return graph("GET", "/me/chats?$expand=members&$top=50", undefined, undefined, SHARE_SCOPES).then(json("chats")).then(function (r) {
        var me = API.myId();
        return (r.value || []).map(function (c) {
          var others = (c.members || []).filter(function (m) { return m.userId !== me; }).map(function (m) { return m.displayName || ""; }).filter(Boolean);
          var label = c.topic || (others.length ? others.slice(0, 4).join(", ") + (others.length > 4 ? " +" + (others.length - 4) : "") : (c.chatType === "oneOnOne" ? "Chat" : "Group chat"));
          return { id: c.id, label: label, type: c.chatType };
        }).filter(function (c) { return c.type === "oneOnOne" || c.type === "group" || c.type === "meeting"; });
      });
    },
    listTeams: function () {
      return graph("GET", "/me/joinedTeams", undefined, undefined, SHARE_SCOPES).then(json("teams")).then(function (r) {
        return (r.value || []).map(function (t) { return { id: t.id, label: t.displayName || "Team" }; })
          .sort(function (a, b) { return a.label.localeCompare(b.label); });
      });
    },
    listChannels: function (teamId) {
      return graph("GET", "/teams/" + encodeURIComponent(teamId) + "/channels", undefined, undefined, SHARE_SCOPES).then(json("channels")).then(function (r) {
        return (r.value || []).map(function (c) { return { id: c.id, label: c.displayName || "Channel" }; });
      });
    },
    // dest: {kind:"chat", chatId} or {kind:"channel", teamId, channelId}; msg: Graph chatMessage body
    post: function (dest, msg) {
      var path = dest.kind === "channel"
        ? "/teams/" + encodeURIComponent(dest.teamId) + "/channels/" + encodeURIComponent(dest.channelId) + "/messages"
        : "/chats/" + encodeURIComponent(dest.chatId) + "/messages";
      return graph("POST", path, JSON.stringify(msg), "application/json", SHARE_SCOPES).then(json("post"));
    },

    // delete the OneDrive copy (used by "Delete all my data")
    deleteRemote: function () {
      return graph("DELETE", "/me/drive/special/approot:/" + FILE).then(function (r) { return r.ok || r.status === 404; });
    }
  };

  g.WSSync = API;
})(typeof window !== "undefined" ? window : globalThis);
