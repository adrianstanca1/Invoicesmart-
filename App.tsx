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
import AuditTrail from './components/AuditTrail';
import { Invoice, Client, Transaction, TaxRule, AuditLog } from './types';

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
          <Link to="/audit" className={`px-3 py-2 rounded-lg transition-all font-medium text-sm whitespace-nowrap ${isActive('/audit')}`}>
            <i className="fas fa-list-alt mr-2"></i>Audit Trail
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
  const [auditLogs, setAuditLogs] = useLocalStorage<AuditLog[]>('auditLogs', []);
  const [taxRules, setTaxRules] = useLocalStorage<TaxRule[]>('taxRules', [
    { id: '1', name: 'Standard VAT', rate: 20, description: 'Standard UK VAT rate' },
    { id: '2', name: 'Reduced Rate', rate: 5, description: 'Reduced rate for energy, etc.' },
    { id: '3', name: 'Zero Rate', rate: 0, description: 'Zero rated goods' }
  ]);

  const logAction = (action: AuditLog['action'], entityType: AuditLog['entityType'], entityId: string, entityName: string, details: string) => {
    setAuditLogs(prev => [{
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      user: 'Current User', // Placeholder for user identity
      action,
      entityType,
      entityId,
      entityName,
      details
    }, ...prev]);
  };

  const getNextInvoiceNumber = (invoices: Invoice[]): string => {
    let settings: any = {};
    try {
      settings = JSON.parse(localStorage.getItem('appSettings') || localStorage.getItem('paymentApiKeys') || '{}');
    } catch {
      // ignore
    }

    const customPrefix = settings.invoicePrefix || 'INV-';
    const autoIncrement = settings.autoIncrement !== false; // default true

    if (!autoIncrement) {
      return `${customPrefix}`;
    }

    if (invoices.length === 0) return `${customPrefix}001`;
    
    // Simple approach: look at the last invoice added
    const lastInvoice = invoices[invoices.length - 1];
    let prefixToUse = customPrefix;
    let fallbackFormat = `${customPrefix}001`;

    const match = lastInvoice.invoiceNumber.match(/(.*?)(\d+)$/);
    
    if (match) {
      // If we want to strictly use the new custom prefix, we replace the old prefix.
      // But we should use the number from the last invoice!
      const numberStr = match[2];
      const nextNumber = parseInt(numberStr, 10) + 1;
      const paddedNumber = nextNumber.toString().padStart(numberStr.length, '0');
      return `${prefixToUse}${paddedNumber}`;
    }
    
    // Output fallback if it doesn't end with numbers
    return fallbackFormat;
  };

  const handleSaveInvoice = (invoice: Invoice) => {
    setInvoices(prev => {
      const index = prev.findIndex(i => i.id === invoice.id);
      if (index >= 0) {
        const newInvoices = [...prev];
        newInvoices[index] = invoice;
        logAction('Updated', 'Invoice', invoice.id, invoice.invoiceNumber, `Updated invoice for ${invoice.toName}`);
        return newInvoices;
      }
      logAction('Created', 'Invoice', invoice.id, invoice.invoiceNumber, `Created new invoice for ${invoice.toName}`);
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
        logAction('Generated', 'Transaction', newTx.id, newTx.description, `Auto-generated payment for Invoice #${invoice.invoiceNumber}`);
      }
    }
  };

  // Process Recurring Invoices
  useEffect(() => {
    if (invoices.length === 0) return;
    
    let hasChanges = false;
    const newInvoices: Invoice[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of day for accurate comparison
    
    const updatedInvoices = invoices.map(invoice => {
      if (!invoice.isRecurring || !invoice.recurringFrequency) return invoice;
      
      const endDate = invoice.recurringEndDate ? new Date(invoice.recurringEndDate) : null;
      let currentInvoice = { ...invoice };
      
      // Calculate how many ms are between date and dueDate
      const dueOffsetMs = new Date(invoice.dueDate).getTime() - new Date(invoice.date).getTime();
      
      while (true) {
        const lastGen = currentInvoice.lastGeneratedDate ? new Date(currentInvoice.lastGeneratedDate) : new Date(currentInvoice.date);
        let nextGenDate = new Date(lastGen);
        
        if (currentInvoice.recurringFrequency === 'weekly') {
          nextGenDate.setDate(nextGenDate.getDate() + 7);
        } else if (currentInvoice.recurringFrequency === 'monthly') {
          nextGenDate.setMonth(nextGenDate.getMonth() + 1);
        } else if (currentInvoice.recurringFrequency === 'yearly') {
          nextGenDate.setFullYear(nextGenDate.getFullYear() + 1);
        }
        
        // Stop if next gen is past end date
        if (endDate && nextGenDate > endDate) break;
        
        // Stop if next gen is in the future
        if (nextGenDate > today) break;
        
        // Due date based on original issue/due offset
        const generatedDueDate = new Date(nextGenDate.getTime() + (isNaN(dueOffsetMs) ? 0 : dueOffsetMs));
        
        const nextInvoiceNum = `${invoice.invoiceNumber}-REC-${Math.floor(Math.random() * 10000)}`;

        const generatedInvoice: Invoice = {
          ...currentInvoice,
          id: crypto.randomUUID(),
          invoiceNumber: nextInvoiceNum,
          date: nextGenDate.toISOString().split('T')[0],
          dueDate: generatedDueDate.toISOString().split('T')[0],
          isRecurring: false,
          recurringFrequency: undefined,
          recurringEndDate: undefined,
          lastGeneratedDate: undefined,
          parentInvoiceId: currentInvoice.id,
          status: 'Draft',
          lineItems: currentInvoice.lineItems.map(li => ({ ...li, id: crypto.randomUUID() }))
        };
        
        newInvoices.push(generatedInvoice);
        hasChanges = true;
        
        currentInvoice.lastGeneratedDate = nextGenDate.toISOString().split('T')[0];
        
        // Use a timeout to ensure state is set, or better yet, log right now since we are pushing to a local array
        logAction('Generated', 'Invoice', generatedInvoice.id, generatedInvoice.invoiceNumber, `Auto-generated recurring invoice from ${invoice.invoiceNumber}`);
      }
      
      return currentInvoice;
    });

    if (hasChanges) {
       setInvoices([...updatedInvoices, ...newInvoices]);
    }
  }, []); // Only run once on mount

  const handleDeleteInvoice = (id: string) => {
    if (confirm('Are you sure you want to delete this invoice?')) {
      const invoice = invoices.find(i => i.id === id);
      if (invoice) {
        logAction('Deleted', 'Invoice', invoice.id, invoice.invoiceNumber, `Deleted invoice for ${invoice.toName}`);
      }
      setInvoices(prev => prev.filter(i => i.id !== id));
    }
  };

  const handleSaveClient = (client: Client) => {
    setClients(prev => {
      const index = prev.findIndex(c => c.id === client.id);
      if (index >= 0) {
        logAction('Updated', 'Client', client.id, client.name, `Updated client info`);
        const newClients = [...prev];
        newClients[index] = client;
        return newClients;
      }
      logAction('Created', 'Client', client.id, client.name, `Created new client`);
      return [...prev, client];
    });
  };

  const handleDeleteClient = (id: string) => {
    if (confirm('Delete this client?')) {
      const client = clients.find(c => c.id === id);
      if (client) {
        logAction('Deleted', 'Client', client.id, client.name, `Deleted client`);
      }
      setClients(prev => prev.filter(c => c.id !== id));
    }
  };

  const handleSaveRule = (rule: TaxRule) => {
    setTaxRules(prev => {
      const index = prev.findIndex(r => r.id === rule.id);
      if (index >= 0) {
        logAction('Updated', 'TaxRule', rule.id, rule.name, `Updated tax rule`);
        const newRules = [...prev];
        newRules[index] = rule;
        return newRules;
      }
      logAction('Created', 'TaxRule', rule.id, rule.name, `Created new tax rule`);
      return [...prev, rule];
    });
  };

  const handleDeleteRule = (id: string) => {
    if (confirm('Delete this tax rule?')) {
      const rule = taxRules.find(r => r.id === id);
      if (rule) {
        logAction('Deleted', 'TaxRule', rule.id, rule.name, `Deleted tax rule`);
      }
      setTaxRules(prev => prev.filter(r => r.id !== id));
    }
  };

  const handleAddTransaction = (tx: Transaction) => {
    logAction('Created', 'Transaction', tx.id, tx.description, `Added transaction of type ${tx.type}`);
    setTransactions(prev => [...prev, tx]);
  };

  const handleDeleteTransaction = (id: string) => {
    if (confirm('Delete this transaction?')) {
      const tx = transactions.find(t => t.id === id);
      if (tx) {
        logAction('Deleted', 'Transaction', tx.id, tx.description, `Deleted transaction`);
      }
      setTransactions(prev => prev.filter(t => t.id !== id));
    }
  };

  return (
    <Router>
      <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
        <NavBar />
        <Routes>
          <Route path="/" element={<Dashboard invoices={invoices} clients={clients} transactions={transactions} taxRules={taxRules} />} />
          <Route path="/create" element={<InvoiceBuilder onSave={handleSaveInvoice} clients={clients} taxRules={taxRules} initialInvoiceNumber={getNextInvoiceNumber(invoices)} />} />
          <Route path="/edit/:id" element={
            <InvoiceWrapper invoices={invoices} onSave={handleSaveInvoice} clients={clients} taxRules={taxRules} />
          } />
          <Route path="/history" element={<History invoices={invoices} onDelete={handleDeleteInvoice} />} />
          <Route path="/clients" element={<ClientManager clients={clients} onSaveClient={handleSaveClient} onDeleteClient={handleDeleteClient} />} />
          <Route path="/taxes" element={<TaxManager taxRules={taxRules} onSaveRule={handleSaveRule} onDeleteRule={handleDeleteRule} />} />
          <Route path="/reports" element={<Reports invoices={invoices} />} />
          <Route path="/ledger" element={<Ledger transactions={transactions} invoices={invoices} onAddTransaction={handleAddTransaction} onDeleteTransaction={handleDeleteTransaction} />} />
          <Route path="/audit" element={<AuditTrail logs={auditLogs} />} />
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
