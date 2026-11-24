import crypto from 'crypto';
import {
  AdminSettings,
  AppDataStore,
  BankTransferConfig,
  HostingConfig,
  PaystackConfig,
  Product,
  ProjectItem,
  SiteProfile,
  TelegramConfig,
} from './types';

export const INITIAL_PROFILE: SiteProfile = {
  name: 'Ishmeal',
  brandTitle: 'Ishmeal',
  role: 'Full-Stack Developer & Systems Builder',
  headline: 'Building apps, business tools, and security utilities.',
  bio: 'I design and build full-stack web applications, point-of-sale and fintech systems, and developer tools. Explore what I am currently working on or browse products and services in my shop.',
  aboutText:
    'I focus on shipping practical software that solves real problems—from full-stack Next.js and database-backed platforms to Python automation, browser diagnostics, and business POS systems. Everything listed here is built, maintained, or offered directly by me.',
  location: 'Remote / Global',
  availability: 'Available for new projects',
  email: 'hello@ishmeal.dev',
  githubUrl: 'https://github.com/mynameisishmeal',
  xUrl: '',
  linkedinUrl: '',
  telegramHandle: '@mynameisishmeal',
  skills: [
    'Next.js',
    'TypeScript',
    'React',
    'Node.js',
    'Python',
    'MongoDB',
    'PostgreSQL',
    'Tailwind CSS',
    'Playwright',
    'Electron',
  ],
  announcement: '',
  currencyCode: 'USD',
  currencySymbol: '$',
  fontScale: 'small',
};

const nowIso = '2026-11-19T00:00:00.000Z';

export const INITIAL_PROJECTS: ProjectItem[] = [
  {
    id: 'proj-gpower-crm',
    title: 'Gpower CRM & POS',
    tagline: 'Inventory, dual-unit sales, and thermal receipt printing for retail operations.',
    description:
      'A full-stack CRM and point-of-sale platform built for Gpower Frozen Foods, migrated from Express/EJS to Next.js 15 with TypeScript and MongoDB, plus an Electron desktop wrapper for local thermal receipt printing.',
    status: 'live',
    category: 'Business / POS',
    techStack: ['Next.js 15', 'TypeScript', 'MongoDB', 'Electron', 'Tailwind CSS'],
    highlights: [
      'Dual sales system supporting both cartons and kilos',
      'Multi-payment checkout (Cash, Transfer, Card, Credit)',
      'Real-time inventory tracking and print-ready thermal receipts',
      'Role-based access control and sales analytics dashboard',
    ],
    imageUrl: '',
    liveUrl: '',
    repoUrl: 'https://github.com/mynameisishmeal',
    featured: true,
    createdAt: nowIso,
    updatedAt: nowIso,
  },
  {
    id: 'proj-nigerian-dictionary',
    title: 'Nigerian Languages Dictionary',
    tagline: 'Fast searchable dictionary and reference across Nigerian languages.',
    description:
      'An ongoing multi-language dictionary web application indexing hundreds of Nigerian languages with instant full-text search, user accounts, and structured entries.',
    status: 'in_progress',
    category: 'Web App',
    techStack: ['Next.js', 'TypeScript', 'Prisma', 'Neon PostgreSQL', 'Algolia'],
    highlights: [
      'Structured index covering Nigerian languages and entries',
      'Instant full-text search powered by Algolia',
      'Neon PostgreSQL + Prisma ORM schema with authentication',
    ],
    imageUrl: '',
    liveUrl: '',
    repoUrl: 'https://github.com/mynameisishmeal',
    featured: true,
    createdAt: nowIso,
    updatedAt: nowIso,
  },
  {
    id: 'proj-habank',
    title: 'Habank (SwiftFinancial)',
    tagline: 'Full-stack online banking platform with 2FA and multi-role controls.',
    description:
      'A full-stack banking application featuring multi-role user accounts, transaction processing, PIN & TOTP two-factor authentication, email notifications, and an administrative management console.',
    status: 'completed',
    category: 'Fintech',
    techStack: ['Next.js 15', 'TypeScript', 'MongoDB', 'Firebase Auth', 'Speakeasy 2FA'],
    highlights: [
      'Transaction processing with PIN and TOTP 2FA verification',
      'Role-based user and administrator dashboard',
      'Automated email notifications via Nodemailer',
    ],
    imageUrl: '',
    liveUrl: '',
    repoUrl: 'https://github.com/mynameisishmeal',
    featured: true,
    createdAt: nowIso,
    updatedAt: nowIso,
  },
  {
    id: 'proj-lagoslife-inspector',
    title: 'Playwright API & Traffic Inspector',
    tagline: 'Interactive browser session observer that logs live XHR/fetch traffic and exports HAR files.',
    description:
      'A Python + Playwright developer and security assessment tool that attaches to a live browser session, displays outgoing API requests and response payloads in real time, and exports HAR archives and session summaries.',
    status: 'completed',
    category: 'Security & QA',
    techStack: ['Python', 'Playwright', 'HTTP Archive (HAR)'],
    highlights: [
      'Real-time terminal logging of XHR/fetch requests and auth headers',
      'Automatic session export to JSONL, HAR, and storage state files',
      'Built for API debugging and authorized vulnerability assessments',
    ],
    imageUrl: '',
    liveUrl: '',
    repoUrl: 'https://github.com/mynameisishmeal',
    featured: false,
    createdAt: nowIso,
    updatedAt: nowIso,
  },
  {
    id: 'proj-spoofengine',
    title: 'SpoofEngine SMTP Audit Tool',
    tagline: 'Authorized security testing utility for SPF, DKIM, and DMARC email alignment.',
    description:
      'An educational cybersecurity utility built in Python to test SMTP envelope-from vs. header-from behavior, Postfix routing, and email authentication controls during authorized security audits.',
    status: 'completed',
    category: 'Security & QA',
    techStack: ['Python', 'SMTP', 'Postfix', 'SPF / DKIM / DMARC'],
    highlights: [
      'Tests envelope-from and header-from validation alignment',
      'Includes VPS Postfix setup scripts and automated test checks',
      'Built for defensive hardening and authorized red-team education',
    ],
    imageUrl: '',
    liveUrl: '',
    repoUrl: 'https://github.com/mynameisishmeal',
    featured: false,
    createdAt: nowIso,
    updatedAt: nowIso,
  },
  {
    id: 'proj-aiutocc',
    title: 'aiuto.cc Storefront Concept',
    tagline: 'Editorial dark-theme web storefront and bespoke inquiry interface.',
    description:
      'A sleek static web interface designed around editorial typography, dark surfaces, and client inquiry flows for bespoke product sourcing.',
    status: 'in_progress',
    category: 'Frontend Design',
    techStack: ['HTML5', 'CSS3', 'JavaScript'],
    highlights: [
      'Responsive dark editorial layout with clean card hierarchy',
      'Custom typography and streamlined inquiry UX',
    ],
    imageUrl: '',
    liveUrl: '',
    repoUrl: '',
    featured: false,
    createdAt: nowIso,
    updatedAt: nowIso,
  },
];

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-pos-template',
    title: 'POS & Inventory Starter Kit',
    category: 'Templates',
    type: 'digital',
    price: 79,
    badge: 'Popular',
    description:
      'Full-stack Next.js + TypeScript point-of-sale and inventory template supporting multi-unit sales, receipt printing, and role-based dashboards.',
    features: [
      'Next.js App Router + TypeScript source code',
      'Inventory management and sales reporting dashboard',
      'Print-ready receipt layout and multi-payment checkout',
      'Clean setup instructions and environment template',
    ],
    imageUrl: '',
    stock: -1,
    featured: true,
    active: true,
    createdAt: nowIso,
  },
  {
    id: 'prod-custom-web-build',
    title: 'Custom Web App / Storefront Build',
    category: 'Services',
    type: 'service',
    price: 450,
    badge: 'Custom Build',
    description:
      'End-to-end custom Next.js website, personal portfolio, or e-commerce storefront tailored to your brand, content, and workflow.',
    features: [
      'Custom responsive UI built with React, Next.js & Tailwind CSS',
      'Admin dashboard to manage your own content and products',
      'Database or file-backed persistence and deployment setup',
      '14 days of post-launch support and refinements',
    ],
    imageUrl: '',
    stock: 4,
    featured: true,
    active: true,
    createdAt: nowIso,
  },
  {
    id: 'prod-code-review',
    title: '1-on-1 Code Review & Debugging Session',
    category: 'Services',
    type: 'service',
    price: 95,
    badge: '60 Min Call',
    description:
      'Focused 60-minute technical session to review your codebase, fix stubborn bugs, optimize database queries, or plan your architecture.',
    features: [
      'Live 60-minute walkthrough and hands-on debugging',
      'Next.js, TypeScript, Node.js, Python, or MongoDB/Postgres review',
      'Actionable follow-up summary with recommended fixes',
    ],
    imageUrl: '',
    stock: 10,
    featured: false,
    active: true,
    createdAt: nowIso,
  },
];

