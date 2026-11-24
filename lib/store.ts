import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Binary, Db, GridFSBucket, ObjectId } from 'mongodb';
import { getDb } from './mongodb';
import {
  AdminSettings,
  AppDataStore,
  BankTransferConfig,
  ChatMessage,
  ChatThread,
  ContactMessage,
  HostingConfig,
  HostingRequest,
  HostingStatus,
  HostSessionDoc,
  HostUser,
  Order,
  OrderStatus,
  PaymentStatus,
  PaystackConfig,
  Product,
  ProjectItem,
  PublicHostUser,
  SiteProfile,
  TelegramConfig,
} from './types';
import {
  createInitialStore,
  DEFAULT_BANK_TRANSFER_CONFIG,
  DEFAULT_HOSTING_CONFIG,
  DEFAULT_PAYSTACK_CONFIG,
  DEFAULT_TELEGRAM_CONFIG,
  INITIAL_PROFILE,
} from './data';

const LEGACY_FILE_PATH = path.join(process.cwd(), '.portfolio-data.json');

interface MetaDoc<T> {
  _id: string;
  value: T;
}

export interface StoredUpload {
  id: string;
  contentType: string;
  data: Buffer;
}

declare global {
  // eslint-disable-next-line no-var
  var __ishMongoSeedPromise: Promise<void> | undefined;
  // eslint-disable-next-line no-var
  var __ishChatIndexPromise: Promise<void> | undefined;
  // eslint-disable-next-line no-var
  var __ishHostIndexV2Promise: Promise<void> | undefined;
}

function readLegacyFileIfPresent(): AppDataStore | null {
  try {
    if (!fs.existsSync(LEGACY_FILE_PATH)) return null;
    const raw = JSON.parse(fs.readFileSync(LEGACY_FILE_PATH, 'utf-8')) as Partial<AppDataStore>;
    if (!raw.profile || !Array.isArray(raw.projects)) return null;
    const defaults = createInitialStore();
    return {
      profile: {
        ...INITIAL_PROFILE,
        ...raw.profile,
        skills: Array.isArray(raw.profile.skills) ? raw.profile.skills : INITIAL_PROFILE.skills,
      },
      projects: raw.projects,
      products: Array.isArray(raw.products) ? raw.products : defaults.products,
      orders: Array.isArray(raw.orders) ? raw.orders : [],
      messages: Array.isArray(raw.messages) ? raw.messages : [],
      settings: {
        masterPin: raw.settings?.masterPin || defaults.settings.masterPin,
        sessionSecret: raw.settings?.sessionSecret || crypto.randomBytes(32).toString('hex'),
      },
    };
  } catch {
    return null;
  }
}

async function seedIfEmpty(db: Db): Promise<void> {
  const meta = db.collection<MetaDoc<unknown>>('site_meta');
  const [profileDoc, settingsDoc] = await Promise.all([
    meta.findOne({ _id: 'profile' }),
    meta.findOne({ _id: 'settings' }),
  ]);

  if (profileDoc && settingsDoc) {
    return;
  }

  const seed = readLegacyFileIfPresent() || createInitialStore();

  await Promise.all([
    db.collection('projects').createIndex({ id: 1 }, { unique: true }),
    db.collection('products').createIndex({ id: 1 }, { unique: true }),
    db.collection('orders').createIndex({ id: 1 }, { unique: true }),
    db.collection('messages').createIndex({ id: 1 }, { unique: true }),
    db.collection('chats').createIndex({ id: 1 }, { unique: true }),
  ]);

  if (!profileDoc) {
    await meta.updateOne(
      { _id: 'profile' },
      { $setOnInsert: { value: seed.profile } },
      { upsert: true }
    );
  }

  if (!settingsDoc) {
    await meta.updateOne(
      { _id: 'settings' },
      { $setOnInsert: { value: seed.settings } },
      { upsert: true }
    );
  }

  const projCol = db.collection<ProjectItem>('projects');
  if ((await projCol.countDocuments()) === 0 && seed.projects.length > 0) {
    await projCol.insertMany(seed.projects);
  }

  const prodCol = db.collection<Product>('products');
  if ((await prodCol.countDocuments()) === 0 && seed.products.length > 0) {
    await prodCol.insertMany(seed.products);
  }

  const ordCol = db.collection<Order>('orders');
  if ((await ordCol.countDocuments()) === 0 && seed.orders.length > 0) {
    await ordCol.insertMany(seed.orders);
  }

  const msgCol = db.collection<ContactMessage>('messages');
  if ((await msgCol.countDocuments()) === 0 && seed.messages.length > 0) {
    await msgCol.insertMany(seed.messages);
  }
}

async function readyDb(): Promise<Db> {
  const db = await getDb();
  if (!globalThis.__ishMongoSeedPromise) {
    globalThis.__ishMongoSeedPromise = seedIfEmpty(db).catch(err => {
      globalThis.__ishMongoSeedPromise = undefined;
      throw err;
    });
  }
  await globalThis.__ishMongoSeedPromise;
  return db;
}

