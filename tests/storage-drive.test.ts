import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createDriveStorage, DRIVE_OWNER, DRIVE_SCOPE, hasFileSignature, validDriveSession } from "../lib/google-drive.server";
import { STORAGE_PURPOSES, StorageError, managedFileDescriptionSchema, managedStartSchema, storageErrorMessage } from "../lib/storage-contract";
import { CALLBACK, completeDriveSetup, validateOAuthCallback } from "../scripts/setup-google-drive";

const config = { clientId: "fixture-client", clientSecret: "fixture-client-secret", refreshToken: "fixture-refresh", folderId: "fixture-folder-id" };
const session = "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=fixture-session";
const file = { id: "fixture-file-id", managedId: "cm000000000000000000000001", purpose: "VOLUNTEER_PHOTO" as const, filename: "fixture.png", mime: "image/png", bytes: 100 };
const json = (value: unknown, status = 200) => Response.json(value, { status });

test("Drive refresh is coalesced, checks the exact owner, fixes the private parent, and exposes only a resumable session", async () => {
  const requests: { url: string; init: RequestInit }[] = [];
  const transport: typeof fetch = async (input, init = {}) => {
    const url = String(input); requests.push({ url, init });
    assert.equal(init.redirect, "error");
    assert.equal(init.cache, "no-store");
    if (url.endsWith("/token")) return json({ access_token: "fixture-access", expires_in: 3600 });
    if (url.includes("/about?")) return json({ user: { emailAddress: DRIVE_OWNER } });
    if (url.includes("/generateIds?")) return json({ ids: [file.id] });
    if (url.includes("/files/fixture-folder-id?")) return json({ id: config.folderId, mimeType: "application/vnd.google-apps.folder", ownedByMe: true, trashed: false, permissions: [{ type: "user", role: "owner" }] });
    if (url.includes("/upload/")) {
      assert.equal(new Headers(init.headers).get("Authorization"), "Bearer fixture-access");
      assert.equal(new Headers(init.headers).get("Origin"), "http://localhost:3100");
      const metadata = JSON.parse(String(init.body));
      assert.deepEqual(metadata.parents, [config.folderId]);
      assert.deepEqual(metadata.appProperties, { application: "kanakaos", managedId: file.managedId, purpose: file.purpose });
      return new Response(null, { status: 200, headers: { Location: session } });
    }
    throw new Error("Unexpected mock request");
  };
  const drive = createDriveStorage(config, transport);
  assert.deepEqual(await Promise.all([drive.generateId(), drive.generateId()]), [file.id, file.id]);
  assert.equal(requests.filter(request => request.url.endsWith("/token")).length, 1);
  assert.equal(await drive.start(file, "http://localhost:3100"), session);
  const callsBeforeInvalidOrigins = requests.length;
  for (const origin of ["http://insecure.example", "null", "https://example.test/path", "https://user:password@example.test"]) {
    await assert.rejects(drive.start(file, origin), (error: unknown) => error instanceof StorageError && error.code === "INVALID");
  }
  assert.equal(requests.length, callsBeforeInvalidOrigins);
  assert.ok(!session.includes("fixture-access"));
  await assert.rejects(drive.download("https://malicious.invalid"), (error: unknown) => error instanceof StorageError && error.code === "INVALID");
});

test("Drive errors never disclose Google response details; wrong owner, revocation, quota and network failures are distinguished", async () => {
  for (const scenario of ["owner", "revoke", "quota", "network"] as const) {
    const drive = createDriveStorage(config, async input => {
      const url = String(input);
      if (scenario === "network") throw new Error("private transport detail");
      if (url.endsWith("/token")) return scenario === "revoke" ? json({ error: "invalid_grant", secret: "private token detail" }, 400) : json({ access_token: "fixture", expires_in: 3600 });
      if (url.includes("/about?")) return json({ user: { emailAddress: scenario === "owner" ? "wrong@example.test" : DRIVE_OWNER } });
      return json({ error: { errors: [{ reason: "storageQuotaExceeded" }], message: "private response detail" } }, 403);
    });
    await assert.rejects(drive.generateId(), (error: unknown) => {
      assert.ok(error instanceof StorageError);
      assert.equal(error.code, { owner: "WRONG_OWNER", revoke: "RECONNECT", quota: "QUOTA", network: "UNAVAILABLE" }[scenario]);
      assert.ok(!error.message.includes("private"));
      return true;
    });
  }
});

