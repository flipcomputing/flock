import * as Blockly from "blockly";
import { workspace } from "./blocklyinit.js";

const MAX_DECOMPRESSED_BYTES = 5 * 1024 * 1024; // 5MB

// Strip the `id` field from block objects (identified by having a `type` key).
// Variable IDs in the `variables` array and `VAR` field values are preserved
// because they are cross-referenced and have no name fallback in the serialized format.
function stripBlockIds(obj) {
  if (Array.isArray(obj)) return obj.map(stripBlockIds);
  if (obj && typeof obj === "object") {
    const isBlock = typeof obj.type === "string";
    const result = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === "id" && isBlock) continue;
      result[k] = stripBlockIds(v);
    }
    return result;
  }
  return obj;
}

function toBase64url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function fromBase64url(str) {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function compress(str) {
  const bytes = new TextEncoder().encode(str);
  const stream = new CompressionStream("deflate");
  const writer = stream.writable.getWriter();
  writer.write(bytes);
  writer.close();
  return new Response(stream.readable).arrayBuffer();
}

export async function decompress(buffer) {
  if (buffer.byteLength > MAX_DECOMPRESSED_BYTES) {
    throw new Error("Encoded project exceeds size limit");
  }
  const stream = new DecompressionStream("deflate");
  const writer = stream.writable.getWriter();
  writer.write(buffer);
  writer.close();
  const result = await new Response(stream.readable).arrayBuffer();
  if (result.byteLength > MAX_DECOMPRESSED_BYTES) {
    throw new Error("Decoded project exceeds size limit");
  }
  return new TextDecoder().decode(result);
}

export async function encodeProject(json) {
  const stripped = stripBlockIds(json);
  const compressed = await compress(JSON.stringify(stripped));
  return toBase64url(compressed);
}

export async function decodeProject(encoded) {
  const text = await decompress(fromBase64url(encoded));
  return JSON.parse(text);
}

export async function shareProject() {
  const json = Blockly.serialization.workspaces.save(workspace);
  const encoded = await encodeProject(json);
  const url =
    window.location.origin +
    window.location.pathname +
    window.location.search +
    "#p=" +
    encoded;
  await navigator.clipboard.writeText(url);
}

export function showShareToast(message) {
  const toast = document.createElement("div");
  toast.textContent = message;
  Object.assign(toast.style, {
    position: "fixed",
    bottom: "24px",
    left: "50%",
    transform: "translateX(-50%)",
    background: "#333",
    color: "#fff",
    padding: "10px 20px",
    borderRadius: "6px",
    fontSize: "14px",
    zIndex: "9999",
    opacity: "1",
    transition: "opacity 0.4s ease",
    pointerEvents: "none",
  });
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 400);
  }, 2000);
}
