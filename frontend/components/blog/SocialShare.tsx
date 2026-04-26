import React, { useState } from 'react';
import { Share2, Facebook, Twitter, Linkedin, Link2, Check, MessageCircle } from 'lucide-react';

interface SocialShareProps {
  url: string;
  title: string;
  description?: string;
}

export const SocialShare: React.FC<SocialShareProps> = ({ 
  url, 
  title,
  description = ''
}) => {
  const [copied, setCopied] = useState(false);
  
  const fullUrl = `https://smolyanklima.bg${url}`;
  const encodedUrl = encodeURIComponent(fullUrl);
  const encodedTitle = encodeURIComponent(title);
  const encodedDesc = encodeURIComponent(description);

  const shareLinks = [
    {
      name: 'Facebook',
      icon: Facebook,
      color: 'bg-[#1877F2] hover:bg-[#166fe5]',
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`
    },
    {
      name: 'Twitter',
      icon: Twitter,
      color: 'bg-[#1DA1F2] hover:bg-[#1a91da]',
      url: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`
    },
    {
      name: 'LinkedIn',
      icon: Linkedin,
      color: 'bg-[#0A66C2] hover:bg-[#0958a8]',
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`
    },
    {
      name: 'Viber',
      icon: MessageCircle,
      color: 'bg-[#7360F2] hover:bg-[#634ce0]',
      url: `viber://forward?text=${encodedTitle}%20${encodedUrl}`
    }
  ];

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleShare = (shareUrl: string, name: string) => {
    // For mobile share via Web Share API if available
    if (navigator.share && name !== 'Viber') {
      navigator.share({
        title: title,
        text: description,
        url: fullUrl
      }).catch(() => {
        // Fallback to opening the share URL
        window.open(shareUrl, '_blank', 'width=600,height=400');
      });
    } else {
      // Desktop - open in popup
      window.open(shareUrl, '_blank', 'width=600,height=400');
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Share2 className="w-4 h-4" />
        <span>Споделете статията:</span>
      </div>
      
      <div className="flex items-center gap-2 flex-wrap">
        {shareLinks.map((link) => (
          <button
            key={link.name}
            onClick={() => handleShare(link.url, link.name)}
            className={`${link.color} text-white p-2.5 rounded-full transition-all duration-200 hover:scale-110 hover:shadow-md`}
            title={`Сподели в ${link.name}`}
            aria-label={`Сподели в ${link.name}`}
          >
            <link.icon className="w-4 h-4" />
          </button>
        ))}
        
        {/* Copy Link Button */}
        <button
          onClick={handleCopyLink}
          className={`p-2.5 rounded-full transition-all duration-200 hover:scale-110 ${
            copied 
              ? 'bg-green-500 text-white' 
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
          title={copied ? 'Копирано!' : 'Копирай линк'}
          aria-label="Копирай линк"
        >
          {copied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};
