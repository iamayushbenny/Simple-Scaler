
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { AppFormData, CalculationResult, Environment } from '../types';
import { calculateInfra } from '../services/CalculatorEngine';
import LoadForm from '../components/LoadForm';
import SolutionSelector from '../components/SolutionSelector';
import InfraTable from '../components/InfraTable';
import SummaryDashboard from '../components/SummaryDashboard';
import { exportToPDF, exportToCSV } from '../utils/exportUtils';
import { 
  Download, 
  FileJson, 
  LayoutDashboard, 
  Clipboard, 
  RefreshCcw,
  CheckCircle2,
  Settings,
  Shield,
  ShieldCheck,
  Database
} from 'lucide-react';

interface DashboardProps {
  onAdminClick?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onAdminClick }) => {
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [copied, setCopied] = useState(false);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<AppFormData>({
    defaultValues: {
      clientName: '',
      environment: 'PROD', // Rule 1: Default to PRODUCTION
      solutionType: 'on-prem',
      crm: { namedUsers: 100, concurrencyRate: 10, triggersPerMinute: 3 },
      bot: { activeUsers: 5, requestsPerMinute: 2, avgTokensPerRequest: 500, ryaBotPerformance: 'average' },
      solutions: { crm: true, marketing: false, ryaBot: false, clickhouse: true, metabase: true },
      dataVolumeGB: 50,
      ryabotMode: 'premise',
      haEnabled: true,
      drEnabled: false,
    }
  });

  const haEnabled = watch('haEnabled');
  const drEnabled = watch('drEnabled');
  const solutionType = watch('solutionType');

  const onSubmit = (data: AppFormData) => {
    const calcResult = calculateInfra(data);
    setResult(calcResult);
  };

  const handleZoneChange = (serverId: string, newZone: 'DMZ' | 'Internal' | 'Private') => {
    if (!result) return;
    const updatedServers = result.servers.map(server =>
      server.id === serverId ? { ...server, networkZone: newZone } : server
    );
    setResult({ ...result, servers: updatedServers });
  };

  const handleCopy = () => {
    if (!result) return;
    const lines: string[] = [];
    if (result.clientName) lines.push(`Client: ${result.clientName}`);
    lines.push(`Deployment: ${result.solutionType?.toUpperCase()}`);
    if (result.saasMessage) {
      lines.push(result.saasMessage);
    } else {
      result.servers.forEach(s => lines.push(`${s.name}\n${s.cpu} | ${s.ram} | ${s.hdd}`));
      if (result.ryaBotCloudCost) {
        lines.push(`\nRyaBot Cloud: $${result.ryaBotCloudCost.monthlyCostUSD}/mo (${result.ryaBotCloudCost.tpm.toLocaleString()} TPM)`);
      }
    }
    navigator.clipboard.writeText(lines.join('\n\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">
      {/* Navbar */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 sticky top-0 z-30 shadow-sm">
        <div className="max-w-[1600px] mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img 
              src="/simplecrm_logo.jpeg" 
              alt="SimpleCRM Logo" 
              className="h-14 w-auto rounded-lg"
            />
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight font-['Inter',system-ui,sans-serif]" style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif" }}>Simple Scaler</h1>
              <p className="text-sm text-slate-500 font-semibold tracking-wide font-['Inter',system-ui,sans-serif]" style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif" }}>INFRASTRUCTURE CALCULATION ENGINE</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={onAdminClick}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-all flex items-center gap-2"
              title="Admin Panel"
            >
              <Shield className="w-4 h-4" />
              Admin
            </button>
            <select 
              {...register('environment')}
              className="bg-slate-100 border-none text-slate-700 text-sm font-semibold py-2 px-4 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="DEV">DEVELOPMENT (0.8x)</option>
              <option value="UAT">UAT / STAGING (1.0x)</option>
              <option value="PROD">PRODUCTION (1.5x)</option>
            </select>
            <button 
              onClick={handleSubmit(onSubmit)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold flex items-center gap-2 transition-all shadow-lg shadow-blue-200 active:scale-95"
            >
              <RefreshCcw className="w-4 h-4" />
              Calculate Infra
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 min-h-0 max-w-[1600px] mx-auto w-full p-4 lg:p-6 grid grid-cols-1 xl:grid-cols-12 gap-6 overflow-hidden">
        
        {/* Left Sidebar - Inputs */}
        <aside className="xl:col-span-4 space-y-5 overflow-y-auto custom-scrollbar pr-2 pb-10">
          {/* NEW: Client Name Field */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800 mb-2">Client Information</h2>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">Client Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                {...register('clientName', { required: 'Client name is required' })}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                placeholder="e.g. Acme Corp"
              />
              {errors.clientName && (
                <p className="text-xs text-red-500 font-medium">{errors.clientName.message}</p>
              )}
            </div>
          </div>

          <SolutionSelector register={register} watch={watch} setValue={setValue} />
          <LoadForm register={register} errors={errors} watch={watch} />

          {/* NEW: HA and DR Checkboxes */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-slate-600" />
              Resilience Options
            </h2>
            <div className="space-y-4">
              <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  {...register('haEnabled')}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <div>
                  <p className="text-sm font-medium text-slate-800">High Availability (HA)</p>
                  <p className="text-xs text-slate-500">Duplicate APP and DB servers for failover (Node-1, Node-2)</p>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  {...register('drEnabled')}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <div>
                  <p className="text-sm font-medium text-slate-800">Disaster Recovery (DR)</p>
                  <p className="text-xs text-slate-500">Duplicate entire stack to a DR zone with -DR suffix</p>
                </div>
              </label>
            </div>
            {(haEnabled || drEnabled) && (
              <div className="mt-3 p-2 bg-amber-50 rounded-lg border border-amber-100 text-xs text-amber-700 font-medium">
                {haEnabled && drEnabled ? 'HA + DR: Servers will be duplicated for both availability and disaster recovery.'
                  : haEnabled ? 'HA: APP and DB nodes will be duplicated (Node-1, Node-2).'
                  : 'DR: Entire stack will be mirrored to a DR zone.'}
              </div>
            )}
          </div>
        </aside>

        {/* Right Content - Results */}
        <div className="xl:col-span-8 flex flex-col space-y-6 overflow-y-auto custom-scrollbar pb-10">
          
          {result && (
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 mb-2">
              <h3 className="font-bold text-slate-700 flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Planning Recommendations
              </h3>
              <div className="flex gap-2">
                <button 
                  onClick={() => exportToPDF(result)}
                  className="p-2 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-lg transition-colors group relative"
                  title="Download PDF"
                >
                  <Download className="w-5 h-5" />
                  <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity">PDF</span>
                </button>

                <button 
                  onClick={() => exportToCSV(result)}
                  className="p-2 bg-slate-100 hover:bg-orange-50 text-slate-600 hover:text-orange-600 rounded-lg transition-colors group relative"
                  title="Export CSV"
                >
                  <FileJson className="w-5 h-5" />
                  <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity">CSV</span>
                </button>
                <div className="w-px h-6 bg-slate-200 mx-2 self-center"></div>
                <button 
                  onClick={handleCopy}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                    copied ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {copied ? <CheckCircle2 className="w-4 h-4" /> : <Clipboard className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy to Clipboard'}
                </button>
              </div>
            </div>
          )}

          <SummaryDashboard result={result} />
          
          <InfraTable
            servers={result?.servers || []}
            onZoneChange={handleZoneChange}
            saasMessage={result?.saasMessage}
            ryaBotCloudCost={result?.ryaBotCloudCost}
          />

          {result && !result.saasMessage && (
            <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded-r-xl mt-8">
              <h4 className="font-bold text-blue-900 mb-2">Architectural Note</h4>
              <p className="text-blue-800 text-sm leading-relaxed">
                The above recommendations are based on rule-based sizing logic with {watch('environment')} environment multipliers. 
                For high availability (HA) in Production, we recommend deploying a secondary instance of critical nodes like Clickhouse and APP Servers behind a Load Balancer (F5 or Nginx).
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Footer Info */}
      <footer className="bg-slate-900 text-slate-400 py-4 px-10 border-t border-slate-800">
        <div className="max-w-[1600px] mx-auto flex justify-center items-center">
          <p className="text-sm">&copy; 2026 Simple Works</p>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;
