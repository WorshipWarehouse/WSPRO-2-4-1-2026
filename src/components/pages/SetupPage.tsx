import React, { useState } from 'react';
import { Shield, Key, CreditCard, Globe, Eye, EyeOff, ChevronRight, ChevronLeft, Music } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { setupApi, setToken } from '../../lib/api';
import type { AppUser } from '../../types';

interface SetupPageProps {
  onComplete: (token: string, user: AppUser) => void;
}

export const SetupPage: React.FC<SetupPageProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const [ownerEmail, setOwnerEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showFields, setShowFields] = useState<Record<string, boolean>>({});

  const settingFields = [
    { section: 'Stripe Payments', icon: CreditCard, color: 'bg-violet-50 text-violet-600', fields: [
      { key: 'STRIPE_SECRET_KEY', label: 'Secret Key', placeholder: 'sk_test_...', sensitive: true },
      { key: 'STRIPE_PUBLISHABLE_KEY', label: 'Publishable Key', placeholder: 'pk_test_...' },
      { key: 'STRIPE_WEBHOOK_SECRET', label: 'Webhook Secret', placeholder: 'whsec_...', sensitive: true },
      { key: 'STRIPE_PRICE_ID_SINGLE', label: 'Individual Price ID', placeholder: 'price_...' },
      { key: 'STRIPE_PRICE_ID_ORG', label: 'Organization Price ID', placeholder: 'price_...' },
    ]},
    { section: 'OAuth (optional)', icon: Globe, color: 'bg-blue-50 text-blue-600', fields: [
      { key: 'GOOGLE_CLIENT_ID', label: 'Google Client ID', placeholder: '123....apps.googleusercontent.com' },
      { key: 'APPLE_CLIENT_ID', label: 'Apple Service ID', placeholder: 'com.yourapp.service' },
    ]},
  ];

  const handleFinish = async () => {
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (!ownerEmail) { setError('Owner email is required.'); return; }

    setSaving(true);
    setError('');
    try {
      const { token, user } = await setupApi.run({
        ownerEmail, password, firstName: firstName || 'Owner', lastName: lastName || '',
        settings,
      });
      setToken(token);
      onComplete(token, user as AppUser);
    } catch (err: any) {
      setError(err.message || 'Setup failed.');
    } finally {
      setSaving(false);
    }
  };

  const toggle = (key: string) => setShowFields(p => ({ ...p, [key]: !p[key] }));

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg">
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-neutral-900 text-white p-6 text-center">
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Music size={24} />
            </div>
            <h1 className="text-xl font-bold">WorshipSlides Pro Setup</h1>
            <p className="text-neutral-400 text-sm mt-1">
              {step === 0 ? 'Create your owner account' : 'Configure your API keys'}
            </p>
            <div className="flex gap-2 justify-center mt-4">
              {[0, 1].map(i => (
                <div key={i} className={`h-1 w-12 rounded-full transition-all ${step >= i ? 'bg-white' : 'bg-white/20'}`} />
              ))}
            </div>
          </div>

          <div className="p-6 space-y-5">
            {error && <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm font-medium">{error}</div>}

            <AnimatePresence mode="wait">
              {step === 0 && (
                <motion.div key="step0" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
                  <p className="text-sm text-neutral-500">This account will be the <strong>owner</strong> — only you will be able to manage API keys and secrets.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">First Name</label>
                      <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900/5" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Last Name</label>
                      <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900/5" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Owner Email</label>
                    <input type="email" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} placeholder="you@yourdomain.com" className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900/5" required />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Password</label>
                    <div className="relative">
                      <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900/5 pr-10" required />
                      <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400"><Eye size={16} /></button>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Confirm Password</label>
                    <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter password" className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900/5" required />
                  </div>
                  <button onClick={() => { if (!ownerEmail) { setError('Email required.'); return; } if (!password || password.length < 6) { setError('Password must be at least 6 characters.'); return; } if (password !== confirmPassword) { setError('Passwords do not match.'); return; } setError(''); setStep(1); }} className="w-full py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-black transition-all flex items-center justify-center gap-2">
                    Next: API Keys <ChevronRight size={16} />
                  </button>
                </motion.div>
              )}

              {step === 1 && (
                <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                  <p className="text-sm text-neutral-500">Add your API keys now, or skip and add them later from Owner Settings.</p>

                  {settingFields.map(group => (
                    <div key={group.section} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 ${group.color} rounded-lg flex items-center justify-center`}><group.icon size={14} /></div>
                        <span className="text-sm font-bold text-neutral-700">{group.section}</span>
                      </div>
                      {group.fields.map(f => (
                        <div key={f.key}>
                          <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">{f.label}</label>
                          <div className="relative">
                            <input
                              type={f.sensitive && !showFields[f.key] ? 'password' : 'text'}
                              value={settings[f.key] || ''}
                              onChange={e => setSettings(p => ({ ...p, [f.key]: e.target.value }))}
                              placeholder={f.placeholder}
                              className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900/5 font-mono text-xs pr-9"
                            />
                            {f.sensitive && (
                              <button type="button" onClick={() => toggle(f.key)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400">
                                {showFields[f.key] ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}

                  <div className="flex gap-3">
                    <button onClick={() => setStep(0)} className="flex-1 py-3 bg-neutral-100 text-neutral-700 rounded-xl font-bold hover:bg-neutral-200 transition-all flex items-center justify-center gap-2">
                      <ChevronLeft size={16} /> Back
                    </button>
                    <button onClick={handleFinish} disabled={saving} className="flex-1 py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-black transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                      <Shield size={16} /> {saving ? 'Setting up...' : 'Finish Setup'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
