import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function parseEnvLine(line: string) {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const separatorIndex = trimmed.indexOf("=");

  if (separatorIndex <= 0) {
    return null;
  }

  const key = trimmed.slice(0, separatorIndex).trim();
  let value = trimmed.slice(separatorIndex + 1).trim();

  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return { key, value };
}

export function loadLocalEnv() {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  for (const fileName of [".env.local", ".env"]) {
    const envPath = resolve(process.cwd(), fileName);

    if (!existsSync(envPath)) {
      continue;
    }

    const content = readFileSync(envPath, "utf8");

    for (const line of content.split(/\r?\n/)) {
      const item = parseEnvLine(line);

      if (item && process.env[item.key] === undefined) {
        process.env[item.key] = item.value;
      }
    }
  }
}
