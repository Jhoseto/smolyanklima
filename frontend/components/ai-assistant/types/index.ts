/**
 * AI Assistant Types
 * World-class type definitions for the HVAC AI Assistant
 */

// ============================================================================
// Core Types
// ============================================================================

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  emotion?: EmotionType;
  products?: Product[];
  actions?: AIAction[];
  intent?: string;
  confidence?: number;
  processingTime?: number;
}

export interface Conversation {
  id: string;
  messages: Message[];
  context: ConversationContext;
  lastMessageAt?: number;
  createdAt: number;
  updatedAt: number;
  metadata: ConversationMetadata;
}

export interface ConversationContext {
  userIntent?: UserIntent;
  lastProductViewed?: string;
  cartItems?: string[];
  userPreferences?: UserPreferences;
  emotionalState?: EmotionType;
  conversationStage: ConversationStage;
}

export interface ConversationMetadata {
  messageCount: number;
  userSatisfaction?: number;
  convertedToQuote: boolean;
  convertedToPurchase: boolean;
  peakEmotion?: EmotionType;
}

// ============================================================================
// User & Context Types
// ============================================================================

export interface UserPreferences {
  budget?: number;
  roomType?: RoomType;
  squareMeters?: number;
  brandPreference?: string;
  priority?: 'price' | 'quality' | 'energy' | 'quiet';
  timeline?: 'urgent' | 'soon' | 'planning';
}

export type RoomType = 'bedroom' | 'living' | 'kids' | 'office' | 'kitchen' | 'other';

export type ConversationStage = 
  | 'greeting'
  | 'discovery'
  | 'recommendation'
  | 'comparison'
  | 'objection_handling'
  | 'quote_generation'
  | 'closing'
  | 'follow_up';

// ============================================================================
// Emotion & Personality Types
// ============================================================================

export type EmotionType = 
  | 'neutral'
  | 'happy'
  | 'confused'
  | 'frustrated'
  | 'skeptical'
  | 'stressed'
  | 'excited'
  | 'urgent';

export interface EmotionConfig {
  type: EmotionType;
  keywords: string[];
  responseStrategy: ResponseStrategy;
  toneModifier: ToneModifier;
}

export type ResponseStrategy = 
  | 'empathize_first'
  | 'educate_gently'
  | 'provide_urgency'
  | 'build_rapport'
  | 'offer_alternatives';

export type ToneModifier = 
  | 'warmer'
  | 'more_formal'
  | 'more_casual'
  | 'more_urgent'
  | 'more_detailed';

// ============================================================================
// Intent & Skill Types
// ============================================================================

export interface UserIntent {
  type: IntentType;
  confidence: number;
  entities: IntentEntity[];
  rawQuery: string;
}

export type IntentType =
  | 'product_search'
  | 'product_comparison'
  | 'compare'
  | 'price_inquiry'
  | 'quote_request'
  | 'technical_support'
  | 'installation_info'
  | 'warranty_info'
  | 'objection_price'
  | 'objection_timing'
  | 'objection_competitor'
  | 'objection_quality'
  | 'general_chat'
  | 'gratitude'
  | 'complaint'
  | 'complex_request'
  | 'human_requested';

export interface IntentEntity {
  type: string;
  value: string;
  confidence: number;
}

export interface Skill {
  name: string;
  description: string;
  triggers: IntentType[];
  priority: number;
  execute(context: SkillContext): Promise<SkillResult>;
}

export interface SkillContext {
  intent: UserIntent;
  conversation: Conversation;
  products: Product[];
  query?: string;
  userContext: UserContext;
}

export interface SkillResult {
  success: boolean;
  response: string;
  actions?: AIAction[];
  products?: Product[];
  recommendedProducts?: Product[];
  confidence: number;
}

export interface AIAction {
  type: ActionType;
  payload: Record<string, unknown>;
  label: string;
}

export type ActionType =
  | 'show_products'
  | 'show_comparison'
  | 'generate_quote'
  | 'schedule_call'
  | 'send_email'
  | 'add_to_cart'
  | 'view_product'
  | 'contact_human';

// ============================================================================
// Product Types
// ============================================================================

export interface Product {
  id: string;
  name: string;
  brand: string;
  model: string;
  price: number;
  oldPrice?: number;
  image: string;
  description?: string;
  specs: ProductSpecs;
  features: string[];
  inStock: boolean;
  stockCount?: number;
  rating: number;
  reviewCount: number;
  energyClass: string;
  installationPrice?: number;
  warranty: WarrantyInfo;
  suitableFor: RoomType[];
  popularityScore: number;
  embedding?: number[];
}

export interface ProductSpecs {
  power: string;
  coolingCapacity: number;
  heatingCapacity: number;
  noiseLevel: number;
  energyEfficiency: number;
  seer: number;
  coverage: number;
}

export interface WarrantyInfo {
  years: number;
  compressor: number;
  parts: number;
  labor: number;
}

// ============================================================================
// RAG & Vector Search Types
// ============================================================================

export interface VectorSearchResult {
  product: Product;
  score: number;
  matchedTerms: string[];
}

export interface SemanticQuery {
  text: string;
  embedding: number[];
  filters?: ProductFilters;
}

