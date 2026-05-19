import React, { createContext, useCallback, useContext, useState } from 'react';
import { ServiceRequestModal } from '../components/sections/ServiceRequestModal';

type ServiceRequestModalContextValue = {
  open: () => void;
  close: () => void;
};

const ServiceRequestModalContext = createContext<ServiceRequestModalContextValue | null>(null);

export function ServiceRequestModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <ServiceRequestModalContext.Provider value={{ open, close }}>
      {children}
      <ServiceRequestModal open={isOpen} onClose={close} />
    </ServiceRequestModalContext.Provider>
  );
}

export function useServiceRequestModal() {
  const ctx = useContext(ServiceRequestModalContext);
  if (!ctx) {
    throw new Error('useServiceRequestModal must be used within ServiceRequestModalProvider');
  }
  return ctx;
}
