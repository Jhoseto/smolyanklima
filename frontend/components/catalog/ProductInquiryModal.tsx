import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CatalogProductImage } from './CatalogProductImage';
import { X, Send, Wind, CheckCircle2 } from 'lucide-react';
import type { CatalogProduct } from '../../data/types/product';
import { postPublicInquiry } from '../../data/postInquiry';
import { PrivacyCheckbox } from '../consent/PrivacyCheckbox';
import { trackGenerateLead } from '../../lib/analytics/events';
import {
  contactNameErrorMessage,
  contactPhoneErrorMessage,
  isValidContactName,
  isValidContactPhone,
  sanitizeContactName,
  sanitizePhoneInput,
} from '../../lib/contactFormValidation';

const SUCCESS_MESSAGE =
  'Запитването е подадено успешно! В най-скоро с вас ще се свърже представител на Смолян Клима.';

export type ProductInquiryModalProps = {
  product: CatalogProduct | null;
  onClose: () => void;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
};

type MountChoice = 'with' | 'without' | null;

export function ProductInquiryModal({ product, onClose, onSuccess, onError }: ProductInquiryModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [mountChoice, setMountChoice] = useState<MountChoice>(null);
  const [website, setWebsite] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [mountError, setMountError] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  const handleClose = useCallback(() => {
    if (done) onSuccess?.(SUCCESS_MESSAGE);
    onClose();
  }, [done, onClose, onSuccess]);

  useEffect(() => {
    if (!product) return;
    setName('');
    setPhone('');
    setMountChoice(null);
    setWebsite('');
    setBusy(false);
    setDone(false);
    setMountError(false);
    setPrivacyAccepted(false);
  }, [product?.id]);

  const nameErr = name.trim() ? contactNameErrorMessage(name) : null;
  const phoneErr = phone ? contactPhoneErrorMessage(phone) : null;
  const contactOk = isValidContactName(name) && isValidContactPhone(phone);
  const canSubmit = contactOk && mountChoice !== null && privacyAccepted && !busy;

  const displayMountError = contactOk && !mountChoice;
  const displayPrivacyError = contactOk && mountChoice !== null && !privacyAccepted;

  useEffect(() => {
    if (!product) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [product, busy, handleClose]);

  if (!product) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || done) return;
    if (website.trim()) {
      onClose();
      return;
    }
    if (!canSubmit) return;
    setMountError(false);
    setBusy(true);
    const includeInstallation = mountChoice === 'with';
    const r = await postPublicInquiry({
      source: 'product',
      customerName: name.trim().replace(/\s+/g, ' '),
      customerPhone: phone,
      productSlug: product.id,
      productName: product.name,
      includeInstallation,
      serviceType: includeInstallation ? 'installation' : 'sale',
      website: '',
    });
    setBusy(false);
    if (r.ok === false) {
      onError?.(r.status === 429 ? 'Твърде много заявки. Опитайте по-късно.' : r.error);
      return;
    }
    setDone(true);
    trackGenerateLead('product', product.id);
  };

  return (
    <AnimatePresence>
      <motion.div
        key="inquiry-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[1200] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/55 backdrop-blur-md"
        onClick={() => !busy && !done && handleClose()}
      >
        <motion.div
          key="inquiry-panel"
          initial={{ opacity: 0, y: 40, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          className="relative w-full max-w-md overflow-hidden rounded-t-3xl sm:rounded-3xl border border-white/80 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.28)]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#00B4D8] via-[#0077B6] to-[#FF4D00]" />

          <button
            type="button"
            onClick={handleClose}
            disabled={busy}
            className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-500 shadow-sm transition hover:bg-white hover:text-slate-900 disabled:opacity-50"
            aria-label="Затвори"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="border-b border-slate-100 bg-gradient-to-br from-[#F0F9FF] via-white to-[#FFF7F2] px-6 pb-5 pt-6">
            <div className="flex items-start gap-3 pr-8">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00B4D8] to-[#0077B6] text-white shadow-lg shadow-[#00B4D8]/20">
                <Wind className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${done ? 'text-emerald-600' : 'text-[#00B4D8]'}`}>
                  {done ? 'Готово' : 'Запитване'}
                </p>
                <h2 className="mt-1 text-lg font-black leading-snug text-slate-900">
                  {done ? 'Благодарим ви!' : 'Пусни запитване'}
                </h2>
                {!done && (
                  <p className="mt-1 text-xs font-medium text-slate-500 line-clamp-2">{product.name}</p>
                )}
              </div>
            </div>
            {!done && (
              <motion.div className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-100 bg-white/80 p-3">
                <CatalogProductImage
                  src={product.image}
                  alt=""
                  fade="thumb"
                  className="h-14 w-14 shrink-0 rounded-xl bg-slate-50 p-1"
                />
                <div className="min-w-0 text-sm">
                  <p className="font-bold text-slate-900">{product.brand}</p>
                  <p className="text-slate-600 line-clamp-2">{product.model}</p>
                  <p className="mt-1 text-xs font-bold text-[#FF4D00]">
                    от €{product.price.toLocaleString()}
                    {product.priceWithMount ? ` · с монтаж €${product.priceWithMount.toLocaleString()}` : ''}
                  </p>
                </div>
              </motion.div>
            )}
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 px-6 py-5">
            <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden>
              <label htmlFor="inq-website">Website</label>
              <input
                id="inq-website"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>

            {done ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-6 text-center"
              >
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600 mb-3" />
                <p className="font-bold text-emerald-900 text-base">Запитването е подадено!</p>
                <p className="mt-2 text-sm leading-relaxed text-emerald-800">{SUCCESS_MESSAGE}</p>
                <button
                  type="button"
                  onClick={handleClose}
                  className="mt-5 w-full rounded-xl border border-emerald-300 bg-white py-3 text-sm font-bold text-emerald-800 transition hover:bg-emerald-100"
                >
                  Затвори
                </button>
              </motion.div>
            ) : (
              <>
                <div className="space-y-3">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold text-slate-600">Вашето име</span>
                    <input
                      type="text"
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(sanitizeContactName(e.target.value))}
                      placeholder="Иван Иванов"
                      aria-invalid={Boolean(nameErr)}
                      className={`w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:ring-2 ${
                        nameErr
                          ? 'border-red-500 ring-2 ring-red-500/25 focus:border-red-500'
                          : 'border-slate-200 focus:border-[#00B4D8] focus:ring-[#00B4D8]/20'
                      }`}
                    />
                    {nameErr && (
                      <p className="mt-1.5 text-xs font-semibold text-red-600">{nameErr}</p>
                    )}
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold text-slate-600">Телефон</span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      value={phone}
                      onChange={(e) => setPhone(sanitizePhoneInput(e.target.value))}
                      placeholder="0878581616 или +359878581616"
                      aria-invalid={Boolean(phoneErr)}
                      className={`w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:ring-2 ${
                        phoneErr
                          ? 'border-red-500 ring-2 ring-red-500/25 focus:border-red-500'
                          : 'border-slate-200 focus:border-[#00B4D8] focus:ring-[#00B4D8]/20'
                      }`}
                    />
                    {phoneErr && (
                      <p className="mt-1.5 text-xs font-semibold text-red-600">{phoneErr}</p>
                    )}
                  </label>
                </div>

                <fieldset className="space-y-2">
                  <legend className="mb-1 block text-xs font-bold text-slate-600">
                    Интересувам се от <span className="text-[#FF4D00]">*</span>
                  </legend>
                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition ${
                      mountChoice === 'without'
                        ? 'border-[#00B4D8] bg-[#F0F9FF] ring-2 ring-[#00B4D8]/20'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="mount"
                      className="h-4 w-4 accent-[#00B4D8]"
                      checked={mountChoice === 'without'}
                      onChange={() => {
                        setMountChoice('without');
                        setMountError(false);
                      }}
                    />
                    <span className="text-sm font-semibold text-slate-800">Само уред</span>
                  </label>
                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition ${
                      mountChoice === 'with'
                        ? 'border-[#FF4D00] bg-orange-50 ring-2 ring-[#FF4D00]/20'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="mount"
                      className="h-4 w-4 accent-[#FF4D00]"
                      checked={mountChoice === 'with'}
                      onChange={() => {
                        setMountChoice('with');
                        setMountError(false);
                      }}
                    />
                    <span className="text-sm font-semibold text-slate-800">
                      С монтаж
                      {product.priceWithMount
                        ? ` (от €${product.priceWithMount.toLocaleString()})`
                        : ''}
                    </span>
                  </label>
                  {(mountError || displayMountError) && (
                    <p className="text-xs font-semibold text-red-600">Моля, изберете една от опциите.</p>
                  )}
                </fieldset>

                <PrivacyCheckbox
                  id="product-inquiry-privacy"
                  checked={privacyAccepted}
                  showError={displayPrivacyError}
                  onChange={setPrivacyAccepted}
                />

                <p className="text-[11px] leading-relaxed text-slate-500">
                  Ще се свържем с вас за оферта и наличност по избрания модел. Без ангажимент.
                </p>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white shadow-lg transition ${
                    canSubmit
                      ? 'bg-gradient-to-r from-[#FF4D00] to-[#FF2A4D] shadow-orange-500/25 hover:scale-[1.02] hover:shadow-orange-500/35'
                      : 'cursor-not-allowed bg-gradient-to-r from-slate-300 to-slate-400 shadow-none opacity-70'
                  }`}
                  aria-disabled={!canSubmit}
                >
                  <Send className="h-4 w-4" />
                  {busy ? 'Изпращане…' : 'Пусни запитване'}
                </button>
              </>
            )}
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
