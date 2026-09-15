import React, { useState, useEffect } from 'react';
import { useApp } from './AppContext';
import { AuditLog } from './types';
import { db } from './firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { ShieldCheck, Clock, User, Activity, Filter, RefreshCw } from 'lucide-react';

export const AuditLogsView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterAction, setFilterAction] = useState<string>('ALL');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(100));
      const snap = await getDocs(q);
      setLogs(snap.docs.map(d => d.data() as AuditLog));
    } catch (e) {
      console.warn('Could not fetch audit logs (may require index):', e);
      // Fallback without orderBy if composite index needed
      try {
        const snap = await getDocs(collection(db, 'audit_logs'));
        const list = snap.docs.map(d => d.data() as AuditLog);
        list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        setLogs(list.slice(0, 100));
      } catch (err) {
        console.error('Audit log fetch error:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = filterAction === 'ALL' ? logs : logs.filter(l => l.action === filterAction);

  return (
    <div id="audit-logs-container" className="space-y-6">
      {/* Banner */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
              Governance & Integrity
            </span>
            <span className="text-xs text-slate-500">Append-Only Firestore System Audit Trail</span>
          </div>
          <h1 className="text-lg font-bold text-slate-900 mt-1">Audit Trail & Transaction History</h1>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={filterAction}
            onChange={e => setFilterAction(e.target.value)}
            className="text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
          >
            <option value="ALL">ALL Actions</option>
            <option value="CREATE">CREATE</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
            <option value="IMPORT">IMPORT</option>
            <option value="EXPORT">EXPORT</option>
          </select>

          <button
            type="button"
            onClick={fetchLogs}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Recent Transactions ({filteredLogs.length})</h3>
          <span className="text-xs text-slate-500 font-mono">Immutable Log Entries</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-semibold text-[11px] border-b border-slate-200">
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">User</th>
                <th className="py-2.5 px-3">Action</th>
                <th className="py-2.5 px-3">Collection</th>
                <th className="py-2.5 px-3">Record Identifier</th>
                <th className="py-2.5 px-3">Payload Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredLogs.map(log => (
                <tr key={log.log_id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 font-bold text-slate-900">{log.user_name}</td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.action === 'CREATE'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : log.action === 'UPDATE'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : log.action === 'DELETE'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : log.action === 'IMPORT'
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-700">{log.collection}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-600 truncate max-w-[150px]">
                    {log.record_id}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px] truncate max-w-[280px]">
                    {log.new_value || log.old_value || '-'}
                  </td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No audit records logged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
