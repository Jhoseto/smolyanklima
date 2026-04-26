import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, Wrench, Clock, Thermometer, ArrowRight, Check, Phone, ChevronDown } from 'lucide-react';

const services = [
  {
    id: 'sales',
    title: "Продажба",
    description: "Широк асортимент от водещи марки на конкурентни цени.",
    extraInfo: "Предлагаме пълната гама на Daikin, Mitsubishi Electric, Gree и Fujitsu. Осигуряваме гъвкави схеми на изплащане чрез TBI Bank и UniCredit. Всеки закупен климатик идва с пълна техническа документация и официална гаранция от производителя.",
    icon: <Zap className="w-6 h-6 text-yellow-500" />,
    color: "yellow",
    features: ["Оригинални продукти", "Официална гаранция", "Безплатна консултация", "Доставка в Смолян"]
  },
  {
    id: 'install',
    title: "Монтаж",
    description: "Професионален монтаж от сертифицирани техници до 48 часа.",
    extraInfo: "Стандартният монтаж включва до 3 метра тръбен път, вакуумиране на системата с професионални помпи и пускане в експлоатация. Използваме само висококачествени материали (медни тръби с дебела изолация) и професионални инструменти за минимално запрашаване.",
    icon: <Wrench className="w-6 h-6 text-blue-500" />,
    color: "blue",
    features: ["Монтаж до 48 часа", "Сертифицирани техници", "Гаранция на монтажа", "Чистота на обекта"]
  },
  {
    id: 'service',
    title: "Сервиз",
    description: "Годишно обслужване, почистване и проверка на системата.",
    extraInfo: "Пълната профилактика включва разглобяване и почистване на вътрешното тяло, антибактериална обработка на топлообменника, проверка на налягането на фреона и почистване на кондензната вана. Редовният сервиз намалява консумацията на ток с до 20%.",
    icon: <Clock className="w-6 h-6 text-cyan-500" />,
    color: "cyan",
    features: ["Почистване на филтри", "Проверка на хладагент", "Пълна диагностика", "Оптимизация на работата"]
  },
  {
    id: 'repair',
    title: "Ремонт",
    description: "Бърз ремонт на всички марки с оригинални части.",
    extraInfo: "Диагностицираме и отстраняваме проблеми с компресори, платки, вентилатори и изтичане на фреон. Разполагаме с голям склад за резервни части за най-популярните модели. Даваме 12 месеца гаранция за всеки извършен ремонт.",
    icon: <Thermometer className="w-6 h-6 text-purple-500" />,
    color: "purple",
    features: ["Всички марки и модели", "Оригинални части", "Диагностика на място", "Гаранция на ремонта"]
  }
];

