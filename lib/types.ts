export type ProjectStatus = 'in_progress' | 'live' | 'completed' | 'archived';

export interface ProjectItem {
  id: string;
  title: string;
  tagline: string;
  description: string;
  status: ProjectStatus;
  category: string;
  techStack: string[];
  highlights: string[];
  imageUrl?: string;
  liveUrl?: string;
  repoUrl?: string;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ProductType = 'digital' | 'service' | 'physical';

export interface Product {
  id: string;
  title: string;
  category: string;
  type: ProductType;
  price: number;
  badge?: string;
  description: string;
  features: string[];
  imageUrl?: string;
  stock: number; // -1 means unlimited (e.g. digital downloads)
  featured: boolean;
  active: boolean;
  createdAt: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export type OrderStatus = 'pending' | 'completed' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'pending' | 'paid' | 'failed';

export interface OrderItem {
  productId: string;
  title: string;
  price: number;
  quantity: number;
  type: ProductType;
}

export interface Order {
  id: string;
  userId?: string;
  keyHint?: string;
  items: OrderItem[];
  total: number;
  currencySymbol: string;
  currencyCode: string;
  paymentMethod: string;
  paymentStatus?: PaymentStatus;
  paymentReference?: string;
  paidAt?: string;
  customerName: string;
  customerEmail: string;
  notes?: string;
  createdAt: string;
  status: OrderStatus;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  createdAt: string;
  read: boolean;
}

export type FontScale = 'small' | 'medium' | 'large';

export interface SiteProfile {
  name: string;
  brandTitle: string;
  role: string;
  headline: string;
  bio: string;
  aboutText: string;
  location: string;
  availability: string;
  email: string;
  githubUrl: string;
  xUrl?: string;
  linkedinUrl?: string;
  telegramHandle?: string;
  skills: string[];
  announcement?: string;
  currencyCode: string;
  currencySymbol: string;
  fontScale?: FontScale;
}

export interface TelegramConfig {
  enabled: boolean;
  botToken: string;
  chatId: string;
  notifyContact: boolean;
  notifyChat: boolean;
  notifyOrders: boolean;
}

export interface PaystackConfig {
  enabled: boolean;
  publicKey: string;
  secretKey: string;
}

export interface BankTransferConfig {
  enabled: boolean;
  bankName: string;
  accountName: string;
  accountNumber: string;
  instructions?: string;
}

export interface HostingConfig {
  price: number;
  redirectFee?: number;
  currencyCode: string;
  currencySymbol: string;
  badge?: string;
  title?: string;
  subtitle?: string;
  supportedStacksNotice?: string;
}

export interface HostUser {
  id: string;
  name: string;
  email: string;
  keyHash: string;
  keyHint: string;
  createdAt: string;
}

export interface PublicHostUser {
  id: string;
  name: string;
  email: string;
  keyHint: string;
  createdAt: string;
}

export interface HostSessionDoc {
  id: string;
  userId: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
}

export type HostingStatus =
  | 'awaiting_payment'
  | 'awaiting_upload'
  | 'submitted'
  | 'in_review'
  | 'live'
  | 'rejected';

export interface HostingRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  projectName: string;
  notes?: string;
  amount: number;
  currencyCode: string;
  currencySymbol: string;
  redirectAddon?: boolean;
  redirectFee?: number;
  redirectTargetUrl?: string;
  paymentMethod?: string;
  transferProof?: string;
  paymentStatus: PaymentStatus;
  paymentReference?: string;
  paidAt?: string;
  hostingStatus: HostingStatus;
  zipFileId?: string;
  zipFileName?: string;
  zipSizeBytes?: number;
  uploadedAt?: string;
  liveUrl?: string;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminSettings {
  masterPin: string;
  sessionSecret: string;
  telegram?: TelegramConfig;
  paystack?: PaystackConfig;
  bankTransfer?: BankTransferConfig;
  hosting?: HostingConfig;
}

export type ChatSender = 'visitor' | 'admin';

export interface ChatMessage {
  id: string;
  sender: ChatSender;
  text: string;
  createdAt: string;
}

export interface ChatThread {
  id: string;
  visitorName: string;
  messages: ChatMessage[];
  unreadByAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AppDataStore {
  profile: SiteProfile;
  projects: ProjectItem[];
  products: Product[];
  orders: Order[];
  messages: ContactMessage[];
  settings: AdminSettings;
}
