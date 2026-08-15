# STATE — where Huddl actually is

Last updated: 2026-08-12.

---

## In one paragraph

An agile retrospective and sprint-planning tool that ships as **two distinct
deployments from one codebase**: `jhuddl`, a Jack Henry internal build on
Netlify backed by `localStorage`, and `huddl`, the public build on Firebase
backed by Firestore. Most of the complexity here is in that split rather than in
the app.

---

## Two targets, two backends

| Build | Host | Storage | Config |
| --- | --- | --- | --- |
| `jhuddl` (internal) | Netlify | `localStorage` | `.env.jackhenry` |
| `huddl` (public) | Firebase Hosting | Firestore | `.env.public` |

Three workflows deploy them: `deploy-jh.yml`, `deploy-public.yml`, and
`deploy-site.yml`.

**Both `.env` files are committed deliberately.** They hold `VITE_FIREBASE_*`
web configuration, which is client-side and not secret — a Firebase web config
is shipped to every browser that loads the app, and access is controlled by
security rules rather than by hiding it. Committing them is what makes the two
deploy workflows reproducible without secret management.

That is defensible, and it is worth knowing precisely, because the same file
name usually means the opposite. **Anything genuinely secret must not go in
these files** — the rule that makes the current arrangement safe is that they
contain only client config.

---

## Not covered

**No tests, in either build.** Roughly 51 `.jsx` and 44 `.js` files, and the
workflows deploy rather than verify. A change that breaks the internal build is
found by someone at Jack Henry opening it.

The two-target split makes that sharper than a test gap normally is: the storage
layers differ, so a change can work in one build and fail in the other, and
nothing exercises both.
