/* AI City's app bridge. Added by the city to every app; a worker's file with this name is replaced.
   The app asks the AI City page that shows it; it never reaches the network, a token or the API.
     const r = await aic.request("calendar.read", { from, to });
     // r = { ok: true, data } | { ok: false, error, message }
     await aic.propose("calendar.respond", { id, response: "accept" }); // the owner approves it in Needs you
   aic.preview is true in the publish preview, which never gets data. */
(function () {
  "use strict";
  var pending = Object.create(null);
  var preview = /\/drafts\//.test(String(location.pathname));
  var TIMEOUT_MS = 30000;

  function newId() {
    var a = new Uint8Array(12);
    crypto.getRandomValues(a);
    var s = "";
    for (var i = 0; i < a.length; i++) s += (a[i] + 256).toString(16).slice(1);
    return s;
  }

  window.addEventListener("message", function (e) {
    if (e.source !== window.parent) return;
    var m = e.data;
    if (!m || m.aic !== 1 || typeof m.id !== "string") return;
    var p = pending[m.id];
    if (!p) return;
    delete pending[m.id];
    clearTimeout(p.timer);
    p.resolve(
      m.ok === true
        ? { ok: true, data: m.data }
        : { ok: false, error: String(m.error || "unavailable"), message: String(m.message || "") }
    );
  });

  function send(cap, params) {
    return new Promise(function (resolve) {
      if (window.parent === window) {
        resolve({ ok: false, error: "unavailable", message: "Open this app inside AI City." });
        return;
      }
      var id = newId();
      var timer = setTimeout(function () {
        delete pending[id];
        resolve({ ok: false, error: "unavailable", message: "AI City did not answer." });
      }, TIMEOUT_MS);
      pending[id] = { resolve: resolve, timer: timer };
      window.parent.postMessage({ aic: 1, id: id, cap: String(cap), params: params || {} }, "*");
    });
  }

  window.aic = Object.freeze({
    version: 1,
    preview: preview,
    request: function (cap, params) {
      return send(cap, params);
    },
    propose: function (kind, params) {
      return send("propose", { kind: String(kind), params: params || {} });
    },
  });
})();
