import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
const projectRoot = process.cwd();
const clientBundleRoot = join(projectRoot, ".next", "static");
const environmentContract = await readFile(
  join(projectRoot, ".env.example"),
  "utf8",
);

loadEnvConfig(projectRoot);

const privateVariableNames = environmentContract
  .split(/\r?\n/u)
  .map((line) => line.match(/^([A-Z][A-Z0-9_]*)=/u)?.[1])
  .filter((name) => name && !name.startsWith("NEXT_PUBLIC_"));

const configuredSecrets = privateVariableNames
  .map((name) => ({ name, value: process.env[name] }))
  .filter(({ value }) => value && value.length >= 8);

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? listFiles(path) : [path];
    }),
  );

  return files.flat();
}

const clientFiles = await listFiles(clientBundleRoot);
const leakedVariableNames = new Set();

for (const file of clientFiles) {
  const contents = await readFile(file);

  for (const { name, value } of configuredSecrets) {
    if (contents.includes(Buffer.from(value))) {
      leakedVariableNames.add(name);
    }
  }
}

if (leakedVariableNames.size > 0) {
  throw new Error(
    `Private values found in client bundle: ${[...leakedVariableNames].join(", ")}`,
  );
}

console.log(
  `Client bundle secret scan passed for ${configuredSecrets.length} configured private variable(s).`,
);