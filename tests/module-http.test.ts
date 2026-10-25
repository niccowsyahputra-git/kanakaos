import assert from "node:assert/strict";
import { test } from "node:test";

const base = process.env.MODULE_TEST_URL;
const password = process.env.MODULE_TEST_PASSWORD;

test("isolated local HTTP pages render both languages and enforce employee permissions", { skip: !base || !password }, async () => {
  // Never send test credentials or form submissions to a remote application.
  assert.equal(new URL(base!).origin, "http://localhost:3100");
  const cookies = new Map<string, string>();
  async function request(route: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    headers.set("Cookie", [...cookies].map(([key, value]) => `${key}=${value}`).join("; "));
    const response = await fetch(`${base}${route}`, { ...init, headers, redirect: "manual" });
    for (const value of response.headers.getSetCookie()) {
      const cookie = value.split(";")[0];
      const index = cookie.indexOf("=");
      cookies.set(cookie.slice(0, index), cookie.slice(index + 1));
    }
    return response;
  }
  async function login(email: string) {
    cookies.clear();
    const csrf = await (await request("/api/auth/csrf")).json();
    const response = await request("/api/auth/callback/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: base! },
      body: new URLSearchParams({ csrfToken: csrf.csrfToken, email, password: password!, callbackUrl: `${base}/dashboard`, json: "true" }),
    });
    assert.ok(response.ok || response.status === 302);
    const session = await (await request("/api/auth/session")).json();
    assert.equal(session.user.email, email);
  }
  assert.equal((await request("/dashboard/employees")).status, 307);
  assert.equal((await request("/api/files/cm000000000000000000000001")).status, 404);
  assert.equal((await request("/api/uploads/start", { method: "POST", headers: { "Content-Type": "application/json", Origin: base! }, body: JSON.stringify({ mode: "staff" }) })).status, 403);
  assert.equal((await request("/api/uploads/start", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://foreign.example" }, body: JSON.stringify({ mode: "public" }) })).status, 403);
  await login("smoke-admin@example.test");
  for (const locale of ["id", "en"]) {
    cookies.set("NEXT_LOCALE", locale);
    for (const [route, content] of [
      ["/dashboard/employees", "Smoke Employee"],
      ["/dashboard/inventory", "Smoke Test Rice"],
      ["/dashboard/volunteers", "Smoke Legacy Volunteer"],
      ["/dashboard/volunteers/needs", "Legal"],
      ["/dashboard/admin/settings?tab=locations", "Smoke Test Office"],
      ["/dashboard/assets", "Unmapped legacy location"],
      ["/dashboard/finance/programs", "Smoke Mixed Program"],
      ["/dashboard/finance/programs/cm000000000000000000000001", locale === "en" ? "Funding Composition" : "Komposisi Pendanaan"],
      ["/dashboard/finance/expense", locale === "en" ? "Funding Source" : "Sumber Dana"],
    ]) {
      const response = await request(route);
      assert.equal(response.status, 200, route);
      const html = await response.text();
      assert.ok(html.includes(`<html lang="${locale}"`), route);
      assert.ok(html.includes(content), `${route}: ${content}`);
      assert.ok(!html.includes("SQLITE_ERROR"), route);
      if (route === "/dashboard/employees") assert.ok(html.includes(locale === "en" ? "View Details" : "Lihat Detail"));
    }
    const income = await (await request("/dashboard/finance/income/new")).text();
    assert.ok(income.includes("Smoke Mixed Program"));
    assert.ok(!income.includes("Smoke Internal Program"));
    const legacy = await request("/api/volunteer-uploads/sign", {
      method: "POST", headers: { "Content-Type": "application/json", Origin: base! },
      body: JSON.stringify({ mode: "public", nonce: crypto.randomUUID(), files: [{ kind: "PHOTO", filename: "test.png", mime: "image/png", bytes: 100 }] }),
    });
    assert.equal(legacy.status, 410);
    const storage = await request("/api/uploads/start", {
      method: "POST", headers: { "Content-Type": "application/json", Origin: base! },
      body: JSON.stringify({ mode: "public", nonce: crypto.randomUUID(), file: { purpose: "VOLUNTEER_PHOTO", filename: "test.png", mime: "image/png", bytes: 100 } }),
    });
    assert.equal(storage.status, 503);
    assert.match((await storage.json()).error, locale === "en" ? /Storage is not configured/ : /Penyimpanan belum dikonfigurasi/);
  }
  await login("smoke-staff@example.test");
  assert.equal((await request("/dashboard/employees")).status, 307);
  assert.equal((await request("/dashboard/admin/settings")).status, 307);
  assert.equal((await request("/dashboard/volunteers")).status, 200);
});
