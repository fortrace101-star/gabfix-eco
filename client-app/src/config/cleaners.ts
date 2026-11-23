import { serviceReviews, type ServiceReview } from './reviews';

/**
 * Local cleaner roster for P27a. Replace with `GET /cleaners/{id}` and
 * `GET /cleaners/{id}/reviews` when the cleaner API exists.
 */
export type Cleaner = {
  id: string;
  name: string;
  initials: string;
  /** Who handles the work: cleaning or a trade (shown as "Technician"). */
  kind: 'cleaner' | 'technician';
  /** Optional portrait; the avatar falls back to the initials. */
  photoUri?: string;
  rating: number;
  jobsDone: number;
  years: number;
  languages: readonly string[];
  skills: readonly string[];
  /** Services this cleaner can be booked for. */
  serviceSlugs: readonly string[];
  /** Service opened by **Book this cleaner**. */
  primaryServiceSlug: string;
  /** Sample reviews from the shared P21 feed. */
  reviewIds: readonly string[];
};

export const cleaners: readonly Cleaner[] = [
  {
    id: 'rose-nakato',
    name: 'Rose Nakato',
    initials: 'RN',
    kind: 'cleaner',
    photoUri: 'https://i.pravatar.cc/240?img=47',
    rating: 4.9,
    jobsDone: 428,
    years: 6,
    languages: ['English', 'Luganda'],
    skills: ['Deep cleaning', 'Kitchens', 'Move-out cleans', 'Eco products'],
    serviceSlugs: ['home-clean', 'deep-clean', 'move-out-clean'],
    primaryServiceSlug: 'home-clean',
    reviewIds: ['r1', 'r4', 'r7'],
  },
  {
    id: 'grace-achieng',
    name: 'Grace Achieng',
    initials: 'GA',
    kind: 'cleaner',
    photoUri: 'https://i.pravatar.cc/240?img=45',
    rating: 4.8,
    jobsDone: 312,
    years: 5,
    languages: ['English', 'Swahili'],
    skills: ['Office cleaning', 'Shared kitchens', 'Washrooms', 'Restocking'],
    serviceSlugs: ['home-clean', 'office-clean'],
    primaryServiceSlug: 'office-clean',
    reviewIds: ['r5', 'r2', 'r8'],
  },
  {
    id: 'moses-kato',
    name: 'Moses Kato',
    initials: 'MK',
    kind: 'technician',
    photoUri: 'https://i.pravatar.cc/240?img=12',
    rating: 4.9,
    jobsDone: 254,
    years: 4,
    languages: ['English', 'Luganda', 'Swahili'],
    skills: ['Deep cleaning', 'Post-renovation', 'Windows', 'Floors'],
    serviceSlugs: ['deep-clean', 'move-out-clean', 'home-clean'],
    primaryServiceSlug: 'deep-clean',
    reviewIds: ['r3', 'r7', 'r6'],
  },
  {
    id: 'sarah-namukasa',
    name: 'Sarah Namukasa',
    initials: 'SN',
    kind: 'cleaner',
    photoUri: 'https://i.pravatar.cc/240?img=32',
    rating: 5,
    jobsDone: 186,
    years: 3,
    languages: ['English', 'Luganda'],
    skills: ['Move-out cleans', 'Cupboards', 'Handover checks', 'Laundry'],
    serviceSlugs: ['move-out-clean', 'home-clean'],
    primaryServiceSlug: 'move-out-clean',
    reviewIds: ['r7', 'r3', 'r9'],
  },
  {
    id: 'daniel-opio',
    name: 'Daniel Opio',
    initials: 'DO',
    kind: 'technician',
    photoUri: 'https://i.pravatar.cc/240?img=59',
    rating: 4.8,
    jobsDone: 141,
    years: 7,
    languages: ['English', 'Ateso'],
    skills: ['Electrical', 'Lighting', 'Sockets', 'Safety checks'],
    serviceSlugs: ['electrical-works'],
    primaryServiceSlug: 'electrical-works',
    reviewIds: ['r2', 'r5'],
  },
  {
    id: 'peter-mugisha',
    name: 'Peter Mugisha',
    initials: 'PM',
    kind: 'technician',
    photoUri: 'https://i.pravatar.cc/240?img=8',
    rating: 4.7,
    jobsDone: 98,
    years: 5,
    languages: ['English', 'Runyankole'],
    skills: ['Plumbing', 'Leaks', 'Taps', 'Drainage'],
    serviceSlugs: ['plumbing-works', 'handyman-works'],
    primaryServiceSlug: 'plumbing-works',
    reviewIds: ['r6', 'r3'],
  },
];

export const cleanerById = (id?: string): Cleaner | undefined =>
  cleaners.find((cleaner) => cleaner.id === id);

export const cleanersForService = (slug: string): readonly Cleaner[] =>
  cleaners.filter((cleaner) => cleaner.serviceSlugs.includes(slug));

export const assigneeLabel = (cleaner?: Pick<Cleaner, 'kind'>): string =>
  cleaner?.kind === 'technician' ? 'Technician' : 'Cleaner';

export const reviewsForCleaner = (cleaner: Cleaner): readonly ServiceReview[] =>
  cleaner.reviewIds
    .map((id) => serviceReviews.find((review) => review.id === id))
    .filter((review): review is ServiceReview => Boolean(review));
