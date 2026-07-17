# duolingo-streak-bot

Keeps a Duolingo streak alive with zero human involvement. Three times a day,
a GitHub Actions schedule runs `streak.js`, which uses Duolingo's private API
to complete one small practice session (~10 XP) — enough to register daily
activity and extend the streak. No browser, no clicks.

**If it ever breaks, GitHub emails you** (scheduled workflow failure
notifications go to the repo owner's email). Silence means it's working.

## How it works

1. Authenticates with the long-lived `DUOLINGO_JWT` stored as a repo Actions secret
2. `POST /2017-06-30/sessions` creates a `GLOBAL_PRACTICE` session
3. `PUT /2017-06-30/sessions/{id}` marks it completed with a plausible 1–5 min duration
4. Verifies XP actually increased; exits non-zero (→ failure email) otherwise

## If you ever get a failure email

Almost always the JWT died (e.g., you changed your Duolingo password). Refresh it:

1. Log in at duolingo.com in Chrome
2. Open DevTools console and run:
   ```js
   document.cookie.split(';').find(c => c.includes('jwt_token')).split('=')[1]
   ```
3. Update the secret: `gh secret set DUOLINGO_JWT --repo <you>/duolingo-streak-bot`
4. Test: `gh workflow run streak.yml` then `gh run watch`

## Pausing / stopping

Disable the workflow in the repo's Actions tab (or delete the repo).

## Local test

```sh
DUOLINGO_JWT=... node streak.js
```

> ⚠️ Automating Duolingo violates its Terms of Service. Low volume and
> randomized run times reduce detection risk, but a ban or streak reset is
> always possible.
