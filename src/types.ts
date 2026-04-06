export type Mode = 'sermon' | 'multilingual' | 'stage-chord' | 'chord-editor';

export type ActivePage = 'dashboard' | 'sermon' | 'multilingual' | 'stage-chord' | 'library' | 'profile' | 'admin-settings';

export interface Slide {
  id: string;
  section: string;
  primaryLines: string[];
  secondaryLines: string[];
  chordsText?: string;
  chords?: { chord: string; index: number }[];
  notes?: string;
}

export interface SongData {
  title: string;
  artist: string;
  key?: string;
  slides: Slide[];
}

export interface SermonSlide {
  id: string;
  content: string;
  index: number;
}

export interface LibrarySong {
  type: 'song';
  id: string;
  userId: string;
  title: string;
  artist: string;
  key?: string;
  ccliInfo?: string;
  primaryText: string;
  secondaryText: string;
  linesPerLanguage: number;
  mode?: 'multilingual' | 'stage-chord';
  createdAt: string;
}

export interface LibrarySermon {
  type: 'sermon';
  id: string;
  userId: string;
  title: string;
  manuscript: string;
  createdAt: string;
}

export type LibraryItem = LibrarySong | LibrarySermon;

export interface AppUser {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'user';
  subscriptionStatus?: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete' | 'inactive';
  trialEndDate?: string;
  stripeCustomerId?: string;
  plan?: 'single' | 'organization';
  organizationId?: string;
  organizationEmails?: string[];
  createdAt: string;
}
