import { copyFile, cp, mkdir, rm, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = join(projectRoot, "node_modules", "cesium", "Build", "Cesium");
const licenseFile = join(projectRoot, "node_modules", "cesium", "LICENSE.md");
const targetRoot = join(projectRoot, "public", "cesium");
const assetFolders = ["Assets", "ThirdParty", "Widgets", "Workers"];

await mkdir(targetRoot, { recursive: true });
const browserBundle = join(sourceRoot, "Cesium.js");
if (!(await stat(browserBundle).catch(() => null))) {
  throw new Error(`Missing Cesium browser bundle: ${browserBundle}. Install dependencies first.`);
}
await copyFile(browserBundle, join(targetRoot, "Cesium.js"));
if (!(await stat(licenseFile).catch(() => null))) {
  throw new Error(`Missing Cesium license and notices: ${licenseFile}. Install dependencies first.`);
}
await copyFile(licenseFile, join(targetRoot, "LICENSE.md"));
for (const folder of assetFolders) {
  const source = join(sourceRoot, folder);
  const target = join(targetRoot, folder);
  if (!(await stat(source).catch(() => null))) {
    throw new Error(`Missing Cesium build assets: ${source}. Install dependencies first.`);
  }
  await rm(target, { recursive: true, force: true });
  await cp(source, target, { recursive: true });
}

console.log(`Copied local Cesium browser bundle and assets to ${targetRoot}`);
