# PLAN — what's next for Huddl

Read `STATE.md` first.

---

## 1. Verify both builds before they deploy

Three workflows deploy; none checks anything first. Given two backends —
`localStorage` for internal, Firestore for public — a change can be correct in
one build and broken in the other, and today nothing would catch it.

The minimum worth adding: build both targets on pull requests. That alone covers
the most likely failure, which is a change that assumes one storage layer.

---

## 2. Then test the storage seam specifically

If any testing effort follows the build check, it should go where the two builds
diverge — the data layer. Everything above that seam is shared and fails
identically in both; everything below it is where the builds differ and where an
untested change is genuinely risky.

---

## 3. Keep the committed `.env` files client-only

`.env.jackhenry` and `.env.public` are committed on purpose and hold only
`VITE_FIREBASE_*` client configuration, which is public by design. The
arrangement is safe **because** of that restriction, not despite it.

Worth stating as a rule, since the next person to add a variable will reasonably
assume a committed `.env` is the place to put one. It is not, for anything that
must stay secret.

---

## Deliberately not doing

**No merging of the two deployments.** They have different hosts, different
storage, and different audiences. One codebase with an explicit split is
simpler than one deployment trying to serve both.
