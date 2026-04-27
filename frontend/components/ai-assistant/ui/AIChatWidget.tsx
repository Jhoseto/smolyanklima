/**
 * AI Chat Widget
 * World-class conversational UI for HVAC assistance
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { X, Send, MessageCircle, ChevronDown, ChevronUp, Mic, Paperclip, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAIChat } from '../hooks/useAIChat';
import { useCrossTabSync } from '../hooks/useCrossTabSync';
import type { Message, QuickReply, TypingIndicator } from '../types';
import { ChatMessage } from './ChatMessage';
import { QuickReplyButtons } from './QuickReplyButtons';
import { TypingIndicator as TypingIndicatorComponent } from './TypingIndicator';
import { ProductCard } from './ProductCard';

export interface AIChatWidgetProps {
  apiKey: string;
  position?: 'bottom-right' | 'bottom-left' | 'bottom-center';
  primaryColor?: string;
  accentColor?: string;
  welcomeMessage?: string;
  enableVoiceInput?: boolean;
}

const DEFAULT_COLORS = {
  primary: '#00B4D8', // smolyan-klima cyan
  accent: '#FF4D00',  // smolyan-klima orange
};

const QUICK_REPLIES: QuickReply[] = [
  { id: '1', label: 'Търся климатик', action: 'product_search', icon: 'search' },
  { id: '2', label: 'Искам оферта', action: 'quote_request', icon: 'dollar' },
  { id: '3', label: 'Сравни модели', action: 'compare_products', icon: 'scale' },
  { id: '4', label: 'Имам проблем', action: 'technical_support', icon: 'wrench' },
];

export const AIChatWidget: React.FC<AIChatWidgetProps> = ({
  apiKey,
  position = 'bottom-right',
  primaryColor = DEFAULT_COLORS.primary,
  accentColor = DEFAULT_COLORS.accent,
  welcomeMessage,
  enableVoiceInput = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const [typingIndicator, setTypingIndicator] = useState<TypingIndicator | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const widgetRef = useRef<HTMLDivElement>(null);

  // Initialize AI Chat hook
  const {
    messages,
    isLoading,
    error,
    sendMessage,
    resetConversation,
    conversation,
    suggestedProducts,
    actions,
  } = useAIChat({ apiKey });

  // Cross-tab synchronization
  const { syncState, lastSyncMessage } = useCrossTabSync({
    conversationId: conversation?.id || null,
    onExternalMessage: (message) => {
      // Show notification when message arrives from another tab
      if (!isOpen) {
        setUnreadCount((prev) => prev + 1);
      }
    },
  });

  // Check if mobile on mount
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingIndicator]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setUnreadCount(0);
    }
  }, [isOpen]);

  // Handle typing indicator
  useEffect(() => {
    if (isLoading) {
      setTypingIndicator({
        visible: true,
        text: 'Асистентът пише...',
        dots: '...',
      });
    } else {
      setTypingIndicator(null);
    }
  }, [isLoading]);

  // Handle quick reply click
  const handleQuickReply = useCallback((reply: QuickReply) => {
    setShowQuickReplies(false);
    sendMessage(reply.label);
  }, [sendMessage]);

  // Handle send message
  const handleSendMessage = useCallback(() => {
    if (!inputMessage.trim()) return;
    
    sendMessage(inputMessage);
    setInputMessage('');
    setShowQuickReplies(false);
  }, [inputMessage, sendMessage]);

  // Handle key press
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
    
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }, [handleSendMessage]);

  // Handle voice input
  const handleVoiceInput = useCallback(() => {
    if (!('webkitSpeechRecognition' in window)) {
      alert('Гласовото въвеждане не се поддържа от този браузър');
      return;
    }

    const recognition = new (window as unknown as { webkitSpeechRecognition: new () => SpeechRecognition }).webkitSpeechRecognition();
    recognition.lang = 'bg-BG';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      setInputMessage(transcript);
    };

    recognition.start();
  }, []);

  // Get position styles
  const getPositionStyles = () => {
    switch (position) {
      case 'bottom-left':
        return { left: 20, right: 'auto' };
      case 'bottom-center':
        return { left: '50%', transform: 'translateX(-50%)' };
      case 'bottom-right':
      default:
        return { right: 20, left: 'auto' };
    }
  };

  // Get widget dimensions based on device
  const getWidgetDimensions = () => {
    if (isMobile) {
      return {
        width: '100vw',
        height: '80vh',
        maxWidth: '100%',
        borderRadius: '20px 20px 0 0',
      };
    }
    
    return {
      width: 380,
      height: 600,
      maxWidth: 'calc(100vw - 40px)',
      borderRadius: 16,
    };
  };

  const positionStyles = getPositionStyles();
  const dimensions = getWidgetDimensions();

  // Toggle chat
  const toggleChat = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  // Get first message (welcome or from conversation)
  const displayMessages = messages.length === 0 && welcomeMessage
    ? [{ id: 'welcome', role: 'assistant', content: welcomeMessage, timestamp: Date.now() } as Message]
    : messages;

  return (
    <div
      ref={widgetRef}
      style={{
        position: 'fixed',
        bottom: 20,
        zIndex: 9999,
        ...positionStyles,
      }}
    >
      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            style={{
              width: dimensions.width,
              height: dimensions.height,
              maxWidth: dimensions.maxWidth,
              backgroundColor: '#ffffff',
              borderRadius: dimensions.borderRadius,
              boxShadow: '0 24px 70px rgba(15, 23, 42, 0.18), 0 2px 8px rgba(15, 23, 42, 0.06)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              marginBottom: 16,
              border: '1px solid rgba(226, 232, 240, 0.8)',
            }}
          >
            {/* Header */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              style={{
                background: '#ffffff',
                padding: '16px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: '#0f172a',
                borderBottom: '1px solid #f1f5f9',
                position: 'relative',
              }}
            >
              {/* Brand accent bar - split: cyan + orange */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 3,
                  display: 'flex',
                }}
              >
                <span style={{ flex: 1, backgroundColor: primaryColor }} />
                <span style={{ flex: 1, backgroundColor: accentColor }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: '50%',
                    backgroundColor: primaryColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    boxShadow: `0 6px 16px ${primaryColor}33`,
                    position: 'relative',
                  }}
                >
                  <Bot size={20} strokeWidth={1.75} />
                  {/* Online dot on avatar */}
                  <span
                    style={{
                      position: 'absolute',
                      bottom: -1,
                      right: -1,
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      backgroundColor: '#22c55e',
                      border: '2px solid white',
                    }}
                  />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em' }}>Вашият асистент</div>
                  <div style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                    <span style={{ color: '#22c55e', fontWeight: 600 }}>• На линия</span>
                    <span style={{ color: '#cbd5e1' }}>|</span>
                    <span>Отговаря веднага</span>
                  </div>
                </div>
              </div>

              <button
                onClick={toggleChat}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: 8,
                  borderRadius: 10,
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#fef2f2';
                  e.currentTarget.style.borderColor = '#fecaca';
                  e.currentTarget.style.color = '#ef4444';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8fafc';
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.color = '#64748b';
                }}
              >
                <X size={18} />
              </button>
            </motion.div>

            {/* Messages Area */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px 18px',
                background: 'linear-gradient(180deg, #fafbfc 0%, #f1f5f9 100%)',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              {displayMessages.map((message, index) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <ChatMessage
                    message={message}
                    primaryColor={primaryColor}
                    accentColor={accentColor}
                  />
                </motion.div>
              ))}

              {/* Typing Indicator */}
              {typingIndicator?.visible && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <TypingIndicatorComponent
                    text={typingIndicator.text}
                    primaryColor={primaryColor}
                  />
                </motion.div>
              )}

              {/* Suggested Products */}
              {suggestedProducts.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ marginTop: 8 }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      color: '#64748b',
                      marginBottom: 8,
                      fontWeight: 500,
                    }}
                  >
                    Препоръчани продукти:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {suggestedProducts.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        primaryColor={primaryColor}
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Quick Replies */}
              {showQuickReplies && messages.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: '#94a3b8',
                      marginBottom: 10,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}
                  >
                    Бързи опции
                  </div>
                  <QuickReplyButtons
                    replies={QUICK_REPLIES}
                    onReplyClick={handleQuickReply}
                    primaryColor={primaryColor}
                    accentColor={accentColor}
                  />
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{
                  backgroundColor: '#fee2e2',
                  color: '#dc2626',
                  padding: '12px 16px',
                  fontSize: 13,
                  borderTop: '1px solid #fecaca',
                }}
              >
                {error}
              </motion.div>
            )}

            {/* Input Area */}
            <div
              style={{
                padding: '14px 16px 16px',
                backgroundColor: '#ffffff',
                borderTop: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              {enableVoiceInput && (
                <button
                  onClick={handleVoiceInput}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    color: '#64748b',
                    cursor: 'pointer',
                    padding: 0,
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = `${primaryColor}10`;
                    e.currentTarget.style.borderColor = primaryColor;
                    e.currentTarget.style.color = primaryColor;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#f8fafc';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.color = '#64748b';
                  }}
                  title="Гласово въвеждане"
                >
                  <Mic size={18} />
                </button>
              )}

              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Напишете съобщение..."
                style={{
                  flex: 1,
                  border: '1.5px solid #e2e8f0',
                  borderRadius: 999,
                  padding: '11px 18px',
                  fontSize: 14,
                  outline: 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  backgroundColor: '#fafbfc',
                  color: '#0f172a',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = primaryColor;
                  e.target.style.boxShadow = `0 0 0 4px ${primaryColor}1f`;
                  e.target.style.backgroundColor = '#ffffff';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e2e8f0';
                  e.target.style.boxShadow = 'none';
                  e.target.style.backgroundColor = '#fafbfc';
                }}
              />

              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isLoading}
                style={{
                  backgroundColor: inputMessage.trim() ? accentColor : '#e2e8f0',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  width: 42,
                  height: 42,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: inputMessage.trim() ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s',
                  boxShadow: inputMessage.trim() ? `0 6px 16px ${accentColor}40` : 'none',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  if (inputMessage.trim()) e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <Send size={17} strokeWidth={1.75} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Button */}
      <motion.button
        onClick={toggleChat}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        style={{
          backgroundColor: accentColor,
          color: 'white',
          border: 'none',
          borderRadius: '50%',
          width: 58,
          height: 58,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: `0 12px 30px ${accentColor}55, 0 4px 10px rgba(15, 23, 42, 0.15)`,
          position: 'relative',
        }}
      >
        {/* Pulse ring */}
        {!isOpen && (
          <motion.span
            animate={{ scale: [1, 1.4], opacity: [0.5, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: `2px solid ${accentColor}`,
              pointerEvents: 'none',
            }}
          />
        )}
        {isOpen ? <ChevronDown size={24} strokeWidth={1.75} /> : <MessageCircle size={24} strokeWidth={1.75} />}

        {/* Unread Badge */}
        {unreadCount > 0 && !isOpen && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              backgroundColor: '#ef4444',
              color: 'white',
              fontSize: 12,
              fontWeight: 600,
              width: 22,
              height: 22,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid white',
            }}
          >
            {unreadCount}
          </motion.span>
        )}
      </motion.button>
    </div>
  );
};

export default AIChatWidget;