// Profile
export async function getProfile(): Promise<SiteProfile> {
  const db = await readyDb();
  const doc = await db.collection<MetaDoc<SiteProfile>>('site_meta').findOne({ _id: 'profile' });
  return doc?.value ? { ...INITIAL_PROFILE, ...doc.value } : INITIAL_PROFILE;
}

export async function updateProfile(updates: Partial<SiteProfile>): Promise<SiteProfile> {
  const db = await readyDb();
  const current = await getProfile();
  const next: SiteProfile = {
    ...current,
    ...updates,
    skills: Array.isArray(updates.skills) ? updates.skills : current.skills,
  };
  await db
    .collection<MetaDoc<SiteProfile>>('site_meta')
    .updateOne({ _id: 'profile' }, { $set: { value: next } }, { upsert: true });
  return next;
}

// Projects
export async function getProjects(): Promise<ProjectItem[]> {
  const db = await readyDb();
  return db
    .collection<ProjectItem>('projects')
    .find({}, { projection: { _id: 0 } })
    .sort({ createdAt: -1, _id: 1 })
    .toArray();
}

export async function getProjectById(id: string): Promise<ProjectItem | null> {
  const db = await readyDb();
  return db.collection<ProjectItem>('projects').findOne({ id }, { projection: { _id: 0 } });
}

export async function addProject(
  input: Omit<ProjectItem, 'id' | 'createdAt' | 'updatedAt'>
): Promise<ProjectItem> {
  const db = await readyDb();
  const now = new Date().toISOString();
  const project: ProjectItem = {
    ...input,
    id: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    techStack: Array.isArray(input.techStack) ? input.techStack : [],
    highlights: Array.isArray(input.highlights) ? input.highlights : [],
    createdAt: now,
    updatedAt: now,
  };
  await db.collection<ProjectItem>('projects').insertOne({ ...project });
  return project;
}

export async function updateProject(
  id: string,
  updates: Partial<ProjectItem>
): Promise<ProjectItem | null> {
  const db = await readyDb();
  const cleanUpdates = { ...updates, updatedAt: new Date().toISOString() };
  delete (cleanUpdates as Partial<ProjectItem> & { id?: string }).id;

  const updated = await db
    .collection<ProjectItem>('projects')
    .findOneAndUpdate(
      { id },
      { $set: cleanUpdates },
      { returnDocument: 'after', projection: { _id: 0 } }
    );
  return updated ?? null;
}

export async function deleteProject(id: string): Promise<boolean> {
  const db = await readyDb();
  const res = await db.collection<ProjectItem>('projects').deleteOne({ id });
  return res.deletedCount > 0;
}

// Products
export async function getProducts(includeInactive = false): Promise<Product[]> {
  const db = await readyDb();
  const filter = includeInactive ? {} : { active: { $ne: false } };
  return db
    .collection<Product>('products')
    .find(filter, { projection: { _id: 0 } })
    .sort({ createdAt: -1, _id: 1 })
    .toArray();
}

export async function getProductById(id: string): Promise<Product | null> {
  const db = await readyDb();
  return db.collection<Product>('products').findOne({ id }, { projection: { _id: 0 } });
}

