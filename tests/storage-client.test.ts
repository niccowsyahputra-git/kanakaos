import test from "node:test";
import assert from "node:assert/strict";
import { ManagedFormUploadController, ManagedUploadController, confirmedUploadOffset, uploadResumable } from "../lib/managed-upload-client";
import { MANAGED_FORM_FIELDS, MANAGED_FORM_KEY, STORAGE_PURPOSES, StorageError, UPLOAD_CHUNK_BYTES, UPLOAD_TICKET_MS } from "../lib/storage-contract";

const session = "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=fixture-session";
const claim = { id: "cm000000000000000000000001", ticket: "fixture-ticket" };
const upload = () => ({ ...claim, sessionUrl: session, expiresAt: Date.now() + UPLOAD_TICKET_MS });
const incomplete = (offset = 0, override = true) => new Response(null, {
  status: override ? 200 : 308,
  headers: { ...(override ? { "X-HTTP-Status-Code-Override": "308" } : {}), ...(offset ? { Range: `bytes=0-${offset - 1}` } : {}) },
});
const hasCode = (code: string) => (error: unknown) => error instanceof StorageError && error.code === code;
const photo = () => new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "fixture.png", { type: "image/png" });

function checkGoogleRequest(init: RequestInit) {
  assert.equal(init.credentials, "omit");
  assert.equal(init.redirect, "error");
  const headers = new Headers(init.headers);
  assert.equal(headers.has("Authorization"), false);
  assert.equal(headers.get("X-GUploader-No-308"), "yes");
  return headers.get("Content-Range")!;
}

test("upload offsets distinguish Google's non-redirect 308 override from completion and reject invalid ranges", () => {
  for (const override of [false, true]) {
    assert.equal(confirmedUploadOffset(incomplete(0, override), 100), 0);
    assert.equal(confirmedUploadOffset(incomplete(50, override), 100), 50);
    assert.throws(() => confirmedUploadOffset(incomplete(101, override), 100), hasCode("INVALID"));
  }
  for (const status of [200, 201]) assert.equal(confirmedUploadOffset(new Response(null, { status }), 100), 100);
  for (const range of ["bytes=1-2", "bytes=0-x", "bytes=0-9007199254740992"]) assert.throws(() => confirmedUploadOffset(new Response(null, { status: 308, headers: { Range: range } }), 100), hasCode("INVALID"));
  for (const status of [404, 410]) assert.throws(() => confirmedUploadOffset(new Response(null, { status }), 100), hasCode("EXPIRED"));
  assert.throws(() => confirmedUploadOffset(new Response(null, { status: 429 }), 100), hasCode("QUOTA"));
  assert.throws(() => confirmedUploadOffset(new Response(null, { status: 500 }), 100), hasCode("UNAVAILABLE"));
  assert.throws(() => confirmedUploadOffset(new Response(null, { status: 200, headers: { "X-HTTP-Status-Code-Override": "302" } }), 100), hasCode("INVALID"));
});

test("a full 10 MiB proposal uses ten 1 MiB direct chunks without credentials or premature completion", async () => {
  const file = new File([new Uint8Array(10 * UPLOAD_CHUNK_BYTES)], "fixture.pdf", { type: "application/pdf" });
  let offset = 0;
  let chunks = 0;
  const progress: number[] = [];
  const transport: typeof fetch = async (input, init = {}) => {
    assert.equal(String(input), session);
    const range = checkGoogleRequest(init);
    if (range === `bytes */${file.size}`) return incomplete(offset);
    assert.equal(range, `bytes ${offset}-${offset + UPLOAD_CHUNK_BYTES - 1}/${file.size}`);
    assert.ok(init.body instanceof Blob);
    assert.equal(init.body.size, UPLOAD_CHUNK_BYTES);
    offset += init.body.size;
    chunks++;
    return offset === file.size ? new Response(null, { status: 201 }) : incomplete(offset);
  };
  await uploadResumable(file, session, value => progress.push(value), transport);
  assert.equal(chunks, 10);
  assert.equal(offset, file.size);
  assert.equal(progress.at(-1), 95);
  assert.ok(progress.every(value => value < 100));
});

