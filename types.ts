export interface TaxRule {
  id: string;
  name: string;
  rate: number;
  description?: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  vatNumber?: string;
  notes?: string;
  defaultTerms?: string;
}

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  isLabor?: boolean; // For CIS calculations
  taxRate?: number; // Specific tax rate for this item
  taxRuleId?: string; // Reference to the rule used
}

export interface Invoice {
  id: string;
  clientId?: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  fromName: string;
  fromEmail: string;
  fromAddress: string;
  toName: string;
  toEmail: string;
  toAddress: string;
  clientVatNumber?: string;
  lineItems: LineItem[];
  notes: string;
  terms: string;
  currency: string;
  taxRate: number;
  discountRate: number;
  logo?: string; // Base64 string
  status: 'Draft' | 'Sent' | 'Paid' | 'Overdue';
  
  // Payment Integration
  paymentGateway?: 'stripe' | 'paypal' | 'none';
  paymentLinkId?: string; // email for paypal, or link for stripe
  
  // UK / Construction Specifics
  reverseCharge: boolean;
  retentionRate: number; // Percentage
  cisRate: number; // Percentage (e.g. 20% or 30%)
  template: 'modern' | 'classic' | 'minimal';
  isRecurring?: boolean;
  recurringFrequency?: 'weekly' | 'monthly' | 'yearly';
  recurringEndDate?: string;
  lastGeneratedDate?: string;
  parentInvoiceId?: string;
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'Income' | 'Expense';
  category: string;
  invoiceId?: string;
  referenceId?: string;
}

export interface FinancialReport {
  generatedDate: string;
  period: string;
  profitAndLoss: {
    revenue: number;
    costOfSales: number;
    grossProfit: number;
    expenses: { category: string; amount: number }[];
    totalExpenses: number;
    netProfit: number;
  };
  balanceSheet?: {
    assets: number;
    liabilities: number;
    equity: number;
  };
  taxEstimates?: {
    vatDue: number;
    corporationTax: number;
  };
  insights: string[];
}

export interface FinancialInsight {
  summary: string;
  recommendations: string[];
  riskAssessment: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  action: 'Created' | 'Updated' | 'Deleted' | 'Generated';
  entityType: 'Invoice' | 'Client' | 'Transaction' | 'TaxRule';
  entityId: string;
  entityName: string; // e.g., Invoice Number or Client Name
  details: string;
}
