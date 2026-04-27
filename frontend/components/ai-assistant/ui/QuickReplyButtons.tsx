/**
 * Quick Reply Buttons Component
 * Display quick action buttons
 */

import React from 'react';
import { Search, DollarSign, Scale, Wrench } from 'lucide-react';
import type { QuickReply } from '../types';

interface QuickReplyButtonsProps {
  replies: QuickReply[];
  onReplyClick: (reply: QuickReply) => void;
  primaryColor: string;
  accentColor?: string;
}

const iconMap: Record<string, React.ComponentType<{ size: number; strokeWidth?: number }>> = {
  search: Search,
  dollar: DollarSign,
  scale: Scale,
  wrench: Wrench,
};

// Strip trailing emoji from label (e.g. "Търся климатик 🌡️" -> "Търся климатик")
const cleanLabel = (label: string): string =>
  label.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F]+\s*$/u, '').trim();

export const QuickReplyButtons: React.FC<QuickReplyButtonsProps> = ({
  replies,
  onReplyClick,
  primaryColor,
  accentColor = '#FF4D00',
}) => {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: 8,
      }}
    >
      {replies.map((reply) => {
        const IconComponent = reply.icon ? iconMap[reply.icon] : null;

        return (
          <button
            key={reply.id}
            onClick={() => onReplyClick(reply)}
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              color: '#0f172a',
              padding: '10px 12px',
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              textAlign: 'left',
              transition: 'all 0.2s ease',
              boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = primaryColor;
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = `0 8px 18px ${primaryColor}25`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e2e8f0';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 1px 2px rgba(15, 23, 42, 0.04)';
            }}
          >
            {IconComponent && (
              <span
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  backgroundColor: `${primaryColor}14`,
                  color: primaryColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <IconComponent size={15} strokeWidth={1.75} />
              </span>
            )}
            <span style={{ lineHeight: 1.2 }}>{cleanLabel(reply.label)}</span>
          </button>
        );
      })}
    </div>
  );
};

export default QuickReplyButtons;
