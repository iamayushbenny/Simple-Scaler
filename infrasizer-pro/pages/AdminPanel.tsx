import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import {
  Settings,
  LogOut,
  Save,
  RefreshCw,
  Shield,
  Database,
  Cpu,
  HardDrive,
  Users,
  Zap,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';

interface CalculationConfig {
  envMultipliers: {
    DEV: number;
    UAT: number;
    PROD: number;
  };
  crmThresholds: {
    lowToMedium: { triggersPerSec: number; namedUsers: number };
    mediumToHigh: { triggersPerSec: number; namedUsers: number };
  };
  crmSpecs: {
    low: { cpu: number; ram: number; hdd: number };
    medium: { cpu: number; ram: number; hdd: number };
    high: { cpu: number; ram: number; hdd: number };
  };
  botThresholds: {
    lowToMedium: number; // TPM
    mediumToHigh: number; // TPM
  };
  botSpecs: {
    low: { cpu: number; ram: number; hdd: number };
    medium: { cpu: number; ram: number; hdd: number };
    high: { cpu: number; ram: number; hdd: number };
  };
  talendServer: {
    cpu: number;
    ram: number;
    hdd: number;
  };
  marketingServer: {
    cpu: number;
    ram: number;
    hdd: number;
  };
  clickhouseServer: {
    cpu: number;
    ram: number;
    baseHdd: number;
    storageMultiplier: number;
  };
  metabaseServer: {
    cpu: number;
    ram: number;
    hdd: number;
  };
}

const defaultConfig: CalculationConfig = {
  envMultipliers: {
    DEV: 0.8,
    UAT: 1.0,
    PROD: 1.5,
  },
  crmThresholds: {
    lowToMedium: { triggersPerSec: 5, namedUsers: 200 },
    mediumToHigh: { triggersPerSec: 20, namedUsers: 1000 },
  },
  crmSpecs: {
    low: { cpu: 2, ram: 8, hdd: 200 },
    medium: { cpu: 4, ram: 16, hdd: 300 },
    high: { cpu: 8, ram: 32, hdd: 500 },
  },
  botThresholds: {
    lowToMedium: 5000,
    mediumToHigh: 20000,
  },
  botSpecs: {
    low: { cpu: 4, ram: 12, hdd: 100 },
    medium: { cpu: 6, ram: 16, hdd: 100 },
    high: { cpu: 8, ram: 32, hdd: 100 },
  },
  talendServer: {
    cpu: 4,
    ram: 16,
    hdd: 200,
  },
  marketingServer: {
    cpu: 4,
    ram: 12,
    hdd: 80,
  },
  clickhouseServer: {
    cpu: 4,
    ram: 12,
    baseHdd: 80,
    storageMultiplier: 1.5,
  },
  metabaseServer: {
    cpu: 2,
    ram: 8,
    hdd: 80,
  },
};

const AdminPanel: React.FC = () => {
  const { logout } = useAdminAuth();
  const [config, setConfig] = useState<CalculationConfig>(defaultConfig);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'env' | 'crm' | 'bot' | 'servers' | 'security'>('env');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    // Load saved config from localStorage
    const savedConfig = localStorage.getItem('calculationConfig');
    if (savedConfig) {
      setConfig(JSON.parse(savedConfig));
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem('calculationConfig', JSON.stringify(config));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset all settings to default values?')) {
      setConfig(defaultConfig);
      localStorage.removeItem('calculationConfig');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const handlePasswordChange = () => {
    setPasswordError('');
    setPasswordSuccess(false);

    if (!newPassword || newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    localStorage.setItem('adminPassword', newPassword);
    setPasswordSuccess(true);
    setNewPassword('');
    setConfirmPassword('');
    setTimeout(() => setPasswordSuccess(false), 3000);
  };

  const updateConfig = (path: string[], value: number) => {
    setConfig(prev => {
      const newConfig = { ...prev };
      let current: any = newConfig;
      for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i]];
      }
      current[path[path.length - 1]] = value;
      return newConfig;
    });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Admin Configuration Panel</h1>
              <p className="text-xs text-slate-500">Simple Scaler - Calculation Engine Settings</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-all"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 mb-6">
          <div className="flex gap-2 p-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab('env')}
              className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                activeTab === 'env'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Zap className="w-4 h-4 inline mr-2" />
              Environment Multipliers
            </button>
            <button
              onClick={() => setActiveTab('crm')}
              className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                activeTab === 'crm'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Users className="w-4 h-4 inline mr-2" />
              CRM Configuration
            </button>
            <button
              onClick={() => setActiveTab('bot')}
              className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                activeTab === 'bot'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Database className="w-4 h-4 inline mr-2" />
              Bot Configuration
            </button>
            <button
              onClick={() => setActiveTab('servers')}
              className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                activeTab === 'servers'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Cpu className="w-4 h-4 inline mr-2" />
              Server Specifications
            </button>
            <button
              onClick={() => setActiveTab('security')}
              className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                activeTab === 'security'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Lock className="w-4 h-4 inline mr-2" />
              Security
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          {/* Environment Multipliers Tab */}
          {activeTab === 'env' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">Environment Multipliers</h2>
                <p className="text-slate-600 mb-6">
                  These multipliers are applied to resource calculations based on the selected environment.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-50 p-4 rounded-lg">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Development (DEV)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={config.envMultipliers.DEV}
                    onChange={(e) => updateConfig(['envMultipliers', 'DEV'], parseFloat(e.target.value))}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <p className="text-xs text-slate-500 mt-2">Typically 0.5 - 0.9</p>
                </div>

                <div className="bg-slate-50 p-4 rounded-lg">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    UAT / Staging
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={config.envMultipliers.UAT}
                    onChange={(e) => updateConfig(['envMultipliers', 'UAT'], parseFloat(e.target.value))}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <p className="text-xs text-slate-500 mt-2">Baseline (typically 1.0)</p>
                </div>

                <div className="bg-slate-50 p-4 rounded-lg">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Production (PROD)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={config.envMultipliers.PROD}
                    onChange={(e) => updateConfig(['envMultipliers', 'PROD'], parseFloat(e.target.value))}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <p className="text-xs text-slate-500 mt-2">Higher for HA (typically 1.5 - 2.0)</p>
                </div>
              </div>
            </div>
          )}

          {/* CRM Configuration Tab */}
          {activeTab === 'crm' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">CRM Server Configuration</h2>
                <p className="text-slate-600 mb-6">
                  Configure thresholds and specifications for CRM server sizing.
                </p>
              </div>

              {/* Thresholds */}
              <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Load Thresholds</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-slate-700 mb-3">Low → Medium Threshold</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm text-slate-600 mb-1">Triggers Per Second</label>
                        <input
                          type="number"
                          value={config.crmThresholds.lowToMedium.triggersPerSec}
                          onChange={(e) => updateConfig(['crmThresholds', 'lowToMedium', 'triggersPerSec'], parseFloat(e.target.value))}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-slate-600 mb-1">Named Users</label>
                        <input
                          type="number"
                          value={config.crmThresholds.lowToMedium.namedUsers}
                          onChange={(e) => updateConfig(['crmThresholds', 'lowToMedium', 'namedUsers'], parseInt(e.target.value))}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-slate-700 mb-3">Medium → High Threshold</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm text-slate-600 mb-1">Triggers Per Second</label>
                        <input
                          type="number"
                          value={config.crmThresholds.mediumToHigh.triggersPerSec}
                          onChange={(e) => updateConfig(['crmThresholds', 'mediumToHigh', 'triggersPerSec'], parseFloat(e.target.value))}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-slate-600 mb-1">Named Users</label>
                        <input
                          type="number"
                          value={config.crmThresholds.mediumToHigh.namedUsers}
                          onChange={(e) => updateConfig(['crmThresholds', 'mediumToHigh', 'namedUsers'], parseInt(e.target.value))}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Specifications */}
              <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Server Specifications</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {(['low', 'medium', 'high'] as const).map((level) => (
                    <div key={level} className="bg-slate-50 p-4 rounded-lg">
                      <h4 className="font-semibold text-slate-700 mb-3 capitalize">{level} Load</h4>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs text-slate-600 mb-1">CPU Cores</label>
                          <input
                            type="number"
                            value={config.crmSpecs[level].cpu}
                            onChange={(e) => updateConfig(['crmSpecs', level, 'cpu'], parseInt(e.target.value))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-600 mb-1">RAM (GB)</label>
                          <input
                            type="number"
                            value={config.crmSpecs[level].ram}
                            onChange={(e) => updateConfig(['crmSpecs', level, 'ram'], parseInt(e.target.value))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-600 mb-1">HDD (GB)</label>
                          <input
                            type="number"
                            value={config.crmSpecs[level].hdd}
                            onChange={(e) => updateConfig(['crmSpecs', level, 'hdd'], parseInt(e.target.value))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Bot Configuration Tab */}
          {activeTab === 'bot' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">Bot Server Configuration</h2>
                <p className="text-slate-600 mb-6">
                  Configure thresholds and specifications for R-Yabot server sizing based on TPM (Tokens Per Minute).
                </p>
              </div>

              {/* Thresholds */}
              <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-4">TPM Thresholds</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Low → Medium Threshold (TPM)
                    </label>
                    <input
                      type="number"
                      value={config.botThresholds.lowToMedium}
                      onChange={(e) => updateConfig(['botThresholds', 'lowToMedium'], parseInt(e.target.value))}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div className="bg-slate-50 p-4 rounded-lg">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Medium → High Threshold (TPM)
                    </label>
                    <input
                      type="number"
                      value={config.botThresholds.mediumToHigh}
                      onChange={(e) => updateConfig(['botThresholds', 'mediumToHigh'], parseInt(e.target.value))}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Specifications */}
              <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Server Specifications</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {(['low', 'medium', 'high'] as const).map((level) => (
                    <div key={level} className="bg-slate-50 p-4 rounded-lg">
                      <h4 className="font-semibold text-slate-700 mb-3 capitalize">{level} Load</h4>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs text-slate-600 mb-1">CPU Cores</label>
                          <input
                            type="number"
                            value={config.botSpecs[level].cpu}
                            onChange={(e) => updateConfig(['botSpecs', level, 'cpu'], parseInt(e.target.value))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-600 mb-1">RAM (GB)</label>
                          <input
                            type="number"
                            value={config.botSpecs[level].ram}
                            onChange={(e) => updateConfig(['botSpecs', level, 'ram'], parseInt(e.target.value))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-600 mb-1">HDD (GB)</label>
                          <input
                            type="number"
                            value={config.botSpecs[level].hdd}
                            onChange={(e) => updateConfig(['botSpecs', level, 'hdd'], parseInt(e.target.value))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Server Specifications Tab */}
          {activeTab === 'servers' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">Additional Server Specifications</h2>
                <p className="text-slate-600 mb-6">
                  Configure specifications for supporting servers.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Talend Server */}
                <div className="bg-slate-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <Database className="w-4 h-4" />
                    Talend / ETL Server
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">CPU Cores</label>
                      <input
                        type="number"
                        value={config.talendServer.cpu}
                        onChange={(e) => updateConfig(['talendServer', 'cpu'], parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">RAM (GB)</label>
                      <input
                        type="number"
                        value={config.talendServer.ram}
                        onChange={(e) => updateConfig(['talendServer', 'ram'], parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">HDD (GB)</label>
                      <input
                        type="number"
                        value={config.talendServer.hdd}
                        onChange={(e) => updateConfig(['talendServer', 'hdd'], parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Marketing Server */}
                <div className="bg-slate-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Marketing Server
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">CPU Cores</label>
                      <input
                        type="number"
                        value={config.marketingServer.cpu}
                        onChange={(e) => updateConfig(['marketingServer', 'cpu'], parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">RAM (GB)</label>
                      <input
                        type="number"
                        value={config.marketingServer.ram}
                        onChange={(e) => updateConfig(['marketingServer', 'ram'], parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">HDD (GB)</label>
                      <input
                        type="number"
                        value={config.marketingServer.hdd}
                        onChange={(e) => updateConfig(['marketingServer', 'hdd'], parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Clickhouse Server */}
                <div className="bg-slate-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <Database className="w-4 h-4" />
                    Clickhouse Server
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">CPU Cores</label>
                      <input
                        type="number"
                        value={config.clickhouseServer.cpu}
                        onChange={(e) => updateConfig(['clickhouseServer', 'cpu'], parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">RAM (GB)</label>
                      <input
                        type="number"
                        value={config.clickhouseServer.ram}
                        onChange={(e) => updateConfig(['clickhouseServer', 'ram'], parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Base HDD (GB)</label>
                      <input
                        type="number"
                        value={config.clickhouseServer.baseHdd}
                        onChange={(e) => updateConfig(['clickhouseServer', 'baseHdd'], parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Storage Multiplier</label>
                      <input
                        type="number"
                        step="0.1"
                        value={config.clickhouseServer.storageMultiplier}
                        onChange={(e) => updateConfig(['clickhouseServer', 'storageMultiplier'], parseFloat(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Metabase Server */}
                <div className="bg-slate-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <Cpu className="w-4 h-4" />
                    Metabase Server
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">CPU Cores</label>
                      <input
                        type="number"
                        value={config.metabaseServer.cpu}
                        onChange={(e) => updateConfig(['metabaseServer', 'cpu'], parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">RAM (GB)</label>
                      <input
                        type="number"
                        value={config.metabaseServer.ram}
                        onChange={(e) => updateConfig(['metabaseServer', 'ram'], parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">HDD (GB)</label>
                      <input
                        type="number"
                        value={config.metabaseServer.hdd}
                        onChange={(e) => updateConfig(['metabaseServer', 'hdd'], parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">Security Settings</h2>
                <p className="text-slate-600 mb-6">
                  Change the admin panel password for enhanced security.
                </p>
              </div>

              <div className="max-w-md">
                <div className="bg-slate-50 p-6 rounded-lg space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswords ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-4 py-2 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Enter new password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords(!showPasswords)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                      >
                        {showPasswords ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Confirm Password
                    </label>
                    <input
                      type={showPasswords ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Confirm new password"
                    />
                  </div>

                  {passwordError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                      {passwordError}
                    </div>
                  )}

                  {passwordSuccess && (
                    <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                      Password updated successfully!
                    </div>
                  )}

                  <button
                    onClick={handlePasswordChange}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
                  >
                    <Lock className="w-4 h-4" />
                    Update Password
                  </button>

                  <p className="text-xs text-slate-500 text-center">
                    Password must be at least 6 characters long
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 justify-end mt-6">
          <button
            onClick={handleReset}
            className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-all flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Reset to Defaults
          </button>
          <button
            onClick={handleSave}
            className={`px-6 py-3 font-semibold rounded-lg transition-all flex items-center gap-2 ${
              saved
                ? 'bg-green-600 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            <Save className="w-4 h-4" />
            {saved ? 'Settings Saved!' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
