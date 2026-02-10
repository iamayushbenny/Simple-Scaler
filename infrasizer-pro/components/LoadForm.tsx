
import React from 'react';
import { UseFormRegister, FieldErrors, UseFormWatch } from 'react-hook-form';
import { AppFormData } from '../types';
import { User, Cpu, MessageSquare, Database } from 'lucide-react';

interface LoadFormProps {
  register: UseFormRegister<AppFormData>;
  errors: FieldErrors<AppFormData>;
  watch: UseFormWatch<AppFormData>;
}

const LoadForm: React.FC<LoadFormProps> = ({ register, errors, watch }) => {
  const watchCRM = watch('crm');
  const watchBot = watch('bot');

  // Live Auto-calcs for UI
  const crmActive = Math.ceil((watchCRM.namedUsers * watchCRM.concurrencyRate) / 100);
  const triggersSec = ((crmActive * watchCRM.triggersPerMinute) / 60).toFixed(2);
  const tpm = watchBot.activeUsers * watchBot.requestsPerMinute * watchBot.avgTokensPerRequest;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-left duration-500">
      {/* CRM Section */}
      <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
          <div className="bg-blue-100 p-2 rounded-lg">
            <User className="w-5 h-5 text-blue-600" />
          </div>
          <h2 className="text-lg font-semibold text-slate-800">CRM Load Dynamics</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Named Users</label>
            <input
              type="number"
              {...register('crm.namedUsers', { valueAsNumber: true })}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
              placeholder="e.g. 500"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Concurrency Rate (%)</label>
            <input
              type="number"
              {...register('crm.concurrencyRate', { valueAsNumber: true })}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
              placeholder="e.g. 10"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium text-slate-700">Triggers Per Session/Minute</label>
            <input
              type="number"
              {...register('crm.triggersPerMinute', { valueAsNumber: true })}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
              placeholder="e.g. 3"
            />
          </div>
        </div>

        <div className="mt-6 p-4 bg-slate-50 rounded-lg grid grid-cols-2 gap-4 border border-slate-100">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500 font-bold">Active Load Users</p>
            <p className="text-2xl font-bold text-blue-600">{crmActive || 0}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500 font-bold">Triggers/Second</p>
            <p className="text-2xl font-bold text-indigo-600">{triggersSec || '0.00'}</p>
          </div>
        </div>
      </section>

      {/* Bot Section */}
      <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
          <div className="bg-purple-100 p-2 rounded-lg">
            <MessageSquare className="w-5 h-5 text-purple-600" />
          </div>
          <h2 className="text-lg font-semibold text-slate-800">R-Yabot Interaction Load</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Concurrent Bot Users</label>
            <input
              type="number"
              {...register('bot.activeUsers', { valueAsNumber: true })}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Requests Per User/Min</label>
            <input
              type="number"
              {...register('bot.requestsPerMinute', { valueAsNumber: true })}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium text-slate-700">Avg Tokens/Request</label>
            <input
              type="number"
              {...register('bot.avgTokensPerRequest', { valueAsNumber: true })}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium text-slate-700">GPU Performance Level</label>
            <select
              {...register('bot.ryaBotPerformance')}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-white cursor-pointer"
            >
              <option value="average">Average - NVIDIA A100 (80GB VRAM)</option>
              <option value="high">High - NVIDIA H100 (80GB VRAM)</option>
            </select>
            <p className="text-xs text-slate-500 mt-1">⚡ R-Yabot always requires GPU acceleration</p>
          </div>
        </div>

        <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-100">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-bold">Projected Tokens Per Minute (TPM)</p>
          <p className="text-2xl font-bold text-purple-600">{tpm.toLocaleString()}</p>
        </div>
      </section>

      {/* Analytics Volume */}
      <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
          <div className="bg-emerald-100 p-2 rounded-lg">
            <Database className="w-5 h-5 text-emerald-600" />
          </div>
          <h2 className="text-lg font-semibold text-slate-800">Data & Storage Parameters</h2>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Raw Data Volume (GB/Month)</label>
          <input
            type="number"
            {...register('dataVolumeGB', { valueAsNumber: true })}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
          />
        </div>
      </section>
    </div>
  );
};

export default LoadForm;
