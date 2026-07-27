import {
  Invoice,
  FinancialInsight,
  Transaction,
  Client,
  TaxRule,
  InvoiceAuditResult,
  AIProviderConfig,
} from "../types";

const DEV_ENDPOINT = import.meta.env.PROD ? "/ollama" : "http://localhost:11434";
const DEFAULT_MODEL = "llama3.2-vision:11b";

export const getAIConfig = (): AIProviderConfig => {
  try {
    const settings = JSON.parse(localStorage.getItem("appSettings") || "{}");
    return {
      provider: "local",
      model: settings.aiModel || DEFAULT_MODEL,
      endpoint: settings.aiEndpoint || DEV_ENDPOINT,
      apiKey: settings.aiApiKey || undefined,
    };
  } catch {
    return { provider: "local", model: DEFAULT_MODEL, endpoint: DEV_ENDPOINT };
  }
};

const stripCodeFences = (text: string): string =>
  text.replace(/^\s*```(?:json|JSON)?\s*/m, "").replace(/```\s*$/m, "").trim();

export const extractJson = (raw: string): string => {
  const cleaned = stripCodeFences(raw);
  const firstBrace = cleaned.search(/[{\[]/);
  if (firstBrace === -1) return cleaned;
  const opener = cleaned[firstBrace];
  const closer = opener === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = firstBrace; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === opener) depth++;
    else if (ch === closer) {
      depth--;
      if (depth === 0) return cleaned.slice(firstBrace, i + 1);
    }
  }
  return cleaned.slice(firstBrace);
};

export const safeParseJson = <T>(raw: string): T | null => {
  try {
    return JSON.parse(extractJson(raw)) as T;
  } catch (e) {
    console.warn("Failed to parse JSON from LLM output", e);
    return null;
  }
};

interface InvokeOptions {
  jsonResponse?: boolean;
  imagePayload?: { mimeType: string; data: string };
  systemPrompt?: string;
}

const buildHeaders = (apiKey?: string): Record<string, string> => {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  return headers;
};

export const isOpenAICompatible = (endpoint: string): boolean =>
  /\/v1\/?$/.test(endpoint) || /\/v1\//.test(endpoint) || endpoint.includes("/openai");

