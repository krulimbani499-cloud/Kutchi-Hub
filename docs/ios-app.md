# Kutchi Hub - iOS app

Capacitor 8 shell around https://www.kutchihub.com (`capacitor.config.ts` -> `server.url`), bundle id `app.kutchihub.mobile`,
Swift Package Manager (no CocoaPods), iOS 15+. The `ios/` folder was generated on Windows and is committed.

Because the app loads the live website, **all app logic is the website code** (deploy to Vercel first). Native plugins are only
reached through the Capacitor bridge, and every call checks the plugin exists (`src/lib/native.ts`). On the iOS app only:
native share, native location, push registration, offline screen and the payment-wording changes below. Android and the
website are unchanged.

## Mac checklist (Xcode)

Project facts: bundle id `app.kutchihub.mobile`, Team `66D7LCJY38` (KUTCHI HUB), Automatic signing, Version **1.0.0**, Build **1**,
iOS 15+, `GoogleService-Info.plist` is already in the target (Copy Bundle Resources).

**0. Before Xcode (Terminal)**
```bash
git pull
node -v                      # Node 22 or newer (Capacitor 8)
npm ci                       # the Swift packages point into node_modules/@capacitor/* and @capacitor-firebase/*
npx cap sync ios             # MUST run on the Mac: rewrites Package.swift paths for macOS, copies native-www
npx cap open ios
```

**1. Team + signing** (blue **App** project > target **App** > **Signing & Capabilities**)
- [ ] Wait for "Resolving Package Dependencies" (bottom bar). The first time it downloads firebase-ios-sdk (a few minutes). If it fails: File > Packages > Reset Package Caches, then Resolve Package Versions.
- [ ] **Automatically manage signing** ticked, **Team** = KUTCHI HUB (66D7LCJY38). Sign in under Xcode > Settings > Accounts if the team is not listed.
- [ ] Bundle Identifier = `app.kutchihub.mobile`.
- [ ] No red errors in the signing section (Xcode creates the provisioning profile by itself).

**2. Capabilities** (same screen)
- [ ] **Push Notifications** is listed (comes from `App.entitlements`). If not: **+ Capability** > Push Notifications.
- [ ] **Background Modes** > tick **Remote notifications** (already in Info.plist as `UIBackgroundModes`; the tick makes Xcode show it and add it to the App ID).
- [ ] `App.entitlements` keeps `aps-environment = development`: Xcode switches it to `production` by itself when you Archive / distribute. Do not edit it.
- [ ] Left list: `GoogleService-Info.plist` is there; File Inspector (right) > Target Membership: **App** ticked.

**3. Test on a real iPhone** (push does not work in the Simulator)
- [ ] Plug in the iPhone, select it, **Cmd+R**. First time: iPhone Settings > General > VPN & Device Management > trust the developer certificate.
- [ ] Open the app: **no** notification question appears at start.
- [ ] Home page > pick a city > tap "🔔 Naye business ki khabar paayein": the iOS permission dialog appears now, tap Allow, the line "Alerts ... ON" appears. (The card is admin-only "TEST MODE" until `SHOW_CITY_PUSH = true`.)
- [ ] Admin > Send test notification to my device: it arrives (app in background and closed). Tap it: the page opens.
- [ ] Wi-Fi / mobile data off, reopen the app: the "Internet connection nahi hai" page appears (same design as Android).
- [ ] Pricing / Upgrade / plan prices / "Contact to activate" appear nowhere (menu, home, listing page, dashboard, My Listings, footer).
- [ ] Dashboard > Settings > Delete my account is reachable (use a throw-away account).
- [ ] WhatsApp / Instagram / Maps / call buttons open the other app or Safari and you can come back to Kutchi Hub.

**4. Archive + upload**
- [ ] Destination (top bar) = **Any iOS Device (arm64)**.
- [ ] **Product > Archive**. When the Organizer opens: **Distribute App > App Store Connect > Upload** (accept the defaults: automatic signing, upload symbols).
- [ ] Every new upload needs a higher **Build** number (target > General > Identity > Build). Version stays 1.0.0 for the first release.

**5. App Store Connect (appstoreconnect.apple.com) + TestFlight**
- [ ] My Apps > Kutchi Hub > TestFlight: the build shows "Processing" for 10-30 minutes, then an email arrives. If it asks about **Export Compliance**: answer No (already set: `ITSAppUsesNonExemptEncryption = false`).
- [ ] Internal testing: add testers (App Store Connect users), install with the TestFlight app, repeat the checks of step 3.
- [ ] App Store tab > version 1.0.0 > choose the build; fill App Privacy (location - not linked / not stored, photos, email, user content, **push token / device ID**), Support URL, Privacy Policy URL `https://www.kutchihub.com/privacy`, screenshots, description.
- [ ] App Review Information: give a demo account (email + password) and a note: "Sign in with email and password. Account deletion: Dashboard > Settings > Delete my account. Plans are not sold in the app."
- [ ] Submit for Review.

