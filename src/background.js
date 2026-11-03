import { getSettings } from './core/settings.js';
import { generateDraft } from './core/generator.js';
import { filterFiles, buildDiffText } from './core/diff.js';
import { SYSTEM_PROMPT, buildUserPrompt } from './core/prompt.js';
import { runLLM } from './providers/index.js';
import { fetchAzure } from './adapters/azure.js';
import { fetchGitHub, defaultBranch } from './adapters/github.js';

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

async function generate(ctx) {
  const settings = await getSettings();

  if (ctx.platform === 'github' && !ctx.targetBranch) {
    ctx.targetBranch = await defaultBranch(ctx.owner, ctx.repo, settings);
  }

  const data = ctx.platform === 'azure' ? await fetchAzure(ctx, settings) : await fetchGitHub(ctx, settings);
  if (!data.commits.length) {
    throw new Error(
      `No commits found between ${ctx.targetBranch} and ${ctx.sourceBranch} (${data.files.length} files changed).`
    );
  }

  const files = filterFiles(data.files, settings.ignore);
  const maxChars = ctx.platform === 'azure' ? 3800 : 60000; // Azure caps descriptions at 4000
  // The draft reports every changed file; ignore patterns only trim what is sent to the LLM.
  const base = { commits: data.commits, files: data.files, sourceBranch: ctx.sourceBranch, targetBranch: ctx.targetBranch };
  const draft = generateDraft({ ...base, maxChars });

  if (settings.provider === 'none' || !settings.apiKey) {
    const warning = settings.apiKey
      ? 'An API key is saved but Provider is "None". Open settings, pick a provider and Save. Used rule-based draft.'
      : undefined;
    return { ...draft, source: 'rules', warning };
  }

  try {
    const diffText = settings.includeDiff ? buildDiffText(files, Number(settings.maxDiffChars) || 20000) : '';
    const prompt = buildUserPrompt({
      ...base,
      files,
      diffText,
      draft,
      template: settings.template,
      customInstructions: settings.customInstructions,
      maxChars,
    });
    const result = await runLLM(settings, SYSTEM_PROMPT, prompt);
    if (result.description.length > maxChars) {
      result.description = result.description.slice(0, maxChars - 20).trimEnd() + '\n...(truncated)';
    }
    return { ...result, source: settings.provider };
  } catch (err) {
    return { ...draft, source: 'rules', warning: `LLM failed (${err.message}). Used rule-based draft.` };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== 'generate') return;
  generate(msg.ctx)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((err) => sendResponse({ ok: false, error: err.message }));
  return true; // async response
});
