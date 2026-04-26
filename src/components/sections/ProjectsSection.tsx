import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

const projects = [
  { id: 1, image: "https://images.unsplash.com/photo-1715593947958-ee0ca51de552?q=80&w=2340&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D", colSpan: "col-span-1", rowSpan: "row-span-1" },
  { id: 2, image: "https://images.unsplash.com/photo-1715593949273-09009558300a?q=80&w=2340&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D", colSpan: "col-span-1", rowSpan: "row-span-1" },
  { id: 3, image: "https://images.unsplash.com/photo-1691351582808-329cde17ffa2?q=80&w=987&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D", colSpan: "col-span-1", rowSpan: "row-span-2" },
  { id: 4, image: "https://images.unsplash.com/photo-1700124113583-81aa99ea2aa2?q=80&w=2340&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D", colSpan: "col-span-1", rowSpan: "row-span-1" },
  { id: 5, image: "https://images.unsplash.com/photo-1745745593296-28fd43a6ebba?q=80&w=2340&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D", colSpan: "col-span-1", rowSpan: "row-span-1" },
  { id: 6, image: "https://images.unsplash.com/photo-1598242930227-1a5cc8847665?q=80&w=2449&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D", colSpan: "col-span-1", rowSpan: "row-span-1" },
  { id: 9, image: "https://images.unsplash.com/photo-1758798157512-f0a864c696c9?q=80&w=2306&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D", colSpan: "col-span-1", rowSpan: "row-span-1" },
  { id: 7, image: "https://images.unsplash.com/photo-1758813330492-2b43bd42ccc5?q=80&w=2340&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D", colSpan: "col-span-2", rowSpan: "row-span-1" },
  { id: 8, image: "https://images.unsplash.com/photo-1775743240496-93eed8dbb589?q=80&w=2340&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D", colSpan: "col-span-2", rowSpan: "row-span-1" },
];

export const ProjectsSection = () => {
  const [selectedProject, setSelectedProject] = useState<null | typeof projects[0]>(null);

  return (
    <section id="projects" className="py-24 bg-white relative overflow-hidden">
      {/* Decorative background blur */}
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-50 rounded-full blur-[120px] opacity-40 -translate-x-1/2 translate-y-1/2 pointer-events-none" />

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

        <div className="text-center mb-20">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-[#FF4D00] text-[10px] font-bold tracking-[0.3em] uppercase mb-5 block"
          >
            ГАЛЕРИЯ
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
                Нашите реализирани
              </span>
              <div className="absolute -bottom-1 left-0 right-0 h-1 bg-gradient-to-r from-[#00B4D8]/0 via-[#00B4D8] to-[#00B4D8]/0 opacity-30 rounded-full" />
            </span>
            <br />
            <span className="relative inline-block whitespace-nowrap">
              <span className="absolute -inset-1 blur-lg bg-gradient-to-r from-[#FF4D00]/20 to-[#FF2A4D]/20 opacity-60"></span>
              <span className="relative text-transparent bg-clip-text bg-gradient-to-r from-[#FF4D00] via-[#FF6A00] to-[#FF2A4D] font-black uppercase drop-shadow-sm">
                проекти
              </span>
            </span>
          </motion.h2>
          <p className="text-gray-500 max-w-2xl mx-auto mt-8 text-sm md:text-base leading-relaxed">
            Разгледайте част от нашите завършени обекти. Гордеем се с качеството на монтажа и вниманието към детайла във всеки един проект.
          </p>
        </div>

        {/* Masonry Grid Layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5 auto-rows-[240px]">
          {projects.map((project, index) => (
            <motion.div
              key={project.id}
              layoutId={`project-${project.id}`}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05, duration: 0.6 }}
              onClick={() => setSelectedProject(project)}
              className={`relative rounded-[2rem] overflow-hidden group border border-gray-100 shadow-sm hover:shadow-2xl hover:shadow-gray-200 transition-all duration-500 cursor-zoom-in ${project.colSpan} ${project.rowSpan}`}
            >
              <img
                src={project.image}
                alt={`Проект ${project.id}`}
                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-end p-8 translate-y-4 group-hover:translate-y-0">
                <span className="text-[10px] font-bold text-[#00B4D8] uppercase tracking-widest mb-2">Завършен обект</span>
                <h4 className="text-white font-outfit text-xl font-bold tracking-tight">Проект #{project.id}</h4>
              </div>
            </motion.div>
          ))}
        </div>

      </div>

      {/* Lightbox / Modal */}
      <AnimatePresence>
        {selectedProject && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-12"
          >
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProject(null)}
              className="absolute inset-0 bg-white/40 backdrop-blur-xl"
            />
            
            <motion.div
              layoutId={`project-${selectedProject.id}`}
              className="relative w-full max-w-6xl aspect-video md:aspect-[16/9] rounded-[2rem] md:rounded-[3rem] overflow-hidden shadow-2xl z-10"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
            >
              <img
                src={selectedProject.image}
                alt={`Проект ${selectedProject.id}`}
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12 bg-gradient-to-t from-black/80 via-black/20 to-transparent">
                <span className="text-xs font-bold text-[#00B4D8] uppercase tracking-[0.3em] mb-3 block">ДЕТАЙЛИ ПО ПРОЕКТА</span>
                <h3 className="text-white font-outfit text-3xl md:text-5xl font-black tracking-tight uppercase">
                  Проект #{selectedProject.id}
                </h3>
              </div>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedProject(null);
                }}
                className="absolute top-8 right-8 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center text-white transition-all border border-white/10 hover:scale-110 active:scale-95"
              >
                <X className="w-6 h-6" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};
