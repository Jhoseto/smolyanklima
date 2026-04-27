import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, Wrench, Clock, Thermometer, ArrowRight, Check, Phone, ChevronDown, ShieldCheck, BadgeCheck } from 'lucide-react';

const services = [
  {
    id: 'sales',
    title: "Продажба",
    description: "Широк асортимент от водещи марки на конкурентни цени.",
    extraInfo: "Предлагаме пълната гама на Daikin, Mitsubishi Electric, Gree и Fujitsu. Осигуряваме гъвкави схеми на изплащане чрез TBI Bank и UniCredit. Всеки закупен климатик идва с пълна техническа документация и официална гаранция от производителя.",
    icon: <Zap className="w-5 h-5 text-[#FF4D00]" />,
    color: "from-[#FF4D00]/10 to-[#FF2A4D]/10",
    accent: "#FF4D00",
    features: ["Оригинални продукти", "Официална гаранция", "Гъвкави лизингови схеми"]
  },
  {
    id: 'install',
    title: "Монтаж",
    description: "Професионален монтаж от сертифицирани техници до 48 часа.",
    extraInfo: "Стандартният монтаж включва до 3 метра тръбен път, вакуумиране на системата с професионални помпи и пускане в експлоатация. Използваме само висококачествени медни тръби с дебела изолация и професионални инструменти за минимално запрашаване.",
    icon: <Wrench className="w-5 h-5 text-[#00B4D8]" />,
    color: "from-[#00B4D8]/10 to-[#0077B6]/10",
    accent: "#00B4D8",
    features: ["Монтаж до 48 часа", "Сертифицирани техници", "Гаранция на монтажа"]
  },
  {
    id: 'service',
    title: "Сервиз",
    description: "Годишно обслужване и почистване за максимална ефективност.",
    extraInfo: "Пълната профилактика включва разглобяване и почистване на вътрешното тяло, антибактериална обработка на топлообменника и проверка на налягането. Редовният сервиз намалява консумацията на ток с до 20% и удължава живота на уреда.",
    icon: <Clock className="w-5 h-5 text-gray-600" />,
    color: "from-gray-100 to-gray-200/50",
    accent: "#4B5563",
    features: ["Почистване на филтри", "Проверка на хладагент", "Пълна диагностика"]
  },
  {
    id: 'repair',
    title: "Ремонт",
    description: "Бърза диагностика и ремонт на всички марки климатици.",
    extraInfo: "Имаме опит с ремонт на платки, подмяна на компресори и отстраняване на течове. Разполагаме с резервни части на склад за най-популярните модели, което ни позволява да реагираме в рамките на същия работен ден.",
    icon: <Thermometer className="w-5 h-5 text-[#FF4D00]" />,
    color: "from-[#FF4D00]/10 to-[#FF2A4D]/10",
    accent: "#FF4D00",
    features: ["Бърза реакция", "Резервни части на склад", "12 месеца гаранция"]
  }
];

