import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, ShoppingCart, User, CheckCircle2 } from 'lucide-react';

const MESSAGES = [
  { text: "Иван от Смолян току-що купи Daikin Perfera", icon: ShoppingCart },
  { text: "3 човека разглеждат този модел в момента", icon: User },
  { text: "Последна поръчка: преди 12 минути", icon: Clock },
  { text: "Нова доставка: Mitsubishi MSZ-LN наличен", icon: CheckCircle2 },
];

export const SocialProofToasts = () => {
  const [currentMessage, setCurrentMessage] = useState<typeof MESSAGES[0] | null>(null);

  useEffect(() => {
    // Show a random message every 15-25 seconds
    const interval = setInterval(() => {
      const randomMsg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
      setCurrentMessage(randomMsg);
      
      // Hide after 5 seconds
      setTimeout(() => {
        setCurrentMessage(null);
      }, 5000);
      
    }, Math.random() * 10000 + 15000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed bottom-6 left-6 z-[400] pointer-events-none">
      <AnimatePresence>
        {currentMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="bg-white/90 backdrop-blur-md shadow-2xl border border-gray-100 rounded-2xl p-4 flex items-center gap-3 max-w-[300px]"
          >
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
              <currentMessage.icon className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-xs font-semibold text-gray-700 leading-snug">
              {currentMessage.text}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
