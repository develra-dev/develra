import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const siteRoot = path.join(projectRoot, "site");
const deploymentConfigPath = path.join(projectRoot, "vercel.json");
const registryFiles = [
  "api/v1/capabilities.ts",
  "api/v1/changes.ts",
  "registry-server/index.ts",
  "registry-server/data/changes.json",
];
const requiredFiles = [
  "index.html",
  "styles.css",
  "script.js",
  "assets/favicon.svg",
  "assets/contract-map.svg",
  "assets/gradient-ember.webp",
  "assets/gradient-violet.webp",
  "assets/social-card.svg",
  "assets/social-card.png",
  "assets/fonts/geist-variable.woff2",
  "assets/fonts/geist-mono-variable.woff2",
  "assets/fonts/OFL.txt",
  "robots.txt",
  "sitemap.xml",
];
const maximumBytes = new Map([
  ["index.html", 100_000],
  ["styles.css", 150_000],
  ["script.js", 10_000],
  ["assets/favicon.svg", 20_000],
  ["assets/contract-map.svg", 100_000],
  ["assets/gradient-ember.webp", 100_000],
  ["assets/gradient-violet.webp", 100_000],
  ["assets/social-card.svg", 100_000],
  ["assets/social-card.png", 2_000_000],
  ["assets/fonts/geist-variable.woff2", 100_000],
  ["assets/fonts/geist-mono-variable.woff2", 100_000],
  ["assets/fonts/OFL.txt", 10_000],
  ["robots.txt", 2_000],
  ["sitemap.xml", 10_000],
]);
const failures = [];
const pinnedAssetHashes = new Map([
  [
    "assets/fonts/geist-variable.woff2",
    "2ffebe993e969069a9789d15164b7715d42491b5835516c5e3b935d5f81b05f1",
  ],
  [
    "assets/fonts/geist-mono-variable.woff2",
    "afaacc4c5fbba89d2ebf7a02dc4070208540874592a5504d57175782fe893101",
  ],
  [
    "assets/fonts/OFL.txt",
    "942560b236adfa83745b2c64e5fc09ebaf91cb331751b1157eb92187e5d6e930",
  ],
  [
    "assets/gradient-ember.webp",
    "17c1874a3ce539606ad5ddb3ec7a0c0ade559f0a7d2c5c12c47060969388a82b",
  ],
  [
    "assets/gradient-violet.webp",
    "d9924b93066151ea1422a5e6a8c7f2ba8557faf52a3857d2f4daf3407a044ff1",
  ],
]);

async function inspectRequiredFiles() {
  for (const relativePath of requiredFiles) {
    try {
      const details = await stat(path.join(siteRoot, relativePath));
      if (!details.isFile()) {
        failures.push(`${relativePath} must be a file`);
        continue;
      }

      const maximum = maximumBytes.get(relativePath);
      if (maximum !== undefined && details.size > maximum) {
        failures.push(`${relativePath} exceeds its ${maximum}-byte budget`);
      }
    } catch {
      failures.push(`${relativePath} is missing`);
    }
  }
}

