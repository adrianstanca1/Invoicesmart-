import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Invoice,
  LineItem,
  Client,
  TaxRule,
  InvoiceAuditResult,
} from "../types";
import {
  generateInvoiceFromPrompt,
  auditInvoice,
  parseInvoiceFromImage,
} from "../services/geminiService";
import {
  ModernTemplate,
  ClassicTemplate,
  MinimalTemplate,
} from "./InvoiceTemplates";

interface InvoiceBuilderProps {
  onSave: (invoice: Invoice) => void;
  initialInvoice?: Invoice;
  initialInvoiceNumber?: string;
  clients: Client[];
  taxRules: TaxRule[];
}

const EmptyInvoice: Invoice = {
  id: "",
  invoiceNumber: "INV-001",
  date: new Date().toISOString().split("T")[0],
  dueDate: "",
  fromName: "",
  fromEmail: "",
  fromAddress: "",
  toName: "",
  toEmail: "",
  toAddress: "",
  lineItems: [
    {
      id: "1",
      description: "Labor Services",
      quantity: 1,
      rate: 0,
      isLabor: true,
    },
  ],
  notes: "",
  terms: "Payment due within 30 days.",
  currency: "GBP",
  taxRate: 20,
  brandColor: "#2563eb",
  discountRate: 0,
  status: "Draft",
  reverseCharge: false,
  retentionRate: 0,
  cisRate: 0,
  template: "modern",
  paymentGateway: "none",
  paymentLinkId: "",
  showNotes: true,
  showTerms: true,
};

