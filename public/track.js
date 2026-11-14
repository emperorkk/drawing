// Anonymous usage counts. Sends only the event name and a few fixed fields (see /aporrito/).
// No cookies, no IDs, nothing stored on the device. Skipped when the browser asks not to be tracked.
(function () {
  var off = false;
  try { off = navigator.doNotTrack === "1" || window.doNotTrack === "1" || navigator.globalPrivacyControl === true; } catch (e) {}
  function send(e, data) {
    if (off) return;
    var body = { e: e };
    for (var k in data || {}) body[k] = data[k];
    try {
      var blob = new Blob([JSON.stringify(body)], { type: "application/json" });
      if (!(navigator.sendBeacon && navigator.sendBeacon("/api/event", blob)))
        fetch("/api/event", { method: "POST", body: blob, keepalive: true }).catch(function () {});
    } catch (err) {}
  }
  window.track = send;
  // Page view: page type, the site the visitor came from (host name only), and whether the app is installed.
  var page = document.documentElement.getAttribute("data-page") || "other";
  var ref = "";
  try { var r = document.referrer && new URL(document.referrer); if (r && r.host !== location.host) ref = r.hostname; } catch (e) {}
  var installed = false;
  try { installed = matchMedia("(display-mode: standalone)").matches; } catch (e) {}
  send("page_view", { p: page, r: ref, i: installed ? 1 : 0 });
})();
