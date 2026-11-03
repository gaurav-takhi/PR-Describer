# PR Describer

Browser extension (Chrome/Edge, Manifest V3) that fills in the PR title and description from your branch's commits on **Azure DevOps** and **GitHub**.

- Default: rule-based generator. No key, no network beyond Azure/GitHub.
- Optional: bring your own LLM key (Gemini, Claude, or OpenAI). Stored locally, sent only to that provider.

## Install (dev)
1. `chrome://extensions` → enable Developer mode → Load unpacked → select this folder.
2. Click the extension icon to open settings.

## Use
- **Azure:** open the "Create a pull request" page (`.../_git/<repo>/pullrequestcreate?sourceRef=...&targetRef=...`). Click **✨ Generate PR description** (bottom right).
- **GitHub:** open `/compare/base...head`, click "Create pull request" so the form shows, then click the button.

## Known limitations (v0.1)
- Azure has no unified-patch endpoint, so the AI gets commits + file list, not code diff. (GitHub sends the diff.)
- Azure/GitHub field selectors are heuristic and may need tweaks if their DOM changes (`findFields` in `src/content.js`).
- Azure `commitsbatch` semantics (commits in source not in target) should be verified on your org.
- No icons yet.

## Layout
```
src/core/        generator (rules), diff filtering, prompt, settings
src/providers/   gemini / claude / openai
src/adapters/    azure.js, github.js (fetch commits + files)
src/background.js  orchestration   src/content.js  button + form fill
options/         settings page
```
