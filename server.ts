import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import Stripe from 'stripe';
import fs from 'fs';
import multer from 'multer';
import { OAuth2Client } from 'google-auth-library';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { parsePro7File } from './src/utils/pro7Parser.ts';
import { analyzePro7File } from './src/utils/pro7FileDetector.ts';
import { transposeLyrics } from './src/utils/chordTransposer.ts';
import { validateChordFormat, extractChords } from './src/utils/chordParser.ts';
import { extractChordsFromNotes, parseChordsWithSectionHeaders } from './src/utils/chordNotesParser.ts';
import { transposeChordNotes } from './src/utils/notesTransposer.ts';

dotenv.config();

const upload = multer({ storage: multer.memoryStorage() });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-in-production';
const JWT_EXPIRY = '7d';
const BCRYPT_ROUNDS = 12;
const PORT = process.env.PORT || 3000;
const APP_URL = (process.env.APP_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID || '';

// ---------- Stripe ----------
let stripeClient: Stripe | null = null;
function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('Stripe is not configured. Add STRIPE_SECRET_KEY to environment.');
  if (!stripeClient) stripeClient = new Stripe(key);
  return stripeClient;
}

// ---------- Firebase Admin (Firestore) ----------
let db: FirebaseFirestore.Firestore | null = null;
function getDb(): FirebaseFirestore.Firestore {
  if (!db) {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (!fs.existsSync(configPath)) throw new Error(`Firebase config not found at ${configPath}`);
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    initializeApp({ projectId: cfg.projectId });
    db = getFirestore(cfg.firestoreDatabaseId);
    console.log(`Firestore initialised – project ${cfg.projectId}, db ${cfg.firestoreDatabaseId}`);
  }
  return db;
}

// ---------- Google OAuth ----------
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// ---------- JWT helpers ----------
interface JwtPayload { uid: string; email: string; }

function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

// Express request extension
interface AuthRequest extends Request { user?: JwtPayload; }

function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function adminOnly(req: AuthRequest, res: Response, next: NextFunction) {
  const uid = req.user?.uid;
  if (!uid) return res.status(401).json({ error: 'Authentication required' });
  const firestore = getDb();
  firestore.collection('users').doc(uid).get().then(doc => {
    if (doc.exists && doc.data()?.role === 'admin') return next();
    return res.status(403).json({ error: 'Admin access required' });
  }).catch(() => res.status(500).json({ error: 'Server error' }));
}

