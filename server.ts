import express from 'express';
import { createServer as createViteServer } from 'vite';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import Stripe from 'stripe';
import fs from 'fs';
import multer from 'multer';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
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

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';
const PORT = process.env.PORT || 3000;
const APP_URL = (process.env.APP_URL || `http://localhost:${PORT}`).replace(/\/$/, '');

// Stripe Initialization
let stripeClient: Stripe | null = null;
function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error('CRITICAL: STRIPE_SECRET_KEY is missing from environment variables.');
    throw new Error('Stripe is not configured. Please add STRIPE_SECRET_KEY to settings.');
  }
  if (!stripeClient) {
    console.log('Initializing Stripe client...');
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

// Firebase Admin Initialization
let db: any = null;
function getDb() {
  if (!db) {
    try {
      console.log('Initializing Firebase Admin...');
      const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
      if (!fs.existsSync(configPath)) {
        throw new Error(`Firebase config file not found at ${configPath}`);
      }
      const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      console.log(`Using Firebase Project: ${firebaseConfig.projectId}, Database: ${firebaseConfig.firestoreDatabaseId}`);
      
      initializeApp({
        projectId: firebaseConfig.projectId,
      });
      db = getFirestore(firebaseConfig.firestoreDatabaseId);
      console.log('Firebase Admin initialized successfully.');
    } catch (error: any) {
      console.error('Failed to initialize Firebase Admin:', error);
      throw error;
    }
  }
  return db;
}

async function startServer() {
  const app = express();
  
  // Webhook needs raw body
  app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      const stripe = getStripe();
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      
      if (!webhookSecret) {
        console.error('CRITICAL: STRIPE_WEBHOOK_SECRET is missing. Webhook verification will fail.');
        return res.status(500).send('Webhook secret not configured');
      }

      event = stripe.webhooks.constructEvent(
        req.body,
        sig || '',
        webhookSecret
      );
      console.log(`Webhook received: ${event.type} [${event.id}]`);
    } catch (err: any) {
      console.error(`Webhook Signature Verification Failed: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    const db = getDb();
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
          const plan = (session.metadata?.plan as 'organization' | 'single') || (priceId === process.env.STRIPE_PRICE_ID_ORG ? 'organization' : 'single');

          const updateData: any = {
            stripeCustomerId,
            subscriptionStatus: subscription.status,
            plan,
            trialEndDate: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
          };

          if (plan === 'organization') {
            const userDoc = await db.collection('users').doc(userId).get();
            if (!userDoc.exists || !userDoc.data()?.organizationEmails) {
              updateData.organizationEmails = [];
            }
          }

          await db.collection('users').doc(userId).update(updateData);
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription;
        const stripeCustomerId = subscription.customer as string;
        console.log(`Processing subscription ${event.type} for customer ${stripeCustomerId}`);
        
        const userSnapshot = await db.collection('users').where('stripeCustomerId', '==', stripeCustomerId).limit(1).get();
        if (!userSnapshot.empty) {
          const userDoc = userSnapshot.docs[0];
          const status = subscription.status;
          console.log(`Updating user ${userDoc.id} status to ${status}`);
          await userDoc.ref.update({
            subscriptionStatus: status,
            trialEndDate: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
          });
        } else {
          console.warn(`No user found with stripeCustomerId: ${stripeCustomerId}`);
        }
        break;
      }
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const stripeCustomerId = invoice.customer as string;
        console.log(`Payment succeeded for customer ${stripeCustomerId}`);
        break;
      }
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  });

  // Regular middleware
  app.use(express.json());
  app.use(cookieParser());

  // Security Headers
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }));

  // CORS Configuration
  const corsOptions = {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);
      
      const allowedOrigins = [APP_URL, 'http://localhost:3000', 'http://localhost:5173'];
      const isAllowed = 
        allowedOrigins.some(ao => origin.startsWith(ao)) || 
        origin.endsWith('.run.app') || 
        origin.includes('localhost') ||
        process.env.NODE_ENV !== 'production';
      
      if (!isAllowed) {
        console.warn(`CORS blocked for origin: ${origin}. Allowed origins: ${allowedOrigins.join(', ')}. APP_URL: ${APP_URL}`);
      }

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  };
  app.use(cors(corsOptions));

  // Health Check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API Config Endpoint
  app.get('/api/config', (req, res) => {
    console.log('GET /api/config called');
    const config = {
      appUrl: APP_URL,
      geminiAvailable: !!process.env.GEMINI_API_KEY,
      environment: process.env.NODE_ENV || 'development',
      stripePublicKey: process.env.STRIPE_PUBLISHABLE_KEY,
      stripePriceIdSingle: process.env.STRIPE_PRICE_ID_SINGLE || '',
      stripePriceIdOrg: process.env.STRIPE_PRICE_ID_ORG || '',
      stripeConfigured: !!process.env.STRIPE_SECRET_KEY,
    };
    console.log('Returning config:', { ...config, stripePublicKey: config.stripePublicKey ? 'PRESENT' : 'MISSING' });
    res.json(config);
  });

  // Stripe Checkout Session
  app.post('/api/create-checkout-session', async (req, res) => {
    const { priceId, userId, email } = req.body;
    console.log(`Creating checkout session for user: ${userId}, email: ${email}, priceId: ${priceId}`);

    try {
      const stripe = getStripe();
      
      // Use the request origin if APP_URL is localhost to ensure correct redirection
      const baseRedirectUrl = APP_URL.includes('localhost') && req.headers.origin 
        ? req.headers.origin.replace(/\/$/, '') 
        : APP_URL;

      console.log(`Using baseRedirectUrl: ${baseRedirectUrl} (APP_URL: ${APP_URL}, origin: ${req.headers.origin})`);

      if (!priceId) {
        throw new Error('Missing priceId in request body');
      }

      let finalPriceId = priceId;

      // If it's a product ID, resolve it to its default price
      if (priceId.startsWith('prod_')) {
        console.log(`Received Product ID (${priceId}). Attempting to fetch default price...`);
        try {
          const product = await stripe.products.retrieve(priceId);
          if (product.default_price) {
            finalPriceId = typeof product.default_price === 'string' 
              ? product.default_price 
              : product.default_price.id;
            console.log(`Resolved Product ID ${priceId} to Price ID ${finalPriceId}`);
          } else {
            throw new Error(`Product ${priceId} exists but does not have a "Default Price" configured in your Stripe dashboard. Please set a default price or provide a Price ID (starting with 'price_') instead.`);
          }
        } catch (err: any) {
          console.error(`Failed to resolve Product ID ${priceId}:`, err);
          if (err.type === 'StripeInvalidRequestError' && err.raw?.code === 'resource_missing') {
            const isTestMode = process.env.STRIPE_SECRET_KEY?.startsWith('sk_test');
            throw new Error(`The Stripe Product ID "${priceId}" was not found in your Stripe account (${isTestMode ? 'Test Mode' : 'Live Mode'}). Please verify the ID in your Stripe dashboard and ensure you are using the correct API keys.`);
          }
          throw new Error(`Stripe Error: ${err.message}`);
        }
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price: finalPriceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        subscription_data: {
          trial_period_days: 7,
        },
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
      if (error.type === 'StripeInvalidRequestError' && error.raw?.code === 'resource_missing') {
        const isTestMode = process.env.STRIPE_SECRET_KEY?.startsWith('sk_test');
        return res.status(400).json({ 
          error: `The Stripe resource (Price or Product) was not found in your Stripe account (${isTestMode ? 'Test Mode' : 'Live Mode'}). Please verify your STRIPE_PRICE_ID_SINGLE and STRIPE_PRICE_ID_ORG in settings and ensure they exist in the correct environment.` 
        });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Chord Editor API Endpoints

  // 1. Parse .pro file (Enhanced with analysis)
  app.post('/api/chords/parse-pro-file', upload.single('proFile'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const presentation = await parsePro7File(req.file.buffer);
      const analysis = analyzePro7File(presentation);

      res.json({
        title: presentation.title,
        slides: presentation.slides.map(s => ({
          id: s.id,
          label: s.label,
          lyrics: s.lyrics,
          notes: s.notes
        })),
        analysis
      });
    } catch (error: any) {
      console.error('Parse error:', error);
      res.status(500).json({ error: error.message || 'Failed to parse ProPresenter file' });
    }
  });

  // New Enhanced Routes for Import System
  app.post('/api/chords/analyze-pro-file', upload.single('proFile'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
      const presentation = await parsePro7File(req.file.buffer);
      const analysis = analyzePro7File(presentation);
      res.json(analysis);
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
      const analysis = analyzePro7File(presentation);
      res.json({ presentation, analysis });
    } catch (error: any) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  // 2. Transpose lyrics
  app.post('/api/chords/transpose', (req, res) => {
    try {
      const { lyrics, originalKey, targetKey } = req.body;
      if (!lyrics || !originalKey || !targetKey) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const transposedLyrics = transposeLyrics(lyrics, originalKey, targetKey);
      res.json({ transposedLyrics });
    } catch (error) {
      console.error('Transpose error:', error);
      res.status(500).json({ error: 'Failed to transpose chords' });
    }
  });

  // 3. Validate chords
  app.post('/api/chords/validate', (req, res) => {
    try {
      const { lyrics } = req.body;
      if (!lyrics) {
        return res.status(400).json({ error: 'Missing lyrics' });
      }

      const allChords = extractChords(lyrics);
      const invalidChords = allChords.filter(c => !validateChordFormat(c));

      res.json({
        valid: invalidChords.length === 0,
        allChords,
        invalidChords
      });
    } catch (error) {
      console.error('Validation error:', error);
      res.status(500).json({ error: 'Failed to validate chords' });
    }
  });

  // 4. Export .pro file (Simplified for this demo, usually returns a download URL or blob)
  app.post('/api/chords/export-pro-file', (req, res) => {
    // In a real app, this would use pro7Exporter.ts and return a file
    // For this implementation, we'll handle the export client-side to avoid server storage issues
    res.json({ message: 'Export initiated. Please use client-side export for this demo.' });
  });

  // 5. Extract chords from notes
  app.post('/api/chords/extract-from-notes', (req, res) => {
    try {
      const { notesText } = req.body;
      if (!notesText) {
        return res.status(400).json({ error: 'Missing notes text' });
      }

      const sections = parseChordsWithSectionHeaders(notesText);
      const allChords = extractChordsFromNotes(notesText);

      res.json({
        success: true,
        sections,
        allChords
      });
    } catch (error) {
      console.error('Extract from notes error:', error);
      res.status(500).json({ error: 'Failed to extract chords from notes' });
    }
  });

  // 6. Transpose notes
  app.post('/api/chords/transpose-notes', (req, res) => {
    try {
      const { notesText, originalKey, targetKey } = req.body;
      if (!notesText || !originalKey || !targetKey) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const transposedNotes = transposeChordNotes(notesText, originalKey, targetKey);
      res.json({ success: true, transposedNotes });
    } catch (error) {
      console.error('Transpose notes error:', error);
      res.status(500).json({ error: 'Failed to transpose chords in notes' });
    }
  });

  // 7. Save to notes (Simplified, usually returns updated presentation)
  app.post('/api/chords/save-to-notes', (req, res) => {
    // Similar to export, we'll handle the actual XML update client-side or in a more complex endpoint
    res.json({ success: true, message: 'Notes update received. Please handle final XML update client-side.' });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Application URL (APP_URL): ${APP_URL}`);
    console.log(`Webhook Endpoint: ${APP_URL}/api/webhook`);
  });
}

startServer();
