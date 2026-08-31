---
name: yezhou-share
description: Publish a single HTML file to 页舟 or update an existing 页舟 project while preserving its share URL. Use when the user asks an agent to publish, deploy, share, or republish HTML through 页舟.
---

# 页舟分享

Use the bundled script instead of the browser UI:

```bash
scripts/publish.sh <html-file> [title]
```

The API requires `YEZHOU_API_TOKEN`. If it is missing, direct the user to the 页舟 `/agent` page to create one. Never print the token or write it into project files.

On the first publish, the script creates `.yezhou.json` beside the HTML file. On later runs from that project, it updates the recorded site ID, so the public URL stays unchanged. Return the URL printed by the script.

Treat `.yezhou.json` as project metadata and recommend adding it to `.gitignore`. It contains no secret, but publishing it can expose internal project identifiers. Do not replace or delete an existing binding unless the user explicitly asks to publish as a new site.

This first version supports one HTML file up to 1 MB. It does not publish ZIP projects or Markdown.