const callOpenAICompatible = async (
  config: AIProviderConfig,
  prompt: string,
  opts: InvokeOptions,
): Promise<string | null> => {
  const base = (config.endpoint || DEV_ENDPOINT).replace(/\/+$/, "");
  const url = base.endsWith("/v1") ? `${base}/chat/completions` : `${base}/v1/chat/completions`;

  const userContent: any[] = [{ type: "text", text: prompt }];
  if (opts.imagePayload) {
    userContent.unshift({
      type: "image_url",
      image_url: { url: `data:${opts.imagePayload.mimeType};base64,${opts.imagePayload.data}` },
    });
  }

  const body: any = {
    model: config.model || DEFAULT_MODEL,
    messages: [
      ...(opts.systemPrompt ? [{ role: "system", content: opts.systemPrompt }] : []),
      { role: "user", content: opts.imagePayload ? userContent : prompt },
    ],
    temperature: opts.jsonResponse ? 0.1 : 0.5,
    stream: false,
  };
  if (opts.jsonResponse) body.response_format = { type: "json_object" };

  const response = await fetch(url, {
    method: "POST",
    headers: buildHeaders(config.apiKey),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    console.error("Local LLM (OpenAI-compatible) error", response.status, await response.text());
    return null;
  }
  const data = await response.json();
  return data?.choices?.[0]?.message?.content ?? null;
};

const callOllama = async (
  config: AIProviderConfig,
  prompt: string,
  opts: InvokeOptions,
): Promise<string | null> => {
  const base = (config.endpoint || DEV_ENDPOINT).replace(/\/+$/, "");
  const url = `${base}/api/generate`;

  const fullPrompt = opts.systemPrompt ? `${opts.systemPrompt}\n\n${prompt}` : prompt;

  const body: any = {
    model: config.model || DEFAULT_MODEL,
    prompt: fullPrompt,
    stream: false,
    options: { temperature: opts.jsonResponse ? 0.1 : 0.5 },
  };
  if (opts.jsonResponse) body.format = "json";
  if (opts.imagePayload) body.images = [opts.imagePayload.data];

  const response = await fetch(url, {
    method: "POST",
    headers: buildHeaders(config.apiKey),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    console.error("Local LLM (Ollama) error", response.status, await response.text());
    return null;
  }
  const data = await response.json();
  return data?.response ?? null;
};

const invokeLLM = async (
  prompt: string,
  jsonResponse: boolean = false,
  imagePayload?: { mimeType: string; data: string },
  systemPrompt?: string,
): Promise<string | null> => {
  const config = getAIConfig();
  const opts: InvokeOptions = { jsonResponse, imagePayload, systemPrompt };
  try {
    if (isOpenAICompatible(config.endpoint || "")) {
      return await callOpenAICompatible(config, prompt, opts);
    }
    return await callOllama(config, prompt, opts);
  } catch (e) {
    console.error("Local LLM failed to respond:", e);
    return null;
  }
};

export const checkLLMConnection = async (): Promise<{ ok: boolean; message: string }> => {
  const config = getAIConfig();
  try {
    const base = (config.endpoint || DEV_ENDPOINT).replace(/\/+$/, "");
    if (isOpenAICompatible(base)) {
      const tagsUrl = base.endsWith("/v1") ? `${base}/models` : `${base}/v1/models`;
      const res = await fetch(tagsUrl, { headers: buildHeaders(config.apiKey) });
      if (!res.ok) return { ok: false, message: `Endpoint responded ${res.status}` };
      return { ok: true, message: `Connected to ${base} (model: ${config.model})` };
    }
    const res = await fetch(`${base}/api/tags`);
    if (!res.ok) return { ok: false, message: `Endpoint responded ${res.status}` };
    const data = await res.json();
    const names: string[] = (data?.models || []).map((m: any) => m.name);
    const hasModel = names.length === 0 || names.some((n) => n.startsWith(config.model || ""));
    return {
      ok: true,
      message: hasModel
        ? `Connected to Ollama (model: ${config.model})`
        : `Connected, but model "${config.model}" not found. Available: ${names.join(", ") || "none"}`,
    };
  } catch (e: any) {
    return { ok: false, message: `Could not reach ${config.endpoint}: ${e?.message || e}` };
  }
};

export const generateAIChatResponse = async (prompt: string): Promise<string> => {
  const result = await invokeLLM(prompt, false);
  return result || "I couldn't generate a response. Please verify your local LLM is running in Settings.";
};

export const chatWithAccountant = async (
  message: string,
  ledger: Transaction[],
  invoices: Invoice[],
  chatHistory: { role: "user" | "ai"; content: string }[] = [],
): Promise<{
  text: string;
  newTransactions?: Partial<Transaction>[];
  report?: any;
}> => {
  try {
    const simplifiedLedger = ledger
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map((t) => ({
        d: t.date,
        desc: t.description,
        amt: t.amount,
        type: t.type,
        cat: t.category,
      }));
    const simplifiedInvoices = invoices.map((i) => ({
      d: i.date,
      num: i.invoiceNumber,
      client: i.toName,
      tot: i.lineItems.reduce((a, b) => a + b.quantity * b.rate, 0),
      st: i.status,
    }));

    const systemPrompt =
      "You are an expert UK Chartered Accountant (ACCA/ICAEW level). Always return strictly valid JSON, no commentary, no markdown fences.";

    const prompt = `Data Context (All History):
- Ledger: ${JSON.stringify(simplifiedLedger)}
- Invoices: ${JSON.stringify(simplifiedInvoices)}

Conversation History:
${chatHistory.map((m) => `${m.role === "ai" ? "Accountant" : "User"}: ${m.content}`).join("\n")}

User Message: "${message}"

Respond with a JSON object exactly matching this schema:
{
  "text": "Your professional, proactive advice in Markdown formatting.",
  "actionName": "addTransaction" | "generateFinancialReport" | "none",
  "actionArgs": {
     "transactions": [{ "date": "YYYY-MM-DD", "description": "", "amount": 0, "type": "Income|Expense", "category": "" }],
     "period": "Last Month" | "YTD" | "2024"
  }
}

If the user mentions spending or earning money, use 'addTransaction'.
If the user asks for P&L, tax estimates, or financial health, use 'generateFinancialReport'.
Return JSON only.`;

    const responseText = await invokeLLM(prompt, true, undefined, systemPrompt);
    if (!responseText) return { text: "Error connecting to the local LLM. Check Settings." };

    const data = safeParseJson<any>(responseText);
    if (!data) return { text: responseText };

    let newTransactions: Partial<Transaction>[] | undefined;
    let report: any | undefined;
    if (data.actionName === "addTransaction" && data.actionArgs?.transactions) {
      newTransactions = data.actionArgs.transactions;
    }
    if (data.actionName === "generateFinancialReport" && data.actionArgs?.period) {
      report = { period: data.actionArgs.period };
    }
    return {
      text: data.text || "I'm sorry, I couldn't process that request.",
      newTransactions,
      report,
    };
  } catch (error) {
    console.error("Error chatting with accountant:", error);
    return { text: "Error connecting to the local LLM. Check Settings." };
  }
};

export const generateDetailedReport = async (
  ledger: Transaction[],
  period: string,
): Promise<any> => {
  try {
    const systemPrompt =
      "You are an expert UK accountant. Output strictly valid JSON only, no commentary.";
    const prompt = `Generate a detailed JSON financial report for the period: ${period}.

Ledger Data: ${JSON.stringify(ledger)}

Calculate:
1. Total Revenue
2. Cost of Sales (assume 'Materials', 'Labor' categories are CoS)
3. Gross Profit
4. Expenses breakdown by category
5. Net Profit
6. Estimated Corporation Tax (19% of Net Profit for small profits, 25% for large)
7. Estimated VAT Position (assume 20% on Income and Expenses unless obvious otherwise)

Output JSON matching the FinancialReport interface structure.`;

    const responseText = await invokeLLM(prompt, true, undefined, systemPrompt);
    if (!responseText) return null;
    return safeParseJson<any>(responseText) ?? {};
  } catch (e) {
    console.error("Report generation failed", e);
    return null;
  }
};

const INVOICE_SCHEMA_HINT = {
  fromName: "string",
  fromEmail: "string",
  fromAddress: "string",
  toName: "string",
  toEmail: "string",
  toAddress: "string",
  clientVatNumber: "string",
  invoiceNumber: "string",
  date: "YYYY-MM-DD",
  dueDate: "YYYY-MM-DD",
  lineItems: [{ description: "string", quantity: 0, rate: 0, isLabor: false }],
  notes: "string",
  terms: "string",
  currency: "GBP",
  taxRate: 0,
  discountRate: 0,
  reverseCharge: false,
  retentionRate: 0,
  cisRate: 0,
};

export const generateInvoiceFromPrompt = async (
  prompt: string,
  existingInvoice?: Partial<Invoice>,
): Promise<Partial<Invoice> | null> => {
  try {
    const today = new Date();
    const defaultDueDate = new Date();
    defaultDueDate.setDate(defaultDueDate.getDate() + 30);

    const systemPrompt =
      "You produce strictly valid JSON invoices for UK businesses. Output JSON only, no markdown fences.";

    let contents = `Generate a JSON invoice based on this request: "${prompt}".
Populate ALL possible fields including client details (name, email, address, VAT number), line items (description, quantity, rate), and realistic estimates if exact prices aren't given.
If specific dates are not mentioned, use ${today.toISOString().split("T")[0]} for the invoice date and ${defaultDueDate.toISOString().split("T")[0]} for the due date.
Default currency to GBP if not specified.
Provide realistic placeholder names, emails, and addresses for 'from' and 'to' if the user doesn't specify them.

Schema (types are hints):
${JSON.stringify(INVOICE_SCHEMA_HINT)}

Return JSON only.`;

    if (existingInvoice) {
      contents += `\n\nExisting Invoice Data to modify/append to:\n${JSON.stringify(existingInvoice)}`;
    }

    const responseText = await invokeLLM(contents, true, undefined, systemPrompt);
    if (!responseText) return null;
    return safeParseJson<Partial<Invoice>>(responseText);
  } catch (error) {
    console.error("Error generating invoice:", error);
    return null;
  }
};

export const parseReceiptFromImage = async (
  base64Image: string,
): Promise<Partial<Transaction> | null> => {
  try {
    const base64Data = base64Image.split(",")[1] || base64Image;
    const systemPrompt = "You extract receipt data into strict JSON. Output JSON only.";
    const prompt = `Extract receipt data into JSON.
Map 'Merchant' to 'description', 'Total' to 'amount', 'Date' to 'date' (YYYY-MM-DD).
Infer a 'category' based on the merchant (e.g., 'Food', 'Travel', 'Office', 'Materials').
Set 'type' to 'Expense'. Return JSON only.`;

    const responseText = await invokeLLM(prompt, true, {
      mimeType: "image/jpeg",
      data: base64Data,
    }, systemPrompt);
    if (!responseText) return null;
    return safeParseJson<Partial<Transaction>>(responseText);
  } catch (error) {
    console.error("Error parsing receipt:", error);
    return null;
  }
};

export const parseInvoiceFromImage = async (
  base64Image: string,
): Promise<Partial<Invoice> | null> => {
  try {
    const base64Data = base64Image.split(",")[1] || base64Image;
    const systemPrompt =
      "You extract invoice data into strict JSON for UK businesses. Output JSON only.";
    const prompt = `Extract all visible invoice data from this image into JSON.
Identify if this is a construction invoice and check for CIS, Retention, or Reverse Charge indications.
If items look like labor, set isLabor to true. Return JSON only. Schema (types are hints): ${JSON.stringify(INVOICE_SCHEMA_HINT)}`;

    const responseText = await invokeLLM(prompt, true, {
      mimeType: "image/jpeg",
      data: base64Data,
    }, systemPrompt);
    if (!responseText) return null;
    return safeParseJson<Partial<Invoice>>(responseText);
  } catch (error) {
    console.error("Error parsing invoice image:", error);
    return null;
  }
};

export const auditInvoice = async (
  invoice: Invoice,
  taxRules: TaxRule[],
): Promise<InvoiceAuditResult | null> => {
  try {
    const systemPrompt =
      "You are a professional UK accountant providing strictly valid JSON audit results. Output JSON only.";
    const prompt = `Review the following invoice JSON data and provide a detailed audit.
Check for:
1. Missing critical information (HMRC requirements).
2. Correct application of Reverse Charge / CIS if applicable (Construction).
3. Potential tax implications of line items, considering UK tax laws and the selected rules.
4. Specific suggestions for improving line item descriptions for clarity and compliance.

Available Tax Rules: ${JSON.stringify(taxRules)}
Invoice Data: ${JSON.stringify(invoice)}

Respond with JSON exactly matching:
{
  "taxCompliance": ["..."],
  "cisVatImplications": ["..."],
  "lineItemSuggestions": [{ "id": "lineItemId", "issue": "...", "suggestedDescription": "..." }],
  "generalFeedback": ["..."]
}
Return JSON only.`;

    const responseText = await invokeLLM(prompt, true, undefined, systemPrompt);
    if (!responseText) return null;
    return safeParseJson<InvoiceAuditResult>(responseText);
  } catch (error) {
    console.error("Error auditing invoice:", error);
    return null;
  }
};

export const generateFinancialInsights = async (
  invoices: Invoice[],
  clients: Client[],
  taxRules: TaxRule[],
): Promise<FinancialInsight | null> => {
  try {
    const systemPrompt =
      "You are a UK financial analyst. Output strictly valid JSON only, no markdown fences.";
    const prompt = `Analyze these invoices, clients, and tax rules to provide financial insights for a UK business.

Invoices: ${JSON.stringify(
      invoices.map((i) => ({
        date: i.date,
        dueDate: i.dueDate,
        total: i.lineItems.reduce((acc, item) => acc + item.quantity * item.rate, 0),
        status: i.status,
        cisDeducted: i.cisRate > 0,
        clientId: i.clientId,
      })),
    )}

Clients: ${JSON.stringify(clients.map((c) => ({ id: c.id, name: c.name, defaultTerms: c.defaultTerms })))}

Tax Rules: ${JSON.stringify(taxRules.map((t) => ({ name: t.name, rate: t.rate })))}

Respond with JSON containing:
1. "summary": Brief summary of financial health and cash flow.
2. "recommendations": Array of { "type": "overdue"|"optimization"|"general"|"tax", "title": "...", "description": "...", "actionableStep": "..." }.
3. "riskAssessment": Brief risk assessment.
Return JSON only.`;

    const responseText = await invokeLLM(prompt, true, undefined, systemPrompt);
    if (!responseText) return null;
    return safeParseJson<FinancialInsight>(responseText);
  } catch (error) {
    console.error("Error generating insights:", error);
    return null;
  }
};
