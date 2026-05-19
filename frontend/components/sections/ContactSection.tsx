import React from 'react';
import { ServiceRequestContent } from './ServiceRequestContent';

interface ContactSectionProps {
  subtitle?: string;
  titleLight?: string;
  titleBold?: string;
  hideTitle?: boolean;
}

export const ContactSection = ({
  subtitle = 'БЪРЗА ЗАЯВКА',
  titleLight = 'Заявете вашата',
  titleBold = 'услуга',
  hideTitle = false,
}: ContactSectionProps) => {
  return (
    <section id="contact" className="py-24 bg-white relative overflow-hidden">
      <div className="hidden md:block absolute top-0 right-0 w-[600px] h-[600px] bg-orange-50 rounded-full blur-[120px] opacity-40 translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="hidden md:block absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-50 rounded-full blur-[120px] opacity-40 -translate-x-1/2 translate-y-1/2 pointer-events-none" />

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <ServiceRequestContent
          showTitle={!hideTitle}
          subtitle={subtitle}
          titleLight={titleLight}
          titleBold={titleBold}
          formIdPrefix="contact"
        />
      </div>
    </section>
  );
};
