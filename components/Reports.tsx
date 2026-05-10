import React, { useMemo, useState } from 'react';
import { Invoice } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ReportsProps {
  invoices: Invoice[];
}

const Reports: React.FC<ReportsProps> = ({ invoices }) => {
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (!startDate && !endDate) return true;
      const invDate = new Date(inv.date).getTime();
      const start = startDate ? new Date(startDate).getTime() : -Infinity;
      const end = endDate ? new Date(endDate).getTime() : Infinity;
      return invDate >= start && invDate <= end;
    });
  }, [invoices, startDate, endDate]);

  const summary = useMemo(() => {
    let totalRevenue = 0;
    let totalTax = 0;
    let netRevenue = 0;

    filteredInvoices.forEach(inv => {
      const subtotal = inv.lineItems.reduce((acc, item) => acc + (item.quantity * item.rate), 0);
      const discount = subtotal * (inv.discountRate / 100);
      
      let tax = 0;
      if (!inv.reverseCharge) {
        tax = inv.lineItems.reduce((acc, item) => {
          const rate = item.taxRate ?? inv.taxRate;
          return acc + ((item.quantity * item.rate) * (rate / 100));
        }, 0);
      }

      totalRevenue += (subtotal + tax - discount);
      totalTax += tax;
      netRevenue += (subtotal - discount);
    });

    return { totalRevenue, totalTax, netRevenue };
  }, [filteredInvoices]);

  const monthlyData = useMemo(() => {
    const map = new Map<string, { revenue: number; tax: number }>();
    
    filteredInvoices.forEach(inv => {
      const date = new Date(inv.date || Date.now());
      const key = date.toLocaleString('default', { month: 'short', year: '2-digit' });
      
      const subtotal = inv.lineItems.reduce((acc, item) => acc + (item.quantity * item.rate), 0);
      const discount = subtotal * (inv.discountRate / 100);
      let tax = 0;
      if (!inv.reverseCharge) {
        tax = inv.lineItems.reduce((acc, item) => {
          const rate = item.taxRate ?? inv.taxRate;
          return acc + ((item.quantity * item.rate) * (rate / 100));
        }, 0);
      }
      
      const current = map.get(key) || { revenue: 0, tax: 0 };
      map.set(key, {
        revenue: current.revenue + (subtotal - discount),
        tax: current.tax + tax
      });
    });

    return Array.from(map.entries()).map(([name, data]) => ({
      name,
      Revenue: data.revenue,
      Tax: data.tax
    }));
  }, [filteredInvoices]);

  const taxBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    
    filteredInvoices.forEach(inv => {
      if (inv.reverseCharge) return;
      
      inv.lineItems.forEach(item => {
        const rate = item.taxRate ?? inv.taxRate;
        const taxAmount = (item.quantity * item.rate) * (rate / 100);
        const key = `${rate}% Rate`;
        map.set(key, (map.get(key) || 0) + taxAmount);
      });
    });

    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [filteredInvoices]);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  const exportCSV = () => {
    const headers = ['Invoice #', 'Date', 'Client', 'Net', 'Tax', 'Total'];
    const rows = filteredInvoices.map(inv => {
      const subtotal = inv.lineItems.reduce((acc, item) => acc + (item.quantity * item.rate), 0);
      const discount = subtotal * (inv.discountRate / 100);
      let tax = 0;
      if (!inv.reverseCharge) {
        tax = inv.lineItems.reduce((acc, item) => {
          const rate = item.taxRate ?? inv.taxRate;
          return acc + ((item.quantity * item.rate) * (rate / 100));
        }, 0);
      }
      const total = subtotal + tax - discount;

      return [
        inv.invoiceNumber,
        inv.date,
        `"${inv.toName.replace(/"/g, '""')}"`,
        (subtotal - discount).toFixed(2),
        tax.toFixed(2),
        total.toFixed(2)
      ];
    });
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "financial_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    
    // Add header styling
    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.text("Financial Report", 14, 25);
    
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 32);

    // Summary section
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(14);
    doc.text("Executive Summary", 14, 55);
    
    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(`Total Revenue (Gross): £${summary.totalRevenue.toFixed(2)}`, 14, 65);
    doc.text(`Net Revenue (Excl. Tax): £${summary.netRevenue.toFixed(2)}`, 14, 72);
    doc.text(`Total Tax Liability: £${summary.totalTax.toFixed(2)}`, 14, 79);

    const tableData = filteredInvoices.map(inv => {
      const subtotal = inv.lineItems.reduce((acc, item) => acc + (item.quantity * item.rate), 0);
      const discount = subtotal * (inv.discountRate / 100);
      let tax = 0;
      if (!inv.reverseCharge) {
        tax = inv.lineItems.reduce((acc, item) => {
          const rate = item.taxRate ?? inv.taxRate;
          return acc + ((item.quantity * item.rate) * (rate / 100));
        }, 0);
      }
      const total = subtotal + tax - discount;

      return [
        inv.invoiceNumber,
        inv.date,
        inv.toName,
        `£${(subtotal - discount).toFixed(2)}`,
        `£${tax.toFixed(2)}`,
        `£${total.toFixed(2)}`
      ];
    });

    autoTable(doc, {
      head: [['Invoice #', 'Date', 'Client', 'Net', 'Tax', 'Total']],
      body: tableData,
      startY: 90,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] }, // blue-500
      alternateRowStyles: { fillColor: [248, 250, 252] }, // slate-50
      styles: { fontSize: 10, cellPadding: 5 },
    });
    
    doc.save("financial_report.pdf");
  };

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-slate-800">Financial Reports</h2>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg flex items-center gap-2 transition-all">
            <i className="fas fa-file-csv"></i> Export CSV
          </button>
          <button onClick={exportPDF} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg flex items-center gap-2 transition-all">
            <i className="fas fa-file-pdf"></i> Export PDF
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex gap-4 items-end mb-8">
        <div>
          <label className="block text-sm font-medium text-slate-500 mb-1">Start Date</label>
          <input 
            type="date" 
            className="border rounded px-3 py-2 text-slate-700"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-500 mb-1">End Date</label>
          <input 
            type="date" 
            className="border rounded px-3 py-2 text-slate-700"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <div className="ml-auto">
          <button 
            type="button" 
            className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
            onClick={() => { setStartDate(''); setEndDate(''); }}
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="text-sm text-slate-500 mb-1">Total Revenue (Gross)</div>
          <div className="text-3xl font-bold text-slate-900">£{summary.totalRevenue.toFixed(2)}</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="text-sm text-slate-500 mb-1">Net Revenue (Excl. Tax)</div>
          <div className="text-3xl font-bold text-blue-600">£{summary.netRevenue.toFixed(2)}</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="text-sm text-slate-500 mb-1">Total Tax Liability</div>
          <div className="text-3xl font-bold text-orange-500">£{summary.totalTax.toFixed(2)}</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-96">
          <h3 className="text-lg font-semibold mb-4 text-slate-700">Monthly Revenue & Tax</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} />
              <Tooltip cursor={{fill: '#f1f5f9'}} />
              <Legend />
              <Bar dataKey="Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Tax" fill="#f97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-96">
          <h3 className="text-lg font-semibold mb-4 text-slate-700">Tax Breakdown by Rate</h3>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={taxBreakdown}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                fill="#8884d8"
                paddingAngle={5}
                dataKey="value"
              >
                {taxBreakdown.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800">Invoice Details</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="p-4 font-semibold text-slate-600">Invoice #</th>
                <th className="p-4 font-semibold text-slate-600">Date</th>
                <th className="p-4 font-semibold text-slate-600">Client</th>
                <th className="p-4 font-semibold text-slate-600 text-right">Net</th>
                <th className="p-4 font-semibold text-slate-600 text-right">Tax</th>
                <th className="p-4 font-semibold text-slate-600 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    No invoices found for the selected date range.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map(inv => {
                const subtotal = inv.lineItems.reduce((acc, item) => acc + (item.quantity * item.rate), 0);
                const discount = subtotal * (inv.discountRate / 100);
                let tax = 0;
                if (!inv.reverseCharge) {
                  tax = inv.lineItems.reduce((acc, item) => {
                    const rate = item.taxRate ?? inv.taxRate;
                    return acc + ((item.quantity * item.rate) * (rate / 100));
                  }, 0);
                }
                const total = subtotal + tax - discount;

  return (
    <tr key={inv.id} className="hover:bg-slate-50">
      <td className="p-4 font-medium text-slate-900">{inv.invoiceNumber}</td>
      <td className="p-4 text-slate-500">{inv.date}</td>
      <td className="p-4 text-slate-600">{inv.toName}</td>
      <td className="p-4 text-slate-600 text-right font-mono">£{(subtotal - discount).toFixed(2)}</td>
      <td className="p-4 text-orange-600 text-right font-mono">£{tax.toFixed(2)}</td>
      <td className="p-4 text-slate-900 text-right font-mono font-bold">£{total.toFixed(2)}</td>
    </tr>
  );
})
)}
</tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Reports;
