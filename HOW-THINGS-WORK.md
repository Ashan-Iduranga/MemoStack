# How things work

A guide to MemoStack's code: what each part does, how data flows, and how
to extend it. If you change how something works, update this file in the
same commit.

---

## 1. The big picture

```
┌──────────────────────────── React Native app (Expo SDK 57) ────────────────────────────┐
│                                                                                         │
│  src/app/          Screens (Expo Router — every file is a route)                        │
│      │                                                                                  │
│      ▼                                                                                  │
│  src/screens/      Larger screen bodies used by routes (note editor, manage lists)      │
│  src/components/   Reusable UI (buttons, inputs, cards, avatar, profile widgets, toast) │
│  src/editor/       Rich text: Quill 2 in a WebView — editor, reader, toolbar config     │
│  src/hooks/        App-wide hooks (daily activity for streaks)                          │
│      │                                                                                  │
│      ▼                                                                                  │
│  src/services/     All I/O: Firestore, Cloudinary, Auth, on-device files                │
│  src/gamification/ Pure streak / XP / level logic + Colombo-time dates                  │
│  src/config/       Tunable settings (XP values, levels, form options, limits)           │
│  src/models/       Data types + pure helpers (no React, no Firebase calls)              │
│  src/lib/          Firebase and Cloudinary setup                                        │
│  src/theme/        Colors, fonts, light/dark mode                                       │
│  src/utils/        Small helpers (formatting, validation, navigation, errors)           │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                 │                         │                          │
                 ▼                         ▼                          ▼
          Firebase Auth             Cloud Firestore               Cloudinary
        (email/password)    users · subjects · notes ·      note images + avatars
                             noteRequests · feedback ·
                             follows
```

**The rule of thumb:** screens don't talk to Firebase directly. They call
a service (`NotesService`, `ProfileService`, `RequestsService`, …), and
services hand back plain model objects (`Note`, `AppUser`, `NoteRequest`).
That keeps Firebase details in one layer and makes screens easy to change.

---

## 2. Folder by folder

| Path | What lives there |
| --- | --- |
| `src/app/_layout.tsx` | Root: loads fonts, wraps the app in providers (Theme → Toast → Auth → SavedNotes), picks which routes are reachable based on auth state, and sets each stack screen's header. |
| `src/app/(tabs)/` | Bottom tabs: **Home** (`index`), **Browse**, **Upload** (`manage`, admins only), **Saved**, **You** (`profile`). The tab layout also runs `useDailyActivity`. |
| `src/app/note/[id].tsx` | The note reader. |
| `src/app/subject/[id].tsx` | All notes in one module. |
| `src/app/edit-note/[id].tsx` | Edit an existing note (reuses `NoteEditor`). |
| `src/app/edit-profile.tsx` | Edit your own profile and photo. |
| `src/app/feedback.tsx` | Send feedback (bug / idea / other). |
| `src/app/requests/` | Note requests: list (`index`), form (`new`), detail with upvote and fulfil (`[id]`). |
| `src/app/login`, `register`, `verify-email` | Auth screens. |
| `src/screens/NoteEditor.tsx` | Compose/edit a note: title, module, rich body, images, links. |
| `src/screens/ManageNotesTab.tsx`, `ManageModulesTab.tsx` | Admin lists with edit/delete. |
| `src/components/` | Shared UI. Profile-specific pieces: `Avatar`, `ProfileWidgets` (stat tiles, streak week, rank card, menu rows), `FeedbackCard` (admin inbox). |
| `src/editor/` | Rich-text engine — see section 5. |
| `src/config/gamification.ts` | Every XP, streak and level value — see section 9. |
| `src/config/profileOptions.ts` | Form choices (university years, degree suggestions, feedback types) and text length limits. |
| `src/gamification/` | `activity.ts` (what an open/read changes, levels, total XP) and `dates.ts` (Colombo calendar days). Pure, unit-tested. |
| `src/hooks/useDailyActivity.ts` | Counts "opened the app today" for streaks. |
| `src/services/` | `AuthProvider`, `notesService`, `subjectsService`, `imagesService`, `SavedNotesProvider`, `readingProgress`, `profileService`, `gamificationService`, `followService`, `feedbackService`, `requestsService`. |
| `src/models/types.ts` | `AppUser`, `Subject`, `Note`, `NoteRequest`, `FeedbackItem`, `SavedNote` + Firestore (de)serialisers. |
| `src/models/delta.ts` | Pure helpers over a note body (find images, strip unsafe images, get text). |
| `src/lib/firebase.ts`, `cloudinary.ts` | Service configuration (see section 10). |
| `firestore.rules` | Server-side security — **the real access control**. |
| `firestore.indexes.json` | Composite indexes the queries need. |
| `__tests__/` | Jest tests: helpers, a component, the Quill page itself, and the gamification logic. |