const InvoiceBuilder: React.FC<InvoiceBuilderProps> = ({
  onSave,
  initialInvoice,
  initialInvoiceNumber,
  clients,
  taxRules,
}) => {
  // If initialInvoice is provided, use it. Otherwise, create a new ID for a potential new draft.
  const [invoice, setInvoice] = useState<Invoice>(
    initialInvoice || {
      ...EmptyInvoice,
      invoiceNumber: initialInvoiceNumber || EmptyInvoice.invoiceNumber,
      id: crypto.randomUUID(),
    },
  );
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<InvoiceAuditResult | null>(
    null,
  );
  const [isScanning, setIsScanning] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [apiKeys, setApiKeys] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("appSettings") ||
          localStorage.getItem("paymentApiKeys") ||
          "{}",
      );
    } catch {
      return {};
    }
  });
  const [previewZoom, setPreviewZoom] = useState(1);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">(
    "saved",
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update local state if initialInvoice changes (e.g. loading from history)
  useEffect(() => {
    if (initialInvoice) {
      setInvoice(initialInvoice);
    } else {
      // Reset to empty if no initialInvoice (e.g. clicking "Create" new)
      setInvoice({
        ...EmptyInvoice,
        invoiceNumber: initialInvoiceNumber || EmptyInvoice.invoiceNumber,
        id: crypto.randomUUID(),
      });
    }
  }, [initialInvoice, initialInvoiceNumber]);

  // Auto-save Logic
  useEffect(() => {
    const timer = setTimeout(() => {
      if (saveStatus === "unsaved") {
        setSaveStatus("saving");
        onSave(invoice); // Silent auto-save to parent state/storage
        setTimeout(() => setSaveStatus("saved"), 500);
      }
    }, 2000); // 2 second debounce

    return () => clearTimeout(timer);
  }, [invoice, saveStatus, onSave]);

  const handleSaveApiKeys = (keys: any) => {
    setApiKeys(keys);
    localStorage.setItem("appSettings", JSON.stringify(keys));
    // also persist to paymentApiKeys for backward compatibility if needed, or just keep appSettings
    localStorage.setItem("paymentApiKeys", JSON.stringify(keys));
    setIsSettingsOpen(false);
  };

  const handleChange = (field: keyof Invoice, value: any) => {
    setInvoice((prev) => ({ ...prev, [field]: value }));
    setSaveStatus("unsaved");
  };

  const handleClientSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const clientId = e.target.value;
    if (!clientId) return;
    const client = clients.find((c) => c.id === clientId);
    if (client) {
      setInvoice((prev) => ({
        ...prev,
        clientId: client.id,
        toName: client.name,
        toEmail: client.email,
        toAddress: client.address,
        clientVatNumber: client.vatNumber || "",
        ...(client.defaultTerms && { terms: client.defaultTerms }),
      }));
      setSaveStatus("unsaved");
    }
  };

  const handleLineItemChange = (
    id: string,
    field: keyof LineItem,
    value: any,
  ) => {
    setInvoice((prev) => {
      const updatedItems = prev.lineItems.map((item) => {
        if (item.id !== id) return item;

        const updatedItem = { ...item, [field]: value };

        // If taxRuleId changes, update the taxRate automatically
        if (field === "taxRuleId") {
          const rule = taxRules.find((r) => r.id === value);
          if (rule) {
            updatedItem.taxRate = rule.rate;
          }
        }

        return updatedItem;
      });

      return { ...prev, lineItems: updatedItems };
    });
    setSaveStatus("unsaved");
  };

  const addLineItem = () => {
    setInvoice((prev) => ({
      ...prev,
      lineItems: [
        ...prev.lineItems,
        {
          id: crypto.randomUUID(),
          description: "",
          quantity: 1,
          rate: 0,
          isLabor: false,
        },
      ],
    }));
    setSaveStatus("unsaved");
  };

  const removeLineItem = (id: string) => {
    setInvoice((prev) => ({
      ...prev,
      lineItems: prev.lineItems.filter((item) => item.id !== id),
    }));
    setSaveStatus("unsaved");
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleChange("logo", reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleScanInvoice = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        setIsScanning(true);
        const base64 = reader.result as string;
        const result = await parseInvoiceFromImage(base64);
        if (result) {
          setInvoice((prev) => ({
            ...prev,
            ...result,
            lineItems: result.lineItems
              ? (result.lineItems.map((li) => ({
                  ...li,
                  id: crypto.randomUUID(),
                })) as LineItem[])
              : prev.lineItems,
          }));
          setSaveStatus("unsaved");
        }
        setIsScanning(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAIMagic = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    const generatedData = await generateInvoiceFromPrompt(prompt, invoice);
    if (generatedData) {
      setInvoice((prev) => ({
        ...prev,
        ...generatedData,
        id: prev.id, // Ensure we don't accidentally overwrite the internal ID
        status: prev.status, // Preserve current status
        template: prev.template, // Preserve visual choices
        logo: prev.logo,
        brandColor: prev.brandColor,
        invoiceNumber: generatedData.invoiceNumber || prev.invoiceNumber,
        date: generatedData.date || prev.date,
        dueDate: generatedData.dueDate || prev.dueDate,
        lineItems: generatedData.lineItems
          ? (generatedData.lineItems.map((li) => ({
              ...li,
              id: crypto.randomUUID(),
            })) as LineItem[])
          : prev.lineItems,
      }));
      setSaveStatus("unsaved");
    } else {
      alert(
        "Failed to generate invoice details from prompt. Please try again.",
      );
    }
    setIsGenerating(false);
    setPrompt("");
  };

  const handleAudit = async () => {
    setIsAuditing(true);
    const result = await auditInvoice(invoice, taxRules);
    setAuditResult(result);
    setIsAuditing(false);
  };

  // Calculations memoized to optimize rendering
  const calculations = React.useMemo(() => {
    const subtotal = invoice.lineItems.reduce(
      (acc, item) =>
        acc + (Number(item.quantity) || 0) * (Number(item.rate) || 0),
      0,
    );
    const laborSubtotal = invoice.lineItems
      .filter((i) => i.isLabor === true)
      .reduce(
        (acc, item) =>
          acc + (Number(item.quantity) || 0) * (Number(item.rate) || 0),
        0,
      );

    const taxBreakdown: {
      [key: string]: { rate: number; amount: number; name: string };
    } = {};
    let totalTheoreticalTax = 0;

    invoice.lineItems.forEach((item) => {
      const itemTotal = (Number(item.quantity) || 0) * (Number(item.rate) || 0);
      let rate = invoice.taxRate;
      let name = `VAT (${rate}%)`;

      if (item.taxRuleId) {
        const rule = taxRules.find((r) => r.id === item.taxRuleId);
        if (rule) {
          rate = rule.rate;
          name = rule.name;
        }
      } else if (item.taxRate !== undefined) {
        rate = item.taxRate;
        name = `VAT (${rate}%)`;
      }

      totalTheoreticalTax += itemTotal * (rate / 100);

      const effectiveRate = invoice.reverseCharge ? 0 : rate;
      const taxAmount = itemTotal * (effectiveRate / 100);

      if (taxBreakdown[name]) {
        taxBreakdown[name].amount += taxAmount;
      } else {
        taxBreakdown[name] = { rate: effectiveRate, amount: taxAmount, name };
      }
    });

    const tax = Object.values(taxBreakdown).reduce(
      (acc, item) => acc + item.amount,
      0,
    );
    const reverseChargeVAT = invoice.reverseCharge ? totalTheoreticalTax : 0;
    const discount = subtotal * (invoice.discountRate / 100);
    const retention = subtotal * (invoice.retentionRate / 100);
    const cis = laborSubtotal * (invoice.cisRate / 100);
    const total = subtotal + tax - discount;
    const amountDue = total - retention - cis;

    return {
      subtotal,
      laborSubtotal,
      taxBreakdown,
      tax,
      reverseChargeVAT,
      discount,
      retention,
      cis,
      total,
      amountDue,
    };
  }, [invoice, taxRules]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    const element = document.getElementById("invoice-preview");
    if (!element) return;

    const html2pdf = (await import("html2pdf.js")).default;

    const opt: any = {
      margin: 10,
      filename: `Invoice_${invoice.invoiceNumber || "draft"}.pdf`,
      image: { type: "jpeg", quality: 1.0 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        letterRendering: true,
        windowWidth: element.scrollWidth, // Ensures layou matches what's rendered
      },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    };

    html2pdf().from(element).set(opt).save();
  };

  const saveInvoice = () => {
    if (!invoice.toName.trim()) {
      alert("Please enter a client name.");
      return;
    }
    if (invoice.lineItems.length === 0) {
      alert("Please add at least one line item.");
      return;
    }

    // Validate line items
    const hasInvalidItems = invoice.lineItems.some(
      (item) =>
        (typeof item.quantity === "number" && item.quantity < 0) ||
        (typeof item.rate === "number" && item.rate < 0),
    );
    if (hasInvalidItems) {
      alert(
        "Please ensure all line item quantities and rates are positive numbers.",
      );
      return;
    }

    onSave(invoice);
    setSaveStatus("saved");
    alert("Invoice saved successfully!");
  };

  const currencySymbol = (curr: string) => {
    switch (curr) {
      case "GBP":
        return "£";
      case "USD":
        return "$";
      case "EUR":
        return "€";
      default:
        return curr + " ";
    }
  };

  const generatePaymentLink = () => {
    if (!invoice.paymentGateway || invoice.paymentGateway === "none")
      return null;

    if (invoice.paymentGateway === "stripe") {
      return invoice.paymentLinkId || null;
    }

    if (invoice.paymentGateway === "paypal") {
      const amount = calculations.amountDue.toFixed(2);
      const email = invoice.paymentLinkId
        ? encodeURIComponent(invoice.paymentLinkId)
        : encodeURIComponent(invoice.fromEmail);
      if (!email || email === "undefined") return null;
      return `https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=${email}&amount=${amount}&currency_code=${invoice.currency}&item_name=${encodeURIComponent("Invoice " + invoice.invoiceNumber)}`;
    }

    return null;
  };

  const handleSendEmail = () => {
    if (!invoice.toEmail) {
      alert("Please enter a client email address first.");
      return;
    }

    const subject = `Invoice ${invoice.invoiceNumber} from ${invoice.fromName}`;
    const amount = calculations.amountDue.toFixed(2);
    const symbol = currencySymbol(invoice.currency);

    let paymentText = "";
    const paymentLink = generatePaymentLink();
    if (paymentLink) {
      paymentText = `\n\nYou can pay this invoice online securely here:\n${paymentLink}\n`;
    }

    const body = `Hi ${invoice.toName},\n\nPlease find attached invoice #${invoice.invoiceNumber} for ${symbol}${amount}.\n\nTotal Due: ${symbol}${amount}\nDue Date: ${invoice.dueDate}${paymentText}\n\nThank you for your business.\n\nBest regards,\n${invoice.fromName}`;

    window.location.href = `mailto:${invoice.toEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    // Update status to Sent and trigger auto-save
    handleChange("status", "Sent");
  };

  const handleCopyPaymentLink = () => {
    const link = generatePaymentLink();
    if (link) {
      navigator.clipboard.writeText(link);
      alert("Payment link copied to clipboard!");
    } else {
      alert("Please configure your payment gateway and ID/Email first.");
    }
  };

  return (
    <div className="flex flex-col xl:flex-row gap-6 p-4 md:p-8 max-w-7xl mx-auto">
      {/* LEFT COLUMN: EDITOR */}
      <div className="flex-1 space-y-6 no-print">
        {/* Header with Save Status */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-slate-700">Invoice Editor</h2>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="text-slate-500 hover:text-indigo-600 transition-colors"
              title="Integration Settings"
            >
              <i className="fas fa-cog"></i>
            </button>
          </div>
          <div className="text-sm font-medium">
            {saveStatus === "saving" && (
              <span className="text-blue-600">
                <i className="fas fa-sync fa-spin mr-1"></i> Auto-saving...
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="text-green-600">
                <i className="fas fa-check mr-1"></i> All changes saved
              </span>
            )}
            {saveStatus === "unsaved" && (
              <span className="text-slate-400">Unsaved changes</span>
            )}
          </div>
        </div>

        {/* AI & Scan Command Center */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 rounded-xl shadow-lg text-white">
          <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
            <i className="fas fa-robot"></i> Smart Assistant
          </h3>
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., 'Invoice Acme Corp (VAT: GB12345) at 123 Main St for 5 windows at £100 each and 2 hours of labor at £50/hr'"
                className="flex-1 px-4 py-2 rounded-lg text-slate-800 focus:outline-none"
                onKeyDown={(e) => e.key === "Enter" && handleAIMagic()}
              />
              <button
                onClick={handleAIMagic}
                disabled={isGenerating}
                className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors font-semibold whitespace-nowrap"
              >
                {isGenerating ? (
                  <i className="fas fa-spinner fa-spin"></i>
                ) : (
                  "Generate"
                )}
              </button>
            </div>
            <div className="flex items-center gap-2 text-sm text-blue-100">
              <span>Or scan from photo:</span>
              <label className="cursor-pointer flex items-center gap-2 bg-white/10 hover:bg-white/20 px-3 py-1 rounded transition-colors">
                {isScanning ? (
                  <i className="fas fa-spinner fa-spin"></i>
                ) : (
                  <i className="fas fa-camera"></i>
                )}
                <span>Upload / Take Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleScanInvoice}
                  disabled={isScanning}
                />
              </label>
            </div>
          </div>
        </div>

        {/* Form Inputs */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
          <div className="flex justify-between items-center border-b pb-4">
            <h3 className="text-lg font-bold text-slate-700">Details</h3>
            <div className="flex gap-4 items-center">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-500 uppercase">
                  Brand Color:
                </label>
                <input
                  type="color"
                  value={invoice.brandColor || "#2563eb"}
                  onChange={(e) => handleChange("brandColor", e.target.value)}
                  className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
                />
              </div>
              <label className="text-slate-600 hover:bg-slate-50 px-3 py-1 rounded text-sm font-medium transition-colors cursor-pointer border border-slate-200">
                <i className="fas fa-image"></i> Logo
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleLogoUpload}
                />
              </label>
            </div>
          </div>

          {/* Status and Template Dropdowns */}
          <div className="flex justify-end gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold text-slate-500">
                Template:
              </label>
              <select
                value={invoice.template || "modern"}
                onChange={(e) => handleChange("template", e.target.value)}
                className="border rounded px-2 py-1 text-sm font-medium"
              >
                <option value="modern">Modern</option>
                <option value="classic">Classic</option>
                <option value="minimal">Minimal</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold text-slate-500">
                Status:
              </label>
              <select
                value={invoice.status}
                onChange={(e) => handleChange("status", e.target.value)}
                className="border rounded px-2 py-1 text-sm font-medium"
              >
                <option value="Draft">Draft</option>
                <option value="Sent">Sent</option>
                <option value="Paid">Paid</option>
                <option value="Overdue">Overdue</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <h4 className="font-semibold text-slate-400 uppercase text-xs tracking-wider">
                From
              </h4>
              <input
                type="text"
                placeholder="Your Company"
                className="w-full border-b focus:border-blue-500 outline-none py-1"
                value={invoice.fromName}
                onChange={(e) => handleChange("fromName", e.target.value)}
              />
              <input
                type="email"
                placeholder="Email"
                className="w-full border-b focus:border-blue-500 outline-none py-1"
                value={invoice.fromEmail}
                onChange={(e) => handleChange("fromEmail", e.target.value)}
              />
              <textarea
                placeholder="Address"
                className="w-full border-b focus:border-blue-500 outline-none py-1 resize-none"
                rows={2}
                value={invoice.fromAddress}
                onChange={(e) => handleChange("fromAddress", e.target.value)}
              />
            </div>
            <div className="space-y-4">
              <div className="flex justify-between">
                <h4 className="font-semibold text-slate-400 uppercase text-xs tracking-wider">
                  Bill To
                </h4>
                <select
                  className="text-xs border rounded p-1"
                  onChange={handleClientSelect}
                  value={invoice.clientId || ""}
                >
                  <option value="">Select Saved Client...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <input
                type="text"
                placeholder="Client Name"
                className="w-full border-b focus:border-blue-500 outline-none py-1"
                value={invoice.toName}
                onChange={(e) => handleChange("toName", e.target.value)}
              />
              <input
                type="email"
                placeholder="Client Email"
                className="w-full border-b focus:border-blue-500 outline-none py-1"
                value={invoice.toEmail}
                onChange={(e) => handleChange("toEmail", e.target.value)}
              />
              <textarea
                placeholder="Client Address"
                className="w-full border-b focus:border-blue-500 outline-none py-1 resize-none"
                rows={2}
                value={invoice.toAddress}
                onChange={(e) => handleChange("toAddress", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-slate-400">Number</label>
              <input
                type="text"
                className="w-full border rounded px-2 py-1 mt-1"
                value={invoice.invoiceNumber}
                onChange={(e) => handleChange("invoiceNumber", e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Date</label>
              <input
                type="date"
                className="w-full border rounded px-2 py-1 mt-1"
                value={invoice.date}
                onChange={(e) => handleChange("date", e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Due Date</label>
              <input
                type="date"
                className="w-full border rounded px-2 py-1 mt-1"
                value={invoice.dueDate}
                onChange={(e) => handleChange("dueDate", e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Currency</label>
              <select
                className="w-full border rounded px-2 py-1 mt-1"
                value={invoice.currency}
                onChange={(e) => handleChange("currency", e.target.value)}
              >
                <option value="GBP">GBP (£)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>
          </div>

          {/* Recurring Options */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
            <div className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                id="isRecurring"
                checked={!!invoice.isRecurring}
                onChange={(e) => handleChange("isRecurring", e.target.checked)}
                className="w-4 h-4 text-blue-600 focus:ring-blue-500 rounded border-gray-300"
              />
              <label
                htmlFor="isRecurring"
                className="text-sm font-bold text-blue-800"
              >
                <i className="fas fa-sync-alt mr-1"></i> Make this a recurring
                invoice
              </label>
            </div>
            {invoice.isRecurring && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <div>
                  <label className="text-xs text-blue-700">Frequency</label>
                  <select
                    className="w-full border border-blue-200 rounded px-2 py-1 mt-1 bg-white"
                    value={invoice.recurringFrequency || "monthly"}
                    onChange={(e) =>
                      handleChange("recurringFrequency", e.target.value)
                    }
                  >
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-blue-700">End Date</label>
                  <input
                    type="date"
                    className="w-full border border-blue-200 rounded px-2 py-1 mt-1 bg-white"
                    value={invoice.recurringEndDate || ""}
                    onChange={(e) =>
                      handleChange("recurringEndDate", e.target.value)
                    }
                  />
                </div>
              </div>
            )}
          </div>

          {/* Payment Integration */}
          <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100">
            <h4 className="text-sm font-bold text-emerald-800 mb-3 flex items-center gap-2">
              <i className="fas fa-credit-card"></i> Payment Integration
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-emerald-700">
                  Payment Gateway
                </label>
                <select
                  className="w-full border border-emerald-200 rounded px-2 py-1 mt-1 bg-white"
                  value={invoice.paymentGateway || "none"}
                  onChange={(e) =>
                    handleChange("paymentGateway", e.target.value)
                  }
                >
                  <option value="none">None</option>
                  <option value="paypal">PayPal</option>
                  <option value="stripe">Stripe</option>
                </select>
              </div>
              {invoice.paymentGateway && invoice.paymentGateway !== "none" && (
                <div>
                  <label className="text-xs text-emerald-700">
                    {invoice.paymentGateway === "paypal"
                      ? "PayPal Email Address"
                      : "Stripe Payment Link"}
                  </label>
                  <input
                    type="text"
                    placeholder={
                      invoice.paymentGateway === "paypal"
                        ? "hello@company.com"
                        : "https://buy.stripe.com/..."
                    }
                    className="w-full border border-emerald-200 rounded px-2 py-1 mt-1 bg-white"
                    value={invoice.paymentLinkId || ""}
                    onChange={(e) =>
                      handleChange("paymentLinkId", e.target.value)
                    }
                  />
                  {invoice.paymentGateway === "stripe" && (
                    <p className="text-[10px] text-emerald-600 mt-1">
                      Paste your pre-configured Stripe Payment Link.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Construction Specifics */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
              <i className="fas fa-hard-hat text-orange-500"></i> Construction /
              UK Accounting
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="reverseCharge"
                  checked={invoice.reverseCharge}
                  onChange={(e) =>
                    handleChange("reverseCharge", e.target.checked)
                  }
                  className="w-4 h-4 text-blue-600"
                />
                <label
                  htmlFor="reverseCharge"
                  className="text-sm text-slate-700"
                >
                  VAT Reverse Charge
                </label>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-700 whitespace-nowrap">
                  Retention Rate %
                </label>
                <input
                  type="number"
                  className="w-full border rounded px-2 py-1 text-sm"
                  value={
                    Number.isNaN(invoice.retentionRate)
                      ? ""
                      : invoice.retentionRate
                  }
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    handleChange("retentionRate", isNaN(val) ? "" : val);
                  }}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-700 whitespace-nowrap">
                  CIS Deduction %
                </label>
                <input
                  type="number"
                  className="w-full border rounded px-2 py-1 text-sm"
                  value={Number.isNaN(invoice.cisRate) ? "" : invoice.cisRate}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    handleChange("cisRate", isNaN(val) ? "" : val);
                  }}
                />
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div>
            <h4 className="font-semibold text-slate-400 uppercase text-xs tracking-wider mb-2">
              Items
            </h4>
            <div className="space-y-2">
              <div className="flex gap-2 px-1 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <div className="flex-1">Description</div>
                <div className="w-16 text-right">Qty</div>
                <div className="w-20 text-right">Rate</div>
                <div className="w-24">Tax</div>
                <div className="w-20 text-center">Labor (CIS)</div>
                <div className="w-24 text-right">Amount</div>
                <div className="w-6"></div>
              </div>
              {invoice.lineItems.map((item) => {
                const isInvalidQty =
                  typeof item.quantity === "number" && item.quantity < 0;
                const isInvalidRate =
                  typeof item.rate === "number" && item.rate < 0;

                return (
                  <div key={item.id} className="flex flex-col gap-1 group">
                    <div className="flex gap-2 items-center bg-white p-1 rounded-lg border border-transparent hover:border-slate-200 transition-colors">
                      <div className="flex-1">
                        <input
                          type="text"
                          placeholder="Description"
                          className="w-full border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-blue-50/30 px-2 py-1.5 transition-colors focus:outline-none"
                          value={item.description}
                          onChange={(e) =>
                            handleLineItemChange(
                              item.id,
                              "description",
                              e.target.value,
                            )
                          }
                        />
                      </div>
                      <div className="w-16">
                        <input
                          type="number"
                          placeholder="Qty"
                          className={`w-full border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-blue-50/30 px-2 py-1.5 text-right transition-colors focus:outline-none ${isInvalidQty ? "border-red-500 bg-red-50" : ""}`}
                          value={
                            Number.isNaN(item.quantity) ? "" : item.quantity
                          }
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            handleLineItemChange(
                              item.id,
                              "quantity",
                              isNaN(val) ? "" : val,
                            );
                          }}
                        />
                      </div>
                      <div className="w-20">
                        <input
                          type="number"
                          placeholder="Rate"
                          className={`w-full border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-blue-50/30 px-2 py-1.5 text-right transition-colors focus:outline-none ${isInvalidRate ? "border-red-500 bg-red-50" : ""}`}
                          value={Number.isNaN(item.rate) ? "" : item.rate}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            handleLineItemChange(
                              item.id,
                              "rate",
                              isNaN(val) ? "" : val,
                            );
                          }}
                        />
                      </div>
                      {/* Tax Rule Selector */}
                      <div className="w-24">
                        <select
                          className="w-full border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-blue-50/30 px-1 py-1.5 text-xs transition-colors focus:outline-none"
                          value={item.taxRuleId || ""}
                          onChange={(e) =>
                            handleLineItemChange(
                              item.id,
                              "taxRuleId",
                              e.target.value,
                            )
                          }
                        >
                          <option value="">Default ({invoice.taxRate}%)</option>
                          {taxRules.map((rule) => (
                            <option key={rule.id} value={rule.id}>
                              {rule.name} ({rule.rate}%)
                            </option>
                          ))}
                        </select>
                      </div>
                      {/* CIS Labor Checkbox */}
                      <div
                        className="w-20 flex justify-center items-center"
                        title="Mark as Labor (for CIS deduction)"
                      >
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                          checked={item.isLabor === true}
                          onChange={(e) =>
                            handleLineItemChange(
                              item.id,
                              "isLabor",
                              e.target.checked,
                            )
                          }
                        />
                      </div>
                      <div className="w-24 px-2 text-right font-semibold text-slate-700 text-sm flex items-center justify-end">
                        {currencySymbol(invoice.currency)}
                        {(
                          (Number(item.quantity) || 0) *
                          (Number(item.rate) || 0)
                        ).toFixed(2)}
                      </div>
                      <button
                        onClick={() => removeLineItem(item.id)}
                        className="text-slate-300 hover:text-red-600 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity w-6 flex justify-center"
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
                    {(isInvalidQty || isInvalidRate) && (
                      <div className="text-red-500 text-[10px] pl-1 font-medium">
                        <i className="fas fa-exclamation-circle mr-1"></i>
                        Quantity and rate must be valid, positive numbers.
                      </div>
                    )}
                  </div>
                );
              })}
              <button
                onClick={addLineItem}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1 mt-2 px-1"
              >
                <i className="fas fa-plus"></i> Add Line Item
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400">Notes</label>
                <textarea
                  className="w-full border rounded px-2 py-1 mt-1 text-sm"
                  rows={2}
                  value={invoice.notes}
                  onChange={(e) => handleChange("notes", e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Terms</label>
                <textarea
                  className="w-full border rounded px-2 py-1 mt-1 text-sm"
                  rows={2}
                  value={invoice.terms}
                  onChange={(e) => handleChange("terms", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2 bg-slate-50 p-4 rounded-lg">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span>{calculations.subtotal.toFixed(2)}</span>
              </div>

              {/* Dynamic Tax Breakdown */}
              {Object.values(calculations.taxBreakdown).map((tax, idx) => (
                <div
                  key={idx}
                  className="flex justify-between items-center text-sm"
                >
                  <span className="text-slate-500">
                    {tax.name} {invoice.reverseCharge && "(Rev. Chg)"}
                  </span>
                  <span>
                    {invoice.reverseCharge ? "0.00" : tax.amount.toFixed(2)}
                  </span>
                </div>
              ))}

              {/* Global Tax Rate Override (if needed, but we prefer per-item or default) */}
              <div className="flex justify-between items-center text-xs text-slate-400 mt-1">
                <span>Default Tax Rate %</span>
                <input
                  type="number"
                  className="w-12 border rounded px-1 text-right"
                  value={Number.isNaN(invoice.taxRate) ? "" : invoice.taxRate}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    handleChange("taxRate", isNaN(val) ? "" : val);
                  }}
                />
              </div>

              {invoice.discountRate > 0 && (
                <div className="flex justify-between items-center text-sm text-green-600">
                  <span>Discount ({invoice.discountRate}%)</span>
                  <span>-{calculations.discount.toFixed(2)}</span>
                </div>
              )}

              <div className="border-t border-slate-200 my-2"></div>

              {/* Construction Deductions */}
              {invoice.retentionRate > 0 && (
                <div className="flex justify-between items-center text-sm text-amber-700">
                  <span>Less Retention ({invoice.retentionRate}%)</span>
                  <span>-{calculations.retention.toFixed(2)}</span>
                </div>
              )}

              {invoice.cisRate > 0 && (
                <div className="flex justify-between items-center text-sm text-amber-700">
                  <span>Less CIS ({invoice.cisRate}%)</span>
                  <span>-{calculations.cis.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between font-bold text-lg pt-2 border-t border-slate-200">
                <span>Amount Due</span>
                <span>
                  {currencySymbol(invoice.currency)}
                  {calculations.amountDue.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* AI Audit Result */}
        {auditResult && (
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100 rounded-xl p-6 shadow-sm animate-fade-in transition-all">
            <div className="flex justify-between items-start mb-6">
              <h3 className="font-bold text-xl text-purple-900 flex items-center gap-2">
                <i className="fas fa-clipboard-check text-purple-600"></i> AI
                Accountant Audit Report
              </h3>
              <button
                onClick={() => setAuditResult(null)}
                className="text-purple-400 hover:text-purple-700 transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-purple-100"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-6">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                  <h4 className="font-semibold text-slate-800 text-sm mb-3 flex items-center gap-2">
                    <i className="fas fa-check-circle text-green-500"></i> Tax &
                    HMRC Compliance
                  </h4>
                  <ul className="space-y-2">
                    {auditResult.taxCompliance.map((item, i) => (
                      <li
                        key={i}
                        className="text-sm text-slate-600 flex items-start gap-2"
                      >
                        <span className="text-green-500 mt-0.5">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {auditResult.cisVatImplications.length > 0 && (
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                    <h4 className="font-semibold text-slate-800 text-sm mb-3 flex items-center gap-2">
                      <i className="fas fa-hard-hat text-amber-500"></i> CIS &
                      VAT Implications
                    </h4>
                    <ul className="space-y-2">
                      {auditResult.cisVatImplications.map((item, i) => (
                        <li
                          key={i}
                          className="text-sm text-slate-600 flex items-start gap-2"
                        >
                          <span className="text-amber-500 mt-0.5">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                  <h4 className="font-semibold text-slate-800 text-sm mb-3 flex items-center gap-2">
                    <i className="fas fa-pencil-alt text-blue-500"></i> Line
                    Item Suggestions
                  </h4>
                  <ul className="space-y-2">
                    {auditResult.lineItemSuggestions.map((item, i) => (
                      <li
                        key={i}
                        className="text-sm text-slate-600 flex items-start gap-2"
                      >
                        <span className="text-blue-500 mt-0.5">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                  <h4 className="font-semibold text-slate-800 text-sm mb-3 flex items-center gap-2">
                    <i className="fas fa-lightbulb text-purple-500"></i> General
                    Feedback
                  </h4>
                  <ul className="space-y-2">
                    {auditResult.generalFeedback.map((item, i) => (
                      <li
                        key={i}
                        className="text-sm text-slate-600 flex items-start gap-2"
                      >
                        <span className="text-purple-500 mt-0.5">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 flex-wrap">
          {(invoice.status === "Sent" || invoice.status === "Paid") && (
            <button
              onClick={handleCopyPaymentLink}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              <i className="fas fa-link mr-2"></i> Payment Link
            </button>
          )}
          <button
            onClick={handleSendEmail}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            <i className="fas fa-paper-plane mr-2"></i> Send Email
          </button>
          <button
            onClick={handlePrint}
            className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            <i className="fas fa-print mr-2"></i> Print
          </button>
          <button
            onClick={handleDownloadPDF}
            className="bg-rose-600 hover:bg-rose-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            <i className="fas fa-file-pdf mr-2"></i> Download PDF
          </button>
          <button
            onClick={handleAudit}
            disabled={isAuditing}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {isAuditing ? (
              <i className="fas fa-spinner fa-spin mr-2"></i>
            ) : (
              <i className="fas fa-clipboard-check mr-2"></i>
            )}{" "}
            AI Audit
          </button>
          <button
            onClick={saveInvoice}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            <i className="fas fa-save mr-2"></i> Save
          </button>
        </div>
      </div>

      {/* RIGHT COLUMN: PREVIEW PANE */}
      <div className="w-full xl:w-[800px] shrink-0 no-print xl:sticky xl:top-8 self-start">
        <div className="bg-slate-100 rounded-2xl p-4 md:p-8 flex flex-col items-center border border-slate-200 h-[calc(100vh-4rem)] overflow-hidden">
          <div className="flex justify-between items-center w-full max-w-[210mm] mb-4 shrink-0 bg-white p-3 rounded-xl shadow-sm border border-slate-200 z-10">
            <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <i className="fas fa-eye text-indigo-500"></i> Live Preview
            </h2>

            <div className="flex items-center gap-4">
              {/* View Toggles */}
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    handleChange(
                      "showNotes",
                      invoice.showNotes === false ? true : false,
                    )
                  }
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${invoice.showNotes !== false ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                  title="Toggle Notes Visibility"
                >
                  <i
                    className={`fas ${invoice.showNotes !== false ? "fa-eye" : "fa-eye-slash"} text-[10px]`}
                  ></i>{" "}
                  Notes
                </button>
                <button
                  onClick={() =>
                    handleChange(
                      "showTerms",
                      invoice.showTerms === false ? true : false,
                    )
                  }
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${invoice.showTerms !== false ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                  title="Toggle Terms Visibility"
                >
                  <i
                    className={`fas ${invoice.showTerms !== false ? "fa-eye" : "fa-eye-slash"} text-[10px]`}
                  ></i>{" "}
                  Terms
                </button>
              </div>

              <div className="w-px h-6 bg-slate-200 hidden md:block"></div>

              {/* Template Toggle */}
              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button
                  onClick={() => handleChange("template", "modern")}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${!invoice.template || invoice.template === "modern" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  Modern
                </button>
                <button
                  onClick={() => handleChange("template", "classic")}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${invoice.template === "classic" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  Classic
                </button>
                <button
                  onClick={() => handleChange("template", "minimal")}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${invoice.template === "minimal" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  Minimal
                </button>
              </div>

              <div className="w-px h-6 bg-slate-200"></div>

              {/* Zoom Controls */}
              <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
                <button
                  onClick={() => setPreviewZoom((z) => Math.max(0.5, z - 0.1))}
                  className="w-6 h-6 flex items-center justify-center rounded bg-white text-slate-600 hover:text-indigo-600 shadow-sm transition-colors cursor-pointer"
                  title="Zoom Out"
                >
                  <i className="fas fa-minus text-[10px]"></i>
                </button>
                <span className="text-xs font-medium text-slate-600 w-10 text-center">
                  {Math.round(previewZoom * 100)}%
                </span>
                <button
                  onClick={() => setPreviewZoom((z) => Math.min(2, z + 0.1))}
                  className="w-6 h-6 flex items-center justify-center rounded bg-white text-slate-600 hover:text-indigo-600 shadow-sm transition-colors cursor-pointer"
                  title="Zoom In"
                >
                  <i className="fas fa-plus text-[10px]"></i>
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-auto w-full flex justify-center custom-scrollbar pb-12 relative flex-1">
            <div
              className="shadow-2xl bg-white w-full max-w-[210mm] min-h-[297mm] transition-transform origin-top shrink-0 text-left border border-slate-200 absolute top-0"
              style={{
                transform: `scale(${previewZoom})`,
                marginBottom: `${Math.max(0, (previewZoom - 1) * 297)}mm`,
              }}
            >
              {(!invoice.template || invoice.template === "modern") && (
                <ModernTemplate
                  invoice={invoice}
                  calculations={calculations}
                  currencySymbol={currencySymbol}
                />
              )}
              {invoice.template === "classic" && (
                <ClassicTemplate
                  invoice={invoice}
                  calculations={calculations}
                  currencySymbol={currencySymbol}
                />
              )}
              {invoice.template === "minimal" && (
                <MinimalTemplate
                  invoice={invoice}
                  calculations={calculations}
                  currencySymbol={currencySymbol}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* OFF-SCREEN PRINT/PDF TARGET */}
      <div className="absolute top-0 left-[-9999px] w-[210mm] print:static print:w-full print:block">
        <div id="invoice-preview" className="bg-white w-[210mm]">
          {(!invoice.template || invoice.template === "modern") && (
            <ModernTemplate
              invoice={invoice}
              calculations={calculations}
              currencySymbol={currencySymbol}
            />
          )}
          {invoice.template === "classic" && (
            <ClassicTemplate
              invoice={invoice}
              calculations={calculations}
              currencySymbol={currencySymbol}
            />
          )}
          {invoice.template === "minimal" && (
            <MinimalTemplate
              invoice={invoice}
              calculations={calculations}
              currencySymbol={currencySymbol}
            />
          )}
        </div>
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden animate-fade-in">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800">
                <i className="fas fa-cog text-slate-400 mr-2"></i> Integration
                Settings
              </h3>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Invoice Number Generation */}
              <div className="space-y-3">
                <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                  <i className="fas fa-hashtag text-slate-500"></i> Invoice
                  Number Generation
                </h4>
                <p className="text-xs text-slate-500">
                  Customize how new invoice numbers are created.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Prefix
                    </label>
                    <input
                      type="text"
                      className="w-full border rounded-lg px-3 py-2 text-sm bg-slate-50 focus:bg-white transition-colors"
                      placeholder="INV-"
                      value={apiKeys.invoicePrefix || ""}
                      onChange={(e) =>
                        setApiKeys({
                          ...apiKeys,
                          invoicePrefix: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="flex flex-col justify-center pt-5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={apiKeys.autoIncrement !== false}
                        onChange={(e) =>
                          setApiKeys({
                            ...apiKeys,
                            autoIncrement: e.target.checked,
                          })
                        }
                      />
                      <span className="text-sm text-slate-700 font-medium">
                        Auto-increment
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              <hr className="border-slate-100" />

              {/* Stripe Config */}
              <div className="space-y-3">
                <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                  <i className="fab fa-stripe text-indigo-500 text-xl"></i>{" "}
                  Stripe Integration
                </h4>
                <p className="text-xs text-slate-500">
                  Configure your Stripe API keys to generate secure checkout
                  sessions.
                </p>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Publishable Key
                  </label>
                  <input
                    type="text"
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-slate-50 focus:bg-white transition-colors"
                    placeholder="pk_test_..."
                    value={apiKeys.stripePublishableKey || ""}
                    onChange={(e) =>
                      setApiKeys({
                        ...apiKeys,
                        stripePublishableKey: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Secret Key
                  </label>
                  <input
                    type="password"
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-slate-50 focus:bg-white transition-colors"
                    placeholder="sk_test_..."
                    value={apiKeys.stripeSecretKey || ""}
                    onChange={(e) =>
                      setApiKeys({
                        ...apiKeys,
                        stripeSecretKey: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <hr className="border-slate-100" />

              {/* PayPal Config */}
              <div className="space-y-3">
                <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                  <i className="fab fa-paypal text-blue-500 text-xl"></i> PayPal
                  Integration
                </h4>
                <p className="text-xs text-slate-500">
                  Configure your PayPal Client ID for instant payments.
                </p>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Client ID
                  </label>
                  <input
                    type="password"
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-slate-50 focus:bg-white transition-colors"
                    placeholder="Enter PayPal Client ID"
                    value={apiKeys.paypalClientId || ""}
                    onChange={(e) =>
                      setApiKeys({ ...apiKeys, paypalClientId: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                className="px-4 py-2 rounded-lg font-medium text-slate-600 hover:bg-slate-200 transition-colors"
                onClick={() => setIsSettingsOpen(false)}
              >
                Cancel
              </button>
              <button
                className="px-6 py-2 rounded-lg font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
                onClick={() => handleSaveApiKeys(apiKeys)}
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceBuilder;
