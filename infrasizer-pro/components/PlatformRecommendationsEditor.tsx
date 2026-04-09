/**
 * PlatformRecommendationsEditor
 *
 * Admin tab component for editing Software + Browser recommendations.
 * Renders inline-editable tables with add/delete/save/reset.
 *
 * Uses the store module for persistence — never touches the exporter.
 */

import React, { useState, useEffect } from 'react';
import {
  PlatformRecommendations,
  SoftwareRecommendation,
  BrowserRecommendation,
  defaultRecommendations,
  ProductStackId,
  ProductStackRecommendations,
  PRODUCT_STACKS,
} from '../config/platformRecommendations';
import {
  loadPlatformConfig,
  savePlatformConfig,
  resetPlatformConfig,
} from '../admin/platformRecommendationsStore';
import {
  savePlatformConfigRemote,
  getRemotePlatformConfig,
} from '../services/configLoader';
import { Plus, Trash2, Save, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

const STACK_EXPORT_MAPPING: Record<ProductStackId, string> = {
  marketing: 'Exports when Marketing is selected',
  ryabot: 'Exports when RyaBot is selected',
  chatbot: 'Exports when Rocket.Chat is selected',
  crm: 'Exports when CRM is selected',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const emptySoftwareRow = (): SoftwareRecommendation => ({
  software: '',
  supportedVersion: '',
  componentHosted: '',
  comments: '',
});

const emptyBrowserRow = (): BrowserRecommendation => ({
  browser: '',
  supportedVersion: '',
});

// ─── Component ───────────────────────────────────────────────────────────────

const PlatformRecommendationsEditor: React.FC = () => {
  const [productStacks, setProductStacks] = useState<ProductStackRecommendations>({
    marketing: [],
    ryabot: [],
    chatbot: [],
    crm: [],
  });
  const [activeStack, setActiveStack] = useState<ProductStackId>('crm');
  const [browsers, setBrowsers] = useState<BrowserRecommendation[]>([]);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const activeStackRows = productStacks[activeStack] || [];

  const stackLabel = PRODUCT_STACKS.find(s => s.id === activeStack)?.label || activeStack;

  // Load on mount — prefer backend (in-memory cache) → localStorage → defaults
  useEffect(() => {
    const remote = getRemotePlatformConfig();
    const stored = remote || loadPlatformConfig();
    if (stored) {
      const base = {
        marketing: [...defaultRecommendations.productStacks.marketing],
        ryabot: [...defaultRecommendations.productStacks.ryabot],
        chatbot: [...defaultRecommendations.productStacks.chatbot],
        crm: [...defaultRecommendations.productStacks.crm],
      };

      const incoming = stored.productStacks;
      if (incoming && typeof incoming === 'object') {
        setProductStacks({
          marketing: Array.isArray(incoming.marketing) ? incoming.marketing : (Array.isArray((incoming as any).ss1) ? (incoming as any).ss1 : base.marketing),
          ryabot: Array.isArray(incoming.ryabot) ? incoming.ryabot : (Array.isArray((incoming as any).ss2) ? (incoming as any).ss2 : base.ryabot),
          chatbot: Array.isArray(incoming.chatbot) ? incoming.chatbot : (Array.isArray((incoming as any).ss3) ? (incoming as any).ss3 : base.chatbot),
          crm: Array.isArray(incoming.crm) ? incoming.crm : (Array.isArray((incoming as any).ss4) ? (incoming as any).ss4 : (stored.software || base.crm)),
        });
      } else {
        setProductStacks({
          ...base,
          crm: Array.isArray(stored.software) && stored.software.length > 0 ? stored.software : base.crm,
        });
      }
      setBrowsers(stored.browsers);
    } else {
      setProductStacks({
        marketing: [...defaultRecommendations.productStacks.marketing],
        ryabot: [...defaultRecommendations.productStacks.ryabot],
        chatbot: [...defaultRecommendations.productStacks.chatbot],
        crm: [...defaultRecommendations.productStacks.crm],
      });
      setBrowsers([...defaultRecommendations.browsers]);
    }
  }, []);

  // ─── Software table handlers ───────────────────────────────────────────

  const updateSoftwareField = (
    index: number,
    field: keyof SoftwareRecommendation,
    value: string,
  ) => {
    setProductStacks(prev => {
      const nextRows = [...(prev[activeStack] || [])];
      nextRows[index] = { ...nextRows[index], [field]: value };
      return {
        ...prev,
        [activeStack]: nextRows,
      };
    });
  };

  const addSoftwareRow = () =>
    setProductStacks(prev => ({
      ...prev,
      [activeStack]: [...(prev[activeStack] || []), emptySoftwareRow()],
    }));

  const removeSoftwareRow = (index: number) =>
    setProductStacks(prev => ({
      ...prev,
      [activeStack]: (prev[activeStack] || []).filter((_, i) => i !== index),
    }));

  // ─── Browser table handlers ────────────────────────────────────────────

  const updateBrowserField = (
    index: number,
    field: keyof BrowserRecommendation,
    value: string,
  ) => {
    setBrowsers(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addBrowserRow = () => setBrowsers(prev => [...prev, emptyBrowserRow()]);

  const removeBrowserRow = (index: number) =>
    setBrowsers(prev => prev.filter((_, i) => i !== index));

  // ─── Save / Reset ─────────────────────────────────────────────────────

  const handleSave = async () => {
    setError('');
    setSaved(false);

    // Client-side validation
    for (const stack of PRODUCT_STACKS) {
      const rows = productStacks[stack.id] || [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row.software.trim() || !row.supportedVersion.trim()) {
          setError(`${stack.label} - row ${i + 1}: Name and Version are required.`);
          return;
        }
      }
    }
    for (let i = 0; i < browsers.length; i++) {
      const row = browsers[i];
      if (!row.browser.trim() || !row.supportedVersion.trim()) {
        setError(`Browser row ${i + 1}: Browser name and Version are required.`);
        return;
      }
    }

    const payload: PlatformRecommendations = {
      productStacks,
      browsers,
    };

    // Save to localStorage (cache / fallback)
    const ok = savePlatformConfig(payload);
    if (!ok) {
      setError('Validation failed. Ensure at least one valid software or browser row exists.');
      return;
    }

    // Persist to backend (source of truth)
    const remoteOk = await savePlatformConfigRemote(payload);
    if (!remoteOk) {
      // Saved locally but backend write failed — warn the admin
      setError('Saved locally, but failed to sync to the server. Changes may not persist for other users.');
      setSaved(true);
      setTimeout(() => setSaved(false), 5000);
      return;
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleReset = () => {
    if (!confirm('Reset platform recommendations to built-in defaults? Admin changes will be deleted.')) return;
    resetPlatformConfig();
    setProductStacks({
      marketing: [...defaultRecommendations.productStacks.marketing],
      ryabot: [...defaultRecommendations.productStacks.ryabot],
      chatbot: [...defaultRecommendations.productStacks.chatbot],
      crm: [...defaultRecommendations.productStacks.crm],
    });
    setActiveStack('crm');
    setBrowsers([...defaultRecommendations.browsers]);
    setSaved(false);
    setError('');
  };

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Platform Recommendations</h2>
        <p className="text-slate-600 mb-4">
          Edit software and browser recommendations exported in the "Platform Recommendation" sheet.
          Changes apply to all future exports immediately.
        </p>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-700">
          <p className="font-semibold mb-1">How this works</p>
          <p>Each product stack maps to product selection in the sizing form. The Excel export includes only the software rows for selected products.</p>
        </div>
      </div>

      {/* ── Software Table ──────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Software Recommendations</h3>
            <p className="text-xs text-slate-500 mt-1">Maintain product-specific stacks. Export includes only stacks mapped to selected solutions.</p>
          </div>
          <button
            onClick={addSoftwareRow}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Row
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          {PRODUCT_STACKS.map(stack => (
            <button
              key={stack.id}
              onClick={() => setActiveStack(stack.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeStack === stack.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {stack.label} ({(productStacks[stack.id] || []).length})
            </button>
          ))}
        </div>

        <div className="mb-3 p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-sm">
          <p className="font-semibold text-blue-800">{stackLabel}</p>
          <p className="text-blue-700">{STACK_EXPORT_MAPPING[activeStack]}</p>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-3 py-2.5 font-semibold text-slate-700 w-[18%]">Software</th>
                <th className="text-left px-3 py-2.5 font-semibold text-slate-700 w-[16%]">Version</th>
                <th className="text-left px-3 py-2.5 font-semibold text-slate-700 w-[24%]">Component Hosted</th>
                <th className="text-left px-3 py-2.5 font-semibold text-slate-700 w-[34%]">Comments</th>
                <th className="w-[8%]"></th>
              </tr>
            </thead>
            <tbody>
              {activeStackRows.map((row, i) => (
                <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={row.software}
                      onChange={e => updateSoftwareField(i, 'software', e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="e.g. PostgreSQL"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={row.supportedVersion}
                      onChange={e => updateSoftwareField(i, 'supportedVersion', e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="e.g. 16.x"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={row.componentHosted}
                      onChange={e => updateSoftwareField(i, 'componentHosted', e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="e.g. Database Server"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={row.comments}
                      onChange={e => updateSoftwareField(i, 'comments', e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Optional notes"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <button
                      onClick={() => removeSoftwareRow(i)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Delete row"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {activeStackRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-slate-400 text-sm">
                    No rows for {PRODUCT_STACKS.find(s => s.id === activeStack)?.label}. Click "Add Row" to start.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Browser Table ───────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-slate-800">Browser Recommendations</h3>
          <button
            onClick={addBrowserRow}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Row
          </button>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-3 py-2.5 font-semibold text-slate-700 w-[40%]">Browser</th>
                <th className="text-left px-3 py-2.5 font-semibold text-slate-700 w-[50%]">Supported Version</th>
                <th className="w-[10%]"></th>
              </tr>
            </thead>
            <tbody>
              {browsers.map((row, i) => (
                <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={row.browser}
                      onChange={e => updateBrowserField(i, 'browser', e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="e.g. Google Chrome"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={row.supportedVersion}
                      onChange={e => updateBrowserField(i, 'supportedVersion', e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="e.g. 120+"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <button
                      onClick={() => removeBrowserRow(i)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Delete row"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {browsers.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center py-6 text-slate-400 text-sm">
                    No browser rows. Click "Add Row" to start.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Feedback ────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
      {saved && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          Platform recommendations saved successfully! Changes will appear in exports.
        </div>
      )}

      {/* ── Action Buttons ──────────────────────────────────────────── */}
      <div className="flex gap-3 justify-end pt-2">
        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Reset to Defaults
        </button>
        <button
          onClick={handleSave}
          className={`flex items-center gap-2 px-5 py-2.5 font-medium rounded-lg transition-all ${
            saved
              ? 'bg-green-600 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          <Save className="w-4 h-4" />
          {saved ? 'Saved!' : 'Save Recommendations'}
        </button>
      </div>
    </div>
  );
};

export default PlatformRecommendationsEditor;
