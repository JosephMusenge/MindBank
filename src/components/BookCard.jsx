import React from 'react';
import { Book, ChevronRight, Quote } from 'lucide-react';

const BookCard = ({ title, author, coverUrl, quoteCount, onClick }) => {
  // Generate a consistent pastel color based on the title length
  // makes sure the same book always has the same color background if no cover exists
  const colors = [
    'bg-rose-100 text-rose-700',
    'bg-indigo-100 text-indigo-700',
    'bg-emerald-100 text-emerald-700',
    'bg-amber-100 text-amber-700',
    'bg-slate-100 text-slate-700',
    'bg-violet-100 text-violet-700',
  ];
  const colorIndex = title.length % colors.length;
  const colorClass = colors[colorIndex];

  return (
    <button 
      onClick={onClick}
      className="flex flex-col text-left group w-full transition-all hover:-translate-y-1"
    >
      <div className="relative aspect-[2/3] w-full mb-3 rounded-r-xl rounded-l-sm shadow-md group-hover:shadow-xl transition-all overflow-hidden border-l-4 border-stone-800/20">
        {coverUrl ? (
          <img 
            src={coverUrl} 
            alt={title} 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className={`w-full h-full flex flex-col p-4 ${colorClass}`}>
            <div className="flex-1">
                <h3 className="font-serif font-bold text-lg leading-tight line-clamp-4">
                    {title || "Unknown Title"}
                </h3>
                <p className="text-xs font-medium mt-2 opacity-80 uppercase tracking-wider">
                    {author || "Unknown"}
                </p>
            </div>
            <div className="opacity-50">
                <Book size={24} />
            </div>
          </div>
        )}
        
        {/* Book Spine Shadow Effect */}
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-r from-black/20 to-transparent"></div>
        <div className="absolute inset-0 ring-1 ring-inset ring-black/5 rounded-r-xl rounded-l-sm"></div>
      </div>

      <div className="space-y-1 px-1">
        <h4 className="font-bold text-stone-800 text-sm line-clamp-1 group-hover:text-indigo-600 transition-colors">
            {title || "Untitled Book"}
        </h4>
        <div className="flex items-center justify-between text-xs text-stone-400">
            <span>{author}</span>
            <span className="flex items-center gap-1 bg-stone-100 px-1.5 py-0.5 rounded-md">
                <Quote size={10} /> {quoteCount}
            </span>
        </div>
      </div>
    </button>
  );
};

export default BookCard;