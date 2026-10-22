# Kutchi Hub - iOS app

Capacitor 8 shell around https://www.kutchihub.com (`capacitor.config.ts` -> `server.url`), bundle id `app.kutchihub.mobile`,
Swift Package Manager (no CocoaPods), iOS 15+. The `ios/` folder was generated on Windows and is committed.

Because the app loads the live website, **all app logic is the website code** (deploy to Vercel first). Native plugins are only
reached through the Capacitor bridge, and every call checks the plugin exists (`src/lib/native.ts`). On the iOS app only:
native share, native location, push registration, offline screen and the payment-wording changes below. Android and the
website are unchanged.

## Mac checklist (after `git pull`)

```bash
node -v                      # needs Node 22 or newer (Capacitor 8). Install with nvm / nodejs.org if older.
npm ci                       # the Swift packages point into node_modules/@capacitor/*
npx cap sync ios             # MUST run once on the Mac: copies native-www, rewrites Package.swift for macOS, writes capacitor.config.json
npx cap open ios             # opens ios/App/App.xcodeproj in Xcode
```

In Xcode:

1. Wait for "Resolving Package Dependencies" to finish (bottom bar). If it fails: File > Packages > Reset Package Caches, then File > Packages > Resolve Package Versions.
2. Left list: click the blue **App** project > target **App** > **Signing & Capabilities**.
   - Tick **Automatically manage signing**, choose your **Team** (needs the paid Apple Developer account for Push).
   - Bundle Identifier must be `app.kutchihub.mobile`.
   - **Push Notifications** should already be listed (from `App.entitlements`). If Xcode says the profile does not support it: **+ Capability** > **Push Notifications**.
3. Top bar: pick an **iPhone simulator** (iPhone 15/16, iOS 17+), press **Cmd+R**. Expect the logo splash, then the website.
4. Test in the simulator: browse, search, "Near me" (Features > Location > Custom Location, grant the prompt), share a business (native share sheet), turn Wi-Fi off in the Mac -> offline page, Dashboard > Settings > Delete my account (use a throw-away account), and check that **Pricing** appears nowhere (header, listing pages, cards).
5. Real device: plug the iPhone in, select it, Cmd+R (first time: Settings > General > VPN & Device Management > trust your developer certificate). Push only works on a real device.
6. Upload: destination **Any iOS Device (arm64)** > **Product > Archive** > **Distribute App > App Store Connect > Upload**. Raise the **Build** number (target > General > Identity) for every upload; **Version** is 1.0.

App Store Connect (once): create the app with bundle id `app.kutchihub.mobile`; fill App Privacy (location - not linked/not stored,
photos, email, user content, push token); Support URL + Privacy Policy URL (https://www.kutchihub.com/privacy);
give App Review a demo account (email + password) since the app needs sign-in for owner features.

## What was audited, and what was done

| Guideline | State before | Now |
|---|---|---|
| 4.2 not just a website | Only the Android back-button handler | iOS: native share sheet (`@capacitor/share`), native location (`@capacitor/geolocation`, one real prompt), push registration (`@capacitor/push-notifications`), offline page (`native-www/offline.html` via `server.errorPath` + in-app overlay), icon + splash from the logo (1024 icon, 2732 splash) |
| 5.1.1 account deletion | Web page that said "email us" | Dashboard > **Settings** > **Delete my account** (type DELETE). `src/lib/account.functions.ts`: owned businesses are **archived**, never deleted (paid or not); the sign-in account is deleted and its profile, reviews, favourites, points, notifications and push tokens cascade away |
| 4.8 Sign in with Apple | Google + Apple buttons exist only on the web and only on Lovable hosts; they are hidden inside the app (`AuthForms.tsx`). The app offers **email + password only** | **Not required** (no third-party login in the app). If Google login is ever turned on inside the app, Sign in with Apple must be added at the same time |
| 3.1.1 payments | Pricing page, header link, Upgrade / View plans / plan wording in several cards | iOS app only: pricing page replaced by "not available in the app", header Pricing hidden, Upgrade / View plans / plan wording removed from the cards and listing pages. No external payment link remains. Website + Android unchanged |
| Info.plist texts | none | Location, camera, photo library (clear English), `ITSAppUsesNonExemptEncryption = false`, background mode `remote-notification` |

Permission texts live in `ios/App/App/Info.plist`.

## Not done / needs a decision

- **Sending push notifications.** The phone registers and its token is saved (`device_tokens`, `supabase/pending/ios-push`),
  but nothing sends pushes yet. That needs an APNs key (.p8) from the Apple Developer account, stored ONLY as a server secret
  (Vercel env), plus a small sender (for example when a row is added to `notifications`). Never put the key in the app.
- Remaining plan wording in toasts / server messages (for example "Plan active nahi hai ...") is text only, with no link or
  payment action. Say if App Review asks and it will be neutralised on iOS too.
- `capacitor.config.ts` now uses `webDir: 'native-www'` and `errorPath`. The Android project was not re-synced; it picks the
  offline page up the next time `npx cap sync android` is run.
- SQL to run (in `supabase/pending/`): `quick-listing` (if not yet), `no-hard-delete` (so archiving works), `ios-push`.