export const ServicesSection = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (isExpanded) {
      // Small timeout to allow the expansion animation to begin and DOM to update
      const timer = setTimeout(() => {
        // Force the scroller to move down to reveal the expanded content
        window.scrollBy({
          top: 365,
          behavior: 'smooth'
        });
      }, 250); // Increased delay for smoother transition after expansion starts
      return () => clearTimeout(timer);
    }
  }, [isExpanded]);

  return (
    <section id="services" ref={sectionRef} className="py-24 relative overflow-hidden">
      {/* Decorative background blur */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-50 rounded-full blur-[120px] opacity-60 translate-x-1/3 -translate-y-1/3 pointer-events-none" />

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

        <div className="flex flex-col lg:flex-row justify-between items-end gap-12 mb-20">
          <div className="max-w-2xl">
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-[#FF4D00] text-[10px] font-bold tracking-[0.3em] uppercase mb-5 block"
            >
              ПРОФЕСИОНАЛНИ УСЛУГИ
            </motion.span>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="font-outfit text-[3rem] md:text-[4.5rem] leading-[1.05] tracking-tight"
            >
              <span className="relative inline-block">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00B4D8] to-[#0077B6] drop-shadow-md font-extralight block mb-1">
                  Всичко на
                </span>
                <div className="absolute -bottom-1 left-0 right-0 h-1 bg-gradient-to-r from-[#00B4D8]/0 via-[#00B4D8] to-[#00B4D8]/0 opacity-30 rounded-full" />
              </span>
              <br />
              <span className="relative inline-block whitespace-nowrap">
                <span className="absolute -inset-1 blur-lg bg-gradient-to-r from-[#FF4D00]/30 to-[#FF2A4D]/30 opacity-70"></span>
                <span className="relative text-transparent bg-clip-text bg-gradient-to-r from-[#FF4D00] via-[#FF6A00] to-[#FF2A4D] font-black uppercase drop-shadow-sm">
                  едно място
                </span>
              </span>
            </motion.h2>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex items-center gap-6 bg-gray-50/50 backdrop-blur-xl border border-gray-100 p-6 rounded-[2.5rem] group hover:bg-white transition-all duration-500 shadow-sm hover:shadow-xl shadow-gray-100/50"
          >
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-lg shadow-gray-200/50 group-hover:scale-110 transition-transform duration-500">
              <Phone className="w-5 h-5 text-[#00B4D8]" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Безплатна консултация</p>
              <h4 className="text-gray-900 font-bold text-lg leading-tight tracking-tight">088 858 5816</h4>
            </div>
            <div
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center group-hover:bg-[#FF4D00] group-hover:border-[#FF4D00] transition-all duration-500 cursor-pointer"
            >
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
            </div>
          </motion.div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {services.map((service, idx) => {
            return (
              <motion.div
                key={service.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className={`group relative bg-white border ${isExpanded ? 'border-[#FF4D00]/30 shadow-2xl z-20' : 'border-gray-100 shadow-sm'} rounded-[2.5rem] p-8 hover:shadow-xl transition-all duration-500 flex flex-col`}
              >
                <div className="flex justify-between items-start mb-8">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${service.color} flex items-center justify-center group-hover:scale-110 transition-transform duration-500 shadow-sm`}>
                    {service.icon}
                  </div>
                  <motion.button
                    onClick={() => setIsExpanded(!isExpanded)}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className={`w-10 h-10 rounded-full flex items-center justify-center border ${isExpanded ? 'bg-[#FF4D00] border-[#FF4D00] text-white shadow-lg shadow-[#FF4D00]/20' : 'bg-gray-50 border-gray-100 text-gray-400'}`}
                  >
                    <ChevronDown className={`w-5 h-5 transition-transform duration-500 ${isExpanded ? 'rotate-180' : ''}`} />
                  </motion.button>
                </div>

                <h3 className="font-outfit text-xl font-bold text-gray-900 mb-4 tracking-tight">
                  {service.title}
                </h3>

                <p className="text-gray-500 text-sm leading-relaxed mb-6">
                  {service.description}
                </p>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.4, ease: "circOut" }}
                      className="overflow-hidden"
                    >
                      <div className="pt-6 mt-6 border-t border-gray-100 space-y-6">
                        <p className="text-gray-600 text-sm leading-relaxed bg-gray-50/80 p-5 rounded-2xl border border-gray-100 italic">
                          {service.extraInfo}
                        </p>

                        <div className="space-y-3">
                          {service.features.map((feature, fIdx) => (
                            <div key={fIdx} className="flex items-center gap-3">
                              <div className="w-5 h-5 rounded-full bg-[#10B981]/10 flex items-center justify-center">
                                <Check className="w-3 h-3 text-[#10B981]" />
                              </div>
                              <span className="text-xs font-semibold text-gray-700">{feature}</span>
                            </div>
                          ))}
                        </div>

                        <button className="w-full py-4 bg-[#00B4D8] text-white rounded-2xl font-bold text-xs hover:bg-[#FF4D00] transition-all hover:shadow-lg hover:shadow-[#FF4D00]/20 active:scale-[0.98]">
                          Заяви консултация
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {/* Bottom Trust Row */}
        <div className="mt-20 pt-10 border-t border-gray-50 flex flex-wrap justify-center gap-12">
          {[
            { icon: ShieldCheck, text: "Официален сервиз", color: "text-[#00B4D8]" },
            { icon: BadgeCheck, text: "Сертифициран екип", color: "text-[#FF4D00]" },
            { icon: Zap, text: "Експресно обслужване", color: "text-gray-900" }
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <item.icon className={`w-5 h-5 ${item.color}`} strokeWidth={1.5} />
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
