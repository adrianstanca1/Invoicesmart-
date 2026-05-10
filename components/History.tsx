import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Invoice } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface HistoryProps {
  invoices: Invoice[];
  onDelete: (id: string) => void;
}

const History: React.FC<HistoryProps> = ({ invoices, onDelete }) => {
  const [filter, setFilter] = useState<'All' | 'Draft' | 'Sent' | 'Paid' | 'Overdue'>('All');
  const [search, setSearch] = useState('');

  const filteredInvoices = useMemo(() => {
    return invoices
      .filter(inv => filter === 'All' || inv.status === filter)
      .filter(inv => 
        inv.toName.toLowerCase().includes(search.toLowerCase()) || 
        inv.invoiceNumber.toLowerCase().includes(search.toLowerCase())
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [invoices, filter, search]);

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this invoice?')) {
      onDelete(id);
    }
  };

  const exportCSV = () => {
    const headers = ['Number', 'Client', 'Date', 'Amount', 'Status'];
    const rows = filteredInvoices.map(inv => {
      const sub = inv.lineItems.reduce((acc, item) => acc + (item.quantity * item.rate), 0);
      const vat = inv.reverseCharge ? 0 : sub * (inv.taxRate/100);
      const discount = sub * (inv.discountRate/100);
      const gross = sub + vat - discount;
      const retention = sub * (inv.retentionRate/100 || 0);
      const labor = inv.lineItems.filter(i => i.isLabor).reduce((acc, item) => acc + (item.quantity * item.rate), 0);
      const cis = labor * (inv.cisRate/100 || 0);
      const totalDue = gross - retention - cis;
      return [
        inv.invoiceNumber,
        `"${inv.toName.replace(/"/g, '""')}"`,
        inv.date,
        totalDue.toFixed(2),
        inv.status
      ];
    });
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "invoices.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.text("Invoice History", 14, 25);
    
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()} | Filter: ${filter}`, 14, 32);

    const tableData = filteredInvoices.map(inv => {
      const sub = inv.lineItems.reduce((acc, item) => acc + (item.quantity * item.rate), 0);
      const vat = inv.reverseCharge ? 0 : sub * (inv.taxRate/100);
      const discount = sub * (inv.discountRate/100);
      const gross = sub + vat - discount;
      const retention = sub * (inv.retentionRate/100 || 0);
      const labor = inv.lineItems.filter(i => i.isLabor).reduce((acc, item) => acc + (item.quantity * item.rate), 0);
      const cis = labor * (inv.cisRate/100 || 0);
      const totalDue = gross - retention - cis;
      const symbol = inv.currency === 'GBP' ? '£' : inv.currency === 'EUR' ? '€' : '$';
      
      return [
        inv.invoiceNumber,
        inv.toName,
        inv.date,
        `${symbol}${totalDue.toFixed(2)}`,
        inv.status
      ];
    });

    autoTable(doc, {
      head: [['Number', 'Client', 'Date', 'Amount', 'Status']],
      body: tableData,
      startY: 50,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] }, // blue-500
      alternateRowStyles: { fillColor: [248, 250, 252] }, // slate-50
      styles: { fontSize: 10, cellPadding: 5 },
    });
    
    doc.save(`invoices_${filter.toLowerCase()}.pdf`);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <h2 className="text-3xl font-bold text-slate-800">Invoice History</h2>
        
        <div className="flex gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <i className="fas fa-search absolute left-3 top-3 text-slate-400"></i>
            <input 
              type="text" 
              placeholder="Search client or number..." 
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button onClick={exportCSV} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg flex items-center gap-2 transition-all">
            <i className="fas fa-file-csv"></i> CSV
          </button>
          <button onClick={exportPDF} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg flex items-center gap-2 transition-all">
            <i className="fas fa-file-pdf"></i> PDF
          </button>
          <Link to="/create" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all">
            <i className="fas fa-plus"></i> New
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-slate-200 overflow-x-auto">
          {['All', 'Draft', 'Sent', 'Paid', 'Overdue'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status as any)}
              className={`px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap
                ${filter === status 
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' 
                  : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'}`}
            >
              {status}
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs 
                ${filter === status ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                {invoices.filter(i => status === 'All' || i.status === status).length}
              </span>
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="p-4 font-semibold text-slate-600">Number</th>
                <th className="p-4 font-semibold text-slate-600">Client</th>
                <th className="p-4 font-semibold text-slate-600">Date</th>
                <th className="p-4 font-semibold text-slate-600 text-right">Amount</th>
                <th className="p-4 font-semibold text-slate-600">Status</th>
                <th className="p-4 font-semibold text-slate-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-3">
                      <i className="fas fa-file-invoice text-4xl mb-2 text-slate-300"></i>
                      <p>No invoices found matching your criteria.</p>
                      {filter !== 'All' && (
                        <button onClick={() => setFilter('All')} className="text-blue-600 hover:underline">
                          Clear filter
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map(inv => {
                  const sub = inv.lineItems.reduce((acc, item) => acc + (item.quantity * item.rate), 0);
                  const vat = inv.reverseCharge ? 0 : sub * (inv.taxRate/100);
                  const discount = sub * (inv.discountRate/100);
                  const gross = sub + vat - discount;
                  const retention = sub * (inv.retentionRate/100 || 0);
                  const labor = inv.lineItems.filter(i => i.isLabor).reduce((acc, item) => acc + (item.quantity * item.rate), 0);
                  const cis = labor * (inv.cisRate/100 || 0);
                  const totalDue = gross - retention - cis;
                  
                  const symbol = inv.currency === 'GBP' ? '£' : inv.currency === 'EUR' ? '€' : '$';

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="p-4 font-medium text-slate-900">
                        <Link to={`/edit/${inv.id}`} className="hover:underline flex items-center gap-2">
                          {inv.invoiceNumber}
                          {inv.isRecurring && (
                            <i className="fas fa-sync-alt text-xs text-blue-500" title={`Recurring: ${inv.recurringFrequency}`}></i>
                          )}
                          {inv.parentInvoiceId && (
                            <i className="fas fa-magic text-xs text-purple-500" title="Auto-generated recurring invoice"></i>
                          )}
                        </Link>
                      </td>
                      <td className="p-4 text-slate-600">
                        <div className="font-medium">{inv.toName || 'Unknown Client'}</div>
                        <div className="text-xs text-slate-400">{inv.toEmail}</div>
                      </td>
                      <td className="p-4 text-slate-500 text-sm">{inv.date}</td>
                      <td className="p-4 text-slate-900 font-medium text-right font-mono">
                        {symbol}{totalDue.toFixed(2)}
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border
                          ${inv.status === 'Paid' ? 'bg-green-100 text-green-700 border-green-200' : 
                            inv.status === 'Overdue' ? 'bg-red-100 text-red-700 border-red-200' : 
                            inv.status === 'Sent' ? 'bg-blue-100 text-blue-700 border-blue-200' : 
                            'bg-slate-100 text-slate-600 border-slate-200'}`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link 
                            to={`/edit/${inv.id}`}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                            title="Edit"
                          >
                            <i className="fas fa-pen"></i>
                          </Link>
                          <button 
                            onClick={(e) => handleDelete(e, inv.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Delete"
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        </div>
                      </td>
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

export default History;