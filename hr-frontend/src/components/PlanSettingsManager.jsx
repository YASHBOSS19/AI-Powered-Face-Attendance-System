import React, { useState, useEffect } from 'react';
import { 
  Crown, Save, RotateCcw, Check, Sparkles, AlertCircle, 
  Users, DollarSign, Layers, Plus, Trash2, CheckCircle2, 
  TrendingUp, Shield, HelpCircle, ArrowRight, Activity, Zap
} from 'lucide-react';
import { apiCall } from '../api';

const ALL_MODULES = [
  { id: 'overview', name: 'Dashboard Overview', desc: 'Real-time metrics & charts' },
  { id: 'employees', name: 'Staff & Face Biometrics', desc: 'Face enrollment & employee records' },
  { id: 'kiosk', name: 'Face AI Kiosk Check-In', desc: 'Interactive biometric scanning terminal' },
  { id: 'reports', name: 'Attendance Reports & CSV', desc: 'Exportable logs & analytics' },
  { id: 'unknown_identity', name: 'Unknown Face Alerts', desc: 'Intruder & unauthorized face capture' },
  { id: 'gate', name: 'Turnstile Gate Relay', desc: 'Hardware sync & access pulse' },
  { id: 'settings', name: 'Advanced Organization Rules', desc: 'Custom thresholds & schedule policies' },
];