export const DEFAULT_TELEGRAM_CONFIG: TelegramConfig = {
  enabled: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
  botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  chatId: process.env.TELEGRAM_CHAT_ID || '',
  notifyContact: true,
  notifyChat: true,
  notifyOrders: true,
};

export const DEFAULT_PAYSTACK_CONFIG: PaystackConfig = {
  enabled: Boolean(process.env.PAYSTACK_SECRET_KEY),
  publicKey: process.env.PAYSTACK_PUBLIC_KEY || '',
  secretKey: process.env.PAYSTACK_SECRET_KEY || '',
};

export const DEFAULT_BANK_TRANSFER_CONFIG: BankTransferConfig = {
  enabled: false,
  bankName: '',
  accountName: '',
  accountNumber: '',
  instructions: 'Include your order/project reference in the transfer narration.',
};

export const DEFAULT_HOSTING_CONFIG: HostingConfig = {
  price: 50000,
  redirectFee: 15000,
  currencyCode: 'NGN',
  currencySymbol: '₦',
  badge: 'Managed Hosting',
  title: 'Host Your Project ZIP',
  subtitle:
    'Generate your unique access key, pay the one-time hosting fee, upload your .zip project folder, and receive your live link once deployed.',
  supportedStacksNotice:
    'Only PHP and Node.js projects are supported for managed ZIP hosting.',
};

export function createInitialSettings(): AdminSettings {
  return {
    masterPin: process.env.ADMIN_PIN?.trim() || '',
    sessionSecret: crypto.randomBytes(32).toString('hex'),
    telegram: { ...DEFAULT_TELEGRAM_CONFIG },
    paystack: { ...DEFAULT_PAYSTACK_CONFIG },
    bankTransfer: { ...DEFAULT_BANK_TRANSFER_CONFIG },
    hosting: { ...DEFAULT_HOSTING_CONFIG },
  };
}

export function createInitialStore(): AppDataStore {
  return {
    profile: { ...INITIAL_PROFILE },
    projects: INITIAL_PROJECTS.map(p => ({ ...p })),
    products: INITIAL_PRODUCTS.map(p => ({ ...p })),
    orders: [],
    messages: [],
    settings: createInitialSettings(),
  };
}
