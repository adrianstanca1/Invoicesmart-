import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { Invoice, FinancialInsight, Transaction, Client, TaxRule } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const chatWithAccountant = async (
  message: string,
  ledger: Transaction[],
  invoices: Invoice[]
): Promise<{ text: string; newTransactions?: Partial<Transaction>[]; report?: any }> => {
  try {
    const addTransactionFunc: FunctionDeclaration = {
      name: "addTransaction",
      description: "Add one or more new transactions to the ledger based on user input.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          transactions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                date: { type: Type.STRING, description: "YYYY-MM-DD" },
                description: { type: Type.STRING },
                amount: { type: Type.NUMBER },
                type: { type: Type.STRING, description: "'income' or 'expense'" },
                category: { type: Type.STRING },
              },
              required: ["date", "description", "amount", "type", "category"],
            }
          }
        },
        required: ["transactions"],
      },
    };

    const generateReportFunc: FunctionDeclaration = {
      name: "generateFinancialReport",
      description: "Generate a detailed financial report (Profit & Loss, Tax Estimates) based on current data.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          period: { type: Type.STRING, description: "e.g., 'Last Month', 'YTD', '2024'" }
        },
        required: ["period"]
      }
    };

    // Optimize data payload to save tokens
    const simplifiedLedger = ledger.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(t => ({ d: t.date, desc: t.description, amt: t.amount, type: t.type, cat: t.category }));
    const simplifiedInvoices = invoices.map(i => ({ d: i.date, num: i.invoiceNumber, client: i.toName, tot: i.lineItems.reduce((a,b)=>a+b.quantity*b.rate,0), st: i.status }));

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: `You are an expert UK Chartered Accountant (ACCA/ICAEW level). 
      Your goal is to help the user manage their business finances, ensure compliance, and optimize tax.
      
      Data Context (All History):
      - Ledger: ${JSON.stringify(simplifiedLedger)}
      - Invoices: ${JSON.stringify(simplifiedInvoices)}
      
      User Message: "${message}"
      
      Capabilities:
      1. Add transactions: If the user mentions spending or earning money, use 'addTransaction'.
      2. Reporting: If the user asks for P&L, tax estimates, or financial health, use 'generateFinancialReport'.
      3. Advice: Provide professional advice on VAT, Corporation Tax, and allowable expenses in the UK.
      
      Tone: Professional, proactive, and helpful. Use Markdown for formatting.`,
      config: {
        tools: [{ functionDeclarations: [addTransactionFunc, generateReportFunc] }],
      }
    });

    let newTransactions: Partial<Transaction>[] | undefined;
    let report: any | undefined;
    
    if (response.functionCalls && response.functionCalls.length > 0) {
      for (const call of response.functionCalls) {
        if (call.name === "addTransaction" && call.args && call.args.transactions) {
          newTransactions = call.args.transactions as Partial<Transaction>[];
        }
        if (call.name === "generateFinancialReport") {
          // In a real app, we might calculate this deterministically, but here we'll ask AI to synthesize it from the data it has
          // or trigger a UI state. For now, let's return a flag to the UI.
          report = { period: call.args.period || 'Current' };
        }
      }
    }

    return { 
      text: response.text || (newTransactions ? "I've updated your ledger." : report ? "I'm generating that report for you now." : "I'm sorry, I couldn't process that request."),
      newTransactions,
      report
    };
  } catch (error) {
    console.error("Error chatting with accountant:", error);
    return { text: "Error connecting to the accounting agent." };
  }
};

export const generateDetailedReport = async (ledger: Transaction[], period: string): Promise<any> => {
  try {
     const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Generate a detailed JSON financial report for the period: ${period}.
      
      Ledger Data: ${JSON.stringify(ledger)}
      
      Calculate:
      1. Total Revenue
      2. Cost of Sales (assume 'Materials', 'Labor' categories are CoS)
      3. Gross Profit
      4. Expenses breakdown by category
      5. Net Profit
      6. Estimated Corporation Tax (19% of Net Profit for small profits, 25% for large)
      7. Estimated VAT Position (assume 20% on Income and Expenses unless obvious otherwise)
      
      Output JSON matching the FinancialReport interface structure.`,
      config: {
        responseMimeType: "application/json",
      }
    });
    return JSON.parse(response.text || '{}');
  } catch (e) {
    console.error("Report generation failed", e);
    return null;
  }
}

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

export const generateInvoiceFromPrompt = async (prompt: string, existingInvoice?: Partial<Invoice>): Promise<Partial<Invoice> | null> => {
  try {
    const today = new Date();
    const defaultDueDate = new Date();
    defaultDueDate.setDate(defaultDueDate.getDate() + 30);
    
    let contents = `Generate a JSON invoice structure based on this request: "${prompt}". 
      Populate ALL possible fields including client details (name, email, address, client VAT number), line items (with description, quantity, and rate), and realistic estimates if exact prices aren't given.
      If specific dates are not mentioned, use ${today.toISOString().split('T')[0]} for the invoice date and ${defaultDueDate.toISOString().split('T')[0]} for the due date.
      Ensure the output matches the JSON schema provided.
      For UK context, default currency to GBP if not specified.
      Provide realistic placeholder names, emails, and addresses for 'from' and 'to' if the user doesn't specify them.`;

    if (existingInvoice) {
      contents += `\n\nExisting Invoice Data to modify/append to:\n${JSON.stringify(existingInvoice)}`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: INVOICE_SCHEMA,
      },
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text) as Partial<Invoice>;
  } catch (error) {
    console.error("Error generating invoice:", error);
    return null;
  }
};

