import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import {
  Invoice,
  FinancialInsight,
  Transaction,
  Client,
  TaxRule,
  InvoiceAuditResult,
  AIProviderConfig,
} from "../types";

export const getAIConfig = (): AIProviderConfig => {
  try {
    const settings = JSON.parse(localStorage.getItem("appSettings") || "{}");
    return {
      provider: settings.aiProvider || "gemini",
      model: settings.aiModel || "gemini-3.1-pro-preview",
      endpoint: settings.aiEndpoint || "http://localhost:11434",
    };
  } catch {
    return { provider: "gemini", model: "gemini-3.1-pro-preview" };
  }
};

const invokeLLM = async (
  prompt: string,
  jsonResponse: boolean = false,
  imagePayload?: { mimeType: string; data: string },
): Promise<string | null> => {
  const config = getAIConfig();

  if (config.provider === "ollama") {
    const url = `${config.endpoint}/api/generate`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.model || "llama3",
          prompt: prompt,
          format: jsonResponse ? "json" : undefined,
          images: imagePayload ? [imagePayload.data] : undefined,
          stream: false,
        }),
      });
      const data = await response.json();
      return data.response;
    } catch (e) {
      console.error("Local LLM (Ollama) failed to respond:", e);
      return null;
    }
  } else {
    // defaults to gemini
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const contents: any = [prompt];
    if (imagePayload) {
      contents.unshift({
        inlineData: {
          mimeType: imagePayload.mimeType,
          data: imagePayload.data,
        },
      });
    }
    const response = await ai.models.generateContent({
      model: config.model || "gemini-3.1-pro-preview",
      contents: contents,
      config: {
        responseMimeType: jsonResponse ? "application/json" : "text/plain",
      },
    });
    return response.text;
  }
};

export const generateAIChatResponse = async (prompt: string): Promise<string> => {
  const result = await invokeLLM(prompt, false);
  return result || "I couldn't generate a response.";
};

export const chatWithAccountant = async (
  message: string,
  ledger: Transaction[],
  invoices: Invoice[],
): Promise<{
  text: string;
  newTransactions?: Partial<Transaction>[];
  report?: any;
}> => {
  try {
    // Optimize data payload to save tokens
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

    const prompt = `You are an expert UK Chartered Accountant (ACCA/ICAEW level). 
      Your goal is to help the user manage their business finances, ensure compliance, and optimize tax.
      
      Data Context (All History):
      - Ledger: ${JSON.stringify(simplifiedLedger)}
      - Invoices: ${JSON.stringify(simplifiedInvoices)}
      
      User Message: "${message}"
      
      You must respond with a JSON object exactly matching this schema:
      {
        "text": "Your professional, proactive advice in Markdown formatting.",
        "actionName": "addTransaction" | "generateFinancialReport" | "none",
        "actionArgs": { 
           // if addTransaction
           "transactions": [{ "date": "YYYY-MM-DD", "description": "", "amount": 0, "type": "Income|Expense", "category": "" }],
           // if generateFinancialReport
           "period": "Last Month" | "YTD" | "2024"
        }
      }
      
      If the user mentions spending or earning money, use 'addTransaction'.
      If the user asks for P&L, tax estimates, or financial health, use 'generateFinancialReport'.
      Only return valid JSON. Do not wrap in markdown \`\`\` blocks if possible, or if you do, ensure it parses as JSON.`;

    const responseText = await invokeLLM(prompt, true);

    if (!responseText) {
      return { text: "Error connecting to the accounting agent." };
    }

    // Clean up potential markdown formatting around JSON
    const cleanJsonString = responseText
      .replace(/```json\n?|\n?```/g, "")
      .trim();
    const data = JSON.parse(cleanJsonString);

    let newTransactions: Partial<Transaction>[] | undefined;
    let report: any | undefined;

    if (data.actionName === "addTransaction" && data.actionArgs?.transactions) {
      newTransactions = data.actionArgs.transactions;
    }
    if (
      data.actionName === "generateFinancialReport" &&
      data.actionArgs?.period
    ) {
      report = { period: data.actionArgs.period };
    }

    return {
      text: data.text || "I'm sorry, I couldn't process that request.",
      newTransactions,
      report,
    };
  } catch (error) {
    console.error("Error chatting with accountant:", error);
    return { text: "Error connecting to the accounting agent." };
  }
};