---

## 3. Accounts and access

1. **Register** (`register.tsx` → `AuthProvider.register`) creates the
   Firebase Auth user and a `users/{uid}` doc with name, email,
   university and degree. Profile and gamification fields start empty or
   zero; the rules refuse an account that starts as admin or with XP.
   Then it sends a verification email.
2. **Verify** — `_layout.tsx` uses `Stack.Protected` guards: a signed-in
   but unverified user can only see `verify-email`. Verified users see the
   tabs; signed-out users see login/register.
3. **Sign-in** loads `users/{uid}` into `AuthProvider`. If Firebase Auth
   has a provider photo (e.g. a future Google sign-in), it's copied to
   `users/{uid}.authPhotoURL`.
4. **Admins** — `isAdmin` is set by hand in the Firestore console (users
   can't change it; the rules block it). Admins get the **Upload** tab and
   the **User feedback** card on the You tab, and the rules let only admins
   write subjects and notes and read feedback.

---

## 4. Data model (Firestore)

```
users/{uid}                    name, email, university, degreeProgram, uniYear, bio, location,
                               photoURL, authPhotoURL, isAdmin, createdAt,
                               xp, currentStreak, longestStreak, lastActiveDate,
                               weekActiveDates, readsToday { date, noteIds }
subjects/{id}                  name, iconKey, notesCount, order, createdAt     ← "modules" in the UI
notes/{id}                     title, subjectId, subjectName, authorUid, authorName,
                               contentDelta  ← the note body (Quill Delta, see below)
                               plainText, excerpt, wordCount, readTimeMinutes  ← derived from contentDelta
                               voteScore, viewCount, createdAt, updatedAt
notes/{id}/votes/{uid}         votedAt     ← one doc per voter; the id makes double-voting impossible
noteRequests/{id}              subject, topic, grade, details, requesterUid, requesterName,
                               voteCount, status ('open' | 'fulfilled'),
                               fulfilledNoteId, fulfilledNoteTitle, createdAt, fulfilledAt
noteRequests/{id}/votes/{uid}  votedAt
feedback/{id}                  uid, name, type ('bug' | 'idea' | 'other'), message, platform, createdAt
follows/{follower}_{followee}  followerUid, followeeUid, createdAt   ← no follow UI yet
```

- `users/{uid}` is readable and writable **only by its owner**. That's why
  feedback and requests store the sender's name themselves.
- `subjectName` and `notesCount` are **denormalised** copies so lists
  don't need extra reads. The services keep them in sync inside
  transactions (publish, move between modules, delete, rename module).
- `voteScore`, `voteCount` and `viewCount` can only move by ±1 per write —
  enforced by `firestore.rules`, not just the app.

### The note body: a Quill Delta

`contentDelta` is a list of operations, stored as a plain Firestore array:

```json
[
  { "insert": "Hash tables" },
  { "insert": "\n", "attributes": { "header": 1 } },
  { "insert": "Collisions are handled by " },
  { "insert": "chaining", "attributes": { "bold": true } },
  { "insert": ".\n" },
  { "insert": { "image": "https://res.cloudinary.com/…/abc.jpg" } },
  { "insert": "\n" }
]
```

- Text formats (bold, link…) sit on the text; line formats (header,
  list, quote, code-block) sit on the `\n` that ends the line.
- Images are `{ "image": "<https URL>" }` embeds. **Only https URLs are
  allowed** in a saved note (`withHostedImagesOnly`), so a note can never
  contain base64 image data and hit Firestore's 1 MiB limit.
- The Delta is the **single source of truth** for which images a note
  uses. There's no separate image list to keep in sync; cleanup code calls
  `imageUrlsIn(delta)`.
- Older notes may store code blocks as `"code-block": true`. Quill loads
  those fine and saves them back as `"plain"` the next time the note is
  edited, so no migration is needed.

---

## 5. Rich text: the editor and the reader

Both use **the same HTML page** (`src/editor/quillDocument.ts`) running
Quill 2 in a `react-native-webview`. Quill is bundled into the app
(`quillAssets.ts`, generated from `quill@2.0.3`'s dist files), so it works
offline and a note looks identical while it's written and when it's read.

```
           React Native                                    WebView page (quillDocument.ts)
┌──────────────────────────────┐   injectJavaScript   ┌────────────────────────────────┐
│ QuillEditor (toolbar + view) │ ───────────────────► │ window.msFormat / msInsertImage│
│   toolbar.ts = button config │                      │ msLink / msClearFormat / msUndo│
│                              │                      │ msBlur                         │
│                              │ ◄─────────────────── │                                │
│                              │    postMessage       │ {type:'change', delta, text}   │
│                              │                      │ {type:'format', formats}       │
│                              │                      │ {type:'focus', focused}        │
└──────────────────────────────┘                      └────────────────────────────────┘
┌──────────────────────────────┐                      ┌────────────────────────────────┐
│ QuillViewer (read-only)      │ ◄─────────────────── │ {type:'height', height}        │
│   auto-sizes, opens links    │                      │ {type:'link', href}            │
└──────────────────────────────┘                      └────────────────────────────────┘
```

- **`QuillEditor`** draws a native, horizontally scrolling toolbar. Each
  button comes from `TOOLBAR_GROUPS` in `toolbar.ts`. Format buttons call
  `msFormat(key, value)`. The **image** and **link** buttons don't act on
  their own: they call back to the screen (`onRequestImage`,
  `onRequestLink`), which shows a picker or dialog and then answers through
  the editor ref (`insertImage(url)`, `setLink(url, text)`).
- **Keyboard:** the editor's keyboard belongs to the WebView, so React
  Native's `Keyboard.dismiss()` and tap-outside handling can't close it.
  The editor exposes `blur()` (→ `msBlur`), shows a hide-keyboard button
  while focused, and `NoteEditor` blurs it on any touch outside the editor.
- **`QuillViewer`** loads the same page with `readOnly`. The page measures
  itself and posts its height, so the WebView sits inside the screen's
  `ScrollView` like a normal view. Link taps are posted to React Native and
  opened with `Linking`, never inside the WebView.
- **Safety inside the page:** pasted or dropped images are blocked (Quill
  would inline them as base64). Data inlined into the page goes through
  `inlineJson`, so a note containing `</script>` can't break out of the
  script tag.

### Adding a new formatting button

1. Add an entry to `TOOLBAR_GROUPS` in `src/editor/toolbar.ts`, e.g.
   `{ id: 'h3', label: 'Heading 3', text: 'H3', ...toggle('header', 3) }`.
2. If it needs styling, add CSS in `quillDocument.ts` (it applies to both
   the editor and the reader).
3. That's it for any [Quill core format](https://quilljs.com/docs/formats).
   Formats that need input (like link or image) use a new `ToolbarAction`
   kind plus a callback prop, following the image/link pattern.
4. Add a case to `__tests__/quillDocument.test.ts` if it adds behaviour to
   the page.

---

## 6. Images (Cloudinary)

### Adding an image to a note (admin)

```
toolbar 🖼  →  Alert: library / camera
            →  ImagesService.pick()     permission → picker → resize to ≤1600px → JPEG 80%
            →  ImagesService.upload()   Cloudinary unsigned preset → https URL (+ delete token)
            →  editor.insertImage(url)  the Delta now holds the https URL
            →  url added to `uploads`   (NoteEditor state, saved with the draft)
```

- Images upload **when they're inserted**, not at publish time. The
  Delta only ever holds hosted URLs, and the editor, draft, and reader all
  treat images the same way. The cost: **adding an image needs a
  connection**. Writing text doesn't.
- Upload is a multipart `fetch` with React Native's `{ uri, name, type }`
  FormData file part, with a 60-second timeout. If Cloudinary rejects the
  upload, its reason is shown in the toast and logged.
- Pick-time resizing keeps uploads around 200–500 KB instead of 5–10 MB.
- **Profile photos** use the same pipeline (`ProfileService.changePhoto`):
  a square crop, resized to 512px, saved to `users/{uid}.photoURL` as soon
  as the upload finishes.

### Cleaning up images

Deleting from Cloudinary normally needs the API secret, which must never
ship in the app. Instead, each upload returns a **delete token** that can
delete that one image for 10 minutes (the preset's "Return delete token"
setting). `ImagesService.deleteAll` uses it when it still has a fresh
token and otherwise does nothing.

| When | What gets deleted | Where |
| --- | --- | --- |
| Publish / save a note | Images uploaded while composing that aren't in the final body | `NoteEditor.cleanUpUploads` |
| Discard a draft | Every image uploaded for that draft | `NoteEditor.discardDraft` |
| Leave the edit screen without saving | Images uploaded during that visit | `NoteEditor` unmount effect |
| Save an edit that removed images | The removed images | `NotesService.updateNote` |
| Delete a note | All its images | `NotesService.deleteNote` |
| Delete a module | All images of all its notes | `SubjectsService.deleteSubject` |

All of these only succeed for images uploaded in the **current app
session within the last 10 minutes**. Older images (deleted notes, edits
made later, drafts restored after a restart, replaced profile photos)
stay on Cloudinary. They cost a little space but never break anything;
clean them up from the Cloudinary Media Library if needed (each is tagged
`uploader_<uid>`).

### Security

- Uploads go through an **unsigned** preset, so Cloudinary doesn't check
  who is uploading. Every signed-in user can upload (profile photos), and
  someone who pulls the preset name out of the app could upload images to
  the account. The preset limits what they can do (fixed folder, jpg only).
- Anyone who has an image URL can fetch it. Don't put private material in
  note images or profile photos.

---

## 7. Publishing and editing a note

`NoteEditor` (the Upload tab's "New note", and `edit-note/[id]`):

1. **Draft autosave** (new notes only): title, module, Delta and
   `uploads` are written to AsyncStorage 500 ms after the last change and
   restored when the tab opens again.
2. **Publish:** the body goes through `withHostedImagesOnly`, then
   validation (needs a title, plus text or an image, plus a module). A
   module typed under "Add new module" is reused if one with that name
   exists. `plainText`, `excerpt`, `wordCount` and `readTimeMinutes` are
   derived from the body.
3. `NotesService.publishNote` writes the note and bumps the module's
   `notesCount` in **one transaction**. Transactions need the server, so
   publishing needs a connection. If it fails, the draft is kept and the
   admin is told to retry.
4. **Edit:** `NotesService.updateNote(next, previous)` saves, moves the
   module counts if the module changed, and deletes images the edit
   removed.

---

## 8. Reading, voting, and offline notes

- **Reader** (`note/[id].tsx`): gets the note from `handoff` (when the
  list already had it) or Firestore. Once per visit it bumps `viewCount`
  and records a read for streaks/XP. It shows the upvote toggle (a
  transaction that writes `votes/{uid}` and moves `voteScore` by ±1) and
  renders the body with `QuillViewer`.
- **Saved offline** (`SavedNotesProvider`): the bookmark button writes the
  note's JSON **and downloads its images** to the app's documents folder:

  ```
  memostack_saved/
    manifest.json             list of saved notes + sizes
    {noteId}.json             the note (incl. its { url → file } image map)
    images/{noteId}/0.jpg …   image copies
  ```

  The 50 MB quota counts the JSON and the images. When the reader opens
  a saved note, `useReadableBody` swaps each image URL for an on-device
  copy (`getOfflineImages` → data URIs). Saved notes therefore show their
  images without a network, and still show the latest text when online.

---

## 9. Profile, streaks, XP and levels

The **You** tab shows the signed-in user's profile (photo, name, location,
level, bio), an Education card, Followers / Following / XP, this week's
streak, the rank card, and — for admins — the User feedback card. The
profile doc is a live listener, so edits show immediately.

### Where XP comes from

| Source | XP | Stored or derived |
| --- | --- | --- |
| First activity of the day (open app or read a note) | +10 | stored `xp` |
| Reading a note (once per note per day, max 40/day) | +5 | stored `xp` |
| Streak reaching a multiple of 7 days | +50 | stored `xp` |
| Each published note | +20 | derived from `count()` of your notes |
| Each net upvote on your notes | +2 | derived from `sum(voteScore)` of your notes |

Upvote and note XP are **derived**, not stored, so a voter never writes
the author's profile (users can only write their own doc). Unvotes and
deleted notes correct themselves. Level and rank title are computed from
total XP and never stored.

- **All values live in `src/config/gamification.ts`**: XP amounts, the
  read cap, and the level table (`LEVELS`: XP threshold + rank title).
  `firestore.rules` mirrors the stored-XP values (10 / 50 every 7 days /
  5 / 40 reads) and the UTC+05:30 offset — change both together.
- **Days are Asia/Colombo days** (UTC+05:30, no DST) as `'YYYY-MM-DD'`
  strings (`src/gamification/dates.ts`).
- **`applyActivity`** (`src/gamification/activity.ts`) is the single place
  that decides what an open/read changes. `GamificationService.recordActivity`
  runs it in a transaction; it's called by `useDailyActivity` (tab layout
  mount + app foreground) and the note reader.
- The shown streak drops to 0 once a day is missed (`liveStreak`), even
  though the stored `currentStreak` only resets on the next activity.

### Tamper resistance (rules)

An owner's update may only touch profile and gamification fields (never
`isAdmin`/`email`/`createdAt`). The rules recompute "today" in Colombo
time from the **server clock** and require the write to match
`applyActivity` exactly: a new day must be today, the streak is +1 only
after yesterday (else 1), reads grow by one note, and `xp` rises by
exactly the XP those changes earn. Changing the phone's clock or replaying
writes earns nothing. (Rules functions allow at most 10 variables, which
is why the check is split into `validDayChange` / `validReadChange` /
`validXpChange`.)

