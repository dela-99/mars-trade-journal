import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
const directory = await mkdtemp(join(tmpdir(), "mars-journal-tests-"));
try {
  const files = [
    "src/lib/note-validation.test.ts",
    "../mars-trade-journal/src/lib/journal.test.ts",
  ];
  for (const [index, file] of files.entries()) {
    await build({
      entryPoints: [file],
      outfile: join(directory, `${index}.test.mjs`),
      bundle: true,
      platform: "node",
      format: "esm",
    });
  }
  const result = spawnSync(
    process.execPath,
    [
      "--test",
      ...files.map((_, index) => join(directory, `${index}.test.mjs`)),
    ],
    { stdio: "inherit" },
  );
  process.exitCode = result.status ?? 1;
} finally {
  await rm(directory, { recursive: true, force: true });
}
