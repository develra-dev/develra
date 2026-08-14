# Website

The Develra website is a static, local-first companion to the repository. It
has no framework, package install, cookies, hosted fonts, forms, or hosted
backend. Production uses Vercel's first-party Web Analytics route for aggregate
page views and acquisition reporting; it does not add custom events or CLI
telemetry. Product claims should remain limited to behavior validated by the
CLI and bundled GitHub Action.

The visual direction adapts the dark canvas, bright action color, rounded
surfaces, and generous spacing described in the supplied
[CodeRabbit design reference](https://github.com/scroobius-pip/fudge-design-md/blob/main/design-md/coderabbit.ai.md).
It uses original layouts and self-hosted
[Geist 1.7.2](https://github.com/vercel/geist-font/releases/tag/v1.7.2) Sans
and Mono variable fonts under the SIL Open Font License 1.1. No proprietary
visual assets or font files are included, and the page never contacts a font
host at runtime. The redistributed license is stored beside the font assets.
Selected geometric forms use optimized crops derived from two owner-supplied
GPTypo abstract gradient images; they remain local assets and are checksum
validated with the rest of the site.

The hero keeps “Package lockfiles miss” fixed and rotates through five contract
types with a local, dependency-free character transition. Each new phrase
builds from left to right with a restrained stagger. Neighboring letters use
small, alternating vertical movements while orange and light-mint accent layers
fade into Develra teal. A lower-opacity screen-blended copy sits above each
accent so the flash brightens without washing out its hue. Letters remain
visibly whole during the transition instead of passing through a clipping mask.
The animation reserves the widest phrase to avoid layout shift, pauses in
background tabs, is hidden from assistive technology in favor of a complete
heading label, and does not run when the visitor requests reduced motion.

FAQ disclosures retain native `details` and `summary` behavior without
JavaScript. When browser animation APIs are available, answers expand and
collapse with a short height, fade, and vertical transition. Reduced-motion
visitors keep the native instant disclosure behavior.

## Local review

From the repository root:

```bash
pnpm site:validate
pnpm site:preview
```

Open `http://127.0.0.1:4173`. Set `DEVELRA_SITE_PORT` to use another local
port. Website validation is also part of `pnpm verify`.

## Deployment

The root `vercel.json` makes the repository ready to import as a framework-free
Vercel project. Vercel skips dependency installation, runs the zero-dependency
site validator as its build check, and deploys only `site/`. The configuration
also applies restrictive response security headers. Git pushes will receive
preview deployments after the repository is connected to Vercel; pushes to the
Vercel production branch will receive production deployments.

Production is deployed at `https://www.develra.dev/`. Vercel redirects the apex
domain to `www`, which is also the canonical host in page metadata, social-card
URLs, `robots.txt`, and `sitemap.xml`. The generated `develra.vercel.app` domain
remains available for deployment diagnostics.

Vercel Web Analytics is loaded from the same-origin
`/_vercel/insights/script.js` platform route. The page initializes only the
standard page-view queue; there are no custom interaction events. The content
security policy permits same-origin connections for that route while continuing
to reject remote scripts, unsafe inline/eval execution, and framing. The footer
discloses aggregate, cookie-free page-view measurement, and product copy
distinguishes website analytics from the telemetry-free CLI.

Search metadata uses `https://www.develra.dev/` consistently and includes a
descriptive title, page summary, index directives, Open Graph/Twitter cards,
and JSON-LD `WebSite` and `Organization` entities linked to the canonical
GitHub, npm, and Marketplace identities. Keep the sitemap limited to real,
canonical pages and do not add synthetic SEO landing pages.

Do not announce the website before the GitHub repository, npm package, and
Action tag used by the page are publicly available. Update the repository
website field as part of the visibility launch.

Do not add custom analytics events, advertising trackers, forms, external
scripts, or a hosted backend without an explicit privacy and product decision.
