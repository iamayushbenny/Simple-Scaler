
import React from 'react';
import { ServerSpec } from '../types';
import { Server } from 'lucide-react';

interface InfraTableProps {
  servers: ServerSpec[];
  onZoneChange?: (serverId: string, newZone: 'DMZ' | 'Internal' | 'Private') => void;
}

const InfraTable: React.FC<InfraTableProps> = ({ servers, onZoneChange }) => {
  if (servers.length === 0) return (
    <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 text-slate-400">
      <Server className="w-12 h-12 mb-3 opacity-20" />
      <p>Configure parameters and click "Calculate Infrastructure" to see results.</p>
    </div>
  );

  return (
    <div className="space-y-10">
      {servers.map((server, idx) => (
        <div key={`${server.id}-${idx}`} className="bg-white rounded-lg overflow-hidden border border-slate-200 shadow-sm">
          {/* Header Row */}
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-3">
            <h3 className="font-bold text-slate-900 text-lg uppercase tracking-tight">
              {server.name}
            </h3>
          </div>

          {/* Table Data */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-white">
                  <th className="px-6 py-3 text-sm font-semibold text-slate-900 w-1/3 border-r border-slate-100">Specification</th>
                  <th className="px-6 py-3 text-sm font-medium text-slate-700 italic">{server.specification || ''}</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                <tr className="border-b border-slate-100">
                  <td className="px-6 py-3 font-semibold text-slate-900 border-r border-slate-100">RAM</td>
                  <td className="px-6 py-3 text-slate-700">{server.ram}</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="px-6 py-3 font-semibold text-slate-900 border-r border-slate-100">HDD</td>
                  <td className="px-6 py-3 text-slate-700">{server.hdd}</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="px-6 py-3 font-semibold text-slate-900 border-r border-slate-100">Processor</td>
                  <td className="px-6 py-3 text-slate-700">{server.cpu}</td>
                </tr>
                {server.gpu && (
                  <tr className="border-b border-slate-100 bg-blue-50">
                    <td className="px-6 py-3 font-semibold text-slate-900 border-r border-slate-100">GPU</td>
                    <td className="px-6 py-3 text-slate-700">
                      <span className="font-semibold text-blue-700">{server.gpu.type}</span> - {server.gpu.vram} VRAM
                    </td>
                  </tr>
                )}
                <tr className="border-b border-slate-100">
                  <td className="px-6 py-3 font-semibold text-slate-900 border-r border-slate-100">OS</td>
                  <td className="px-6 py-3 text-slate-700">{server.os}</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="px-6 py-3 font-semibold text-slate-900 border-r border-slate-100">Network Zone</td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <select
                        value={server.networkZone}
                        onChange={(e) => onZoneChange?.(server.id, e.target.value as 'DMZ' | 'Internal' | 'Private')}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold border-2 cursor-pointer focus:ring-2 focus:ring-blue-500 outline-none ${
                          server.networkZone === 'DMZ' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                          server.networkZone === 'Internal' ? 'bg-green-50 text-green-700 border-green-200' :
                          'bg-purple-50 text-purple-700 border-purple-200'
                        }`}
                      >
                        <option value="DMZ">DMZ</option>
                        <option value="Internal">Internal</option>
                        <option value="Private">Private</option>
                      </select>
                      <span className="text-xs text-slate-500">Change network deployment zone</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
};

export default InfraTable;
