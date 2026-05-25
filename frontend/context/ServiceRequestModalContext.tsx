import React, { createContext, useCallback, useContext, useState } from 'react';
import { ServiceRequestModal } from '../components/sections/ServiceRequestModal';
import type { ServiceType } from '../components/sections/ServiceRequestContent';

export type ServiceRequestOpenOptions = {
  serviceType?: ServiceType;
};

type ServiceRequestModalContextValue = {
  open: (options?: ServiceRequestOpenOptions) => void;
  close: () => void;
};

const ServiceRequestModalContext = createContext<ServiceRequestModalContextValue | null>(null);

export function ServiceRequestModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [initialServiceType, setInitialServiceType] = useState<ServiceType>('consultation');

  const open = useCallback((options?: ServiceRequestOpenOptions) => {
    setInitialServiceType(options?.serviceType ?? 'consultation');
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setInitialServiceType('consultation');
  }, []);

  return (
    <ServiceRequestModalContext.Provider value={{ open, close }}>
      {children}
      <ServiceRequestModal open={isOpen} onClose={close} initialServiceType={initialServiceType} />
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