### Profile fields and Edit Profile

Sign-up, Profile and Edit Profile share one set of fields on
`users/{uid}`: `name`, `university` (shown as Institution), `degreeProgram`
(Degree — free text with suggestions), `uniYear` (Year: a `UNI_YEARS` key
such as `year2` or `graduated`), `bio` (≤160), `location`.

- Edit Profile loads the doc fresh (spinner until it arrives), enables
  **Save changes** only when something changed, and validates name and bio.
- The retired `alYear` / `alStream` fields are deleted from a user's doc
  by `ProfileService.watchProfile` the first time it loads; the rules let
  them be removed but never set.
- Save errors go through `writeErrorMessage` (`src/utils/errors.ts`), which
  tells a rules rejection ("permission-denied") apart from a connection
  problem.

### Avatar

`photoURL` (a custom photo from Edit Profile) wins; otherwise
`authPhotoURL` (the sign-in provider's photo, with Google's `=s96-c`
swapped for `=s400-c`); otherwise initials. The initials are drawn under
the photo, so a loading or broken image never shows an empty circle.
Email/password accounts have no provider photo.

### Followers, feedback, note requests

- **Followers / Following** count docs in `follows`. There is no Follow
  button yet; the rules and counts are ready for one.
- **Feedback** goes to `feedback`: users can only create it; admins read
  it in the **User feedback** card (newest 50, live, filter by type, tap to
  expand). Each message stores the sender's name.
