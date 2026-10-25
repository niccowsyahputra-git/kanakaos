import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { driveStorage, hasFileSignature } from "../lib/google-drive.server";
import { uploadResumable } from "../lib/managed-upload-client";
import { StorageError } from "../lib/storage-contract";

// A valid, non-sensitive PDF with padding before its cross-reference table.
export function storageTestPdf() {
  let text = "%PDF-1.4\n";
  const stream = "BT /F1 12 Tf 30 100 Td (KANAKAOS NON-SENSITIVE STORAGE TEST) Tj ET\n";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}endstream`,
  ];
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(text.length);
    text += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  text += `%${".".repeat(2 * 1024 * 1024)}\n`;
  const xref = text.length;
  text += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  text += offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  text += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(text, "ascii");
}

async function main() {
  const drive = driveStorage();
  await drive.health();
  console.log("Drive health passed: token refresh, designated owner, and private storage folder verified.");
  if (!process.argv.includes("--upload-test")) return;

  const bytes = storageTestPdf();
  const id = await drive.generateId();
  const managedId = `storage-smoke-${randomUUID()}`;
  const purpose = "PROGRAM_PROPOSAL" as const;
  let stage = "session initialization";
  let transferDetail = "";
  let failed = false;
  try {
    const origin = "http://localhost:3100";
    const session = await drive.start({ id, managedId, purpose, filename: "KANAKAOS-NON-SENSITIVE-STORAGE-TEST.pdf", mime: "application/pdf", bytes: bytes.length }, origin);
    stage = "browser CORS preflight";
    const options = await fetch(session, { method: "OPTIONS", redirect: "error", signal: AbortSignal.timeout(30_000), headers: {
      Origin: origin, "Access-Control-Request-Method": "PUT", "Access-Control-Request-Headers": "content-type,content-range,x-guploader-no-308",
    } });
    const allowsOrigin = (response: Response) => ["*", origin].includes(response.headers.get("access-control-allow-origin") ?? "");
    const allowedHeaders = (options.headers.get("access-control-allow-headers") ?? "").toLowerCase().split(/,\s*/);
    const allowedMethods = (options.headers.get("access-control-allow-methods") ?? "").split(/,\s*/);
    if (!options.ok || !allowsOrigin(options) || !allowedMethods.includes("PUT") || !["content-type", "content-range", "x-guploader-no-308"].every(header => allowedHeaders.includes(header) || allowedHeaders.includes("*"))) throw new Error("Browser preflight rejected");
    stage = "resumable upload and confirmed-range retry";
    let interrupted = false;
    let retryProbe = false;
    const transport: typeof fetch = async (input, init = {}) => {
      const headers = new Headers(init.headers);
      headers.set("Origin", origin);
      let response: Response;
      try { response = await fetch(input, { ...init, headers }); }
      catch (error) {
        const cause = error instanceof Error ? error.cause : undefined;
        transferDetail = cause instanceof Error && cause.message === "unexpected redirect"
          ? "Fetch rejected an HTTP redirect"
          : "Fetch failed before receiving response headers";
        throw error;
      }
      transferDetail = `HTTP ${response.status}; browser origin ${allowsOrigin(response) ? "allowed" : "missing"}; confirmed range ${response.headers.has("range") ? "present" : "absent"}`;
      if (!allowsOrigin(response)) throw new Error("Upload response is not browser-readable");
      const exposed = (response.headers.get("access-control-expose-headers") ?? "").toLowerCase().split(/,\s*/);
      for (const header of ["range", "x-http-status-code-override"]) {
        if (response.headers.has(header) && !exposed.includes(header) && !exposed.includes("*")) {
          transferDetail += `; ${header} not exposed to browsers`;
          throw new Error("Upload status header is not exposed to browsers");
        }
      }
      const range = headers.get("Content-Range") ?? "";
      if (interrupted && range.startsWith("bytes */") && response.headers.has("range")) retryProbe = true;
      if (!interrupted && range.startsWith("bytes 0-") && (response.status === 308 || response.headers.get("x-http-status-code-override") === "308")) {
        interrupted = true;
        await response.body?.cancel();
        throw new Error("Simulated lost response after a confirmed chunk");
      }
      return response;
    };
    await uploadResumable(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }), session, () => {}, transport);
    if (!interrupted || !retryProbe) throw new Error("Retry was not exercised");
    stage = "metadata and private download verification";
    const metadata = await drive.metadata(id);
    if (!metadata || metadata.size !== String(bytes.length) || metadata.mimeType !== "application/pdf" || metadata.trashed || !metadata.ownedByMe ||
      metadata.parents?.length !== 1 || metadata.parents[0] !== drive.folderId || metadata.appProperties?.managedId !== managedId ||
      metadata.appProperties?.application !== "kanakaos" || metadata.appProperties?.purpose !== purpose ||
      !metadata.permissions?.length || metadata.permissions.some(permission => permission.type !== "user" || permission.role !== "owner")) throw new Error("Unexpected private metadata");
    if (!hasFileSignature("application/pdf", await drive.prefix(id))) throw new Error("Invalid PDF signature");
    const downloaded = await drive.download(id);
    if (!Buffer.from(await downloaded.arrayBuffer()).equals(bytes)) throw new Error("Download differs from upload");
    const anonymous = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, { redirect: "error", signal: AbortSignal.timeout(30_000) });
    await anonymous.body?.cancel();
    if (anonymous.ok) throw new Error("Anonymous download unexpectedly succeeded");
    console.log("Live test passed: browser CORS headers, multi-chunk upload, lost-response retry, metadata/signature, exact private download, and anonymous denial.");
  } catch (error) {
    failed = true;
    console.error(`Live test failed during ${stage}${error instanceof StorageError ? ` (${error.code})` : ""}. No credentials or upload capabilities were logged.`);
    if (transferDetail) console.error(`Safe transfer diagnostics: ${transferDetail}.`);
  } finally {
    const metadata = await drive.metadata(id);
    if (metadata) {
      if (!metadata.ownedByMe || metadata.parents?.length !== 1 || metadata.parents[0] !== drive.folderId ||
        metadata.appProperties?.application !== "kanakaos" || metadata.appProperties?.managedId !== managedId || metadata.appProperties?.purpose !== purpose) {
        throw new Error("Test cleanup ownership mismatch");
      }
      await drive.trash(id);
      if (await drive.metadata(id)) throw new Error("Test cleanup did not complete");
    }
    console.log("Scoped test cleanup completed. No application database, existing files, or production settings were changed.");
  }
  if (failed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(`Drive check failed${error instanceof StorageError ? ` (${error.code})` : ""}. No credentials were logged.`);
    process.exitCode = 1;
  });
}
