import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import standalone from "ajv/dist/standalone/index.js";
import { build } from "esbuild";
import { readFile, mkdir, writeFile } from "node:fs/promises";
const schema = JSON.parse(
  await readFile(
    new URL("../contracts/mindflow-card-schema-v1.json", import.meta.url),
    "utf8",
  ),
);
const ajv = new Ajv2020({
  allErrors: true,
  strict: false,
  code: { source: true },
});
addFormats(ajv);
const source = standalone(ajv, ajv.compile(schema));
await mkdir(new URL("../src/generated/", import.meta.url), { recursive: true });
const result = await build({
  stdin: {
    contents: source,
    resolveDir: process.cwd(),
    sourcefile: "validator.cjs",
  },
  bundle: true,
  platform: "browser",
  format: "esm",
  write: false,
  minify: true,
});
await writeFile(
  new URL("../src/generated/card-validator.js", import.meta.url),
  "// Generated from the unchanged v1 JSON Schema. Run npm run generate:validator.\n" +
    result.outputFiles[0].text,
);
