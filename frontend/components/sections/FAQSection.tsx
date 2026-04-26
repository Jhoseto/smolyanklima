import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, ArrowRight, Plus, Minus, HelpCircle } from 'lucide-react';

const faqs = [
  {
    question: "Какво включва стандартният монтаж на климатик?",
    answer: "Стандартният монтаж е комплексна услуга, която гарантира дълготрайната работа на уреда. Тя включва:\n• До 3 метра меден тръбен път с висококачествена термоизолация.\n• Пробиване на един отвор (до 40 см) в тухлена или бетонна стена.\n• Монтаж на вътрешно и външно тяло със специализирани стойки.\n• Вакуумиране на системата с професионална помпа (задължително условие за гаранцията).\n• Електрическо свързване и тест на всички режими."
  },
  {
    question: "Колко време отнема инсталацията?",
    answer: "Времето за монтаж зависи от спецификата на обекта, но при стандартни условия отнема между 2 и 4 часа. Нашият екип работи бързо, но никога за сметка на качеството. Винаги използваме професионални прахосмукачки, за да оставим дома ви чист след приключване на работата."
  },
  {
    question: "Предлагате ли покупка на климатик на изплащане?",
    answer: "Да, работим с водещи финансови институции (TBI Bank и UniCredit). Можете да кандидатствате за одобрение изцяло онлайн или на място при нас. Предлагаме гъвкави схеми на изплащане до 36 месеца, често и с 0% лихва за определени промоционални модели."
  },
  {
    question: "Защо е задължителна годишната профилактика?",
    answer: "Профилактиката не е просто почистване на филтрите. Тя включва:\n• Дълбоко почистване на топлообменника с антибактериални препарати.\n• Замерване на работното налягане на фреона.\n• Проверка на електрическите връзки и компресора.\nРедовната профилактика удължава живота на уреда, запазва гаранцията му и намалява сметките за ток с до 20-30%."
  },
  {
    question: "Каква е гаранцията на климатиците и монтажа?",
    answer: "Всички климатици, които предлагаме, са с пълна официална гаранция от производителя (обикновено между 3 и 5 години, в зависимост от марката). Допълнително, Smolyan Klima дава и собствена гаранция за качеството на извършения монтаж."
  },
  {
    question: "Как да избера правилната мощност за моето помещение?",
    answer: "Изборът на мощност (BTU) зависи от много фактори: квадратура, кубатура, изложение, изолация и вид на дограмата. Най-добрият начин е да заявите безплатен оглед. Нашите специалисти ще посетят обекта, ще направят нужните изчисления и ще ви предложат оптимални варианти."
  }
];

