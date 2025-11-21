import React from 'react';
import { Trash2 } from 'lucide-react';

const WordCard = ({ item, onDelete }) => (
    <div className="bg-white rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all border border-stone-100 group relative overflow-hidden">
    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-400 to-violet-500 opacity-80"></div>
    <div className="flex justify-between items-start">
      <div>
        <div className="flex items-baseline gap-3">
          <h3 className="text-3xl font-bold text-stone-800 tracking-tight">{item.text}</h3>
          <span className="text-sm font-medium text-indigo-500 bg-indigo-50 px-2 py-1 rounded-full">{item.analysis?.partOfSpeech}</span>
        </div>
        <p className="mt-3 text-stone-600 text-lg leading-relaxed">{item.analysis?.definition}</p>
        
        <div className="mt-4 pl-4 border-l-2 border-indigo-100 text-stone-500 italic text-base">
          "{item.analysis?.example}"
        </div>

        <div className="mt-4 flex gap-2 flex-wrap">
          {item.analysis?.tags?.map((tag, idx) => (
            <span key={idx} className="px-2.5 py-0.5 bg-stone-100 text-stone-500 text-xs font-medium rounded-full capitalize tracking-wide">
              #{tag}
            </span>
          ))}
        </div>
      </div>
      <button onClick={() => onDelete(item.id)} className="text-stone-300 hover:text-red-400 hover:bg-red-50 p-2 rounded-full transition-all">
        <Trash2 size={18} />
      </button>
    </div>
  </div>
);

export default WordCard;