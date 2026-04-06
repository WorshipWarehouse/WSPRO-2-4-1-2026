/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, Component, useCallback } from 'react';
import {
  Music,
  Lock,
  LogIn,
  LogOut,
  User,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  Users,
  BookOpen,
  Home,
  Library as LibraryIcon,
  Languages,
  Apple,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { LibraryItem, AppUser, ActivePage } from './types';

import { authApi, setToken, getToken, configApi, stripeApi, libraryApi } from './lib/api';

import { DashboardPage } from './components/pages/DashboardPage';
import { SermonPage } from './components/pages/SermonPage';
import { MultilingualPage } from './components/pages/MultilingualPage';
import { StageChordPage } from './components/pages/StageChordPage';
import { ProfilePage } from './components/pages/ProfilePage';
import { LibraryPage } from './components/pages/LibraryPage';
import { AdminSettingsPage } from './components/pages/AdminSettingsPage';

class ErrorBoundary extends (React.Component as any) {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error('ErrorBoundary caught an error', error, errorInfo);
  }
  render() {
    const { hasError, error } = this.state;
    if (hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-neutral-200 max-w-md w-full text-center space-y-6">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
              <ShieldCheck size={32} />
            </div>
            <h1 className="text-2xl font-bold text-neutral-900">Application Error</h1>
            <p className="text-neutral-500">{error?.message || 'Something went wrong.'}</p>
            <button onClick={() => window.location.reload()} className="w-full py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-black transition-all">
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [activePage, setActivePage] = useState<ActivePage>('dashboard');
  const [library, setLibrary] = useState<LibraryItem[]>([]);

  // Auth
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);

  // Library load-from data
  const [multilingualInitial, setMultilingualInitial] = useState<any>(undefined);
  const [stageChordInitial, setStageChordInitial] = useState<any>(undefined);

  // Config
  const [stripeConfig, setStripeConfig] = useState<{
    stripePriceIdSingle: string;
    stripePriceIdOrg: string;
    stripePublicKey: string;
    stripeConfigured: boolean;
    googleClientId?: string;
    appleClientId?: string;
  } | null>(null);

  // Fetch config
  useEffect(() => {
    configApi.get().then(setStripeConfig).catch(() => {});
  }, []);

  // Fetch library
  const fetchLibrary = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const { items } = await libraryApi.list();
      setLibrary(items as LibraryItem[]);
    } catch {}
  }, [isAuthenticated]);

  useEffect(() => { fetchLibrary(); }, [fetchLibrary]);

  // Restore session on mount
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setIsAuthLoading(false);
      return;
    }
    authApi.me()
      .then(({ user: u }) => {
        setUser(u as AppUser);
        setIsAuthenticated(true);
      })
      .catch(() => {
        setToken(null);
      })
      .finally(() => setIsAuthLoading(false));
  }, []);

  const isSubscribed = useMemo(() => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (user.subscriptionStatus === 'active') return true;
    if (user.subscriptionStatus === 'trialing') return new Date(user.trialEndDate || 0) > new Date();
    return false;
  }, [user]);

  useEffect(() => {
    if (isAuthenticated && !isSubscribed && activePage !== 'profile') {
      setActivePage('profile');
    }
  }, [isAuthenticated, isSubscribed, activePage]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (isSignup) {
        if (loginPassword !== confirmPassword) { setAuthError('Passwords do not match.'); return; }
        if (!firstName || !lastName) { setAuthError('First and last name are required.'); return; }
        if (loginPassword.length < 6) { setAuthError('Password must be at least 6 characters.'); return; }
        const { token, user: u } = await authApi.signup({ email: loginEmail, password: loginPassword, firstName, lastName });
        setToken(token);
        setUser(u as AppUser);
        setIsAuthenticated(true);
        fetchLibrary();
      } else {
        const { token, user: u } = await authApi.login({ email: loginEmail, password: loginPassword });
        setToken(token);
        setUser(u as AppUser);
        setIsAuthenticated(true);
        fetchLibrary();
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed');
    }
  };

  const handleGoogleLogin = async () => {
    setAuthError('');
    if (!stripeConfig?.googleClientId) {
      setAuthError('Google Sign-In is not configured. Set GOOGLE_CLIENT_ID in environment.');
      return;
    }
    try {
      // Use Google Identity Services (GIS) one-tap / popup
      const google = (window as any).google;
      if (!google?.accounts?.id) {
        setAuthError('Google Sign-In library not loaded. Check your internet connection.');
        return;
      }
      google.accounts.id.initialize({
        client_id: stripeConfig.googleClientId,
        callback: async (response: any) => {
          try {
            const { token, user: u } = await authApi.google(response.credential);
            setToken(token);
            setUser(u as AppUser);
            setIsAuthenticated(true);
            fetchLibrary();
          } catch (err: any) {
            setAuthError(err.message || 'Google login failed');
          }
        },
      });
      google.accounts.id.prompt();
    } catch (err: any) {
      setAuthError(err.message || 'Google authentication failed');
    }
  };

  const handleAppleLogin = async () => {
    setAuthError('');
    if (!stripeConfig?.appleClientId) {
      setAuthError('Apple Sign-In is not configured. Set APPLE_CLIENT_ID in environment.');
      return;
    }
    try {
      const AppleID = (window as any).AppleID;
      if (!AppleID?.auth) {
        setAuthError('Apple Sign-In library not loaded.');
        return;
      }
      AppleID.auth.init({
        clientId: stripeConfig.appleClientId,
        scope: 'name email',
        redirectURI: window.location.origin,
        usePopup: true,
      });
      const response = await AppleID.auth.signIn();
      const { token, user: u } = await authApi.apple(
        response.authorization.id_token,
        response.user?.name?.firstName,
        response.user?.name?.lastName
      );
      setToken(token);
      setUser(u as AppUser);
      setIsAuthenticated(true);
      fetchLibrary();
    } catch (err: any) {
      if (err.message !== 'popup_closed_by_user') {
        setAuthError(err.message || 'Apple authentication failed');
      }
    }
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {}
    setToken(null);
    setIsAuthenticated(false);
    setUser(null);
    setLibrary([]);
  };

  const handleSubscribe = async (priceId: string) => {
    if (!user) { setShowAuth(true); return; }
    if (!stripeConfig?.stripeConfigured) { setAuthError('Stripe is not configured.'); return; }
    if (!priceId) { setAuthError('Invalid price ID.'); return; }
    try {
      setAuthError('');
      const { url } = await stripeApi.createCheckout(priceId);
      if (url) window.open(url, '_blank');
      else throw new Error('No checkout URL returned');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Checkout failed.');
    }
  };

  const onLoadFromLibrary = (item: LibraryItem) => {
    if (item.type === 'song') {
      const songMode = (item as any).mode || 'multilingual';
      const data = {
        title: item.title, key: item.key || '', ccliInfo: item.ccliInfo || '',
        primaryText: item.primaryText, secondaryText: item.secondaryText, linesPerLanguage: item.linesPerLanguage,
      };
      if (songMode === 'stage-chord') { setStageChordInitial({ ...data }); setActivePage('stage-chord'); }
      else { setMultilingualInitial({ ...data }); setActivePage('multilingual'); }
    } else {
      setActivePage('sermon');
    }
  };

  const onRemoveFromLibrary = async (id: string) => {
    if (!confirm('Remove this item from your library?')) return;
    try {
      await libraryApi.remove(id);
      setLibrary(prev => prev.filter(i => i.id !== id));
    } catch {}
  };

  const navItems: { page: ActivePage; icon: React.ElementType; label: string }[] = [
    { page: 'dashboard', icon: Home, label: 'Home' },
    { page: 'sermon', icon: BookOpen, label: 'Sermon' },
    { page: 'multilingual', icon: Languages, label: 'Multilingual' },
    { page: 'stage-chord', icon: Music, label: 'Stage' },
    { page: 'library', icon: LibraryIcon, label: 'Library' },
    { page: 'profile', icon: User, label: 'Profile' },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans">
      {/* Header */}
      <header className="border-b border-neutral-200 bg-white px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-neutral-900 rounded-lg flex items-center justify-center text-white">
            <Music size={18} />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight leading-none">WorshipSlides Pro</h1>
            <p className="text-[10px] text-neutral-400 font-semibold uppercase tracking-widest">Lyric Integration Engine</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isAuthenticated && (
            <>
              {isSubscribed && (
                <nav className="hidden md:flex items-center gap-0.5 bg-neutral-100 p-0.5 rounded-lg">
                  {navItems.map(({ page, icon: Icon, label }) => (
                    <button key={page} onClick={() => setActivePage(page)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${activePage === page ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-900'}`}>
                      <Icon size={13} /> {label}
                    </button>
                  ))}
                </nav>
              )}
              <div className="flex items-center gap-2 pl-3 border-l border-neutral-200">
                <div className="flex items-center gap-2 px-3 py-1 bg-neutral-100 rounded-full">
                  <div className="w-5 h-5 bg-neutral-900 rounded-full flex items-center justify-center text-white"><User size={11} /></div>
                  <span className="text-xs font-medium max-w-[120px] truncate hidden sm:block">{user?.email}</span>
                </div>
                <button onClick={handleLogout} className="p-1.5 text-neutral-400 hover:text-red-600 transition-colors" title="Logout"><LogOut size={16} /></button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Mobile nav */}
      {isAuthenticated && isSubscribed && (
        <div className="md:hidden border-b border-neutral-200 bg-white px-4 py-2 flex gap-1 overflow-x-auto">
          {navItems.map(({ page, icon: Icon, label }) => (
            <button key={page} onClick={() => setActivePage(page)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${activePage === page ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:bg-neutral-100'}`}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
      )}

      <main className="max-w-7xl mx-auto p-6 md:p-8">
        {isAuthLoading ? (
          <div className="flex items-center justify-center h-[60vh]">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-neutral-900" />
          </div>
        ) : !isAuthenticated ? (
          !showAuth ? (
            /* Landing Page */
            <div className="space-y-16 py-8">
              <section className="text-center space-y-6 max-w-3xl mx-auto">
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-20 h-20 bg-neutral-900 rounded-2xl flex items-center justify-center text-white mx-auto shadow-xl">
                  <Music size={40} />
                </motion.div>
                <h1 className="text-5xl font-light tracking-tight leading-tight">
                  Streamline Your <span className="font-bold">Worship Production</span>
                </h1>
                <p className="text-lg text-neutral-500 leading-relaxed max-w-2xl mx-auto">
                  Turn raw content into presentation-ready slides. Support for ChordPro, bilingual lyrics, sermon manuscripts, and direct export to ProPresenter and PowerPoint.
                </p>
                <div className="flex items-center justify-center gap-4 pt-2">
                  <button onClick={() => setShowAuth(true)} className="px-8 py-4 bg-neutral-900 text-white rounded-xl font-bold text-base hover:bg-black transition-all shadow-lg hover:scale-105 active:scale-95">
                    Get Started Free
                  </button>
                </div>
              </section>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                {[
                  { icon: BookOpen, color: 'bg-violet-50 text-violet-600', title: 'Sermon Engine', desc: 'Transform manuscripts into structured slide decks.' },
                  { icon: Languages, color: 'bg-blue-50 text-blue-600', title: 'Multilingual', desc: 'Bilingual slides with automatic alignment.' },
                  { icon: Music, color: 'bg-emerald-50 text-emerald-600', title: 'Stage Chords', desc: 'Clean lyrics for audience, chords for musicians.' },
                ].map((f, i) => (
                  <div key={i} className="bg-white p-8 rounded-2xl border border-neutral-200 space-y-4">
                    <div className={`w-11 h-11 ${f.color} rounded-xl flex items-center justify-center`}><f.icon size={20} /></div>
                    <h3 className="text-lg font-bold">{f.title}</h3>
                    <p className="text-neutral-500 text-sm leading-relaxed">{f.desc}</p>
                  </div>
                ))}
              </div>

              <section className="bg-neutral-900 text-white p-12 rounded-3xl text-center space-y-6 max-w-4xl mx-auto">
                <h2 className="text-3xl font-light">Ready to transform your <span className="font-bold">Sunday prep?</span></h2>
                <p className="text-neutral-400 max-w-xl mx-auto">Join churches worldwide using WorshipSlides Pro.</p>
                <button onClick={() => setShowAuth(true)} className="px-10 py-4 bg-white text-neutral-900 rounded-xl font-bold text-lg hover:bg-neutral-100 transition-all">
                  Start Your Free Trial
                </button>
              </section>
            </div>
          ) : (
            /* Auth Form */
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md mx-auto mt-16">
              <div className="bg-white p-8 rounded-2xl border border-neutral-200 shadow-lg space-y-6">
                <div className="text-center space-y-2">
                  <button onClick={() => setShowAuth(false)} className="text-xs text-neutral-400 hover:text-neutral-900 mb-3 flex items-center gap-1 mx-auto">
                    <ChevronRight size={12} className="rotate-180" /> Back
                  </button>
                  <div className="w-14 h-14 bg-neutral-900 rounded-xl flex items-center justify-center text-white mx-auto mb-4"><Lock size={28} /></div>
                  <h2 className="text-xl font-bold">{isSignup ? 'Create Account' : 'Welcome Back'}</h2>
                  <p className="text-neutral-400 text-sm">{isSignup ? 'Join WorshipSlides Pro.' : 'Sign in to continue.'}</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-3">
                  {isSignup && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1">First Name</label>
                        <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900/5" required />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1">Last Name</label>
                        <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900/5" required />
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1">Email</label>
                    <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900/5" required />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1">Password</label>
                    <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900/5" required />
                  </div>
                  {isSignup && (
                    <div>
                      <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1">Confirm Password</label>
                      <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900/5" required />
                    </div>
                  )}
                  {authError && <p className="text-xs text-red-600 font-medium text-center">{authError}</p>}
                  <button type="submit" className="w-full py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-black transition-all flex items-center justify-center gap-2">
                    <LogIn size={16} /> {isSignup ? 'Sign Up' : 'Sign In'}
                  </button>

                  <div className="relative py-3">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-neutral-100" /></div>
                    <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-bold"><span className="bg-white px-3 text-neutral-400">or continue with</span></div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={handleGoogleLogin} className="py-3 bg-white border border-neutral-200 text-neutral-900 rounded-xl font-bold hover:bg-neutral-50 transition-all flex items-center justify-center gap-2 shadow-sm text-sm">
                      <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-4 h-4" alt="Google" referrerPolicy="no-referrer" />
                      Google
                    </button>
                    <button type="button" onClick={handleAppleLogin} className="py-3 bg-black text-white rounded-xl font-bold hover:bg-neutral-800 transition-all flex items-center justify-center gap-2 shadow-sm text-sm">
                      <Apple size={16} />
                      Apple
                    </button>
                  </div>
                </form>

                <div className="pt-3 border-t border-neutral-100 text-center">
                  <button onClick={() => { setIsSignup(!isSignup); setAuthError(''); }} className="text-xs text-neutral-400 hover:text-neutral-900 font-medium">
                    {isSignup ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                  </button>
                </div>
              </div>
            </motion.div>
          )
        ) : !isSubscribed && activePage !== 'profile' ? (
          /* Subscription Required */
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="max-w-xl mx-auto mt-8 space-y-6">
            <div className="bg-white p-10 rounded-2xl border border-neutral-200 shadow-lg text-center space-y-6">
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto"><ShieldCheck size={36} /></div>
              <h2 className="text-2xl font-bold">Subscription Required</h2>
              <p className="text-neutral-500">Your trial has expired or you do not have an active subscription.</p>
              {!stripeConfig?.stripeConfigured && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-left">
                  <div className="flex items-center gap-2 text-red-600 font-bold text-sm"><AlertTriangle size={16} /> Stripe Not Configured</div>
                  <p className="text-xs text-red-500 mt-1">Add STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY to environment.</p>
                </div>
              )}
              {authError && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600 text-sm"><AlertTriangle size={14} /> {authError}</div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-5 bg-neutral-50 rounded-xl border border-neutral-200 text-left space-y-3">
                  <h3 className="font-bold flex items-center gap-2"><User size={16} /> Individual</h3>
                  <p className="text-xs text-neutral-500">Single user access.</p>
                  <button onClick={() => handleSubscribe(stripeConfig?.stripePriceIdSingle || '')} className="w-full py-2 bg-neutral-900 text-white text-center rounded-lg font-bold text-sm hover:bg-black transition-all">Subscribe</button>
                </div>
                <div className="p-5 bg-neutral-50 rounded-xl border border-neutral-200 text-left space-y-3">
                  <h3 className="font-bold flex items-center gap-2"><Users size={16} /> Organization</h3>
                  <p className="text-xs text-neutral-500">Up to 5 team members.</p>
                  <button onClick={() => handleSubscribe(stripeConfig?.stripePriceIdOrg || '')} className="w-full py-2 border border-neutral-900 text-neutral-900 text-center rounded-lg font-bold text-sm hover:bg-neutral-100 transition-all">Subscribe</button>
                </div>
              </div>
              <button onClick={handleLogout} className="text-sm text-neutral-400 hover:text-red-600 font-medium flex items-center gap-2 mx-auto pt-2"><LogOut size={14} /> Sign out</button>
            </div>
          </motion.div>
        ) : (
          /* Main App */
          <AnimatePresence mode="wait">
            {activePage === 'dashboard' && <DashboardPage setActivePage={setActivePage} library={library} onLoadFromLibrary={onLoadFromLibrary} />}
            {activePage === 'sermon' && <SermonPage user={user} setActivePage={setActivePage} />}
            {activePage === 'multilingual' && <MultilingualPage user={user} setActivePage={setActivePage} initialData={multilingualInitial} />}
            {activePage === 'stage-chord' && <StageChordPage user={user} setActivePage={setActivePage} initialData={stageChordInitial} />}
            {activePage === 'library' && <LibraryPage library={library} onLoadFromLibrary={onLoadFromLibrary} onRemoveFromLibrary={onRemoveFromLibrary} setActivePage={setActivePage} />}
            {activePage === 'profile' && <ProfilePage user={user} setUser={setUser} isSubscribed={isSubscribed} stripeConfig={stripeConfig} onSubscribe={handleSubscribe} authError={authError} setActivePage={setActivePage} />}
            {activePage === 'admin-settings' && <AdminSettingsPage setActivePage={setActivePage} />}
          </AnimatePresence>
        )}
      </main>

      <footer className="max-w-7xl mx-auto px-6 py-8 border-t border-neutral-200 flex flex-col md:flex-row items-center justify-between gap-4 text-neutral-400 text-xs font-medium uppercase tracking-widest">
        <p>&copy; 2026 WorshipSlides Pro</p>
        <div className="flex items-center gap-6">
          <a href="#" className="hover:text-neutral-900 transition-colors">Documentation</a>
          <a href="#" className="hover:text-neutral-900 transition-colors">Support</a>
        </div>
      </footer>
    </div>
  );
}

export default function AppWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