export interface ProductFilters {
  brand?: string[];
  priceRange?: [number, number];
  energyClass?: string[];
  inStock?: boolean;
  roomType?: RoomType;
}

// ============================================================================
// Hallucination Guard Types
// ============================================================================

export interface FactCheckResult {
  isValid: boolean;
  violations: FactViolation[];
  correctedContent?: string;
  confidence: number;
}

export interface FactViolation {
  type: 'price_mismatch' | 'product_not_found' | 'warranty_incorrect' | 'feature_invented';
  field: string;
  claimed: string;
  actual: string;
  severity: 'error' | 'warning';
}

// ============================================================================
// Security & Privacy Types
// ============================================================================

export interface SecurityConfig {
  rateLimits: RateLimits;
  xssProtection: XSSConfig;
  apiKeyRotation: string;
}

export interface RateLimits {
  maxConversationsPerDay: number;
  maxMessagesPerHour: number;
  maxMessagesPerDay: number;
  maxTokensPerConversation: number;
}

export interface XSSConfig {
  sanitizeInput: boolean;
  escapeOutput: boolean;
  allowedTags: string[];
  maxMessageLength: number;
}

export interface PrivacyConsent {
  given: boolean;
  timestamp: number;
  version: string;
  analytics?: boolean;
  storage?: boolean;
  marketing?: boolean;
  dataTypes: string[];
}

// ============================================================================
// Analytics Types
// ============================================================================

export interface AnalyticsEvent {
  type: AnalyticsEventType;
  timestamp: number;
  conversationId: string;
  metadata: Record<string, unknown>;
}

export type AnalyticsEventType =
  | 'chat_opened'
  | 'message_sent'
  | 'message_received'
  | 'product_viewed'
  | 'product_search'
  | 'product_comparison'
  | 'quote_generated'
  | 'conversion_quote'
  | 'conversion_purchase'
  | 'error_occurred'
  | 'human_handoff';

export interface ConversationMetrics {
  conversationId: string;
  duration: number;
  messageCount: number;
  userSatisfaction?: number;
  conversionFunnel: ConversionFunnel;
  emotionalJourney: EmotionType[];
}

export interface ConversionFunnel {
  chatOpened: boolean;
  productViewed: boolean;
  quoteRequested: boolean;
  quoteGenerated: boolean;
  purchaseCompleted: boolean;
}

// ============================================================================
// UI Types
// ============================================================================

export interface ChatWidgetConfig {
  position: 'bottom-right' | 'bottom-left' | 'bottom-center';
  primaryColor: string;
  accentColor: string;
  avatarUrl?: string;
  welcomeMessage: string;
  quickReplies: string[];
  showTypingIndicator: boolean;
  enableSound: boolean;
  enableAnimations: boolean;
}

export interface QuickReply {
  id: string;
  label: string;
  action: string;
  icon?: string;
}

export interface TypingIndicator {
  visible: boolean;
  text: string;
  dots: string;
}

// ============================================================================
// User Context Types
// ============================================================================

export interface UserContext {
  sessionId: string;
  visitCount: number;
  firstVisit: number;
  lastVisit: number;
  viewedProducts: string[];
  searchHistory: string[];
  preferences: UserPreferences;
  consent: PrivacyConsent;
  device: DeviceInfo;
}

export interface DeviceInfo {
  type: 'desktop' | 'tablet' | 'mobile';
  viewport: { width: number; height: number };
  touch: boolean;
  language: string;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface GeminiResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: string;
  model: string;
}

export interface APIError {
  code: string;
  message: string;
  type: 'rate_limit' | 'invalid_request' | 'server_error' | 'network_error';
  retryable: boolean;
}

// ============================================================================
// Cross-Tab Sync Types
// ============================================================================

/** Пълно състояние за синхрон между табове (без сървър). */
export interface ChatRemotePayload {
  messages: Message[];
  conversation: Conversation;
  savedAt: number;
  writerTabId: string;
}

export interface CrossTabMessage {
  type: 'CHAT_STATE_UPDATE' | 'CONVERSATION_SYNC' | 'USER_CONTEXT_UPDATE' | 'FULL_STATE_SYNC';
  conversationId: string;
  payload: unknown;
  timestamp: number;
  tabId: string;
}

// ============================================================================
// Performance Types
// ============================================================================

export interface PerformanceMetrics {
  loadTime: number;
  timeToFirstMessage: number;
  avgResponseTime: number;
  bundleSize: number;
  memoryUsage: number;
}

// ============================================================================
// Hook Types
// ============================================================================

export interface UseAIChatOptions {
  apiKey: string;
  userContext?: UserContext;
}

export interface UseAIChatReturn {
  messages: Message[];
  conversation: Conversation | null;
  isLoading: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  resetConversation: () => void;
  suggestedProducts: Product[];
  actions: AIAction[];
}

// ============================================================================
// Web Speech API Types
// ============================================================================

export interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
  start(): void;
  stop(): void;
  abort(): void;
}

export interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

export interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

export interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

export interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

export interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

// ============================================================================
// Export all types
// ============================================================================

// Types are already exported above with 'export interface/type'
// No need for re-export declarations
