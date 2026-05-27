import React from 'react';
import { Link } from 'react-router-dom';
import { LEGAL_COMPANY } from '../../data/legal/company';
import type { CookieInventoryRow } from '../../data/legal/cookieInventory';

export function CookieSettingsLink({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      className="text-[#00B4D8] hover:underline font-medium bg-transparent border-0 p-0 cursor-pointer inline"
      onClick={() => window.dispatchEvent(new Event('sk-open-cookie-settings'))}
    >
      {children}
    </button>
  );
}

export function CompanyBlock() {
  const c = LEGAL_COMPANY;
  return (
    <address className="not-italic text-gray-700 leading-relaxed">
      <strong>{c.legalName}</strong>
      <br />
      ЕИК: {c.eik}
      <br />
      ДДС №: {c.vatNumber}
      <br />
      Седалище и адрес на управление: {c.registeredOffice}
      <br />
      Адрес на обект/магазин: {c.tradeAddress}
      <br />
      Имейл:{' '}
      <a href={`mailto:${c.email}`}>{c.email}</a>
      <br />
      Телефон: <a href={`tel:${c.phoneE164}`}>{c.phone}</a>
      <br />
      Управител: {c.managingDirector}
      <br />
      Лице за контакт по поверителност: {c.privacyContactName}
    </address>
  );
}

export function CookieInventoryTable({ rows }: { rows: CookieInventoryRow[] }) {
  return (
    <div className="overflow-x-auto not-prose my-6 -mx-1">
      <table className="w-full min-w-[640px] text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100 text-left">
            <th className="p-3 border border-gray-200 font-semibold text-gray-900">Име</th>
            <th className="p-3 border border-gray-200 font-semibold text-gray-900">Тип</th>
            <th className="p-3 border border-gray-200 font-semibold text-gray-900">Категория</th>
            <th className="p-3 border border-gray-200 font-semibold text-gray-900">Срок</th>
            <th className="p-3 border border-gray-200 font-semibold text-gray-900">Доставчик</th>
            <th className="p-3 border border-gray-200 font-semibold text-gray-900">Цел</th>
          </tr>
        </thead>
        <tbody className="text-gray-600">
          {rows.map((row) => (
            <tr key={row.name} className="align-top">
              <td className="p-3 border border-gray-200 font-mono text-xs break-all">{row.name}</td>
              <td className="p-3 border border-gray-200">{row.type}</td>
              <td className="p-3 border border-gray-200 whitespace-nowrap">{row.category}</td>
              <td className="p-3 border border-gray-200">{row.duration}</td>
              <td className="p-3 border border-gray-200">{row.provider}</td>
              <td className="p-3 border border-gray-200">{row.purpose}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LegalCrossLinks() {
  return (
    <p className="text-sm text-gray-600">
      Вижте също:{' '}
      <Link to="/politika-za-poveritelnost">Политика за поверителност</Link>,{' '}
      <Link to="/biskvitki">Политика за бисквитки</Link>,{' '}
      <Link to="/obshti-usloviya">Общи условия</Link>.
    </p>
  );
}
