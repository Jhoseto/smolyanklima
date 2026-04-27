/**
 * Chat Message Component
 * Individual message bubble with styling
 */

import React from 'react';
import { Bot, User, Clock, Check, CheckCheck } from 'lucide-react';
import { format } from 'date-fns';
import { bg } from 'date-fns/locale';
import type { Message } from '../types';

interface ChatMessageProps {
  message: Message;
  primaryColor: string;
  accentColor?: string;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  primaryColor,
  accentColor = '#FF4D00',
}) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  // Format timestamp
  const formattedTime = format(message.timestamp, 'HH:mm', { locale: bg });

  // Render system messages differently
  if (isSystem) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          margin: '12px 0',
        }}
      >
        <span
          style={{
            backgroundColor: '#f1f5f9',
            color: '#64748b',
            padding: '6px 12px',
            borderRadius: 12,
            fontSize: 12,
            fontStyle: 'italic',
          }}
        >
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        alignItems: 'flex-start',
        gap: 8,
        maxWidth: '100%',
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          backgroundColor: isUser ? '#e2e8f0' : primaryColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: isUser ? '#475569' : 'white',
          boxShadow: isUser ? 'none' : `0 4px 10px ${primaryColor}33`,
        }}
      >
        {isUser ? <User size={14} strokeWidth={1.75} /> : <Bot size={15} strokeWidth={1.75} />}
      </div>

      {/* Message Content */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: isUser ? 'flex-end' : 'flex-start',
          maxWidth: 'calc(100% - 46px)',
        }}
      >
        {/* Bubble */}
        <div
          style={{
            backgroundColor: isUser ? accentColor : '#ffffff',
            color: isUser ? 'white' : '#0f172a',
            padding: '11px 15px',
            borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
            boxShadow: isUser
              ? `0 6px 16px ${accentColor}30`
              : '0 1px 2px rgba(15, 23, 42, 0.06)',
            fontSize: 14,
            lineHeight: 1.5,
            wordBreak: 'break-word',
            border: isUser ? 'none' : '1px solid #e2e8f0',
            whiteSpace: 'pre-wrap',
          }}
        >
          {message.content}
        </div>

        {/* Timestamp & Status */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            marginTop: 5,
            marginLeft: isUser ? 0 : 4,
            marginRight: isUser ? 4 : 0,
            fontSize: 11,
            color: '#94a3b8',
          }}
        >
          <Clock size={10} />
          <span>{formattedTime}</span>

          {/* Read receipts for user messages */}
          {isUser && (
            <>
              <span style={{ marginLeft: 2 }}>·</span>
              <CheckCheck size={12} color={accentColor} />
            </>
          )}
        </div>

        {/* Metadata (products, actions) */}
        {message.metadata?.products && message.metadata.products.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {/* Product cards would be rendered here */}
          </div>
        )}

        {message.metadata?.actions && message.metadata.actions.length > 0 && (
          <div
            style={{
              display: 'flex',
              gap: 8,
              marginTop: 8,
              flexWrap: 'wrap',
            }}
          >
            {message.metadata.actions.map((action, idx) => (
              <button
                key={idx}
                onClick={() => {
                  // Handle action click
                  console.log('Action clicked:', action);
                }}
                style={{
                  backgroundColor: 'white',
                  border: `1px solid ${primaryColor}`,
                  color: primaryColor,
                  padding: '6px 12px',
                  borderRadius: 16,
                  fontSize: 12,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = primaryColor;
                  e.currentTarget.style.color = 'white';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.color = primaryColor;
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
