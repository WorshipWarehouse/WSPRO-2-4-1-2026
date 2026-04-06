import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import Stripe from 'stripe';
import multer from 'multer';
import fs from 'fs';
import { OAuth2Client } from 'google-auth-library';
import { usersDb, libraryDb, settingsDb, hasAnyUsers } from './src/lib/jsonDb.ts';
import type { DbUser } from './src/lib/jsonDb.ts';
import { parsePro7File } from './src/utils/pro7Parser.ts';
import { analyzePro7File } from './src/utils/pro7FileDetector.ts';
import { transposeLyrics } from './src/utils/chordTransposer.ts';
import { validateChordFormat, extractChords } from './src/utils/chordParser.ts';
import { extractChordsFromNotes, parseChordsWithSectionHeaders } from './src/utils/chordNotesParser.ts';
import { transposeChordNotes } from './src/utils/notesTransposer.ts';

dotenv.config();

const upload = multer({ storage: multer.memoryStorage() });
const BCRYPT_ROUNDS = 12;
const PORT = process.env.PORT || 3000;

function s(key: string): string { return settingsDb.get(key as any) || ''; }

// Stripe (lazy)
let stripeClient: Stripe | null = null;
let stripeKeyUsed = '';
function getStripe(): Stripe {
  const key = s('STRIPE_SECRET_KEY');
  if (!key) throw new Error('Stripe not configured. Set STRIPE_SECRET_KEY in Owner Settings.');
  if (!stripeClient || stripeKeyUsed !== key) { stripeClient = new Stripe(key); stripeKeyUsed = key; }
  return stripeClient;
}

// Google OAuth (lazy)
let googleClient: OAuth2Client | null = null;
let googleIdUsed = '';
function getGoogleClient(): OAuth2Client {
  const id = s('GOOGLE_CLIENT_ID');
  if (!googleClient || googleIdUsed !== id) { googleClient = new OAuth2Client(id); googleIdUsed = id; }
  return googleClient;
}

// JWT
interface JwtPayload { uid: string; email: string }
function signToken(p: JwtPayload): string { return jwt.sign(p, s('JWT_SECRET') || 'default-dev-secret', { expiresIn: '7d' }); }
function verifyToken(t: string): JwtPayload { return jwt.verify(t, s('JWT_SECRET') || 'default-dev-secret') as JwtPayload; }

interface AuthRequest extends Request { user?: JwtPayload }

function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  const token = h?.startsWith('Bearer ') ? h.slice(7) : req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try { req.user = verifyToken(token); next(); }
  catch { return res.status(401).json({ error: 'Invalid or expired token' }); }
}

function ownerMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  const ownerEmail = s('OWNER_EMAIL');
  if (!ownerEmail || req.user.email !== ownerEmail) {
    return res.status(403).json({ error: 'Owner access required. Only the designated owner can manage settings.' });
  }
  next();
}

function safe(u: DbUser) { const { passwordHash, ...rest } = u; return rest; }
function cookie(res: Response, token: string) { res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7*24*60*60*1000 }); }

