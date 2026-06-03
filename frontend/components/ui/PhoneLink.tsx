import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { Phone } from 'lucide-react';
import { LEGAL_COMPANY } from '../../data/legal/company';
import { toTelHref } from '../../lib/telLink';

type PhoneLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  phone?: string | null;
  children?: ReactNode;
  showIcon?: boolean;
  stopPropagation?: boolean;
};

/** Кликваем телефон — отваря набиране на устройството. */
export function PhoneLink({
  phone,
  children,
  className = '',
  showIcon = false,
  stopPropagation = false,
  onClick,
  ...rest
}: PhoneLinkProps) {
  const dialSource = String(phone ?? '').trim();
  const display = children ?? dialSource;
  if (!display) return <span className={className}>—</span>;

  const href = toTelHref(dialSource || (typeof display === 'string' ? display : ''));
  if (!href) {
    return <span className={className}>{display}</span>;
  }

  return (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        if (stopPropagation) e.stopPropagation();
        onClick?.(e);
      }}
      {...rest}
    >
      {showIcon ? <Phone className="inline h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
      {display}
    </a>
  );
}

/** Телефон на фирмата от LEGAL_COMPANY. */
export function CompanyPhoneLink({
  children,
  className = '',
  showIcon = false,
  ...rest
}: Omit<PhoneLinkProps, 'phone'>) {
  return (
    <PhoneLink
      phone={LEGAL_COMPANY.phoneE164}
      className={className}
      showIcon={showIcon}
      {...rest}
    >
      {children ?? LEGAL_COMPANY.phone}
    </PhoneLink>
  );
}
