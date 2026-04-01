/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, Component } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { saveAs } from 'file-saver';
import { 
  Music, 
  Languages, 
  Layout, 
  Download, 
  FileText, 
  Presentation, 
  Trash2, 
  ChevronRight, 
  ChevronDown,
  Settings,
  Info,
  Monitor,
  Save,
  Cloud,
  User,
  LogIn,
  LogOut,
  Lock,
  Library,
  Plus,
  BookOpen,
  Type,
  CreditCard,
  ShieldCheck,
  Users,
  ExternalLink,
  AlertTriangle,
  Building2,
  Edit3,
  Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Slide, SongData, LibrarySong, LibrarySermon, LibraryItem, Mode, SermonSlide, AppUser } from './types';
import pptxgen from 'pptxgenjs';

import { 
  writePresentation, 
  writeApplicationInfo, 
  writeUUID, 
  generateUUID, 
  writeGroup, 
  writeCueGroup, 
  writeCue, 
  writePresentationSlide,
  parseTextToSlides 
} from './lib/pro7-writer';

import { auth, db } from './firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  onSnapshot,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  getDocFromServer
} from 'firebase/firestore';

import { ChordEditorMain } from './components/ChordEditor/ChordEditorMain';
import { RestructureTool } from './components/ChordEditor/RestructureTool';

