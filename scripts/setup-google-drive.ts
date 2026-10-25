import { createServer } from "node:http";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { chmodSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { z } from "zod";
import { DRIVE_OWNER, DRIVE_SCOPE, driveIdSchema } from "../lib/google-drive.server";

export const CALLBACK = "http://localhost:53682/oauth/callback";
const clientSchema = z.object({ web: z.object({
  client_id: z.string().regex(/^[a-zA-Z0-9-]+\.apps\.googleusercontent\.com$/),
  client_secret: z.string().min(1), redirect_uris: z.array(z.string()).refine(uris => uris.includes(CALLBACK)),
}) });
export function validateOAuthCallback(rawUrl: string, host: string | undefined, expectedState: string) {
  if (host !== "localhost:53682") throw new Error("Invalid callback");
  const url = new URL(rawUrl, CALLBACK);
  if (url.origin !== new URL(CALLBACK).origin || url.pathname !== "/oauth/callback" || url.hash) throw new Error("Invalid callback");
  const states = url.searchParams.getAll("state");
  const state = states[0] ?? "";
  if (states.length !== 1 || !/^[a-zA-Z0-9_-]{43}$/.test(state) || state.length !== expectedState.length || !timingSafeEqual(Buffer.from(state), Buffer.from(expectedState))) throw new Error("Invalid callback state");
  if (url.searchParams.has("error")) throw new Error("Google consent was not granted");
  const codes = url.searchParams.getAll("code");
  if (codes.length !== 1 || !codes[0] || codes[0].length > 4096) throw new Error("Invalid callback code");
  return codes[0];
}

async function google(url: string, init: RequestInit = {}) {
  const response = await fetch(url, { ...init, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error("Google setup request failed. Check the OAuth client, Drive API, consent, and quota, then retry.");
  return response.json();
}

export async function completeDriveSetup(client: z.infer<typeof clientSchema>["web"], code: string, verifier: string, transport = google) {
  const token = await transport("https://oauth2.googleapis.com/token", { method: "POST", body: new URLSearchParams({
    client_id: client.client_id, client_secret: client.client_secret, code,
    code_verifier: verifier, redirect_uri: CALLBACK, grant_type: "authorization_code",
  }) });
  if (typeof token.access_token !== "string" || typeof token.refresh_token !== "string" || !token.refresh_token) throw new Error("No offline authorization was issued. Reauthorize with consent.");
  if (token.scope !== DRIVE_SCOPE) throw new Error("Unexpected authorization scope. Configure only drive.file and retry.");
  const headers = { Authorization: `Bearer ${token.access_token}` };
  const about = await transport("https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)", { headers });
  if (about?.user?.emailAddress?.toLowerCase() !== DRIVE_OWNER) throw new Error("Wrong Google account. Reauthorize using the designated storage owner.");
  const query = new URLSearchParams({ q: "trashed = false and mimeType = 'application/vnd.google-apps.folder' and appProperties has { key='application' and value='kanakaos' } and appProperties has { key='kind' and value='storageRoot' }", fields: "files(id,ownedByMe,permissions(type,role)),nextPageToken", pageSize: "2" });
  const found = await transport(`https://www.googleapis.com/drive/v3/files?${query}`, { headers });
  if (!Array.isArray(found.files) || found.files.length > 1 || found.nextPageToken) throw new Error("Multiple storage folders found. Ask the administrator to select the existing folder before retrying.");
  let folderId: string;
  if (found.files.length) {
    const folder = found.files[0];
    if (!folder.ownedByMe || !Array.isArray(folder.permissions) || folder.permissions.some((entry: { type: string; role: string }) => entry.type !== "user" || entry.role !== "owner")) throw new Error("The existing storage folder is not private.");
    folderId = driveIdSchema.parse(folder.id);
  } else {
    const folder = await transport("https://www.googleapis.com/drive/v3/files?fields=id", { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({
      name: "KanakaOS", mimeType: "application/vnd.google-apps.folder", appProperties: { application: "kanakaos", kind: "storageRoot" },
    }) });
    folderId = driveIdSchema.parse(folder.id);
  }
  return {
    GOOGLE_DRIVE_CLIENT_ID: client.client_id,
    GOOGLE_DRIVE_CLIENT_SECRET: client.client_secret,
    GOOGLE_DRIVE_REFRESH_TOKEN: token.refresh_token as string,
    GOOGLE_DRIVE_FOLDER_ID: folderId,
    STORAGE_SIGNING_SECRET: randomBytes(48).toString("base64url"),
  };
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  if (!checkOnly && !process.argv.includes("--production-consent-confirmed")) throw new Error("First set the OAuth app publishing status to In production, then run with --production-consent-confirmed. Testing tokens may expire after seven days.");
  const directory = resolve(".vercel-tmp");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (lstatSync(directory).isSymbolicLink()) throw new Error("The setup directory must not be a symbolic link.");
  chmodSync(directory, 0o700);
  const index = process.argv.indexOf("--client");
  const filename = realpathSync(resolve(index < 0 ? ".vercel-tmp/google-oauth-client.json" : process.argv[index + 1]));
  if (!filename.startsWith(realpathSync(directory) + sep) || !lstatSync(filename).isFile()) throw new Error("Save the downloaded client JSON inside .vercel-tmp first.");
  chmodSync(filename, 0o600);
  const client = clientSchema.parse(JSON.parse(readFileSync(filename, "utf8"))).web;
  if (checkOnly) {
    console.log("Client JSON found and valid: Web application with the exact local callback. Owner-only permissions applied. No credentials displayed, Google requests made, or authorization started. Secret rotation, Drive API enablement, and OAuth publishing status still require owner confirmation.");
    return;
  }
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(64).toString("base64url");
  const output = resolve(directory, `google-drive-${Date.now()}.env`);
  let processing = false;
  const server = createServer(async (request, response) => {
    response.setHeader("Content-Type", "text/plain; charset=utf-8");
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Referrer-Policy", "no-referrer");
    if (request.method !== "GET" || !["127.0.0.1", "::1"].includes(request.socket.remoteAddress ?? "") || processing) { response.writeHead(400).end("Invalid callback."); return; }
    let code: string;
    try { code = validateOAuthCallback(request.url ?? "", request.headers.host, state); }
    catch { response.writeHead(400).end("Authorization was not accepted. Check the account and retry setup."); return; }
    processing = true;
    clearTimeout(timeout);
    try {
      const credentials = await completeDriveSetup(client, code, verifier);
      const env = Object.entries(credentials).map(([key, value]) => {
        if (/[\r\n\0]/.test(value)) throw new Error("Invalid credential response");
        return `${key}=${JSON.stringify(value)}`;
      }).join("\n") + "\n";
      writeFileSync(output, env, { flag: "wx", mode: 0o600 });
      response.end("Google Drive connected. You can close this tab and return to the setup assistant.");
      console.log(`Setup complete. Credentials saved privately to ${output}. Do not paste or commit this file.`);
    } catch {
      response.writeHead(400).end("Setup failed. Check the selected account, OAuth publishing status, Drive API, and offline consent, then retry.");
      console.error("Google Drive setup failed. No successful configuration is claimed; no credentials were logged.");
      process.exitCode = 1;
    } finally { server.close(); }
  });
  const timeout = setTimeout(() => { server.close(); console.error("Google setup timed out after five minutes. Run it again when ready."); process.exitCode = 1; }, 5 * 60 * 1000);
  server.on("error", () => { clearTimeout(timeout); console.error("The local OAuth callback could not start. Check port 53682 and retry."); process.exitCode = 1; });
  server.listen(53682, "127.0.0.1", () => {
    const params = new URLSearchParams({ client_id: client.client_id, redirect_uri: CALLBACK, response_type: "code", scope: DRIVE_SCOPE,
      access_type: "offline", prompt: "consent", state, login_hint: DRIVE_OWNER, code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256" });
    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "explorer.exe" : "xdg-open";
    console.log(`Authorization URL: [${url}](${url})`);
    const child = spawn(command, [url], { stdio: "ignore", shell: false });
    child.on("error", () => { console.error("Could not open the browser. Open the authorization link above within five minutes."); });
    child.on("exit", code => { if (code !== 0) console.error("The browser opener did not finish successfully. Open the authorization link above within five minutes."); });
    console.log("Google consent was requested in your default browser. If no tab appears, open the authorization link above. Review and approve it yourself using the storage-owner account; this helper will not interact with the consent page.");
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { console.error("Setup could not start. Check the private client JSON, exact callback URI, and --production-consent-confirmed flag. No credentials were logged."); process.exitCode = 1; });
}