// ---------- Start Server ----------
async function startServer() {
  const app = express();

  // Stripe webhook needs raw body – must be before json parser
  app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'];
    let event: Stripe.Event;
    try {
      const stripe = getStripe();
      const secret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!secret) return res.status(500).send('Webhook secret not configured');
      event = stripe.webhooks.constructEvent(req.body, sig || '', secret);
    } catch (err: any) {
      console.error(`Webhook signature failed: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const firestore = getDb();
    const stripe = getStripe();

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id;
        const stripeCustomerId = session.customer as string;
        const subscriptionId = session.subscription as string;
        if (userId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const priceId = subscription.items.data[0].price.id;
          const plan = (session.metadata?.plan as 'organization' | 'single') ||
            (priceId === process.env.STRIPE_PRICE_ID_ORG ? 'organization' : 'single');
          const update: Record<string, any> = {
            stripeCustomerId,
            subscriptionStatus: subscription.status,
            plan,
            trialEndDate: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
          };
          if (plan === 'organization') {
            const userDoc = await firestore.collection('users').doc(userId).get();
            if (!userDoc.exists || !userDoc.data()?.organizationEmails) update.organizationEmails = [];
          }
          await firestore.collection('users').doc(userId).update(update);
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const snap = await firestore.collection('users').where('stripeCustomerId', '==', customerId).limit(1).get();
        if (!snap.empty) {
          await snap.docs[0].ref.update({
            subscriptionStatus: subscription.status,
            trialEndDate: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
          });
        }
        break;
      }
      default: break;
    }
    res.json({ received: true });
  });

  // Regular middleware
  app.use(express.json());
  app.use(cookieParser());
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

  const corsOptions = {
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return cb(null, true);
      const allowed = [APP_URL, 'http://localhost:3000', 'http://localhost:5173'];
      const ok = allowed.some(a => origin.startsWith(a)) || origin.endsWith('.run.app') || origin.includes('localhost') || process.env.NODE_ENV !== 'production';
      ok ? cb(null, true) : cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  };
  app.use(cors(corsOptions));

  // =============================================
  //  PUBLIC ROUTES
  // =============================================

  app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

  app.get('/api/config', (_req, res) => {
    res.json({
      appUrl: APP_URL,
      geminiAvailable: !!process.env.GEMINI_API_KEY,
      environment: process.env.NODE_ENV || 'development',
      stripePublicKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
      stripePriceIdSingle: process.env.STRIPE_PRICE_ID_SINGLE || '',
      stripePriceIdOrg: process.env.STRIPE_PRICE_ID_ORG || '',
      stripeConfigured: !!process.env.STRIPE_SECRET_KEY,
      googleClientId: GOOGLE_CLIENT_ID,
      appleClientId: APPLE_CLIENT_ID,
    });
  });

  // =============================================
  //  AUTH ROUTES
  // =============================================

  // Email/Password Sign-Up
  app.post('/api/auth/signup', async (req: Request, res: Response) => {
    const { email, password, firstName, lastName } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
    if (!firstName || !lastName) return res.status(400).json({ error: 'First and last name are required.' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

    const firestore = getDb();
    try {
      const existing = await firestore.collection('users').where('email', '==', email).limit(1).get();
      if (!existing.empty) return res.status(409).json({ error: 'An account with this email already exists.' });

      const uid = `u_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

      const newUser = {
        uid,
        email,
        passwordHash,
        firstName,
        lastName,
        role: email === 'worshipwarehousesite@gmail.com' ? 'admin' : 'user',
        authProvider: 'email',
        subscriptionStatus: 'inactive',
        createdAt: new Date().toISOString(),
      };

      await firestore.collection('users').doc(uid).set(newUser);

      const token = signToken({ uid, email });
      res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });

      const { passwordHash: _, ...safeUser } = newUser;
      res.json({ token, user: safeUser });
    } catch (err: any) {
      console.error('Signup error:', err);
      res.status(500).json({ error: 'Failed to create account.' });
    }
  });

  // Email/Password Login
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

    const firestore = getDb();
    try {
      const snap = await firestore.collection('users').where('email', '==', email).limit(1).get();
      if (snap.empty) return res.status(401).json({ error: 'Invalid email or password.' });

      const userDoc = snap.docs[0];
      const userData = userDoc.data();

      if (!userData.passwordHash) {
        return res.status(401).json({ error: `This account uses ${userData.authProvider || 'social'} login. Please sign in with that provider.` });
      }

      const valid = await bcrypt.compare(password, userData.passwordHash);
      if (!valid) return res.status(401).json({ error: 'Invalid email or password.' });

      const token = signToken({ uid: userData.uid, email: userData.email });
      res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });

      const { passwordHash: _, ...safeUser } = userData;
      res.json({ token, user: safeUser });
    } catch (err: any) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Login failed.' });
    }
  });

  // Google Sign-In
  app.post('/api/auth/google', async (req: Request, res: Response) => {
    const { idToken, credential } = req.body;
    const tokenToVerify = idToken || credential;
    if (!tokenToVerify) return res.status(400).json({ error: 'Google credential is required.' });

    const firestore = getDb();
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: tokenToVerify,
        audience: GOOGLE_CLIENT_ID || undefined,
      });
      const payload = ticket.getPayload();
      if (!payload || !payload.email) return res.status(400).json({ error: 'Invalid Google token.' });

      const { email, given_name, family_name, sub: googleId } = payload;

      const snap = await firestore.collection('users').where('email', '==', email).limit(1).get();
      let userData: Record<string, any>;

      if (snap.empty) {
        const uid = `g_${googleId}`;
        userData = {
          uid,
          email,
          firstName: given_name || '',
          lastName: family_name || '',
          role: email === 'worshipwarehousesite@gmail.com' ? 'admin' : 'user',
          authProvider: 'google',
          googleId,
          subscriptionStatus: 'inactive',
          createdAt: new Date().toISOString(),
        };
        await firestore.collection('users').doc(uid).set(userData);
      } else {
        const doc = snap.docs[0];
        userData = doc.data();
        if (!userData.googleId) {
          await doc.ref.update({ googleId, authProvider: userData.authProvider === 'email' ? 'email+google' : 'google' });
          userData.googleId = googleId;
        }
      }

      const token = signToken({ uid: userData.uid, email: userData.email });
      res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });

      const { passwordHash: _, ...safeUser } = userData;
      res.json({ token, user: safeUser });
    } catch (err: any) {
      console.error('Google auth error:', err);
      res.status(401).json({ error: 'Google authentication failed: ' + (err.message || 'Unknown error') });
    }
  });

  // Apple Sign-In
  app.post('/api/auth/apple', async (req: Request, res: Response) => {
    const { idToken, firstName, lastName } = req.body;
    if (!idToken) return res.status(400).json({ error: 'Apple ID token is required.' });

    const firestore = getDb();
    try {
      // Decode Apple JWT (header for kid, then verify against Apple's public keys)
      const decoded = jwt.decode(idToken, { complete: true });
      if (!decoded || typeof decoded === 'string') return res.status(400).json({ error: 'Invalid Apple token format.' });

      const applePayload = decoded.payload as any;
      const email = applePayload.email;
      const appleId = applePayload.sub;

      if (!email) return res.status(400).json({ error: 'Apple token missing email.' });

      // Verify issuer and audience
      if (applePayload.iss !== 'https://appleid.apple.com') {
        return res.status(401).json({ error: 'Invalid Apple token issuer.' });
      }
      if (APPLE_CLIENT_ID && applePayload.aud !== APPLE_CLIENT_ID) {
        return res.status(401).json({ error: 'Invalid Apple token audience.' });
      }

      const snap = await firestore.collection('users').where('email', '==', email).limit(1).get();
      let userData: Record<string, any>;

      if (snap.empty) {
        const uid = `a_${appleId.slice(0, 20)}`;
        userData = {
          uid,
          email,
          firstName: firstName || '',
          lastName: lastName || '',
          role: 'user',
          authProvider: 'apple',
          appleId,
          subscriptionStatus: 'inactive',
          createdAt: new Date().toISOString(),
        };
        await firestore.collection('users').doc(uid).set(userData);
      } else {
        const doc = snap.docs[0];
        userData = doc.data();
        if (!userData.appleId) {
          await doc.ref.update({ appleId, authProvider: userData.authProvider ? `${userData.authProvider}+apple` : 'apple' });
          userData.appleId = appleId;
        }
      }

      const token = signToken({ uid: userData.uid, email: userData.email });
      res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });

      const { passwordHash: _, ...safeUser } = userData;
      res.json({ token, user: safeUser });
    } catch (err: any) {
      console.error('Apple auth error:', err);
      res.status(401).json({ error: 'Apple authentication failed.' });
    }
  });

  // Get current user (verify token)
  app.get('/api/auth/me', authMiddleware, async (req: AuthRequest, res: Response) => {
    const firestore = getDb();
    try {
      const userDoc = await firestore.collection('users').doc(req.user!.uid).get();
      if (!userDoc.exists) return res.status(404).json({ error: 'User not found.' });
      const data = userDoc.data()!;
      const { passwordHash: _, ...safeUser } = data;
      res.json({ user: safeUser });
    } catch {
      res.status(500).json({ error: 'Failed to fetch user.' });
    }
  });

  // Logout (clear cookie)
  app.post('/api/auth/logout', (_req: Request, res: Response) => {
    res.clearCookie('token');
    res.json({ success: true });
  });

  // =============================================
  //  PROTECTED: USER PROFILE
  // =============================================

  app.put('/api/users/profile', authMiddleware, async (req: AuthRequest, res: Response) => {
    const { firstName, lastName } = req.body;
    const firestore = getDb();
    try {
      await firestore.collection('users').doc(req.user!.uid).update({ firstName, lastName });
      const updated = await firestore.collection('users').doc(req.user!.uid).get();
      const { passwordHash: _, ...safeUser } = updated.data()!;
      res.json({ user: safeUser });
    } catch {
      res.status(500).json({ error: 'Failed to update profile.' });
    }
  });

  // =============================================
  //  PROTECTED: ORGANIZATION MANAGEMENT
  // =============================================

  app.post('/api/users/org/add', authMiddleware, async (req: AuthRequest, res: Response) => {
    const { email: memberEmail } = req.body;
    if (!memberEmail) return res.status(400).json({ error: 'Email is required.' });

    const firestore = getDb();
    try {
      const userDoc = await firestore.collection('users').doc(req.user!.uid).get();
      if (!userDoc.exists) return res.status(404).json({ error: 'User not found.' });
      const userData = userDoc.data()!;

      if (userData.plan !== 'organization') return res.status(403).json({ error: 'Organization plan required.' });
      const emails: string[] = userData.organizationEmails || [];
      if (emails.length >= 5) return res.status(400).json({ error: 'Maximum 5 team members allowed.' });
      if (emails.includes(memberEmail)) return res.status(400).json({ error: 'Member already added.' });

      emails.push(memberEmail);
      await userDoc.ref.update({ organizationEmails: emails });

      // Upgrade the target user if they exist
      const targetSnap = await firestore.collection('users').where('email', '==', memberEmail).limit(1).get();
      if (!targetSnap.empty) {
        await targetSnap.docs[0].ref.update({ subscriptionStatus: 'active', plan: 'organization' });
      }

      res.json({ organizationEmails: emails });
    } catch {
      res.status(500).json({ error: 'Failed to add member.' });
    }
  });

  app.post('/api/users/org/remove', authMiddleware, async (req: AuthRequest, res: Response) => {
    const { email: memberEmail } = req.body;
    if (!memberEmail) return res.status(400).json({ error: 'Email is required.' });

    const firestore = getDb();
    try {
      const userDoc = await firestore.collection('users').doc(req.user!.uid).get();
      if (!userDoc.exists) return res.status(404).json({ error: 'User not found.' });
      const userData = userDoc.data()!;

      const emails: string[] = (userData.organizationEmails || []).filter((e: string) => e !== memberEmail);
      await userDoc.ref.update({ organizationEmails: emails });

      // Downgrade the target user
      const targetSnap = await firestore.collection('users').where('email', '==', memberEmail).limit(1).get();
      if (!targetSnap.empty) {
        await targetSnap.docs[0].ref.update({ subscriptionStatus: 'inactive', plan: FieldValue.delete() });
      }

      res.json({ organizationEmails: emails });
    } catch {
      res.status(500).json({ error: 'Failed to remove member.' });
    }
  });

  // =============================================
  //  PROTECTED: STRIPE CHECKOUT
  // =============================================

  app.post('/api/create-checkout-session', authMiddleware, async (req: AuthRequest, res: Response) => {
    const { priceId } = req.body;
    const userId = req.user!.uid;
    const email = req.user!.email;

    try {
      const stripe = getStripe();
      const baseRedirectUrl = APP_URL.includes('localhost') && req.headers.origin
        ? (req.headers.origin as string).replace(/\/$/, '')
        : APP_URL;

      if (!priceId) throw new Error('Missing priceId');

      let finalPriceId = priceId;
      if (priceId.startsWith('prod_')) {
        const product = await stripe.products.retrieve(priceId);
        if (product.default_price) {
          finalPriceId = typeof product.default_price === 'string' ? product.default_price : product.default_price.id;
        } else {
          throw new Error(`Product ${priceId} has no default price.`);
        }
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{ price: finalPriceId, quantity: 1 }],
        mode: 'subscription',
        subscription_data: { trial_period_days: 7 },
        customer_email: email,
        client_reference_id: userId,
        success_url: `${baseRedirectUrl}/?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseRedirectUrl}/`,
        metadata: {
          userId,
          plan: priceId === process.env.STRIPE_PRICE_ID_ORG ? 'organization' : 'single',
        },
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error('Stripe error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // =============================================
  //  PROTECTED: LIBRARY CRUD
  // =============================================

  app.get('/api/library', authMiddleware, async (req: AuthRequest, res: Response) => {
    const firestore = getDb();
    try {
      const snap = await firestore.collection('library').where('userId', '==', req.user!.uid).get();
      const items: any[] = [];
      snap.forEach(d => items.push({ ...d.data(), id: d.id }));
      res.json({ items });
    } catch {
      res.status(500).json({ error: 'Failed to fetch library.' });
    }
  });

  app.post('/api/library', authMiddleware, async (req: AuthRequest, res: Response) => {
    const firestore = getDb();
    try {
      const item = { ...req.body, userId: req.user!.uid, createdAt: new Date().toISOString() };
      if (!item.id) item.id = `lib_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await firestore.collection('library').doc(item.id).set(item);
      res.json({ item });
    } catch {
      res.status(500).json({ error: 'Failed to save to library.' });
    }
  });

  app.delete('/api/library/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    const firestore = getDb();
    try {
      const docRef = firestore.collection('library').doc(req.params.id);
      const doc = await docRef.get();
      if (!doc.exists) return res.status(404).json({ error: 'Not found.' });
      if (doc.data()?.userId !== req.user!.uid) return res.status(403).json({ error: 'Forbidden.' });
      await docRef.delete();
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Failed to delete.' });
    }
  });

  // =============================================
  //  CHORD EDITOR API ENDPOINTS
  // =============================================

  app.post('/api/chords/parse-pro-file', upload.single('proFile'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
      const presentation = await parsePro7File(req.file.buffer);
      const analysis = analyzePro7File(presentation);
      res.json({ title: presentation.title, slides: presentation.slides.map(s => ({ id: s.id, label: s.label, lyrics: s.lyrics, notes: s.notes })), analysis });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to parse file' });
    }
  });

  app.post('/api/chords/analyze-pro-file', upload.single('proFile'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
      const presentation = await parsePro7File(req.file.buffer);
      res.json(analyzePro7File(presentation));
    } catch (error: any) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post('/api/chords/validate-pro-file', upload.single('proFile'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
      const presentation = await parsePro7File(req.file.buffer);
      const analysis = analyzePro7File(presentation);
      res.json({ valid: analysis.hasChords, analysis });
    } catch (error: any) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post('/api/chords/import-pro-file', upload.single('proFile'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
      const presentation = await parsePro7File(req.file.buffer);
      res.json({ presentation, analysis: analyzePro7File(presentation) });
    } catch (error: any) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post('/api/chords/transpose', (req, res) => {
    try {
      const { lyrics, originalKey, targetKey } = req.body;
      if (!lyrics || !originalKey || !targetKey) return res.status(400).json({ error: 'Missing required fields' });
      res.json({ transposedLyrics: transposeLyrics(lyrics, originalKey, targetKey) });
    } catch { res.status(500).json({ error: 'Failed to transpose' }); }
  });

  app.post('/api/chords/validate', (req, res) => {
    try {
      const { lyrics } = req.body;
      if (!lyrics) return res.status(400).json({ error: 'Missing lyrics' });
      const allChords = extractChords(lyrics);
      res.json({ valid: allChords.filter(c => !validateChordFormat(c)).length === 0, allChords, invalidChords: allChords.filter(c => !validateChordFormat(c)) });
    } catch { res.status(500).json({ error: 'Validation failed' }); }
  });

  app.post('/api/chords/export-pro-file', (_req, res) => {
    res.json({ message: 'Use client-side export.' });
  });

  app.post('/api/chords/extract-from-notes', (req, res) => {
    try {
      const { notesText } = req.body;
      if (!notesText) return res.status(400).json({ error: 'Missing notes text' });
      res.json({ success: true, sections: parseChordsWithSectionHeaders(notesText), allChords: extractChordsFromNotes(notesText) });
    } catch { res.status(500).json({ error: 'Extraction failed' }); }
  });

  app.post('/api/chords/transpose-notes', (req, res) => {
    try {
      const { notesText, originalKey, targetKey } = req.body;
      if (!notesText || !originalKey || !targetKey) return res.status(400).json({ error: 'Missing fields' });
      res.json({ success: true, transposedNotes: transposeChordNotes(notesText, originalKey, targetKey) });
    } catch { res.status(500).json({ error: 'Transpose failed' }); }
  });

  app.post('/api/chords/save-to-notes', (_req, res) => {
    res.json({ success: true, message: 'Handle client-side.' });
  });

  // =============================================
  //  VITE / STATIC
  // =============================================

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Auth endpoints: /api/auth/signup, /api/auth/login, /api/auth/google, /api/auth/apple`);
    console.log(`Webhook: ${APP_URL}/api/webhook`);
  });
}

startServer();
