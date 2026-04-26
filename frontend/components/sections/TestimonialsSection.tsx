import React from 'react';
import { motion } from 'motion/react';
import { Star, Quote, ArrowRight, Check } from 'lucide-react';

const reviews = [
  {
    id: 1,
    name: "Иван Караколев",
    date: "преди 2 дни",
    text: "Много съм доволен от монтажа. Момчетата работиха чисто и бързо. Климатикът работи перфектно и е много тих. Препоръчвам горещо!",
    rating: 5,
    source: "Google",
    color: "from-orange-400 to-orange-600",
  },
  {
    id: 2,
    name: "Мария Тодорова",
    date: "преди 1 седмица",
    text: "Страхотно обслужване! Консултираха ме професионално и ми помогнаха да избера най-добрия модел за моя хол. Монтажът беше направен на следващия ден.",
    rating: 5,
    source: "Facebook",
    color: "from-blue-500 to-blue-700",
  },
  {
    id: 3,
    name: "Петър Стоянов",
    date: "преди 2 седмици",
    text: "Отлична работа! Цените са много добри, а отношението е на високо ниво. Със сигурност ще ги потърся отново за профилактика.",
    rating: 5,
    source: "Google",
    color: "from-orange-400 to-orange-600",
  },
  {
    id: 4,
    name: "Елена Димитрова",
    date: "преди 1 месец",
    text: "Имахме спешна нужда от климатик в жегите. Отзоваха се веднага. Много учтиви и внимателни момчета. Благодаря ви!",
    rating: 5,
    source: "Google",
    color: "from-orange-400 to-orange-600",
  },
  {
    id: 5,
    name: "Георги Стратиев",
    date: "преди 2 месеца",
    text: "Професионалисти от всякъде. Изградиха ни цялостна мултисплит система. Всичко работи безупречно. Силно препоръчвам услугите им.",
    rating: 5,
    source: "Facebook",
    color: "from-blue-500 to-blue-700",
  },
  {
    id: 6,
    name: "Нина Тодорова",
    date: "преди 3 месеца",
    text: "Бързи, точни и коректни. Климатикът беше монтиран точно в уговорения час. Оставиха чисто след себе си.",
    rating: 5,
    source: "Google",
    color: "from-orange-400 to-orange-600",
  }
];

export const TestimonialsSection = () => {
  // Double the reviews for seamless marquee
  const extendedReviews = [...reviews, ...reviews];

  return (
    <section id="testimonials" className="py-24 bg-white overflow-hidden relative">
      {/* Decorative background blur */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-7xl pointer-events-none opacity-30">
        <div className="absolute top-0 left-0 w-96 h-96 bg-[#00B4D8]/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#FF4D00]/10 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 mb-16">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-12 text-center lg:text-left">
          <div className="max-w-2xl">
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-[#FF4D00] text-[10px] font-bold tracking-[0.3em] uppercase mb-5 block"
            >
              ОТЗИВИ ОТ КЛИЕНТИ
            </motion.span>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="font-outfit text-[2.5rem] md:text-[3.25rem] leading-[1.1] tracking-tight"
            >
              <span className="relative inline-block">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00B4D8] to-[#0077B6] drop-shadow-sm font-extralight block">
                  Доверието на
                </span>
                <div className="absolute -bottom-1 left-0 right-0 h-1 bg-gradient-to-r from-[#00B4D8]/0 via-[#00B4D8] to-[#00B4D8]/0 opacity-30 rounded-full" />
              </span>
              <br />
              <span className="relative inline-block whitespace-nowrap">
                <span className="absolute -inset-1 blur-lg bg-gradient-to-r from-[#FF4D00]/20 to-[#FF2A4D]/20 opacity-60"></span>
                <span className="relative text-transparent bg-clip-text bg-gradient-to-r from-[#FF4D00] via-[#FF6A00] to-[#FF2A4D] font-black uppercase drop-shadow-sm">
                  нашите клиенти
                </span>
              </span>
            </motion.h2>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-7 bg-white border border-gray-100/50 px-8 py-5 rounded-[2.5rem] shadow-[0_15px_40px_rgba(0,0,0,0.04)] hover:shadow-[0_20px_50px_rgba(0,0,0,0.08)] transition-all duration-500 group"
          >
            <div className="relative">
              <div className="text-4xl font-black text-[#1F2937] leading-none tracking-tighter">4.9</div>
            </div>
            
            <div className="h-10 w-[1.5px] bg-gray-100" />
            
            <div className="flex flex-col items-start">
              <div className="flex gap-0.5 mb-2">
                {[1, 2, 3, 4, 5].map(star => (
                  <Star key={star} className="w-5 h-5 text-[#F9AB00] fill-[#F9AB00] transition-transform group-hover:scale-110" />
                ))}
              </div>
              <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.25em] leading-none">
                РЕАЛНИ ОЦЕНКИ В <span className="text-[#4285F4]">G</span><span className="text-[#EA4335]">O</span><span className="text-[#FBBC05]">O</span><span className="text-[#4285F4]">G</span><span className="text-[#34A853]">L</span><span className="text-[#EA4335]">E</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Infinite Marquee Carousel */}
      <div className="relative flex overflow-hidden group">
        <motion.div
          animate={{ x: [0, "-50%"] }}
          transition={{
            duration: 40,
            repeat: Infinity,
            ease: "linear",
          }}
          className="flex gap-6 whitespace-nowrap py-4 px-4"
        >
          {extendedReviews.map((review, index) => (
            <div
              key={`${review.id}-${index}`}
              className="w-[260px] md:w-[300px] shrink-0 bg-white/80 backdrop-blur-sm border border-gray-100/80 rounded-[1.5rem] p-5 transition-all duration-500 hover:shadow-xl hover:shadow-gray-200/40 hover:border-[#FF4D00]/20 group/card flex flex-col justify-between"
            >
              <div className="flex justify-between items-center mb-4">
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className="w-2.5 h-2.5 text-[#FFD700] fill-[#FFD700]"
                    />
                  ))}
                </div>
                <div className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest ${review.source === 'Google' ? 'bg-orange-50 text-[#FF4D00]' : 'bg-blue-50 text-[#1877F2]'}`}>
                  {review.source}
                </div>
              </div>

              <p className="text-gray-600 text-[13px] leading-relaxed mb-6 italic font-medium whitespace-normal mt-2">
                "{review.text}"
              </p>

              <div className="flex items-center justify-between border-t border-gray-50/50 pt-5 mt-auto">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${review.color} flex items-center justify-center text-white font-black text-xs shadow-sm`}>
                    {review.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 text-[11px] tracking-tight leading-none mb-1.5">{review.name}</h4>
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{review.date}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </motion.div>

        {/* Gradients on edges for smooth fading */}
        <div className="absolute top-0 left-0 w-1/4 md:w-1/3 h-full bg-gradient-to-r from-white via-white/80 to-transparent z-10 pointer-events-none" />
        <div className="absolute top-0 right-0 w-1/4 md:w-1/3 h-full bg-gradient-to-l from-white via-white/80 to-transparent z-10 pointer-events-none" />
      </div>

    </section>
  );
};
