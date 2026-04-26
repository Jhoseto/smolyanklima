import React from 'react';
import { motion } from 'motion/react';
import { Star, Zap, Snowflake, Repeat, ShoppingCart, Check, ChevronRight } from 'lucide-react';

const products = [
  {
    id: 1,
    brand: "DAIKIN",
    model: "Perfera FTXM25R",
    type: "Стенен климатик",
    image: "/images/daikin-perfera.jpg",
    price: "659",
    priceWithMount: "812",
    rating: 4.9,
    reviews: 47,
    energyClass: "A+++",
    badge: { text: "Bestseller", bg: "bg-yellow-100", textCol: "text-yellow-700" },
    specs: [
      { icon: <Zap className="w-3.5 h-3.5 text-yellow-500" />, text: "2.5 kW" },
      { icon: <Snowflake className="w-3.5 h-3.5 text-blue-500" />, text: "Охл/Отопл" },
      { icon: <Repeat className="w-3.5 h-3.5 text-teal-500" />, text: "Инвертор" },
    ],
    extras: ["Инвертор", "WiFi управление", "Нощен режим"],
    cardBorder: "border-blue-200 shadow-blue-100/50",
    imgBg: "bg-gray-50"
  },
  {
    id: 2,
    brand: "MITSUBISHI",
    model: "MSZ-LN35VG",
    type: "Стенен климатик",
    image: "/images/mitsubishi-msz.jpg",
    price: "761",
    priceWithMount: "914",
    rating: 4.8,
    reviews: 31,
    energyClass: "A+++",
    badge: { text: "Premium", bg: "bg-blue-100", textCol: "text-blue-700" },
    specs: [
      { icon: <Zap className="w-3.5 h-3.5 text-yellow-500" />, text: "3.5 kW" },
      { icon: <Snowflake className="w-3.5 h-3.5 text-blue-500" />, text: "Охл/Отопл" },
      { icon: <Repeat className="w-3.5 h-3.5 text-teal-500" />, text: "Инвертор" },
    ],
    extras: ["3D i-see сензор", "Плазмен филтър", "Супер тих"],
    cardBorder: "border-gray-200",
    imgBg: "bg-white"
  },
  {
    id: 3,
    brand: "SAMSUNG",
    model: "WindFree Comfort",
    type: "Стенен климатик",
    image: "/images/samsung-windfree.jpg",
    price: "500",
    priceWithMount: "653",
    rating: 4.7,
    reviews: 58,
    energyClass: "A++",
    badge: { text: "Топ оферта", bg: "bg-green-100", textCol: "text-green-700" },
    specs: [
      { icon: <Zap className="w-3.5 h-3.5 text-yellow-500" />, text: "3.5 kW" },
      { icon: <Snowflake className="w-3.5 h-3.5 text-blue-500" />, text: "Охл/Отопл" },
      { icon: <Repeat className="w-3.5 h-3.5 text-teal-500" />, text: "Инвертор" },
    ],
    extras: ["WindFree™", "AI Auto Cooling", "SmartThings"],
    cardBorder: "border-gray-200",
    imgBg: "bg-gray-100"
  },
  {
    id: 4,
    brand: "GREE",
    model: "Fairy GWH12ACC",
    type: "Стенен климатик",
    image: "/images/gree-fairy.jpg",
    price: "536",
    priceWithMount: "689",
    rating: 4.6,
    reviews: 82,
    energyClass: "A++",
    badge: null,
    specs: [
      { icon: <Zap className="w-3.5 h-3.5 text-yellow-500" />, text: "3.5 kW" },
      { icon: <Snowflake className="w-3.5 h-3.5 text-blue-500" />, text: "Охл/Отопл" },
      { icon: <Repeat className="w-3.5 h-3.5 text-teal-500" />, text: "Инвертор" },
    ],
    extras: ["Йонизатор", "Самопочистване", "WiFi управление"],
    cardBorder: "border-gray-200",
    imgBg: "bg-white"
  },
  {
    id: 5,
    brand: "DAIKIN",
    model: "Sensira FTXF35D",
    type: "Стенен климатик",
    image: "/images/daikin-sensira.jpg",
    price: "587",
    priceWithMount: "740",
    rating: 4.8,
    reviews: 124,
    energyClass: "A++",
    badge: { text: "Надежден", bg: "bg-gray-100", textCol: "text-gray-700" },
    specs: [
      { icon: <Zap className="w-3.5 h-3.5 text-yellow-500" />, text: "3.3 kW" },
      { icon: <Snowflake className="w-3.5 h-3.5 text-blue-500" />, text: "Охл/Отопл" },
      { icon: <Repeat className="w-3.5 h-3.5 text-teal-500" />, text: "Инвертор" },
    ],
    extras: ["Тих режим 20dBA", "Икономичен", "Компактен"],
    cardBorder: "border-gray-200",
    imgBg: "bg-gray-50"
  },
  {
    id: 6,
    brand: "FUJITSU",
    model: "ASYG12KMTB",
    type: "Стенен климатик",
    image: "/images/fujitsu-asyg.jpg",
    price: "709",
    priceWithMount: "862",
    rating: 4.7,
    reviews: 19,
    energyClass: "A++",
    badge: null,
    specs: [
      { icon: <Zap className="w-3.5 h-3.5 text-yellow-500" />, text: "3.4 kW" },
      { icon: <Snowflake className="w-3.5 h-3.5 text-blue-500" />, text: "Охл/Отопл" },
      { icon: <Repeat className="w-3.5 h-3.5 text-teal-500" />, text: "Инвертор" },
    ],
    extras: ["Слим дизайн", "Сензор за присъствие", "Турбо режим"],
    cardBorder: "border-gray-200",
    imgBg: "bg-gray-50"
  }
];