test("a lost chunk response resumes from Drive's confirmed range without duplicating already stored bytes", async () => {
  const file = new Blob([new Uint8Array(2 * UPLOAD_CHUNK_BYTES + 11)], { type: "application/pdf" });
  let confirmed = 0;
  let lost = false;
  const ranges: string[] = [];
  const transport: typeof fetch = async (_input, init = {}) => {
    const range = checkGoogleRequest(init);
    ranges.push(range);
    if (range === `bytes */${file.size}`) return incomplete(confirmed);
    assert.ok(range.startsWith(`bytes ${confirmed}-`));
    assert.ok(init.body instanceof Blob);
    confirmed += init.body.size;
    if (!lost) { lost = true; throw new Error("Fixture lost response"); }
    return confirmed === file.size ? new Response(null, { status: 200 }) : incomplete(confirmed);
  };
  await uploadResumable(file, session, () => {}, transport);
  assert.equal(confirmed, file.size);
  assert.equal(ranges.filter(range => range.startsWith("bytes 0-")).length, 1);
  assert.equal(ranges.filter(range => range.startsWith("bytes */")).length, 2);
});

test("finalize failures retain transferred bytes and claims; retries do not reupload or lose the selected file", async () => {
  let starts = 0;
  let puts = 0;
  let finalizes = 0;
  const progress: number[] = [];
  const transport: typeof fetch = async (input, init = {}) => {
    const url = String(input);
    if (url === session) { puts++; checkGoogleRequest(init); return puts === 1 ? incomplete() : new Response(null, { status: 201 }); }
    assert.equal(init.credentials, "same-origin");
    assert.equal(new Headers(init.headers).has("Authorization"), false);
    const body = JSON.parse(String(init.body));
    if (url.endsWith("/start")) { starts++; assert.equal(body.file.bytes, 8); return Response.json(upload()); }
    assert.ok(url.endsWith("/finalize"));
    assert.deepEqual(body.claim, claim);
    finalizes++;
    return finalizes === 1 ? Response.json({ code: "UNAVAILABLE" }, { status: 503 }) : Response.json(claim);
  };
  const controller = new ManagedUploadController("public", undefined, transport);
  const file = photo();
  await assert.rejects(controller.upload(file, "VOLUNTEER_PHOTO", value => progress.push(value)), hasCode("UNAVAILABLE"));
  assert.ok(!progress.includes(100));
  assert.deepEqual(await controller.upload(file, "VOLUNTEER_PHOTO", value => progress.push(value)), claim);
  assert.equal(progress.at(-1), 100);
  assert.deepEqual(await controller.upload(file, "VOLUNTEER_PHOTO"), claim);
  assert.equal(starts, 1);
  assert.equal(puts, 2);
  assert.equal(finalizes, 2);
});

test("a Drive session that expires before its application ticket is discarded and replaced on retry", async () => {
  let starts = 0;
  let discarded = 0;
  let puts = 0;
  const transport: typeof fetch = async (input, init = {}) => {
    const url = String(input);
    if (url.endsWith("/start")) { starts++; return Response.json(upload()); }
    if (url.endsWith("/discard")) { discarded++; return Response.json({ success: true }); }
    if (url.endsWith("/finalize")) return Response.json(claim);
    checkGoogleRequest(init);
    puts++;
    return puts === 1 ? new Response(null, { status: 410 }) : puts === 2 ? incomplete() : new Response(null, { status: 201 });
  };
  const controller = new ManagedUploadController("public", undefined, transport);
  const file = photo();
  await assert.rejects(controller.upload(file, "VOLUNTEER_PHOTO"), hasCode("EXPIRED"));
  assert.deepEqual(await controller.upload(file, "VOLUNTEER_PHOTO"), claim);
  assert.equal(starts, 2);
  assert.equal(discarded, 1);
});

