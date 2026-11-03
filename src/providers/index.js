import { DEFAULT_MODELS } from '../core/settings.js';
import { parseLLMJson } from '../core/prompt.js';

async function postJson(url, headers, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

const providers = {
  async gemini({ apiKey, model, system, prompt }) {
    const data = await postJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      { 'x-goog-api-key': apiKey },
      {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, responseMimeType: 'application/json' },
      }
    );
    return data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  },

  async claude({ apiKey, model, system, prompt }) {
    const data = await postJson(
      'https://api.anthropic.com/v1/messages',
      {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      { model, max_tokens: 2000, temperature: 0.3, system, messages: [{ role: 'user', content: prompt }] }
    );
    return data.content?.map((b) => b.text || '').join('') || '';
  },

  async openai({ apiKey, model, system, prompt }) {
    const data = await postJson(
      'https://api.openai.com/v1/chat/completions',
      { Authorization: `Bearer ${apiKey}` },
      {
        model,
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
      }
    );
    return data.choices?.[0]?.message?.content || '';
  },
};

export async function runLLM(settings, system, prompt) {
  const fn = providers[settings.provider];
  if (!fn) throw new Error(`Unknown provider: ${settings.provider}`);
  const model = settings.model || DEFAULT_MODELS[settings.provider];
  const text = await fn({ ...settings, model, system, prompt });
  return parseLLMJson(text);
}
