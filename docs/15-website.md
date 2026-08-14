# Website

The Develra website is a static, local-first companion to the repository. It
has no framework, package install, analytics, cookies, hosted fonts, forms, or
runtime network requests. Product claims should remain limited to behavior
validated by the CLI and bundled GitHub Action.

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

## Deployment preparation

The root `vercel.json` makes the repository ready to import as a framework-free
Vercel project. Vercel skips dependency installation, runs the zero-dependency
site validator as its build check, and deploys only `site/`. The configuration
also applies restrictive response security headers. Git pushes will receive
preview deployments after the repository is connected to Vercel; pushes to the
Vercel production branch will receive production deployments.

The owner can create a private preview now:

1. import `develra-dev/develra` in Vercel using the existing GitHub integration;
2. accept the settings from `vercel.json` without adding environment variables;
3. review the generated Vercel preview URL.

When the public release is ready, verify the npm package and `v0` Action tag so
the website examples work, then attach `develra.dev` in the Vercel project,
follow the DNS records Vercel supplies, choose the canonical apex or `www`
domain, and redirect the other. Update the repository website field after the
domain resolves.

Do not attach the public domain before the GitHub repository, npm package, and
Action tag used by the page are publicly available.

Do not add analytics, forms, external scripts, or a hosted backend without an
explicit privacy and product decision.
