import React, { useState, useRef, useEffect } from 'react';
import { Invoice, Client, Transaction, TaxRule } from '../types';
import { GoogleGenAI } from "@google/genai";

interface AIAccountantProps {
  invoices: Invoice[];
  clients: Client[];
  transactions: Transaction[];
  taxRules: TaxRule[];
}

interface Message {
  role: 'user' | 'model';
  text: string;
}

const AIAccountant: React.FC<AIAccountantProps> = ({ invoices, clients, transactions, taxRules }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'Hello! I am your AI Accountant. Ask me anything about your finances, taxes, or invoices.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMessage = input;
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setInput('');
    setIsLoading(true);

    try {
      // Prepare context
      const context = {
        summary: {
          totalInvoices: invoices.length,
          totalClients: clients.length,
          totalTransactions: transactions.length,
          taxRules: taxRules.map(r => `${r.name} (${r.rate}%)`).join(', ')
        },
        recentInvoices: invoices.map(i => {
          const subtotal = i.lineItems.reduce((acc, item) => acc + (item.quantity * item.rate), 0);
          const vat = i.reverseCharge ? 0 : subtotal * (i.taxRate/100);
          const discount = subtotal * (i.discountRate/100);
          const total = subtotal + vat - discount;
          
          return {
            number: i.invoiceNumber,
            client: i.toName,
            subtotal,
            discountRate: i.discountRate,
            discountAmount: discount,
            taxRate: i.taxRate,
            vatAmount: vat,
            isReverseCharge: !!i.reverseCharge,
            total,
            status: i.status,
            date: i.date,
            items: i.lineItems.map(li => ({
              description: li.description,
              quantity: li.quantity,
              rate: li.rate
            }))
          };
        }),
        recentTransactions: transactions.map(t => ({
          date: t.date,
          description: t.description,
          amount: t.amount,
          type: t.type,
          category: t.category
        }))
      };

      const systemPrompt = `You are an expert AI Accountant for a small business. 
      You have access to the following financial data: ${JSON.stringify(context)}.
      
      Answer the user's question accurately based on this data. 
      If asked about tax, refer to the specific tax rules available.
      Be professional, helpful, and concise.
      If you need to perform a calculation, explain your working.`;

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const chat = ai.chats.create({
        model: "gemini-3-flash-preview",
        history: [
          { role: "user", parts: [{ text: systemPrompt }] },
          { role: "model", parts: [{ text: "Understood. I am ready to assist with accounting inquiries." }] }
        ]
      });

      const result = await chat.sendMessage({ message: userMessage });
      const response = result.text;

      setMessages(prev => [...prev, { role: 'model', text: response || "I couldn't generate a response." }]);
    } catch (error) {
      console.error('AI Error:', error);
      setMessages(prev => [...prev, { role: 'model', text: "I'm sorry, I encountered an error processing your request. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-full shadow-xl z-50 transition-transform hover:scale-110"
      >
        <i className={`fas ${isOpen ? 'fa-times' : 'fa-robot'} text-2xl`}></i>
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 h-[500px] bg-white rounded-xl shadow-2xl border border-slate-200 z-50 flex flex-col overflow-hidden animate-fade-in-up">
          <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
            <h3 className="font-bold flex items-center gap-2">
              <i className="fas fa-robot"></i> AI Accountant
            </h3>
            <span className="text-xs bg-indigo-500 px-2 py-1 rounded">Online</span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-lg p-3 text-sm ${
                  msg.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-br-none' 
                    : 'bg-white text-slate-800 shadow-sm border border-slate-100 rounded-bl-none'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white text-slate-500 p-3 rounded-lg shadow-sm border border-slate-100 text-sm italic">
                  Thinking...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 bg-white border-t border-slate-100">
            <div className="flex gap-2">
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask about revenue, tax, etc..."
                className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              />
              <button 
                onClick={handleSend}
                disabled={isLoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg transition-colors"
              >
                <i className="fas fa-paper-plane"></i>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AIAccountant;