export const generateDetailedReport = async (
  ledger: Transaction[],
  period: string,
): Promise<any> => {
  try {
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
      
      Output JSON matching the FinancialReport interface structure. Do not wrap in markdown \`\`\` blocks if possible.`;

    const responseText = await invokeLLM(prompt, true);
    if (!responseText) return null;

    const cleanJsonString = responseText
      .replace(/```json\n?|\n?```/g, "")
      .trim();
    return JSON.parse(cleanJsonString || "{}");
  } catch (e) {
    console.error("Report generation failed", e);
    return null;
  }
};

const INVOICE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    fromName: { type: Type.STRING },
    fromEmail: { type: Type.STRING },
    fromAddress: { type: Type.STRING },
    toName: { type: Type.STRING },
    toEmail: { type: Type.STRING },
    toAddress: { type: Type.STRING },
    clientVatNumber: { type: Type.STRING },
    invoiceNumber: { type: Type.STRING },
    date: { type: Type.STRING },
    dueDate: { type: Type.STRING },
    lineItems: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING },
          quantity: { type: Type.NUMBER },
          rate: { type: Type.NUMBER },
          isLabor: { type: Type.BOOLEAN },
        },
      },
    },
    notes: { type: Type.STRING },
    terms: { type: Type.STRING },
    currency: { type: Type.STRING },
    taxRate: { type: Type.NUMBER },
    discountRate: { type: Type.NUMBER },
    reverseCharge: { type: Type.BOOLEAN },
    retentionRate: { type: Type.NUMBER },
    cisRate: { type: Type.NUMBER },
  },
};

export const generateInvoiceFromPrompt = async (
  prompt: string,
  existingInvoice?: Partial<Invoice>,
): Promise<Partial<Invoice> | null> => {
  try {
    const today = new Date();
    const defaultDueDate = new Date();
    defaultDueDate.setDate(defaultDueDate.getDate() + 30);

    let contents = `Generate a JSON invoice structure based on this request: "${prompt}". 
      Populate ALL possible fields including client details (name, email, address, client VAT number), line items (with description, quantity, and rate), and realistic estimates if exact prices aren't given.
      If specific dates are not mentioned, use ${today.toISOString().split("T")[0]} for the invoice date and ${defaultDueDate.toISOString().split("T")[0]} for the due date.
      Ensure the output matches the JSON schema provided below.
      For UK context, default currency to GBP if not specified.
      Provide realistic placeholder names, emails, and addresses for 'from' and 'to' if the user doesn't specify them.
      
      Schema:
      ${JSON.stringify(INVOICE_SCHEMA)}
      
      Only output valid JSON matching the format. Do not wrap in markdown \`\`\` blocks.`;

    if (existingInvoice) {
      contents += `\n\nExisting Invoice Data to modify/append to:\n${JSON.stringify(existingInvoice)}`;
    }

    const responseText = await invokeLLM(contents, true);
    if (!responseText) return null;
    const cleanJsonString = responseText
      .replace(/```json\n?|\n?```/g, "")
      .trim();
    return JSON.parse(cleanJsonString) as Partial<Invoice>;
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
    const prompt = `Extract receipt data into JSON. 
            Map 'Merchant' to 'description', 'Total' to 'amount', 'Date' to 'date' (YYYY-MM-DD).
            Infer a 'category' based on the merchant (e.g., 'Food', 'Travel', 'Office', 'Materials').
            Set 'type' to 'Expense'. Only output valid JSON. Do not wrap in markdown.`;

    const responseText = await invokeLLM(prompt, true, {
      mimeType: "image/jpeg",
      data: base64Data,
    });
    if (!responseText) return null;
    const cleanJsonString = responseText
      .replace(/```json\n?|\n?```/g, "")
      .trim();
    return JSON.parse(cleanJsonString) as Partial<Transaction>;
  } catch (error) {
    console.error("Error parsing receipt:", error);
    return null;
  }
};

