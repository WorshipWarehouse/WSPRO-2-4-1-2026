import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, Shield, Key, CreditCard, Globe, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import { adminApi } from '../../lib/api';
import type { ActivePage } from '../../types';

interface AdminSettingsPageProps {
  setActivePage: (page: ActivePage) => void;
}

const FIELD_GROUPS = [
  {
    title: 'Authentication',
    icon: Key,
    color: 'bg-amber-50 text-amber-600',
    fields: [
      { key: 'JWT_SECRET', label: 'JWT Secret', placeholder: 'A random, high-entropy string', sensitive: true },
    ],
  },
  {
    title: 'Stripe Payments',
    icon: CreditCard,
    color: 'bg-violet-50 text-violet-600',
    fields: [
      { key: 'STRIPE_SECRET_KEY', label: 'Secret Key', placeholder: 'sk_test_... or sk_live_...', sensitive: true },
      { key: 'STRIPE_PUBLISHABLE_KEY', label: 'Publishable Key', placeholder: 'pk_test_... or pk_live_...' },
      { key: 'STRIPE_WEBHOOK_SECRET', label: 'Webhook Secret', placeholder: 'whsec_...', sensitive: true },
      { key: 'STRIPE_PRICE_ID_SINGLE', label: 'Individual Plan Price ID', placeholder: 'price_...' },
      { key: 'STRIPE_PRICE_ID_ORG', label: 'Organization Plan Price ID', placeholder: 'price_...' },
    ],
  },
  {
    title: 'OAuth Providers',
    icon: Globe,
    color: 'bg-blue-50 text-blue-600',
    fields: [
      { key: 'GOOGLE_CLIENT_ID', label: 'Google Client ID', placeholder: '123456789.apps.googleusercontent.com' },
      { key: 'APPLE_CLIENT_ID', label: 'Apple Service ID', placeholder: 'com.yourapp.service' },
    ],
  },
  {
    title: 'Application',
    icon: Globe,
    color: 'bg-emerald-50 text-emerald-600',
    fields: [
      { key: 'APP_URL', label: 'App URL', placeholder: 'https://yourapp.com' },
    ],
  },
];

export const AdminSettingsPage: React.FC<AdminSettingsPageProps> = ({ setActivePage }) => {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [showSensitive, setShowSensitive] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { raw } = await adminApi.getSettings();
      setSettings(raw);
      setEditValues(raw);
    } catch (err: any) {
      setError(err.message || 'Failed to load settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const changed: Record<string, string> = {};
      for (const [k, v] of Object.entries(editValues)) {
        if (v !== settings[k]) changed[k] = v as string;
      }
      if (Object.keys(changed).length === 0) { setSaved(true); setTimeout(() => setSaved(false), 2000); setSaving(false); return; }
      await adminApi.updateSettings(changed);
      setSettings({ ...settings, ...changed });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const toggleShow = (key: string) => setShowSensitive(prev => ({ ...prev, [key]: !prev[key] }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-neutral-900" />
      </div>
    );
  }

  return (
    <motion.div key="admin" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <button onClick={() => setActivePage('profile')} className="p-2 rounded-lg hover:bg-neutral-100 transition-colors">
          <ArrowLeft size={20} className="text-neutral-500" />
        </button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold tracking-tight text-neutral-900 flex items-center gap-2">
            <Shield size={22} /> Admin Settings
          </h2>
          <p className="text-neutral-500 text-sm">Configure API keys, secrets, and service integrations.</p>
        </div>
        <button onClick={loadSettings} className="p-2 rounded-lg hover:bg-neutral-100 transition-colors" title="Reload">
          <RefreshCw size={18} className="text-neutral-500" />
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm font-medium">{error}</div>
      )}

      {FIELD_GROUPS.map((group) => (
        <div key={group.title} className="bg-white p-6 rounded-2xl border border-neutral-200 space-y-5">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 ${group.color} rounded-lg flex items-center justify-center`}>
              <group.icon size={18} />
            </div>
            <h3 className="font-bold text-neutral-900">{group.title}</h3>
          </div>

          <div className="space-y-4">
            {group.fields.map((field) => (
              <div key={field.key}>
                <label className="block text-xs font-medium text-neutral-500 mb-1.5 uppercase tracking-wider">{field.label}</label>
                <div className="relative">
                  <input
                    type={field.sensitive && !showSensitive[field.key] ? 'password' : 'text'}
                    value={editValues[field.key] || ''}
                    onChange={e => setEditValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900/5 font-mono text-sm pr-10"
                  />
                  {field.sensitive && (
                    <button
                      type="button"
                      onClick={() => toggleShow(field.key)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                    >
                      {showSensitive[field.key] ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  )}
                </div>
                {editValues[field.key] !== settings[field.key] && (
                  <p className="text-[10px] text-amber-600 mt-1 font-semibold">Modified (unsaved)</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="flex items-center justify-between">
        <p className="text-xs text-neutral-400">Settings are stored in <code className="bg-neutral-100 px-1.5 py-0.5 rounded">data/settings.json</code></p>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-neutral-900 text-white rounded-xl font-semibold text-sm hover:bg-black transition-all disabled:opacity-50"
        >
          <Save size={16} /> {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </motion.div>
  );
};
