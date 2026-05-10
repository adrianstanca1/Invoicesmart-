import React, { useState } from 'react';
import { TaxRule } from '../types';

interface TaxManagerProps {
  taxRules: TaxRule[];
  onSaveRule: (rule: TaxRule) => void;
  onDeleteRule: (id: string) => void;
}

const TaxManager: React.FC<TaxManagerProps> = ({ taxRules, onSaveRule, onDeleteRule }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [currentRule, setCurrentRule] = useState<TaxRule>({
    id: '',
    name: '',
    rate: 20,
    description: ''
  });

  const handleEdit = (rule?: TaxRule) => {
    if (rule) {
      setCurrentRule(rule);
    } else {
      setCurrentRule({ id: crypto.randomUUID(), name: '', rate: 20, description: '' });
    }
    setIsEditing(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveRule(currentRule);
    setIsEditing(false);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto animate-fade-in">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-slate-800">Tax Rates & Rules</h2>
        <button 
          onClick={() => handleEdit()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all"
        >
          <i className="fas fa-plus"></i> Add Tax Rate
        </button>
      </div>

      {isEditing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">{currentRule.name ? 'Edit Tax Rate' : 'New Tax Rate'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input 
                  required
                  type="text" 
                  className="w-full border rounded-lg px-3 py-2"
                  value={currentRule.name}
                  onChange={e => setCurrentRule({...currentRule, name: e.target.value})}
                  placeholder="e.g. Standard VAT"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Rate (%)</label>
                <input 
                  required
                  type="number" 
                  step="0.01"
                  className="w-full border rounded-lg px-3 py-2"
                  value={Number.isNaN(currentRule.rate) ? '' : currentRule.rate}
                  onChange={e => {
                    const val = parseFloat(e.target.value);
                    setCurrentRule({...currentRule, rate: isNaN(val) ? 0 : val});
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea 
                  className="w-full border rounded-lg px-3 py-2"
                  rows={2}
                  value={currentRule.description}
                  onChange={e => setCurrentRule({...currentRule, description: e.target.value})}
                  placeholder="Optional description"
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
                  Save Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {taxRules.length === 0 ? (
          <div className="col-span-full text-center py-12 text-slate-400 bg-white rounded-xl border border-dashed border-slate-300">
            <i className="fas fa-percentage text-4xl mb-4"></i>
            <p>No tax rules defined. Defaulting to standard rates.</p>
          </div>
        ) : (
          taxRules.map(rule => (
            <div key={rule.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow group relative">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-lg text-slate-800">{rule.name}</h3>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity absolute top-4 right-4">
                  <button onClick={() => handleEdit(rule)} className="text-blue-600 hover:bg-blue-50 p-2 rounded">
                    <i className="fas fa-edit"></i>
                  </button>
                  <button onClick={() => onDeleteRule(rule.id)} className="text-red-500 hover:bg-red-50 p-2 rounded">
                    <i className="fas fa-trash"></i>
                  </button>
                </div>
              </div>
              <div className="text-3xl font-bold text-blue-600 mb-2">{rule.rate}%</div>
              <p className="text-sm text-slate-500">{rule.description || 'No description provided.'}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TaxManager;