- **Note requests** live in `noteRequests` with a `votes/{uid}`
  subcollection like notes. Anyone signed in can post and upvote; the
  requester or an admin marks one fulfilled by linking an existing note
  (the rules check the note exists and the title matches) or deletes it.
  Home's search offers "Request a note" when nothing matches.

---

## 10. Setup (one-time per environment)

1. **Firebase:** the app uses the Firebase JS SDK, so it needs a **Web
   app** registration's config in `src/lib/firebase.ts`. The CLI project
   is set in `.firebaserc`. Everything runs on the free Spark plan.
2. **Cloudinary (free plan):** create an **unsigned** upload preset
   (Settings → Upload → Upload presets): a fixed asset folder, allowed
   formats `jpg`, **Return delete token** on. Put your cloud name and
   preset name in `src/lib/cloudinary.ts` (the comment there repeats
   these settings). No API secret goes in the app.
3. **Deploy rules and indexes** (after any change to them):
   `firebase deploy --only firestore:rules,firestore:indexes`.
4. **Make yourself an admin:** in the Firestore console, set
   `users/{your uid}.isAdmin` to `true`.
5. **Build a development build.** `expo-image-picker`,
   `expo-image-manipulator` and `expo-dev-client` are native, so Expo Go
   won't do; an over-the-air update isn't enough after adding native
   modules.

