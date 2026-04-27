/**
 * Privacy Consent Component
 * GDPR compliance - consent banner before chat
 */

import React, { useState, useEffect } from 'react';
import { Shield, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PrivacyConsentProps {
  primaryColor: string;
  onConsent: (consent: boolean) => void;
  onClose: () => void;
}

export const PrivacyConsent: React.FC<PrivacyConsentProps> = ({
  primaryColor,
  onConsent,
  onClose,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      style={{
        position: 'fixed',
        bottom: 100,
        right: 20,
        width: 360,
        backgroundColor: 'white',
        borderRadius: 16,
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        padding: 20,
        zIndex: 10000,
        border: `2px solid ${primaryColor}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            backgroundColor: `${primaryColor}20`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: primaryColor,
            flexShrink: 0,
          }}
        >
          <Shield size={20} />
        </div>

        <div style={{ flex: 1 }}>
          <h3
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: '#1e293b',
              margin: 0,
              marginBottom: 8,
            }}
          >
            Поверителност и GDPR
          </h3>

          <p
            style={{
              fontSize: 13,
              color: '#64748b',
              lineHeight: 1.5,
              margin: 0,
              marginBottom: 16,
            }}
          >
            За да Ви помогнем по-добре, асистентът съхранява разговорите временно. 
            Данните се използват само за подобряване на обслужването.
          </p>

          {showDetails && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              style={{
                backgroundColor: '#f8fafc',
                borderRadius: 8,
                padding: 12,
                marginBottom: 16,
                fontSize: 12,
                color: '#475569',
              }}
            >
              <strong>Съхраняваме:</strong>
              <ul style={{ margin: '8px 0', paddingLeft: 16 }}>
                <li>Съобщения от разговора (30 дни)</li>
                <li>Предпочитания за продукти</li>
                <li>Разгледани продукти</li>
              </ul>
              <strong>НЕ съхраняваме:</strong>
              <ul style={{ margin: '8px 0', paddingLeft: 16 }}>
                <li>Лични данни (име, телефон, имейл)</li>
                <li>Банкова информация</li>
                <li>Адреси</li>
              </ul>
            </motion.div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => onConsent(true)}
              style={{
                flex: 1,
                backgroundColor: primaryColor,
                color: 'white',
                border: 'none',
                borderRadius: 8,
                padding: '10px 16px',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = `0 4px 12px ${primaryColor}40`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <Check size={16} />
              Съгласен съм
            </button>

            <button
              onClick={() => setShowDetails(!showDetails)}
              style={{
                backgroundColor: 'transparent',
                color: '#64748b',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '10px 16px',
                fontSize: 13,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {showDetails ? 'Скрий' : 'Детайли'}
            </button>
          </div>

          <p
            style={{
              fontSize: 11,
              color: '#94a3b8',
              margin: '12px 0 0 0',
              textAlign: 'center',
            }}
          >
            Можете да изтриете данните по всяко време от настройките
          </p>
        </div>

        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: 4,
            borderRadius: 4,
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#64748b')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
        >
          <X size={18} />
        </button>
      </div>
    </motion.div>
  );
};

export default PrivacyConsent;
