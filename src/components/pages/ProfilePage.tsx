import React, { useState } from 'react';
import { User, Building2, ShieldCheck, ChevronRight, AlertTriangle, Plus, Trash2, ArrowLeft, Mail, Save } from 'lucide-react';
import { motion } from 'motion/react';
import { userApi } from '../../lib/api';
import type { AppUser, ActivePage } from '../../types';

interface ProfilePageProps {
  user: AppUser | null;
  setUser: (user: AppUser) => void;
  isSubscribed: boolean;
  stripeConfig: {
    stripePriceIdSingle: string;
    stripePriceIdOrg: string;
    stripePublicKey: string;
    stripeConfigured: boolean;
  } | null;
  onSubscribe: (priceId: string) => void;
  authError: string;
  setActivePage: (page: ActivePage) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  user, setUser, isSubscribed, stripeConfig, onSubscribe, authError, setActivePage,
}) => {
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [email] = useState(user?.email || '');
  const [orgEmailInput, setOrgEmailInput] = useState('');
  const [isUpdatingOrg, setIsUpdatingOrg] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const saveProfile = async () => {
    if (!user) return;
    setIsSavingProfile(true);
    try {
      const { user: updated } = await userApi.updateProfile({ firstName, lastName });
      setUser(updated as AppUser);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    } catch {
      alert('Failed to update profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const addOrgEmail = async () => {
    if (!user || !orgEmailInput || (user.organizationEmails?.length || 0) >= 5) return;
    setIsUpdatingOrg(true);
    try {
      const { organizationEmails } = await userApi.addOrgMember(orgEmailInput);
      setUser({ ...user, organizationEmails });
      setOrgEmailInput('');
    } catch (err: any) {
      alert(err.message || 'Failed to add member.');
    } finally {
      setIsUpdatingOrg(false);
    }
  };

  const removeOrgEmail = async (emailToRemove: string) => {
    if (!user) return;
    setIsUpdatingOrg(true);
    try {
      const { organizationEmails } = await userApi.removeOrgMember(emailToRemove);
      setUser({ ...user, organizationEmails });
    } catch {
      alert('Failed to remove member.');
    } finally {
      setIsUpdatingOrg(false);
    }
  };

  return (
    <motion.div key="profile" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <button onClick={() => setActivePage('dashboard')} className="p-2 rounded-lg hover:bg-neutral-100 transition-colors">
          <ArrowLeft size={20} className="text-neutral-500" />
        </button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-neutral-900">Profile &amp; Subscription</h2>
          <p className="text-neutral-500 text-sm">Manage your account details, plan, and team.</p>
        </div>
      </div>

      {authError && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 text-sm font-medium">
          <AlertTriangle size={16} /> <span>{authError}</span>
        </div>
      )}

      {/* Profile Section */}
      <div className="bg-white p-6 rounded-2xl border border-neutral-200 space-y-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-2"><User size={14} /> Account Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1 uppercase">First Name</label>
            <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900/5" />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1 uppercase">Last Name</label>
            <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900/5" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-500 mb-1 uppercase flex items-center gap-1.5"><Mail size={11} /> Email</label>
          <input type="email" value={email} disabled className="w-full px-4 py-2.5 bg-neutral-100 border border-neutral-200 rounded-xl text-neutral-500 cursor-not-allowed" />
          <p className="text-[10px] text-neutral-400 mt-1">Email is managed by your authentication provider.</p>
        </div>
        <button onClick={saveProfile} disabled={isSavingProfile} className="flex items-center gap-2 px-5 py-2.5 bg-neutral-900 text-white rounded-xl font-semibold text-sm hover:bg-black transition-all disabled:opacity-50">
          <Save size={14} /> {profileSaved ? 'Saved!' : isSavingProfile ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Subscription Section */}
      <div className="bg-white p-6 rounded-2xl border border-neutral-200 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">Subscription</h3>
          <div className={`px-3 py-1 rounded-full text-xs font-bold ${user?.subscriptionStatus === 'active' || user?.subscriptionStatus === 'trialing' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
            {user?.subscriptionStatus === 'active' ? 'Active' : user?.subscriptionStatus === 'trialing' ? 'Trial' : 'Inactive'}
          </div>
        </div>

        {!stripeConfig?.stripeConfigured && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-xl space-y-1">
            <div className="flex items-center gap-2 text-red-600 font-bold text-sm"><AlertTriangle size={16} /> Stripe Not Configured</div>
            <p className="text-xs text-red-500">Add STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY to environment variables.</p>
          </div>
        )}

        {!isSubscribed && (
          <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl space-y-1">
            <div className="flex items-center gap-2 text-blue-600 font-bold text-sm"><ShieldCheck size={16} /> 7-Day Free Trial</div>
            <p className="text-xs text-blue-500">Subscribe to start your free trial. Cancel anytime.</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 bg-neutral-50 rounded-xl border border-neutral-200 space-y-3">
            <div className="flex items-center justify-between"><span className="font-bold">Individual</span><User size={18} className="text-neutral-400" /></div>
            <p className="text-sm text-neutral-500">Single user access to all features.</p>
            <button onClick={() => onSubscribe(stripeConfig?.stripePriceIdSingle || '')} className="flex items-center justify-center gap-2 w-full py-2.5 bg-neutral-900 text-white rounded-lg font-semibold text-sm hover:bg-black transition-all">
              {user?.plan === 'single' && isSubscribed ? 'Manage' : 'Subscribe'} <ChevronRight size={14} />
            </button>
          </div>
          <div className="p-5 bg-neutral-50 rounded-xl border border-neutral-200 space-y-3">
            <div className="flex items-center justify-between"><span className="font-bold">Organization</span><Building2 size={18} className="text-neutral-400" /></div>
            <p className="text-sm text-neutral-500">Add up to 5 team members to your account.</p>
            <button onClick={() => onSubscribe(stripeConfig?.stripePriceIdOrg || '')} className="flex items-center justify-center gap-2 w-full py-2.5 bg-white border border-neutral-900 text-neutral-900 rounded-lg font-semibold text-sm hover:bg-neutral-100 transition-all">
              {user?.plan === 'organization' && isSubscribed ? 'Manage' : 'Subscribe'} <ChevronRight size={14} />
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Plan Features</h4>
          <div className="grid grid-cols-2 gap-2">
            {['Unlimited Exports', 'ProPresenter 7 Support', 'PowerPoint Support', 'Cloud Library', 'ChordPro Upload', user?.plan === 'organization' ? 'Up to 5 Team Members' : 'Individual Access'].map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-neutral-600">
                <div className="w-4 h-4 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center"><ShieldCheck size={10} /></div>{f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Organization Management */}
      {user?.plan === 'organization' && (
        <div className="bg-white p-6 rounded-2xl border border-neutral-200 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-2"><Building2 size={14} /> Team Members</h3>
            <span className="text-xs font-bold bg-neutral-100 px-3 py-1 rounded-full text-neutral-500">{user.organizationEmails?.length || 0} / 5</span>
          </div>
          <div className="flex gap-2">
            <input type="email" placeholder="team@example.com" value={orgEmailInput} onChange={e => setOrgEmailInput(e.target.value)} className="flex-1 px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900/5" />
            <button onClick={addOrgEmail} disabled={isUpdatingOrg || !orgEmailInput || (user.organizationEmails?.length || 0) >= 5} className="px-5 py-2.5 bg-neutral-900 text-white rounded-xl font-semibold text-sm hover:bg-black transition-all disabled:opacity-50 flex items-center gap-2">
              <Plus size={14} /> Add
            </button>
          </div>
          <div className="space-y-2">
            {user.organizationEmails?.map((em, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-neutral-50 border border-neutral-200 rounded-xl">
                <span className="text-sm font-medium">{em}</span>
                <button onClick={() => removeOrgEmail(em)} className="p-1.5 text-neutral-400 hover:text-red-600 transition-colors"><Trash2 size={14} /></button>
              </div>
            ))}
            {(!user.organizationEmails || user.organizationEmails.length === 0) && (
              <p className="text-sm text-neutral-400 italic text-center py-4">No team members added yet.</p>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
};
