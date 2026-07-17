#!/usr/bin/env node
// Keeps a Duolingo streak alive by completing one small practice session
// via Duolingo's private API. Exits non-zero on any failure so the GitHub
// Actions workflow is marked failed and sends an alert email.

const API = "https://www.duolingo.com/2017-06-30";

const CHALLENGE_TYPES = [
  "assist", "characterIntro", "characterMatch", "characterPuzzle",
  "characterSelect", "characterTrace", "completeReverseTranslation",
  "definition", "dialogue", "form", "freeResponse", "gapFill", "judge",
  "listen", "listenComplete", "listenMatch", "listenTap", "match", "name",
  "readComprehension", "select", "selectPronunciation",
  "selectTranscription", "speak", "tapCloze", "tapComplete",
  "tapDescribe", "translate", "typeCloze", "typeComplete",
];

function fail(message) {
  console.error(`FAILED: ${message}`);
  process.exit(1);
}

function decodeUserId(jwt) {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString());
    if (!payload.sub) throw new Error("no sub claim");
    return payload.sub;
  } catch (err) {
    fail(`could not decode user id from DUOLINGO_JWT (${err.message}) — is the token intact?`);
  }
}

async function api(method, path, jwt, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${jwt}`,
      "content-type": "application/json",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${method} ${path} -> HTTP ${res.status} ${text.slice(0, 300)}`);
  }
  return res.json();
}

async function main() {
  const jwt = (process.env.DUOLINGO_JWT || "").trim();
  if (!jwt) fail("DUOLINGO_JWT environment variable is not set");

  const userId = decodeUserId(jwt);
  const fields = "fromLanguage,learningLanguage,streak,totalXp,username";
  const before = await api("GET", `/users/${userId}?fields=${fields}`, jwt);
  console.log(
    `User: ${before.username} | course: ${before.learningLanguage} from ${before.fromLanguage} | ` +
    `streak: ${before.streak} | totalXp: ${before.totalXp}`
  );

  const session = await api("POST", "/sessions", jwt, {
    challengeTypes: CHALLENGE_TYPES,
    fromLanguage: before.fromLanguage,
    learningLanguage: before.learningLanguage,
    isFinalLevel: false,
    isV2: true,
    juicy: true,
    smartTipsVersion: 2,
    type: "GLOBAL_PRACTICE",
  });
  console.log(`Created practice session ${session.id}`);

  // Pretend the lesson took a plausible 1-5 minutes.
  const durationSec = 60 + Math.floor(Math.random() * 240);
  const endTime = Math.floor(Date.now() / 1000);
  const result = await api("PUT", `/sessions/${session.id}`, jwt, {
    ...session,
    heartsLeft: 0,
    startTime: endTime - durationSec,
    endTime,
    enableBonusPoints: false,
    failed: false,
    maxInLessonStreak: 9,
    shouldLearnThings: true,
  });
  console.log(`Completed session: +${result.xpGain ?? "?"} XP`);

  const after = await api("GET", `/users/${userId}?fields=${fields}`, jwt);
  console.log(`Streak: ${before.streak} -> ${after.streak} | totalXp: ${before.totalXp} -> ${after.totalXp}`);

  if (after.totalXp <= before.totalXp) {
    fail("session completed but totalXp did not increase — activity may not have registered");
  }
  console.log("OK: daily activity registered, streak is safe.");
}

main().catch((err) => fail(err.message));
