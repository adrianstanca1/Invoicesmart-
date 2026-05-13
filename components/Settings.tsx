import React, { useState, useEffect } from "react";
import { checkLLMConnection } from "../services/aiService";

interface AppSettings {
  aiModel: string;
  aiEndpoint: string;
  aiApiKey: string;
  invoicePrefix: string;
  autoIncrement: boolean;
  stripePublishableKey: string;
  stripeSecretKey: string;
  paypalClientId: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  aiModel: "llama3.1",
  aiEndpoint: "http://localhost:11434",
  aiApiKey: "",
  invoicePrefix: "INV-",
  autoIncrement: true,
  stripePublishableKey: "",
  stripeSecretKey: "",
  paypalClientId: "",
};

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("appSettings");
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }
    } catch {
      //
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem("appSettings", JSON.stringify(settings));
    alert("Settings saved successfully.");
  };

  const handleTest = async () => {
    localStorage.setItem("appSettings", JSON.stringify(settings));
    setTesting(true);
    setTestResult(null);
    const result = await checkLLMConnection();
    setTestResult(result);
    setTesting(false);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-800">Global Settings</h2>
        <p className="text-slate-500 mt-2">Configure application preferences, local intelligence engine, and payment integrations.</p>
      </div>

      <div className="space-y-6">
        {/* Intelligence Engine */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="mb-4">
            <h3 className="font-bold text-lg text-indigo-900 flex items-center gap-2">
              <i className="fas fa-brain text-indigo-500"></i> Local Intelligence Engine
            </h3>
            <p className="text-sm text-slate-500">
              The AI accountant and invoice magic run entirely against your local LLM server. Compatible with Ollama and any OpenAI-compatible endpoint (LM Studio, llama.cpp server, vLLM, etc.).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Model Name</label>
              <input
                type="text"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-colors"
                placeholder="e.g. llama3.1, mistral, qwen2.5"
                value={settings.aiModel}
                onChange={(e) => setSettings({ ...settings, aiModel: e.target.value })}
              />
              <p className="text-xs text-slate-500 mt-1">Use a vision-capable model (e.g. llava, llama3.2-vision) for receipt/invoice image parsing.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Endpoint URL</label>
              <input
                type="text"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-colors"
                placeholder="http://localhost:11434"
                value={settings.aiEndpoint}
                onChange={(e) => setSettings({ ...settings, aiEndpoint: e.target.value })}
              />
              <p className="text-xs text-slate-500 mt-1">
                Default Ollama: <code>http://localhost:11434</code>. OpenAI-compatible servers are auto-detected when the URL contains <code>/v1</code>.
              </p>
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">API Key (optional)</label>
            <input
              type="password"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-colors"
              placeholder="Only required for protected endpoints"
              value={settings.aiApiKey}
              onChange={(e) => setSettings({ ...settings, aiApiKey: e.target.value })}
            />
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleTest}
              disabled={testing}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold py-2 px-4 rounded-lg shadow transition-colors"
            >
              {testing ? "Testing..." : "Test connection"}
            </button>
            {testResult && (
              <span className={`text-sm ${testResult.ok ? "text-emerald-600" : "text-rose-600"}`}>
                {testResult.ok ? "✓" : "✗"} {testResult.message}
              </span>
            )}
          </div>
          <details className="mt-4 text-xs text-slate-600">
            <summary className="cursor-pointer font-medium text-slate-700">Connecting from a hosted deployment</summary>
            <div className="mt-2 space-y-1">
              <p>The app is served from your browser, so it talks to your LLM directly. For Ollama, enable CORS on the host machine before running the server:</p>
              <pre className="bg-slate-100 p-2 rounded">OLLAMA_ORIGINS="*" ollama serve</pre>
              <p>For LM Studio or other OpenAI-compatible servers, expose the <code>/v1</code> endpoint and allow CORS for the deployed origin.</p>
            </div>
          </details>
        </div>

        {/* Invoice Generation */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="mb-4">
            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
              <i className="fas fa-file-invoice text-slate-500"></i> Invoice Generation
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Default Invoice Prefix</label>
              <input
                type="text"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 transition-colors"
                placeholder="INV-"
                value={settings.invoicePrefix}
                onChange={(e) => setSettings({ ...settings, invoicePrefix: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2 mt-6">
              <input
                type="checkbox"
                id="autoInc"
                className="w-4 h-4 text-blue-600 rounded"
                checked={settings.autoIncrement !== false}
                onChange={(e) => setSettings({ ...settings, autoIncrement: e.target.checked })}
              />
              <label htmlFor="autoInc" className="text-sm font-medium text-slate-700">Auto-increment Invoice Numbers</label>
            </div>
          </div>
        </div>

        {/* Payment Integrations */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="mb-4">
            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
              <i className="fas fa-credit-card text-emerald-500"></i> Payment Integrations
            </h3>
            <p className="text-sm text-slate-500">Configure your API keys for generating payment links on your invoices.</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Stripe Publishable Key</label>
              <input
                type="text"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 transition-colors"
                placeholder="pk_test_..."
                value={settings.stripePublishableKey}
                onChange={(e) => setSettings({ ...settings, stripePublishableKey: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Stripe Secret Key</label>
              <input
                type="password"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 transition-colors"
                placeholder="sk_test_..."
                value={settings.stripeSecretKey}
                onChange={(e) => setSettings({ ...settings, stripeSecretKey: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">PayPal Client ID</label>
              <input
                type="password"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 transition-colors"
                placeholder="Enter PayPal Client ID"
                value={settings.paypalClientId}
                onChange={(e) => setSettings({ ...settings, paypalClientId: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button
            onClick={handleSave}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg shadow transition-colors"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
