import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ items }) => {
  return (
    <nav className="py-4" aria-label="Breadcrumb">
      <ol className="flex items-center flex-wrap gap-2 text-sm">
        <li>
          <Link 
            to="/" 
            className="flex items-center gap-1 text-gray-500 hover:text-[#FF4D00] transition-colors"
          >
            <Home className="w-4 h-4" />
            <span className="hidden sm:inline">Начало</span>
          </Link>
        </li>
        
        {items.map((item, index) => (
          <React.Fragment key={index}>
            <li>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </li>
            <li>
              {item.href ? (
                <Link 
                  to={item.href}
                  className="text-gray-500 hover:text-[#FF4D00] transition-colors"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="text-gray-900 font-medium" aria-current="page">
                  {item.label}
                </span>
              )}
            </li>
          </React.Fragment>
        ))}
      </ol>
    </nav>
  );
};
