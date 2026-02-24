
import React from 'react';
import { CalculationResult } from '../types';
import { TrendingUp, Users, Activity, Zap, Building2 } from 'lucide-react';

interface SummaryDashboardProps {
  result: CalculationResult | null;
}

const SummaryDashboard: React.FC<SummaryDashboardProps> = ({ result }) => {
  if (!result) return null;

  const stats = [
    { label: 'Active Users', value: result.crmMetrics.activeLoadUsers, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Triggers/Sec', value: result.crmMetrics.triggersPerSecond, icon: Activity, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Bot TPM', value: result.botMetrics.tpm.toLocaleString(), icon: Zap, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Nodes Required', value: result.servers.length, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ];

  return (
    <div>
      {/* NEW: Client name header */}
      {result.clientName && (
        <div className="flex items-center gap-3 mb-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="bg-slate-100 p-2 rounded-lg">
            <Building2 className="w-5 h-5 text-slate-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-tight">Client</p>
            <p className="text-lg font-bold text-slate-900">{result.clientName}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {result.industry && (
              <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                result.industry === 'BFSI' ? 'bg-amber-100 text-amber-700' : 'bg-teal-100 text-teal-700'
              }`}>
                {result.industry}
              </span>
            )}
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
              result.solutionType === 'saas' ? 'bg-blue-100 text-blue-700' :
              result.solutionType === 'on-cloud' ? 'bg-purple-100 text-purple-700' :
              'bg-slate-100 text-slate-700'
            }`}>
              {result.solutionType?.toUpperCase().replace('-', ' ')}
            </span>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 animate-in zoom-in duration-300">
            <div className={`${stat.bg} p-2.5 rounded-lg`}>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-tight">{stat.label}</p>
              <p className="text-xl font-bold text-slate-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SummaryDashboard;
