// End-to-end check of VitNode realtime on a running Worker. Every push starts
// as an ordinary HTTP request to the Worker; the sockets live in the Durable
// Object hub. See README.md next to this file for the setup; run it against a
// fresh database: the first account it creates becomes the root admin.
//
// SMOKE_URL (default http://localhost:8787) and POSTGRES_URL (for seeding a
// blog post) can be overridden. SMOKE_HIBERNATION_WAIT=80 adds a hibernation
// round. Against `dev` (Node transport, rate limiter off) run it with
// SMOKE_URL=http://localhost:3000 SMOKE_RATE_LIMIT=off.
import postgres from "postgres";
import WebSocket from "ws";
import * as Y from "yjs";

const BASE = process.env.SMOKE_URL ?? "http://localhost:8787";
const ORIGIN = new URL(BASE).origin;
const WS_URL = `${BASE.replace(/^http/, "ws")}/api/ws`;
const CORE = `${BASE}/api/@vitnode/core`;
const PASSWORD = "Smoke-test-1234";
const DEMO_ID = "cloudflare_realtime_demo";
const LIVE_ID = "@vitnode/core_content_live";
const NOTIFICATIONS_STATE_ID = "@vitnode/core_notifications_state";

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ detail, name, ok });
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`,
  );
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** A cookie jar per "browser". */
const browser = () => {
  const cookies = new Map();

  return {
    cookie: () => [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
    fetch: async (path, init = {}) => {
      const response = await fetch(
        path.startsWith("http") ? path : `${CORE}${path}`,
        {
          ...init,
          headers: {
            ...(init.body ? { "content-type": "application/json" } : {}),
            cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
            origin: ORIGIN,
            ...init.headers,
          },
        },
      );
      for (const raw of response.headers.getSetCookie()) {
        const [pair] = raw.split(";");
        const [name, ...value] = pair.split("=");
        if (/max-age=0|expires=thu, 01 jan 1970/i.test(raw))
          cookies.delete(name);
        else cookies.set(name, value.join("="));
      }

      return response;
    },
  };
};

/** One socket with its received frames. */
const connect = (jar, { headers = {}, origin = ORIGIN } = {}) =>
  new Promise(resolve => {
    const ws = new WebSocket(WS_URL, {
      headers: { cookie: jar?.cookie() ?? "", origin, ...headers },
    });
    const frames = [];
    const socket = {
      closed: new Promise(done =>
        ws.on("close", (code, reason) =>
          done({ code, reason: String(reason) }),
        ),
      ),
      frames,
      of: id =>
        frames.filter(frame => frame.id === id).map(frame => frame.data),
      send: (id, data) => ws.send(JSON.stringify({ data, id })),
      setCookie: [],
      status: 101,
      waitFor: async (predicate, ms = 3000) => {
        const until = Date.now() + ms;
        while (Date.now() < until) {
          const found = frames.find(predicate);
          if (found) return found;
          await sleep(25);
        }

        return undefined;
      },
      ws,
    };
    ws.on("message", raw => frames.push(JSON.parse(String(raw))));
    ws.on("upgrade", response => {
      socket.setCookie = response.headers["set-cookie"] ?? [];
    });
    ws.on("open", () => resolve(socket));
    ws.on("unexpected-response", (_request, response) => {
      socket.status = response.statusCode;
      resolve(socket);
    });
    ws.on("error", () => resolve(socket));
  });

/**
 * Resolves the close code and reason once the server's close frame arrives.
 * A hibernating hub sends it at once but may tear the TCP connection down
 * later; browsers finish the close shortly after the frame, Node's `ws` only
 * after 30 s, so this reads the frame instead of waiting for `close`.
 */
const closeFrameOf = async (socket, ms = 5000) => {
  const until = Date.now() + ms;
  while (Date.now() < until && socket.ws.readyState < 2) await sleep(50);
  if (socket.ws.readyState < 2) return undefined;

  return {
    code: socket.ws._closeCode,
    reason: String(socket.ws._closeMessage ?? ""),
  };
};

const signUp = async email => {
  const jar = browser();
  await jar.fetch("/users/sign_up", {
    body: JSON.stringify({
      email,
      name: email.split("@")[0],
      password: PASSWORD,
    }),
    method: "POST",
  });
};

const signIn = async (email, { admin = false } = {}) => {
  const jar = browser();
  const response = await jar.fetch("/users/sign_in", {
    body: JSON.stringify({ email, isAdmin: admin, password: PASSWORD }),
    method: "POST",
  });
  if (!response.ok) throw new Error(`sign in ${email}: ${response.status}`);
  const me = await (await jar.fetch("/users/session")).json();

  return { id: me.user?.id, jar };
};

const push = async (admin, body, via = "context") =>
  await admin.fetch(`${BASE}/api/realtime-demo/admin/push?via=${via}`, {
    body: JSON.stringify(body),
    method: "POST",
  });

// 1. Cold hub: the very first thing is an upgrade, with no earlier HTTP visit.
const guest = await connect(null);
check(
  "cold first upgrade opens a guest socket",
  guest.status === 101 && guest.ws.readyState === 1,
  `status ${guest.status}`,
);

// 2. Handshake policy.
const evil = await connect(null, { origin: "https://evil.example" });
check(
  "foreign Origin is refused before any socket exists",
  evil.status === 403,
  `status ${evil.status}`,
);

await signUp("alice@example.com");
await signUp("bob@example.com");
const aliceA = await signIn("alice@example.com");
const aliceB = await signIn("alice@example.com");
const bob = await signIn("bob@example.com");
const admin = await signIn("alice@example.com", { admin: true });
check(
  "accounts signed in",
  Boolean(aliceA.id && bob.id && aliceA.id !== bob.id),
  `alice ${aliceA.id}, bob ${bob.id}`,
);

const a1 = await connect(aliceA.jar);
const a2 = await connect(aliceB.jar);
const b1 = await connect(bob.jar);
const opened = [a1, a2, b1].every(socket => socket.status === 101);
check("authenticated sockets open through the hub", opened);
const state = await a1.waitFor(frame => frame.id === NOTIFICATIONS_STATE_ID);
check(
  "signed-in socket gets its notification state from the database",
  Boolean(state),
  JSON.stringify(state?.data ?? null),
);

const clear = () =>
  [guest, a1, a2, b1].forEach(socket => socket.frames.splice(0));
const demoFrames = socket => socket.of(DEMO_ID);

// 3. broadcast from an HTTP request reaches every socket in the hub.
clear();
let response = await push(admin.jar, { data: { n: 1 }, op: "broadcast" });
await sleep(400);
check(
  "HTTP broadcast reaches every socket",
  response.ok &&
    [guest, a1, a2, b1].every(socket => demoFrames(socket).length === 1),
  `status ${response.status}`,
);

// 4. sendToUser: only the target's devices.
clear();
response = await push(admin.jar, {
  data: "for bob",
  op: "sendToUser",
  userId: bob.id,
});
await sleep(400);
check(
  "sendToUser reaches only the target user",
  response.ok &&
    demoFrames(b1).length === 1 &&
    [guest, a1, a2].every(socket => demoFrames(socket).length === 0),
);

clear();
response = await push(
  admin.jar,
  { data: "for alice", op: "sendToUser", userId: aliceA.id },
  "import",
);
await sleep(400);
check(
  "direct `realtime` import reaches all of a user's devices",
  response.ok &&
    demoFrames(a1).length === 1 &&
    demoFrames(a2).length === 1 &&
    demoFrames(b1).length === 0,
);

// 5. sendToUsers: each user their own payload, once.
clear();
response = await push(admin.jar, {
  messages: [
    { data: "A", userId: aliceA.id },
    { data: "B", userId: bob.id },
  ],
  op: "sendToUsers",
});
await sleep(400);
check(
  "sendToUsers delivers each user's own payload once",
  response.ok &&
    JSON.stringify(demoFrames(a1)) === '["A"]' &&
    JSON.stringify(demoFrames(a2)) === '["A"]' &&
    JSON.stringify(demoFrames(b1)) === '["B"]' &&
    demoFrames(guest).length === 0,
);

// 6. Rooms.
clear();
b1.send(DEMO_ID, { room: "demo:lobby", type: "join" });
b1.send(DEMO_ID, { room: "demo:lobby", type: "join" });
b1.send(DEMO_ID, { room: "demo:staff", type: "join" });
a1.send(DEMO_ID, { room: "demo:staff", type: "join" });
await sleep(400);
check(
  "room join is idempotent per member and private rooms refuse non-staff",
  JSON.stringify(demoFrames(b1)) ===
    JSON.stringify([
      { joined: true, room: "demo:lobby" },
      { joined: false, room: "demo:lobby" },
      { error: "FORBIDDEN", room: "demo:staff" },
    ]) &&
    JSON.stringify(demoFrames(a1)) ===
      JSON.stringify([{ joined: true, room: "demo:staff" }]),
);
clear();
await push(admin.jar, { data: "lobby", op: "toRoom", room: "demo:lobby" });
await push(admin.jar, { data: "staff", op: "toRoom", room: "demo:staff" });
await sleep(400);
check(
  "toRoom reaches only room members",
  JSON.stringify(demoFrames(b1)) === '["lobby"]' &&
    JSON.stringify(demoFrames(a1)) === '["staff"]' &&
    demoFrames(a2).length === 0,
);
b1.send(DEMO_ID, { room: "demo:lobby", type: "leave" });
await sleep(200);
clear();
await push(admin.jar, {
  data: "lobby again",
  op: "toRoom",
  room: "demo:lobby",
});
await sleep(400);
check("a member that left the room gets nothing", demoFrames(b1).length === 0);

// 7. Content Engine live editing between two of Alice's sessions.
let postId;
const sql = postgres(
  process.env.POSTGRES_URL ?? "postgresql://root:root@127.0.0.1:5432/vitnode",
  { max: 1, onnotice: () => {} },
);
try {
  [{ id: postId }] =
    await sql`insert into blog_posts default values returning id`;
} finally {
  await sql.end();
}
const room = { contentTypeId: "blog.post", itemId: postId };
const doc = { ...room, field: "content", locale: "en" };
// Live editing is an AdminCP feature: each editor's socket carries an admin
// session, as it does in the browser.
const editor = await signIn("alice@example.com", { admin: true });
const liveA = await connect(admin.jar);
const liveB = await connect(editor.jar);
const live = socket => socket.of(LIVE_ID);
liveA.send(LIVE_ID, { clientId: "tab-a", locale: "en", room, type: "join" });
await liveA.waitFor(
  frame => frame.id === LIVE_ID && frame.data.type === "joined",
);
liveB.send(LIVE_ID, { clientId: "tab-b", locale: "en", room, type: "join" });
const joinedB = await liveB.waitFor(
  frame => frame.id === LIVE_ID && frame.data.type === "joined",
);
const presenceA = await liveA.waitFor(
  frame =>
    frame.id === LIVE_ID &&
    frame.data.type === "presence" &&
    frame.data.members.length === 2,
);
check(
  "live: two editors join after async authorization and see each other's presence",
  Boolean(joinedB && presenceA),
  JSON.stringify(live(liveA).map(m => m.type)),
);

const docA = new Y.Doc();
const docB = new Y.Doc();
const b64 = bytes => Buffer.from(bytes).toString("base64");
const applyFrames = (socket, target, clientId) => {
  for (const message of live(socket)) {
    if (message.type === "doc:update" && message.from !== clientId)
      Y.applyUpdate(target, Buffer.from(message.update, "base64"));
    if (message.type === "doc:seed") {
      target.getXmlFragment("prosemirror").insert(0, [new Y.XmlText("seed")]);
      socket.send(LIVE_ID, {
        clientId,
        doc,
        type: "doc:update",
        update: b64(Y.encodeStateAsUpdate(target)),
      });
    }
  }
  socket.frames.splice(0);
};
liveA.send(LIVE_ID, {
  clientId: "tab-a",
  doc,
  stateVector: b64(Y.encodeStateVector(docA)),
  type: "doc:open",
});
liveB.send(LIVE_ID, {
  clientId: "tab-b",
  doc,
  stateVector: b64(Y.encodeStateVector(docB)),
  type: "doc:open",
});
await sleep(800);
applyFrames(liveA, docA, "tab-a");
applyFrames(liveB, docB, "tab-b");
await sleep(500);
applyFrames(liveA, docA, "tab-a");
applyFrames(liveB, docB, "tab-b");

const edit = (target, clientId, socket, text) => {
  const before = Y.encodeStateVector(target);
  target.getText("smoke").insert(target.getText("smoke").length, text);
  socket.send(LIVE_ID, {
    clientId,
    doc,
    type: "doc:update",
    update: b64(Y.encodeStateAsUpdate(target, before)),
  });
};
edit(docA, "tab-a", liveA, "Hello ");
edit(docB, "tab-b", liveB, "world");
await sleep(800);
applyFrames(liveA, docA, "tab-a");
applyFrames(liveB, docB, "tab-b");
const textA = docA.getText("smoke").toString();
const textB = docB.getText("smoke").toString();
check(
  "live: concurrent edits converge on both clients",
  textA === textB && textA.includes("Hello") && textA.includes("world"),
  JSON.stringify([textA, textB]),
);

// The hub persists dirty documents from a timer, outside any socket event.
await sleep(2_600);
const persisted = postgres(
  process.env.POSTGRES_URL ?? "postgresql://root:root@127.0.0.1:5432/vitnode",
  { max: 1, onnotice: () => {} },
);
let storedBytes = 0;
try {
  const [row] =
    await persisted`select octet_length(state) as bytes from core_content_documents where "contentTypeId" = 'blog.post' and "itemId" = ${String(postId)} and field = 'content'`;
  storedBytes = Number(row?.bytes ?? 0);
} finally {
  await persisted.end();
}
check(
  "live: the hub persists the edited document to the database",
  storedBytes > 0,
  `${storedBytes} bytes`,
);

// 8. HTTP reset reaches the hub's loaded document and its editors.
response = await admin.jar.fetch(
  `${BASE}/api/@vitnode/blog/admin/content/posts/${postId}/draft/discard`,
  { method: "POST" },
);
const reset = await liveA.waitFor(
  frame => frame.id === LIVE_ID && frame.data.type === "reset",
);
const resetB = await liveB.waitFor(
  frame => frame.id === LIVE_ID && frame.data.type === "reset",
);
liveA.send(LIVE_ID, {
  clientId: "tab-a",
  doc,
  type: "doc:update",
  update: b64(Y.encodeStateAsUpdate(new Y.Doc())),
});
const notJoined = await liveA.waitFor(
  frame =>
    frame.id === LIVE_ID &&
    frame.data.type === "error" &&
    frame.data.code === "NOT_JOINED",
);
check(
  "HTTP discard resets the record and unloads the hub's document",
  Boolean(reset && resetB && notJoined),
  `status ${response.status}`,
);

// 9. Session revocation: one device, then all of them.
const staleCookie = aliceB.jar.cookie();
response = await aliceB.jar.fetch("/users/sign_out", { method: "DELETE" });
// The hub drops the socket at once and sends its close frame.
a1.frames.splice(0);
a2.frames.splice(0);
await push(admin.jar, {
  data: "after sign-out",
  op: "sendToUser",
  userId: aliceA.id,
});
await sleep(400);
check(
  "a signed-out device gets no push, the user's other device still does",
  demoFrames(a2).length === 0 && demoFrames(a1).length === 1,
  JSON.stringify([demoFrames(a1), demoFrames(a2)]),
);
const closeA2 = await closeFrameOf(a2);
check(
  "signing out one device closes only that device's socket",
  closeA2?.code === 1008 && a1.ws.readyState === 1,
  `sign_out ${response.status}, close ${closeA2?.code} ${closeA2?.reason ?? ""}`,
);
// A handshake with the signed-out session's cookie opens as a guest, and its
// 101 answer carries the Set-Cookie that clears the dead session.
const stale = await connect({ cookie: () => staleCookie });
check(
  "the handshake's Set-Cookie reaches the browser on the 101 response",
  stale.status === 101 &&
    stale.setCookie.some(
      cookie =>
        /^vitnode_auth=;/.test(cookie) ||
        /^vitnode_auth=.*(max-age=0|expires=thu, 01 jan 1970)/i.test(cookie),
    ),
  JSON.stringify(stale.setCookie.map(cookie => cookie.split(";")[0])),
);
stale.ws.close();
await push(admin.jar, { op: "closeUserConnections", userId: aliceA.id });
const closeA1 = await closeFrameOf(a1);
check(
  "closeUserConnections without a device closes every socket of the user",
  closeA1?.code === 1008 && b1.ws.readyState === 1,
);

// 10. Reconnect: the client opens a new socket, rejoins, and reloads state.
// liveA was Alice's too, so the revocation above closed it; it reconnects like
// the browser does: new socket, join again, reload the document.
const again = await connect(admin.jar);
again.send(LIVE_ID, { clientId: "tab-a", locale: "en", room, type: "join" });
const rejoined = await again.waitFor(
  frame => frame.id === LIVE_ID && frame.data.type === "joined",
);
// A member session reloads its notification state on every new socket.
const member = await connect(aliceA.jar);
const reloadedState =
  (await member.waitFor(frame => frame.id === NOTIFICATIONS_STATE_ID)) !==
  undefined;
member.ws.close();
check(
  "reconnect: a new socket rejoins its room and reloads durable state",
  Boolean(rejoined) && reloadedState,
  `status ${again.status}, frames ${JSON.stringify(again.frames.map(frame => frame.data?.type ?? frame.id))}`,
);

// 11. An abruptly dropped socket leaves the room once; others stay.
liveB.ws.terminate();
const presenceAfterDrop = await again.waitFor(
  frame =>
    frame.id === LIVE_ID &&
    frame.data.type === "presence" &&
    frame.data.members.every(member => member.clientId !== "tab-b"),
  5000,
);
check(
  "a dropped socket is cleaned from the registry and live presence",
  Boolean(presenceAfterDrop),
);

// 12. The visitor's IP reaches the API on both paths, and a client cannot
// choose it: the header the Worker uses to tell the hub is replaced.
const ipOf = async socket => {
  socket.send(DEMO_ID, { room: "-", type: "whoami" });
  const frame = await socket.waitFor(f => f.id === DEMO_ID && f.data?.ip);

  return frame?.data.ip;
};
const httpIp = (
  await (await push(admin.jar, { data: null, op: "broadcast" })).json()
).ip;
const spoofed = await connect(null, {
  headers: {
    "x-forwarded-for": "203.0.113.8",
    "x-vitnode-hub-client-ip": "203.0.113.7",
  },
});
const wsIp = await ipOf(spoofed);
const loopback = ["localhost", "127.0.0.1"].includes(new URL(BASE).hostname);
check(
  "client IP is the same on HTTP and in the hub, and not spoofable",
  Boolean(httpIp) &&
    httpIp === wsIp &&
    !String(wsIp).startsWith("203.0.113") &&
    (loopback || httpIp !== "127.0.0.1"),
  `http ${httpIp}, socket ${wsIp}`,
);
spoofed.ws.close();

// 13. Hibernation (SMOKE_HIBERNATION_WAIT=<seconds>): every socket stays
// quiet until the hub is evicted. A hub stays awake while timers run - the
// rate limiter keeps one for a minute after the last handshake - so wait
// about 80 seconds against `pnpm preview`.
const hibernationWait = Number(process.env.SMOKE_HIBERNATION_WAIT ?? 0);
if (hibernationWait > 0) {
  const sleeper = await connect(bob.jar);
  sleeper.send(DEMO_ID, { room: "demo:night", type: "join" });
  await sleeper.waitFor(f => f.id === DEMO_ID && f.data?.room === "demo:night");
  sleeper.send(DEMO_ID, { room: "-", type: "whoami" });
  const before = (
    await sleeper.waitFor(f => f.id === DEMO_ID && f.data?.handshakeAt)
  )?.data;
  await signUp("carol@example.com");
  const carol = await signIn("carol@example.com");
  const carolSocket = await connect(carol.jar);
  for (const socket of [guest, b1, again]) socket.ws.close();
  console.log(`      (idling ${hibernationWait}s so the hub can hibernate)`);
  await sleep(hibernationWait * 1000);

  // The session behind Carol's socket disappears while the hub sleeps,
  // without the revocation hook - only a replayed handshake can notice.
  const db = postgres(
    process.env.POSTGRES_URL ?? "postgresql://root:root@127.0.0.1:5432/vitnode",
    { max: 1, onnotice: () => {} },
  );
  try {
    await db`delete from core_sessions where "userId" = ${carol.id}`;
  } finally {
    await db.end();
  }

  sleeper.frames.splice(0);
  await push(admin.jar, {
    data: "while asleep",
    op: "sendToUser",
    userId: bob.id,
  });
  await push(admin.jar, {
    data: "room after wake",
    op: "toRoom",
    room: "demo:night",
  });
  await sleep(500);
  check(
    "hibernation: a woken hub still knows its sockets' users and rooms",
    JSON.stringify(sleeper.of(DEMO_ID)) ===
      '["while asleep","room after wake"]',
    JSON.stringify(sleeper.of(DEMO_ID)),
  );
  sleeper.frames.splice(0);
  sleeper.send(DEMO_ID, { room: "-", type: "whoami" });
  const after = (
    await sleeper.waitFor(f => f.id === DEMO_ID && f.data?.handshakeAt)
  )?.data;
  check(
    "hibernation: the first message after a wake replays the handshake",
    Boolean(before && after) &&
      after.handshakeAt > before.handshakeAt &&
      after.ip === before.ip,
    `handshake ${before?.handshakeAt} -> ${after?.handshakeAt}`,
  );
  const carolClosed = carolSocket.closed;
  carolSocket.send(DEMO_ID, { room: "-", type: "whoami" });
  const carolClose = await Promise.race([
    carolClosed,
    sleep(5000).then(() => undefined),
  ]);
  check(
    "hibernation: a socket whose session ended while asleep is closed on its next message",
    carolClose?.code === 1008,
    `close ${carolClose?.code} ${carolClose?.reason ?? ""}`,
  );
  sleeper.ws.close();
}

// 14. Handshake rate limit: a burst of guest handshakes from one IP ends in
// 429 - also with a forged hub IP header. Last, because it spends this IP's
// budget for the next minute.
// `vitnode dev` turns the rate limiter off: SMOKE_RATE_LIMIT=off skips this.
let limited;
const expectLimit = process.env.SMOKE_RATE_LIMIT !== "off";
for (let attempt = 0; expectLimit && attempt < 400 && !limited; attempt++) {
  const socket = await connect(null, {
    headers: { "x-vitnode-hub-client-ip": `198.51.100.${attempt % 250}` },
  });
  if (socket.status === 429) limited = attempt;
  socket.ws.terminate();
}
if (expectLimit) {
  check(
    "a burst of handshakes is rate limited with 429",
    limited !== undefined,
    `after ${limited} handshakes`,
  );
}

for (const socket of [guest, b1, again]) socket.ws.close();
const failed = results.filter(result => !result.ok);
console.log(
  `\n${results.length - failed.length}/${results.length} checks passed`,
);
process.exit(failed.length === 0 ? 0 : 1);