async function inspectRegistryFiles() {
  for (const relativePath of registryFiles) {
    try {
      const details = await stat(path.join(projectRoot, relativePath));
      if (!details.isFile()) failures.push(`${relativePath} must be a file`);
      if (details.size > 128 * 1024)
        failures.push(`${relativePath} exceeds its 131072-byte budget`);
    } catch {
      failures.push(`${relativePath} is missing`);
    }
  }

  try {
    const registryData = JSON.parse(
      await readFile(
        path.join(projectRoot, "registry-server/data/changes.json"),
        "utf8",
      ),
    );
    if (registryData?.version !== 1 || !Array.isArray(registryData?.changes)) {
      failures.push("registry change data must use the version 1 envelope");
    }
  } catch (error) {
    failures.push(
      `registry change data must be valid JSON: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
  }
}

function inspectMarkup(html) {
  const requiredPatterns = [
    [/<html\s+lang="en">/i, "an English document language"],
    [/<meta\s+name="viewport"/i, "a viewport meta tag"],
    [/<meta\s+name="description"/i, "a description meta tag"],
    [
      /<meta\s+name="robots"\s+content="index, follow, max-image-preview:large"/i,
      "indexable robots metadata",
    ],
    [/Content-Security-Policy/i, "a content security policy"],
    [
      /<link\s+rel="canonical"\s+href="https:\/\/www\.develra\.dev\/"/i,
      "the canonical URL",
    ],
    [
      /<meta\s+property="og:url"\s+content="https:\/\/www\.develra\.dev\/"/i,
      "the canonical Open Graph URL",
    ],
    [
      /<meta\s+property="og:image"\s+content="https:\/\/www\.develra\.dev\/assets\/social-card\.png"/i,
      "the canonical Open Graph image",
    ],
    [/npx develra scan/, "the primary scan command"],
    [/Package lockfiles miss/, "the external-contract headline"],
    [/external APIs\./, "the primary rotating contract type"],
    [/MCP servers\./, "the final rotating contract type"],
    [/No account/, "the no-account product promise"],
    [/No source upload/, "the local-first product promise"],
    [/No CLI telemetry/, "the telemetry-free CLI promise"],
    [
      /develra check --registry\s+https:\/\/www\.develra\.dev\/api/,
      "the optional public registry command",
    ],
    [/sends only detected provider IDs/, "the registry privacy boundary"],
    [/Offline by default/, "the offline-default product promise"],
    [/class="trust-icon"/, "the product-guarantee check icons"],
    [/~\/your-project/, "the example project path"],
    [/class="faq-answer"/, "animated FAQ answer wrappers"],
    [
      /src="\/_vercel\/insights\/script\.js"\s+defer/,
      "the Vercel Web Analytics loader",
    ],
    [
      /https:\/\/github\.com\/marketplace\/actions\/develra-external-contract-check/,
      "the GitHub Marketplace listing",
    ],
  ];

  for (const [pattern, description] of requiredPatterns) {
    if (!pattern.test(html))
      failures.push(`index.html must contain ${description}`);
  }

  const headingCount = html.match(/<h1(?:\s|>)/gi)?.length ?? 0;
  if (headingCount !== 1)
    failures.push(
      `index.html must contain exactly one h1, found ${headingCount}`,
    );

  const forbiddenPatterns = [
    [/<script\b[^>]*\bsrc="https?:/i, "remote scripts"],
    [/<img\b[^>]*\bsrc="https?:/i, "remote images"],
    [
      /<link\b[^>]*\brel="stylesheet"[^>]*\bhref="https?:/i,
      "remote stylesheets",
    ],
    [/\bhttp:\/\//i, "insecure HTTP URLs"],
    [
      /(google-analytics|googletagmanager|segment\.com|plausible\.io)/i,
      "analytics loaders",
    ],
  ];

  for (const [pattern, description] of forbiddenPatterns) {
    if (pattern.test(html))
      failures.push(`index.html must not contain ${description}`);
  }

  if (/~\/acme-app/.test(html)) {
    failures.push("index.html must not use the acme placeholder project path");
  }

  if (/no runtime install or\s+hosted service/i.test(html)) {
    failures.push(
      "index.html must not claim that no hosted service exists now that the optional public registry is deployed",
    );
  }
}

function inspectStructuredData(html) {
  const blocks = [
    ...html.matchAll(
      /<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/gi,
    ),
  ];
  if (blocks.length === 0) {
    failures.push("index.html must contain JSON-LD structured data");
    return;
  }

  const nodes = [];
  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block[1]);
      if (Array.isArray(parsed?.["@graph"])) nodes.push(...parsed["@graph"]);
      else nodes.push(parsed);
    } catch (error) {
      failures.push(
        `index.html contains invalid JSON-LD: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
    }
  }

  const website = nodes.find((node) => node?.["@type"] === "WebSite");
  if (
    website?.name !== "Develra" ||
    website?.url !== "https://www.develra.dev/"
  ) {
    failures.push(
      "index.html WebSite structured data must identify the canonical Develra site",
    );
  }

  const organization = nodes.find((node) => node?.["@type"] === "Organization");
  const sameAs = organization?.sameAs;
  if (
    organization?.name !== "Develra" ||
    !Array.isArray(sameAs) ||
    !sameAs.includes("https://github.com/develra-dev") ||
    !sameAs.includes("https://www.npmjs.com/package/develra")
  ) {
    failures.push(
      "index.html Organization structured data must link Develra's canonical public identities",
    );
  }
}

