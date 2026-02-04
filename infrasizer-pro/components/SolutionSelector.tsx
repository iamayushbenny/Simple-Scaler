
import React from 'react';
import { UseFormRegister } from 'react-hook-form';
import { AppFormData } from '../types';
import { SOLUTIONS_METADATA } from '../constants';
import { Check } from 'lucide-react';

interface SolutionSelectorProps {
  register: UseFormRegister<AppFormData>;
}

const SolutionSelector: React.FC<SolutionSelectorProps> = ({ register }) => {
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-800 mb-4">Solution Components</h2>
      <div className="space-y-3">
        {SOLUTIONS_METADATA.map((solution) => (
          <label 
            key={solution.id} 
            className="flex items-start gap-4 p-4 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer group"
          >
            <div className="relative flex items-center justify-center h-6 w-6 mt-1">
              <input
                type="checkbox"
                {...register(`solutions.${solution.id as keyof AppFormData['solutions']}`)}
                className="peer absolute opacity-0 w-full h-full cursor-pointer"
              />
              <div className="h-5 w-5 border-2 border-slate-300 rounded peer-checked:bg-blue-600 peer-checked:border-blue-600 transition-all flex items-center justify-center">
                <Check className="w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
              </div>
            </div>
            <div>
              <p className="font-medium text-slate-900 group-hover:text-blue-600 transition-colors">{solution.label}</p>
              <p className="text-xs text-slate-500">{solution.description}</p>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
};

export default SolutionSelector;