test("Drive retries an expired access token once and rejects non-private folders and foreign session locations", async () => {
  let refreshes = 0;
  let reads = 0;
  const drive = createDriveStorage(config, async input => {
    const url = String(input);
    if (url.endsWith("/token")) { refreshes++; return json({ access_token: `fixture-${refreshes}`, expires_in: 3600 }); }
    if (url.includes("/about?")) return json({ user: { emailAddress: DRIVE_OWNER } });
    reads++;
    return reads === 1 ? json({}, 401) : json({ ids: [file.id] });
  });
  assert.equal(await drive.generateId(), file.id);
  assert.equal(refreshes, 2);
  for (const value of ["https://evil.test/upload/drive/v3/files?uploadType=resumable&upload_id=x", "https://www.googleapis.com.evil.test/upload/drive/v3/files?uploadType=resumable&upload_id=x", "http://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=x", session + "#fragment", "https://www.googleapis.com/drive/v3/files"]) assert.equal(validDriveSession(value), false);
  const shared = createDriveStorage(config, async input => {
    const url = String(input);
    if (url.endsWith("/token")) return json({ access_token: "fixture", expires_in: 3600 });
    if (url.includes("/about?")) return json({ user: { emailAddress: DRIVE_OWNER } });
    return json({ id: config.folderId, mimeType: "application/vnd.google-apps.folder", trashed: false, ownedByMe: true, permissions: [{ type: "anyone", role: "reader" }] });
  });
  await assert.rejects(shared.start(file), (error: unknown) => error instanceof StorageError && error.code === "RECONNECT");
});

test("all purposes preserve size limits and MIME allowlists; signatures and localized errors are explicit", () => {
  for (const [purpose, policy] of Object.entries(STORAGE_PURPOSES)) {
    const description = { purpose, filename: "fixture", mime: policy.mimes[0], bytes: policy.maxBytes };
    assert.equal(managedFileDescriptionSchema.safeParse(description).success, true, purpose);
    assert.equal(managedFileDescriptionSchema.safeParse({ ...description, bytes: policy.maxBytes + 1 }).success, false, purpose);
    assert.equal(managedFileDescriptionSchema.safeParse({ ...description, mime: "text/html" }).success, false, purpose);
  }
  assert.equal(STORAGE_PURPOSES.PROGRAM_PROPOSAL.maxBytes, 10 * 1024 * 1024);
  assert.equal(STORAGE_PURPOSES.VOLUNTEER_PHOTO.maxBytes, 5 * 1024 * 1024);
  assert.equal(managedStartSchema.safeParse({ mode: "public", nonce: crypto.randomUUID(), targetId: file.managedId, file: { purpose: "VOLUNTEER_PHOTO", filename: "test.png", mime: "image/png", bytes: 8 } }).success, false);
  for (const [mime, signature] of [["image/jpeg", [255, 216, 255]], ["image/png", [137, 80, 78, 71, 13, 10, 26, 10]], ["application/pdf", [37, 80, 68, 70, 45]]] as const) {
    assert.equal(hasFileSignature(mime, new Uint8Array(signature)), true);
    assert.equal(hasFileSignature(mime, new Uint8Array([60, 104, 116, 109, 108])), false);
  }
  for (const code of ["NOT_CONFIGURED", "RECONNECT", "WRONG_OWNER", "QUOTA", "UNAVAILABLE", "INVALID", "EXPIRED", "FORBIDDEN", "RATE_LIMIT"] as const) assert.notEqual(storageErrorMessage(code, "en"), storageErrorMessage(code, "id"));
});

test("OAuth callback requires the exact loopback host, path, single state and code", () => {
  const state = randomBytes(32).toString("base64url");
  const valid = `/oauth/callback?state=${state}&code=fixture-code`;
  assert.equal(validateOAuthCallback(valid, "localhost:53682", state), "fixture-code");
  for (const [url, host] of [[valid, "evil.test"], [valid, "localhost:3000"], [valid.replace("callback", "other"), "localhost:53682"], [valid + `&state=${state}`, "localhost:53682"], [valid + "&code=second", "localhost:53682"], [valid.replace(state, "x".repeat(43)), "localhost:53682"], ["https://evil.test" + valid, "localhost:53682"]]) assert.throws(() => validateOAuthCallback(url, host, state));
});

test("OAuth setup refuses the wrong account and broad scopes before creating a private app folder", async () => {
  const client = { client_id: "fixture.apps.googleusercontent.com", client_secret: "fixture-secret", redirect_uris: [CALLBACK] };
  for (const scenario of ["wrong", "scope", "success"] as const) {
    let folderCreated = false;
    const transport = async (url: string, init?: RequestInit) => {
      if (url.endsWith("/token")) return { access_token: "fixture-access", refresh_token: "fixture-refresh", scope: scenario === "scope" ? "https://www.googleapis.com/auth/drive" : DRIVE_SCOPE };
      if (url.includes("/about?")) return { user: { emailAddress: scenario === "wrong" ? "wrong@example.test" : DRIVE_OWNER } };
      if (init?.method === "POST") { folderCreated = true; assert.ok(!String(init.body).includes("anyone")); return { id: "fixture-folder-id" }; }
      return { files: [] };
    };
    if (scenario !== "success") {
      await assert.rejects(completeDriveSetup(client, "fixture-code", "fixture-verifier", transport));
      assert.equal(folderCreated, false);
    } else {
      const result = await completeDriveSetup(client, "fixture-code", "fixture-verifier", transport);
      assert.equal(result.GOOGLE_DRIVE_FOLDER_ID, "fixture-folder-id");
      assert.ok(result.STORAGE_SIGNING_SECRET.length >= 32);
      assert.equal(folderCreated, true);
    }
  }
});
