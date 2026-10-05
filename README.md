# MemoStack

Study-notes app for university students, built with Expo (SDK 57) +
Expo Router, Firebase (Auth, Firestore) and Cloudinary (images).

- **Admins** write rich notes — headings, lists, checklists, quotes, code,
  links and images — and read user feedback on the You tab.
- **Students** browse modules, search, read, upvote and save notes for
  offline reading, and request notes that don't exist yet.
- **Everyone** has a profile with a photo, education details, daily
  streaks, XP, levels and a rank title.

**How the app is put together, end to end: [HOW-THINGS-WORK.md](HOW-THINGS-WORK.md).**

## Run it

```sh
npm install
npx expo run:android    # build and install a development build
npx expo start          # then start the dev server
```

The app uses native modules that aren't in Expo Go (image picker and
manipulator, dev client), so use a development build: `npx expo run:android|ios`
locally, or `npx eas-cli@latest build --profile development`.

## Checks

```sh
npm run typecheck       # tsc --noEmit
npx expo lint
npm test                # jest
npx expo-doctor
```

## Firebase

```sh
firebase deploy --only firestore:rules,firestore:indexes
```

- `firestore.rules` and `firestore.indexes.json` are the source of truth
  for the backend; deploy after changing them. If a save fails with "the
  server rejected the change", the deployed rules are probably out of date.
- Admins are made by setting `isAdmin: true` on their `users/{uid}` doc in
  the Firestore console.
- Everything runs on the free Spark plan.

## Cloudinary

Note images and profile photos are hosted on Cloudinary's free plan
through an unsigned upload preset. Set your cloud name and preset in
`src/lib/cloudinary.ts`; the comment there lists the preset settings
(turn on "Return delete token"). Never put the Cloudinary API secret in
the app.

## Tuning

- XP, streak bonus, read cap and level titles: `src/config/gamification.ts`
  (mirrored in `firestore.rules` — change both).
- University years, degree suggestions, feedback types and text limits:
  `src/config/profileOptions.ts`.
- `src/editor/quillAssets.ts` is generated from `quill@2.0.3`'s dist files.
