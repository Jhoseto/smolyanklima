import React from 'react';
import { motion } from 'motion/react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { PhoneCall, Mail, MapPin } from 'lucide-react';

export const ContactSection = () => {
  return (
    <section id="contact" className="py-20 bg-white relative overflow-hidden">

      {/* Decorative Background Elements */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-orange-50 rounded-full blur-3xl opacity-50 translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-50 rounded-full blur-3xl opacity-50 -translate-x-1/2 translate-y-1/2 pointer-events-none" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

        <div className="text-center mb-12">
          <Badge variant="orange" className="mb-4">Свържете се с нас</Badge>
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4"
          >
            Консултирай се <span className="text-[#FF4D00]">на място</span>
          </motion.h2>
          <p className="text-gray-600">
            Оставете вашите контакти и ние ще се свържем с вас в рамките на деня, за да уговорим безплатен оглед.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-2xl shadow-gray-200/50 border border-gray-100"
        >
          <form className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Име и Фамилия</label>
                <input
                  type="text"
                  placeholder="Въведете вашето име"
                  className="w-full h-12 px-4 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#FF4D00]/20 focus:border-[#FF4D00] transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Телефон</label>
                <input
                  type="tel"
                  placeholder="08XX XXX XXX"
                  className="w-full h-12 px-4 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#FF4D00]/20 focus:border-[#FF4D00] transition-colors"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Изберете услуга</label>
              <div className="flex flex-wrap gap-3">
                {['Продажба', 'Монтаж', 'Профилактика', 'Ремонт'].map((service, i) => (
                  <label key={service} className="cursor-pointer">
                    <input type="radio" name="service" className="peer sr-only" defaultChecked={i === 0} />
                    <div className="px-5 py-2.5 rounded-full bg-gray-50 border border-gray-200 text-sm font-medium text-gray-600 peer-checked:bg-[#FF4D00]/10 peer-checked:text-[#FF4D00] peer-checked:border-[#FF4D00] transition-all">
                      {service}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Допълнителна информация (по желание)</label>
              <textarea
                rows={4}
                placeholder="Какво търсите или къде се намира обектът?"
                className="w-full p-4 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#FF4D00]/20 focus:border-[#FF4D00] transition-colors resize-none"
              ></textarea>
            </div>

            <Button size="lg" className="w-full h-14 text-lg">
              Заяви услуга
            </Button>

            <p className="text-xs text-center text-gray-500 mt-4">
              С натискането на бутона се съгласявате с Политиката за поверителност.
            </p>
          </form>

          <div className="mt-12 pt-12 border-t border-gray-100 grid md:grid-cols-3 gap-6 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                <PhoneCall className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm text-gray-500">Телефон</div>
                <div className="font-bold text-gray-900">+359 88 123 4567</div>
              </div>
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-[#FF4D00]">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm text-gray-500">Имейл</div>
                <div className="font-bold text-gray-900">office@smolyanklima.bg</div>
              </div>
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm text-gray-500">Адрес</div>
                <div className="font-bold text-gray-900">гр. Смолян, ул. Примерна 1</div>
              </div>
            </div>
          </div>
        </motion.div>

      </div>
    </section>
  );
};