// Component to render formatted text in preview
const FormattedText: React.FC<{ text: string; className?: string }> = ({ text, className }) => {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
  
  return (
    <div className={className}>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
          return <em key={i}>{part.slice(1, -1)}</em>;
        }
        return <span key={i}>{part}</span>;
      })}
    </div>
  );
};

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email || undefined,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

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
      let message = "Something went wrong.";
      try {
        const parsed = JSON.parse(error.message);
        if (parsed.error && parsed.operationType) {
          message = `Firestore ${parsed.operationType} error: ${parsed.error}`;
        }
      } catch (e) {
        message = error.message || message;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F9F9F9] p-4">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-[#F0F0F0] max-w-md w-full text-center">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShieldCheck size={32} />
            </div>
            <h1 className="text-2xl font-bold text-[#1A1A1A] mb-4">Application Error</h1>
            <p className="text-[#8E8E8E] mb-8">{message}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-[#1A1A1A] text-white rounded-2xl font-bold hover:bg-black transition-all"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function parseChordProLine(line: string) {
  let lyrics = "";
  const chords: { chord: string; index: number }[] = [];
  const chordRegex = /\[(.*?)\]/g;
  let lastIndex = 0;
  let match;

  while ((match = chordRegex.exec(line)) !== null) {
    // Add text before the chord
    lyrics += line.substring(lastIndex, match.index);
    
    // Position of the chord in the clean lyrics
    const index = lyrics.length;
    chords.push({ chord: match[1], index });
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  lyrics += line.substring(lastIndex);
  
  return { lyrics, chords };
}

function App() {
  const [title, setTitle] = useState('Amazing Grace');
  const [key, setKey] = useState('');
  const [ccliInfo, setCcliInfo] = useState('');
  const [primaryText, setPrimaryText] = useState('[Verse 1]\nAmazing grace how sweet the sound\nThat saved a wretch like me\nI once was lost but now am found\nWas blind but now I see');
  const [secondaryText, setSecondaryText] = useState('[Verse 1]\nSublime gracia del Señor\nQue a un infeliz salvó\nFui ciego mas hoy veo yo\nPerdido y Él me halló');

  const [activeTab, setActiveTab] = useState<'dashboard' | 'input' | 'preview' | 'export' | 'library' | 'subscription' | 'restructure'>('dashboard');
  const [mode, setMode] = useState<Mode>('multilingual');
  const [exportMode, setExportMode] = useState<'native-chords' | 'stage-notes'>('native-chords');

  // Auto-parse ChordPro metadata
  useEffect(() => {
    if (mode === 'sermon') return;

    const lines = primaryText.split('\n');
    let foundTitle = '';
    let foundKey = '';
    let ccliLines: string[] = [];
    let inCcliBlock = false;

    lines.forEach(line => {
      const trimmed = line.trim();
      
      // Parse tags like {title: ...} or {key: ...} or {t: ...} or {k: ...}
      const tagMatch = trimmed.match(/^\{(title|key|t|k|ccli|copyright|ccli_license|footer):\s*(.*)\}$/i);
      if (tagMatch) {
        const tag = tagMatch[1].toLowerCase();
        const value = tagMatch[2].trim();
        if (tag === 'title' || tag === 't') foundTitle = value;
        if (tag === 'key' || tag === 'k') foundKey = value;
      }

      // Detect CCLI block at the end - strictly starting with CCLI Song #
      if (trimmed.toUpperCase().startsWith('CCLI SONG #')) {
        inCcliBlock = true;
        ccliLines = []; // Reset to ensure we only get the CCLI block
      }
      
      if (inCcliBlock && trimmed !== '' && !trimmed.startsWith('{')) {
        if (!ccliLines.includes(trimmed)) ccliLines.push(trimmed);
      }
    });

    // Only update if the found values are different from current state
    // AND if they have actually changed in the text area (to avoid overwriting manual edits)
    if (foundTitle && foundTitle !== title) {
      setTitle(foundTitle);
    }
    if (foundKey && foundKey !== key) {
      setKey(foundKey);
    }
    
    const newCcli = ccliLines.join('\n');
    // Update CCLI info if it's found, OR clear it if it was previously found but now gone from text
    if (newCcli !== ccliInfo) {
      // We only auto-clear if the text area is not empty and we definitely parsed the whole thing
      // This prevents clearing if the user is just starting to type
      if (newCcli || (primaryText.length > 50 && ccliInfo.includes('CCLI Song #'))) {
        setCcliInfo(newCcli);
      }
    }

  }, [primaryText, mode]); // Only depend on primaryText and mode to avoid loops and overwrites
  const [sermonTitle, setSermonTitle] = useState('Sunday Sermon');
  const [sermonManuscript, setSermonManuscript] = useState('Today we are talking about faith.\n[Faith is trusting God even when you don’t understand.]\nSome additional notes here.\n[Now faith is the substance of things hoped for...]');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [linesPerLanguage, setLinesPerLanguage] = useState<number>(2);
  const [library, setLibrary] = useState<LibraryItem[]>([]);

  // Auth State
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
  const [orgEmailInput, setOrgEmailInput] = useState('');
  const [isUpdatingOrg, setIsUpdatingOrg] = useState(false);
  const [stripeConfig, setStripeConfig] = useState<{
    stripePriceIdSingle: string;
    stripePriceIdOrg: string;
    stripePublicKey: string;
    stripeConfigured: boolean;
  } | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        console.log('Fetching Stripe config...');
        const response = await fetch('/api/config');
        const data = await response.json();
        console.log('Stripe config fetched:', data);
        setStripeConfig(data);
      } catch (err) {
        console.error('Failed to fetch config', err);
      }
    };
    fetchConfig();
  }, []);

  const handleSubscribe = async (priceId: string) => {
    console.log('handleSubscribe called with priceId:', priceId);
    if (!user) {
      console.warn('handleSubscribe: No user found, showing auth');
      setShowAuth(true);
      return;
    }

    if (!stripeConfig?.stripeConfigured) {
      console.warn('handleSubscribe: Stripe not configured');
      setAuthError('Stripe is not configured on the server. Please add STRIPE_SECRET_KEY to environment variables.');
      return;
    }

    if (!priceId) {
      console.warn('handleSubscribe: No priceId provided');
      setAuthError('Invalid price ID. Please check your Stripe configuration.');
      return;
    }

    try {
      setAuthError('');
      console.log('Creating checkout session for priceId:', priceId, 'userId:', user.uid);
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId,
          userId: user.uid,
          email: user.email,
        }),
      });
      
      const data = await response.json();
      console.log('Checkout session response:', data);
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      if (data.url) {
        console.log('Redirecting to Stripe checkout (new tab):', data.url);
        // Stripe Checkout cannot run in an iframe (like the AI Studio preview).
        // Opening in a new tab is the most reliable way to handle this.
        window.open(data.url, '_blank');
      } else {
        console.error('No URL returned from checkout session');
        throw new Error('No checkout URL returned from server');
      }
    } catch (err) {
      console.error('Subscription Error:', err);
      setAuthError(err instanceof Error ? err.message : 'Failed to initiate checkout. Please check your connection.');
    }
  };

  // Check for existing token on mount
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Fetch user role from Firestore
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid)).catch(e => handleFirestoreError(e, OperationType.GET, `users/${firebaseUser.uid}`));
        if (userDoc.exists()) {
          setUser(userDoc.data() as AppUser);
          setIsAuthenticated(true);
        } else {
          // This should ideally be handled in handleLogin, but as a fallback:
          const trialEndDate = new Date();
          trialEndDate.setDate(trialEndDate.getDate() + 7);
          
          const newUser: AppUser = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            firstName: '',
            lastName: '',
            role: firebaseUser.email === 'worshipwarehousesite@gmail.com' ? 'admin' : 'user',
            subscriptionStatus: 'inactive',
            createdAt: new Date().toISOString()
          };
          await setDoc(doc(db, 'users', firebaseUser.uid), newUser).catch(e => handleFirestoreError(e, OperationType.WRITE, `users/${firebaseUser.uid}`));
          setUser(newUser);
          setIsAuthenticated(true);
        }
      } else {
        setIsAuthenticated(false);
        setUser(null);
      }
      setIsAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Test connection to Firestore
  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection')).catch(e => handleFirestoreError(e, OperationType.GET, 'test/connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();
  }, []);

  const handleGoogleLogin = async () => {
    setAuthError('');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      setAuthError(err.message || 'Google authentication failed');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (isSignup) {
        if (loginPassword !== confirmPassword) {
          setAuthError('Passwords do not match.');
          return;
        }
        if (!firstName || !lastName) {
          setAuthError('First and last name are required.');
          return;
        }

        const userCredential = await createUserWithEmailAndPassword(auth, loginEmail, loginPassword);
        const firebaseUser = userCredential.user;
        
        // Check if user is part of an organization
        const orgQuery = query(collection(db, 'users'), where('organizationEmails', 'array-contains', firebaseUser.email));
        const orgDocs = await getDocs(orgQuery);
        
        let subscriptionStatus: AppUser['subscriptionStatus'] = 'trialing';
        let plan: AppUser['plan'] = undefined;
        let trialEndDate: Date | undefined = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 7);

        if (!orgDocs.empty) {
          subscriptionStatus = 'active';
          plan = 'organization';
          trialEndDate = undefined;
        }

        const newUser: AppUser = {
          uid: firebaseUser.uid,
          email: firebaseUser.email!,
          firstName,
          lastName,
          role: firebaseUser.email === 'worshipwarehousesite@gmail.com' ? 'admin' : 'user',
          subscriptionStatus: 'inactive',
          createdAt: new Date().toISOString()
        };
        
        await setDoc(doc(db, 'users', firebaseUser.uid), newUser).catch(e => handleFirestoreError(e, OperationType.WRITE, `users/${firebaseUser.uid}`));
        setUser(newUser);
      } else {
        await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      }
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        setAuthError('Email/Password sign-in is not enabled in Firebase. Please enable it in the Firebase Console.');
      } else {
        setAuthError(err.message || 'Authentication failed');
      }
    }
  };

  const addOrgEmail = async () => {
    if (!user || !orgEmailInput || (user.organizationEmails?.length || 0) >= 10) return;
    setIsUpdatingOrg(true);
    try {
      const newEmails = [...(user.organizationEmails || []), orgEmailInput];
      await updateDoc(doc(db, 'users', user.uid), {
        organizationEmails: newEmails
      });
      
      // Try to find the user and update their subscription status
      const userQuery = query(collection(db, 'users'), where('email', '==', orgEmailInput));
      const userDocs = await getDocs(userQuery);
      if (!userDocs.empty) {
        const targetUserDoc = userDocs.docs[0];
        await updateDoc(doc(db, 'users', targetUserDoc.id), {
          subscriptionStatus: 'active',
          plan: 'organization'
        });
      }

      setUser({ ...user, organizationEmails: newEmails });
      setOrgEmailInput('');
    } catch (err) {
      console.error('Failed to add org email', err);
    } finally {
      setIsUpdatingOrg(false);
    }
  };

  const removeOrgEmail = async (email: string) => {
    if (!user) return;
    setIsUpdatingOrg(true);
    try {
      const newEmails = (user.organizationEmails || []).filter(e => e !== email);
      await updateDoc(doc(db, 'users', user.uid), {
        organizationEmails: newEmails
      });

      // Try to find the user and revert their subscription status
      const userQuery = query(collection(db, 'users'), where('email', '==', email));
      const userDocs = await getDocs(userQuery);
      if (!userDocs.empty) {
        const targetUserDoc = userDocs.docs[0];
        await updateDoc(doc(db, 'users', targetUserDoc.id), {
          subscriptionStatus: 'inactive',
          plan: undefined
        });
      }

      setUser({ ...user, organizationEmails: newEmails });
    } catch (err) {
      console.error('Failed to remove org email', err);
    } finally {
      setIsUpdatingOrg(false);
    }
  };

  const isSubscribed = useMemo(() => {
    if (!user) return false;
    if (user.role === 'admin') return true; // Admins have full access
    if (user.subscriptionStatus === 'active') return true;
    if (user.subscriptionStatus === 'trialing') {
      const trialEnd = new Date(user.trialEndDate || 0);
      return trialEnd > new Date();
    }
    return false;
  }, [user]);

  // Force users to subscription tab if not subscribed
  useEffect(() => {
    if (isAuthenticated && !isSubscribed && activeTab !== 'subscription') {
      setActiveTab('subscription');
    }
  }, [isAuthenticated, isSubscribed, activeTab]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setIsAuthenticated(false);
      setUser(null);
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  // Fetch library from Firestore when authenticated
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const q = query(collection(db, 'library'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: LibraryItem[] = [];
      snapshot.forEach((doc) => {
        items.push({ ...doc.data(), id: doc.id } as LibraryItem);
      });
      setLibrary(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'library');
    });

    return () => unsubscribe();
  }, [isAuthenticated, user]);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const createCheckoutSession = async (plan: 'single' | 'organization') => {
    if (!user) return;
    
    const priceId = plan === 'single' ? 'price_123_single' : 'price_123_org'; // Placeholders
    
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId,
          userId: user.uid,
          email: user.email,
        }),
      });
      
      const { url, error } = await response.json();
      if (error) throw new Error(error);
      if (url) window.location.href = url;
    } catch (err: any) {
      console.error('Checkout error:', err);
      setAuthError('Failed to start checkout session: ' + err.message);
    }
  };

  // Load from local storage on mount
  useEffect(() => {
    const savedData = localStorage.getItem('song-slide-studio-data');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (parsed.title) setTitle(parsed.title);
        if (parsed.ccliInfo) setCcliInfo(parsed.ccliInfo);
        if (parsed.primaryText) setPrimaryText(parsed.primaryText);
        if (parsed.secondaryText) setSecondaryText(parsed.secondaryText);
        if (parsed.linesPerLanguage) setLinesPerLanguage(parsed.linesPerLanguage);
        if (parsed.sermonTitle) setSermonTitle(parsed.sermonTitle);
        if (parsed.sermonManuscript) setSermonManuscript(parsed.sermonManuscript);
        if (parsed.mode) setMode(parsed.mode);
        setLastSaved(new Date());
      } catch (e) {
        console.error('Failed to load auto-saved data', e);
      }
    }

    const savedLibrary = localStorage.getItem('song-slide-studio-library');
    if (savedLibrary) {
      try {
        setLibrary(JSON.parse(savedLibrary));
      } catch (e) {
        console.error('Failed to load library', e);
      }
    }
  }, []);

  // Auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const dataToSave = { title, ccliInfo, primaryText, secondaryText, linesPerLanguage, sermonTitle, sermonManuscript, mode };
      localStorage.setItem('song-slide-studio-data', JSON.stringify(dataToSave));
      setLastSaved(new Date());
    }, 30000);

    return () => clearInterval(interval);
  }, [title, ccliInfo, primaryText, secondaryText, linesPerLanguage, sermonTitle, sermonManuscript, mode]);

  const sermonSlides = useMemo((): SermonSlide[] => {
    const slides: SermonSlide[] = [];
    const regex = /\[(.*?)\]/gs;
    let match;
    let index = 0;
    
    while ((match = regex.exec(sermonManuscript)) !== null) {
      if (match[1].trim()) {
        slides.push({
          id: uuidv4(),
          content: match[1].trim(),
          index: index++
        });
      }
    }
    return slides;
  }, [sermonManuscript]);

  const songData = useMemo((): SongData => {
    const isCcliLine = (line: string) => 
      line.startsWith('CCLI Song #') || 
      line.startsWith('©') || 
      line.startsWith('CCLI License #') || 
      line.startsWith('For use solely with');
    const isTag = (line: string) => line.startsWith('{') && line.endsWith('}') && !line.startsWith('{comment:');
    const primaryLinesRaw = primaryText.split('\n').map(l => l.trim()).filter(l => l !== '' && !isTag(l) && !isCcliLine(l));
    const secondaryLinesRaw = mode === 'multilingual' 
      ? secondaryText.split('\n').map(l => l.trim()).filter(l => l !== '' && !isTag(l) && !isCcliLine(l))
      : [];

    const slides: Slide[] = [];
    let currentSection = 'Verse 1';
    
    // Aligning logic
    let pIdx = 0;
    let sIdx = 0;

    while (pIdx < primaryLinesRaw.length || sIdx < secondaryLinesRaw.length) {
      const pLineRaw = primaryLinesRaw[pIdx] || '';
      const sLineRaw = secondaryLinesRaw[sIdx] || '';

      // Check for section markers like [Verse 1], #Verse 1, or {comment: Verse 1}
      const isSection = (line: string) => 
        (line.startsWith('[') && line.endsWith(']')) || 
        line.startsWith('#') ||
        (line.startsWith('{comment:') && line.endsWith('}'));
      
      if (isSection(pLineRaw)) {
        if (pLineRaw.startsWith('#')) {
          currentSection = pLineRaw.slice(1).trim();
        } else if (pLineRaw.startsWith('{comment:')) {
          currentSection = pLineRaw.slice(9, -1).trim();
        } else {
          currentSection = pLineRaw.slice(1, -1);
        }
        pIdx++;
        if (isSection(sLineRaw)) sIdx++;
        continue;
      }
      
      if (isSection(sLineRaw)) {
        sIdx++;
        continue;
      }

      const pBatch: string[] = [];
      const sBatch: string[] = [];
      const chordsBatch: { chord: string; index: number }[] = [];
      const stageNotesBatch: string[] = [];
      const chordsTextBatch: string[] = [];

      let currentLyricsOffset = 0;

      for (let i = 0; i < linesPerLanguage; i++) {
        if (pIdx < primaryLinesRaw.length) {
          const nextP = primaryLinesRaw[pIdx];
          if (isSection(nextP)) break;
          
          const { lyrics, chords } = parseChordProLine(nextP);
          pBatch.push(lyrics);
          
          // Map chords to slide-level indices
          chords.forEach(c => {
            chordsBatch.push({
              chord: c.chord,
              index: currentLyricsOffset + c.index
            });
          });

          // Build stage notes fallback (chords over lyrics)
          if (chords.length > 0) {
            let chordLine = "";
            let lastPos = 0;
            chords.forEach(c => {
              const spaces = Math.max(0, c.index - lastPos);
              chordLine += " ".repeat(spaces) + c.chord;
              lastPos = c.index + c.chord.length;
            });
            stageNotesBatch.push(chordLine);
          }
          stageNotesBatch.push(lyrics);
          
          chordsTextBatch.push(nextP);
          currentLyricsOffset += lyrics.length + 1; // +1 for newline
          pIdx++;
        }
        if (mode === 'multilingual' && sIdx < secondaryLinesRaw.length) {
          const nextS = secondaryLinesRaw[sIdx];
          if (isSection(nextS)) break;
          const { lyrics } = parseChordProLine(nextS);
          sBatch.push(lyrics);
          sIdx++;
        }
      }

      if (pBatch.length > 0 || sBatch.length > 0) {
        slides.push({
          id: uuidv4(),
          section: currentSection,
          primaryLines: pBatch,
          secondaryLines: sBatch,
          chordsText: chordsTextBatch.join('\n'),
          chords: exportMode === 'native-chords' ? chordsBatch : [],
          notes: exportMode === 'stage-notes' ? stageNotesBatch.join('\n') : ''
        });
      }
    }

    return { title, artist: '', key, slides };
  }, [title, key, primaryText, secondaryText, linesPerLanguage, exportMode, mode]);

  const addToLibrary = async () => {
    if (!user) return;
    
    try {
      if (mode === 'multilingual' || mode === 'stage-chord') {
        const newSong: LibrarySong = {
          type: 'song',
          id: uuidv4(),
          userId: user.uid,
          title,
          key,
          ccliInfo,
          artist: '',
          primaryText,
          secondaryText,
          linesPerLanguage,
          createdAt: new Date().toISOString()
        };
        await setDoc(doc(db, 'library', newSong.id), newSong);
        alert('Song added to library!');
      } else {
        const newSermon: LibrarySermon = {
          type: 'sermon',
          id: uuidv4(),
          userId: user.uid,
          title: sermonTitle,
          manuscript: sermonManuscript,
          createdAt: new Date().toISOString()
        };
        await setDoc(doc(db, 'library', newSermon.id), newSermon);
        alert('Sermon added to library!');
      }
    } catch (err) {
      console.error('Failed to add to library', err);
      alert('Failed to save to cloud library.');
    }
  };

  const loadFromLibrary = (item: LibraryItem) => {
    if (item.type === 'song') {
      setMode('multilingual');
      setTitle(item.title);
      setKey(item.key || '');
      setCcliInfo(item.ccliInfo || '');
      setPrimaryText(item.primaryText);
      setSecondaryText(item.secondaryText);
      setLinesPerLanguage(item.linesPerLanguage);
    } else {
      setMode('sermon');
      setSermonTitle(item.title);
      setSermonManuscript(item.manuscript);
    }
    setActiveTab('input');
  };

  const removeFromLibrary = async (id: string) => {
    if (!confirm('Are you sure you want to remove this item?')) return;
    try {
      await deleteDoc(doc(db, 'library', id));
    } catch (err) {
      console.error('Failed to remove from library', err);
    }
  };

  const exportText = () => {
    let content = `{title: ${songData.title}}\n`;
    if (key) content += `{key: ${key}}\n`;
    content += `\n`;
    let lastSection = '';
    songData.slides.forEach(slide => {
      if (slide.section !== lastSection) {
        content += `{comment: ${slide.section}}\n`;
        lastSection = slide.section;
      }
      
      // Use the appropriate format based on exportMode
      if (exportMode === 'stage-notes' && slide.notes) {
        content += slide.notes + '\n';
      } else if (slide.chordsText) {
        content += slide.chordsText + '\n';
      } else {
        content += slide.primaryLines.join('\n') + '\n';
      }
      
      if (slide.secondaryLines.length > 0) {
        content += slide.secondaryLines.join('\n') + '\n';
      }
      content += '\n';
    });
    if (ccliInfo) {
      content += `\n${ccliInfo}\n`;
    }
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, `${songData.title}.txt`);
  };

  const exportPro7 = () => {
    try {
      if (songData.slides.length === 0) {
        alert('Please enter some lyrics first!');
        return;
      }
      // Use the new manual writer logic for bilingual slides
      const settings = {
        presentationName: songData.title,
        fontFamily: exportMode === 'stage-notes' ? 'Helvetica' : 'Arial',
        fontSize: exportMode === 'stage-notes' ? 130 : 50,
        backgroundColor: '#000000',
        textColor: '#ffffff',
        hideChordsFromAudience: exportMode === 'stage-notes'
      };

      // Convert SongData slides to the format expected by the writer
      const writerSlides = songData.slides.map(slide => ({
        group: slide.section,
        primaryText: slide.primaryLines.join('\n'),
        secondaryText: slide.secondaryLines.join('\n'),
        chordsText: slide.chordsText,
        chords: slide.chords,
        notes: slide.notes
      }));

      const presentationWriter = writePresentation(writerSlides, settings);
      const binaryData = presentationWriter.toBytes();
      const blob = new Blob([binaryData], { type: 'application/octet-stream' });
      saveAs(blob, `${songData.title}.pro`);
    } catch (error) {
      console.error('Pro7 export failed:', error);
      alert('Failed to generate ProPresenter file. Check console for details.');
    }
  };

  const exportSermonPro7 = () => {
    try {
      if (sermonSlides.length === 0) {
        alert('Please enter some manuscript text with [brackets] first!');
        return;
      }
      const settings = {
        presentationName: sermonTitle || 'Sermon',
        fontFamily: 'Arial',
        fontSize: 50,
        backgroundColor: '#000000',
        textColor: '#ffffff'
      };

      const writerSlides = sermonSlides.map(slide => ({
        group: 'Sermon',
        primaryText: slide.content,
        secondaryText: ''
      }));

      const presentationWriter = writePresentation(writerSlides, settings);
      const binaryData = presentationWriter.toBytes();
      const blob = new Blob([binaryData], { type: 'application/octet-stream' });
      saveAs(blob, `${sermonTitle || 'Sermon'}.pro`);
    } catch (error) {
      console.error('Sermon Pro7 export failed:', error);
      alert('Failed to generate ProPresenter file. Check console for details.');
    }
  };

  const exportSermonPPTX = () => {
    if (sermonSlides.length === 0) {
      alert('Please enter some manuscript text with [brackets] first!');
      return;
    }
    const pres = new pptxgen();
    pres.layout = 'LAYOUT_WIDE';

    sermonSlides.forEach((slide) => {
      const pSlide = pres.addSlide();
      pSlide.background = { color: '1A1A1A' };

      pSlide.addText(slide.content, {
        x: '10%', y: '10%', w: '80%', h: '80%',
        align: 'center', valign: 'middle', color: 'FFFFFF',
        fontSize: 44, fontFace: 'Arial', bold: true,
      });
    });

    pres.writeFile({ fileName: `${sermonTitle || 'Sermon'}.pptx` });
  };

  const exportPPTX = () => {
    const pres = new pptxgen();
    pres.layout = 'LAYOUT_WIDE';

    songData.slides.forEach((slide) => {
      const pSlide = pres.addSlide();
      pSlide.background = { color: '1A1A1A' };

      if (mode === 'stage-chord') {
        // Stage Chord Display: Show chords and lyrics
        pSlide.addText(slide.chordsText || slide.primaryLines.join('\n'), {
          x: '5%', y: '15%', w: '90%', h: '70%',
          align: 'center', valign: 'middle', color: 'FFFFFF',
          fontSize: 32, fontFace: 'Courier New', bold: true,
        });
      } else {
        // Multilingual or Standard: Show primary and secondary
        pSlide.addText(slide.primaryLines.join('\n'), {
          x: 0, y: '10%', w: '100%', h: '40%',
          align: 'center', valign: 'middle', color: 'FFFFFF',
          fontSize: 44, fontFace: 'Arial', bold: true,
        });

        if (mode === 'multilingual' && slide.secondaryLines.length > 0) {
          pSlide.addShape(pres.ShapeType.line, {
            x: '45%', y: '50%', w: '10%', h: 0,
            line: { color: 'FFFFFF', width: 1, transparency: 80 },
          });

          pSlide.addText(slide.secondaryLines.join('\n'), {
            x: 0, y: '55%', w: '100%', h: '35%',
            align: 'center', valign: 'middle', color: '8E8E8E',
            fontSize: 32, fontFace: 'Arial', italic: true,
          });
        }
      }

      pSlide.addText(slide.section, {
        x: '5%', y: '5%', w: '20%', h: '5%',
        fontSize: 12, color: '8E8E8E', fontFace: 'Arial',
      });
    });

    pres.writeFile({ fileName: `${songData.title}.pptx` });
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] text-[#1A1A1A] font-sans selection:bg-[#E0E0E0]">
      {/* Header */}
      <header className="border-b border-[#E0E0E0] bg-white px-8 py-6 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#1A1A1A] rounded-lg flex items-center justify-center text-white">
            {mode === 'sermon' ? <BookOpen size={20} /> : <Music size={20} />}
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">WorshipSlides Pro</h1>
            <div className="flex items-center gap-2">
              <p className="text-xs text-[#8E8E8E] font-medium uppercase tracking-widest">{mode === 'sermon' ? 'Sermon Manuscript Engine' : 'Lyric Integration Engine'}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {isAuthenticated && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#F0F0F0] rounded-full">
                <div className="w-5 h-5 bg-[#1A1A1A] rounded-full flex items-center justify-center text-white">
                  <User size={12} />
                </div>
                <span className="text-xs font-medium">{user?.email}</span>
              </div>
              <button 
                onClick={handleLogout}
                className="p-2 text-[#8E8E8E] hover:text-red-600 transition-colors"
                title="Logout"
              >
                <LogOut size={18} />
              </button>
            </div>
          )}
          {isAuthenticated && (
            <nav className="flex items-center gap-1 bg-[#F0F0F0] p-1 rounded-full">
              {isSubscribed ? (
                <>
                  <button 
                    onClick={() => setActiveTab('dashboard')}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${activeTab === 'dashboard' ? 'bg-white shadow-sm text-[#1A1A1A]' : 'text-[#8E8E8E] hover:text-[#1A1A1A]'}`}
                  >
                    Home
                  </button>
                  <button 
                    onClick={() => setActiveTab('input')}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${activeTab === 'input' ? 'bg-white shadow-sm text-[#1A1A1A]' : 'text-[#8E8E8E] hover:text-[#1A1A1A]'}`}
                  >
                    Input
                  </button>
                  <button 
                    onClick={() => setActiveTab('preview')}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${activeTab === 'preview' ? 'bg-white shadow-sm text-[#1A1A1A]' : 'text-[#8E8E8E] hover:text-[#1A1A1A]'}`}
                  >
                    Preview
                  </button>
                  <button 
                    onClick={() => setActiveTab('export')}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${activeTab === 'export' ? 'bg-white shadow-sm text-[#1A1A1A]' : 'text-[#8E8E8E] hover:text-[#1A1A1A]'}`}
                  >
                    Export
                  </button>
                  <button 
                    onClick={() => setActiveTab('library')}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${activeTab === 'library' ? 'bg-white shadow-sm text-[#1A1A1A]' : 'text-[#8E8E8E] hover:text-[#1A1A1A]'}`}
                  >
                    Library
                  </button>
                </>
              ) : null}
              <button 
                onClick={() => setActiveTab('subscription')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${activeTab === 'subscription' ? 'bg-white shadow-sm text-[#1A1A1A]' : 'text-[#8E8E8E] hover:text-[#1A1A1A]'}`}
              >
                Subscription
              </button>
            </nav>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-8">
        {/* Debug info */}
        <div className="hidden">
          {console.log('Render State:', { isAuthenticated, isSubscribed, activeTab, isAuthLoading, user: !!user })}
        </div>
        {isAuthLoading ? (
          <div className="flex items-center justify-center h-[60vh]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1A1A1A]"></div>
          </div>
        ) : !isAuthenticated ? (
          !showAuth ? (
            <div className="space-y-20 py-10">
              <section className="text-center space-y-8 max-w-4xl mx-auto">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="w-24 h-24 bg-[#1A1A1A] rounded-3xl flex items-center justify-center text-white mx-auto shadow-2xl"
                >
                  <Music size={48} />
                </motion.div>
                <h1 className="text-6xl font-light tracking-tight leading-tight">
                  Streamline Your <span className="font-bold">Worship Production</span>
                </h1>
                <p className="text-xl text-[#8E8E8E] leading-relaxed font-light">
                  WorshipSlides Pro is a purpose-built platform designed to streamline the process of turning raw content into fully formatted, presentation-ready slides for church environments. It focuses on reducing the friction between lyric preparation and live production by supporting inputs like ChordPro and plain text, then intelligently parsing structure—verses, choruses, bridges, and chord placement—without requiring extensive manual formatting.
                </p>
                <div className="flex items-center justify-center gap-6 pt-4">
                  <button 
                    onClick={() => setShowAuth(true)}
                    className="px-10 py-5 bg-[#1A1A1A] text-white rounded-2xl font-bold text-lg hover:bg-black transition-all shadow-xl hover:scale-105 active:scale-95"
                  >
                    Get Started for Free
                  </button>
                  <a 
                    href="https://weareworshipwarehouse.com" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="px-10 py-5 bg-white border border-[#E0E0E0] text-[#1A1A1A] rounded-2xl font-bold text-lg hover:bg-[#F9F9F9] transition-all shadow-sm"
                  >
                    View Pricing
                  </a>
                </div>
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-6xl mx-auto">
                <div className="bg-white p-10 rounded-[40px] border border-[#E0E0E0] shadow-sm space-y-6">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                    <Music size={24} />
                  </div>
                  <h3 className="text-2xl font-bold">Lyric & Chord Integration</h3>
                  <p className="text-[#8E8E8E] leading-relaxed">
                    A defining strength of Worship Slides Pro is its dual-output architecture, serving both front-of-house presentation and back-end team functionality. It not only generates clean lyric slides for the congregation but also supports chord overlays, stage notes, and musician-facing cues that integrate seamlessly with tools like ProPresenter.
                  </p>
                  <ul className="space-y-3 text-sm text-[#555]">
                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-blue-600 rounded-full" /> Native ProPresenter Chords</li>
                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-blue-600 rounded-full" /> Stage Notes & Musician Cues</li>
                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-blue-600 rounded-full" /> Dual-Output Architecture</li>
                  </ul>
                </div>

                <div className="bg-white p-10 rounded-[40px] border border-[#E0E0E0] shadow-sm space-y-6">
                  <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center">
                    <BookOpen size={24} />
                  </div>
                  <h3 className="text-2xl font-bold">Sermon Manuscript Engine</h3>
                  <p className="text-[#8E8E8E] leading-relaxed">
                    Worship Slides Pro extends its utility into sermon preparation by transforming full sermon manuscripts into structured slide decks for both ProPresenter and Microsoft PowerPoint. It can intelligently segment long-form text into digestible slide units—highlighting key points, scripture references, and emphasis lines.
                  </p>
                  <ul className="space-y-3 text-sm text-[#555]">
                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-purple-600 rounded-full" /> Automatic Scripture Highlighting</li>
                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-purple-600 rounded-full" /> Key Point Extraction</li>
                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-purple-600 rounded-full" /> PowerPoint & Pro7 Support</li>
                  </ul>
                </div>
              </div>

              <section className="bg-[#1A1A1A] text-white p-16 rounded-[60px] text-center space-y-8 max-w-5xl mx-auto">
                <h2 className="text-4xl font-light">Ready to transform your <span className="font-bold">Sunday prep?</span></h2>
                <p className="text-gray-400 max-w-2xl mx-auto text-lg">
                  Join churches worldwide using WorshipSlides Pro to maintain musical and visual integrity while reducing preparation time by up to 80%.
                </p>
                <button 
                  onClick={() => setShowAuth(true)}
                  className="px-12 py-6 bg-white text-[#1A1A1A] rounded-2xl font-bold text-xl hover:bg-gray-100 transition-all shadow-2xl"
                >
                  Start Your 7-Day Free Trial
                </button>
              </section>
            </div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-md mx-auto mt-20"
            >
              <div className="bg-white p-10 rounded-3xl border border-[#E0E0E0] shadow-xl space-y-8">
                <div className="text-center space-y-2">
                  <button 
                    onClick={() => setShowAuth(false)}
                    className="text-xs text-[#8E8E8E] hover:text-[#1A1A1A] mb-4 flex items-center gap-1 mx-auto"
                  >
                    <ChevronRight size={12} className="rotate-180" /> Back to Home
                  </button>
                  <div className="w-16 h-16 bg-[#1A1A1A] rounded-2xl flex items-center justify-center text-white mx-auto mb-6">
                    <Lock size={32} />
                  </div>
                  <h2 className="text-2xl font-light tracking-tight">{isSignup ? 'Create Account' : 'Welcome Back'}</h2>
                  <p className="text-[#8E8E8E] text-sm italic">{isSignup ? 'Join WorshipSlides Pro today.' : 'Please sign in to access the studio.'}</p>
                </div>

              <form onSubmit={handleLogin} className="space-y-4">
                {isSignup && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-[#8E8E8E] uppercase tracking-widest ml-1">First Name</label>
                      <input 
                        type="text" 
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-full px-5 py-3 bg-[#F9F9F9] border border-[#E0E0E0] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]/5 transition-all"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-[#8E8E8E] uppercase tracking-widest ml-1">Last Name</label>
                      <input 
                        type="text" 
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="w-full px-5 py-3 bg-[#F9F9F9] border border-[#E0E0E0] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]/5 transition-all"
                        required
                      />
                    </div>
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#8E8E8E] uppercase tracking-widest ml-1">Email Address</label>
                  <input 
                    type="email" 
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full px-5 py-3 bg-[#F9F9F9] border border-[#E0E0E0] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]/5 transition-all"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#8E8E8E] uppercase tracking-widest ml-1">Password</label>
                  <input 
                    type="password" 
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full px-5 py-3 bg-[#F9F9F9] border border-[#E0E0E0] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]/5 transition-all"
                    required
                  />
                </div>
                {isSignup && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[#8E8E8E] uppercase tracking-widest ml-1">Confirm Password</label>
                    <input 
                      type="password" 
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-5 py-3 bg-[#F9F9F9] border border-[#E0E0E0] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]/5 transition-all"
                      required
                    />
                  </div>
                )}
                {authError && (
                  <p className="text-xs text-red-600 font-medium text-center">{authError}</p>
                )}
                <button 
                  type="submit"
                  className="w-full py-4 bg-[#1A1A1A] text-white rounded-2xl font-bold hover:bg-black transition-all flex items-center justify-center gap-2 group"
                >
                  <LogIn size={18} className="group-hover:translate-x-1 transition-transform" />
                  {isSignup ? 'Sign Up' : 'Sign In'}
                </button>

                <div className="relative py-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[#F0F0F0]"></div>
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-bold">
                    <span className="bg-white px-4 text-[#8E8E8E]">Or continue with</span>
                  </div>
                </div>

                <button 
                  type="button"
                  onClick={handleGoogleLogin}
                  className="w-full py-4 bg-white border border-[#E0E0E0] text-[#1A1A1A] rounded-2xl font-bold hover:bg-[#F9F9F9] transition-all flex items-center justify-center gap-3 shadow-sm"
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" referrerPolicy="no-referrer" />
                  Sign in with Google
                </button>
              </form>
              
              <div className="pt-4 border-t border-[#F0F0F0] text-center">
                <button 
                  onClick={() => { setIsSignup(!isSignup); setAuthError(''); }}
                  className="text-xs text-[#8E8E8E] hover:text-[#1A1A1A] transition-colors font-medium"
                >
                  {isSignup ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                </button>
              </div>
            </div>
          </motion.div>
        )) : (!isSubscribed && activeTab !== 'subscription') ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-2xl mx-auto mt-10 space-y-8"
          >
            <div className="bg-white p-12 rounded-[40px] border border-[#E0E0E0] shadow-xl text-center space-y-8">
              <div className="w-20 h-20 bg-red-50 text-red-600 rounded-3xl flex items-center justify-center mx-auto">
                <ShieldCheck size={40} />
              </div>
              <div className="space-y-4">
                <h2 className="text-3xl font-bold tracking-tight">Subscription Required</h2>
                <p className="text-[#8E8E8E] text-lg leading-relaxed">
                  Your trial has expired or you do not have an active subscription. Access is automatically granted when your payment is confirmed through Stripe.
                </p>
                {!stripeConfig?.stripeConfigured && (
                  <div className="p-6 bg-red-50 border border-red-100 rounded-3xl space-y-3 text-left">
                    <div className="flex items-center gap-3 text-red-600 font-bold">
                      <AlertTriangle size={20} />
                      <span>Stripe Not Configured</span>
                    </div>
                    <p className="text-sm text-red-500 leading-relaxed">
                      The server is missing the Stripe API keys required for checkout. Please add <strong>STRIPE_SECRET_KEY</strong> and <strong>STRIPE_PUBLISHABLE_KEY</strong> to your environment variables in AI Studio settings.
                    </p>
                  </div>
                )}
                {stripeConfig?.stripeConfigured && (!stripeConfig?.stripePriceIdSingle || !stripeConfig?.stripePriceIdOrg) && (
                  <div className="p-6 bg-yellow-50 border border-yellow-100 rounded-3xl space-y-3 text-left">
                    <div className="flex items-center gap-3 text-yellow-600 font-bold">
                      <AlertTriangle size={20} />
                      <span>Missing Price IDs</span>
                    </div>
                    <p className="text-sm text-yellow-500 leading-relaxed">
                      Stripe is configured, but the <strong>STRIPE_PRICE_ID_SINGLE</strong> or <strong>STRIPE_PRICE_ID_ORG</strong> environment variables are missing. Please add them to your settings.
                    </p>
                  </div>
                )}
                {authError && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-medium">
                    <AlertTriangle size={16} />
                    <span>{authError}</span>
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-6 bg-[#F9F9F9] rounded-3xl border border-[#E0E0E0] text-left space-y-4">
                  <h3 className="font-bold flex items-center gap-2"><User size={18} /> Individual Plan</h3>
                  <p className="text-sm text-[#8E8E8E]">Perfect for solo worship leaders and small ministries.</p>
                  <button 
                    onClick={() => handleSubscribe(stripeConfig?.stripePriceIdSingle || '')}
                    className="block w-full py-3 bg-[#1A1A1A] text-white text-center rounded-xl font-bold text-sm hover:bg-black transition-all"
                  >
                    Subscribe Now
                  </button>
                </div>
                <div className="p-6 bg-[#F9F9F9] rounded-3xl border border-[#E0E0E0] text-left space-y-4">
                  <h3 className="font-bold flex items-center gap-2"><Users size={18} /> Organization Plan</h3>
                  <p className="text-sm text-[#8E8E8E]">Includes up to 10 additional team member accounts.</p>
                  <button 
                    onClick={() => handleSubscribe(stripeConfig?.stripePriceIdOrg || '')}
                    className="block w-full py-3 border border-[#1A1A1A] text-[#1A1A1A] text-center rounded-xl font-bold text-sm hover:bg-[#F0F0F0] transition-all"
                  >
                    Get Org License
                  </button>
                </div>
              </div>

              <button 
                onClick={handleLogout}
                className="text-sm text-[#8E8E8E] hover:text-red-600 font-medium flex items-center gap-2 mx-auto pt-4"
              >
                <LogOut size={16} /> Sign out and try another account
              </button>
            </div>
          </motion.div>
        ) : (
          <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <button 
                  onClick={() => { setMode('multilingual'); setActiveTab('input'); }}
                  className="bg-white p-8 rounded-3xl border border-[#E0E0E0] shadow-sm hover:shadow-md transition-all text-left group"
                >
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <Music size={24} />
                  </div>
                  <h3 className="text-xl font-bold mb-2">New Song</h3>
                  <p className="text-[#8E8E8E] text-sm">Create bilingual slides with automatic alignment and chord support.</p>
                </button>
                
                <button 
                  onClick={() => { setMode('sermon'); setActiveTab('input'); }}
                  className="bg-white p-8 rounded-3xl border border-[#E0E0E0] shadow-sm hover:shadow-md transition-all text-left group"
                >
                  <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <BookOpen size={24} />
                  </div>
                  <h3 className="text-xl font-bold mb-2">New Sermon</h3>
                  <p className="text-[#8E8E8E] text-sm">Generate slides from your sermon manuscript using bracketed text.</p>
                </button>

                <button 
                  onClick={() => { setMode('chord-editor'); setActiveTab('input'); }}
                  className="bg-white p-8 rounded-3xl border border-[#E0E0E0] shadow-sm hover:shadow-md transition-all text-left group"
                >
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <Edit3 size={24} />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Chord Editor</h3>
                  <p className="text-[#8E8E8E] text-sm">Upload and edit ProPresenter 7 files with ChordPro support and transposition.</p>
                </button>

                <button 
                  onClick={() => setActiveTab('restructure')}
                  className="bg-white p-8 rounded-3xl border border-[#E0E0E0] shadow-sm hover:shadow-md transition-all text-left group"
                >
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <Layout size={24} />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Pro7 Restructure</h3>
                  <p className="text-[#8E8E8E] text-sm">Move chords from display layers to slide notes for musicians.</p>
                </button>

                <button 
                  onClick={() => setActiveTab('library')}
                  className="bg-white p-8 rounded-3xl border border-[#E0E0E0] shadow-sm hover:shadow-md transition-all text-left group"
                >
                  <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <Library size={24} />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Library</h3>
                  <p className="text-[#8E8E8E] text-sm">Access your saved songs and sermons from the cloud.</p>
                </button>

                <button 
                  onClick={() => setActiveTab('subscription')}
                  className="bg-white p-8 rounded-3xl border border-[#E0E0E0] shadow-sm hover:shadow-md transition-all text-left group"
                >
                  <div className="w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <CreditCard size={24} />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Subscription</h3>
                  <p className="text-[#8E8E8E] text-sm">Manage your plan, billing, and team members.</p>
                </button>
              </div>

              <div className="bg-white p-8 rounded-3xl border border-[#E0E0E0] shadow-sm">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <Plus size={20} /> Recent Activity
                </h3>
                {library.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {library.slice(0, 4).map((item) => (
                      <div 
                        key={item.id}
                        onClick={() => loadFromLibrary(item)}
                        className="p-4 bg-[#F9F9F9] rounded-2xl border border-[#E0E0E0] hover:border-[#1A1A1A] transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`p-2 rounded-lg ${item.type === 'song' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                            {item.type === 'song' ? <Music size={14} /> : <BookOpen size={14} />}
                          </div>
                          <span className="text-[10px] font-bold text-[#8E8E8E] uppercase tracking-widest">{item.type}</span>
                        </div>
                        <h4 className="font-bold text-sm truncate group-hover:text-blue-600 transition-colors">{item.title}</h4>
                        <p className="text-[10px] text-[#8E8E8E] mt-1">Saved {new Date(item.createdAt).toLocaleDateString()}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-[#F9F9F9] rounded-2xl border border-dashed border-[#E0E0E0]">
                    <p className="text-[#8E8E8E] italic">No items in your library yet. Start by creating a new song or sermon!</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'input' && (
            <motion.div 
              key="input"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full"
            >
              {mode === 'chord-editor' ? (
                <ChordEditorMain />
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* Metadata */}
                  <div className="lg:col-span-4 space-y-6">
                <div className="bg-white p-6 rounded-2xl border border-[#E0E0E0] shadow-sm">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-[#8E8E8E] mb-4 flex items-center gap-2">
                    <Layout size={14} /> Input Mode
                  </h2>
                  <div className="grid grid-cols-1 gap-2">
                    <button 
                      onClick={() => setMode('sermon')}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${mode === 'sermon' ? 'bg-[#1A1A1A] text-white shadow-md' : 'bg-[#F9F9F9] text-[#8E8E8E] hover:bg-[#F0F0F0]'}`}
                    >
                      <BookOpen size={14} /> Sermon Mode
                    </button>
                    <button 
                      onClick={() => setMode('multilingual')}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${mode === 'multilingual' ? 'bg-[#1A1A1A] text-white shadow-md' : 'bg-[#F9F9F9] text-[#8E8E8E] hover:bg-[#F0F0F0]'}`}
                    >
                      <Languages size={14} /> Multilingual Mode
                    </button>
                    <button 
                      onClick={() => setMode('stage-chord')}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${mode === 'stage-chord' ? 'bg-[#1A1A1A] text-white shadow-md' : 'bg-[#F9F9F9] text-[#8E8E8E] hover:bg-[#F0F0F0]'}`}
                    >
                      <Music size={14} /> Stage Chord Display
                    </button>
                    <button 
                      onClick={() => setMode('chord-editor')}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${mode === 'chord-editor' ? 'bg-[#1A1A1A] text-white shadow-md' : 'bg-[#F9F9F9] text-[#8E8E8E] hover:bg-[#F0F0F0]'}`}
                    >
                      <Edit3 size={14} /> Chord Editor
                    </button>
                  </div>
                </div>

                {(mode === 'multilingual' || mode === 'stage-chord') ? (
                  <>
                    <div className="bg-white p-6 rounded-2xl border border-[#E0E0E0] shadow-sm">
                      <h2 className="text-sm font-semibold uppercase tracking-wider text-[#8E8E8E] mb-4 flex items-center gap-2">
                        <Info size={14} /> Song Details
                      </h2>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-medium text-[#8E8E8E] mb-1.5 uppercase">Title</label>
                          <input 
                            type="text" 
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full px-4 py-2.5 bg-[#F9F9F9] border border-[#E0E0E0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]/5 transition-all"
                            placeholder="Song Title"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#8E8E8E] mb-1.5 uppercase">Key</label>
                          <input 
                            type="text" 
                            value={key}
                            onChange={(e) => setKey(e.target.value)}
                            className="w-full px-4 py-2.5 bg-[#F9F9F9] border border-[#E0E0E0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]/5 transition-all"
                            placeholder="e.g. E"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#8E8E8E] mb-1.5 uppercase">CCLI Song Information</label>
                          <textarea 
                            value={ccliInfo}
                            onChange={(e) => setCcliInfo(e.target.value)}
                            className="w-full px-4 py-2.5 bg-[#F9F9F9] border border-[#E0E0E0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]/5 transition-all font-mono text-xs h-24 resize-none"
                            placeholder="Paste CCLI info here..."
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-[#E0E0E0] shadow-sm">
                      <h2 className="text-sm font-semibold uppercase tracking-wider text-[#8E8E8E] mb-4 flex items-center gap-2">
                        <Settings size={14} /> Alignment Rules
                      </h2>
                      <ul className="space-y-3">
                        <li className="flex items-start gap-3 text-sm text-[#4A4A4A]">
                          <div className="mt-1 w-1.5 h-1.5 rounded-full bg-[#1A1A1A]" />
                          <span>Section headers: <code className="bg-[#F0F0F0] px-1 rounded">[Verse 1]</code></span>
                        </li>
                      </ul>

                      <div className="mt-6 pt-6 border-t border-[#F0F0F0]">
                        <label className="block text-xs font-medium text-[#8E8E8E] mb-3 uppercase">Lines Per Slide</label>
                        <div className="flex gap-2">
                          {[1, 2, 3].map((num) => (
                            <button
                              key={num}
                              onClick={() => setLinesPerLanguage(num)}
                              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${linesPerLanguage === num ? 'bg-[#1A1A1A] text-white' : 'bg-[#F9F9F9] text-[#8E8E8E] hover:bg-[#F0F0F0]'}`}
                            >
                              {num} {num === 1 ? 'Line' : 'Lines'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <button 
                      onClick={addToLibrary}
                      className="w-full py-4 bg-white border border-[#E0E0E0] text-[#1A1A1A] rounded-2xl font-bold hover:bg-[#F9F9F9] transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Plus size={18} />
                      Add to Library
                    </button>
                  </>
                ) : (
                  <>
                    <div className="bg-white p-6 rounded-2xl border border-[#E0E0E0] shadow-sm">
                      <h2 className="text-sm font-semibold uppercase tracking-wider text-[#8E8E8E] mb-4 flex items-center gap-2">
                        <Info size={14} /> Sermon Details
                      </h2>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-medium text-[#8E8E8E] mb-1.5 uppercase">Sermon Title</label>
                          <input 
                            type="text" 
                            value={sermonTitle}
                            onChange={(e) => setSermonTitle(e.target.value)}
                            className="w-full px-4 py-2.5 bg-[#F9F9F9] border border-[#E0E0E0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]/5 transition-all"
                            placeholder="Sermon Title"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-[#E0E0E0] shadow-sm">
                      <h2 className="text-sm font-semibold uppercase tracking-wider text-[#8E8E8E] mb-4 flex items-center gap-2">
                        <Settings size={14} /> Sermon Rules
                      </h2>
                      <ul className="space-y-3">
                        <li className="flex items-start gap-3 text-sm text-[#4A4A4A]">
                          <div className="mt-1 w-1.5 h-1.5 rounded-full bg-[#1A1A1A]" />
                          <span>Bracketed text <code className="bg-[#F0F0F0] px-1 rounded">[...]</code> becomes a slide.</span>
                        </li>
                        <li className="flex items-start gap-3 text-sm text-[#4A4A4A]">
                          <div className="mt-1 w-1.5 h-1.5 rounded-full bg-[#1A1A1A]" />
                          <span>Non-bracketed text is ignored for slides.</span>
                        </li>
                      </ul>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-[#E0E0E0] shadow-sm">
                      <h2 className="text-sm font-semibold uppercase tracking-wider text-[#8E8E8E] mb-4 flex items-center gap-2">
                        <Layout size={14} /> Slide Count
                      </h2>
                      <div className="text-center py-4">
                        <p className="text-4xl font-light">{sermonSlides.length}</p>
                        <p className="text-[10px] font-bold text-[#8E8E8E] uppercase tracking-widest mt-1">Detected Slides</p>
                      </div>
                    </div>

                    <button 
                      onClick={addToLibrary}
                      className="w-full py-4 bg-white border border-[#E0E0E0] text-[#1A1A1A] rounded-2xl font-bold hover:bg-[#F9F9F9] transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Plus size={18} />
                      Add to Library
                    </button>
                  </>
                )}

                <div className="bg-white p-6 rounded-2xl border border-[#E0E0E0] shadow-sm">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-[#8E8E8E] mb-4 flex items-center gap-2">
                    <Download size={14} /> Quick Export
                  </h2>
                  <div className="grid grid-cols-1 gap-2">
                    <button 
                      onClick={mode === 'sermon' ? exportSermonPro7 : exportPro7}
                      className="flex items-center gap-3 px-4 py-2 bg-[#1A1A1A] text-white rounded-xl text-xs font-bold hover:bg-black transition-all"
                    >
                      <Presentation size={14} /> Pro7
                    </button>
                    <button 
                      onClick={mode === 'sermon' ? exportSermonPPTX : exportPPTX}
                      className="flex items-center gap-3 px-4 py-2 bg-white border border-[#E0E0E0] text-[#1A1A1A] rounded-xl text-xs font-bold hover:border-[#1A1A1A] transition-all"
                    >
                      <Monitor size={14} /> PowerPoint
                    </button>
                    {mode !== 'sermon' && (
                      <button 
                        onClick={exportText}
                        className="flex items-center gap-3 px-4 py-2 bg-white border border-[#E0E0E0] text-[#1A1A1A] rounded-xl text-xs font-bold hover:border-[#1A1A1A] transition-all"
                      >
                        <FileText size={14} /> Text
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Editor Area */}
              <div className="lg:col-span-8 space-y-8">
                {mode === 'sermon' ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-semibold uppercase tracking-wider text-[#8E8E8E] flex items-center gap-2">
                        <FileText size={14} /> Sermon Manuscript
                      </h2>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 px-3 py-1.5 bg-white border border-[#E0E0E0] rounded-lg text-xs font-bold cursor-pointer hover:bg-[#F9F9F9] transition-all">
                          <Cloud size={14} /> Upload PDF
                          <input type="file" accept=".pdf,.txt" className="hidden" onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                setSermonManuscript(event.target?.result as string);
                              };
                              reader.readAsText(file);
                            }
                          }} />
                        </label>
                      </div>
                    </div>
                    <div className="relative">
                      <textarea 
                        value={sermonManuscript}
                        onChange={(e) => setSermonManuscript(e.target.value)}
                        className="w-full h-[600px] p-8 bg-white border border-[#E0E0E0] rounded-3xl focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]/5 transition-all font-mono text-sm leading-relaxed resize-none shadow-sm relative z-10 bg-transparent"
                        placeholder="Paste your sermon manuscript here. Use [brackets] for slide content."
                      />
                      <div className="absolute inset-0 p-8 font-mono text-sm leading-relaxed pointer-events-none whitespace-pre-wrap break-words overflow-auto">
                        {sermonManuscript.split(/(\[.*?\])/gs).map((part, i) => (
                          <span key={i} className={part.startsWith('[') && part.endsWith(']') ? 'bg-yellow-100 text-yellow-800 rounded px-1 font-bold border border-yellow-200' : 'text-transparent'}>
                            {part}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (mode === 'stage-chord' || mode === 'multilingual') ? (
                  <div className={`grid grid-cols-1 ${mode === 'multilingual' ? 'md:grid-cols-2' : ''} gap-6`}>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#8E8E8E] flex items-center gap-2">
                          <Languages size={14} /> {mode === 'multilingual' ? 'Primary Language' : 'Lyrics'} {(mode === 'stage-chord' || mode === 'multilingual') && <span className="text-[10px] font-bold bg-blue-50 px-2 py-0.5 rounded text-blue-600 ml-2">CHORD PRO SUPPORTED</span>}
                        </h2>
                        <span className="text-[10px] font-bold bg-[#F0F0F0] px-2 py-0.5 rounded text-[#8E8E8E]">{mode === 'multilingual' ? 'TOP' : 'STAGE'}</span>
                      </div>
                      <textarea 
                        value={primaryText}
                        onChange={(e) => setPrimaryText(e.target.value)}
                        className="w-full h-[500px] p-6 bg-white border border-[#E0E0E0] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]/5 transition-all font-mono text-sm leading-relaxed resize-none shadow-sm"
                        placeholder={mode === 'multilingual' ? "Paste primary lyrics here (ChordPro supported)..." : "Paste lyrics here (ChordPro supported)..."}
                      />
                    </div>
                    {mode === 'multilingual' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#8E8E8E] flex items-center gap-2">
                            <Languages size={14} /> Secondary Language
                          </h2>
                          <span className="text-[10px] font-bold bg-[#F0F0F0] px-2 py-0.5 rounded text-[#8E8E8E]">BOTTOM</span>
                        </div>
                        <textarea 
                          value={secondaryText}
                          onChange={(e) => setSecondaryText(e.target.value)}
                          className="w-full h-[500px] p-6 bg-white border border-[#E0E0E0] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]/5 transition-all font-mono text-sm leading-relaxed resize-none shadow-sm"
                          placeholder="Paste secondary lyrics here..."
                        />
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          )}
            </motion.div>
          )}

          {activeTab === 'preview' && (
            <motion.div 
              key="preview"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-[#8E8E8E]">
                  {mode === 'sermon' ? `Sermon Slides (${sermonSlides.length} slides)` : `Slide Preview (${songData.slides.length} slides)`}
                </h2>
                {mode !== 'sermon' && (
                  <div className="flex items-center gap-4 text-xs text-[#8E8E8E] font-medium">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-blue-500" /> Primary
                    </div>
                    {mode === 'multilingual' && (
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-orange-500" /> Secondary
                      </div>
                    )}
                    {mode === 'stage-chord' && (
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-green-500" /> Chords (Stage)
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                {mode === 'sermon' ? (
                  sermonSlides.map((slide, idx) => (
                    <div key={slide.id} className="group relative">
                      <div className="absolute -top-3 left-4 bg-[#1A1A1A] text-white text-[10px] font-bold px-2 py-0.5 rounded z-10">
                        Slide {idx + 1}
                      </div>
                      <div className="aspect-video bg-[#1A1A1A] rounded-xl overflow-hidden shadow-xl border border-white/10 flex flex-col items-center justify-center p-8 text-center">
                        <div className="w-full">
                          <p className="text-white text-sm font-medium tracking-wide leading-relaxed">
                            {slide.content}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  songData.slides.map((slide, idx) => (
                    <div key={slide.id} className="space-y-3 group relative">
                      <div className="absolute -top-3 left-4 bg-[#1A1A1A] text-white text-[10px] font-bold px-2 py-0.5 rounded z-10">
                        {slide.section} • {idx + 1}
                      </div>
                      <div className="aspect-video bg-[#1A1A1A] rounded-xl overflow-hidden shadow-xl border border-white/10 flex flex-col items-center justify-center p-8 text-center">
                        <div className="w-full space-y-4">
                          <div className="space-y-1">
                            {slide.primaryLines.map((line, i) => (
                              <FormattedText key={i} text={line} className="text-white text-sm font-medium tracking-wide" />
                            ))}
                          </div>
                          {mode === 'multilingual' && slide.secondaryLines.length > 0 && (
                            <>
                              <div className="w-12 h-[1px] bg-white/20 mx-auto" />
                              <div className="space-y-1">
                                {slide.secondaryLines.map((line, i) => (
                                  <FormattedText key={i} text={line} className="text-[#8E8E8E] text-xs italic" />
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      {(mode === 'stage-chord' || mode === 'multilingual') && slide.chordsText && (
                        <div className="bg-green-50 p-4 rounded-xl border border-green-100 shadow-sm">
                          <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                            <Music size={10} /> Stage Display
                          </p>
                          <p className="font-mono text-xs text-green-800 whitespace-pre-wrap leading-relaxed">
                            {slide.chordsText}
                          </p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {mode === 'sermon' ? (
                <div className="bg-white p-8 rounded-2xl border border-[#E0E0E0] shadow-sm space-y-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-[#8E8E8E]">Sermon Summary</h3>
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-1">
                      <p className="text-2xl font-light">{sermonSlides.length}</p>
                      <p className="text-[10px] font-bold text-[#8E8E8E] uppercase tracking-widest">Total Slides</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-2xl font-light">{sermonManuscript.length}</p>
                      <p className="text-[10px] font-bold text-[#8E8E8E] uppercase tracking-widest">Character Count</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white p-8 rounded-2xl border border-[#E0E0E0] shadow-sm space-y-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-[#8E8E8E]">Technical Summary</h3>
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-1">
                      <p className="text-2xl font-light">{songData.slides.length}</p>
                      <p className="text-[10px] font-bold text-[#8E8E8E] uppercase tracking-widest">Total Slides</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-2xl font-light">{songData.slides.reduce((acc, s) => acc + s.primaryLines.length + s.secondaryLines.length, 0)}</p>
                      <p className="text-[10px] font-bold text-[#8E8E8E] uppercase tracking-widest">Total Lines</p>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'export' && (
            <motion.div 
              key="export"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-2xl mx-auto space-y-8"
            >
              <div className="text-center space-y-2 mb-12">
                <h2 className="text-3xl font-light tracking-tight">Ready for Production</h2>
                <p className="text-[#8E8E8E]">Select your output format to download the structured {mode === 'sermon' ? 'manuscript' : 'lyrics'}.</p>
              </div>

              {mode !== 'sermon' && (
                <div className="bg-white p-6 rounded-2xl border border-[#E0E0E0] shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h3 className="font-semibold">Chord Export Mode</h3>
                      <p className="text-xs text-[#8E8E8E]">Choose how chords are embedded in the ProPresenter file.</p>
                    </div>
                    <div className="flex items-center gap-1 bg-[#F0F0F0] p-1 rounded-full">
                      <button 
                        onClick={() => setExportMode('native-chords')}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${exportMode === 'native-chords' ? 'bg-white shadow-sm text-[#1A1A1A]' : 'text-[#8E8E8E] hover:text-[#1A1A1A]'}`}
                      >
                        Native Chords
                      </button>
                      <button 
                        onClick={() => setExportMode('stage-notes')}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${exportMode === 'stage-notes' ? 'bg-white shadow-sm text-[#1A1A1A]' : 'text-[#8E8E8E] hover:text-[#1A1A1A]'}`}
                      >
                        Stage Notes
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4">
                <button 
                  onClick={mode === 'sermon' ? exportSermonPro7 : exportPro7}
                  className="flex items-center justify-between p-6 bg-white border border-[#E0E0E0] rounded-2xl hover:border-[#1A1A1A] hover:shadow-md transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <Presentation size={24} />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold">ProPresenter 7</h3>
                      <p className="text-xs text-[#8E8E8E]">
                        {mode === 'sermon' ? 'Binary Protocol Buffer format (.pro)' : 
                         exportMode === 'native-chords' ? 'Native chords embedded in slides' : 'Chords in slide notes fallback'}
                      </p>
                    </div>
                  </div>
                  <Download size={20} className="text-[#E0E0E0] group-hover:text-[#1A1A1A] transition-colors" />
                </button>

                <button 
                  onClick={mode === 'sermon' ? exportSermonPPTX : exportPPTX}
                  className="flex items-center justify-between p-6 bg-white border border-[#E0E0E0] rounded-2xl hover:border-[#1A1A1A] hover:shadow-md transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                      <Monitor size={24} />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold">PowerPoint</h3>
                      <p className="text-xs text-[#8E8E8E]">Native PPTX slide deck (.pptx)</p>
                    </div>
                  </div>
                  <Download size={20} className="text-[#E0E0E0] group-hover:text-[#1A1A1A] transition-colors" />
                </button>

                {mode !== 'sermon' && (
                  <button 
                    onClick={exportText}
                    className="flex items-center justify-between p-6 bg-white border border-[#E0E0E0] rounded-2xl hover:border-[#1A1A1A] hover:shadow-md transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                        <FileText size={24} />
                      </div>
                      <div className="text-left">
                        <h3 className="font-semibold">Plain Text</h3>
                        <p className="text-xs text-[#8E8E8E]">Clean aligned text file (.txt)</p>
                      </div>
                    </div>
                    <Download size={20} className="text-[#E0E0E0] group-hover:text-[#1A1A1A] transition-colors" />
                  </button>
                )}
              </div>
            </motion.div>
          )}
          {activeTab === 'restructure' && (
            <motion.div
              key="restructure"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <RestructureTool />
            </motion.div>
          )}

          {activeTab === 'library' && (
            <motion.div 
              key="library"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-4xl mx-auto space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-[#1A1A1A]">Cloud Library</h2>
                  <p className="text-sm text-[#8E8E8E]">Manage and load your saved songs and sermons from the cloud.</p>
                </div>
                <div className="bg-[#F0F0F0] px-4 py-2 rounded-full text-xs font-bold text-[#8E8E8E] uppercase tracking-widest">
                  {library.length} {library.length === 1 ? 'Item' : 'Items'}
                </div>
              </div>

              {library.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-[#E0E0E0] rounded-3xl p-12 text-center space-y-4">
                  <div className="w-16 h-16 bg-[#F9F9F9] rounded-full flex items-center justify-center mx-auto">
                    <Library size={32} className="text-[#E0E0E0]" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-[#1A1A1A]">Your library is empty</h3>
                    <p className="text-sm text-[#8E8E8E]">Add songs or sermons from the Input tab to see them here.</p>
                  </div>
                  <button 
                    onClick={() => setActiveTab('input')}
                    className="px-6 py-2 bg-[#1A1A1A] text-white rounded-full text-sm font-bold hover:bg-black transition-all"
                  >
                    Go to Input
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {library.map((item) => (
                    <div 
                      key={item.id}
                      className="bg-white p-6 rounded-2xl border border-[#E0E0E0] shadow-sm hover:border-[#1A1A1A] transition-all group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            {item.type === 'song' ? <Music size={14} className="text-blue-500" /> : <BookOpen size={14} className="text-purple-500" />}
                            <h3 className="text-lg font-bold text-[#1A1A1A]">{item.title}</h3>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-[#8E8E8E]">
                            {item.type === 'song' ? (
                              <span className="flex items-center gap-1"><Languages size={12} /> {item.linesPerLanguage} Lines</span>
                            ) : (
                              <span className="flex items-center gap-1"><FileText size={12} /> {item.manuscript.length} Chars</span>
                            )}
                            <span>•</span>
                            <span>Added {new Date(item.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => loadFromLibrary(item)}
                            className="px-4 py-2 bg-[#F9F9F9] text-[#1A1A1A] rounded-xl text-sm font-bold hover:bg-[#1A1A1A] hover:text-white transition-all"
                          >
                            Load {item.type === 'song' ? 'Song' : 'Sermon'}
                          </button>
                          <button 
                            onClick={() => removeFromLibrary(item.id)}
                            className="p-2 text-[#8E8E8E] hover:text-red-600 transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'subscription' && (
            <motion.div 
              key="subscription"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-4xl mx-auto space-y-8"
            >
              <div className="bg-white p-10 rounded-[40px] border border-[#E0E0E0] shadow-sm space-y-10">
                {!stripeConfig?.stripeConfigured && (
                  <div className="p-6 bg-red-50 border border-red-100 rounded-3xl space-y-3">
                    <div className="flex items-center gap-3 text-red-600 font-bold">
                      <AlertTriangle size={20} />
                      <span>Stripe Not Configured</span>
                    </div>
                    <p className="text-sm text-red-500 leading-relaxed">
                      The server is missing the Stripe API keys required for checkout. Please add <strong>STRIPE_SECRET_KEY</strong> and <strong>STRIPE_PUBLISHABLE_KEY</strong> to your environment variables in AI Studio settings.
                    </p>
                  </div>
                )}
                {stripeConfig?.stripeConfigured && (!stripeConfig?.stripePriceIdSingle || !stripeConfig?.stripePriceIdOrg) && (
                  <div className="p-6 bg-yellow-50 border border-yellow-100 rounded-3xl space-y-3">
                    <div className="flex items-center gap-3 text-yellow-600 font-bold">
                      <AlertTriangle size={20} />
                      <span>Missing Price IDs</span>
                    </div>
                    <p className="text-sm text-yellow-500 leading-relaxed">
                      Stripe is configured, but the <strong>STRIPE_PRICE_ID_SINGLE</strong> or <strong>STRIPE_PRICE_ID_ORG</strong> environment variables are missing. Please add them to your settings.
                    </p>
                  </div>
                )}
                {authError && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-medium">
                    <AlertTriangle size={16} />
                    <span>{authError}</span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold tracking-tight">Subscription Status</h2>
                    <p className="text-[#8E8E8E]">Manage your WorshipSlides Pro subscription through Stripe.</p>
                  </div>
                  <div className={`px-4 py-2 rounded-full text-sm font-bold ${user?.subscriptionStatus === 'active' || user?.subscriptionStatus === 'trialing' ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'}`}>
                    {user?.subscriptionStatus === 'active' ? 'Active' : user?.subscriptionStatus === 'trialing' ? 'Trialing' : 'Inactive'}
                  </div>
                </div>

                {!isSubscribed && (
                  <div className="p-6 bg-blue-50 border border-blue-100 rounded-3xl space-y-2">
                    <div className="flex items-center gap-3 text-blue-600 font-bold">
                      <ShieldCheck size={20} />
                      <span>7-Day Free Trial Included</span>
                    </div>
                    <p className="text-sm text-blue-500 leading-relaxed">
                      Subscribe to either plan today to start your <strong>7-day free trial</strong>. You can cancel anytime before the trial ends and you won't be charged.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-[#8E8E8E] uppercase tracking-widest">Available Plans</label>
                      <div className="grid grid-cols-1 gap-4">
                        <div className="p-6 bg-[#F9F9F9] rounded-3xl border border-[#E0E0E0] space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-lg">Individual Plan</span>
                            <User size={20} className="text-[#8E8E8E]" />
                          </div>
                          <p className="text-sm text-[#8E8E8E] leading-relaxed">
                            Perfect for single-campus churches. Full access to all features for your specific location.
                          </p>
                          <button 
                            onClick={() => handleSubscribe(stripeConfig?.stripePriceIdSingle || '')}
                            className="flex items-center justify-center gap-2 w-full py-3 bg-[#1A1A1A] text-white rounded-xl font-bold hover:bg-black transition-all"
                          >
                            {user?.plan === 'single' && isSubscribed ? 'Manage Plan' : 'Select Individual'}
                            <ChevronRight size={16} />
                          </button>
                        </div>

                        <div className="p-6 bg-[#F9F9F9] rounded-3xl border border-[#E0E0E0] space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-lg">Organization Plan</span>
                            <Building2 size={20} className="text-[#8E8E8E]" />
                          </div>
                          <p className="text-sm text-[#8E8E8E] leading-relaxed">
                            Designed for multi-campus churches. Use the platform across all your church locations.
                          </p>
                          <button 
                            onClick={() => handleSubscribe(stripeConfig?.stripePriceIdOrg || '')}
                            className="flex items-center justify-center gap-2 w-full py-3 bg-white border border-[#1A1A1A] text-[#1A1A1A] rounded-xl font-bold hover:bg-[#F9F9F9] transition-all"
                          >
                            {user?.plan === 'organization' && isSubscribed ? 'Manage Plan' : 'Select Organization'}
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-[#8E8E8E] uppercase tracking-widest">Plan Features</label>
                      <div className="space-y-3">
                        {[
                          'Unlimited Song Exports',
                          'Unlimited Sermon Manuscripts',
                          'ProPresenter 7 Native Chords',
                          'PowerPoint Integration',
                          'Cloud Library Storage',
                          user?.plan === 'organization' ? 'Up to 10 Team Members' : 'Individual Access'
                        ].map((feature, i) => (
                          <div key={i} className="flex items-center gap-3 text-sm">
                            <div className="w-5 h-5 bg-green-50 text-green-600 rounded-full flex items-center justify-center">
                              <ShieldCheck size={12} />
                            </div>
                            {feature}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {user?.plan === 'organization' && user?.organizationEmails && (
                  <div className="pt-10 border-t border-[#F0F0F0] space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xl font-bold">Organization Admin Portal</h3>
                        <p className="text-sm text-[#8E8E8E]">Manage your team members (Max 10).</p>
                      </div>
                      <span className="text-xs font-bold bg-[#F0F0F0] px-3 py-1 rounded-full">
                        {user.organizationEmails?.length || 0} / 10 Used
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <input 
                        type="email" 
                        placeholder="Enter team member email"
                        value={orgEmailInput}
                        onChange={(e) => setOrgEmailInput(e.target.value)}
                        className="flex-1 px-5 py-3 bg-[#F9F9F9] border border-[#E0E0E0] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]/5 transition-all"
                      />
                      <button 
                        onClick={addOrgEmail}
                        disabled={isUpdatingOrg || !orgEmailInput || (user.organizationEmails?.length || 0) >= 10}
                        className="px-6 py-3 bg-[#1A1A1A] text-white rounded-2xl font-bold hover:bg-black transition-all disabled:opacity-50 flex items-center gap-2"
                      >
                        <Plus size={18} /> Add
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {user.organizationEmails?.map((email, i) => (
                        <div key={i} className="flex items-center justify-between p-4 bg-[#F9F9F9] border border-[#E0E0E0] rounded-2xl">
                          <span className="text-sm font-medium">{email}</span>
                          <button 
                            onClick={() => removeOrgEmail(email)}
                            className="p-2 text-[#8E8E8E] hover:text-red-600 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                      {(user.organizationEmails?.length || 0) === 0 && (
                        <p className="text-sm text-[#8E8E8E] italic col-span-2 text-center py-4">No team members added yet.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-8 py-12 border-t border-[#E0E0E0] flex flex-col md:flex-row items-center justify-between gap-4 text-[#8E8E8E] text-xs font-medium uppercase tracking-widest">
        <p>© 2026 WorshipSlides Pro • Lead Lyric Integration Engine</p>
        <div className="flex items-center gap-6">
          <a href="#" className="hover:text-[#1A1A1A] transition-colors">Documentation</a>
          <a href="#" className="hover:text-[#1A1A1A] transition-colors">rv.data spec</a>
          <a href="#" className="hover:text-[#1A1A1A] transition-colors">Support</a>
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
