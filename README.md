# RMW CRM – mobile app

Expo (SDK 58) + React Native + Expo Router app for the RMW CRM (`crm.ritzmediaworld.com`).
Package: `com.ritzmediaworld.crm`. Separate from `rmw-app` (the public Ritz Media World app).

## Run in Expo Go

```bash
npm install
npm start          # scan the QR code with Expo Go (Android) or the Camera app (iOS)
```

By default the app talks to the production CRM. To use a local backend, create `.env.local`:

```
EXPO_PUBLIC_CRM_URL=http://<your-PC-LAN-IP>:3000
```

(the phone must be on the same Wi-Fi; `localhost` won't work from a phone). Restart `npm start` after changing it.

## How auth works

The CRM API uses an httpOnly session cookie. React Native's native networking stores and resends cookies,
so the app just calls `/api/auth/login` → `/api/auth/otp/verify` like the web app. Write requests are
protected by an Origin check, so `src/lib/api.ts` sends `Origin: <CRM_URL>` on every request.

## Screens

| Route | What |
| --- | --- |
| `login` | Email + password (with new-device OTP) or mobile OTP |
| `(tabs)/index` | My dashboard: overdue, due today, new, won; recent leads |
| `(tabs)/leads` | Search + filters (mine, unassigned, MPF/RMW/CT/careers), infinite scroll |
| `(tabs)/followups` | Today / overdue / upcoming / done, mark done |
| `(tabs)/notifications` | Alerts, mark read, open the linked lead |
| `(tabs)/profile` | Account, sign out |
| `lead/[id]` | Call / WhatsApp / email, change stage, notes, quick follow-ups, activity |

## Checks & builds

```bash
npm run typecheck
npm run lint
npm run build:apk   # EAS preview APK (run `npx eas-cli init` once to link an EAS project)
```
