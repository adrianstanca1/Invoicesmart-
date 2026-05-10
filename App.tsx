import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import InvoiceBuilder from './components/InvoiceBuilder';
import Dashboard from './components/Dashboard';
import ClientManager from './components/ClientManager';
import History from './components/History';
import TaxManager from './components/TaxManager';
import Reports from './components/Reports';
import Ledger from './components/Ledger';
import AIAccountant from './components/AIAccountant';
import { Invoice, Client, Transaction, TaxRule } from './types';

// Simple hook for local storage persistence
function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue] as const;
}

const NavBar = () => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white';

  return (
    <nav className="bg-slate-900 text-white p-4 shadow-lg print:hidden">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-2 rounded-lg">
            <i className="fas fa-bolt text-white"></i>
          </div>
          <span className="font-bold text-xl tracking-tight">FlashInvoice</span>
        </div>
        <div className="flex gap-1 overflow-x-auto">
          <Link to="/" className={`px-3 py-2 rounded-lg transition-all font-medium text-sm whitespace-nowrap ${isActive('/')}`}>
            <i className="fas fa-chart-pie mr-2"></i>Dashboard
          </Link>
          <Link to="/create" className={`px-3 py-2 rounded-lg transition-all font-medium text-sm whitespace-nowrap ${isActive('/create')}`}>
            <i className="fas fa-plus-circle mr-2"></i>New Invoice
          </Link>
          <Link to="/ledger" className={`px-3 py-2 rounded-lg transition-all font-medium text-sm whitespace-nowrap ${isActive('/ledger')}`}>
            <i className="fas fa-book mr-2"></i>Ledger
          </Link>
          <Link to="/reports" className={`px-3 py-2 rounded-lg transition-all font-medium text-sm whitespace-nowrap ${isActive('/reports')}`}>
            <i className="fas fa-chart-line mr-2"></i>Reports
          </Link>
          <Link to="/history" className={`px-3 py-2 rounded-lg transition-all font-medium text-sm whitespace-nowrap ${isActive('/history')}`}>
            <i className="fas fa-history mr-2"></i>History
          </Link>
          <Link to="/clients" className={`px-3 py-2 rounded-lg transition-all font-medium text-sm whitespace-nowrap ${isActive('/clients')}`}>
            <i className="fas fa-users mr-2"></i>Clients
          </Link>
          <Link to="/taxes" className={`px-3 py-2 rounded-lg transition-all font-medium text-sm whitespace-nowrap ${isActive('/taxes')}`}>
            <i className="fas fa-percentage mr-2"></i>Tax Rules
          </Link>
        </div>
      </div>
    </nav>
  );
};