test("concurrent requests for the same File share one upload; wrong purposes and foreign finalize claims are rejected", async () => {
  let starts = 0;
  let puts = 0;
  let finalizes = 0;
  let tamper = false;
  const transport: typeof fetch = async input => {
    const url = String(input);
    if (url.endsWith("/start")) { starts++; return Response.json(upload()); }
    if (url.endsWith("/finalize")) { finalizes++; return Response.json(tamper ? { ...claim, ticket: "foreign-ticket" } : claim); }
    puts++;
    return puts % 2 ? incomplete() : new Response(null, { status: 200 });
  };
  const controller = new ManagedUploadController("public", undefined, transport);
  const file = photo();
  assert.deepEqual(await Promise.all([controller.upload(file, "VOLUNTEER_PHOTO"), controller.upload(file, "VOLUNTEER_PHOTO")]), [claim, claim]);
  assert.equal(starts, 1);
  assert.equal(finalizes, 1);
  await assert.rejects(controller.upload(file, "VOLUNTEER_KTP"), hasCode("INVALID"));
  tamper = true;
  const progress: number[] = [];
  await assert.rejects(controller.upload(photo(), "VOLUNTEER_PHOTO", value => progress.push(value)), hasCode("INVALID"));
  assert.ok(!progress.includes(100));
});

test("invalid files and untrusted session URLs never send file bytes", async () => {
  let calls = 0;
  const transport: typeof fetch = async () => { calls++; return Response.json({ ...upload(), sessionUrl: "https://untrusted.example/upload" }); };
  const controller = new ManagedUploadController("public", undefined, transport);
  await assert.rejects(controller.upload(new File(["<script>"], "fixture.html", { type: "text/html" }), "VOLUNTEER_PHOTO"), hasCode("INVALID"));
  assert.equal(calls, 0);
  await assert.rejects(controller.upload(photo(), "VOLUNTEER_PHOTO"), hasCode("INVALID"));
  assert.equal(calls, 1);
  await assert.rejects(uploadResumable(photo(), "https://untrusted.example/upload", () => {}, transport), hasCode("INVALID"));
  assert.equal(calls, 1);
});

test("every managed form sends metadata and claims only, retains files for retry, and discards replaced selections", async () => {
  for (const fields of Object.values(MANAGED_FORM_FIELDS)) {
    let starts = 0;
    let puts = 0;
    let discards = 0;
    const transport: typeof fetch = async (input, init = {}) => {
      const url = String(input);
      if (url === session) {
        checkGoogleRequest(init);
        puts++;
        return new Headers(init.headers).get("Content-Range")!.startsWith("bytes */") ? incomplete() : new Response(null, { status: 201 });
      }
      assert.equal(typeof init.body, "string");
      const data = JSON.parse(String(init.body));
      if (url.endsWith("/start")) {
        starts++;
        assert.ok(Object.values(fields).includes(data.file.purpose));
        assert.equal(Object.hasOwn(data.file, "content"), false);
        return Response.json({ ...upload(), id: `cm${String(starts).padStart(23, "0")}` });
      }
      if (url.endsWith("/discard")) { discards++; return Response.json({ success: true }); }
      assert.ok(url.endsWith("/finalize"));
      return Response.json(data.claim);
    };
    const controller = new ManagedFormUploadController("staff", undefined, transport);
    const form = new FormData();
    form.set("notes", "Unsaved form text retained across language changes");
    for (const [field, purpose] of Object.entries(fields)) {
      const mime = STORAGE_PURPOSES[purpose].mimes[0];
      form.set(field, new File([new Uint8Array(8)], `${field}.fixture`, { type: mime }));
    }
    const prepared = await controller.prepare(form, fields);
    assert.ok([...prepared.values()].every(value => typeof value === "string"));
    assert.equal(prepared.get("notes"), form.get("notes"));
    assert.equal(JSON.parse(String(prepared.get(MANAGED_FORM_KEY))).claims.length, Object.keys(fields).length);
    assert.equal(starts, Object.keys(fields).length);
    const transferred = puts;
    await controller.prepare(form, fields);
    assert.equal(puts, transferred);
    assert.equal(starts, Object.keys(fields).length);
    const first = Object.keys(fields)[0];
    form.delete(first);
    await controller.prepare(form, fields);
    assert.equal(discards, 1);
    await controller.discardAll();
    assert.equal(discards, Object.keys(fields).length);
  }
});
