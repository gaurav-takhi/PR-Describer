<p align="center">
  <img src="icons/icon128.png" alt="PR Describer" width="96" height="96">
</p>

<h1 align="center">PR Describer</h1>

<p align="center">
  Auto-fill pull request titles and descriptions from your branch's commits on <b>Azure DevOps</b> and <b>GitHub</b>.
</p>

PR Describer is a Chrome/Edge extension. Open the "create pull request" page, click **Generate PR description**, review the filled-in title and description, edit if needed, and submit. It works with no setup using a built-in algorithm. You can also add your own Gemini, Claude or OpenAI key for richer summaries. It runs entirely in your browser: no server, no shared key, and with AI off no code leaves your machine.

## Features

- **Azure DevOps and GitHub** support from one extension.
- **Rule-based by default.** Groups commits by type (feat, fix, refactor...), lists changed folders, picks up ticket IDs such as `PROJ-123`, and trims itself to fit Azure's 4000-character limit. No key needed.
- **Optional AI.** Bring your own Gemini, Claude or OpenAI key for summaries that explain what changed and why. If the AI call fails, you still get the rule-based draft.
- **Customizable.** Add a PR template, extra instructions for the AI, and file patterns to ignore.
- **Private.** Keys are stored in your browser only and sent only to the provider you choose.

## Set up locally

You need Google Chrome or Microsoft Edge. There is no build step and nothing to install with npm.

1. **Get the code**

   ```bash
   git clone git@github.com:gaurav-takhi/PR-Describer.git
   cd PR-Describer
   ```

2. **Load the extension**
   - Open `chrome://extensions` (or `edge://extensions`).
   - Turn on **Developer mode** (top right).
   - Click **Load unpacked** and select the `PR-Describer` folder.
   - Pin the extension from the puzzle-piece menu if you want its icon in the toolbar.

3. **Configure (optional)**
   - Click the extension icon to open settings.
   - Leave **Rules only** selected to use it with no key, or pick a provider and paste your key:

     | Provider | Get a key | Default model |
     |---|---|---|
     | Gemini | https://aistudio.google.com/apikey | `gemini-3.8-flash` |
     | Claude | https://console.anthropic.com/settings/keys | `claude-sonnet-5-5` |
     | OpenAI | https://platform.openai.com/api-keys | `gpt-4o-mini` |

   - Leave **Model** blank to use the default. If a provider retires a model, type the new name there.
   - Click **Save settings**.

4. **After changing the code**, click the reload icon on the extension card in `chrome://extensions`, then refresh the PR page. A page that was open during the reload keeps an old copy of the script until you refresh it.

## Usage

**Azure DevOps**

1. Push your branch and click **Create a pull request**. The URL looks like `https://dev.azure.com/<org>/<project>/_git/<repo>/pullrequestcreate?sourceRef=...&targetRef=...`.
2. Click **Generate PR description** (bottom right).
3. Review the title and description, then click **Create**.

You must be logged in to Azure DevOps in the same browser. The extension reuses that session.

**GitHub**

1. Open the compare page, `https://github.com/<owner>/<repo>/compare/<base>...<branch>`.
2. Click **Create pull request** so the title and description form appears.
3. Click **Generate PR description**.

This works without a token on public repositories. Private repositories are not supported yet.

## How it works

```
 PR create page ── content.js ──► background.js ──► Azure DevOps / GitHub API
                       ▲               │                (commits + changed files)
                       │               ▼
                  fills title     generateDraft()  ── rule-based draft (always)
                  + description        │
                                       ▼
                              provider set and key saved?
                                 no  → use the draft
                                 yes → LLM rewrites the draft → use it (draft on error)
```

- `content.js` detects the create-PR page, adds the button, reads the source and target branches from the URL and fills the form.
- `background.js` fetches commits and files, builds the draft, optionally calls your provider and enforces the length limit.
- Adapters return commits and changed files per platform. Providers wrap each AI service behind one function, so adding another platform or model is one new file.

## What is sent where

| Mode | Azure DevOps | GitHub |
|---|---|---|
| Rules only | Nothing leaves your browser except calls to Azure DevOps | Nothing leaves your browser except calls to GitHub |
| AI, diff off | Commit messages and file paths go to your AI provider | Commit messages and file paths go to your AI provider |
| AI, diff on | Same as diff off (Azure has no patch endpoint) | Commit messages, file paths and the code diff go to your AI provider |

Files matching the ignore list (lockfiles, build output, snapshots) are removed before anything is sent to the AI.

## Known limitations

- On Azure, AI summaries use commit messages and file names only, because Azure DevOps has no endpoint that returns a unified diff. Clear commit messages give much better results.
- The title and description fields are located heuristically. If Azure or GitHub redesigns the page, update `findFields` in `src/content.js`.
- Private GitHub repositories are not supported yet, since the extension has no token setting.
- Very large branches produce a list with "...and N more" lines in rules mode. An AI provider handles them better.

## Project structure

```
manifest.json        Extension manifest (Manifest V3)
icons/               Toolbar and store icons
options/             Settings page (HTML, CSS, JS)
src/
  content.js         Button, URL parsing and form filling (runs on the PR page)
  background.js      Orchestration (service worker)
  adapters/          azure.js, github.js: fetch commits and changed files
  core/              generator (rules), diff filtering, prompt, settings
  providers/         Gemini, Claude and OpenAI calls
```

## Troubleshooting

| Message | Cause and fix |
|---|---|
| "Extension was reloaded. Refresh this page" | The extension was reloaded while the tab was open. Refresh the PR page. |
| "No commits found between ..." | The branches have no differences, or the branch names could not be read from the URL. |
| "LLM failed (404 ... model ...)" | The provider retired the model. Put the replacement name in **Model** in settings. |
| "API key is saved but Provider is None" | Pick a provider in settings and save again. |
| Form not filled on GitHub | Click **Create pull request** first so the form is on the page. |
| Azure auth error | Log in to Azure DevOps in this browser and try again. |
