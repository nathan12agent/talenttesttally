# Live Judge Scoring App

A real-time Progressive Web App (PWA) for running talent competitions. Judges score participants from their phones; admins control rounds and see live results — all backed by Firebase Firestore with offline support.

---

## Prerequisites

- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **Firebase CLI** — `npm install -g firebase-tools`

---

## Firebase Project Setup

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and create a new project.
2. **Enable Firestore**: Build → Firestore Database → Create database → choose **Native mode**.
3. **Enable Anonymous Authentication**: Build → Authentication → Sign-in method → Anonymous → Enable.
4. **Register a web app**: Project Overview → Add app → Web. Copy the config values shown (API key, auth domain, project ID, etc.).

---

## Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.local.example .env.local   # or just edit .env.local directly
```

Open `.env.local` and set each variable:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
NEXT_PUBLIC_ADMIN_PIN=your-chosen-admin-pin
```

All values except `NEXT_PUBLIC_ADMIN_PIN` come from the Firebase Console → Project Settings → Your apps.

---

## Installation

```bash
npm install
```

---

## Running Locally

```bash
npm run dev
```

| Route | Purpose |
|---|---|
| http://localhost:3000/judge | Judge scoring interface |
| http://localhost:3000/admin | Admin control panel |

---

## Seeding Sample Data

The seed script creates 3 judges, 3 events, 3 rounds, and 5 participants in Firestore.

1. Download a service account key: Firebase Console → Project Settings → Service accounts → Generate new private key.
2. Set the credentials path:

   ```bash
   # macOS / Linux
   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json

   # Windows (PowerShell)
   $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\service-account-key.json"
   ```

3. Run the seed:

   ```bash
   npm run seed
   ```

Sample judges created: Judge Alice (PIN `1001`), Judge Bob (PIN `1002`), Judge Carol (PIN `1003`).

---

## Deploying to Firebase Hosting

```bash
npm run build
firebase login
firebase init hosting   # set public dir to 'out', configure as single-page app
firebase deploy
```

When prompted by `firebase init hosting`:
- Public directory: `out`
- Configure as single-page app: **Yes**
- Set up automatic builds with GitHub: your choice

### Firestore Security Rules

Rules are in `firestore.rules`. Deploy them separately:

```bash
firebase deploy --only firestore:rules
```

---

## Deploying to Vercel

```bash
npx vercel
```

After deploying, add your environment variables in the Vercel dashboard (Project → Settings → Environment Variables). You need all the `NEXT_PUBLIC_FIREBASE_*` keys and `NEXT_PUBLIC_ADMIN_PIN`.

---

## Adding or Changing Judge PINs

Judges authenticate by PIN. You can manage them directly in Firestore:

- **Change a PIN**: Firebase Console → Firestore → `judges` collection → open a judge document → edit the `pin` field.
- **Add a judge**: Create a new document in the `judges` collection with the shape:

  ```json
  {
    "name": "Judge Name",
    "pin": "1234"
  }
  ```

---

## PWA Installation

The app is installable as a PWA on any device.

- **Mobile**: Open the app in the browser → tap the share/menu button → "Add to Home Screen".
- **Desktop (Chrome)**: Click the install icon in the address bar.

Score entry works offline — scores are queued locally and sync automatically when the device comes back online.
