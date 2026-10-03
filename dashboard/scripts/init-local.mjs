import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
const target = new URL("../.env.local", import.meta.url);
const template = await readFile(
  new URL("../.env.example", import.meta.url),
  "utf8",
);
try {
  await writeFile(
    target,
    template.replace(
      "SESSION_SECRET=",
      "SESSION_SECRET=" + randomBytes(32).toString("base64"),
    ),
    { flag: "wx" },
  );
  console.log(
    "Created .env.local with a private session key. Fill Google values locally; no secrets were printed.",
  );
} catch (error) {
  if (error.code === "EEXIST") console.log("Existing .env.local preserved.");
  else throw error;
}
