import fs from "node:fs";
import path from "node:path";

const VERSION_FILE = path.resolve(process.cwd(), "src/constants/web-version.ts");
const VERSION_PATTERN = /export const WEB_VERSION = "(\d+)\.(\d+)\.(\d+)";/;

const source = fs.readFileSync(VERSION_FILE, "utf8");
const match = source.match(VERSION_PATTERN);

if (!match) {
  throw new Error(`Unable to find WEB_VERSION in ${VERSION_FILE}`);
}

const major = Number.parseInt(match[1], 10);
let minor = Number.parseInt(match[2], 10);
let patch = Number.parseInt(match[3], 10);

patch += 1;
if (patch > 9) {
  patch = 0;
  minor += 1;
}

const nextVersion = `${major}.${minor}.${patch}`;
const nextSource = source.replace(
  VERSION_PATTERN,
  `export const WEB_VERSION = "${nextVersion}";`
);

fs.writeFileSync(VERSION_FILE, nextSource, "utf8");
console.log(`WEB_VERSION bumped to ${nextVersion}`);
