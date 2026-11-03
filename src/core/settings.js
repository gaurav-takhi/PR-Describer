export const DEFAULTS = {
  provider: 'none', // none | gemini | claude | openai
  model: '',
  apiKey: '',
  githubPat: '',
  azurePat: '',
  template: '',
  customInstructions: '',
  includeDiff: true,
  ignore: '*.lock\npackage-lock.json\nyarn.lock\npnpm-lock.yaml\n*.min.js\n*.map\ndist/*\nbuild/*\n*.snap',
  maxDiffChars: 20000,
};

export const DEFAULT_MODELS = {
  gemini: 'gemini-3.8-flash',
  claude: 'claude-sonnet-5-5',
  openai: 'gpt-4o-mini',
};

export async function getSettings() {
  const stored = await chrome.storage.local.get(null);
  return { ...DEFAULTS, ...stored };
}
