import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const LIBRARY_FILE = path.join(DATA_DIR, 'library.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson<T>(file: string, fallback: T): T {
  ensureDir();
  if (!fs.existsSync(file)) return fallback;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

function writeJson(file: string, data: any) {
  ensureDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

// ── Users ──

export interface DbUser {
  uid: string;
  email: string;
  passwordHash?: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'user';
  authProvider: string;
  googleId?: string;
  appleId?: string;
  subscriptionStatus: string;
  stripeCustomerId?: string;
  plan?: string;
  organizationEmails?: string[];
  trialEndDate?: string | null;
  createdAt: string;
  [key: string]: any;
}

function loadUsers(): DbUser[] { return readJson<DbUser[]>(USERS_FILE, []); }
function saveUsers(users: DbUser[]) { writeJson(USERS_FILE, users); }

export function hasAnyUsers(): boolean {
  return loadUsers().length > 0;
}

export const usersDb = {
  findByEmail(email: string): DbUser | undefined {
    return loadUsers().find(u => u.email === email);
  },
  findById(uid: string): DbUser | undefined {
    return loadUsers().find(u => u.uid === uid);
  },
  findByField(field: string, value: string): DbUser | undefined {
    return loadUsers().find(u => (u as any)[field] === value);
  },
  create(user: DbUser) {
    const users = loadUsers();
    users.push(user);
    saveUsers(users);
    return user;
  },
  update(uid: string, updates: Partial<DbUser>) {
    const users = loadUsers();
    const idx = users.findIndex(u => u.uid === uid);
    if (idx === -1) return null;
    users[idx] = { ...users[idx], ...updates };
    saveUsers(users);
    return users[idx];
  },
  deleteField(uid: string, field: string) {
    const users = loadUsers();
    const idx = users.findIndex(u => u.uid === uid);
    if (idx === -1) return null;
    delete (users[idx] as any)[field];
    saveUsers(users);
    return users[idx];
  },
};

// ── Library ──

export interface DbLibraryItem {
  id: string;
  userId: string;
  type: string;
  [key: string]: any;
}

function loadLibrary(): DbLibraryItem[] { return readJson<DbLibraryItem[]>(LIBRARY_FILE, []); }
function saveLibrary(items: DbLibraryItem[]) { writeJson(LIBRARY_FILE, items); }

export const libraryDb = {
  findByUser(userId: string): DbLibraryItem[] {
    return loadLibrary().filter(i => i.userId === userId);
  },
  findById(id: string): DbLibraryItem | undefined {
    return loadLibrary().find(i => i.id === id);
  },
  create(item: DbLibraryItem) {
    const items = loadLibrary();
    items.push(item);
    saveLibrary(items);
    return item;
  },
  delete(id: string) {
    const items = loadLibrary().filter(i => i.id !== id);
    saveLibrary(items);
  },
};

// ── Settings (admin-editable secrets/config) ──

export interface AppSettings {
  OWNER_EMAIL: string;
  JWT_SECRET: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_PUBLISHABLE_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_PRICE_ID_SINGLE: string;
  STRIPE_PRICE_ID_ORG: string;
  GOOGLE_CLIENT_ID: string;
  APPLE_CLIENT_ID: string;
  APP_URL: string;
  [key: string]: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  OWNER_EMAIL: process.env.OWNER_EMAIL || '',
  JWT_SECRET: process.env.JWT_SECRET || 'super-secret-key-change-in-production',
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
  STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY || '',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
  STRIPE_PRICE_ID_SINGLE: process.env.STRIPE_PRICE_ID_SINGLE || '',
  STRIPE_PRICE_ID_ORG: process.env.STRIPE_PRICE_ID_ORG || '',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  APPLE_CLIENT_ID: process.env.APPLE_CLIENT_ID || '',
  APP_URL: process.env.APP_URL || '',
};

export const settingsDb = {
  load(): AppSettings {
    const saved = readJson<Partial<AppSettings>>(SETTINGS_FILE, {});
    return { ...DEFAULT_SETTINGS, ...saved };
  },
  save(settings: Partial<AppSettings>) {
    const current = this.load();
    const merged = { ...current, ...settings };
    writeJson(SETTINGS_FILE, merged);
    return merged;
  },
  get(key: keyof AppSettings): string {
    return this.load()[key] || '';
  },
};
