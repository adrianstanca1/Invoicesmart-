import React, { useState, useRef, useEffect } from "react";
import { Transaction, Invoice, FinancialReport } from "../types";
import {
  chatWithAccountant,
  generateDetailedReport,
  parseReceiptFromImage,
} from "../services/aiService";
import ReactMarkdown from "react-markdown";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface LedgerProps {
  transactions: Transaction[];
  invoices: Invoice[];
  onAddTransaction: (transaction: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
}

const COLORS = [
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#8884d8",
  "#82ca9d",
];

const Ledger: React.FC<LedgerProps> = ({
  transactions,
  invoices,
  onAddTransaction,
  onDeleteTransaction,
}) => {
  const [activeTab, setActiveTab] = useState<
    "ledger" | "reports" | "retentions"
  >("ledger");
  const [chatMessages, setChatMessages] = useState<
    { role: "user" | "ai"; content: string }[]
  >([
    {
      role: "ai",
      content:
        "Hello! I'm your AI Accountant. I can manage your ledger, generate P&L reports, and estimate your taxes. How can I assist you?",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [isAdding, setIsAdding] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [newTx, setNewTx] = useState<Partial<Transaction>>({
    date: new Date().toISOString().split("T")[0],
    description: "",
    amount: 0,
    type: "Expense",
    category: "",
  });

  const [currentReport, setCurrentReport] = useState<FinancialReport | null>(
    null,
  );
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const [filterType, setFilterType] = useState<"All" | "Income" | "Expense">(
    "All",
  );
  const [dateRangeFilter, setDateRangeFilter] = useState<
    "All" | "This Month" | "Last 30 Days" | "This Year"
  >("All");

  const filteredTransactions = React.useMemo(() => {
    let filtered = transactions;

    if (filterType !== "All") {
      filtered = filtered.filter((t) => t.type === filterType);
    }

    if (dateRangeFilter !== "All") {
      const today = new Date();
      filtered = filtered.filter((t) => {
        const txDate = new Date(t.date);
        if (dateRangeFilter === "This Month") {
          return (
            txDate.getMonth() === today.getMonth() &&
            txDate.getFullYear() === today.getFullYear()
          );
        }
        if (dateRangeFilter === "Last 30 Days") {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(today.getDate() - 30);
          return txDate >= thirtyDaysAgo;
        }
        if (dateRangeFilter === "This Year") {
          return txDate.getFullYear() === today.getFullYear();
        }
        return true;
      });
    }

    return filtered.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [transactions, filterType, dateRangeFilter]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const totalIncome = filteredTransactions
    .filter((t) => t.type === "Income")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = filteredTransactions
    .filter((t) => t.type === "Expense")
    .reduce((sum, t) => sum + t.amount, 0);
  const netProfit = totalIncome - totalExpense;

  const exportCSV = () => {
    const headers = ["Date", "Description", "Category", "Type", "Amount"];
    const rows = filteredTransactions
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map((tx) => [
        tx.date,
        `"${tx.description.replace(/"/g, '""')}"`,
        tx.category,
        tx.type,
        tx.amount.toFixed(2),
      ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "ledger_transactions.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPDF = () => {
    const doc = new jsPDF();

    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(0, 0, 210, 40, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.text("Ledger Transactions", 14, 25);

    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 32);

    const tableData = filteredTransactions
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map((tx) => [
        tx.date,
        tx.description,
        tx.category,
        tx.type,
        `£${tx.amount.toFixed(2)}`,
      ]);

    autoTable(doc, {
      head: [["Date", "Description", "Category", "Type", "Amount"]],
      body: tableData,
      startY: 50,
      theme: "grid",
      headStyles: { fillColor: [59, 130, 246] }, // blue-500
      alternateRowStyles: { fillColor: [248, 250, 252] }, // slate-50
      styles: { fontSize: 10, cellPadding: 5 },
    });

    doc.save("ledger_transactions.pdf");
  };

  const handleScanReceipt = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        setIsScanning(true);
        const base64 = reader.result as string;
        const result = await parseReceiptFromImage(base64);
        if (result) {
          setNewTx({
            ...newTx,
            ...result,
            type: "Expense", // Ensure it's an expense
          });
          setIsAdding(true); // Open modal with pre-filled data
        }
        setIsScanning(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isChatting) return;

    const userMsg = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setIsChatting(true);

    const response = await chatWithAccountant(userMsg, transactions, invoices, chatMessages);

    if (response.newTransactions && response.newTransactions.length > 0) {
      response.newTransactions.forEach((tx) => {
        onAddTransaction({
          id: crypto.randomUUID(),
          date: tx.date || new Date().toISOString().split("T")[0],
          description: tx.description || "New Transaction",
          amount: tx.amount || 0,
          type:
            (tx.type as string).toLowerCase() === "income"
              ? "Income"
              : "Expense",
          category: tx.category || "Uncategorized",
        });
      });
    }

    if (response.report) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "ai",
          content:
            "I'm generating that report for you now... check the Reports tab in a moment.",
        },
      ]);
      setIsGeneratingReport(true);
      const reportData = await generateDetailedReport(
        transactions,
        response.report.period,
      );
      setCurrentReport(reportData);
      setIsGeneratingReport(false);
      setActiveTab("reports");
      setChatMessages((prev) => [
        ...prev,
        {
          role: "ai",
          content: "Report generated! I've switched you to the Reports view.",
        },
      ]);
    } else {
      setChatMessages((prev) => [
        ...prev,
        { role: "ai", content: response.text },
      ]);
    }

    setIsChatting(false);
  };

  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTx.description || !newTx.amount || !newTx.category) {
      alert("Please fill in all fields.");
      return;
    }
    onAddTransaction({
      id: crypto.randomUUID(),
      date: newTx.date || new Date().toISOString().split("T")[0],
      description: newTx.description,
      amount: Number(newTx.amount),
      type: newTx.type as "Income" | "Expense",
      category: newTx.category,
    });
    setIsAdding(false);
    setNewTx({
      date: new Date().toISOString().split("T")[0],
      description: "",
      amount: 0,
      type: "Expense",
      category: "",
    });
  };

  // Prepare Chart Data
  const categoryData = React.useMemo(() => {
    return transactions
      .filter((t) => t.type === "Expense")
      .reduce(
        (acc, t) => {
          const existing = acc.find((i) => i.name === t.category);
          if (existing) {
            existing.value += t.amount;
          } else {
            acc.push({ name: t.category, value: t.amount });
          }
          return acc;
        },
        [] as { name: string; value: number }[],
      );
  }, [transactions]);

  return (
    <div className="flex flex-col xl:flex-row gap-6 p-4 md:p-8 max-w-7xl mx-auto h-[calc(100vh-2rem)]">
      {/* LEFT COLUMN: MAIN CONTENT */}
      <div className="flex-1 flex flex-col space-y-6 overflow-hidden">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-slate-800">Financial Hub</h2>
            <div className="flex bg-slate-200 rounded-lg p-1">
              <button
                onClick={() => setActiveTab("ledger")}
                className={`px-4 py-1 rounded-md text-sm font-medium transition-all ${activeTab === "ledger" ? "bg-white shadow text-slate-800" : "text-slate-500 hover:text-slate-700"}`}
              >
                Ledger
              </button>
              <button
                onClick={() => setActiveTab("reports")}
                className={`px-4 py-1 rounded-md text-sm font-medium transition-all ${activeTab === "reports" ? "bg-white shadow text-slate-800" : "text-slate-500 hover:text-slate-700"}`}
              >
                Reports & Analytics
              </button>
              <button
                onClick={() => setActiveTab("retentions")}
                className={`px-4 py-1 rounded-md text-sm font-medium transition-all ${activeTab === "retentions" ? "bg-white shadow text-slate-800" : "text-slate-500 hover:text-slate-700"}`}
              >
                Retentions & CIS
              </button>
            </div>
          </div>
          {activeTab === "ledger" && (
            <div className="flex gap-2">
              <button
                onClick={exportCSV}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                title="Export CSV"
              >
                <i className="fas fa-file-csv"></i>
              </button>
              <button
                onClick={exportPDF}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                title="Export PDF"
              >
                <i className="fas fa-file-pdf"></i>
              </button>
              <label className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center gap-2">
                {isScanning ? (
                  <i className="fas fa-spinner fa-spin"></i>
                ) : (
                  <i className="fas fa-camera"></i>
                )}
                Scan Receipt
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleScanReceipt}
                  disabled={isScanning}
                />
              </label>
              <button
                onClick={() => setIsAdding(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <i className="fas fa-plus mr-2"></i> Add Transaction
              </button>
            </div>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4 shrink-0">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <p className="text-sm text-slate-500 font-medium mb-1">
              Total Income
            </p>
            <p className="text-2xl font-bold text-green-600">
              £{totalIncome.toFixed(2)}
            </p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <p className="text-sm text-slate-500 font-medium mb-1">
              Total Expenses
            </p>
            <p className="text-2xl font-bold text-red-600">
              £{totalExpense.toFixed(2)}
            </p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <p className="text-sm text-slate-500 font-medium mb-1">
              Net Profit
            </p>
            <p
              className={`text-2xl font-bold ${netProfit >= 0 ? "text-slate-800" : "text-red-600"}`}
            >
              £{netProfit.toFixed(2)}
            </p>
          </div>
        </div>

        {/* CONTENT AREA */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 overflow-hidden flex flex-col relative">
          {activeTab === "ledger" && (
            <div className="flex flex-col h-full">
              <div className="flex gap-4 p-4 border-b border-slate-200 bg-slate-50 shrink-0">
                <select
                  className="bg-white border border-slate-300 text-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block px-3 py-2"
                  value={filterType}
                  onChange={(e) =>
                    setFilterType(
                      e.target.value as "All" | "Income" | "Expense",
                    )
                  }
                >
                  <option value="All">All Types</option>
                  <option value="Income">Income</option>
                  <option value="Expense">Expense</option>
                </select>

                <select
                  className="bg-white border border-slate-300 text-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block px-3 py-2"
                  value={dateRangeFilter}
                  onChange={(e) =>
                    setDateRangeFilter(
                      e.target.value as
                        | "All"
                        | "This Month"
                        | "Last 30 Days"
                        | "This Year",
                    )
                  }
                >
                  <option value="All">All Time</option>
                  <option value="This Month">This Month</option>
                  <option value="Last 30 Days">Last 30 Days</option>
                  <option value="This Year">This Year</option>
                </select>
              </div>
              <div className="overflow-y-auto flex-1">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr>
                      <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b">
                        Date
                      </th>
                      <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b">
                        Description
                      </th>
                      <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b">
                        Category
                      </th>
                      <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b text-right">
                        Amount
                      </th>
                      <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-8 text-center text-slate-400"
                        >
                          No transactions found matching the filter.
                        </td>
                      </tr>
                    ) : (
                      filteredTransactions.map((tx) => (
                        <tr
                          key={tx.id}
                          className="border-b border-slate-100 hover:bg-slate-50"
                        >
                          <td className="py-3 px-4 text-sm text-slate-600 whitespace-nowrap">
                            {tx.date}
                          </td>
                          <td className="py-3 px-4 text-sm font-medium text-slate-800">
                            {tx.description}
                          </td>
                          <td className="py-3 px-4 text-sm text-slate-500">
                            <span className="bg-slate-100 px-2 py-1 rounded text-xs">
                              {tx.category}
                            </span>
                          </td>
                          <td
                            className={`py-3 px-4 text-sm font-bold text-right ${tx.type === "Income" ? "text-green-600" : "text-slate-800"}`}
                          >
                            {tx.type === "Income" ? "+" : "-"}£
                            {tx.amount.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => onDeleteTransaction(tx.id)}
                              className="text-slate-300 hover:text-red-500 transition-colors"
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "retentions" && (
            <div className="overflow-y-auto flex-1 p-6 space-y-6">
              <h3 className="text-xl font-bold text-slate-800 border-b border-slate-200 pb-2">
                Retentions & CIS Trail
              </h3>
              <p className="text-sm text-slate-500 mb-4">
                This ledger tracks all tax deductions (CIS) paid at source, and
                retentions withheld by clients on your construction projects.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                  <p className="text-sm text-amber-700 font-semibold mb-1">
                    Total Retention Withheld
                  </p>
                  <p className="text-2xl font-bold text-amber-600">
                    £
                    {transactions
                      .filter((t) => t.category === "Retention Withheld")
                      .reduce((acc, t) => acc + t.amount, 0)
                      .toFixed(2)}
                  </p>
                </div>
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                  <p className="text-sm text-blue-700 font-semibold mb-1">
                    Total CIS Tax Paid
                  </p>
                  <p className="text-2xl font-bold text-blue-600">
                    £
                    {transactions
                      .filter((t) => t.category === "CIS Tax Deducted")
                      .reduce((acc, t) => acc + t.amount, 0)
                      .toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden mt-6">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions
                      .filter(
                        (t) =>
                          t.category === "Retention Withheld" ||
                          t.category === "CIS Tax Deducted",
                      )
                      .sort(
                        (a, b) =>
                          new Date(b.date).getTime() -
                          new Date(a.date).getTime(),
                      )
                      .map((tx) => (
                        <tr key={tx.id} className="border-t border-slate-100">
                          <td className="py-3 px-4 text-sm text-slate-600">
                            {tx.date}
                          </td>
                          <td className="py-3 px-4 text-sm font-medium text-slate-800">
                            {tx.description}
                          </td>
                          <td className="py-3 px-4 text-sm">
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${tx.category === "Retention Withheld" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}
                            >
                              {tx.category}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm font-bold text-right text-slate-700">
                            £{tx.amount.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    {transactions.filter(
                      (t) =>
                        t.category === "Retention Withheld" ||
                        t.category === "CIS Tax Deducted",
                    ).length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="py-8 text-center text-slate-400"
                        >
                          No retention or CIS records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "reports" && (
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-sm font-bold text-slate-500 uppercase mb-4">
                    Expense Breakdown
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) =>
                            `${name} ${(percent * 100).toFixed(0)}%`
                          }
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {categoryData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => `£${value.toFixed(2)}`}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* AI Report Section */}
                <div>
                  <h3 className="text-sm font-bold text-slate-500 uppercase mb-4">
                    AI Financial Report
                  </h3>
                  {isGeneratingReport ? (
                    <div className="flex items-center justify-center h-64 text-slate-400">
                      <div className="text-center">
                        <i className="fas fa-spinner fa-spin text-3xl mb-2"></i>
                        <p>Analyzing financial data...</p>
                      </div>
                    </div>
                  ) : currentReport ? (
                    <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 text-sm space-y-4 h-64 overflow-y-auto">
                      <div className="flex justify-between border-b pb-2">
                        <span className="font-bold">Period</span>
                        <span>{currentReport.period}</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span>Revenue</span>
                          <span className="font-medium">
                            £{currentReport.profitAndLoss.revenue.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-500">
                          <span>Cost of Sales</span>
                          <span>
                            (£
                            {currentReport.profitAndLoss.costOfSales.toFixed(2)}
                            )
                          </span>
                        </div>
                        <div className="flex justify-between font-bold pt-1 border-t border-slate-200">
                          <span>Gross Profit</span>
                          <span>
                            £
                            {currentReport.profitAndLoss.grossProfit.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1 pt-2">
                        <div className="font-semibold text-slate-500 text-xs uppercase">
                          Tax Estimates
                        </div>
                        <div className="flex justify-between">
                          <span>Est. Corporation Tax</span>
                          <span className="text-amber-600">
                            £
                            {currentReport.taxEstimates?.corporationTax.toFixed(
                              2,
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Est. VAT Due</span>
                          <span className="text-amber-600">
                            £{currentReport.taxEstimates?.vatDue.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2">
                        <div className="font-semibold text-slate-500 text-xs uppercase mb-1">
                          Insights
                        </div>
                        <ul className="list-disc list-inside text-slate-600 space-y-1">
                          {currentReport.insights.map((insight, i) => (
                            <li key={i}>{insight}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-64 text-slate-400 border-2 border-dashed border-slate-200 rounded-lg">
                      <p>Ask the AI Accountant to "Generate a report"</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: AI ACCOUNTANT */}
      <div className="w-full xl:w-[400px] shrink-0 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-900 text-white p-4 flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-xl">
            <i className="fas fa-robot"></i>
          </div>
          <div>
            <h3 className="font-bold">AI Accountant</h3>
            <p className="text-xs text-blue-200">Online & ready to help</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
          {chatMessages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-3 text-sm ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-tr-sm"
                    : "bg-white border border-slate-200 text-slate-700 rounded-tl-sm shadow-sm"
                }`}
              >
                {msg.role === "ai" ? (
                  <div className="markdown-body prose prose-sm max-w-none">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}
          {isChatting && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-200 text-slate-400 rounded-2xl rounded-tl-sm p-3 shadow-sm flex gap-1">
                <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce"></span>
                <span
                  className="w-2 h-2 bg-slate-300 rounded-full animate-bounce"
                  style={{ animationDelay: "0.2s" }}
                ></span>
                <span
                  className="w-2 h-2 bg-slate-300 rounded-full animate-bounce"
                  style={{ animationDelay: "0.4s" }}
                ></span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="p-4 bg-white border-t border-slate-200 shrink-0">
          <div className="relative">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              placeholder="Ask about your finances..."
              className="w-full bg-slate-100 border-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-full py-2 pl-4 pr-12 text-sm transition-all outline-none"
              disabled={isChatting}
            />
            <button
              onClick={handleSendMessage}
              disabled={isChatting || !chatInput.trim()}
              className="absolute right-1 top-1 bottom-1 w-8 h-8 flex items-center justify-center bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-full transition-colors"
            >
              <i className="fas fa-paper-plane text-xs"></i>
            </button>
          </div>
        </div>
      </div>

      {/* ADD TRANSACTION MODAL */}
      {isAdding && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Manual Transaction</h3>
            <form onSubmit={handleManualAdd} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Type
                  </label>
                  <select
                    className="w-full border rounded-lg px-3 py-2"
                    value={newTx.type}
                    onChange={(e) =>
                      setNewTx({
                        ...newTx,
                        type: e.target.value as "Income" | "Expense",
                      })
                    }
                  >
                    <option value="Expense">Expense</option>
                    <option value="Income">Income</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    className="w-full border rounded-lg px-3 py-2"
                    value={newTx.date}
                    onChange={(e) =>
                      setNewTx({ ...newTx, date: e.target.value })
                    }
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description
                </label>
                <input
                  required
                  type="text"
                  className="w-full border rounded-lg px-3 py-2"
                  value={newTx.description}
                  onChange={(e) =>
                    setNewTx({ ...newTx, description: e.target.value })
                  }
                  placeholder="e.g. Office Supplies"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Amount (£)
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-full border rounded-lg px-3 py-2"
                    value={
                      newTx.amount === 0
                        ? ""
                        : Number.isNaN(newTx.amount as number)
                          ? ""
                          : newTx.amount
                    }
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setNewTx({ ...newTx, amount: isNaN(val) ? 0 : val });
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Category
                  </label>
                  <input
                    required
                    type="text"
                    className="w-full border rounded-lg px-3 py-2"
                    value={newTx.category}
                    onChange={(e) =>
                      setNewTx({ ...newTx, category: e.target.value })
                    }
                    placeholder="e.g. Software, Travel"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Ledger;
