
import React from 'react';
import { CalculationResult } from '../types';
import { TrendingUp, Users, Activity, Zap } from 'lucide-react';

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
  );
};

export default SummaryDashboard;
