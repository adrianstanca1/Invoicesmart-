import React, { useState } from 'react';
import { AuditLog } from '../types';

interface AuditTrailProps {
  logs: AuditLog[];
}

const AuditTrail: React.FC<AuditTrailProps> = ({ logs }) => {
  const [filterType, setFilterType] = useState<string>('All');
  const [filterAction, setFilterAction] = useState<string>('All');

  const filteredLogs = logs.filter(log => {
    if (filterType !== 'All' && log.entityType !== filterType) return false;
    if (filterAction !== 'All' && log.action !== filterAction) return false;
    return true;
  });

  const exportToCSV = () => {
    if (filteredLogs.length === 0) return;

    const headers = ['Timestamp', 'User', 'Action', 'Entity Type', 'Entity ID', 'Entity Name', 'Details'];
    
    const rows = filteredLogs.map(log => [
      new Date(log.timestamp).toISOString(),
      `"${log.user || ''}"`,
      log.action,
      log.entityType,
      log.entityId,
      `"${log.entityName || ''}"`,
      `"${log.details?.replace(/"/g, '""') || ''}"`
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Audit Trail</h2>
          <p className="text-slate-500 mt-1">Track all system activities and changes over time.</p>
        </div>
        <button 
          onClick={exportToCSV}
          disabled={filteredLogs.length === 0}
          className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg font-medium transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
        >
          <i className="fas fa-download"></i> Export CSV
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Filters */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Entity Type</label>
            <select 
              className="border rounded px-3 py-1.5 text-sm bg-white"
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
            >
              <option value="All">All Types</option>
              <option value="Invoice">Invoices</option>
              <option value="Client">Clients</option>
              <option value="Transaction">Transactions</option>
              <option value="TaxRule">Tax Rules</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Action</label>
            <select 
              className="border rounded px-3 py-1.5 text-sm bg-white"
              value={filterAction}
              onChange={e => setFilterAction(e.target.value)}
            >
              <option value="All">All Actions</option>
              <option value="Created">Created</option>
              <option value="Updated">Updated</option>
              <option value="Deleted">Deleted</option>
              <option value="Generated">Generated</option>
            </select>
          </div>
        </div>

        {/* Log List */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <tr>
                <th className="font-semibold p-4">Timestamp</th>
                <th className="font-semibold p-4">User</th>
                <th className="font-semibold p-4">Action</th>
                <th className="font-semibold p-4">Type</th>
                <th className="font-semibold p-4">Entity</th>
                <th className="font-semibold p-4">Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    <div>
                      <i className="fas fa-search text-3xl mb-3 opacity-20"></i>
                      <p>No audit logs found matching your filters.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  const date = new Date(log.timestamp);
                  return (
                    <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-4 whitespace-nowrap">
                        <div className="font-medium text-slate-800">{date.toLocaleDateString()}</div>
                        <div className="text-xs text-slate-400">{date.toLocaleTimeString()}</div>
                      </td>
                      <td className="p-4 whitespace-nowrap text-slate-700">{log.user}</td>
                      <td className="p-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold
                          ${log.action === 'Created' ? 'bg-green-100 text-green-700' :
                            log.action === 'Updated' ? 'bg-blue-100 text-blue-700' :
                            log.action === 'Deleted' ? 'bg-red-100 text-red-700' :
                            'bg-purple-100 text-purple-700'
                          }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="p-4 whitespace-nowrap text-slate-700 font-medium">
                        {log.entityType}
                      </td>
                      <td className="p-4 whitespace-nowrap text-slate-900 font-medium">
                        {log.entityName}
                      </td>
                      <td className="p-4 max-w-md truncate text-slate-500" title={log.details}>
                        {log.details}
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

export default AuditTrail;