---

## 11. Everyday commands

```sh
npx expo start               # dev server (needs a development build installed)
npx expo run:android         # build + install a dev build locally
npx expo install <package>   # add a dependency (picks SDK-compatible versions)
npm run typecheck && npx expo lint && npm test   # run before every commit
npx expo-doctor              # dependency / config health check
npx eas-cli@latest build --profile preview --platform android   # shareable APK
firebase emulators:start --only firestore   # try rules locally (needs Java)
```

---

## 12. Known gaps and good next steps

- **"Continue reading" is never filled in.** Home reads
  `ReadingProgress.getLastNoteId()`, but the reader never calls
  `ReadingProgress.setLastRead`. Wire it to the reader's scroll position.
- **Follow button and public profiles.** The `follows` collection, rules
  and counts exist; users can't follow anyone yet.
- **Google sign-in.** The avatar and `authPhotoURL` already handle a
  provider photo; only the sign-in itself is missing.
- **Image captions / sizing:** Quill images support `alt`/`width`
  attributes. A small "image options" sheet could set them.
- **Cover images on cards:** `imageUrlsIn(note.contentDelta)[0]` could be
  shown as a thumbnail in note lists without any new Firestore field.
- **Orphan image sweep:** images outside the 10-minute delete-token window
  stay on Cloudinary. A small backend holding the API secret (e.g. a
  scheduled function) could delete images no note or profile references.
- **Rules tests in the repo:** the rules were checked against the
  emulator with a throwaway script; a committed `@firebase/rules-unit-testing`
  suite would keep them checked.
- **Search** is client-side over the latest 300 notes (fine at this
  scale). A dedicated search service would be needed for thousands of notes.