export const ServicesSection = () => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <section className="py-24 bg-white overflow-hidden" id="services">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header Row */}
        <div className="flex flex-col lg:flex-row justify-between items-end gap-10 mb-16">
          <div className="max-w-xl">
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              className="text-transparent bg-clip-text bg-gradient-to-r from-[#00B4D8] to-[#0077B6] font-bold tracking-[0.2em] text-[10px] uppercase mb-4 block"
            >
              УСЛУГИ
            </motion.span>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              className="text-[2.5rem] md:text-[3.5rem] font-black text-gray-900 mb-6 leading-[1.1] tracking-tight"
            >
              Всичко от <span className="relative inline-block whitespace-nowrap">
                <span className="absolute -inset-1 blur-lg bg-gradient-to-r from-[#FF4D00]/30 to-[#FF2A4D]/30 opacity-70"></span>
                <span className="relative text-transparent bg-clip-text bg-gradient-to-r from-[#FF4D00] via-[#FF6A00] to-[#FF2A4D] drop-shadow-sm">
                  едно място
                </span>
              </span>
            </motion.h2>
          </div>

          {/* Glass Consultation Banner */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            className="w-full lg:max-w-[420px] bg-gradient-to-br from-[#00B4D8]/10 to-indigo-50/50 backdrop-blur-md rounded-[2.5rem] p-7 border border-white shadow-xl shadow-[#00B4D8]/5 flex gap-5 relative group overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shrink-0 shadow-sm shadow-[#00B4D8]/10">
              <Phone className="w-5 h-5 text-[#00B4D8]" />
            </div>
            <div>
              <h4 className="text-gray-900 font-bold mb-1">Безплатна консултация</h4>
              <p className="text-gray-500 text-xs mb-3 leading-relaxed">Помощ при избор на правилния климатик.</p>
              <a href="tel:0888585816" className="text-[#0077B6] font-black flex items-center gap-2 group/link">
                0888 58 58 16
                <div className="w-6 h-6 bg-[#0077B6] text-white rounded-full flex items-center justify-center group-hover/link:translate-x-1 transition-transform">
                  <ArrowRight className="w-3 h-3" />
                </div>
              </a>
            </div>
          </motion.div>
        </div>

        {/* Services Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {services.map((service, idx) => {
            const isExpanded = expandedId === service.id;
            const colors = {
              yellow: "text-yellow-600 bg-yellow-500/10 hover:bg-yellow-500/20",
              blue: "text-blue-600 bg-blue-500/10 hover:bg-blue-500/20",
              cyan: "text-cyan-600 bg-cyan-500/10 hover:bg-cyan-500/20",
              purple: "text-purple-600 bg-purple-500/10 hover:bg-purple-500/20",
            }[service.color as keyof typeof colors];

            const dotColor = {
              yellow: "bg-yellow-500",
              blue: "bg-blue-500",
              cyan: "bg-cyan-500",
              purple: "bg-purple-500",
            }[service.color as keyof typeof dotColor];

            return (
              <motion.div
                key={service.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.05 }}
                className={`group relative bg-gray-50/50 rounded-[2rem] border border-transparent hover:border-white hover:bg-white hover:shadow-2xl transition-all duration-500 overflow-hidden ${isExpanded ? 'ring-2 ring-gray-100 bg-white shadow-2xl' : ''}`}
              >
                {/* Modern Hover Background Effect */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-gray-100/50 to-transparent rounded-bl-[5rem] -mr-10 -mt-10 group-hover:scale-110 transition-transform duration-700" />

                <div className="p-8 lg:p-10 relative z-10">
                  <div className="flex justify-between items-start mb-6">
                    <motion.div
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-lg shadow-gray-200/50"
                    >
                      {service.icon}
                    </motion.div>
                    <div className="flex gap-1.5">
                      {service.features.slice(0, 2).map((_, i) => (
                        <div key={i} className={`w-1.5 h-1.5 rounded-full ${dotColor} opacity-20`} />
                      ))}
                    </div>
                  </div>

                  <h3 className="text-xl font-black text-gray-900 mb-2">{service.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed mb-6 line-clamp-2">{service.description}</p>

                  <div className="flex flex-wrap gap-y-2 gap-x-4 mb-8">
                    {service.features.map((feature, fIdx) => (
                      <div key={fIdx} className="flex items-center gap-1.5">
                        <div className={`w-1 h-1 rounded-full ${dotColor}`} />
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{feature}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : service.id)}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all duration-300 ${colors}`}
                    >
                      {isExpanded ? 'Затвори' : 'Научи повече'}
                      <ChevronDown className={`w-4 h-4 transition-transform duration-500 ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>

                    {!isExpanded && (
                      <div className="flex -space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-gray-200" />
                        ))}
                      </div>
                    )}
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.4, ease: "circOut" }}
                        className="overflow-hidden"
                      >
                        <div className="pt-8 mt-8 border-t border-gray-100">
                          <p className="text-gray-600 text-sm leading-[1.6] bg-gray-50 p-6 rounded-2xl border border-gray-100">
                            {service.extraInfo}
                          </p>
                          <div className="mt-6 flex items-center gap-4">
                            <a href="#contact" className="flex-1 flex items-center justify-center py-3 bg-gradient-to-r from-[#FF4D00] via-[#FF6A00] to-[#FF2A4D] text-white rounded-xl font-bold text-xs hover:shadow-lg hover:shadow-[#FF4D00]/20 transition-all hover:-translate-y-0.5">
                              Заяви оглед
                            </a>
                            <a href="tel:0888585816" className="w-12 h-12 flex items-center justify-center bg-gradient-to-r from-[#00B4D8] to-[#0077B6] text-white rounded-xl hover:shadow-lg hover:shadow-[#00B4D8]/20 transition-all hover:-translate-y-0.5">
                              <Phone className="w-4 h-4" />
                            </a>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

