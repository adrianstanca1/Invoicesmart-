import React, { useState } from 'react';
import { Client } from '../types';

interface ClientManagerProps {
  clients: Client[];
  onSaveClient: (client: Client) => void;
  onDeleteClient: (id: string) => void;
}

const ClientManager: React.FC<ClientManagerProps> = ({ clients, onSaveClient, onDeleteClient }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [filterIndustry, setFilterIndustry] = useState<string>('All');
  const [currentClient, setCurrentClient] = useState<Client>({
    id: '',
    name: '',
    email: '',
    phone: '',
    address: '',
    vatNumber: '',
    notes: '',
    defaultTerms: '',
    industry: ''
  });

  const handleEdit = (client?: Client) => {
    if (client) {
      setCurrentClient(client);
    } else {
      setCurrentClient({ id: crypto.randomUUID(), name: '', email: '', phone: '', address: '', vatNumber: '', notes: '', defaultTerms: '', industry: '' });
    }
    setIsEditing(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveClient(currentClient);
    setIsEditing(false);
  };

  const uniqueIndustries = Array.from(new Set(clients.map(c => c.industry).filter(Boolean))) as string[];
  const filteredClients = filterIndustry === 'All' 
    ? clients 
    : clients.filter(c => c.industry === filterIndustry);

  return (
    <div className="p-8 max-w-5xl mx-auto animate-fade-in">
      <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
        <h2 className="text-3xl font-bold text-slate-800">Client Management</h2>
        
        <div className="flex items-center gap-4">
          {uniqueIndustries.length > 0 && (
            <select 
              className="border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700"
              value={filterIndustry}
              onChange={(e) => setFilterIndustry(e.target.value)}
            >
              <option value="All">All Industries</option>
              {uniqueIndustries.map(ind => (
                <option key={ind} value={ind}>{ind}</option>
              ))}
            </select>
          )}
          <button 
            onClick={() => handleEdit()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all"
          >
            <i className="fas fa-user-plus"></i> Add Client
          </button>
        </div>
      </div>

      {isEditing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">{currentClient.name ? 'Edit Client' : 'New Client'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Company / Name</label>
                <input 
                  required
                  type="text" 
                  className="w-full border rounded-lg px-3 py-2"
                  value={currentClient.name}
                  onChange={e => setCurrentClient({...currentClient, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input 
                  type="email" 
                  className="w-full border rounded-lg px-3 py-2"
                  value={currentClient.email}
                  onChange={e => setCurrentClient({...currentClient, email: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                <input 
                  type="tel" 
                  className="w-full border rounded-lg px-3 py-2"
                  value={currentClient.phone}
                  onChange={e => setCurrentClient({...currentClient, phone: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">VAT / Tax Number</label>
                <input 
                  type="text" 
                  className="w-full border rounded-lg px-3 py-2"
                  value={currentClient.vatNumber || ''}
                  onChange={e => setCurrentClient({...currentClient, vatNumber: e.target.value})}
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                <textarea 
                  className="w-full border rounded-lg px-3 py-2"
                  rows={3}
                  value={currentClient.address}
                  onChange={e => setCurrentClient({...currentClient, address: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Industry / Tag</label>
                <input 
                  type="text" 
                  className="w-full border rounded-lg px-3 py-2"
                  value={currentClient.industry || ''}
                  onChange={e => setCurrentClient({...currentClient, industry: e.target.value})}
                  placeholder="e.g. Technology, Retail"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Default Payment Terms</label>
                <textarea 
                  className="w-full border rounded-lg px-3 py-2"
                  rows={2}
                  value={currentClient.defaultTerms || ''}
                  onChange={e => setCurrentClient({...currentClient, defaultTerms: e.target.value})}
                  placeholder="e.g. Net 30 Days"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Internal Notes</label>
                <textarea 
                  className="w-full border rounded-lg px-3 py-2"
                  rows={2}
                  value={currentClient.notes || ''}
                  onChange={e => setCurrentClient({...currentClient, notes: e.target.value})}
                  placeholder="Private notes about this client"
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button 
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save Client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClients.length === 0 ? (
          <div className="col-span-full text-center py-12 text-slate-400 bg-white rounded-xl border border-dashed border-slate-300">
            <i className="fas fa-users text-4xl mb-4"></i>
            <p>No clients found.</p>
          </div>
        ) : (
          filteredClients.map(client => (
            <div key={client.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow group">
              <div className="flex justify-between items-start mb-4">
                <div className="h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 text-xl font-bold">
                  {client.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEdit(client)} className="text-blue-600 hover:bg-blue-50 p-2 rounded">
                    <i className="fas fa-edit"></i>
                  </button>
                  <button onClick={() => onDeleteClient(client.id)} className="text-red-500 hover:bg-red-50 p-2 rounded">
                    <i className="fas fa-trash"></i>
                  </button>
                </div>
              </div>
              <h3 className="font-bold text-lg text-slate-800 mb-1">{client.name}</h3>
              <div className="space-y-2 text-sm text-slate-600">
                {client.industry && (
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full font-medium tracking-wide">
                      {client.industry}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <i className="fas fa-envelope w-4"></i> {client.email || '-'}
                </div>
                <div className="flex items-center gap-2">
                  <i className="fas fa-phone w-4"></i> {client.phone || '-'}
                </div>
                <div className="flex items-start gap-2">
                  <i className="fas fa-map-marker-alt w-4 mt-1"></i> 
                  <span className="whitespace-pre-line">{client.address || '-'}</span>
                </div>
                {client.vatNumber && (
                  <div className="flex items-center gap-2 text-slate-500">
                    <i className="fas fa-hashtag w-4"></i> VAT: {client.vatNumber}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ClientManager;
