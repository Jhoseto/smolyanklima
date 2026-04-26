import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, MessageCircle, ArrowRight } from 'lucide-react';

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
    <section className="py-24 bg-white overflow-hidden relative" id="faq">

      {/* Background Decorative Elements */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-[#00B4D8]/5 to-[#0077B6]/5 rounded-full blur-3xl opacity-50 translate-x-1/3 -translate-y-1/3 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-[#FF4D00]/5 to-[#FF2A4D]/5 rounded-full blur-3xl opacity-50 -translate-x-1/3 translate-y-1/3 pointer-events-none" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

        {/* Header */}
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center justify-center p-3 bg-gray-50 rounded-2xl mb-6 shadow-sm border border-gray-100"
          >
            <MessageCircle className="w-6 h-6 text-[#FF4D00]" />
          </motion.div>
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-[#FF4D00] text-[10px] font-bold tracking-[0.3em] uppercase mb-5 block"
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
            <span className="relative inline-block whitespace-nowrap">
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
            className="text-gray-500 text-lg leading-relaxed max-w-2xl mx-auto"
          >
            Всичко, което трябва да знаете за избора, монтажа и поддръжката на вашия климатик.
          </motion.p>
        </div>

        {/* FAQs List */}
        <div className="space-y-4">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                className={`group relative bg-white rounded-[1.5rem] border transition-all duration-500 overflow-hidden ${isOpen
                    ? 'border-[#FF4D00]/30 shadow-[0_20px_40px_rgba(255,77,0,0.08)] ring-1 ring-[#FF4D00]/20'
                    : 'border-gray-100 hover:border-[#00B4D8]/30 hover:shadow-[0_8px_30px_rgba(0,180,216,0.06)]'
                  }`}
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="w-full px-6 py-6 sm:px-8 sm:py-7 flex items-center justify-between text-left focus:outline-none relative z-10"
                >
                  <span className={`text-lg sm:text-xl font-bold pr-8 transition-colors duration-300 ${isOpen ? 'text-[#FF4D00]' : 'text-[#0077B6] group-hover:text-[#00B4D8]'}`}>
                    {faq.question}
                  </span>
                  <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 ${isOpen
                      ? 'bg-gradient-to-r from-[#FF4D00] via-[#FF6A00] to-[#FF2A4D] text-white shadow-lg shadow-[#FF4D00]/30 rotate-180'
                      : 'bg-[#00B4D8]/10 text-[#0077B6] group-hover:bg-[#00B4D8]/20 group-hover:text-[#00B4D8]'
                    }`}>
                    <ChevronDown className="w-5 h-5" />
                  </div>
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.4, ease: "circOut" }}
                    >
                      <div className="px-6 pb-8 sm:px-8 sm:pb-8 pt-0">
                        <div className="bg-[#F8FAFC] p-6 rounded-2xl border border-gray-50">
                          <p className="text-[#4B5563] text-[15px] leading-[1.8] whitespace-pre-line">
                            {faq.answer}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Active left border accent */}
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#FF4D00] via-[#FF6A00] to-[#FF2A4D] transition-transform duration-500 origin-top ${isOpen ? 'scale-y-100' : 'scale-y-0'
                    }`}
                />
              </motion.div>
            );
          })}
        </div>

        {/* CTA Section below FAQ */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-16 bg-gradient-to-br from-gray-900 to-gray-800 rounded-[2rem] p-8 sm:p-12 text-center relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-[url('/images/pattern-bg.svg')] opacity-5" />
          <div className="relative z-10">
            <h3 className="text-2xl sm:text-3xl font-bold text-white mb-4">
              Не намерихте своя отговор?
            </h3>
            <p className="text-gray-400 mb-8 max-w-lg mx-auto">
              Нашите експерти са на разположение да отговорят на всички ваши въпроси. Свържете се с нас за персонална консултация.
            </p>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
              <a href="#contact" className="w-full sm:w-auto px-8 h-14 bg-gradient-to-r from-[#FF4D00] via-[#FF6A00] to-[#FF2A4D] text-white rounded-full font-bold text-lg hover:shadow-[0_10px_30px_rgba(255,77,0,0.4)] transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2">
                Свържете се с нас
                <ArrowRight className="w-5 h-5" />
              </a>
              <a href="tel:0888585816" className="w-full sm:w-auto px-8 h-14 bg-white/10 text-white border border-white/20 rounded-full font-bold text-lg hover:bg-white/20 transition-all flex items-center justify-center gap-2 backdrop-blur-sm">
                <MessageCircle className="w-5 h-5" />
                0888 58 58 16
              </a>
            </div>
          </div>
        </motion.div>

      </div>
    </section>
  );
};
