---
name: yezhou-deploy
description: Publish an HTML file, project directory, or ZIP package to 页舟 and update an existing project while preserving its share URL. Use when the user asks an agent to publish, deploy, share, or republish a web project through 页舟.
---

# 页舟部署

Official source: https://cnb.cool/gebangfeng/yezhou-deploy

Use the bundled script instead of the browser UI:

```bash
node scripts/publish.mjs <html-file|directory|zip-file> [title]
```

On first use, the script starts 页舟 browser authorization. Tell the user to approve the matching one-time code in the browser, then continue waiting for the script. Do not ask the user to create, copy, paste, or expose a token. The credential is stored in the user's configuration directory, never in the project.

On the first publish, the script creates `.yezhou.json` beside the HTML file. On later runs from that project, it updates the recorded site ID, so the public URL stays unchanged. Return the URL printed by the script.

Treat `.yezhou.json` as project metadata and recommend adding it to `.gitignore`. It contains no secret, but publishing it can expose internal project identifiers. Do not replace or delete an existing binding unless the user explicitly asks to publish as a new site. If browser authorization cannot be opened automatically, show the verification URL and one-time code printed by the script.

The publisher requires Node.js 18 or newer and works on Windows, macOS, and Linux. For a directory or ZIP package, the project root must contain `index.html`. Directories are uploaded automatically; do not ask the user to create a ZIP first. Hidden files and `node_modules` are excluded. Markdown is not supported.
