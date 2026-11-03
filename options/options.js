import { DEFAULTS, DEFAULT_MODELS, getSettings } from '../src/core/settings.js';

const $ = (id) => document.getElementById(id);
const keys = Object.keys(DEFAULTS).filter((k) => k !== 'provider' && $(k)); // only fields present on the page
const radios = [...document.querySelectorAll('input[name="provider"]')];

const KEY_LINKS = {
  gemini: 'https://aistudio.google.com/apikey',
  claude: 'https://console.anthropic.com/settings/keys',
  openai: 'https://platform.openai.com/api-keys',
};
const NAMES = { none: 'Rule-based', gemini: 'Gemini', claude: 'Claude', openai: 'OpenAI' };

const provider = () => radios.find((r) => r.checked)?.value || 'none';

function refresh() {
  const p = provider();
  $('aiFields').classList.toggle('hidden', p === 'none');
  if (p !== 'none') {
    $('keyLink').href = KEY_LINKS[p];
    $('model').placeholder = DEFAULT_MODELS[p];
  }
  const chip = $('modeChip');
  chip.textContent = p === 'none' ? 'Rule-based · no AI' : `${NAMES[p]} · ${$('model').value.trim() || DEFAULT_MODELS[p]}`;
}

async function load() {
  const s = await getSettings();
  const r = radios.find((x) => x.value === s.provider) || radios[0];
  r.checked = true;
  for (const k of keys) {
    const el = $(k);
    if (el.type === 'checkbox') el.checked = s[k];
    else el.value = s[k];
  }
  refresh();
}

function setStatus(msg, isError) {
  const s = $('status');
  s.textContent = msg;
  s.classList.toggle('error', !!isError);
  clearTimeout(setStatus.t);
  setStatus.t = setTimeout(() => (s.textContent = ''), 4000);
}

async function save() {
  const out = { provider: provider() };
  for (const k of keys) {
    const el = $(k);
    out[k] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value.trim();
  }
  let note = 'Saved.';
  if (out.provider === 'none' && out.apiKey) {
    const guess = out.apiKey.startsWith('AIza') ? 'gemini' : out.apiKey.startsWith('sk-ant-') ? 'claude' : out.apiKey.startsWith('sk-') ? 'openai' : '';
    if (!guess) return setStatus('Choose a provider for this API key.', true);
    out.provider = guess;
    radios.find((r) => r.value === guess).checked = true;
    note = `Saved. Provider set to ${NAMES[guess]} based on your key.`;
  }
  if (out.provider !== 'none' && !out.apiKey) return setStatus('Add an API key, or choose "Rules only".', true);
  await chrome.storage.local.set(out);
  refresh();
  setStatus(note);
}

radios.forEach((r) => r.addEventListener('change', refresh));
$('model').addEventListener('input', refresh);
$('save').addEventListener('click', save);
document.querySelectorAll('[data-reveal]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const input = $(btn.dataset.reveal);
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.textContent = show ? 'Hide' : 'Show';
  });
});
load();
