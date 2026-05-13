import React, { useState, useEffect } from "react";

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<any>({
    aiProvider: "gemini",
    aiModel: "gemini-3.1-pro-preview",
    aiEndpoint: "http://localhost:11434",
    invoicePrefix: "INV-",
    autoIncrement: true,
    stripePublishableKey: "",
    stripeSecretKey: "",
    paypalClientId: "",
  });

  useEffect(() => {
    try {
      const stored = localStorage.getItem("appSettings");
      if (stored) {
        setSettings(JSON.parse(stored));
      }
    } catch {
      //
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem("appSettings", JSON.stringify(settings));
    alert("Settings saved successfully.");
  };

  return (
    <div className="p-8 max-w-4xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-800">Global Settings</h2>
        <p className="text-slate-500 mt-2">Configure application preferences, intelligence engine settings, and payment integrations.</p>
      </div>

      <div className="space-y-6">
        {/* Intelligence Engine */}
        <div className="bg-white p-6 justify-between items-start rounded-xl shadow-sm border border-slate-200">
          <div className="mb-4">
            <h3 className="font-bold text-lg text-indigo-900 flex items-center gap-2">
              <i className="fas fa-brain text-indigo-500"></i> Intelligence Engine
            </h3>
            <p className="text-sm text-slate-500">Configure your local or cloud LLM provider for the AI accountant and invoice magic.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">AI Provider</label>
              <select
                className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-colors"
                value={settings.aiProvider || "gemini"}
                onChange={(e) => {
                  const newProvider = e.target.value;
                  setSettings({ 
                    ...settings, 
                    aiProvider: newProvider,
                    aiModel: newProvider === "ollama" ? (settings.aiProvider === "ollama" ? settings.aiModel : "llama3") : (settings.aiProvider === "gemini" ? settings.aiModel : "gemini-3.1-pro-preview")
                  });
                }}
              >
                <option value="gemini">Google Gemini (Cloud)</option>
                <option value="ollama">Ollama (Local LLM)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Model Name</label>
              <input
                type="text"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-colors"
                placeholder="e.g. llama3, gemini-3.1-pro-preview"
                value={settings.aiModel || "gemini-3.1-pro-preview"}
                onChange={(e) => setSettings({ ...settings, aiModel: e.target.value })}
              />
            </div>
          </div>
          {settings.aiProvider === "ollama" && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Ollama Endpoint URL</label>
              <input
                type="text"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-colors"
                placeholder="http://localhost:11434"
                value={settings.aiEndpoint || "http://localhost:11434"}
                onChange={(e) => setSettings({ ...settings, aiEndpoint: e.target.value })}
              />
              <p className="text-xs text-slate-500 mt-1">Ensure Ollama is running (`ollama serve`) and configured to accept CORS requests.</p>
            </div>
          )}
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
                value={settings.invoicePrefix || "INV-"}
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
                value={settings.stripePublishableKey || ""}
                onChange={(e) => setSettings({ ...settings, stripePublishableKey: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Stripe Secret Key</label>
              <input
                type="password"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 transition-colors"
                placeholder="sk_test_..."
                value={settings.stripeSecretKey || ""}
                onChange={(e) => setSettings({ ...settings, stripeSecretKey: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">PayPal Client ID</label>
              <input
                type="password"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 transition-colors"
                placeholder="Enter PayPal Client ID"
                value={settings.paypalClientId || ""}
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