function inspectSiteScript(source) {
  const requiredPatterns = [
    [/window\.vaq/, "initialize the Vercel Web Analytics queue"],
    [
      /prefers-reduced-motion:\s*reduce/,
      "respect the reduced-motion preference",
    ],
    [/document\.hidden/, "pause headline rotation in background tabs"],
    [
      /headline-character--from-(?:above|below)/,
      "alternate headline character directions",
    ],
    [/headline-character--accent-/, "assign headline character accent colors"],
    [
      /headline-character--accent-\$\{\(animatedIndex % 2\) \+ 1\}/,
      "limit the headline flash palette to two colors",
    ],
    [/headline-character-accent/, "create the headline transition color layer"],
    [
      /headline-character-screen/,
      "create a separate headline screen-blend layer",
    ],
    [/enhanceFaq/, "progressively enhance FAQ disclosure animation"],
  ];

  for (const [pattern, description] of requiredPatterns) {
    if (!pattern.test(source)) failures.push(`script.js must ${description}`);
  }
}

function inspectSiteStyles(source) {
  const requiredPatterns = [
    [
      /\.headline-glyph\s*\{[^}]*overflow:\s*visible/s,
      "keep animated headline glyphs unclipped",
    ],
    [
      /transition-delay:\s*calc\(var\(--character-index\)\s*\*\s*42ms\)/,
      "stagger incoming headline characters from left to right",
    ],
    [
      /--character-enter-offset:\s*-?34%/,
      "use subtle headline character travel",
    ],
    [/--mint-flash:\s*#8cf3bd/, "use the selected mint headline flash color"],
    [
      /mix-blend-mode:\s*screen/,
      "place screen blending above the headline color flashes",
    ],
    [/\.faq-answer\s*\{[^}]*overflow:\s*hidden/s, "clip FAQ height motion"],
  ];

  for (const [pattern, description] of requiredPatterns) {
    if (!pattern.test(source)) failures.push(`styles.css must ${description}`);
  }

  if (/headline-character--accent-3/.test(source)) {
    failures.push("styles.css must not define a third headline flash color");
  }
}

async function inspectLocalReferences(html) {
  const references = [...html.matchAll(/\b(?:href|src)="([^"]+)"/g)].map(
    (match) => match[1],
  );

  for (const reference of references) {
    if (/^(?:https:|mailto:|#)/.test(reference)) continue;
    if (reference.startsWith("/_vercel/")) continue;

    const pathname = reference.split(/[?#]/, 1)[0].replace(/^\//, "");
    const resolved = path.resolve(siteRoot, pathname);
    const relative = path.relative(siteRoot, resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      failures.push(
        `index.html reference escapes the site directory: ${reference}`,
      );
      continue;
    }

    try {
      const details = await stat(resolved);
      if (!details.isFile())
        failures.push(`index.html reference is not a file: ${reference}`);
    } catch {
      failures.push(`index.html reference is missing: ${reference}`);
    }
  }
}

async function inspectSvg(relativePath) {
  const source = await readFile(path.join(siteRoot, relativePath), "utf8");
  if (
    /<(?:script|foreignObject)\b|\bon[a-z]+\s*=|\bhref\s*=\s*"https?:/i.test(
      source,
    )
  ) {
    failures.push(`${relativePath} contains active or remote SVG content`);
  }
}

async function inspectSocialCard() {
  const card = await readFile(path.join(siteRoot, "assets/social-card.png"));
  const isPng =
    card.length >= 24 &&
    card.subarray(0, 8).toString("hex") === "89504e470d0a1a0a";
  if (!isPng) {
    failures.push("assets/social-card.png must be a valid PNG file");
    return;
  }

  const width = card.readUInt32BE(16);
  const height = card.readUInt32BE(20);
  if (width !== 1200 || height !== 630) {
    failures.push(
      `assets/social-card.png must be 1200x630, found ${width}x${height}`,
    );
  }
}

async function inspectFont(relativePath) {
  const font = await readFile(path.join(siteRoot, relativePath));
  if (font.length < 4 || font.subarray(0, 4).toString("ascii") !== "wOF2") {
    failures.push(`${relativePath} must be a valid WOFF2 file`);
  }
}

async function inspectWebp(relativePath) {
  const image = await readFile(path.join(siteRoot, relativePath));
  const isWebp =
    image.length >= 12 &&
    image.subarray(0, 4).toString("ascii") === "RIFF" &&
    image.subarray(8, 12).toString("ascii") === "WEBP";
  if (!isWebp) failures.push(`${relativePath} must be a valid WebP file`);
}

async function inspectPinnedAssets() {
  for (const [relativePath, expectedHash] of pinnedAssetHashes) {
    const asset = await readFile(path.join(siteRoot, relativePath));
    const actualHash = createHash("sha256").update(asset).digest("hex");
    if (actualHash !== expectedHash) {
      failures.push(`${relativePath} does not match its pinned checksum`);
    }
  }
}

async function inspectDeploymentConfig() {
  let config;
  try {
    config = JSON.parse(await readFile(deploymentConfigPath, "utf8"));
  } catch (error) {
    failures.push(
      `vercel.json must contain valid JSON: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
    return;
  }

  const expectedSettings = new Map([
    ["framework", null],
    ["installCommand", ""],
    ["buildCommand", "node scripts/validate-site.mjs"],
    ["outputDirectory", "site"],
    ["cleanUrls", true],
    ["trailingSlash", false],
  ]);

  for (const [setting, expected] of expectedSettings) {
    if (config[setting] !== expected) {
      failures.push(
        `vercel.json ${setting} must be ${JSON.stringify(expected)}`,
      );
    }
  }

  const globalHeaders = config.headers?.find(
    (entry) => entry.source === "/(.*)",
  )?.headers;
  if (!Array.isArray(globalHeaders)) {
    failures.push("vercel.json must define global response security headers");
    return;
  }

  const headersByName = new Map(
    globalHeaders.map((header) => [header.key, header.value]),
  );
  for (const requiredHeader of [
    "Content-Security-Policy",
    "Permissions-Policy",
    "Referrer-Policy",
    "X-Content-Type-Options",
    "X-Frame-Options",
  ]) {
    if (!headersByName.has(requiredHeader)) {
      failures.push(`vercel.json must define ${requiredHeader}`);
    }
  }

  const contentSecurityPolicy = headersByName.get("Content-Security-Policy");
  if (
    !contentSecurityPolicy?.includes("connect-src 'self'") ||
    !contentSecurityPolicy.includes("frame-ancestors 'none'") ||
    contentSecurityPolicy.includes("'unsafe-inline'") ||
    contentSecurityPolicy.includes("'unsafe-eval'")
  ) {
    failures.push(
      "vercel.json Content-Security-Policy must allow only same-origin analytics connections and block unsafe scripts and framing",
    );
  }

  if (
    headersByName.get("Referrer-Policy") !== "strict-origin-when-cross-origin"
  ) {
    failures.push(
      "vercel.json Referrer-Policy must preserve origin-only acquisition data across origins",
    );
  }
}

async function inspectDiscoveryFiles() {
  const robots = await readFile(path.join(siteRoot, "robots.txt"), "utf8");
  if (!robots.includes("Sitemap: https://www.develra.dev/sitemap.xml")) {
    failures.push("robots.txt must advertise the canonical www sitemap URL");
  }

  const sitemap = await readFile(path.join(siteRoot, "sitemap.xml"), "utf8");
  if (!sitemap.includes("<loc>https://www.develra.dev/</loc>")) {
    failures.push("sitemap.xml must contain the canonical www page URL");
  }
}

await inspectRequiredFiles();
await inspectRegistryFiles();

const html = await readFile(path.join(siteRoot, "index.html"), "utf8");
const script = await readFile(path.join(siteRoot, "script.js"), "utf8");
const styles = await readFile(path.join(siteRoot, "styles.css"), "utf8");
inspectMarkup(html);
inspectStructuredData(html);
inspectSiteScript(script);
inspectSiteStyles(styles);
await inspectLocalReferences(html);
await inspectSvg("assets/favicon.svg");
await inspectSvg("assets/contract-map.svg");
await inspectSvg("assets/social-card.svg");
await inspectSocialCard();
await inspectFont("assets/fonts/geist-variable.woff2");
await inspectFont("assets/fonts/geist-mono-variable.woff2");
await inspectWebp("assets/gradient-ember.webp");
await inspectWebp("assets/gradient-violet.webp");
await inspectPinnedAssets();
await inspectDeploymentConfig();
await inspectDiscoveryFiles();

if (failures.length > 0) {
  console.error("Website validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    `Website validation passed (${requiredFiles.length} static files, ${registryFiles.length} registry files, Vercel deployment configured, no remote runtime assets).`,
  );
}