export default function PlanSettingsManager({ onPlansUpdated }) {
  const [plans, setPlans] = useState([]);
  const [defaultPlans, setDefaultPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState(null);
  const [activeFeatureInput, setActiveFeatureInput] = useState({ planId: null, text: '' });
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    fetchPlans();
  }, []);

  const showToast = (type, title, message) => {
    setToast({ type, title, message });
    setTimeout(() => setToast(null), 4500);
  };

  const fetchPlans = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiCall('/super-admin/plans');
      if (data.status === 'success') {
        setPlans(data.plans || []);
        setDefaultPlans(data.default_plans || []);
      } else {
        throw new Error(data.detail || 'Failed to load subscription plans');
      }
    } catch (err) {
      console.error('Error fetching subscription plans:', err);
      setError(err.message || 'Failed to load global plans');
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (planId, field, value) => {
    setPlans(prev => prev.map(p => {
      if (p.id === planId) {
        return { ...p, [field]: value };
      }
      return p;
    }));
  };

  const handleModuleToggle = (planId, moduleId) => {
    setPlans(prev => prev.map(p => {
      if (p.id === planId) {
        const currentMods = p.default_modules || [];
        const nextMods = currentMods.includes(moduleId)
          ? currentMods.filter(m => m !== moduleId)
          : [...currentMods, moduleId];
        return { ...p, default_modules: nextMods };
      }
      return p;
    }));
  };

  const handleAddFeature = (planId) => {
    if (!activeFeatureInput.text.trim()) return;
    setPlans(prev => prev.map(p => {
      if (p.id === planId) {
        const feats = p.features || [];
        return { ...p, features: [...feats, activeFeatureInput.text.trim()] };
      }
      return p;
    }));
    setActiveFeatureInput({ planId: null, text: '' });
  };

  const handleRemoveFeature = (planId, indexToRemove) => {
    setPlans(prev => prev.map(p => {
      if (p.id === planId) {
        const feats = (p.features || []).filter((_, idx) => idx !== indexToRemove);
        return { ...p, features: feats };
      }
      return p;
    }));
  };

  const handleSaveAll = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        plans: plans.map(p => ({
          id: p.id,
          name: p.name.trim(),
          tagline: (p.tagline || '').trim(),
          max_employees: Number(p.max_employees) || 10,
          price_monthly: Number(p.price_monthly) || 0,
          price_annual: Number(p.price_annual) || 0,
          badge_color: p.badge_color || 'slate',
          badge_label: p.badge_label || null,
          is_popular: !!p.is_popular,
          is_recommended: !!p.is_recommended,
          features: p.features || [],
          default_modules: p.default_modules || []
        }))
      };

      const res = await apiCall('/super-admin/plans', {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      if (res.status === 'success') {
        showToast('success', 'Plans Saved', 'Global subscription tiers updated. All new and existing tenant calculations now use these parameters.');
        if (onPlansUpdated) onPlansUpdated(res.plans);
      } else {
        throw new Error(res.detail || 'Failed to save plans');
      }
    } catch (err) {
      console.error('Error saving plans:', err);
      setError(err.message || 'Failed to save subscription plans');
      showToast('error', 'Update Failed', err.message || 'Failed to save subscription plans');
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    setResetting(true);
    setShowResetConfirm(false);
    try {
      const res = await apiCall('/super-admin/plans/reset', { method: 'POST' });
      if (res.status === 'success') {
        setPlans(res.plans || defaultPlans);
        showToast('info', 'Reset Complete', 'Subscription plans restored to factory defaults (Free: 10 seats, Basic: 50 seats, Enterprise: 500 seats).');
        if (onPlansUpdated) onPlansUpdated(res.plans);
      }
    } catch (err) {
      console.error('Error resetting plans:', err);
      showToast('error', 'Reset Failed', err.message || 'Failed to reset plans');
    } finally {
      setResetting(false);
    }
  };

  // Calculations for summary banner
  const totalTenants = plans.reduce((acc, p) => acc + (p.tenant_count || 0), 0);
  const totalActiveTenants = plans.reduce((acc, p) => acc + (p.active_tenant_count || 0), 0);
  const totalEstimatedMRR = plans.reduce((acc, p) => acc + ((p.active_tenant_count || 0) * (Number(p.price_monthly) || 0)), 0);
  const totalAllocatedSeats = plans.reduce((acc, p) => acc + ((p.tenant_count || 0) * (Number(p.max_employees) || 0)), 0);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px] space-y-4">
        <div className="w-12 h-12 border-4 border-brand-teal/30 border-t-brand-teal rounded-full animate-spin" />
        <p className="text-slate-500 font-medium">Loading subscription tiers & pricing configurations...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-start gap-3 p-4 rounded-xl shadow-2xl border backdrop-blur-md max-w-md animate-in slide-in-from-bottom-5 duration-300 ${
          toast.type === 'success' ? 'bg-emerald-950/90 text-emerald-100 border-emerald-500/50' :
          toast.type === 'error' ? 'bg-rose-950/90 text-rose-100 border-rose-500/50' :
          'bg-slate-900/90 text-slate-100 border-slate-700'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="text-emerald-400 flex-shrink-0 mt-0.5" size={20} /> :
           toast.type === 'error' ? <AlertCircle className="text-rose-400 flex-shrink-0 mt-0.5" size={20} /> :
           <Sparkles className="text-brand-teal flex-shrink-0 mt-0.5" size={20} />}
          <div>
            <h4 className="font-semibold text-sm">{toast.title}</h4>
            <p className="text-xs text-white/80 mt-0.5 leading-relaxed">{toast.message}</p>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-brand-navy via-slate-900 to-brand-dark text-white p-6 md:p-8 rounded-2xl shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-brand-teal/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-10 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-teal/20 text-brand-teal border border-brand-teal/30 rounded-full text-xs font-semibold uppercase tracking-wider">
              <Crown size={14} /> Subscription Engine
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Subscription Tiers & Plan Manager
            </h1>
            <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
              Configure global pricing ($), employee capacity seat caps, feature bullet points, and default module permissions for the 3 core plans: <strong className="text-white font-semibold">Free Starter</strong>, <strong className="text-white font-semibold">Basic / Growth</strong>, and <strong className="text-white font-semibold">Enterprise Scale</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowResetConfirm(true)}
              disabled={saving || resetting}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shadow-sm"
              title="Reset all plans to factory defaults"
            >
              <RotateCcw size={15} />
              Reset Defaults
            </button>
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="px-6 py-2.5 bg-gradient-to-r from-brand-teal to-emerald-500 hover:from-teal-500 hover:to-emerald-600 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-all shadow-lg shadow-brand-teal/25 hover:scale-[1.02] active:scale-[0.98]"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving Changes...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Save Global Plans
                </>
              )}
            </button>
          </div>
        </div>

        {/* Live Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="bg-white/5 backdrop-blur-sm p-3.5 rounded-xl border border-white/5">
            <div className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
              <Users size={14} className="text-brand-teal" /> Subscribed Tenants
            </div>
            <div className="text-xl font-bold text-white">
              {totalTenants} <span className="text-xs font-normal text-slate-400">({totalActiveTenants} active)</span>
            </div>
          </div>
          <div className="bg-white/5 backdrop-blur-sm p-3.5 rounded-xl border border-white/5">
            <div className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
              <DollarSign size={14} className="text-emerald-400" /> Projected MRR
            </div>
            <div className="text-xl font-bold text-emerald-400">
              ${totalEstimatedMRR.toLocaleString()} <span className="text-xs font-normal text-slate-400">/mo</span>
            </div>
          </div>
          <div className="bg-white/5 backdrop-blur-sm p-3.5 rounded-xl border border-white/5">
            <div className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
              <Layers size={14} className="text-amber-400" /> Total Seat Quota
            </div>
            <div className="text-xl font-bold text-white">
              {totalAllocatedSeats.toLocaleString()} <span className="text-xs font-normal text-slate-400">seats</span>
            </div>
          </div>
          <div className="bg-white/5 backdrop-blur-sm p-3.5 rounded-xl border border-white/5">
            <div className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
              <Activity size={14} className="text-purple-400" /> Plan Distribution
            </div>
            <div className="text-xs font-medium text-slate-300 flex items-center gap-2 mt-1">
              {plans.map(p => (
                <span key={p.id} className="inline-flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${
                    p.id === 'free' ? 'bg-slate-400' : p.id === 'basic' ? 'bg-blue-400' : 'bg-amber-400'
                  }`} />
                  {p.tenant_count || 0}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center gap-3">
          <AlertCircle size={18} className="flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* 3 Core Plans Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const isFree = plan.id === 'free';
          const isBasic = plan.id === 'basic';
          const isEnterprise = plan.id === 'enterprise';

          const cardTheme = isEnterprise 
            ? 'border-amber-400/80 shadow-amber-500/10 bg-gradient-to-b from-amber-500/[0.03] to-white ring-1 ring-amber-400/30'
            : isBasic 
            ? 'border-blue-400/80 shadow-blue-500/10 bg-gradient-to-b from-blue-500/[0.03] to-white ring-1 ring-blue-400/30'
            : 'border-slate-300 shadow-slate-500/5 bg-white';

          const headerColor = isEnterprise ? 'bg-gradient-to-r from-amber-600 to-amber-700'
            : isBasic ? 'bg-gradient-to-r from-blue-600 to-indigo-600'
            : 'bg-gradient-to-r from-slate-700 to-slate-800';

          const annualSavings = plan.price_monthly > 0 && plan.price_annual > 0 
            ? Math.round(((plan.price_monthly * 12 - plan.price_annual) / (plan.price_monthly * 12)) * 100)
            : 0;

          return (
            <div 
              key={plan.id}
              className={`rounded-2xl border transition-all duration-300 shadow-xl flex flex-col justify-between overflow-hidden relative ${cardTheme}`}
            >
              {/* Card Header Bar */}
              <div className={`${headerColor} text-white p-5`}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-sm border border-white/20">
                    {plan.id.toUpperCase()} TIER
                  </span>
                  <div className="flex items-center gap-2">
                    {plan.is_popular && (
                      <span className="bg-blue-400 text-slate-950 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase shadow-sm">
                        Popular
                      </span>
                    )}
                    {plan.is_recommended && (
                      <span className="bg-amber-300 text-slate-950 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase shadow-sm">
                        Enterprise
                      </span>
                    )}
                    <span className="text-xs bg-black/25 px-2 py-0.5 rounded-full font-medium">
                      {plan.tenant_count || 0} orgs
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-white/70 uppercase">Plan Display Name</label>
                  <input
                    type="text"
                    value={plan.name}
                    onChange={(e) => handleFieldChange(plan.id, 'name', e.target.value)}
                    className="w-full bg-white/10 hover:bg-white/20 focus:bg-white/25 border border-white/25 rounded-lg px-3 py-1.5 text-white font-bold text-lg placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/40 transition-colors"
                  />
                </div>
                
                <div className="mt-2">
                  <label className="text-[10px] font-semibold text-white/70 uppercase">Tagline / Subtitle</label>
                  <input
                    type="text"
                    value={plan.tagline || ''}
                    onChange={(e) => handleFieldChange(plan.id, 'tagline', e.target.value)}
                    placeholder="Short description..."
                    className="w-full bg-white/10 hover:bg-white/20 focus:bg-white/25 border border-white/25 rounded-lg px-3 py-1 text-white text-xs placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/40 transition-colors mt-0.5"
                  />
                </div>
              </div>

              {/* Card Body */}
              <div className="p-6 space-y-6 flex-1 bg-white">
                
                {/* 1. Pricing Controls */}
                <div className="space-y-3 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <DollarSign size={14} className="text-emerald-600" /> Plan Pricing ($ USD)
                    </span>
                    {annualSavings > 0 && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                        {annualSavings}% Annual Discount
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-500 font-medium block mb-1">Monthly Price</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          disabled={isFree}
                          value={isFree ? 0 : plan.price_monthly}
                          onChange={(e) => handleFieldChange(plan.id, 'price_monthly', parseFloat(e.target.value) || 0)}
                          className="w-full pl-7 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-800 focus:ring-2 focus:ring-brand-teal focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 mt-0.5 block">per organization / mo</span>
                    </div>

                    <div>
                      <label className="text-xs text-slate-500 font-medium block mb-1">Annual Price</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          disabled={isFree}
                          value={isFree ? 0 : plan.price_annual}
                          onChange={(e) => handleFieldChange(plan.id, 'price_annual', parseFloat(e.target.value) || 0)}
                          className="w-full pl-7 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-800 focus:ring-2 focus:ring-brand-teal focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 mt-0.5 block">billed annually</span>
                    </div>
                  </div>
                </div>

                {/* 2. Employee Seat Capacity Quota */}
                <div className="space-y-2 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Users size={14} className="text-brand-teal" /> Employee Seat Limit
                    </span>
                    <span className="text-xs font-bold text-brand-teal bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                      {plan.max_employees} Max Seats
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={plan.max_employees}
                      onChange={(e) => handleFieldChange(plan.id, 'max_employees', parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-base font-extrabold text-slate-800 focus:ring-2 focus:ring-brand-teal focus:outline-none"
                    />
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleFieldChange(plan.id, 'max_employees', Math.max(1, (plan.max_employees || 10) - (isEnterprise ? 50 : 10)))}
                        className="px-2.5 py-2 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 active:scale-95 transition-all"
                        title="Decrease seats"
                      >
                        -{isEnterprise ? 50 : 10}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFieldChange(plan.id, 'max_employees', (plan.max_employees || 10) + (isEnterprise ? 50 : 10))}
                        className="px-2.5 py-2 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 active:scale-95 transition-all"
                        title="Increase seats"
                      >
                        +{isEnterprise ? 50 : 10}
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Tenants on this plan will be blocked from registering staff once they reach {plan.max_employees} seats.
                  </p>
                </div>

                {/* 3. Default Module Permissions */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Layers size={14} className="text-purple-600" /> Default Enabled Modules
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {(plan.default_modules || []).length} active
                    </span>
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {ALL_MODULES.map(mod => {
                      const isChecked = (plan.default_modules || []).includes(mod.id);
                      return (
                        <div 
                          key={mod.id}
                          onClick={() => handleModuleToggle(plan.id, mod.id)}
                          className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                            isChecked 
                              ? 'bg-purple-50/70 border-purple-200 text-purple-900 font-medium' 
                              : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <div className="truncate font-semibold">{mod.name}</div>
                            <div className="text-[10px] text-slate-400 truncate">{mod.desc}</div>
                          </div>
                          <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                            isChecked ? 'bg-purple-600 border-purple-600 text-white' : 'border-slate-300 bg-white'
                          }`}>
                            {isChecked && <Check size={12} strokeWidth={3} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Included Feature Bullet List */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles size={14} className="text-amber-500" /> Marketing Features Checklist
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {(plan.features || []).length} items
                    </span>
                  </div>

                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                    {(plan.features || []).map((feat, idx) => (
                      <div 
                        key={idx} 
                        className="flex items-center justify-between gap-2 p-2 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 text-xs text-slate-700 group transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0" />
                          <span className="truncate">{feat}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveFeature(plan.id, idx)}
                          className="text-slate-400 hover:text-rose-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove feature bullet"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add New Feature Item */}
                  {activeFeatureInput.planId === plan.id ? (
                    <div className="flex items-center gap-1.5 pt-1">
                      <input
                        type="text"
                        placeholder="e.g. Turnstile Relay Access..."
                        value={activeFeatureInput.text}
                        onChange={(e) => setActiveFeatureInput({ planId: plan.id, text: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddFeature(plan.id);
                          }
                        }}
                        autoFocus
                        className="flex-1 px-3 py-1.5 text-xs bg-white border border-brand-teal rounded-lg focus:outline-none ring-2 ring-brand-teal/20"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddFeature(plan.id)}
                        className="px-3 py-1.5 bg-brand-teal text-white rounded-lg text-xs font-bold hover:bg-teal-600 transition-colors"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveFeatureInput({ planId: null, text: '' })}
                        className="px-2 py-1.5 bg-slate-200 text-slate-600 rounded-lg text-xs hover:bg-slate-300 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveFeatureInput({ planId: plan.id, text: '' })}
                      className="w-full py-1.5 border border-dashed border-slate-300 hover:border-brand-teal text-slate-500 hover:text-brand-teal rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Plus size={13} /> Add Feature Bullet
                    </button>
                  )}
                </div>

              </div>

              {/* Card Footer Bar */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                <span>Active subscriptions:</span>
                <span className="font-bold text-slate-800">
                  {plan.active_tenant_count || 0} active / {plan.tenant_count || 0} total
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
              <RotateCcw size={24} />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold text-slate-900">Reset Plans to Factory Defaults?</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                This will reset the global pricing and employee seat caps back to standard system values:
                <br /><strong className="text-slate-700">Free Starter</strong>: 10 seats ($0/mo)
                <br /><strong className="text-slate-700">Basic / Growth</strong>: 50 seats ($49/mo)
                <br /><strong className="text-slate-700">Enterprise Scale</strong>: 500 seats ($299/mo)
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetDefaults}
                disabled={resetting}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-colors shadow-lg shadow-rose-600/20"
              >
                {resetting ? 'Resetting...' : 'Yes, Restore Defaults'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
