import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, ShoppingCart, User, CheckCircle2, TrendingUp, Star, Package, MapPin } from 'lucide-react';

// Разширени съобщения за социално доказателство
const ALL_MESSAGES = [
  { text: "Иван от Смолян току-що купи Daikin Perfera", icon: ShoppingCart, type: 'purchase' },
  { text: "Мария от Чепеларе поръча Mitsubishi Elegant", icon: ShoppingCart, type: 'purchase' },
  { text: "3 човека разглеждат Daikin Perfera в момента", icon: User, type: 'viewing' },
  { text: "5 човека разглеждат този продукт", icon: User, type: 'viewing' },
  { text: "Последна поръчка: преди 12 минути", icon: Clock, type: 'recent' },
  { text: "Нова поръчка: преди 8 минути", icon: Clock, type: 'recent' },
  { text: "Нова доставка: Mitsubishi MSZ-LN наличен", icon: Package, type: 'stock' },
  { text: "Популярно: Daikin Perfera се разпродава бързо", icon: TrendingUp, type: 'trending' },
  { text: "Топ оценка: 4.9★ от 127 клиента", icon: Star, type: 'rating' },
  { text: "Безплатен монтаж в Смолян и областта", icon: MapPin, type: 'service' },
  { text: "Петър от Девин поръча климатик с монтаж", icon: ShoppingCart, type: 'purchase' },
  { text: "Гаранция 3 години на всички модели", icon: CheckCircle2, type: 'service' },
  { text: "1500+ успешни монтажа в региона", icon: TrendingUp, type: 'social' },
  { text: "25+ години опит в климатичната техника", icon: Star, type: 'social' },
  { text: "Работим с всички марки: Daikin, Mitsubishi, Gree", icon: Package, type: 'brands' },
];

export const SocialProofToasts = () => {
  const [currentMessage, setCurrentMessage] = useState<typeof ALL_MESSAGES[0] | null>(null);
  const shownMessagesRef = useRef<Set<number>>(new Set());
  const messageCountRef = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRunningRef = useRef(true);

  const getNextMessage = useCallback(() => {
    // Вземаме непоказвани съобщения
    const availableIndices = ALL_MESSAGES.map((_, i) => i).filter(i => !shownMessagesRef.current.has(i));
    
    // Ако всички са показани, рестартираме
    if (availableIndices.length === 0) {
      shownMessagesRef.current.clear();
      messageCountRef.current = 0;
      return Math.floor(Math.random() * ALL_MESSAGES.length);
    }
    
    // Вземаме случайно от наличните
    const randomIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    return randomIndex;
  }, []);

  const showMessage = useCallback((messageIndex: number) => {
    if (!isRunningRef.current) return;
    
    setCurrentMessage(ALL_MESSAGES[messageIndex]);
    shownMessagesRef.current.add(messageIndex);
    messageCountRef.current++;
    
    // Скриваме след 5 секунди
    timeoutRef.current = setTimeout(() => {
      setCurrentMessage(null);
    }, 5000);
  }, []);

  const scheduleNextMessage = useCallback(() => {
    if (!isRunningRef.current) return;
    
    const count = messageCountRef.current;
    let nextDelay: number;
    
    if (count === 0) {
      // Първо съобщение: на 5-та секунда
      nextDelay = 5000;
    } else if (count === 1) {
      // Второ съобщение: на 15-та секунда (10 сек след първото)
      nextDelay = 10000;
    } else {
      // Следващи: 2-3 минути (120-180 секунди)
      nextDelay = Math.random() * 60000 + 120000; // 120000-180000ms
    }
    
    timeoutRef.current = setTimeout(() => {
      const messageIndex = getNextMessage();
      showMessage(messageIndex);
      
      // Планираме следващо след като това се скрие
      const hideDelay = 5000; // Времето за показване
      timeoutRef.current = setTimeout(() => {
        scheduleNextMessage();
      }, hideDelay);
    }, nextDelay);
  }, [getNextMessage, showMessage]);

  useEffect(() => {
    // Пауза ако потребителят не е активен
    const handleVisibilityChange = () => {
      if (document.hidden) {
        isRunningRef.current = false;
      } else {
        isRunningRef.current = true;
        // Рестартираме при връщане
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        scheduleNextMessage();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Стартираме последователността
    scheduleNextMessage();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [scheduleNextMessage]);

  return (
    <div className="fixed bottom-6 left-6 z-[400] pointer-events-none">
      <AnimatePresence>
        {currentMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9, x: -20 }}
            animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
            exit={{ opacity: 0, y: 20, scale: 0.9, x: -20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="bg-white/95 backdrop-blur-md shadow-2xl border border-gray-200 rounded-xl p-3.5 flex items-center gap-3 max-w-[320px] pointer-events-auto cursor-pointer hover:shadow-2xl transition-shadow"
            onClick={() => setCurrentMessage(null)}
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-50 to-cyan-50 flex items-center justify-center shrink-0 border border-blue-100">
              <currentMessage.icon className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-sm font-medium text-gray-800 leading-snug">
              {currentMessage.text}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
