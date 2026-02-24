
import React from 'react';
import { UseFormRegister, FieldErrors, UseFormWatch } from 'react-hook-form';
import { AppFormData } from '../types';
import { User, Cpu, MessageSquare, Database, Megaphone } from 'lucide-react';

interface LoadFormProps {
  register: UseFormRegister<AppFormData>;
  errors: FieldErrors<AppFormData>;
  watch: UseFormWatch<AppFormData>;
}

const LoadForm: React.FC<LoadFormProps> = ({ register, errors, watch }) => {
  const watchCRM = watch('crm');
  const watchMarketing = watch('marketing');
  const watchBot = watch('bot');
  const ryabotMode = watch('ryabotMode');
  const isRyabotPremise = ryabotMode === 'premise';

  const crmEnabled = watch('solutions.crm');
  const marketingEnabled = watch('solutions.marketing');
  const ryaBotEnabled = watch('solutions.ryaBot');
  const clickhouseEnabled = watch('solutions.clickhouse');

  // Live Auto-calcs for UI
  const crmActive = Math.ceil((watchCRM.namedUsers * watchCRM.concurrencyRate) / 100);
  const triggersSec = ((crmActive * watchCRM.triggersPerMinute) / 60).toFixed(2);
  const mktActive = Math.ceil((watchMarketing.namedUsers * watchMarketing.concurrencyRate) / 100);
  const mktTriggersSec = ((mktActive * watchMarketing.triggersPerMinute) / 60).toFixed(2);
  const tpm = watchBot.activeUsers * watchBot.requestsPerMinute * watchBot.avgTokensPerRequest;

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-left duration-500">
      {/* CRM Section */}
      {crmEnabled && (
      <section className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
          <div className="bg-blue-100 p-1.5 rounded-lg">
            <User className="w-4 h-4 text-blue-600" />
          </div>
          <h2 className="text-sm font-semibold text-slate-800">CRM Load Dynamics</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">Named Users</label>
            <input
              type="number"
              {...register('crm.namedUsers', { valueAsNumber: true })}
              className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
              placeholder="e.g. 500"
            />
          </div>
          
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">Concurrency Rate (%)</label>
            <input
              type="number"
              {...register('crm.concurrencyRate', { valueAsNumber: true })}
              className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
              placeholder="e.g. 10"
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-medium text-slate-700">Triggers Per Session/Minute</label>
            <input
              type="number"
              {...register('crm.triggersPerMinute', { valueAsNumber: true })}
              className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
              placeholder="e.g. 3"
            />
          </div>
        </div>

        <div className="mt-4 p-3 bg-slate-50 rounded-lg grid grid-cols-2 gap-3 border border-slate-100">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Active Load Users</p>
            <p className="text-xl font-bold text-blue-600">{crmActive || 0}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Triggers/Second</p>
            <p className="text-xl font-bold text-indigo-600">{triggersSec || '0.00'}</p>
          </div>
        </div>
      </section>
      )}

      {/* Marketing Section */}
      {marketingEnabled && (
      <section className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
          <div className="bg-orange-100 p-1.5 rounded-lg">
            <Megaphone className="w-4 h-4 text-orange-600" />
          </div>
          <h2 className="text-sm font-semibold text-slate-800">Marketing Load Dynamics</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">Named Users</label>
            <input
              type="number"
              {...register('marketing.namedUsers', { valueAsNumber: true })}
              className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all outline-none"
              placeholder="e.g. 500"
            />
          </div>
          
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">Concurrency Rate (%)</label>
            <input
              type="number"
              {...register('marketing.concurrencyRate', { valueAsNumber: true })}
              className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all outline-none"
              placeholder="e.g. 10"
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-medium text-slate-700">Triggers Per Session/Minute</label>
            <input
              type="number"
              {...register('marketing.triggersPerMinute', { valueAsNumber: true })}
              className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all outline-none"
              placeholder="e.g. 3"
            />
          </div>
        </div>

        <div className="mt-4 p-3 bg-slate-50 rounded-lg grid grid-cols-2 gap-3 border border-slate-100">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Active Load Users</p>
            <p className="text-xl font-bold text-orange-600">{mktActive || 0}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Triggers/Second</p>
            <p className="text-xl font-bold text-amber-600">{mktTriggersSec || '0.00'}</p>
          </div>
        </div>
      </section>
      )}

      {/* Bot Section */}
      {ryaBotEnabled && (
      <section className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
          <div className="bg-purple-100 p-1.5 rounded-lg">
            <MessageSquare className="w-4 h-4 text-purple-600" />
          </div>
          <h2 className="text-sm font-semibold text-slate-800">R-YaBot Interaction Load</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">Concurrent Bot Users</label>
            <input
              type="number"
              {...register('bot.activeUsers', { valueAsNumber: true })}
              className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">Requests Per User/Min</label>
            <input
              type="number"
              {...register('bot.requestsPerMinute', { valueAsNumber: true })}
              className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-medium text-slate-700">Avg Tokens/Request</label>
            <input
              type="number"
              {...register('bot.avgTokensPerRequest', { valueAsNumber: true })}
              className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
            />
          </div>
          {/* GPU selector only shown for premise mode */}
          {isRyabotPremise && (
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-medium text-slate-700">GPU Performance Level</label>
              <select
                {...register('bot.ryaBotPerformance')}
                className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-white cursor-pointer"
              >
                <option value="average">Average - NVIDIA A100 (80GB VRAM)</option>
                <option value="high">High - NVIDIA H100 (80GB VRAM)</option>
              </select>
              <p className="text-xs text-slate-500 mt-1">⚡ GPU worker added only when workload thresholds require it</p>
            </div>
          )}
          {!isRyabotPremise && (
            <div className="md:col-span-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs text-blue-700 font-medium">☁️ Cloud mode: GPU is not required. Cost is estimated based on TPM usage.</p>
            </div>
          )}
        </div>

        <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Projected Tokens Per Minute (TPM)</p>
          <p className="text-xl font-bold text-purple-600">{tpm.toLocaleString()}</p>
        </div>
      </section>
      )}

      {/* Analytics Volume */}
      {clickhouseEnabled && (
      <section className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
          <div className="bg-emerald-100 p-1.5 rounded-lg">
            <Database className="w-4 h-4 text-emerald-600" />
          </div>
          <h2 className="text-sm font-semibold text-slate-800">Data & Storage Parameters</h2>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-700">Raw Data Volume (GB/Month)</label>
          <input
            type="number"
            {...register('dataVolumeGB', { valueAsNumber: true })}
            className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
          />
        </div>
      </section>
      )}
    </div>
  );
};

export default LoadForm;
