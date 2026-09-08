---
name: yezhou-deploy
description: "Publish an HTML file, project directory, or ZIP package to 页舟 and update an existing project while preserving its share URL. Use when the user asks an agent to publish, deploy, share, or republish a web project through 页舟."
---

# 页舟部署

Official source: https://cnb.cool/gebangfeng/yezhou-deploy

Use the bundled script instead of the browser UI:

```bash
node scripts/publish.mjs <html-file|directory|zip-file> [title]
```

On first use, the script starts 页舟 browser authorization. Tell the user to approve the matching one-time code in the browser, then continue waiting for the script. Do not ask the user to create, copy, paste, or expose a token. The credential is stored in the user's configuration directory, never in the project.

On the first publish, the script creates one `.yezhou.json` manifest in the input's project directory. The manifest keeps separate bindings keyed by the directory or HTML/ZIP filename, so sibling inputs do not share a site ID. On later runs with the same input, it updates the recorded site ID, so the public URL stays unchanged. The first use of a legacy single-binding manifest migrates that binding to the current input automatically. Return the URL printed by the script.

Treat `.yezhou.json` as project metadata. By default the publisher idempotently adds `.yezhou.json` to the nearest Git repository's `.gitignore`; it does not initialize Git, stage, or commit changes. Use `--track-state` only when the user explicitly wants the team to share deployment bindings. The state file contains no secret, but publishing it can expose internal project identifiers. Do not replace or delete an existing binding unless the user explicitly asks to publish as a new site. If browser authorization cannot be opened automatically, show the verification URL and one-time code printed by the script.

The publisher requires Node.js 18 or newer and works on Windows, macOS, and Linux. A directory must contain `index.html` at its root. A ZIP may contain `index.html` at the archive root or inside one common top-level wrapper folder, which the server removes automatically. Directories are uploaded automatically; do not ask the user to create a ZIP first. Hidden files and `node_modules` are excluded. SVG is intentionally rejected instead of silently omitted because serving active SVG on the content origin would create a script-execution risk; convert it to PNG/WebP or a safe HTML/CSS icon. Markdown is not supported.