## Push notifications on iOS (how it works)

- Plugin: **@capacitor-firebase/messaging** (the native iOS side; the page calls it through `src/lib/native-push.ts`). Reason: our server sends
  through Firebase Cloud Messaging (`src/lib/fcm.server.ts`), which needs an **FCM token**; `@capacitor/push-notifications` on iOS only
  returns the raw APNs token. The Firebase plugin asks Apple for permission, gets the APNs token and exchanges it for the FCM token.
- The APNs key is uploaded in Firebase (Project settings > Cloud Messaging); `GoogleService-Info.plist` links the app to that project.
- The token is saved with `registerPushSubscription` into `push_subscriptions` (`platform = 'ios'`, per city), exactly like the website.
  No new SQL (the `city-push` migration already allows `ios`). `supabase/pending/ios-push` (`device_tokens`) is **obsolete**: do not run it.
- The permission dialog opens only when the person taps "🔔 Naye business ki khabar paayein" (`CityPushCard`). `FirebaseMessagingAutoInitEnabled = NO`
  in Info.plist: no FCM token is made or sent anywhere before that tap.
- Tapping a notification opens `data.link_url` (`CityPushSync`).
- `@capacitor/push-notifications` is **removed** from package.json: the Firebase plugin's README says no other push plugin may be installed (both set
  `notificationRouter.pushNotificationHandler`, so the notification-tap event could go to the wrong plugin). Tap flow: the plugin fires
  `notificationActionPerformed` (retained until a listener exists, so it also works when the app was closed) with `notification.data.link_url`;
  `CityPushSync` -> `listenForNotificationTaps` opens that path (`/business/<slug>`, or `/all-business?city=..&sort=newest`) with `router.history.push`.
- Android: the installed Android 1.0.3 is unchanged (the `android/` folder was not touched, and the web code never calls any push plugin on Android).
  The next `npx cap sync android` would drop the old push plugin and add the Firebase one; Android push then needs a `google-services.json` (same
  step Android 1.0.4 needs anyway).

## What was audited, and what was done

| Guideline | State before | Now |
|---|---|---|
| 4.2 not just a website | Only the Android back-button handler | iOS: native share sheet (`@capacitor/share`), native location (`@capacitor/geolocation`, one real prompt), push alerts (`@capacitor-firebase/messaging`, only after a tap on the alerts card), offline page (`native-www/offline.html` via `server.errorPath` + in-app overlay), icon + splash from the logo (1024 icon, 2732 splash) |
| 5.1.1 account deletion | Web page that said "email us" | Dashboard > **Settings** > **Delete my account** (type DELETE). `src/lib/account.functions.ts`: owned businesses are **archived**, never deleted (paid or not); the sign-in account is deleted and its profile, reviews, favourites, points, notifications and push tokens cascade away |
| 4.8 Sign in with Apple | Google + Apple buttons exist only on the web and only on Lovable hosts; they are hidden inside the app (`AuthForms.tsx`). The app offers **email + password only** | **Not required** (no third-party login in the app). If Google login is ever turned on inside the app, Sign in with Apple must be added at the same time |
| 3.1.1 payments | Pricing page, header link, Upgrade / View plans / plan wording in several cards | iOS app only: pricing page replaced by "not available in the app", header Pricing hidden, Upgrade / View plans / plan wording removed from the cards and listing pages. No external payment link remains. Website + Android unchanged |
| Info.plist texts | none | Location, camera, photo library (clear English), `ITSAppUsesNonExemptEncryption = false`, background mode `remote-notification` |

Permission texts live in `ios/App/App/Info.plist`.

## Not done / needs a decision

- Remaining plan wording in server error texts (for example "Plan active nahi hai ...", "plan limit reached") is text only with no link or button.
  In the iOS app the visible ones are neutralised (listing screens, "Contact Kutchi Hub to add more"). Say if App Review asks about the rest.
- `GoogleService-Info.plist` is not a secret (Firebase client settings, shipped inside every app), so it may be committed. Restrict its API key
  to the iOS bundle id in Google Cloud Console > APIs & Services > Credentials.
- `capacitor.config.ts` uses `webDir: 'native-www'` and `errorPath`. The Android project was not re-synced; it picks the new offline page up the
  next time `npx cap sync android` is run.
- SQL to run (in `supabase/pending/`): `city-push` (replaces `ios-push`), `quick-listing` (if not yet), `no-hard-delete` (so archiving works).