async function startServer() {
  const app = express();

  // Stripe webhook (raw body)
  app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
    try {
      const stripe = getStripe();
      const secret = s('STRIPE_WEBHOOK_SECRET');
      if (!secret) return res.status(500).send('Webhook secret not configured');
      const event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'] || '', secret);
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          const uid = session.client_reference_id;
          if (uid) {
            const sub = await stripe.subscriptions.retrieve(session.subscription as string);
            const plan = (session.metadata?.plan as string) || (sub.items.data[0].price.id === s('STRIPE_PRICE_ID_ORG') ? 'organization' : 'single');
            const updates: Partial<DbUser> = { stripeCustomerId: session.customer as string, subscriptionStatus: sub.status, plan, trialEndDate: sub.trial_end ? new Date(sub.trial_end*1000).toISOString() : null };
            const existing = usersDb.findById(uid);
            if (plan === 'organization' && !existing?.organizationEmails) updates.organizationEmails = [];
            usersDb.update(uid, updates);
          }
          break;
        }
        case 'customer.subscription.updated': case 'customer.subscription.deleted': case 'customer.subscription.created': {
          const sub = event.data.object as Stripe.Subscription;
          const u = usersDb.findByField('stripeCustomerId', sub.customer as string);
          if (u) usersDb.update(u.uid, { subscriptionStatus: sub.status, trialEndDate: sub.trial_end ? new Date(sub.trial_end*1000).toISOString() : null });
          break;
        }
      }
      res.json({ received: true });
    } catch (err: any) { res.status(400).send(`Webhook Error: ${err.message}`); }
  });

  app.use(express.json());
  app.use(cookieParser());
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

  const appUrl = () => (s('APP_URL') || `http://localhost:${PORT}`).replace(/\/$/, '');

  app.use(cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      const ok = [appUrl(), 'http://localhost:3000', 'http://localhost:5173'].some(a => origin.startsWith(a))
        || origin.endsWith('.run.app') || origin.includes('localhost') || process.env.NODE_ENV !== 'production';
      ok ? cb(null, true) : cb(new Error('CORS'));
    },
    credentials: true, methods: ['GET','POST','PUT','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization','X-Requested-With'],
  }));

  // ──────── PUBLIC ────────

  app.get('/health', (_r, res) => res.json({ status: 'ok' }));

  app.get('/api/config', (_r, res) => {
    res.json({
      appUrl: appUrl(),
      environment: process.env.NODE_ENV || 'development',
      stripePublicKey: s('STRIPE_PUBLISHABLE_KEY'),
      stripePriceIdSingle: s('STRIPE_PRICE_ID_SINGLE'),
      stripePriceIdOrg: s('STRIPE_PRICE_ID_ORG'),
      stripeConfigured: !!s('STRIPE_SECRET_KEY'),
      googleClientId: s('GOOGLE_CLIENT_ID'),
      appleClientId: s('APPLE_CLIENT_ID'),
      needsSetup: !hasAnyUsers(),
    });
  });

  // ──────── SETUP WIZARD (only works when no users exist) ────────

  app.get('/api/setup/status', (_r, res) => {
    res.json({ needsSetup: !hasAnyUsers(), hasOwner: !!s('OWNER_EMAIL') });
  });

  app.post('/api/setup', async (req: Request, res: Response) => {
    if (hasAnyUsers()) return res.status(403).json({ error: 'Setup already completed. Settings can only be changed by the owner.' });

    const { ownerEmail, settings: newSettings, password, firstName, lastName } = req.body;
    if (!ownerEmail || !password) return res.status(400).json({ error: 'Owner email and password are required.' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

    try {
      // Save settings including OWNER_EMAIL
      const settingsToSave: Record<string, string> = { OWNER_EMAIL: ownerEmail, ...(newSettings || {}) };
      settingsDb.save(settingsToSave);

      // Reset lazy clients
      stripeClient = null; stripeKeyUsed = '';
      googleClient = null; googleIdUsed = '';

      // Create owner account
      const uid = `u_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const owner: DbUser = {
        uid, email: ownerEmail, passwordHash,
        firstName: firstName || 'Owner', lastName: lastName || '',
        role: 'admin', authProvider: 'email', subscriptionStatus: 'active',
        createdAt: new Date().toISOString(),
      };
      usersDb.create(owner);

      const token = signToken({ uid, email: ownerEmail });
      cookie(res, token);
      res.json({ token, user: safe(owner) });
    } catch (err: any) {
      console.error('Setup error:', err);
      res.status(500).json({ error: 'Setup failed.' });
    }
  });

  // ──────── AUTH ────────

  app.post('/api/auth/signup', async (req: Request, res: Response) => {
    const { email, password, firstName, lastName } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
    if (!firstName || !lastName) return res.status(400).json({ error: 'First and last name are required.' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    try {
      if (usersDb.findByEmail(email)) return res.status(409).json({ error: 'An account with this email already exists.' });
      const uid = `u_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const isOwner = email === s('OWNER_EMAIL');
      const isFirst = !hasAnyUsers();
      const newUser: DbUser = {
        uid, email, passwordHash, firstName, lastName,
        role: (isOwner || isFirst) ? 'admin' : 'user',
        authProvider: 'email',
        subscriptionStatus: (isOwner || isFirst) ? 'active' : 'inactive',
        createdAt: new Date().toISOString(),
      };
      usersDb.create(newUser);
      const token = signToken({ uid, email });
      cookie(res, token);
      res.json({ token, user: safe(newUser) });
    } catch (err: any) {
      console.error('Signup error:', err);
      res.status(500).json({ error: 'Failed to create account.' });
    }
  });

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
    try {
      const u = usersDb.findByEmail(email);
      if (!u) return res.status(401).json({ error: 'Invalid email or password.' });
      if (!u.passwordHash) return res.status(401).json({ error: `This account uses ${u.authProvider || 'social'} login.` });
      if (!(await bcrypt.compare(password, u.passwordHash))) return res.status(401).json({ error: 'Invalid email or password.' });
      const token = signToken({ uid: u.uid, email: u.email });
      cookie(res, token);
      res.json({ token, user: safe(u) });
    } catch (err: any) { console.error('Login error:', err); res.status(500).json({ error: 'Login failed.' }); }
  });

  app.post('/api/auth/google', async (req: Request, res: Response) => {
    const tok = req.body.idToken || req.body.credential;
    if (!tok) return res.status(400).json({ error: 'Google credential is required.' });
    try {
      const ticket = await getGoogleClient().verifyIdToken({ idToken: tok, audience: s('GOOGLE_CLIENT_ID') || undefined });
      const p = ticket.getPayload();
      if (!p?.email) return res.status(400).json({ error: 'Invalid Google token.' });
      let u = usersDb.findByEmail(p.email);
      if (!u) {
        const isOwner = p.email === s('OWNER_EMAIL');
        u = usersDb.create({ uid: `g_${p.sub}`, email: p.email, firstName: p.given_name||'', lastName: p.family_name||'', role: isOwner ? 'admin' : 'user', authProvider: 'google', googleId: p.sub, subscriptionStatus: isOwner ? 'active' : 'inactive', createdAt: new Date().toISOString() });
      } else if (!u.googleId) {
        usersDb.update(u.uid, { googleId: p.sub, authProvider: u.authProvider === 'email' ? 'email+google' : 'google' });
        u = usersDb.findById(u.uid)!;
      }
      const token = signToken({ uid: u.uid, email: u.email });
      cookie(res, token);
      res.json({ token, user: safe(u) });
    } catch (err: any) { res.status(401).json({ error: 'Google auth failed: ' + (err.message || '') }); }
  });

  app.post('/api/auth/apple', async (req: Request, res: Response) => {
    const { idToken, firstName, lastName } = req.body;
    if (!idToken) return res.status(400).json({ error: 'Apple ID token is required.' });
    try {
      const decoded = jwt.decode(idToken, { complete: true });
      if (!decoded || typeof decoded === 'string') return res.status(400).json({ error: 'Invalid Apple token.' });
      const ap = decoded.payload as any;
      if (!ap.email) return res.status(400).json({ error: 'Apple token missing email.' });
      if (ap.iss !== 'https://appleid.apple.com') return res.status(401).json({ error: 'Invalid issuer.' });
      const acid = s('APPLE_CLIENT_ID');
      if (acid && ap.aud !== acid) return res.status(401).json({ error: 'Invalid audience.' });
      let u = usersDb.findByEmail(ap.email);
      if (!u) {
        const isOwner = ap.email === s('OWNER_EMAIL');
        u = usersDb.create({ uid: `a_${ap.sub.slice(0,20)}`, email: ap.email, firstName: firstName||'', lastName: lastName||'', role: isOwner ? 'admin' : 'user', authProvider: 'apple', appleId: ap.sub, subscriptionStatus: isOwner ? 'active' : 'inactive', createdAt: new Date().toISOString() });
      } else if (!u.appleId) {
        usersDb.update(u.uid, { appleId: ap.sub, authProvider: u.authProvider ? `${u.authProvider}+apple` : 'apple' });
        u = usersDb.findById(u.uid)!;
      }
      const token = signToken({ uid: u.uid, email: u.email });
      cookie(res, token);
      res.json({ token, user: safe(u) });
    } catch (err: any) { res.status(401).json({ error: 'Apple auth failed.' }); }
  });

  app.get('/api/auth/me', authMiddleware, (req: AuthRequest, res: Response) => {
    const u = usersDb.findById(req.user!.uid);
    if (!u) return res.status(404).json({ error: 'User not found.' });
    res.json({ user: safe(u), isOwner: u.email === s('OWNER_EMAIL') });
  });

  app.post('/api/auth/logout', (_r, res) => { res.clearCookie('token'); res.json({ success: true }); });

  // ──────── PROFILE ────────

  app.put('/api/users/profile', authMiddleware, (req: AuthRequest, res: Response) => {
    const u = usersDb.update(req.user!.uid, { firstName: req.body.firstName, lastName: req.body.lastName });
    if (!u) return res.status(404).json({ error: 'Not found.' });
    res.json({ user: safe(u) });
  });

  // ──────── ORGANIZATION ────────

  app.post('/api/users/org/add', authMiddleware, (req: AuthRequest, res: Response) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required.' });
    const u = usersDb.findById(req.user!.uid);
    if (!u) return res.status(404).json({ error: 'Not found.' });
    if (u.plan !== 'organization') return res.status(403).json({ error: 'Organization plan required.' });
    const emails = u.organizationEmails || [];
    if (emails.length >= 5) return res.status(400).json({ error: 'Max 5 members.' });
    if (emails.includes(email)) return res.status(400).json({ error: 'Already added.' });
    emails.push(email);
    usersDb.update(u.uid, { organizationEmails: emails });
    const target = usersDb.findByEmail(email);
    if (target) usersDb.update(target.uid, { subscriptionStatus: 'active', plan: 'organization' });
    res.json({ organizationEmails: emails });
  });

  app.post('/api/users/org/remove', authMiddleware, (req: AuthRequest, res: Response) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required.' });
    const u = usersDb.findById(req.user!.uid);
    if (!u) return res.status(404).json({ error: 'Not found.' });
    const emails = (u.organizationEmails || []).filter(e => e !== email);
    usersDb.update(u.uid, { organizationEmails: emails });
    const target = usersDb.findByEmail(email);
    if (target) usersDb.update(target.uid, { subscriptionStatus: 'inactive' });
    res.json({ organizationEmails: emails });
  });

  // ──────── STRIPE CHECKOUT ────────

  app.post('/api/create-checkout-session', authMiddleware, async (req: AuthRequest, res: Response) => {
    const { priceId } = req.body;
    try {
      const stripe = getStripe();
      const base = appUrl().includes('localhost') && req.headers.origin ? (req.headers.origin as string).replace(/\/$/,'') : appUrl();
      if (!priceId) throw new Error('Missing priceId');
      let fp = priceId;
      if (priceId.startsWith('prod_')) { const prod = await stripe.products.retrieve(priceId); fp = typeof prod.default_price === 'string' ? prod.default_price : prod.default_price?.id || ''; if (!fp) throw new Error('No default price.'); }
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'], line_items: [{ price: fp, quantity: 1 }],
        mode: 'subscription', subscription_data: { trial_period_days: 7 },
        customer_email: req.user!.email, client_reference_id: req.user!.uid,
        success_url: `${base}/?session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${base}/`,
        metadata: { userId: req.user!.uid, plan: priceId === s('STRIPE_PRICE_ID_ORG') ? 'organization' : 'single' },
      });
      res.json({ url: session.url });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ──────── LIBRARY ────────

  app.get('/api/library', authMiddleware, (req: AuthRequest, res: Response) => {
    res.json({ items: libraryDb.findByUser(req.user!.uid) });
  });
  app.post('/api/library', authMiddleware, (req: AuthRequest, res: Response) => {
    const item = { ...req.body, userId: req.user!.uid, createdAt: new Date().toISOString() };
    if (!item.id) item.id = `lib_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    libraryDb.create(item);
    res.json({ item });
  });
  app.delete('/api/library/:id', authMiddleware, (req: AuthRequest, res: Response) => {
    const item = libraryDb.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found.' });
    if (item.userId !== req.user!.uid) return res.status(403).json({ error: 'Forbidden.' });
    libraryDb.delete(req.params.id);
    res.json({ success: true });
  });

  // ──────── OWNER SETTINGS (only accessible by OWNER_EMAIL) ────────

  app.get('/api/owner/settings', authMiddleware, ownerMiddleware, (_r: AuthRequest, res: Response) => {
    res.json({ settings: settingsDb.load() });
  });

  app.put('/api/owner/settings', authMiddleware, ownerMiddleware, (req: AuthRequest, res: Response) => {
    const updates = req.body;
    if (!updates || typeof updates !== 'object') return res.status(400).json({ error: 'Invalid.' });
    if (updates.STRIPE_SECRET_KEY) { stripeClient = null; stripeKeyUsed = ''; }
    if (updates.GOOGLE_CLIENT_ID) { googleClient = null; googleIdUsed = ''; }
    res.json({ success: true, settings: settingsDb.save(updates) });
  });

  // ──────── CHORD ENDPOINTS ────────

  app.post('/api/chords/parse-pro-file', upload.single('proFile'), async (req, res) => { try { if (!req.file) return res.status(400).json({ error: 'No file' }); const p = await parsePro7File(req.file.buffer); res.json({ title: p.title, slides: p.slides.map(sl => ({ id: sl.id, label: sl.label, lyrics: sl.lyrics, notes: sl.notes })), analysis: analyzePro7File(p) }); } catch (e: any) { res.status(500).json({ error: e.message }); } });
  app.post('/api/chords/analyze-pro-file', upload.single('proFile'), async (req, res) => { try { if (!req.file) return res.status(400).json({ error: 'No file' }); res.json(analyzePro7File(await parsePro7File(req.file.buffer))); } catch (e: any) { res.status(500).json({ error: e.message }); } });
  app.post('/api/chords/validate-pro-file', upload.single('proFile'), async (req, res) => { try { if (!req.file) return res.status(400).json({ error: 'No file' }); const a = analyzePro7File(await parsePro7File(req.file.buffer)); res.json({ valid: a.hasChords, analysis: a }); } catch (e: any) { res.status(500).json({ error: e.message }); } });
  app.post('/api/chords/import-pro-file', upload.single('proFile'), async (req, res) => { try { if (!req.file) return res.status(400).json({ error: 'No file' }); const p = await parsePro7File(req.file.buffer); res.json({ presentation: p, analysis: analyzePro7File(p) }); } catch (e: any) { res.status(500).json({ error: e.message }); } });
  app.post('/api/chords/transpose', (req, res) => { try { const { lyrics, originalKey, targetKey } = req.body; if (!lyrics||!originalKey||!targetKey) return res.status(400).json({ error: 'Missing' }); res.json({ transposedLyrics: transposeLyrics(lyrics, originalKey, targetKey) }); } catch { res.status(500).json({ error: 'Failed' }); } });
  app.post('/api/chords/validate', (req, res) => { try { const { lyrics } = req.body; if (!lyrics) return res.status(400).json({ error: 'Missing' }); const all = extractChords(lyrics); res.json({ valid: all.filter(c => !validateChordFormat(c)).length===0, allChords: all, invalidChords: all.filter(c => !validateChordFormat(c)) }); } catch { res.status(500).json({ error: 'Failed' }); } });
  app.post('/api/chords/export-pro-file', (_r, res) => res.json({ message: 'Client-side.' }));
  app.post('/api/chords/extract-from-notes', (req, res) => { try { const { notesText } = req.body; if (!notesText) return res.status(400).json({ error: 'Missing' }); res.json({ success: true, sections: parseChordsWithSectionHeaders(notesText), allChords: extractChordsFromNotes(notesText) }); } catch { res.status(500).json({ error: 'Failed' }); } });
  app.post('/api/chords/transpose-notes', (req, res) => { try { const { notesText, originalKey, targetKey } = req.body; if (!notesText||!originalKey||!targetKey) return res.status(400).json({ error: 'Missing' }); res.json({ success: true, transposedNotes: transposeChordNotes(notesText, originalKey, targetKey) }); } catch { res.status(500).json({ error: 'Failed' }); } });
  app.post('/api/chords/save-to-notes', (_r, res) => res.json({ success: true }));

  // Seed owner account if no users exist
  if (!hasAnyUsers()) {
    const ownerEmail = 'caleb@weareworshipwarehouse.com';
    const ownerPassword = 'Wolfman7!';
    try {
      const hash = await bcrypt.hash(ownerPassword, BCRYPT_ROUNDS);
      const uid = `u_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      usersDb.create({
        uid, email: ownerEmail, passwordHash: hash,
        firstName: 'Caleb', lastName: '',
        role: 'admin', authProvider: 'email',
        subscriptionStatus: 'active', createdAt: new Date().toISOString(),
      });
      settingsDb.save({ OWNER_EMAIL: ownerEmail });
      console.log(`Owner account seeded: ${ownerEmail}`);
    } catch (err) {
      console.error('Failed to seed owner account:', err);
    }
  }

  // ──────── VITE / STATIC ────────

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    // In production, dist/server.js is inside dist/, so __dirname IS the dist folder.
    // Fall back to process.cwd()/dist for cases where the server isn't bundled.
    const scriptDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();
    const distPath = fs.existsSync(path.join(scriptDir, 'index.html'))
      ? scriptDir
      : path.join(process.cwd(), 'dist');
    console.log(`Serving static files from: ${distPath}`);
    app.use(express.static(distPath));
    app.get('*', (_r, res) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) res.sendFile(indexPath);
      else res.status(404).send('index.html not found. Run npm run build first.');
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server: http://localhost:${PORT}`);
    console.log(`Owner: ${s('OWNER_EMAIL') || '(not set)'}`);
  });
}

startServer();
