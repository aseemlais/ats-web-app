import { access, copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serverRoot = path.resolve(__dirname, "..");
const projectRoot = path.resolve(serverRoot, "..");

const candidates = [
  path.join(
    projectRoot,
    "node_modules",
    "pdfjs-dist",
    "build",
    "pdf.worker.mjs",
  ),
  path.join(
    projectRoot,
    "node_modules",
    "pdf-parse",
    "node_modules",
    "pdfjs-dist",
    "build",
    "pdf.worker.mjs",
  ),
];

let source = null;

for (const candidate of candidates) {
  try {
    await access(candidate);
    source = candidate;
    break;
  } catch {
    // Continue checking the next location.
  }
}

if (!source) {
  throw new Error(
    `Could not find pdf.worker.mjs. Checked these locations:\n\n${candidates.join(
      "\n",
    )}`,
  );
}

const destination = path.join(
  serverRoot,
  "dist",
  "pdf.worker.mjs",
);

await mkdir(path.dirname(destination), { recursive: true });

await copyFile(source, destination);

console.log("PDF worker copied successfully.");
console.log(`Source: ${source}`);
console.log(`Destination: ${destination}`);