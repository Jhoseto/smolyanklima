import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ArticleContentProps {
  content: string;
}

export const ArticleContent: React.FC<ArticleContentProps> = ({ content }) => {
  return (
    <div className="prose prose-lg max-w-none 
      prose-headings:text-gray-900 
      prose-headings:font-bold
      prose-h1:text-3xl
      prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-4
      prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-3
      prose-p:text-gray-600 prose-p:leading-relaxed prose-p:mb-4
      prose-strong:text-gray-900 prose-strong:font-semibold
      prose-a:text-[#FF4D00] prose-a:no-underline hover:prose-a:underline
      prose-ul:my-4 prose-ul:list-disc prose-ul:pl-6
      prose-ol:my-4 prose-ol:list-decimal prose-ol:pl-6
      prose-li:text-gray-600 prose-li:mb-2
      prose-table:border-collapse prose-table:w-full prose-table:my-6
      prose-th:bg-gray-100 prose-th:text-gray-900 prose-th:font-semibold prose-th:p-3 prose-th:text-left
      prose-td:border prose-td:border-gray-200 prose-td:p-3 prose-td:text-gray-600
      prose-blockquote:border-l-4 prose-blockquote:border-[#FF4D00] prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-gray-600
      prose-img:rounded-xl prose-img:shadow-lg
      prose-hr:border-gray-200">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  );
};
