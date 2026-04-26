import React from 'react';
import { motion } from 'motion/react';
import { Phone, Mail, MapPin, Clock, Navigation } from 'lucide-react';

export const ContactInfoSection = () => {
  const mapLink = "https://www.google.com/maps/dir//%D0%A1%D0%BC%D0%BE%D0%BB%D1%8F%D0%BD+%D0%9A%D0%BB%D0%B8%D0%BC%D0%B0+%D0%95%D0%9E%D0%9E%D0%94,+Raykovo,+ul.+%22Natalia%22+19,+4701+Smolyan/@41.5782786,24.7136256,14z/data=!4m8!4m7!1m0!1m5!1m1!1s0x14ac50b6e42fae4f:0xdb4fcdc658cc6bda!2m2!1d24.7339985!2d41.5685312?entry=ttu&g_ep=EgoyMDI2MDQyMi4wIKXMDSoASAFQAw%3D%3D";

  const contactCards = [
    {
      icon: Phone,
      title: "Телефон",
      content: "0888 58 58 16",
      subtext: "Понеделник - Събота",
      href: "tel:0888585816",
      color: "from-[#FF4D00] to-[#FF2A4D]",
      shadow: "shadow-[#FF4D00]/20"
    },
    {
      icon: Mail,
      title: "Имейл",
      content: "office@smolyanklima.bg",
      subtext: "Отговаряме до 2 часа",
      href: "mailto:office@smolyanklima.bg",
      color: "from-[#00B4D8] to-[#0077B6]",
      shadow: "shadow-[#00B4D8]/20"
    },
    {
      icon: MapPin,
      title: "Офис & Магазин",
      content: "ул. Наталия 19",
      subtext: "кв. Райково, гр. Смолян",
      href: mapLink,
      color: "from-[#FF4D00] via-[#FF6A00] to-[#FF2A4D]",
      shadow: "shadow-[#FF4D00]/20"
    },
    {
      icon: Clock,
      title: "Работно време",
      content: "09:00 - 18:00",
      subtext: "Неделя - Почивен ден",
      href: null,
      color: "from-gray-700 to-gray-900",
      shadow: "shadow-gray-900/20"
    }
  ];

  return (
    <section className="py-24 bg-[#FAFAFA] relative overflow-hidden" id="contact-info">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        <div className="text-center mb-16">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-[#FF4D00] text-[10px] font-bold tracking-[0.3em] uppercase mb-5 block"
          >
            СВЪРЖЕТЕ СЕ С НАС
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-outfit text-[2.5rem] md:text-[3.25rem] leading-[1.1] tracking-tight mb-6"
          >
            <span className="relative inline-block mr-3">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00B4D8] to-[#0077B6] drop-shadow-sm font-extralight block">
                Контактна
              </span>
              <div className="absolute -bottom-1 left-0 right-0 h-1 bg-gradient-to-r from-[#00B4D8]/0 via-[#00B4D8] to-[#00B4D8]/0 opacity-30 rounded-full" />
            </span>
            <span className="relative inline-block whitespace-nowrap">
              <span className="absolute -inset-1 blur-lg bg-gradient-to-r from-[#FF4D00]/20 to-[#FF2A4D]/20 opacity-60"></span>
              <span className="relative text-transparent bg-clip-text bg-gradient-to-r from-[#FF4D00] via-[#FF6A00] to-[#FF2A4D] font-black uppercase drop-shadow-sm">
                информация
              </span>
            </span>
          </motion.h2>
        </div>

        <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
          
          {/* Left Side: Contact Cards */}
          <div className="lg:col-span-5 grid sm:grid-cols-2 lg:grid-cols-1 gap-4 h-full">
            {contactCards.map((card, idx) => (
              <motion.a
                key={idx}
                as={card.href ? "a" : "div"}
                href={card.href || undefined}
                target={card.href?.includes('http') ? "_blank" : undefined}
                rel={card.href?.includes('http') ? "noopener noreferrer" : undefined}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1, type: 'spring' }}
                className={`group relative bg-white rounded-[2rem] p-6 sm:p-8 border border-gray-100 hover:border-transparent transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:${card.shadow} flex items-center gap-6 overflow-hidden ${card.href ? 'cursor-pointer' : 'cursor-default'}`}
              >
                {/* Hover Background Gradient */}
                <div className={`absolute inset-0 bg-gradient-to-r ${card.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
                
                <div className={`w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center shrink-0 group-hover:bg-gradient-to-br ${card.color} transition-all duration-300 shadow-sm group-hover:shadow-lg`}>
                  <card.icon className="w-6 h-6 text-gray-600 group-hover:text-white transition-colors duration-300" />
                </div>
                <div>
                  <p className="text-[11px] font-black tracking-widest uppercase text-gray-400 mb-1">{card.title}</p>
                  <p className="font-outfit font-bold text-gray-900 text-lg group-hover:text-[#FF4D00] transition-colors">{card.content}</p>
                  <p className="text-sm text-gray-500 mt-1">{card.subtext}</p>
                </div>
              </motion.a>
            ))}
          </div>

          {/* Right Side: Interactive Map */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="lg:col-span-7 relative bg-white rounded-[3rem] p-4 border border-gray-100 shadow-xl overflow-hidden min-h-[400px] lg:min-h-[600px] flex flex-col"
          >
            {/* The Map */}
            <div className="relative w-full h-full rounded-[2.5rem] overflow-hidden flex-grow group">
              {/* Note: Iframe uses the exact embed code provided by the user, zoomed out slightly */}
              <iframe 
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d10000.564603335378!2d24.73404725883082!3d41.56851624537425!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x14ac50b6e42fae4f%3A0xdb4fcdc658cc6bda!2z0KHQvNC-0LvRj9C9INCa0LvQuNC80LAg0JXQntCe0JQ!5e0!3m2!1sen!2sbg!4v1777175712092!5m2!1sen!2sbg"
                className="absolute inset-0 w-full h-full border-0 grayscale-[20%] contrast-125 transition-all duration-700 group-hover:grayscale-0 group-hover:scale-105"
                allowFullScreen={false}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
              
              {/* Glass Overlay Top */}
              <div className="absolute top-4 left-4 sm:left-6 flex justify-between items-start pointer-events-none z-10">
                <div className="bg-white/80 backdrop-blur-md px-4 sm:px-6 py-3 sm:py-4 rounded-2xl shadow-lg border border-white/50 pointer-events-auto">
                  <h4 className="font-outfit font-bold text-gray-900 text-base sm:text-lg flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#FF4D00] animate-ping absolute" />
                    <div className="w-2 h-2 rounded-full bg-[#FF4D00] relative" />
                    Офис Смолян
                  </h4>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1">Заповядайте при нас!</p>
                </div>
              </div>

              {/* Glass Overlay Bottom (Navigation Button) */}
              <div className="absolute bottom-6 left-4 right-4 sm:left-6 sm:right-6 flex justify-center pointer-events-none z-10">
                <a 
                  href={mapLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pointer-events-auto group/btn flex items-center gap-3 px-6 sm:px-8 h-14 sm:h-16 bg-gradient-to-r from-[#FF4D00] via-[#FF6A00] to-[#FF2A4D] text-white rounded-full font-bold text-base sm:text-lg shadow-[0_10px_30px_rgba(255,77,0,0.3)] hover:shadow-[0_15px_40px_rgba(255,77,0,0.5)] transition-all hover:-translate-y-1 w-full sm:w-auto justify-center"
                >
                  <Navigation className="w-5 h-5 sm:w-6 sm:h-6 group-hover/btn:rotate-12 group-hover/btn:translate-x-1 transition-transform" />
                  Навигирай до нас
                </a>
              </div>
              
              {/* Map inner shadow for depth */}
              <div className="absolute inset-0 shadow-[inset_0_0_40px_rgba(0,0,0,0.1)] pointer-events-none rounded-[2.5rem]" />
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
};