export async function addProduct(input: Omit<Product, 'id' | 'createdAt'>): Promise<Product> {
  const db = await readyDb();
  const product: Product = {
    ...input,
    id: `prod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    features: Array.isArray(input.features) ? input.features : [],
    createdAt: new Date().toISOString(),
  };
  await db.collection<Product>('products').insertOne({ ...product });
  return product;
}

export async function updateProduct(
  id: string,
  updates: Partial<Product>
): Promise<Product | null> {
  const db = await readyDb();
  const cleanUpdates = { ...updates };
  delete (cleanUpdates as Partial<Product> & { id?: string }).id;

  const updated = await db
    .collection<Product>('products')
    .findOneAndUpdate(
      { id },
      { $set: cleanUpdates },
      { returnDocument: 'after', projection: { _id: 0 } }
    );
  return updated ?? null;
}

export async function deleteProduct(id: string): Promise<boolean> {
  const db = await readyDb();
  const res = await db.collection<Product>('products').deleteOne({ id });
  return res.deletedCount > 0;
}

// Orders
export async function getOrders(): Promise<Order[]> {
  const db = await readyDb();
  return db
    .collection<Order>('orders')
    .find({}, { projection: { _id: 0 } })
    .sort({ createdAt: -1 })
    .toArray();
}

export async function createOrder(input: {
  userId?: string;
  keyHint?: string;
  items: { productId: string; quantity: number }[];
  paymentMethod: string;
  paymentStatus?: PaymentStatus;
  paymentReference?: string;
  customerName: string;
  customerEmail: string;
  notes?: string;
}): Promise<{ order?: Order; error?: string }> {
  const db = await readyDb();
  if (!input.items || input.items.length === 0) {
    return { error: 'Cart is empty.' };
  }

  const prodCol = db.collection<Product>('products');
  const deducted: { productId: string; quantity: number }[] = [];
  const resolvedItems: Order['items'] = [];
  let total = 0;

  const rollbackStock = async () => {
    for (const d of deducted) {
      await prodCol.updateOne({ id: d.productId, stock: { $gte: 0 } }, { $inc: { stock: d.quantity } });
    }
  };

  for (const item of input.items) {
    const prod = await prodCol.findOne(
      { id: item.productId, active: { $ne: false } },
      { projection: { _id: 0 } }
    );
    if (!prod) {
      await rollbackStock();
      return { error: `Product no longer available (${item.productId}).` };
    }

    const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
    if (prod.stock >= 0) {
      const updatedProd = await prodCol.findOneAndUpdate(
        { id: prod.id, active: { $ne: false }, stock: { $gte: qty } },
        { $inc: { stock: -qty } },
        { returnDocument: 'after' }
      );
      if (!updatedProd) {
        await rollbackStock();
        return { error: `Insufficient stock for "${prod.title}" (${prod.stock} left).` };
      }
      deducted.push({ productId: prod.id, quantity: qty });
    }

    resolvedItems.push({
      productId: prod.id,
      title: prod.title,
      price: prod.price,
      quantity: qty,
      type: prod.type,
    });
    total += prod.price * qty;
  }

  const profile = await getProfile();
  const order: Order = {
    id: `ORD-${Math.floor(100000 + Math.random() * 900000)}`,
    ...(input.userId ? { userId: input.userId } : {}),
    ...(input.keyHint ? { keyHint: input.keyHint } : {}),
    items: resolvedItems,
    total: +total.toFixed(2),
    currencySymbol: profile.currencySymbol,
    currencyCode: profile.currencyCode,
    paymentMethod: input.paymentMethod || 'Direct / Invoice',
    ...(input.paymentStatus ? { paymentStatus: input.paymentStatus } : {}),
    ...(input.paymentReference ? { paymentReference: input.paymentReference } : {}),
    customerName: input.customerName.trim(),
    customerEmail: input.customerEmail.trim(),
    notes: input.notes?.trim() || '',
    createdAt: new Date().toISOString(),
    status: 'pending',
  };

  await db.collection<Order>('orders').insertOne({ ...order });
  return { order };
}

export async function getOrdersByUserId(userId: string): Promise<Order[]> {
  const db = await readyDb();
  return db
    .collection<Order>('orders')
    .find({ userId }, { projection: { _id: 0 } })
    .sort({ createdAt: -1 })
    .toArray();
}

export async function getOrderByPaymentReference(reference: string): Promise<Order | null> {
  const db = await readyDb();
  const doc = await db
    .collection<Order>('orders')
    .findOne({ paymentReference: reference }, { projection: { _id: 0 } });
  return doc ?? null;
}

export async function markOrderPaidByReference(
  reference: string
): Promise<{ order: Order | null; newlyPaid: boolean }> {
  const db = await readyDb();
  const col = db.collection<Order>('orders');
  const now = new Date().toISOString();

  const updated = await col.findOneAndUpdate(
    { paymentReference: reference, paymentStatus: { $ne: 'paid' } },
    { $set: { paymentStatus: 'paid', status: 'completed', paidAt: now } },
    { returnDocument: 'after', projection: { _id: 0 } }
  );

  if (updated) {
    return { order: updated, newlyPaid: true };
  }

  const existing = await col.findOne({ paymentReference: reference }, { projection: { _id: 0 } });
  return { order: existing ?? null, newlyPaid: false };
}

export async function rollbackOrderAndStock(orderId: string): Promise<void> {
  const db = await readyDb();
  const ordCol = db.collection<Order>('orders');
  const prodCol = db.collection<Product>('products');

  const existing = await ordCol.findOne({ id: orderId }, { projection: { _id: 0 } });
  if (!existing) return;

  for (const item of existing.items) {
    await prodCol.updateOne(
      { id: item.productId, stock: { $gte: 0 } },
      { $inc: { stock: item.quantity } }
    );
  }
  await ordCol.deleteOne({ id: orderId });
}

export async function updateOrderStatus(
  id: string,
  status?: OrderStatus,
  paymentStatus?: PaymentStatus
): Promise<Order | null> {
  const db = await readyDb();
  const patch: Partial<Order> = {};
  if (status) {
    patch.status = status;
  }
  if (paymentStatus) {
    patch.paymentStatus = paymentStatus;
    if (paymentStatus === 'paid') {
      patch.paidAt = new Date().toISOString();
    }
  }
  if (Object.keys(patch).length === 0) return null;

  const updated = await db
    .collection<Order>('orders')
    .findOneAndUpdate(
      { id },
      { $set: patch },
      { returnDocument: 'after', projection: { _id: 0 } }
    );
  return updated ?? null;
}

export async function deleteOrder(id: string): Promise<boolean> {
  const db = await readyDb();
  const res = await db.collection<Order>('orders').deleteOne({ id });
  return res.deletedCount > 0;
}

// Contact Messages
export async function getMessages(): Promise<ContactMessage[]> {
  const db = await readyDb();
  return db
    .collection<ContactMessage>('messages')
    .find({}, { projection: { _id: 0 } })
    .sort({ createdAt: -1 })
    .toArray();
}

export async function addMessage(
  input: Omit<ContactMessage, 'id' | 'createdAt' | 'read'>
): Promise<ContactMessage> {
  const db = await readyDb();
  const msg: ContactMessage = {
    ...input,
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
    read: false,
  };
  await db.collection<ContactMessage>('messages').insertOne({ ...msg });
  return msg;
}

export async function updateMessage(id: string, read: boolean): Promise<ContactMessage | null> {
  const db = await readyDb();
  const updated = await db
    .collection<ContactMessage>('messages')
    .findOneAndUpdate(
      { id },
      { $set: { read } },
      { returnDocument: 'after', projection: { _id: 0 } }
    );
  return updated ?? null;
}

export async function deleteMessage(id: string): Promise<boolean> {
  const db = await readyDb();
  const res = await db.collection<ContactMessage>('messages').deleteOne({ id });
  return res.deletedCount > 0;
}

// Admin Settings
function normalizeSettings(raw?: Partial<AdminSettings>): AdminSettings {
  const defaults = createInitialStore().settings;
  return {
    masterPin: raw?.masterPin || defaults.masterPin,
    sessionSecret: raw?.sessionSecret || defaults.sessionSecret,
    telegram: {
      ...DEFAULT_TELEGRAM_CONFIG,
      ...(raw?.telegram || {}),
    },
    paystack: {
      ...DEFAULT_PAYSTACK_CONFIG,
      ...(raw?.paystack || {}),
    },
    bankTransfer: {
      ...DEFAULT_BANK_TRANSFER_CONFIG,
      ...(raw?.bankTransfer || {}),
    },
    hosting: {
      ...DEFAULT_HOSTING_CONFIG,
      ...(raw?.hosting || {}),
    },
  };
}

export async function getSettings(): Promise<AdminSettings> {
  const db = await readyDb();
  const doc = await db.collection<MetaDoc<AdminSettings>>('site_meta').findOne({ _id: 'settings' });
  if (doc?.value) return normalizeSettings(doc.value);

  const defaults = createInitialStore().settings;
  await db
    .collection<MetaDoc<AdminSettings>>('site_meta')
    .updateOne({ _id: 'settings' }, { $setOnInsert: { value: defaults } }, { upsert: true });
  return defaults;
}

export async function updateSettings(updates: Partial<AdminSettings>): Promise<AdminSettings> {
  const db = await readyDb();
  const current = await getSettings();
  const next: AdminSettings = normalizeSettings({ ...current, ...updates });
  await db
    .collection<MetaDoc<AdminSettings>>('site_meta')
    .updateOne({ _id: 'settings' }, { $set: { value: next } }, { upsert: true });
  return next;
}

export async function getTelegramConfig(): Promise<TelegramConfig> {
  const settings = await getSettings();
  return {
    ...DEFAULT_TELEGRAM_CONFIG,
    ...(settings.telegram || {}),
  };
}

export async function updateTelegramConfig(
  updates: Partial<TelegramConfig>
): Promise<TelegramConfig> {
  const current = await getTelegramConfig();
  const nextTelegram: TelegramConfig = {
    ...current,
    ...updates,
  };
  await updateSettings({ telegram: nextTelegram });
  return nextTelegram;
}

export async function getPaystackConfig(): Promise<PaystackConfig> {
  const settings = await getSettings();
  return {
    ...DEFAULT_PAYSTACK_CONFIG,
    ...(settings.paystack || {}),
  };
}

export async function updatePaystackConfig(
  updates: Partial<PaystackConfig>
): Promise<PaystackConfig> {
  const current = await getPaystackConfig();
  const nextPaystack: PaystackConfig = {
    ...current,
    ...updates,
  };
  await updateSettings({ paystack: nextPaystack });
  return nextPaystack;
}

export async function getBankTransferConfig(): Promise<BankTransferConfig> {
  const settings = await getSettings();
  return {
    ...DEFAULT_BANK_TRANSFER_CONFIG,
    ...(settings.bankTransfer || {}),
  };
}

export async function updateBankTransferConfig(
  updates: Partial<BankTransferConfig>
): Promise<BankTransferConfig> {
  const current = await getBankTransferConfig();
  const nextBankTransfer: BankTransferConfig = {
    ...current,
    ...updates,
  };
  await updateSettings({ bankTransfer: nextBankTransfer });
  return nextBankTransfer;
}

export async function getHostingConfig(): Promise<HostingConfig> {
  const settings = await getSettings();
  return {
    ...DEFAULT_HOSTING_CONFIG,
    ...(settings.hosting || {}),
  };
}

export async function updateHostingConfig(
  updates: Partial<HostingConfig>
): Promise<HostingConfig> {
  const current = await getHostingConfig();
  const nextHosting: HostingConfig = {
    ...current,
    ...updates,
  };
  await updateSettings({ hosting: nextHosting });
  return nextHosting;
}

// Image Uploads stored in MongoDB (works locally and on serverless hosts)
interface UploadDoc {
  _id: string;
  contentType: string;
  data: Binary;
  createdAt: string;
}

export async function saveUpload(id: string, contentType: string, buffer: Buffer): Promise<void> {
  const db = await readyDb();
  await db.collection<UploadDoc>('uploads').insertOne({
    _id: id,
    contentType,
    data: new Binary(buffer),
    createdAt: new Date().toISOString(),
  });
}

export async function getUploadById(id: string): Promise<StoredUpload | null> {
  const db = await readyDb();
  const doc = await db.collection<UploadDoc>('uploads').findOne({ _id: id });
  if (!doc) return null;
  const rawBuffer = Buffer.isBuffer(doc.data)
    ? doc.data
    : Buffer.from(doc.data.buffer);
  return {
    id: doc._id,
    contentType: doc.contentType,
    data: rawBuffer,
  };
}

// Persistent Live Chats (Visitor cookie/localStorage identity synced with MongoDB)
const CHAT_ID_PATTERN = /^[a-zA-Z0-9_-]{8,80}$/;

export function sanitizeChatId(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return CHAT_ID_PATTERN.test(trimmed) ? trimmed : null;
}

export function generateChatId(): string {
  return `chat-${crypto.randomUUID()}`;
}

async function chatsCollection(db: Db) {
  const col = db.collection<ChatThread>('chats');
  if (!globalThis.__ishChatIndexPromise) {
    globalThis.__ishChatIndexPromise = col
      .createIndex({ id: 1 }, { unique: true })
      .then(() => undefined)
      .catch(err => {
        globalThis.__ishChatIndexPromise = undefined;
        throw err;
      });
  }
  await globalThis.__ishChatIndexPromise;
  return col;
}

export async function getAllChats(): Promise<ChatThread[]> {
  const db = await readyDb();
  const col = await chatsCollection(db);
  return col.find({}, { projection: { _id: 0 } }).sort({ updatedAt: -1 }).toArray();
}

export async function getChatById(chatId: string): Promise<ChatThread | null> {
  const cleanId = sanitizeChatId(chatId);
  if (!cleanId) return null;
  const db = await readyDb();
  const col = await chatsCollection(db);
  return col.findOne({ id: cleanId }, { projection: { _id: 0 } });
}

export async function sendVisitorChatMessage(input: {
  chatId: string;
  visitorName?: string;
  text: string;
  messageId?: string;
}): Promise<ChatThread> {
  const db = await readyDb();
  const col = await chatsCollection(db);
  const now = new Date().toISOString();
  const cleanName = input.visitorName?.trim().slice(0, 60);
  const cleanText = input.text.trim().slice(0, 2000);
  const msgId = sanitizeChatId(input.messageId) || `cmsg-${crypto.randomUUID()}`;

  const existing = await col.findOne({ id: input.chatId }, { projection: { _id: 0 } });
  const newMsg: ChatMessage = {
    id: msgId,
    sender: 'visitor',
    text: cleanText,
    createdAt: now,
  };

  if (!existing) {
    const thread: ChatThread = {
      id: input.chatId,
      visitorName: cleanName || 'Visitor',
      messages: [newMsg],
      unreadByAdmin: true,
      createdAt: now,
      updatedAt: now,
    };
    await col.insertOne({ ...thread });
    return thread;
  }

  if (existing.messages.some(m => m.id === msgId)) {
    return existing;
  }

  const nextName = cleanName || existing.visitorName || 'Visitor';
  const updated = await col.findOneAndUpdate(
    { id: input.chatId },
    {
      $set: {
        visitorName: nextName,
        unreadByAdmin: true,
        updatedAt: now,
      },
      $push: { messages: newMsg },
    },
    { returnDocument: 'after', projection: { _id: 0 } }
  );

  return (
    updated ?? {
      ...existing,
      visitorName: nextName,
      unreadByAdmin: true,
      updatedAt: now,
      messages: [...existing.messages, newMsg],
    }
  );
}

export async function sendAdminChatReply(
  chatId: string,
  text: string
): Promise<ChatThread | null> {
  const cleanId = sanitizeChatId(chatId);
  if (!cleanId) return null;
  const db = await readyDb();
  const col = await chatsCollection(db);
  const now = new Date().toISOString();
  const newMsg: ChatMessage = {
    id: `cmsg-${crypto.randomUUID()}`,
    sender: 'admin',
    text: text.trim().slice(0, 2000),
    createdAt: now,
  };

  const updated = await col.findOneAndUpdate(
    { id: cleanId },
    {
      $set: {
        unreadByAdmin: false,
        updatedAt: now,
      },
      $push: { messages: newMsg },
    },
    { returnDocument: 'after', projection: { _id: 0 } }
  );
  return updated ?? null;
}

export async function markChatRead(
  chatId: string,
  unreadByAdmin: boolean
): Promise<ChatThread | null> {
  const cleanId = sanitizeChatId(chatId);
  if (!cleanId) return null;
  const db = await readyDb();
  const col = await chatsCollection(db);
  const updated = await col.findOneAndUpdate(
    { id: cleanId },
    { $set: { unreadByAdmin } },
    { returnDocument: 'after', projection: { _id: 0 } }
  );
  return updated ?? null;
}

export async function deleteChatThread(chatId: string): Promise<boolean> {
  const cleanId = sanitizeChatId(chatId);
  if (!cleanId) return false;
  const db = await readyDb();
  const col = await chatsCollection(db);
  const res = await col.deleteOne({ id: cleanId });
  return res.deletedCount > 0;
}

// Managed ZIP Hosting (Users with Unique Access Keys, Stored Sessions, Requests, GridFS)
const HOST_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 90; // 90 days

async function ensureHostIndexes(db: Db) {
  if (!globalThis.__ishHostIndexV2Promise) {
    globalThis.__ishHostIndexV2Promise = (async () => {
      await db.collection('host_users').dropIndex('email_1').catch(() => undefined);
      await Promise.all([
        db.collection('host_users').createIndex({ id: 1 }, { unique: true }),
        db.collection('host_users').createIndex({ keyHash: 1 }, { unique: true, sparse: true }),
        db.collection('host_sessions').createIndex({ id: 1 }, { unique: true }),
        db.collection('host_sessions').createIndex({ userId: 1 }),
        db.collection('host_requests').createIndex({ id: 1 }, { unique: true }),
        db.collection('host_requests').createIndex({ userId: 1, updatedAt: -1 }),
        db.collection('host_requests').createIndex({ paymentReference: 1 }, { sparse: true }),
      ]);
    })().catch(err => {
      globalThis.__ishHostIndexV2Promise = undefined;
      throw err;
    });
  }
  await globalThis.__ishHostIndexV2Promise;
}

function toPublicHostUser(user: HostUser): PublicHostUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    keyHint: user.keyHint || '••••',
    createdAt: user.createdAt,
  };
}

export async function createKeyHostUser(input: {
  name?: string;
  email: string;
  keyHash: string;
  keyHint: string;
}): Promise<PublicHostUser> {
  const db = await readyDb();
  await ensureHostIndexes(db);
  const col = db.collection<HostUser>('host_users');

  const user: HostUser = {
    id: `huser-${crypto.randomUUID()}`,
    name: input.name?.trim().slice(0, 80) || 'Host Client',
    email: input.email.trim().toLowerCase(),
    keyHash: input.keyHash,
    keyHint: input.keyHint,
    createdAt: new Date().toISOString(),
  };

  try {
    await col.insertOne({ ...user });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('email_1')) {
      await col.dropIndex('email_1').catch(() => undefined);
      await col.insertOne({ ...user });
    } else {
      throw err;
    }
  }
  return toPublicHostUser(user);
}

export async function findHostUserByKeyHash(keyHash: string): Promise<PublicHostUser | null> {
  const db = await readyDb();
  await ensureHostIndexes(db);
  const doc = await db
    .collection<HostUser>('host_users')
    .findOne({ keyHash }, { projection: { _id: 0 } });
  return doc ? toPublicHostUser(doc) : null;
}

export async function getHostUserById(userId: string): Promise<PublicHostUser | null> {
  const db = await readyDb();
  await ensureHostIndexes(db);
  const doc = await db
    .collection<HostUser>('host_users')
    .findOne({ id: userId }, { projection: { _id: 0 } });
  return doc ? toPublicHostUser(doc) : null;
}

export async function createHostSession(userId: string): Promise<HostSessionDoc> {
  const db = await readyDb();
  await ensureHostIndexes(db);
  const now = Date.now();
  const session: HostSessionDoc = {
    id: `hsess-${crypto.randomUUID()}`,
    userId,
    createdAt: new Date(now).toISOString(),
    lastUsedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + HOST_SESSION_TTL_MS).toISOString(),
  };
  await db.collection<HostSessionDoc>('host_sessions').insertOne({ ...session });
  return session;
}

export async function getValidHostSession(
  sessionId: string
): Promise<{ session: HostSessionDoc; user: PublicHostUser } | null> {
  const db = await readyDb();
  await ensureHostIndexes(db);
  const sessCol = db.collection<HostSessionDoc>('host_sessions');
  const session = await sessCol.findOne({ id: sessionId }, { projection: { _id: 0 } });
  if (!session) return null;

  const now = Date.now();
  if (new Date(session.expiresAt).getTime() <= now) {
    await sessCol.deleteOne({ id: sessionId });
    return null;
  }

  const user = await getHostUserById(session.userId);
  if (!user) {
    await sessCol.deleteOne({ id: sessionId });
    return null;
  }

  // Sliding renewal when lastUsedAt is over 1 hour old so users stay logged in
  const lastUsedMs = new Date(session.lastUsedAt).getTime();
  if (now - lastUsedMs > 60 * 60 * 1000) {
    const nextIso = new Date(now).toISOString();
    const nextExpiry = new Date(now + HOST_SESSION_TTL_MS).toISOString();
    await sessCol.updateOne(
      { id: sessionId },
      { $set: { lastUsedAt: nextIso, expiresAt: nextExpiry } }
    );
    session.lastUsedAt = nextIso;
    session.expiresAt = nextExpiry;
  }

  return { session, user };
}

export async function deleteHostSession(sessionId: string): Promise<void> {
  const db = await readyDb();
  await ensureHostIndexes(db);
  await db.collection<HostSessionDoc>('host_sessions').deleteOne({ id: sessionId });
}

export async function createHostingRequest(input: {
  user: PublicHostUser;
  projectName: string;
  notes?: string;
  includeRedirect?: boolean;
  redirectTargetUrl?: string;
  paymentMethod?: string;
  transferProof?: string;
  paymentReference: string;
}): Promise<HostingRequest> {
  const db = await readyDb();
  await ensureHostIndexes(db);
  const cfg = await getHostingConfig();
  const now = new Date().toISOString();

  const baseAmount = Number(cfg.price) || 50000;
  const configuredRedirectFee = Number(cfg.redirectFee ?? 15000);
  const redirectAddon = Boolean(input.includeRedirect);
  const redirectFee = redirectAddon ? Math.max(0, configuredRedirectFee) : 0;
  const totalAmount = baseAmount + redirectFee;

  const req: HostingRequest = {
    id: `HOST-${Math.floor(100000 + Math.random() * 900000)}`,
    userId: input.user.id,
    userName: input.user.name,
    userEmail: input.user.email,
    projectName: input.projectName.trim().slice(0, 120) || 'Hosted Project',
    notes: input.notes?.trim().slice(0, 1000) || '',
    amount: totalAmount,
    currencyCode: cfg.currencyCode || 'NGN',
    currencySymbol: cfg.currencySymbol || '₦',
    redirectAddon,
    redirectFee,
    ...(redirectAddon && input.redirectTargetUrl?.trim()
      ? { redirectTargetUrl: input.redirectTargetUrl.trim().slice(0, 300) }
      : {}),
    ...(input.paymentMethod ? { paymentMethod: input.paymentMethod.trim().slice(0, 60) } : {}),
    ...(input.transferProof ? { transferProof: input.transferProof.trim().slice(0, 200) } : {}),
    paymentStatus: 'pending',
    paymentReference: input.paymentReference,
    hostingStatus: 'awaiting_payment',
    createdAt: now,
    updatedAt: now,
  };

  await db.collection<HostingRequest>('host_requests').insertOne({ ...req });
  return req;
}

export async function getHostingRequestsByUserId(userId: string): Promise<HostingRequest[]> {
  const db = await readyDb();
  await ensureHostIndexes(db);
  return db
    .collection<HostingRequest>('host_requests')
    .find({ userId }, { projection: { _id: 0 } })
    .sort({ updatedAt: -1 })
    .toArray();
}

export async function getAllHostingRequests(): Promise<HostingRequest[]> {
  const db = await readyDb();
  await ensureHostIndexes(db);
  return db
    .collection<HostingRequest>('host_requests')
    .find({}, { projection: { _id: 0 } })
    .sort({ updatedAt: -1 })
    .toArray();
}

export async function getHostingRequestById(id: string): Promise<HostingRequest | null> {
  const db = await readyDb();
  await ensureHostIndexes(db);
  const doc = await db
    .collection<HostingRequest>('host_requests')
    .findOne({ id }, { projection: { _id: 0 } });
  return doc ?? null;
}

export async function getHostingRequestByPaymentReference(
  reference: string
): Promise<HostingRequest | null> {
  const db = await readyDb();
  await ensureHostIndexes(db);
  const doc = await db
    .collection<HostingRequest>('host_requests')
    .findOne({ paymentReference: reference }, { projection: { _id: 0 } });
  return doc ?? null;
}

export async function markHostingPaidByReference(
  reference: string
): Promise<{ request: HostingRequest | null; newlyPaid: boolean }> {
  const db = await readyDb();
  await ensureHostIndexes(db);
  const col = db.collection<HostingRequest>('host_requests');
  const now = new Date().toISOString();

  const updated = await col.findOneAndUpdate(
    { paymentReference: reference, paymentStatus: { $ne: 'paid' } },
    {
      $set: {
        paymentStatus: 'paid',
        hostingStatus: 'awaiting_upload',
        paidAt: now,
        updatedAt: now,
      },
    },
    { returnDocument: 'after', projection: { _id: 0 } }
  );

  if (updated) {
    return { request: updated, newlyPaid: true };
  }

  const existing = await col.findOne(
    { paymentReference: reference },
    { projection: { _id: 0 } }
  );
  return { request: existing ?? null, newlyPaid: false };
}

export async function rollbackHostingRequest(id: string): Promise<void> {
  const db = await readyDb();
  await ensureHostIndexes(db);
  await db.collection<HostingRequest>('host_requests').deleteOne({ id, paymentStatus: { $ne: 'paid' } });
}

export async function attachHostingZipUpload(input: {
  requestId: string;
  userId: string;
  fileBuffer: Buffer;
  fileName: string;
  projectName?: string;
  notes?: string;
}): Promise<{ request?: HostingRequest; error?: string }> {
  const db = await readyDb();
  await ensureHostIndexes(db);
  const col = db.collection<HostingRequest>('host_requests');

  const existing = await col.findOne({ id: input.requestId }, { projection: { _id: 0 } });
  if (!existing || existing.userId !== input.userId) {
    return { error: 'Hosting slot not found.' };
  }

  if (existing.paymentStatus !== 'paid') {
    return { error: 'Please complete payment before uploading your ZIP folder.' };
  }

  if (existing.hostingStatus === 'live') {
    return { error: 'This hosting slot is already live. Create a new paid slot to upload another project.' };
  }

  const bucket = new GridFSBucket(db, { bucketName: 'host_zips' });

  // Clean up previous ZIP file if user re-uploads before going live
  if (existing.zipFileId) {
    try {
      await bucket.delete(new ObjectId(existing.zipFileId));
    } catch {
      // Ignore missing previous GridFS entry
    }
  }

  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, '_') || 'project.zip';
  const uploadId = await new Promise<string>((resolve, reject) => {
    const stream = bucket.openUploadStream(safeName, {
      metadata: {
        requestId: input.requestId,
        userId: input.userId,
      },
    });
    stream.on('error', reject);
    stream.on('finish', () => resolve(stream.id.toString()));
    stream.end(input.fileBuffer);
  });

  const now = new Date().toISOString();
  const nextProjectName = input.projectName?.trim().slice(0, 120) || existing.projectName;
  const nextNotes =
    typeof input.notes === 'string' ? input.notes.trim().slice(0, 1000) : existing.notes;

  const updated = await col.findOneAndUpdate(
    { id: input.requestId, userId: input.userId },
    {
      $set: {
        projectName: nextProjectName,
        notes: nextNotes,
        zipFileId: uploadId,
        zipFileName: safeName,
        zipSizeBytes: input.fileBuffer.length,
        hostingStatus: 'submitted',
        uploadedAt: now,
        updatedAt: now,
      },
    },
    { returnDocument: 'after', projection: { _id: 0 } }
  );

  if (!updated) {
    return { error: 'Could not update hosting request.' };
  }

  return { request: updated };
}

export async function getHostingZipDownload(
  requestId: string
): Promise<{ fileName: string; buffer: Buffer } | null> {
  const db = await readyDb();
  const reqDoc = await getHostingRequestById(requestId);
  if (!reqDoc?.zipFileId) return null;

  const bucket = new GridFSBucket(db, { bucketName: 'host_zips' });
  const fileObjectId = new ObjectId(reqDoc.zipFileId);

  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    const stream = bucket.openDownloadStream(fileObjectId);
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve());
  });

  return {
    fileName: reqDoc.zipFileName || `${reqDoc.id}.zip`,
    buffer: Buffer.concat(chunks),
  };
}

export async function updateHostingRequestAdmin(
  requestId: string,
  updates: {
    hostingStatus?: HostingStatus;
    paymentStatus?: PaymentStatus;
    liveUrl?: string;
    adminNotes?: string;
  }
): Promise<HostingRequest | null> {
  const db = await readyDb();
  await ensureHostIndexes(db);
  const col = db.collection<HostingRequest>('host_requests');
  const existing = await getHostingRequestById(requestId);
  if (!existing) return null;

  const patch: Partial<HostingRequest> = {
    updatedAt: new Date().toISOString(),
  };

  if (updates.paymentStatus) {
    patch.paymentStatus = updates.paymentStatus;
    if (updates.paymentStatus === 'paid') {
      patch.paidAt = existing.paidAt || new Date().toISOString();
      if (!updates.hostingStatus && existing.hostingStatus === 'awaiting_payment') {
        patch.hostingStatus = existing.zipFileId ? 'submitted' : 'awaiting_upload';
      }
    }
  }

  if (updates.hostingStatus) {
    patch.hostingStatus = updates.hostingStatus;
  }
  if (typeof updates.liveUrl === 'string') {
    patch.liveUrl = updates.liveUrl.trim();
    if (patch.liveUrl && !updates.hostingStatus) {
      patch.hostingStatus = 'live';
    }
  }
  if (typeof updates.adminNotes === 'string') {
    patch.adminNotes = updates.adminNotes.trim().slice(0, 1000);
  }

  const updated = await col.findOneAndUpdate(
    { id: requestId },
    { $set: patch },
    { returnDocument: 'after', projection: { _id: 0 } }
  );
  return updated ?? null;
}

export async function deleteHostingRequest(requestId: string): Promise<boolean> {
  const db = await readyDb();
  await ensureHostIndexes(db);
  const existing = await getHostingRequestById(requestId);
  if (!existing) return false;

  if (existing.zipFileId) {
    try {
      const bucket = new GridFSBucket(db, { bucketName: 'host_zips' });
      await bucket.delete(new ObjectId(existing.zipFileId));
    } catch {
      // Ignore GridFS delete failure if already removed
    }
  }

  const res = await db.collection<HostingRequest>('host_requests').deleteOne({ id: requestId });
  return res.deletedCount > 0;
}
