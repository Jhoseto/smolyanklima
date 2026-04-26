import React from 'react';
import { motion } from 'motion/react';
import { Badge } from '../ui/Badge';

const projects = [
  { id: 1, image: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80", colSpan: "col-span-1", rowSpan: "row-span-1" },
  { id: 2, image: "https://images.unsplash.com/photo-1513694203232-719a280e022f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80", colSpan: "col-span-1", rowSpan: "row-span-1" },
  { id: 3, image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80", colSpan: "col-span-1", rowSpan: "row-span-2" },
  { id: 4, image: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80", colSpan: "col-span-1", rowSpan: "row-span-1" },
  { id: 5, image: "https://images.unsplash.com/photo-1581093458791-9f3c3900df4b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80", colSpan: "col-span-1", rowSpan: "row-span-1" },
  { id: 6, image: "https://images.unsplash.com/photo-1593696140826-c58b021acf8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80", colSpan: "col-span-1", rowSpan: "row-span-1" },
  { id: 7, image: "https://images.unsplash.com/photo-1505691938895-1758d7feb511?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80", colSpan: "col-span-2", rowSpan: "row-span-1" },
];

export const ProjectsSection = () => {
  return (
    <section id="projects" className="py-20 bg-gray-50 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center mb-12">
          <Badge variant="orange" className="mb-4">Галерия</Badge>
          <motion.h2 
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4"
          >
            Нашите реализирани <span className="text-[#FF4D00]">проекти</span>
          </motion.h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Разгледайте част от нашите завършени обекти. Гордеем се с качеството на монтажа и вниманието към детайла във всеки един проект.
          </p>
        </div>

        {/* Masonry-like Grid Layout */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 auto-rows-[200px]">
          {projects.map((project, index) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              className={`relative rounded-3xl overflow-hidden group ${project.colSpan} ${project.rowSpan}`}
            >
              <img 
                src={project.image} 
                alt={`Проект ${project.id}`} 
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-6">
                <span className="text-white font-bold">Обект #{project.id}</span>
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
};