export const ProductsSection = () => {
  return (
    <section id="products" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="font-outfit text-[2.25rem] md:text-[3.25rem] leading-[1.1] tracking-tighter"
          >
            <span className="relative inline-block mb-2">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00B4D8] to-[#0077B6] drop-shadow-sm font-extralight block">
                Топ
              </span>
              <div className="absolute -bottom-1 left-4 right-4 h-1 bg-gradient-to-r from-[#00B4D8]/0 via-[#00B4D8] to-[#00B4D8]/0 opacity-40 rounded-full" />
            </span>
            <br />
            <span className="relative inline-block whitespace-nowrap">
              <span className="absolute -inset-2 blur-xl bg-gradient-to-r from-[#FF4D00]/20 to-[#FF2A4D]/20 opacity-70"></span>
              <span className="relative text-transparent bg-clip-text bg-gradient-to-r from-[#FF4D00] via-[#FF6A00] to-[#FF2A4D] font-black uppercase drop-shadow-md">
                продукти
              </span>
            </span>
          </motion.h2>
        </div>

        {/* Product Grid - Exactly 6 cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {products.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`bg-white rounded-[2rem] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border ${product.cardBorder} flex flex-col group`}
            >
              {/* Image Area */}
              <div className={`relative h-56 overflow-hidden ${product.imgBg ?? 'bg-gray-50'}`}>
                <img
                  src={product.image}
                  alt={product.model}
                  className="w-full h-full object-contain p-4 transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-80" />

                {/* Top Badges */}
                <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
                  {product.badge ? (
                    <span className={`px-4 py-1.5 rounded-full text-xs font-bold ${product.badge.bg} ${product.badge.textCol}`}>
                      {product.badge.text}
                    </span>
                  ) : (
                    <div />
                  )}
                  <span className="bg-green-500/90 backdrop-blur-sm text-white text-[10px] font-black tracking-wider px-3 py-1.5 rounded-full">
                    {product.energyClass}
                  </span>
                </div>
              </div>

              {/* Content Area */}
              <div className="p-6 flex flex-col flex-grow">

                <div className="mb-4">
                  <p className="text-xs font-bold text-[#00B4D8] uppercase tracking-wider mb-1">{product.brand}</p>
                  <h3 className="text-[1.35rem] font-bold text-gray-900 leading-tight mb-1">{product.model}</h3>
                  <p className="text-sm text-gray-500">{product.type}</p>
                </div>

                {/* Quick Specs */}
                <div className="flex flex-wrap items-center gap-4 mb-4">
                  {product.specs.map((spec, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
                      {spec.icon}
                      {spec.text}
                    </div>
                  ))}
                </div>

                {/* Real Extras (No black background) */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {product.extras.map((extra, i) => (
                    <div key={i} className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-full px-3 py-1 text-xs font-medium text-gray-700">
                      <Check className="w-3 h-3 text-green-500" strokeWidth={3} />
                      {extra}
                    </div>
                  ))}
                </div>

                {/* Rating */}
                <div className="flex items-center gap-1.5 mb-6">
                  <div className="flex text-yellow-400">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`w-4 h-4 ${i < Math.floor(product.rating) ? 'fill-current' : 'fill-gray-200 text-gray-200'}`} />
                    ))}
                  </div>
                  <span className="text-sm font-semibold text-gray-700 ml-1">{product.rating}</span>
                  <span className="text-sm text-gray-500">({product.reviews} отзива)</span>
                </div>

                {/* Price and Action */}
                <div className="flex items-end justify-between mt-auto mb-6">
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold text-gray-900">€{product.price}</span>
                    </div>
                    <p className="text-xs text-gray-500">с монтаж от €{product.priceWithMount}</p>
                  </div>

                  <a href="#contact" className="flex items-center gap-2 bg-[#EBF5FF] text-[#00B4D8] hover:bg-[#00B4D8] hover:text-white transition-colors px-6 py-2.5 rounded-full font-bold text-sm shadow-sm hover:shadow-md">
                    Направи запитване
                  </a>
                </div>

                {/* Bottom Link */}
                <div className="text-center pt-4 border-t border-gray-100">
                  <a href="#" className="inline-flex items-center text-xs font-semibold text-gray-500 hover:text-[#FF4D00] transition-colors">
                    Виж пълни характеристики
                    <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </a>
                </div>

              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
};

