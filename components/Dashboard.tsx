import React, { useEffect, useState, useMemo } from "react";
import {
  Invoice,
  FinancialInsight,
  Client,
  Transaction,
  TaxRule,
} from "../types";
import { generateFinancialInsights } from "../services/aiService";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface DashboardProps {
  invoices: Invoice[];
  clients: Client[];
  transactions: Transaction[];
  taxRules: TaxRule[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-4 rounded-xl shadow-xl border border-slate-200 min-w-[200px]">
        <div className="text-slate-500 font-medium mb-1 text-sm">
          {data.dateRange}
        </div>
        <div className="text-xl font-bold text-slate-800 mb-2">
          £
          {data.value.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>
        <div className="text-sm font-medium text-blue-600 bg-blue-50 inline-block px-2 py-1 rounded">
          {data.percentage}% of total revenue
        </div>
      </div>
    );
  }
  return null;
};

const Dashboard: React.FC<DashboardProps> = ({
  invoices,
  clients,
  transactions,
  taxRules,
}) => {
  const [insight, setInsight] = useState<FinancialInsight | null>(null);
  const [loading, setLoading] = useState(false);

  const stats = useMemo(() => {
    const totalRevenue = invoices.reduce(
      (sum, inv) =>
        sum +
        inv.lineItems.reduce((s, item) => s + item.quantity * item.rate, 0),
      0,
    );
    const paidInvoices = invoices.filter((i) => i.status === "Paid");
    const pendingInvoices = invoices.filter((i) => i.status !== "Paid");
    const paidAmount = paidInvoices.reduce(
      (sum, inv) =>
        sum +
        inv.lineItems.reduce((s, item) => s + item.quantity * item.rate, 0),
      0,
    );

    const totalExpenses = transactions
      .filter((t) => t.type === "Expense")
      .reduce((sum, t) => sum + t.amount, 0);

    const netProfit = paidAmount - totalExpenses;

    const collectionRatio =
      totalRevenue > 0 ? (paidAmount / totalRevenue) * 100 : 0;
    const netProfitMargin = paidAmount > 0 ? (netProfit / paidAmount) * 100 : 0;
    const avgInvoiceValue =
      invoices.length > 0 ? totalRevenue / invoices.length : 0;

    return {
      totalRevenue,
      paidAmount,
      pendingCount: pendingInvoices.length,
      totalCount: invoices.length,
      totalExpenses,
      netProfit,
      collectionRatio,
      netProfitMargin,
      avgInvoiceValue,
    };
  }, [invoices, transactions]);

  const chartData = useMemo(() => {
    const map = new Map<
      string,
      { value: number; year: number; month: number }
    >();
    let totalAllMonths = 0;

    invoices.forEach((inv) => {
      const date = new Date(inv.date || Date.now());
      const year = date.getFullYear();
      const month = date.getMonth();
      const key = `${year}-${month}`;
      const amount = inv.lineItems.reduce(
        (s, item) => s + item.quantity * item.rate,
        0,
      );

      if (!map.has(key)) {
        map.set(key, { value: 0, year, month });
      }
      map.get(key)!.value += amount;
      totalAllMonths += amount;
    });

    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    return Array.from(map.values())
      .sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      })
      .map((data) => {
        const monthName = monthNames[data.month];
        const name = `${monthName} ${data.year}`;

        const lastDay = new Date(data.year, data.month + 1, 0).getDate();
        const dateRange = `1 ${monthName} - ${lastDay} ${monthName} ${data.year}`;

        const percentage =
          totalAllMonths > 0
            ? ((data.value / totalAllMonths) * 100).toFixed(1)
            : "0.0";

        return {
          name,
          value: data.value,
          dateRange,
          percentage,
        };
      });
  }, [invoices]);

  const handleGenerateInsights = async () => {
    setLoading(true);
    const result = await generateFinancialInsights(invoices, clients, taxRules);
    setInsight(result);
    setLoading(false);
  };

  return (
    <div className="p-6 space-y-8 animate-fade-in">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-slate-800">
          Financial Dashboard
        </h2>
        <button
          onClick={handleGenerateInsights}
          disabled={loading || invoices.length === 0}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all disabled:opacity-50"
        >
          {loading ? (
            <i className="fas fa-spinner fa-spin"></i>
          ) : (
            <i className="fas fa-wand-magic-sparkles"></i>
          )}
          Analyze with AI
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="text-sm text-slate-500 mb-1">
            Total Revenue (Invoiced)
          </div>
          <div className="text-3xl font-bold text-slate-900">
            £{stats.totalRevenue.toLocaleString()}
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="text-sm text-slate-500 mb-1">Cash Collected</div>
          <div className="text-3xl font-bold text-green-600">
            £{stats.paidAmount.toLocaleString()}
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="text-sm text-slate-500 mb-1">Total Expenses</div>
          <div className="text-3xl font-bold text-red-600">
            £{stats.totalExpenses.toLocaleString()}
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="text-sm text-slate-500 mb-1">Net Profit (Cash)</div>
          <div
            className={`text-3xl font-bold ${stats.netProfit >= 0 ? "text-slate-900" : "text-red-600"}`}
          >
            £{stats.netProfit.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Key Financial Ratios */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-8">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-indigo-500">
          <div className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-1">
            Collection Ratio
          </div>
          <div className="flex items-end gap-3">
            <div className="text-2xl font-bold text-slate-800">
              {stats.collectionRatio.toFixed(1)}%
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Cash collected vs Billed
          </p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-emerald-500">
          <div className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-1">
            Net Profit Margin
          </div>
          <div className="flex items-end gap-3">
            <div
              className={`text-2xl font-bold ${stats.netProfitMargin >= 0 ? "text-slate-800" : "text-red-600"}`}
            >
              {stats.netProfitMargin.toFixed(1)}%
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Profit per £1 of cash collected
          </p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-blue-500">
          <div className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-1">
            Avg Invoice Value
          </div>
          <div className="flex items-end gap-3">
            <div className="text-2xl font-bold text-slate-800">
              £
              {stats.avgInvoiceValue.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Average value of billed invoices
          </p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-80">
          <h3 className="text-lg font-semibold mb-4 text-slate-700">
            Revenue Stream
          </h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "#f1f5f9" }}
                  content={<CustomTooltip />}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={index % 2 === 0 ? "#2563eb" : "#60a5fa"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400">
              No data available
            </div>
          )}
        </div>

        {/* AI Insights */}
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-xl border border-indigo-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <i className="fas fa-brain text-8xl text-indigo-900"></i>
          </div>

          <h3 className="text-lg font-semibold mb-4 text-indigo-900 flex items-center gap-2">
            <i className="fas fa-robot text-indigo-600"></i> AI Accountant
            Insights
          </h3>

          {insight ? (
            <div className="space-y-4 relative z-10">
              <div className="bg-white/60 p-3 rounded-lg backdrop-blur-sm">
                <p className="text-sm font-medium text-indigo-900">Summary</p>
                <p className="text-slate-700 text-sm mt-1">{insight.summary}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-indigo-900 mb-2">
                  Actionable Recommendations
                </p>
                <div className="space-y-3">
                  {insight.recommendations.map((rec, idx) => {
                    const isOverdue = rec.type === "overdue";
                    const isOptimize = rec.type === "optimization";
                    const isTax = rec.type === "tax";

                    return (
                      <div
                        key={idx}
                        className="bg-white/80 p-4 rounded-xl backdrop-blur-sm border border-white flex items-start gap-3 shadow-sm transition-all hover:shadow-md"
                      >
                        <div
                          className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isOverdue ? "bg-red-100 text-red-600" : isOptimize ? "bg-blue-100 text-blue-600" : isTax ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"}`}
                        >
                          <i
                            className={`fas ${isOverdue ? "fa-exclamation-triangle" : isOptimize ? "fa-chart-line" : isTax ? "fa-file-invoice-dollar" : "fa-lightbulb"} text-sm`}
                          ></i>
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-bold text-slate-800 mb-1">
                            {rec.title}
                          </h4>
                          <p className="text-sm text-slate-600 leading-relaxed mb-2">
                            {rec.description}
                          </p>
                          <div className="bg-slate-50/50 p-2 rounded-lg border border-slate-100 flex items-start gap-2">
                            <i className="fas fa-arrow-right text-indigo-400 mt-0.5 text-xs"></i>
                            <p className="text-sm font-medium text-indigo-700">
                              {rec.actionableStep}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                <p className="text-sm font-medium text-red-800">
                  Risk Assessment
                </p>
                <p className="text-red-600 text-sm mt-1">
                  {insight.riskAssessment}
                </p>
              </div>
            </div>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-center relative z-10">
              <p className="text-indigo-400 mb-2">
                Click "Analyze with AI" to get personalized financial advice
                based on your invoices.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