export const parseInvoiceFromImage = async (
  base64Image: string,
): Promise<Partial<Invoice> | null> => {
  try {
    // Strip the data:image/Prefix if present
    const base64Data = base64Image.split(",")[1] || base64Image;
    const prompt = `Extract all visible invoice data from this image into the specified JSON format. 
            Identify if this is a construction invoice and check for CIS, Retention, or Reverse Charge indications.
            If items look like labor, set isLabor to true. Only output valid JSON. Do not wrap in markdown. Schema: ${JSON.stringify(INVOICE_SCHEMA)}`;

    const responseText = await invokeLLM(prompt, true, {
      mimeType: "image/jpeg",
      data: base64Data,
    });
    if (!responseText) return null;
    const cleanJsonString = responseText
      .replace(/```json\n?|\n?```/g, "")
      .trim();
    return JSON.parse(cleanJsonString) as Partial<Invoice>;
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
    const prompt = `Act as a professional UK accountant. Review the following invoice JSON data and provide a detailed, professional audit.
      Check for:
      1. Missing critical information (HMRC requirements).
      2. Correct application of Reverse Charge / CIS if applicable (Construction).
      3. Potential tax implications of the line items, especially considering UK tax laws and the selected tax rules.
      4. Specific suggestions for improving line item descriptions for clarity and compliance.
      
      Available Tax Rules: ${JSON.stringify(taxRules)}
      Invoice Data: ${JSON.stringify(invoice)}
      
      Provide a JSON response with the following properties:
      - taxCompliance: Array of strings detailing HMRC requirements missing or met, and potential calculation errors.
      - cisVatImplications: Array of strings detailing implications of VAT / Reverse Charge / CIS, depending on the line items.
      - lineItemSuggestions: Array of objects with 'id' (the line item id), 'issue' (what is wrong/unclear), and 'suggestedDescription' (a better description).
      - generalFeedback: Array of strings on overall professionalism, terms, and general advice.
      
      Only output valid JSON matching the format. Do not wrap in markdown \`\`\` blocks.`;

    const responseText = await invokeLLM(prompt, true);
    if (!responseText) return null;

    try {
      const cleanJsonString = responseText
        .replace(/```json\n?|\n?```/g, "")
        .trim();
      return JSON.parse(cleanJsonString) as InvoiceAuditResult;
    } catch {
      return null;
    }
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
    const prompt = `Analyze these invoices, clients, and tax rules to provide financial insights for a UK business.
      
      Invoices: ${JSON.stringify(
        invoices.map((i) => ({
          date: i.date,
          dueDate: i.dueDate,
          total: i.lineItems.reduce(
            (acc, item) => acc + item.quantity * item.rate,
            0,
          ),
          status: i.status,
          cisDeducted: i.cisRate > 0,
          clientId: i.clientId,
        })),
      )}
      
      Clients: ${JSON.stringify(
        clients.map((c) => ({
          id: c.id,
          name: c.name,
          defaultTerms: c.defaultTerms,
        })),
      )}

      Tax Rules: ${JSON.stringify(
        taxRules.map((t) => ({
          name: t.name,
          rate: t.rate,
        })),
      )}
      
      Provide a JSON response with:
      1. summary: A brief summary of financial health and cash flow.
      2. recommendations: A list of actionable recommendations. You MUST include suggestions regarding clients with overdue ("Overdue") payments (identify them by name if possible), and identify invoice patterns that could be optimized. Mention CIS/VAT if relevant.
      3. riskAssessment: A brief risk assessment based on overdue concentration and tax compliance.
      
      Only output valid JSON matching the format. Do not wrap in markdown \`\`\` blocks.`;

    const responseText = await invokeLLM(prompt, true);
    if (!responseText) return null;

    const cleanJsonString = responseText
      .replace(/```json\n?|\n?```/g, "")
      .trim();
    return JSON.parse(cleanJsonString) as FinancialInsight;
  } catch (error) {
    console.error("Error generating insights:", error);
    return null;
  }
};
