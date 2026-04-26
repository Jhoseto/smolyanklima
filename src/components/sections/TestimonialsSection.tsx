import React from 'react';
import { motion } from 'motion/react';
import { Star, Quote, ArrowRight } from 'lucide-react';

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
        <div className="flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
          <div className="max-w-2xl">
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-[#FF4D00] text-xs font-bold tracking-[0.3em] uppercase mb-4 block"
            >
              ОТЗИВИ
            </motion.span>
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-4xl md:text-5xl font-black text-gray-900 mb-6 tracking-tight"
            >
              Доверието на <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF4D00] to-[#FF2A4D]">нашите клиенти</span>
            </motion.h2>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="flex items-center gap-6 bg-white/50 backdrop-blur-md border border-gray-100 p-6 rounded-[2.5rem] shadow-xl shadow-gray-100/50"
          >
            <div className="text-4xl font-black text-gray-900">4.9</div>
            <div className="h-10 w-[1px] bg-gray-200" />
            <div>
              <div className="flex gap-1 mb-1">
                {[1, 2, 3, 4, 5].map(star => (
                  <Star key={star} className="w-4 h-4 text-[#FFD700] fill-[#FFD700]" />
                ))}
              </div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Оценка в Google Maps
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
              className="w-[380px] md:w-[450px] shrink-0 bg-white border border-gray-100 rounded-[2.5rem] p-8 md:p-10 shadow-[0_10px_40px_rgba(0,0,0,0.02)] transition-all duration-500 hover:shadow-[0_20px_60px_rgba(0,0,0,0.06)] hover:border-[#FF4D00]/10 hover:-translate-y-2 group/card"
            >
              <div className="flex justify-between items-start mb-8">
                <div className="flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className="w-4 h-4 text-[#FFD700] fill-[#FFD700]"
                    />
                  ))}
                </div>
                <Quote className="w-10 h-10 text-gray-50 opacity-10 group-hover/card:text-[#FF4D00] group-hover/card:opacity-20 transition-all duration-500" />
              </div>

              <p className="text-gray-700 text-base md:text-lg font-medium leading-relaxed whitespace-normal mb-10 italic">
                "{review.text}"
              </p>

              <div className="flex items-center justify-between border-t border-gray-50 pt-8">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${review.color} flex items-center justify-center text-white font-black text-xl shadow-lg shadow-gray-200/50`}>
                    {review.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 text-sm tracking-tight">{review.name}</h4>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{review.date}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-full border border-gray-100">
                  <span className="text-[10px] font-black text-gray-400">VIA</span>
                  <span className={`text-[10px] font-black uppercase ${review.source === 'Google' ? 'text-[#FF4D00]' : 'text-[#1877F2]'}`}>
                    {review.source}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </motion.div>
        
        {/* Gradients on edges for smooth fading */}
        <div className="absolute top-0 left-0 w-32 h-full bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
        <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
      </div>

      <div className="mt-20 text-center relative z-10">
        <motion.a 
          whileHover={{ x: 5 }}
          href="https://google.com" 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center gap-3 text-xs font-bold text-gray-500 hover:text-[#FF4D00] transition-all tracking-[0.2em] uppercase bg-gray-50/50 px-8 py-4 rounded-full border border-gray-100 backdrop-blur-sm"
        >
          Вижте всички отзиви в Google Maps
          <ArrowRight className="w-4 h-4" />
        </motion.a>
      </div>
    </section>
  );
};
