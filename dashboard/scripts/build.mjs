import { mkdir, copyFile, readdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
// The previous static-only Build Output API would bypass the new api/ functions.
// Remove only this builder's generated output; keep project link settings.
const legacyOutput = path.resolve(root, ".vercel/output");
if (!legacyOutput.startsWith(path.resolve(root) + path.sep))
  throw Error("Invalid generated output path");
await rm(legacyOutput, { recursive: true, force: true });
const files = ["index.html", "styles.css", "app.js"];
for (const name of await readdir(path.join(root, "modules"))) {
  if (name.endsWith(".js")) files.push(`modules/${name}`);
}
// Only browser assets are published; local servers and tests stay in source.
for (const folder of ["dist"]) {
  for (const file of files) {
    const target = path.join(root, folder, file);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(root, file), target);
  }
}
console.log(
  `Built ${files.length} browser assets. Vercel compiles api/ functions separately.`,
);