export const parseReceiptFromImage = async (base64Image: string): Promise<Partial<Transaction> | null> => {
  try {
    const base64Data = base64Image.split(',')[1] || base64Image;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Data
            }
          },
          {
            text: `Extract receipt data into JSON. 
            Map 'Merchant' to 'description', 'Total' to 'amount', 'Date' to 'date' (YYYY-MM-DD).
            Infer a 'category' based on the merchant (e.g., 'Food', 'Travel', 'Office', 'Materials').
            Set 'type' to 'Expense'.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            amount: { type: Type.NUMBER },
            date: { type: Type.STRING },
            category: { type: Type.STRING },
            type: { type: Type.STRING }
          }
        },
      },
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text) as Partial<Transaction>;
  } catch (error) {
    console.error("Error parsing receipt:", error);
    return null;
  }
};

export const parseInvoiceFromImage = async (base64Image: string): Promise<Partial<Invoice> | null> => {
  try {
    // Strip the data:image/Prefix if present
    const base64Data = base64Image.split(',')[1] || base64Image;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg', // Assuming jpeg/png, standard for camera
              data: base64Data
            }
          },
          {
            text: `Extract all visible invoice data from this image into the specified JSON format. 
            Identify if this is a construction invoice and check for CIS, Retention, or Reverse Charge indications.
            If items look like labor, set isLabor to true.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: INVOICE_SCHEMA,
      },
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text) as Partial<Invoice>;
  } catch (error) {
    console.error("Error parsing invoice image:", error);
    return null;
  }
};

export const auditInvoice = async (invoice: Invoice, taxRules: TaxRule[]): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Act as a professional UK accountant. Review the following invoice JSON data and provide a brief, professional audit.
      Check for:
      1. Missing critical information (HMRC requirements).
      2. Correct application of Reverse Charge / CIS if applicable (Construction).
      3. Potential tax implications of the line items, especially considering UK tax laws and the selected tax rules.
      4. Professionalism.
      5. Specific suggestions for improving line item descriptions for clarity and compliance.
      6. Flag potential errors in calculations based on UK tax laws.
      
      Available Tax Rules: ${JSON.stringify(taxRules)}
      Invoice Data: ${JSON.stringify(invoice)}
      
      Output plain text, bullet points. Keep it under 250 words.`,
    });
    return response.text || "No insights generated.";
  } catch (error) {
    console.error("Error auditing invoice:", error);
    return "Could not perform audit at this time.";
  }
};

export const generateFinancialInsights = async (invoices: Invoice[], clients: Client[], taxRules: TaxRule[]): Promise<FinancialInsight | null> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview', 
      contents: `Analyze these invoices, clients, and tax rules to provide financial insights for a UK business.
      
      Invoices: ${JSON.stringify(invoices.map(i => ({ 
        date: i.date, 
        total: i.lineItems.reduce((acc, item) => acc + (item.quantity * item.rate), 0), 
        status: i.status,
        cisDeducted: i.cisRate > 0,
        clientId: i.clientId
      })))}
      
      Clients: ${JSON.stringify(clients.map(c => ({
        id: c.id,
        name: c.name,
        defaultTerms: c.defaultTerms
      })))}

      Tax Rules: ${JSON.stringify(taxRules.map(t => ({
        name: t.name,
        rate: t.rate
      })))}
      
      Provide a JSON response with a summary, a list of recommendations to improve cash flow (mention CIS/VAT if relevant, and client-specific insights if some clients are consistently late or have specific terms), and a risk assessment.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
            riskAssessment: { type: Type.STRING }
          }
        }
      }
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text) as FinancialInsight;
  } catch (error) {
    console.error("Error generating insights:", error);
    return null;
  }
};
