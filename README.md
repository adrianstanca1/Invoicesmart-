<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Smart Invoice & Accounting AI (Local LLM)

A privacy-first invoice builder and AI accountant that runs entirely against **your own local LLM**. No third-party cloud AI keys required.

## Run Locally

**Prerequisites:** Node.js 20+, plus a local LLM server.

### 1. Start a local LLM

Either:

- **[Ollama](https://ollama.com)** (recommended)
  ```bash
  ollama pull llama3.1
  OLLAMA_ORIGINS="*" ollama serve
  ```
- Or any **OpenAI-compatible** server (LM Studio, llama.cpp `server`, vLLM, etc.) exposing a `/v1` endpoint. Allow CORS for the app origin.

For receipt / invoice image parsing, use a vision-capable model such as `llama3.2-vision` or `llava`.

### 2. Run the app

```bash
npm install
npm run dev
```

Open <http://localhost:3000>, then go to **Settings → Local Intelligence Engine** and:

- set the **Model Name** (e.g. `llama3.1`)
- set the **Endpoint URL** (default `http://localhost:11434`)
- click **Test connection**

## Build for Production

```bash
npm run build
npm run preview
```

The build is a static SPA — deploy the contents of `dist/` to any static host (Vercel, Netlify, Cloudflare Pages, etc.). The browser will talk to the LLM endpoint configured in Settings, so make sure that endpoint is reachable from the user's machine and has CORS enabled.
