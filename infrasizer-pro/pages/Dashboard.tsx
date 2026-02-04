
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { AppFormData, CalculationResult, Environment } from '../types';
import { calculateInfra } from '../services/CalculatorEngine';
import LoadForm from '../components/LoadForm';
import SolutionSelector from '../components/SolutionSelector';
import InfraTable from '../components/InfraTable';
import SummaryDashboard from '../components/SummaryDashboard';
import { exportToPDF, exportToCSV, exportToExcel } from '../utils/exportUtils';
import { 
  Download, 
  FileJson, 
  FileSpreadsheet, 
  LayoutDashboard, 
  Clipboard, 
  RefreshCcw,
  CheckCircle2,
  Settings,
  Shield
} from 'lucide-react';

interface DashboardProps {
  onAdminClick?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onAdminClick }) => {
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [copied, setCopied] = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<AppFormData>({
    defaultValues: {
      environment: 'UAT',
      crm: { namedUsers: 100, concurrencyRate: 10, triggersPerMinute: 3 },
      bot: { activeUsers: 5, requestsPerMinute: 2, avgTokensPerRequest: 500 },
      solutions: { crm: true, marketing: false, ryaBot: false, clickhouse: false, metabase: false },
      dataVolumeGB: 50
    }
  });

  const onSubmit = (data: AppFormData) => {
    const calcResult = calculateInfra(data);
    setResult(calcResult);
  };

  const handleCopy = () => {
    if (!result) return;
    const text = result.servers.map(s => `${s.name}\n${s.cpu} | ${s.ram} | ${s.hdd}`).join('\n\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Navbar */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img 
              src="/simplecrm_logo.jpeg" 
              alt="SimpleCRM Logo" 
              className="h-24 w-auto rounded-lg"
            />
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight font-['Inter',system-ui,sans-serif]" style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif" }}>Simple Scaler</h1>
              <p className="text-sm text-slate-500 font-semibold tracking-wide font-['Inter',system-ui,sans-serif]" style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif" }}>INFRASTRUCTURE CALCULATION ENGINEC</p>
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
              <option value="PROD">PRODUCTION (1.5x + HA)</option>
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
      <main className="flex-1 max-w-7xl mx-auto w-full p-6 lg:p-10 grid grid-cols-1 xl:grid-cols-12 gap-10">
        
        {/* Left Sidebar - Inputs */}
        <aside className="xl:col-span-4 space-y-8 overflow-y-auto custom-scrollbar xl:max-h-[calc(100vh-140px)] pr-2 pb-10">
          <SolutionSelector register={register} />
          <LoadForm register={register} errors={errors} watch={watch} />
        </aside>

        {/* Right Content - Results */}
        <div className="xl:col-span-8 flex flex-col space-y-6 pb-20">
          
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
                  onClick={() => exportToExcel(result.servers)}
                  className="p-2 bg-slate-100 hover:bg-green-50 text-slate-600 hover:text-green-600 rounded-lg transition-colors group relative"
                  title="Export XLSX"
                >
                  <FileSpreadsheet className="w-5 h-5" />
                  <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity">Excel</span>
                </button>
                <button 
                  onClick={() => exportToCSV(result.servers)}
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
          
          <InfraTable servers={result?.servers || []} />

          {result && (
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
      <footer className="bg-slate-900 text-slate-400 py-6 px-10 border-t border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm">© 2024 InfraSizer Pro. Built for Infrastructure Architects.</p>
          <div className="flex gap-6 text-xs uppercase tracking-widest font-bold">
            <span className="hover:text-white cursor-pointer transition-colors">Documentation</span>
            <span className="hover:text-white cursor-pointer transition-colors">Support</span>
            <span className="hover:text-white cursor-pointer transition-colors">v1.2.4</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;
