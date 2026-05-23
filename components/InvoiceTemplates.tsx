import React from "react";
import { Invoice } from "../types";

interface TemplateProps {
  invoice: Invoice;
  calculations: {
    subtotal: number;
    tax: number;
    discount: number;
    total: number;
    amountDue: number;
    retention: number;
    cis: number;
    reverseChargeVAT: number;
    taxBreakdown: {
      [key: string]: { rate: number; amount: number; name: string };
    };
  };
  currencySymbol: (curr: string) => string;
}

const buildPaymentLink = (invoice: Invoice, amountDue: number): string | null => {
  if (!invoice.paymentGateway || invoice.paymentGateway === "none") return null;
  if (invoice.paymentGateway === "stripe") {
    return invoice.paymentLinkId?.trim() || null;
  }
  if (invoice.paymentGateway === "paypal") {
    const recipient =
      invoice.paymentLinkId?.trim() || invoice.fromEmail?.trim() || "";
    if (!recipient) return null;
    if (/^https?:\/\//i.test(recipient)) {
      // Full PayPal.me / PayPal Pay link the user pasted as-is.
      return recipient;
    }
    if (recipient.includes("@")) {
      return `https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=${encodeURIComponent(recipient)}&amount=${amountDue.toFixed(2)}&currency_code=${encodeURIComponent(invoice.currency || "GBP")}&item_name=${encodeURIComponent("Invoice " + invoice.invoiceNumber)}`;
    }
    // Treat as a PayPal.me handle (e.g. "myhandle" or "myhandle/100")
    return `https://paypal.me/${recipient.replace(/^\//, "")}/${amountDue.toFixed(2)}`;
  }
  return null;
};

const PayNowLink: React.FC<{ invoice: Invoice; amountDue: number; brandColor?: string }> = ({
  invoice,
  amountDue,
  brandColor,
}) => {
  const link = buildPaymentLink(invoice, amountDue);
  if (!link || amountDue <= 0) return null;
  const gateway = invoice.paymentGateway === "stripe" ? "Stripe" : "PayPal";
  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className="no-print mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-md text-white text-sm font-semibold shadow hover:opacity-90 transition-opacity"
      style={{ backgroundColor: brandColor || "#0f172a" }}
    >
      <i className="fas fa-credit-card" aria-hidden></i>
      Pay {gateway === "Stripe" ? "with Stripe" : "with PayPal"}
    </a>
  );
};

