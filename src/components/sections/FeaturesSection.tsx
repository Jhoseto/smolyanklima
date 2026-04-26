import React from 'react';
import { motion } from 'motion/react';
import { Home, Building2, Briefcase, Check } from 'lucide-react';

const features = [
  {
    icon: <Home className="w-8 h-8 text-[#3B82F6]" strokeWidth={1.5} />,
    title: "Апартамент",
    description: "Компактни, тихи решения за малки и средни пространства до 50 м²",
    bgColor: "bg-[#F0F7FF]", // Light Blue
    colorClass: "text-[#3B82F6]",
    list: [
      "9 000 - 12 000 BTU",
      "Инвертор технология",
      "WiFi управление"
    ],
    delay: 0.1,
  },
  {
    icon: <Building2 className="w-8 h-8 text-[#8B5CF6]" strokeWidth={1.5} />,
    title: "Къща",
    description: "Мощни мулти-сплит системи за цялостно климатизиране на дома",
    bgColor: "bg-[#F5F3FF]", // Light Purple
    colorClass: "text-[#8B5CF6]",
    list: [
      "12 000 - 24 000 BTU",
      "Мулти-сплит опции",
      "Ниска консумация"
    ],
    delay: 0.2,
  },
  {
    icon: <Briefcase className="w-8 h-8 text-[#06B6D4]" strokeWidth={1.5} />,
    title: "Офис",
    description: "Енергийно ефективни и тихи решения за продуктивна работна среда",
    bgColor: "bg-[#F0FDFA]", // Light Cyan
    colorClass: "text-[#06B6D4]",
    list: [
      "Ултра тих режим",
      "Офис серии",
      "Централно управление"
    ],
    delay: 0.3,
  }
];

export const FeaturesSection = () => {
  return (
    <section id="features" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center mb-16">
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-[11px] font-bold tracking-widest text-[#00B4D8] uppercase mb-4"
          >
            Намери своето решение
          </motion.p>
          <motion.h2 
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-3xl md:text-[2.5rem] font-bold text-gray-900 mb-4"
          >
            Климатик за <span className="text-[#FF4D00]">всяко пространство</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-gray-600 text-sm md:text-base font-medium"
          >
            Консултираме ви безплатно за избора на правилния модел и мощност
          </motion.p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: feature.delay }}
              whileHover={{ y: -5 }}
              className={`${feature.bgColor} rounded-[2rem] p-8 md:p-10 transition-all hover:shadow-xl hover:shadow-gray-200/50 flex flex-col h-full border border-transparent hover:border-white`}
            >
              <div className="mb-6">
                {feature.icon}
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">{feature.title}</h3>
              <p className="text-gray-600 leading-relaxed text-sm font-medium mb-8">
                {feature.description}
              </p>
              
              <ul className="space-y-3 mb-10 mt-auto">
                {feature.list.map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-gray-700 font-medium">
                    <Check className={`w-4 h-4 ${feature.colorClass}`} />
                    {item}
                  </li>
                ))}
              </ul>
              
              <div>
                <a href="#" className={`inline-flex items-center text-sm font-bold ${feature.colorClass} hover:opacity-80 transition-opacity`}>
                  Виж оферти 
                  <svg className="w-4 h-4 ml-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </a>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

