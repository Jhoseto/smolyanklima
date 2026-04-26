import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Clock, ShieldCheck, CheckCircle, Check, Sparkles } from 'lucide-react';

interface ContactSectionProps {
  subtitle?: string;
  titleLight?: string;
  titleBold?: string;
  hideTitle?: boolean;
}

export const ContactSection = ({
  subtitle = "БЪРЗА ЗАЯВКА",
  titleLight = "Заявете вашата",
  titleBold = "услуга",
  hideTitle = false
}: ContactSectionProps) => {
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitted(true);
    // In a real app, reset after some time or keep the success state
  };

  return (
    <section id="contact" className="py-24 bg-white relative overflow-hidden">
      {/* Decorative Parallax Background Elements */}
      <motion.div
        animate={{ y: [0, -30, 0], x: [0, 20, 0] }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        className="absolute top-0 right-0 w-[600px] h-[600px] bg-orange-50 rounded-full blur-[120px] opacity-40 translate-x-1/2 -translate-y-1/2 pointer-events-none"
      />
      <motion.div
        animate={{ y: [0, 30, 0], x: [0, -20, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-50 rounded-full blur-[120px] opacity-40 -translate-x-1/2 translate-y-1/2 pointer-events-none"
      />

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

        {/* Headline */}
        {!hideTitle && (
          <div className="text-center mb-16">
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-[#FF4D00] text-[10px] font-bold tracking-[0.3em] uppercase mb-5 block"
            >
              {subtitle}
            </motion.span>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="font-outfit text-[2.5rem] md:text-[3.25rem] leading-[1.1] tracking-tight"
            >
              <span className="relative inline-block mr-3">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00B4D8] to-[#0077B6] drop-shadow-sm font-extralight block">
                  {titleLight}
                </span>
                <div className="absolute -bottom-1 left-0 right-0 h-1 bg-gradient-to-r from-[#00B4D8]/0 via-[#00B4D8] to-[#00B4D8]/0 opacity-30 rounded-full" />
              </span>
              <span className="relative inline-block whitespace-nowrap">
                <span className="absolute -inset-1 blur-lg bg-gradient-to-r from-[#FF4D00]/20 to-[#FF2A4D]/20 opacity-60"></span>
                <span className="relative text-transparent bg-clip-text bg-gradient-to-r from-[#FF4D00] via-[#FF6A00] to-[#FF2A4D] font-black uppercase drop-shadow-sm">
                  {titleBold}
                </span>
              </span>
            </motion.h2>
          </div>
        )}

        {/* Split Layout Container */}
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-stretch">

          {/* Left Side: Image & Trust Points */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative rounded-[3rem] overflow-hidden group min-h-[400px] lg:min-h-full flex flex-col justify-end p-8 md:p-12"
          >
            {/* Background Image */}
            <div className="absolute inset-0">
              <img
                src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?q=80&w=2053&auto=format&fit=crop"
                alt="Луксозен модерен интериор"
                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/30" />
            </div>

            {/* Content over image */}
            <div className="relative z-10">
              <motion.h3
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="font-outfit text-3xl md:text-4xl leading-[1.1] tracking-tight mb-4"
              >
                <span className="relative inline-block mb-1">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#90E0EF] to-[#00B4D8] drop-shadow-lg font-extralight block">
                    Перфектният климат
                  </span>
                  <div className="absolute -bottom-1 left-0 right-0 h-1 bg-gradient-to-r from-[#48CAE4]/0 via-[#48CAE4] to-[#48CAE4]/0 opacity-50 rounded-full" />
                </span>
                <br />
                <span className="relative inline-block whitespace-nowrap mt-2">
                  <span className="absolute -inset-1 blur-lg bg-gradient-to-r from-[#FF4D00]/40 to-[#FF2A4D]/40 opacity-60"></span>
                  <span className="relative text-transparent bg-clip-text bg-gradient-to-r from-[#FF4D00] via-[#FF6A00] to-[#FF2A4D] font-black uppercase drop-shadow-sm">за вашия дом</span>
                </span>
              </motion.h3>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
                className="text-white font-medium text-sm md:text-base max-w-md mb-8 drop-shadow-md"
              >
                Доверете се на професионалистите за монтаж, поддръжка и сервиз на климатични системи от най-висок клас.
              </motion.p>

              {/* Trust Points */}
              <div className="flex flex-col gap-4">
                {[
                  { icon: Clock, text: "Отговор до 60 минути" },
                  { icon: ShieldCheck, text: "Сертифицирани инженери" },
                  { icon: CheckCircle, text: "Безплатен оглед и консултация" }
                ].map((point, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.4 + idx * 0.1, type: "spring" }}
                    className="flex items-center gap-3 bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10 w-max hover:bg-white/20 transition-colors cursor-default"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#00B4D8] to-[#0077B6] flex items-center justify-center text-white shrink-0 shadow-[0_0_15px_rgba(0,180,216,0.5)]">
                      <point.icon className="w-4 h-4" />
                    </div>
                    <span className="text-white text-sm font-medium">{point.text}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Right Side: Enhanced Form */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-white/60 backdrop-blur-3xl border border-gray-100 rounded-[3rem] p-8 md:p-12 shadow-2xl shadow-gray-200/50 relative overflow-hidden flex flex-col justify-center"
          >
            {/* Subtle inner glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#00B4D8]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

            <AnimatePresence mode="wait">
              {!isSubmitted ? (
                <motion.form
                  key="form"
                  onSubmit={handleSubmit}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
                  className="space-y-6 relative z-10"
                >
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Floating Label Input */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="relative group"
                    >
                      <input
                        type="text"
                        id="name"
                        className="peer w-full h-16 px-6 pt-4 rounded-2xl bg-white border border-gray-200 text-gray-900 font-outfit font-medium placeholder-transparent focus:outline-none focus:border-[#FF4D00] focus:ring-4 focus:ring-[#FF4D00]/10 shadow-sm transition-all duration-300 focus:shadow-[0_0_20px_rgba(255,77,0,0.1)]"
                        placeholder="Име и Фамилия"
                        required
                      />
                      <label
                        htmlFor="name"
                        className="absolute left-6 top-2 text-[10px] font-black text-gray-400 uppercase tracking-widest transition-all duration-300 peer-placeholder-shown:top-5 peer-placeholder-shown:text-sm peer-placeholder-shown:font-medium peer-placeholder-shown:normal-case peer-focus:top-2 peer-focus:text-[10px] peer-focus:font-black peer-focus:uppercase peer-focus:text-[#FF4D00]"
                      >
                        Име и Фамилия
                      </label>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="relative group"
                    >
                      <input
                        type="tel"
                        id="phone"
                        className="peer w-full h-16 px-6 pt-4 rounded-2xl bg-white border border-gray-200 text-gray-900 font-outfit font-medium placeholder-transparent focus:outline-none focus:border-[#00B4D8] focus:ring-4 focus:ring-[#00B4D8]/10 shadow-sm transition-all duration-300 focus:shadow-[0_0_20px_rgba(0,180,216,0.1)]"
                        placeholder="Телефон"
                        required
                      />
                      <label
                        htmlFor="phone"
                        className="absolute left-6 top-2 text-[10px] font-black text-gray-400 uppercase tracking-widest transition-all duration-300 peer-placeholder-shown:top-5 peer-placeholder-shown:text-sm peer-placeholder-shown:font-medium peer-placeholder-shown:normal-case peer-focus:top-2 peer-focus:text-[10px] peer-focus:font-black peer-focus:uppercase peer-focus:text-[#00B4D8]"
                      >
                        Телефон
                      </label>
                    </motion.div>
                  </div>

                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="space-y-3"
                  >
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2 block">Желана услуга</label>
                    <div className="flex flex-wrap gap-3">
                      {['Продажба', 'Монтаж', 'Профилактика', 'Ремонт'].map((service, i) => (
                        <label key={service} className="cursor-pointer">
                          <input type="radio" name="service" className="peer sr-only" defaultChecked={i === 0} />
                          <div className="px-6 py-3 rounded-xl bg-white border border-gray-200 text-[13px] font-bold text-gray-500 peer-checked:bg-gradient-to-r peer-checked:from-[#FF4D00] peer-checked:to-[#FF2A4D] peer-checked:text-white peer-checked:border-transparent hover:border-gray-300 transition-all duration-300 shadow-sm">
                            {service}
                          </div>
                        </label>
                      ))}
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="relative group"
                  >
                    <textarea
                      id="message"
                      rows={4}
                      className="peer w-full p-6 pt-8 rounded-2xl bg-white border border-gray-200 text-gray-900 font-outfit font-medium placeholder-transparent focus:outline-none focus:border-[#FF4D00] focus:ring-4 focus:ring-[#FF4D00]/10 shadow-sm transition-all duration-300 focus:shadow-[0_0_20px_rgba(255,77,0,0.1)] resize-none"
                      placeholder="Съобщение"
                    ></textarea>
                    <label
                      htmlFor="message"
                      className="absolute left-6 top-3 text-[10px] font-black text-gray-400 uppercase tracking-widest transition-all duration-300 peer-placeholder-shown:top-6 peer-placeholder-shown:text-sm peer-placeholder-shown:font-medium peer-placeholder-shown:normal-case peer-focus:top-3 peer-focus:text-[10px] peer-focus:font-black peer-focus:uppercase peer-focus:text-[#FF4D00]"
                    >
                      Допълнителна информация
                    </label>
                  </motion.div>

                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full h-14 bg-gradient-to-r from-[#FF4D00] via-[#FF6A00] to-[#FF2A4D] text-white rounded-full font-bold text-lg hover:shadow-[0_10px_30px_rgba(255,77,0,0.4)] transition-all flex items-center justify-center gap-2 mt-4"
                  >
                    Изпрати заявката <Send className="w-5 h-5" />
                  </motion.button>
                </motion.form>
              ) : (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center text-center h-full min-h-[400px] relative z-10"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", damping: 12, delay: 0.1 }}
                    className="w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(52,211,153,0.4)] mb-8 relative"
                  >
                    <Check className="w-12 h-12 text-white" strokeWidth={3} />
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                      className="absolute -inset-4"
                    >
                      <Sparkles className="absolute top-0 right-0 w-6 h-6 text-emerald-400" />
                    </motion.div>
                  </motion.div>

                  <h3 className="text-3xl font-outfit font-black text-gray-900 mb-4">Успешно изпратено!</h3>
                  <p className="text-gray-500 max-w-sm mx-auto mb-8 leading-relaxed">
                    Благодарим ви за доверието. Наш консултант ще прегледа заявката ви и ще се свърже с вас съвсем скоро.
                  </p>

                  <button
                    onClick={() => setIsSubmitted(false)}
                    className="text-sm font-bold text-[#00B4D8] uppercase tracking-widest hover:text-[#0077B6] transition-colors"
                  >
                    Изпрати нова заявка
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

        </div>
      </div>
    </section>
  );
};
