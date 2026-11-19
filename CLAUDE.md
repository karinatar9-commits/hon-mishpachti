# Karin OS — rules for every session (read before touching anything)

## This repo is PUBLIC
github.com/karinatar9-commits/hon-mishpachti is public, and the whole repo is published as a public website (GitHub Pages).
Anything committed — even once, even if deleted in the next commit — is public and stays in the history.

## Never put personal or financial data in code
Not allowed in any file, including defaults, fallbacks, examples, placeholders, comments and prompts:
- money that belongs to Karin, the family, Ben-Hur, Glow House or clients: balances, salary, spending, holdings, deposits, deals
- account, card, policy or ID numbers (also partial, such as the last four digits)
- people's names together with facts about them; client data of any kind
- email addresses, phone numbers, home addresses (the clinic's public address and Financy mentions are allowed)
- names of deals or negotiations

Where it goes instead:
- **Supabase table `os_private`** (key `app`, readable only by Karin via `os_is_karin()`). The app loads it after login (`__pvLoad` in os/app.js): text through `__P("pN")`, numbers through `__F("key")`, and the objects `L`, `wt`, `Oa`, `la`, `ua`, `cash`, `ot[*].words`. To change that content, update the row in SQL. The column is `json` on purpose (keeps key order) — never convert it to jsonb.
- Other data: Supabase tables with RLS (`os_is_karin()`).
- Function settings such as Karin's notification address: `os_settings` (e.g. key `owner_email`) or function secrets — never a literal in os/fn/*.ts.

## The privacy check (must pass)
- Once per clone: `sh scripts/install-hooks.sh` — the pre-commit and pre-push hooks run `python3 scripts/check-private.py`.
- GitHub runs the same check on every push (.github/workflows/site.yml). **The website is published only when it passes.** A failure means: take the data out of the code (and tell Karin), not bypass the check.
- Never use `--no-verify`, never weaken scripts/check-private.py, never add to `.privacy-allow` without Karin's explicit OK.
- The private denylist (names, deals, real amounts) is not in the repo: it lives in the GitHub secret `PRIVATE_DENYLIST` and in `~/.config/karin-os/denylist.txt` on Karin's computer.

## The history was rewritten on 19.11.2026
Clones made before 19.11.2026 ~21:10 (Israel time) still contain the old history with personal data.
Delete them and clone fresh. Never push from an old clone, never `git push --force`, never merge or rebase old branches into the new history.

## Commit identity
Commit as `Karin Atar <296146375+karinatar9-commits@users.noreply.github.com>` or the session's own no-reply identity — never a personal email address.

## Edge functions
Six functions are loaders that import `os/fn/<name>.ts` at a pinned commit: os-content, os-google, guide-lead, os-tts, os-morning, glow-booking.
After changing os/fn/<name>.ts: push, then redeploy the loader with the new commit SHA, then check that the function answers.