export const FAQSection = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="py-24 bg-[#FAFAFA] overflow-hidden relative" id="faq">

      {/* Decorative Blobs for Glassmorphism */}
      <div className="absolute top-20 left-0 w-[500px] h-[500px] bg-[#00B4D8]/10 rounded-full blur-[100px] -translate-x-1/2 pointer-events-none" />
      <div className="absolute bottom-20 right-0 w-[600px] h-[600px] bg-[#FF4D00]/5 rounded-full blur-[120px] translate-x-1/3 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-20 items-start">
          
          {/* Left Column (Sticky Content) */}
          <div className="lg:col-span-5 lg:sticky lg:top-32 space-y-10">
            
            <div>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="inline-flex items-center justify-center p-3 bg-white rounded-2xl mb-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-gray-100"
              >
                <HelpCircle className="w-6 h-6 text-[#FF4D00]" />
              </motion.div>
              
              <motion.span
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-[#FF4D00] text-[10px] font-bold tracking-[0.3em] uppercase mb-4 block"
              >
                ПОМОЩЕН ЦЕНТЪР
              </motion.span>
              
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="font-outfit text-[2.5rem] md:text-[3.25rem] leading-[1.1] tracking-tight mb-6"
              >
                <span className="relative inline-block mr-3">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00B4D8] to-[#0077B6] drop-shadow-sm font-extralight block">
                    Често задавани
                  </span>
                  <div className="absolute -bottom-1 left-0 right-0 h-1 bg-gradient-to-r from-[#00B4D8]/0 via-[#00B4D8] to-[#00B4D8]/0 opacity-30 rounded-full" />
                </span>
                <span className="relative inline-block whitespace-nowrap mt-2">
                  <span className="absolute -inset-1 blur-lg bg-gradient-to-r from-[#FF4D00]/20 to-[#FF2A4D]/20 opacity-60"></span>
                  <span className="relative text-transparent bg-clip-text bg-gradient-to-r from-[#FF4D00] via-[#FF6A00] to-[#FF2A4D] font-black uppercase drop-shadow-sm">
                    въпроси
                  </span>
                </span>
              </motion.h2>
              
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="text-gray-500 text-lg leading-relaxed max-w-md"
              >
                Всичко, което трябва да знаете за избора, монтажа и поддръжката на вашия климатик.
              </motion.p>
            </div>

            {/* CTA Section (Moved to left sticky column) */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-[2.5rem] p-8 md:p-10 relative overflow-hidden shadow-2xl shadow-gray-900/20"
            >
              <div className="absolute inset-0 bg-[url('/images/pattern-bg.svg')] opacity-5" />
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#FF4D00] rounded-full blur-[80px] opacity-20 pointer-events-none" />
              
              <div className="relative z-10">
                <h3 className="text-2xl font-outfit font-bold text-white mb-3">
                  Още въпроси?
                </h3>
                <p className="text-gray-400 text-sm mb-8 leading-relaxed">
                  Нашите експерти са на разположение за безплатна консултация.
                </p>
                <div className="flex flex-col gap-4">
                  <a href="#contact-info" className="w-full px-6 h-14 bg-gradient-to-r from-[#FF4D00] via-[#FF6A00] to-[#FF2A4D] text-white rounded-full font-bold text-base hover:shadow-[0_10px_30px_rgba(255,77,0,0.4)] transition-all hover:-translate-y-1 flex items-center justify-center gap-2 group">
                    Свържете се с нас
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </a>
                  <a href="tel:0888585816" className="w-full px-6 h-14 bg-white/10 text-white border border-white/20 rounded-full font-bold text-base hover:bg-white/20 transition-all flex items-center justify-center gap-2 backdrop-blur-sm">
                    <MessageCircle className="w-5 h-5" />
                    0888 58 58 16
                  </a>
                </div>
              </div>
            </motion.div>

          </div>

          {/* Right Column (Accordion List) */}
          <div className="lg:col-span-7 space-y-5">
            {faqs.map((faq, index) => {
              const isOpen = openIndex === index;

              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className={`group relative rounded-[2rem] transition-all duration-500 overflow-hidden backdrop-blur-2xl border ${
                    isOpen
                      ? 'bg-white border-[#FF4D00]/20 shadow-[0_20px_40px_rgba(255,77,0,0.06)] ring-1 ring-[#FF4D00]/10 scale-[1.02]'
                      : 'bg-white/60 border-gray-200/60 hover:border-[#00B4D8]/30 hover:bg-white hover:shadow-[0_10px_30px_rgba(0,180,216,0.06)]'
                  }`}
                >
                  <button
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                    className="w-full px-6 py-6 sm:px-8 sm:py-7 flex items-start sm:items-center justify-between text-left focus:outline-none relative z-10 gap-4"
                  >
                    <span className={`text-lg sm:text-xl font-outfit font-bold pr-4 transition-colors duration-300 ${isOpen ? 'text-[#FF4D00]' : 'text-gray-800 group-hover:text-[#00B4D8]'}`}>
                      {faq.question}
                    </span>
                    <div className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 ${
                      isOpen
                        ? 'bg-gradient-to-br from-[#FF4D00] to-[#FF2A4D] text-white shadow-lg shadow-[#FF4D00]/30 rotate-180'
                        : 'bg-white text-[#00B4D8] border border-gray-100 shadow-sm group-hover:bg-[#00B4D8]/10 group-hover:border-transparent'
                      }`}
                    >
                      {isOpen ? <Minus className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                    </div>
                  </button>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.4, ease: "easeInOut" }}
                      >
                        <div className="px-6 pb-8 sm:px-8 sm:pb-8 pt-0">
                          <motion.div 
                            initial={{ y: -10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.1, duration: 0.4 }}
                            className="bg-gray-50/80 p-6 rounded-2xl border border-gray-100/50"
                          >
                            <p className="text-gray-600 text-[15px] sm:text-base leading-[1.8] whitespace-pre-line font-medium">
                              {faq.answer}
                            </p>
                          </motion.div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Subtle active glow on the left edge */}
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-[#FF4D00] via-[#FF6A00] to-[#FF2A4D] transition-transform duration-500 origin-top ${
                      isOpen ? 'scale-y-100' : 'scale-y-0'
                    }`}
                  />
                </motion.div>
              );
            })}
          </div>

        </div>
      </div>
    </section>
  );
};