const App: React.FC = () => {
  const [invoices, setInvoices] = useLocalStorage<Invoice[]>('invoices', []);
  const [clients, setClients] = useLocalStorage<Client[]>('clients', []);
  const [transactions, setTransactions] = useLocalStorage<Transaction[]>('transactions', []);
  const [taxRules, setTaxRules] = useLocalStorage<TaxRule[]>('taxRules', [
    { id: '1', name: 'Standard VAT', rate: 20, description: 'Standard UK VAT rate' },
    { id: '2', name: 'Reduced Rate', rate: 5, description: 'Reduced rate for energy, etc.' },
    { id: '3', name: 'Zero Rate', rate: 0, description: 'Zero rated goods' }
  ]);

  const handleSaveInvoice = (invoice: Invoice) => {
    setInvoices(prev => {
      const index = prev.findIndex(i => i.id === invoice.id);
      if (index >= 0) {
        const newInvoices = [...prev];
        newInvoices[index] = invoice;
        return newInvoices;
      }
      return [...prev, invoice];
    });

    // If invoice is Paid, ensure a transaction exists
    if (invoice.status === 'Paid') {
      const existingTx = transactions.find(t => t.invoiceId === invoice.id);
      if (!existingTx) {
        // Calculate total
        const subtotal = invoice.lineItems.reduce((acc, item) => acc + (item.quantity * item.rate), 0);
        const discount = subtotal * (invoice.discountRate / 100);
        let tax = 0;
        if (!invoice.reverseCharge) {
           tax = invoice.lineItems.reduce((acc, item) => {
             const rate = item.taxRate ?? invoice.taxRate;
             return acc + ((item.quantity * item.rate) * (rate / 100));
           }, 0);
        }
        const total = subtotal + tax - discount;

        const newTx: Transaction = {
          id: crypto.randomUUID(),
          date: new Date().toISOString().split('T')[0],
          amount: total,
          type: 'Income',
          category: 'Sales',
          description: `Payment for Invoice #${invoice.invoiceNumber}`,
          invoiceId: invoice.id
        };
        setTransactions(prev => [...prev, newTx]);
      }
    }
  };

  const handleDeleteInvoice = (id: string) => {
    if (confirm('Are you sure you want to delete this invoice?')) {
      setInvoices(prev => prev.filter(i => i.id !== id));
    }
  };

  const handleSaveClient = (client: Client) => {
    setClients(prev => {
      const index = prev.findIndex(c => c.id === client.id);
      if (index >= 0) {
        const newClients = [...prev];
        newClients[index] = client;
        return newClients;
      }
      return [...prev, client];
    });
  };

  const handleDeleteClient = (id: string) => {
    if (confirm('Delete this client?')) {
      setClients(prev => prev.filter(c => c.id !== id));
    }
  };

  const handleSaveRule = (rule: TaxRule) => {
    setTaxRules(prev => {
      const index = prev.findIndex(r => r.id === rule.id);
      if (index >= 0) {
        const newRules = [...prev];
        newRules[index] = rule;
        return newRules;
      }
      return [...prev, rule];
    });
  };

  const handleDeleteRule = (id: string) => {
    if (confirm('Delete this tax rule?')) {
      setTaxRules(prev => prev.filter(r => r.id !== id));
    }
  };

  const handleAddTransaction = (tx: Transaction) => {
    setTransactions(prev => [...prev, tx]);
  };

  const handleDeleteTransaction = (id: string) => {
    if (confirm('Delete this transaction?')) {
      setTransactions(prev => prev.filter(t => t.id !== id));
    }
  };

  return (
    <Router>
      <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
        <NavBar />
        <Routes>
          <Route path="/" element={<Dashboard invoices={invoices} clients={clients} transactions={transactions} taxRules={taxRules} />} />
          <Route path="/create" element={<InvoiceBuilder onSave={handleSaveInvoice} clients={clients} taxRules={taxRules} />} />
          <Route path="/edit/:id" element={
            <InvoiceWrapper invoices={invoices} onSave={handleSaveInvoice} clients={clients} taxRules={taxRules} />
          } />
          <Route path="/history" element={<History invoices={invoices} onDelete={handleDeleteInvoice} />} />
          <Route path="/clients" element={<ClientManager clients={clients} onSaveClient={handleSaveClient} onDeleteClient={handleDeleteClient} />} />
          <Route path="/taxes" element={<TaxManager taxRules={taxRules} onSaveRule={handleSaveRule} onDeleteRule={handleDeleteRule} />} />
          <Route path="/reports" element={<Reports invoices={invoices} />} />
          <Route path="/ledger" element={<Ledger transactions={transactions} invoices={invoices} onAddTransaction={handleAddTransaction} onDeleteTransaction={handleDeleteTransaction} />} />
        </Routes>
        
        {/* Global AI Accountant */}
        <AIAccountant 
          invoices={invoices} 
          clients={clients} 
          transactions={transactions} 
          taxRules={taxRules} 
        />
      </div>
    </Router>
  );
};

// Helper to find invoice for editing
const InvoiceWrapper: React.FC<{ 
  invoices: Invoice[], 
  onSave: (i: Invoice) => void, 
  clients: Client[],
  taxRules: TaxRule[]
}> = ({ invoices, onSave, clients, taxRules }) => {
  const { pathname } = useLocation();
  const id = pathname.split('/').pop();
  const invoice = invoices.find(i => i.id === id);
  
  if (!invoice) return <div className="p-8 text-center">Invoice not found</div>;
  
  return <InvoiceBuilder initialInvoice={invoice} onSave={onSave} clients={clients} taxRules={taxRules} />;
};

export default App;
