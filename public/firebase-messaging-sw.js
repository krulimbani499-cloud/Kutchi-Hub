/* Kutchi Hub: browser push for "New business in <your city>" (Firebase Cloud Messaging).
 *
 * Registered by the website ONLY after a person pressed the notification button and allowed notifications (src/lib/web-push.ts).
 * The public Firebase settings (no secrets: apiKey, projectId, messagingSenderId, appId) come in the address of this file:
 *   /firebase-messaging-sw.js?apiKey=...&projectId=...&messagingSenderId=...&appId=...
 * The server sends DATA-ONLY messages { title, body, link_url, tag }, so the text and the page to open are ours. */

var SDK = "https://www.gstatic.com/firebasejs/10.14.1/";
var params = new URL(self.location.href).searchParams;

try {
  importScripts(SDK + "firebase-app-compat.js", SDK + "firebase-messaging-compat.js");
  if (params.get("apiKey") && params.get("projectId") && params.get("messagingSenderId") && params.get("appId")) {
    firebase.initializeApp({
      apiKey: params.get("apiKey"),
      projectId: params.get("projectId"),
      messagingSenderId: params.get("messagingSenderId"),
      appId: params.get("appId"),
    });
    firebase.messaging().onBackgroundMessage(function (payload) {
      var d = (payload && payload.data) || {};
      if (!d.title) return;
      return self.registration.showNotification(d.title, {
        body: d.body || "",
        icon: "/favicon.png",
        badge: "/favicon.png",
        tag: d.tag || undefined,
        data: { url: d.link_url || "/" },
      });
    });
  }
} catch (e) {
  /* The Firebase script could not be loaded (offline, blocked): the worker still installs; it will do its job after the next update. */
}

// Tapping the notification opens the page (only an address on this site is followed).
self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var target = self.location.origin + "/";
  try {
    var u = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin);
    if (u.origin === self.location.origin) target = u.href;
  } catch (e) {
    /* keep the home page */
  }
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (windows) {
      for (var i = 0; i < windows.length; i++) {
        var w = windows[i];
        if ("focus" in w && "navigate" in w) return w.navigate(target).then(function (c) { return c && c.focus(); });
      }
      return self.clients.openWindow(target);
    }),
  );
});
