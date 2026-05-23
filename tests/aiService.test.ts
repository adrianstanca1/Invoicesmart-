import { describe, it, expect, beforeEach } from 'vitest';
import {
  extractJson,
  safeParseJson,
  isOpenAICompatible,
  getAIConfig,
  checkLLMConnection,
} from '../services/aiService';

describe('extractJson', () => {
  it('returns the input untouched when it is already JSON', () => {
    expect(extractJson('{"a":1}')).toBe('{"a":1}');
    expect(extractJson('[1,2,3]')).toBe('[1,2,3]');
  });

  it('strips ```json fences', () => {
    const raw = '```json\n{"a":1}\n```';
    expect(extractJson(raw)).toBe('{"a":1}');
  });

  it('strips bare ``` fences', () => {
    const raw = '```\n[1,2]\n```';
    expect(extractJson(raw)).toBe('[1,2]');
  });

  it('extracts JSON from chatty preamble', () => {
    const raw = 'Sure! Here is the JSON you asked for:\n{"foo": "bar"}\nLet me know if you need more.';
    expect(extractJson(raw)).toBe('{"foo": "bar"}');
  });

  it('handles nested objects', () => {
    const raw = '{"a": {"b": {"c": 1}}}';
    expect(extractJson(raw)).toBe('{"a": {"b": {"c": 1}}}');
  });

  it('ignores braces inside strings', () => {
    const raw = '{"name": "{not a brace}", "ok": true}';
    expect(extractJson(raw)).toBe('{"name": "{not a brace}", "ok": true}');
  });

  it('handles escaped quotes in strings', () => {
    const raw = '{"description": "She said \\"hi\\""}';
    expect(extractJson(raw)).toBe('{"description": "She said \\"hi\\""}');
  });

  it('returns the partial slice when JSON is truncated', () => {
    // small-model truncation case — should still produce something for safeParseJson to attempt
    const raw = '{"a": 1, "b": [1,2,3';
    const extracted = extractJson(raw);
    expect(extracted.startsWith('{')).toBe(true);
  });

  it('returns input verbatim when no JSON delimiters are present', () => {
    const raw = 'I cannot answer that question.';
    expect(extractJson(raw)).toBe(raw);
  });
});

describe('safeParseJson', () => {
  it('parses well-formed JSON', () => {
    expect(safeParseJson<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
  });

  it('parses JSON that was wrapped in markdown fences', () => {
    expect(safeParseJson<{ ok: boolean }>('```json\n{"ok": true}\n```')).toEqual({ ok: true });
  });

  it('returns null for malformed JSON without throwing', () => {
    expect(safeParseJson<unknown>('not json at all')).toBeNull();
    expect(safeParseJson<unknown>('{not: closed')).toBeNull();
  });

  it('parses JSON embedded in chatty output', () => {
    const raw = 'Here you go: {"x": 42} hope that helps!';
    expect(safeParseJson<{ x: number }>(raw)).toEqual({ x: 42 });
  });
});

describe('isOpenAICompatible', () => {
  it('matches endpoints ending in /v1', () => {
    expect(isOpenAICompatible('https://api.example.com/v1')).toBe(true);
    expect(isOpenAICompatible('http://localhost:1234/v1/')).toBe(true);
  });

  it('matches endpoints containing /v1/', () => {
    expect(isOpenAICompatible('https://api.example.com/v1/chat/completions')).toBe(true);
  });

  it('matches endpoints containing /openai', () => {
    expect(isOpenAICompatible('https://my-llm.host/openai')).toBe(true);
  });

  it('rejects plain Ollama endpoints', () => {
    expect(isOpenAICompatible('http://localhost:11434')).toBe(false);
    expect(isOpenAICompatible('/ollama')).toBe(false);
    expect(isOpenAICompatible('https://invoicesmart.example.com/ollama/')).toBe(false);
  });

  it('rejects empty endpoints', () => {
    expect(isOpenAICompatible('')).toBe(false);
  });
});

describe('getAIConfig', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns local provider with defaults when no settings stored', () => {
    const cfg = getAIConfig();
    expect(cfg.provider).toBe('local');
    expect(cfg.model).toBe('llama3.2-vision:11b');
    // In tests (jsdom + vitest), import.meta.env.PROD is false → dev default
    expect(cfg.endpoint).toBe('http://localhost:11434');
  });

  it('reads model / endpoint / apiKey from appSettings', () => {
    localStorage.setItem(
      'appSettings',
      JSON.stringify({
        aiModel: 'qwen2.5:7b',
        aiEndpoint: 'http://10.0.0.5:11434',
        aiApiKey: 'sk-test',
      }),
    );
    const cfg = getAIConfig();
    expect(cfg.model).toBe('qwen2.5:7b');
    expect(cfg.endpoint).toBe('http://10.0.0.5:11434');
    expect(cfg.apiKey).toBe('sk-test');
  });

  it('returns defaults when appSettings JSON is corrupt', () => {
    localStorage.setItem('appSettings', '{this is not json');
    const cfg = getAIConfig();
    expect(cfg.provider).toBe('local');
    expect(cfg.model).toBe('llama3.2-vision:11b');
  });

  it('does not set apiKey when stored value is empty string', () => {
    localStorage.setItem('appSettings', JSON.stringify({ aiApiKey: '' }));
    expect(getAIConfig().apiKey).toBeUndefined();
  });
});

describe('checkLLMConnection', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('reports failure when fetch throws (endpoint unreachable)', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error('ECONNREFUSED');
    };
    try {
      const res = await checkLLMConnection();
      expect(res.ok).toBe(false);
      expect(res.message).toMatch(/ECONNREFUSED|Could not reach/i);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('reports success and lists matching Ollama model', async () => {
    localStorage.setItem(
      'appSettings',
      JSON.stringify({ aiModel: 'qwen2.5:7b', aiEndpoint: 'http://localhost:11434' }),
    );
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ models: [{ name: 'qwen2.5:7b' }, { name: 'mistral' }] }), {
        status: 200,
      });
    try {
      const res = await checkLLMConnection();
      expect(res.ok).toBe(true);
      expect(res.message).toMatch(/qwen2.5:7b/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('warns when configured model is not in Ollama tag list', async () => {
    localStorage.setItem(
      'appSettings',
      JSON.stringify({ aiModel: 'phi3', aiEndpoint: 'http://localhost:11434' }),
    );
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ models: [{ name: 'mistral' }] }), { status: 200 });
    try {
      const res = await checkLLMConnection();
      expect(res.ok).toBe(true);
      expect(res.message).toMatch(/not found/i);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('reports OpenAI-compatible endpoint success', async () => {
    localStorage.setItem(
      'appSettings',
      JSON.stringify({ aiModel: 'gpt-4', aiEndpoint: 'http://localhost:1234/v1' }),
    );
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({ data: [] }), { status: 200 });
    try {
      const res = await checkLLMConnection();
      expect(res.ok).toBe(true);
      expect(res.message).toMatch(/Connected/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