export const ModernTemplate: React.FC<TemplateProps> = ({
  invoice,
  calculations,
  currencySymbol,
}) => {
  return (
    <div className="bg-white shadow-lg min-h-[1000px] p-8 md:p-12 relative print-only font-sans">
      <div className="flex justify-between items-start mb-12">
        <div className="w-1/2">
          {invoice.logo ? (
            <img
              src={invoice.logo}
              alt="Logo"
              className="h-20 object-contain mb-4"
            />
          ) : (
            <div className="h-20 w-20 bg-slate-100 rounded flex items-center justify-center text-slate-300 mb-4">
              <i className="fas fa-image text-2xl"></i>
            </div>
          )}
          <h1
            className="text-4xl font-light mb-1"
            style={{ color: invoice.brandColor || "#0f172a" }}
          >
            INVOICE
          </h1>
          <p className="text-slate-500 font-medium">#{invoice.invoiceNumber}</p>
        </div>
        <div className="text-right w-1/2">
          <h3 className="font-bold text-slate-800 text-xl">
            {invoice.fromName || "Your Name"}
          </h3>
          <div className="text-slate-500 text-sm whitespace-pre-line mt-1">
            {invoice.fromAddress || "Address Line 1\nCity, State Zip"}
          </div>
          <div className="text-slate-500 text-sm mt-1">{invoice.fromEmail}</div>
        </div>
      </div>

      <div className="flex justify-between mb-12">
        <div>
          <h4 className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-2">
            Bill To
          </h4>
          <h3 className="font-bold text-slate-800 text-lg">
            {invoice.toName || "Client Name"}
          </h3>
          <div className="text-slate-500 text-sm whitespace-pre-line mt-1">
            {invoice.toAddress || "Client Address"}
          </div>
          <div className="text-slate-500 text-sm mt-1">{invoice.toEmail}</div>
          {invoice.clientVatNumber && (
            <div className="text-slate-500 text-sm mt-1">
              VAT: {invoice.clientVatNumber}
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="mb-4">
            <h4 className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-1">
              Date
            </h4>
            <p className="font-medium text-slate-700">{invoice.date}</p>
          </div>
          {invoice.dueDate && (
            <div>
              <h4 className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-1">
                Due Date
              </h4>
              <p className="font-medium text-slate-700">{invoice.dueDate}</p>
            </div>
          )}
        </div>
      </div>

      <table className="w-full mb-8">
        <thead>
          <tr
            className="border-b-2"
            style={{ borderColor: invoice.brandColor || "#f1f5f9" }}
          >
            <th
              className="text-left py-3 text-sm font-bold uppercase tracking-wider"
              style={{ color: invoice.brandColor || "#475569" }}
            >
              Description
            </th>
            <th
              className="text-right py-3 text-sm font-bold uppercase tracking-wider w-24"
              style={{ color: invoice.brandColor || "#475569" }}
            >
              Qty
            </th>
            <th
              className="text-right py-3 text-sm font-bold uppercase tracking-wider w-32"
              style={{ color: invoice.brandColor || "#475569" }}
            >
              Rate
            </th>
            <th
              className="text-right py-3 text-sm font-bold uppercase tracking-wider w-32"
              style={{ color: invoice.brandColor || "#475569" }}
            >
              Amount
            </th>
            <th
              className="text-right py-3 text-sm font-bold uppercase tracking-wider w-24"
              style={{ color: invoice.brandColor || "#475569" }}
            >
              Tax
            </th>
          </tr>
        </thead>
        <tbody>
          {invoice.lineItems.map((item) => {
            const itemTaxRate =
              item.taxRate !== undefined ? item.taxRate : invoice.taxRate;
            const taxAmountString = itemTaxRate > 0 ? `${itemTaxRate}%` : "0%";
            return (
              <tr key={item.id} className="border-b border-slate-50">
                <td className="py-4 text-slate-700">
                  <div className="font-medium text-slate-800">
                    {item.description}
                  </div>
                  {item.isLabor && (
                    <span className="text-[10px] text-orange-700 mt-1.5 inline-flex items-center gap-1 bg-orange-50 px-2 py-0.5 rounded font-medium border border-orange-100">
                      <i className="fas fa-hard-hat"></i> Labour
                      {invoice.cisRate > 0 && " (CIS)"}
                    </span>
                  )}
                </td>
                <td className="py-4 text-right text-slate-700">
                  {Number(item.quantity) || ""}
                </td>
                <td className="py-4 text-right text-slate-700">
                  {currencySymbol(invoice.currency)}
                  {(Number(item.rate) || 0).toFixed(2)}
                </td>
                <td className="py-4 text-right font-medium text-slate-800">
                  {currencySymbol(invoice.currency)}
                  {(
                    (Number(item.quantity) || 0) * (Number(item.rate) || 0)
                  ).toFixed(2)}
                </td>
                <td className="py-4 text-right text-xs text-slate-500">
                  {invoice.reverseCharge ? "Rev Chg" : taxAmountString}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="flex justify-end mb-12">
        <div className="w-1/2 md:w-5/12 space-y-3">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span>
              {currencySymbol(invoice.currency)}
              {calculations.subtotal.toFixed(2)}
            </span>
          </div>

          {invoice.discountRate > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Discount ({invoice.discountRate}%)</span>
              <span>
                -{currencySymbol(invoice.currency)}
                {calculations.discount.toFixed(2)}
              </span>
            </div>
          )}

          {!invoice.reverseCharge &&
            Object.values(calculations.taxBreakdown).map((tax, i) => (
              <div key={i} className="flex justify-between text-slate-600">
                <span>{tax.name}</span>
                <span>
                  {currencySymbol(invoice.currency)}
                  {tax.amount.toFixed(2)}
                </span>
              </div>
            ))}

          {invoice.reverseCharge && (
            <div className="flex justify-between text-slate-400 italic text-sm">
              <span>Reverse Charge VAT ({invoice.taxRate}%)</span>
              <span>
                {currencySymbol(invoice.currency)}
                {calculations.reverseChargeVAT.toFixed(2)}
              </span>
            </div>
          )}

          <div className="flex justify-between font-bold text-slate-800 pt-2 border-t border-slate-100">
            <span>Gross Total</span>
            <span>
              {currencySymbol(invoice.currency)}
              {calculations.total.toFixed(2)}
            </span>
          </div>

          {(invoice.retentionRate > 0 || invoice.cisRate > 0) && (
            <div className="pt-2 space-y-2 border-t border-slate-100">
              {invoice.retentionRate > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Less Retention ({invoice.retentionRate}%)</span>
                  <span>
                    -{currencySymbol(invoice.currency)}
                    {calculations.retention.toFixed(2)}
                  </span>
                </div>
              )}
              {invoice.cisRate > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Less CIS Deduction ({invoice.cisRate}%)</span>
                  <span>
                    -{currencySymbol(invoice.currency)}
                    {calculations.cis.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          )}

          <div
            className="flex justify-between font-bold text-2xl border-t-2 pt-3"
            style={{
              color: invoice.brandColor || "#0f172a",
              borderColor: invoice.brandColor || "#f1f5f9",
            }}
          >
            <span>Amount Due</span>
            <span>
              {currencySymbol(invoice.currency)}
              {calculations.amountDue.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-end">
            <PayNowLink
              invoice={invoice}
              amountDue={calculations.amountDue}
              brandColor={invoice.brandColor}
            />
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {((invoice.showNotes !== false && invoice.notes) ||
          (invoice.showTerms !== false && invoice.terms)) && (
          <div className="grid grid-cols-2 gap-8 border-t border-slate-100 pt-8">
            {invoice.showNotes !== false && invoice.notes ? (
              <div>
                <h4 className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-2">
                  Notes
                </h4>
                <p className="text-sm text-slate-600 whitespace-pre-line">
                  {invoice.notes}
                </p>
              </div>
            ) : (
              <div></div>
            )}
            {invoice.showTerms !== false && invoice.terms ? (
              <div>
                <h4 className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-2">
                  Terms
                </h4>
                <p className="text-sm text-slate-600 whitespace-pre-line">
                  {invoice.terms}
                </p>
              </div>
            ) : (
              <div></div>
            )}
          </div>
        )}

        {invoice.reverseCharge && (
          <div className="bg-slate-50 p-4 rounded text-sm text-slate-600 border border-slate-200">
            <strong>Reverse Charge applies:</strong> VAT Act 1994 Section 55A
            applies. Customer to pay the VAT to HMRC.
          </div>
        )}
      </div>

      <div className="absolute bottom-8 left-0 w-full text-center text-slate-300 text-sm print-only">
        Generated with Smart Invoice AI
      </div>
    </div>
  );
};

export const ClassicTemplate: React.FC<TemplateProps> = ({
  invoice,
  calculations,
  currencySymbol,
}) => {
  return (
    <div className="bg-white shadow-lg min-h-[1000px] p-12 md:p-16 relative print-only font-serif text-slate-800">
      <div
        className="text-center mb-12 border-b-2 pb-8"
        style={{ borderColor: invoice.brandColor || "#1e293b" }}
      >
        {invoice.logo && (
          <img
            src={invoice.logo}
            alt="Logo"
            className="h-24 object-contain mx-auto mb-6"
          />
        )}
        <h1
          className="text-5xl font-bold mb-2 tracking-tight uppercase"
          style={{ color: invoice.brandColor || "#0f172a" }}
        >
          Invoice
        </h1>
        <h3 className="text-xl font-semibold">
          {invoice.fromName || "Your Company"}
        </h3>
        <p className="text-slate-600 whitespace-pre-line">
          {invoice.fromAddress}
        </p>
        <p className="text-slate-600">{invoice.fromEmail}</p>
      </div>

      <div className="flex justify-between mb-12">
        <div className="w-1/2 pr-8">
          <h4 className="font-bold text-slate-900 border-b border-slate-300 mb-2 pb-1">
            Bill To:
          </h4>
          <h3 className="text-lg font-semibold">
            {invoice.toName || "Client Name"}
          </h3>
          <p className="whitespace-pre-line text-slate-700">
            {invoice.toAddress}
          </p>
          <p className="text-slate-700">{invoice.toEmail}</p>
          {invoice.clientVatNumber && (
            <p className="text-slate-700">VAT: {invoice.clientVatNumber}</p>
          )}
        </div>
        <div className="w-1/3">
          <div className="flex justify-between border-b border-slate-200 py-1">
            <span className="font-semibold">Invoice #:</span>
            <span>{invoice.invoiceNumber}</span>
          </div>
          <div className="flex justify-between border-b border-slate-200 py-1">
            <span className="font-semibold">Date:</span>
            <span>{invoice.date}</span>
          </div>
          {invoice.dueDate && (
            <div className="flex justify-between border-b border-slate-200 py-1">
              <span className="font-semibold">Due Date:</span>
              <span>{invoice.dueDate}</span>
            </div>
          )}
        </div>
      </div>

      <table className="w-full mb-8 border-collapse">
        <thead>
          <tr className="bg-slate-100 border-y border-slate-300">
            <th className="text-left py-3 px-4 font-bold text-slate-800">
              Description
            </th>
            <th className="text-center py-3 px-4 font-bold text-slate-800 w-20">
              Qty
            </th>
            <th className="text-right py-3 px-4 font-bold text-slate-800 w-32">
              Rate
            </th>
            <th className="text-right py-3 px-4 font-bold text-slate-800 w-32">
              Amount
            </th>
            <th className="text-right py-3 px-4 font-bold text-slate-800 w-24">
              Tax
            </th>
          </tr>
        </thead>
        <tbody>
          {invoice.lineItems.map((item) => {
            const itemTaxRate =
              item.taxRate !== undefined ? item.taxRate : invoice.taxRate;
            const taxAmountString = itemTaxRate > 0 ? `${itemTaxRate}%` : "0%";
            return (
              <tr key={item.id} className="border-b border-slate-200">
                <td className="py-3 px-4">
                  <div className="font-medium text-slate-900">
                    {item.description}
                  </div>
                  {item.isLabor && (
                    <span className="text-[10px] text-orange-700 mt-1.5 inline-flex items-center gap-1 bg-orange-50 px-2 py-0.5 rounded font-medium border border-orange-100">
                      <i className="fas fa-hard-hat"></i> Labour
                      {invoice.cisRate > 0 && " (CIS)"}
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 text-center">
                  {Number(item.quantity) || ""}
                </td>
                <td className="py-3 px-4 text-right">
                  {currencySymbol(invoice.currency)}
                  {(Number(item.rate) || 0).toFixed(2)}
                </td>
                <td className="py-3 px-4 text-right font-semibold">
                  {currencySymbol(invoice.currency)}
                  {(
                    (Number(item.quantity) || 0) * (Number(item.rate) || 0)
                  ).toFixed(2)}
                </td>
                <td className="py-3 px-4 text-right text-sm text-slate-600">
                  {invoice.reverseCharge ? "Rev Chg" : taxAmountString}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="flex justify-end mb-12">
        <div className="w-1/2 space-y-2">
          <div className="flex justify-between px-4">
            <span>Subtotal:</span>
            <span>
              {currencySymbol(invoice.currency)}
              {calculations.subtotal.toFixed(2)}
            </span>
          </div>

          {invoice.discountRate > 0 && (
            <div className="flex justify-between px-4 text-green-700">
              <span>Discount ({invoice.discountRate}%):</span>
              <span>
                -{currencySymbol(invoice.currency)}
                {calculations.discount.toFixed(2)}
              </span>
            </div>
          )}

          {!invoice.reverseCharge &&
            Object.values(calculations.taxBreakdown).map((tax, i) => (
              <div key={i} className="flex justify-between px-4">
                <span>{tax.name}:</span>
                <span>
                  {currencySymbol(invoice.currency)}
                  {tax.amount.toFixed(2)}
                </span>
              </div>
            ))}

          {invoice.reverseCharge && (
            <div className="flex justify-between px-4 italic text-sm">
              <span>Reverse Charge VAT ({invoice.taxRate}%):</span>
              <span>
                {currencySymbol(invoice.currency)}
                {calculations.reverseChargeVAT.toFixed(2)}
              </span>
            </div>
          )}

          <div className="border-t border-slate-800 my-2"></div>

          {(invoice.retentionRate > 0 || invoice.cisRate > 0) && (
            <>
              <div className="flex justify-between px-4 font-semibold pb-2">
                <span>Gross Total:</span>
                <span>
                  {currencySymbol(invoice.currency)}
                  {calculations.total.toFixed(2)}
                </span>
              </div>
              {invoice.retentionRate > 0 && (
                <div className="flex justify-between px-4 text-red-700">
                  <span>Less Retention ({invoice.retentionRate}%):</span>
                  <span>
                    -{currencySymbol(invoice.currency)}
                    {calculations.retention.toFixed(2)}
                  </span>
                </div>
              )}
              {invoice.cisRate > 0 && (
                <div className="flex justify-between px-4 text-red-700">
                  <span>Less CIS ({invoice.cisRate}%):</span>
                  <span>
                    -{currencySymbol(invoice.currency)}
                    {calculations.cis.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="border-t border-slate-300 my-2"></div>
            </>
          )}

          <div className="flex justify-between px-4 py-2 bg-slate-100 font-bold text-xl border-t-2 border-slate-800">
            <span>Total Due:</span>
            <span>
              {currencySymbol(invoice.currency)}
              {calculations.amountDue.toFixed(2)}
            </span>
          </div>
          <div className="px-4 flex justify-end">
            <PayNowLink invoice={invoice} amountDue={calculations.amountDue} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-12 text-sm">
        {invoice.showNotes !== false && invoice.notes ? (
          <div>
            <h4 className="font-bold border-b border-slate-300 mb-2">Notes</h4>
            <p className="whitespace-pre-line">{invoice.notes}</p>
          </div>
        ) : (
          <div></div>
        )}
        {invoice.showTerms !== false && invoice.terms ? (
          <div>
            <h4 className="font-bold border-b border-slate-300 mb-2">
              Terms & Conditions
            </h4>
            <p className="whitespace-pre-line">{invoice.terms}</p>
          </div>
        ) : (
          <div></div>
        )}
      </div>

      {invoice.reverseCharge && (
        <div className="mt-8 p-4 border border-slate-800 text-center text-sm font-semibold">
          VAT Act 1994 Section 55A applies. Customer to pay the VAT to HMRC.
        </div>
      )}

      <div className="absolute bottom-12 left-0 w-full text-center text-slate-400 text-xs italic">
        Thank you for your business.
      </div>
    </div>
  );
};

export const MinimalTemplate: React.FC<TemplateProps> = ({
  invoice,
  calculations,
  currencySymbol,
}) => {
  return (
    <div
      className="bg-white shadow-lg min-h-[1000px] p-12 relative print-only font-sans text-slate-900 border-t-8"
      style={{ borderColor: invoice.brandColor || "#0f172a" }}
    >
      <div className="flex justify-between items-end mb-16">
        <div>
          {invoice.logo && (
            <img
              src={invoice.logo}
              alt="Logo"
              className="h-16 object-contain mb-6"
            />
          )}
          <h1 className="text-3xl font-bold tracking-tight">
            {invoice.fromName || "Your Company"}
          </h1>
        </div>
        <div className="text-right">
          <h2
            className="text-6xl font-black tracking-tighter"
            style={{ color: invoice.brandColor || "#f1f5f9" }}
          >
            INVOICE
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-8 mb-16">
        <div className="col-span-2">
          <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">
            Billed To
          </h4>
          <p className="font-medium text-lg">{invoice.toName}</p>
          <p className="text-slate-500 whitespace-pre-line">
            {invoice.toAddress}
          </p>
          <p className="text-slate-500">{invoice.toEmail}</p>
          {invoice.clientVatNumber && (
            <p className="text-slate-500">VAT: {invoice.clientVatNumber}</p>
          )}
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">
            Invoice No.
          </h4>
          <p className="font-medium text-lg">#{invoice.invoiceNumber}</p>
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">
            Date Issued
          </h4>
          <p className="font-medium text-lg">{invoice.date}</p>
          {invoice.dueDate && (
            <>
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 mt-6">
                Due Date
              </h4>
              <p className="font-medium text-lg">{invoice.dueDate}</p>
            </>
          )}
        </div>
      </div>

      <div className="mb-12">
        {invoice.lineItems.map((item) => {
          const itemTaxRate =
            item.taxRate !== undefined ? item.taxRate : invoice.taxRate;
          const taxAmountString = itemTaxRate > 0 ? `${itemTaxRate}%` : "0%";
          return (
            <div
              key={item.id}
              className="grid grid-cols-12 gap-4 py-4 border-b border-slate-100 items-center"
            >
              <div className="col-span-1 border-r border-slate-100 text-slate-400 text-sm">
                {Number(item.quantity) || ""}
              </div>
              <div className="col-span-6 pl-4">
                <p className="font-medium text-lg">{item.description}</p>
                {item.isLabor && (
                  <span className="text-[10px] text-orange-700 mt-1.5 inline-flex items-center gap-1 bg-orange-50 px-2 py-0.5 rounded font-medium border border-orange-100">
                    <i className="fas fa-hard-hat"></i> Labour
                    {invoice.cisRate > 0 && " (CIS)"}
                  </span>
                )}
              </div>
              <div className="col-span-2 text-right text-slate-500">
                {currencySymbol(invoice.currency)}
                {(Number(item.rate) || 0).toFixed(2)}
                <div className="text-xs mt-1">
                  {invoice.reverseCharge ? "Rev Chg" : taxAmountString}
                </div>
              </div>
              <div className="col-span-3 text-right font-bold text-lg">
                {currencySymbol(invoice.currency)}
                {(
                  (Number(item.quantity) || 0) * (Number(item.rate) || 0)
                ).toFixed(2)}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end mb-16">
        <div className="w-1/2 md:w-1/3 space-y-4">
          <div className="flex justify-between text-slate-500">
            <span>Subtotal</span>
            <span>
              {currencySymbol(invoice.currency)}
              {calculations.subtotal.toFixed(2)}
            </span>
          </div>

          {invoice.discountRate > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Discount</span>
              <span>
                -{currencySymbol(invoice.currency)}
                {calculations.discount.toFixed(2)}
              </span>
            </div>
          )}

          {!invoice.reverseCharge &&
            Object.values(calculations.taxBreakdown).map((tax, i) => (
              <div key={i} className="flex justify-between text-slate-500">
                <span>{tax.name}</span>
                <span>
                  {currencySymbol(invoice.currency)}
                  {tax.amount.toFixed(2)}
                </span>
              </div>
            ))}

          {(invoice.retentionRate > 0 || invoice.cisRate > 0) && (
            <div className="space-y-2">
              <div className="flex justify-between text-slate-800 font-medium">
                <span>Gross Total</span>
                <span>
                  {currencySymbol(invoice.currency)}
                  {calculations.total.toFixed(2)}
                </span>
              </div>
              {invoice.retentionRate > 0 && (
                <div className="flex justify-between text-red-500">
                  <span>Less Retention ({invoice.retentionRate}%)</span>
                  <span>
                    -{currencySymbol(invoice.currency)}
                    {calculations.retention.toFixed(2)}
                  </span>
                </div>
              )}
              {invoice.cisRate > 0 && (
                <div className="flex justify-between text-red-500">
                  <span>Less CIS Deduction ({invoice.cisRate}%)</span>
                  <span>
                    -{currencySymbol(invoice.currency)}
                    {calculations.cis.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between font-black text-3xl pt-6 border-t border-slate-900">
            <span>Amount Due</span>
            <span>
              {currencySymbol(invoice.currency)}
              {calculations.amountDue.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-end">
            <PayNowLink invoice={invoice} amountDue={calculations.amountDue} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-12 text-sm text-slate-500">
        {invoice.showTerms !== false && invoice.terms ? (
          <div>
            <h4 className="font-bold text-slate-900 mb-2">Payment Details</h4>
            <p className="whitespace-pre-line">{invoice.terms}</p>
          </div>
        ) : (
          <div></div>
        )}
        {invoice.showNotes !== false && invoice.notes ? (
          <div>
            <h4 className="font-bold text-slate-900 mb-2">Notes</h4>
            <p className="whitespace-pre-line">{invoice.notes}</p>
          </div>
        ) : (
          <div>
            <h4 className="font-bold text-slate-900 mb-2">From</h4>
            <p className="font-medium text-slate-900">{invoice.fromName}</p>
            <p className="whitespace-pre-line">{invoice.fromAddress}</p>
            <p>{invoice.fromEmail}</p>
          </div>
        )}
      </div>
      {invoice.showNotes !== false && invoice.notes && (
        <div className="mt-12 pt-6 border-t border-slate-100 grid grid-cols-2 gap-12 text-sm text-slate-500">
          <div className="col-start-2">
            <h4 className="font-bold text-slate-900 mb-2">From</h4>
            <p className="font-medium text-slate-900">{invoice.fromName}</p>
            <p className="whitespace-pre-line">{invoice.fromAddress}</p>
            <p>{invoice.fromEmail}</p>
          </div>
        </div>
      )}

      {invoice.reverseCharge && (
        <div className="mt-12 text-xs text-slate-400 uppercase tracking-widest text-center">
          VAT Reverse Charge Applies
        </div>
      )}
    </div>
  );
};
