import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const tag = process.env.DEVELRA_RELEASE_TAG;

if (!tag) {
  throw new Error("DEVELRA_RELEASE_TAG is required.");
}

const metadata = JSON.parse(
  await readFile(
    path.join(repositoryRoot, "apps", "cli", "package.json"),
    "utf8",
  ),
);
const expectedTag = `v${metadata.version}`;

if (tag !== expectedTag) {
  throw new Error(
    `Release tag ${JSON.stringify(tag)} does not match package version ${JSON.stringify(expectedTag)}.`,
  );
}

if (!/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(tag)) {
  throw new Error(
    `Release tag ${JSON.stringify(tag)} is not a semantic version.`,
  );
}

await access(
  path.join(repositoryRoot, "docs", "releases", `${expectedTag}.md`),
);

process.stdout.write(
  `Release identity valid: develra@${metadata.version} from ${expectedTag}.\n`,
);
