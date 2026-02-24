
import React from 'react';
import { ServerSpec, CloudCostEstimate } from '../types';
import { Server, Cloud, DollarSign, ShieldAlert } from 'lucide-react';

interface InfraTableProps {
  servers: ServerSpec[];
  onZoneChange?: (serverId: string, newZone: 'DMZ' | 'Internal') => void;
  saasMessage?: string;
  ryaBotCloudCost?: CloudCostEstimate;
  drMessage?: string;
}

const InfraTable: React.FC<InfraTableProps> = ({ servers, onZoneChange, saasMessage, ryaBotCloudCost, drMessage }) => {
  // --- SaaS mode: show managed message ---
  if (saasMessage) {
    return (
      <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-blue-200 rounded-2xl bg-blue-50 text-blue-700 p-8">
        <Cloud className="w-12 h-12 mb-3 opacity-60" />
        <p className="text-center font-medium text-lg">{saasMessage}</p>
      </div>
    );
  }

  if (servers.length === 0) return (
    <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 text-slate-400">
      <Server className="w-12 h-12 mb-3 opacity-20" />
      <p>Configure parameters and click "Calculate Infrastructure" to see results.</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* --- NEW: RyaBot Cloud Cost Card --- */}
      {ryaBotCloudCost && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg overflow-hidden border border-purple-200 shadow-sm">
          <div className="bg-purple-100 border-b border-purple-200 px-6 py-3 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-purple-700" />
            <h3 className="font-bold text-purple-900 text-lg tracking-tight">R-YaBot Cloud Cost Estimate</h3>
          </div>
          <div className="p-6">
            <p className="text-sm text-purple-800 leading-relaxed">
              Cloud-based R-YaBot deployment detected. The cost estimation module for on-cloud LLM infrastructure is currently under development.
              Final pricing will factor in TPM usage, provider rates, and scaling tiers. This section will be updated in a future release.
            </p>
          </div>
        </div>
      )}

      {servers.map((server, idx) => (
        <div key={`${server.id}-${idx}`} className="bg-white rounded-lg overflow-hidden border border-slate-200 shadow-sm">
          {/* Header Row */}
          <div className="bg-slate-50 border-b border-slate-200 px-5 py-2.5">
            <h3 className="font-bold text-slate-900 text-sm uppercase tracking-tight">
              {server.name}
            </h3>
          </div>

          {/* Table Data */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-white">
                  <th className="px-5 py-2 text-xs font-semibold text-slate-900 w-1/3 border-r border-slate-100">Specification</th>
                  <th className="px-5 py-2 text-xs font-medium text-slate-700 italic">{server.specification || ''}</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                <tr className="border-b border-slate-100">
                  <td className="px-5 py-2 font-semibold text-slate-900 border-r border-slate-100">RAM</td>
                  <td className="px-5 py-2 text-slate-700">{server.ram}</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="px-5 py-2 font-semibold text-slate-900 border-r border-slate-100">HDD</td>
                  <td className="px-5 py-2 text-slate-700">{server.hdd}</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="px-5 py-2 font-semibold text-slate-900 border-r border-slate-100">Processor</td>
                  <td className="px-5 py-2 text-slate-700">{server.cpu}</td>
                </tr>
                {server.gpu && (
                  <tr className="border-b border-slate-100 bg-blue-50">
                    <td className="px-5 py-2 font-semibold text-slate-900 border-r border-slate-100">GPU</td>
                    <td className="px-5 py-2 text-slate-700">
                      <span className="font-semibold text-blue-700">{server.gpu.type}</span> - {server.gpu.vram} VRAM
                    </td>
                  </tr>
                )}
                <tr className="border-b border-slate-100">
                  <td className="px-5 py-2 font-semibold text-slate-900 border-r border-slate-100">OS</td>
                  <td className="px-5 py-2 text-slate-700">{server.os}</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="px-5 py-2 font-semibold text-slate-900 border-r border-slate-100">Network Zone</td>
                  <td className="px-5 py-2">
                    <div className="flex items-center gap-2">
                      <select
                        value={server.networkZone}
                        onChange={(e) => onZoneChange?.(server.id, e.target.value as 'DMZ' | 'Internal')}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold border-2 cursor-pointer focus:ring-2 focus:ring-blue-500 outline-none ${
                          server.networkZone === 'DMZ' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                          'bg-green-50 text-green-700 border-green-200'
                        }`}
                      >
                        <option value="DMZ">DMZ</option>
                        <option value="Internal">Internal</option>
                      </select>
                      <span className="text-[10px] text-slate-500">Change network deployment zone</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* DR informational message */}
      {drMessage && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-5 rounded-r-xl">
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="w-5 h-5 text-amber-700" />
            <h4 className="font-bold text-amber-900">Disaster Recovery (DR)</h4>
          </div>
          <p className="text-amber-800 text-sm leading-relaxed">{drMessage}</p>
        </div>
      )}
    </div>
  );
};

export default InfraTable;
