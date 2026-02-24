
import React from 'react';
import { UseFormRegister, UseFormWatch, UseFormSetValue } from 'react-hook-form';
import { AppFormData, SolutionType } from '../types';
import { SOLUTIONS_METADATA, SOLUTION_TYPE_OPTIONS, CLICKHOUSE_AUTO_ENABLE_THRESHOLD } from '../constants';
import { Check, Cloud, Server, Globe, Info } from 'lucide-react';

interface SolutionSelectorProps {
  register: UseFormRegister<AppFormData>;
  watch: UseFormWatch<AppFormData>;
  setValue: UseFormSetValue<AppFormData>;
}

const SolutionSelector: React.FC<SolutionSelectorProps> = ({ register, watch, setValue }) => {
  const solutionType = watch('solutionType');
  const ryaBotEnabled = watch('solutions.ryaBot');
  const ryabotMode = watch('ryabotMode');
  const concurrencyRate = watch('crm.concurrencyRate');
  const namedUsers = watch('crm.namedUsers');
  const concurrentUsers = Math.ceil((namedUsers * concurrencyRate) / 100);

  // --- Rule 7: Auto-enable ClickHouse when concurrent users >= threshold ---
  const clickhouseAutoEnabled = concurrentUsers >= CLICKHOUSE_AUTO_ENABLE_THRESHOLD;

  React.useEffect(() => {
    if (clickhouseAutoEnabled) {
      setValue('solutions.clickhouse', true);
    }
  }, [clickhouseAutoEnabled, setValue]);

  const solutionTypeIcons: Record<string, React.ReactNode> = {
    'on-prem': <Server className="w-4 h-4" />,
    'on-cloud': <Cloud className="w-4 h-4" />,
    'saas': <Globe className="w-4 h-4" />,
  };

  return (
    <div className="space-y-5">
      {/* Solution Type Selector */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800 mb-1">Deployment Model</h2>
        <p className="text-[11px] text-slate-500 mb-3">Select how the solution will be deployed.</p>
        <div className="grid grid-cols-3 gap-2">
          {SOLUTION_TYPE_OPTIONS.map((opt) => {
            const isActive = solutionType === opt.value;
            return (
              <label
                key={opt.value}
                className={`relative flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 cursor-pointer transition-all text-center ${
                  isActive
                    ? 'border-blue-600 bg-blue-50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <input
                  type="radio"
                  value={opt.value}
                  {...register('solutionType')}
                  className="sr-only"
                />
                <div className={`p-1.5 rounded-lg ${isActive ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                  {solutionTypeIcons[opt.value]}
                </div>
                <span className={`text-sm font-semibold ${isActive ? 'text-blue-700' : 'text-slate-700'}`}>{opt.label}</span>
                <span className="text-[10px] text-slate-400 leading-tight">{opt.description}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Solution Components */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800 mb-1">Solution Components</h2>
        {/* Rule 2: Helper text */}
        <p className="text-[11px] text-slate-500 mb-3">Choose what services you want along with the user workload requirements.</p>
        <div className="space-y-2">
          {SOLUTIONS_METADATA.map((solution) => {
            const isClickhouse = solution.id === 'clickhouse';
            const isForceChecked = isClickhouse && clickhouseAutoEnabled;

            return (
              <label
                key={solution.id}
                className={`flex items-start gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer group ${
                  isForceChecked ? 'bg-amber-50 border-amber-200' : ''
                }`}
              >
                <div className="relative flex items-center justify-center h-5 w-5 mt-0.5">
                  <input
                    type="checkbox"
                    {...register(`solutions.${solution.id as keyof AppFormData['solutions']}`)}
                    disabled={isForceChecked}
                    className="peer absolute opacity-0 w-full h-full cursor-pointer disabled:cursor-not-allowed"
                  />
                  <div className={`h-5 w-5 border-2 rounded peer-checked:bg-blue-600 peer-checked:border-blue-600 transition-all flex items-center justify-center ${
                    isForceChecked ? 'border-amber-400 bg-amber-500 !border-amber-500' : 'border-slate-300'
                  }`}>
                    <Check className="w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                  </div>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-slate-900 group-hover:text-blue-600 transition-colors">{solution.label}</p>
                  <p className="text-xs text-slate-500">{solution.description}</p>
                  {/* Rule 7: Auto-enable tooltip */}
                  {isForceChecked && (
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-amber-700 font-medium">
                      <Info className="w-3 h-3" />
                      Auto-enabled due to scale threshold ({concurrentUsers} concurrent users ≥ {CLICKHOUSE_AUTO_ENABLE_THRESHOLD})
                    </div>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* RyaBot Deployment Mode — shown only when RyaBot is enabled */}
      {ryaBotEnabled && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800 mb-1">R-YaBot Deployment Mode</h2>
          <p className="text-[11px] text-slate-500 mb-3">Choose how R-YaBot's AI layer will be deployed.</p>
          <div className="grid grid-cols-2 gap-2">
            <label
              className={`relative flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 cursor-pointer transition-all text-center ${
                ryabotMode === 'premise'
                  ? 'border-purple-600 bg-purple-50 shadow-sm'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <input type="radio" value="premise" {...register('ryabotMode')} className="sr-only" />
              <div className={`p-1.5 rounded-lg ${ryabotMode === 'premise' ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-500'}`}>
                <Server className="w-4 h-4" />
              </div>
              <span className={`text-sm font-semibold ${ryabotMode === 'premise' ? 'text-purple-700' : 'text-slate-700'}`}>On-Premise</span>
              <span className="text-[10px] text-slate-400 leading-tight">Control server + optional GPU worker</span>
            </label>
            <label
              className={`relative flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 cursor-pointer transition-all text-center ${
                ryabotMode === 'cloud'
                  ? 'border-purple-600 bg-purple-50 shadow-sm'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <input type="radio" value="cloud" {...register('ryabotMode')} className="sr-only" />
              <div className={`p-1.5 rounded-lg ${ryabotMode === 'cloud' ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-500'}`}>
                <Cloud className="w-4 h-4" />
              </div>
              <span className={`text-sm font-semibold ${ryabotMode === 'cloud' ? 'text-purple-700' : 'text-slate-700'}`}>Cloud</span>
              <span className="text-[10px] text-slate-400 leading-tight">TPM-based cost model, no GPU</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
};

export default SolutionSelector;
