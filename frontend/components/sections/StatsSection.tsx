import React, { useRef, useEffect } from 'react';
import { motion, useInView, animate } from 'motion/react';
import { Award, Clock, ThumbsUp, Users } from 'lucide-react';

const stats = [
  { icon: Award, value: 1500, suffix: "+", label: "Монтирани климатика" },
  { icon: Clock, value: 25, suffix: "+", label: "Години опит" },
  { icon: ThumbsUp, value: 98, suffix: "%", label: "Доволни клиенти" },
  { icon: Users, value: 48, suffix: "ч", label: "Макс. до монтажа" }
];

function AnimatedNumber({ value, suffix }: { value: number, suffix: string }) {
  const nodeRef = useRef<HTMLSpanElement>(null);
  const isInView = useInView(nodeRef, { once: true, margin: "-50px" });

  useEffect(() => {
    if (isInView && nodeRef.current) {
      const controls = animate(0, value, {
        duration: 2.5,
        ease: "easeOut",
        onUpdate(v) {
          if (nodeRef.current) {
            nodeRef.current.textContent = Math.round(v) + suffix;
          }
        }
      });
      return controls.stop;
    }
  }, [isInView, value, suffix]);

  return <span ref={nodeRef}>0{suffix}</span>;
}

export const StatsSection = () => {
  return (
    <section className="py-8 bg-white relative z-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="bg-gradient-to-r from-[#FFF5F2] via-[#FFF1ED] to-[#FFF5F2] rounded-full border border-[#FF4D00]/10 py-6 px-8 sm:px-12 shadow-sm"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-4 divide-y md:divide-y-0 md:divide-x divide-[#FF4D00]/10">
            {stats.map((stat, index) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className={`flex flex-col items-center justify-center text-center group ${index > 1 ? 'pt-6 md:pt-0' : ''}`}
              >
                <stat.icon className="w-5 h-5 text-[#00B4D8] mb-1.5 opacity-80 transition-transform duration-300 group-hover:scale-110 group-hover:text-[#0077B6]" strokeWidth={2} />
                <div className="text-3xl md:text-[2rem] font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FF4D00] to-[#FF2A4D] mb-0.5 tracking-tight leading-none">
                  <AnimatedNumber value={stat.value} suffix={stat.suffix} />
                </div>
                <div className="text-[9px] md:text-[10px] font-bold text-gray-600 uppercase tracking-wider">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};
