import React, { useState } from 'react';
import { Trash2, Sparkles, Quote, Heart, Edit2, Check, X, BookMarked, XCircle } from 'lucide-react';

const QuoteCard = ({ item, onDelete, onUpdate, onToggleQuotebook, showInsight = true, isPreview = false, onSave, onDiscard }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editAuthor, setEditAuthor] = useState(item.author || '');
  const [editSource, setEditSource] = useState(item.source || '');

  const handleSave = () => {
    onUpdate(item.id, { author: editAuthor, source: editSource });
    setIsEditing(false);
  };

  return (
    <div className={`bg-white rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all border border-stone-100 mb-4 group relative overflow-hidden`}>
      {/* Colored Top Border Indicator */}
      <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${item.inQuotebook ? 'from-rose-400 to-pink-500' : 'from-emerald-400 to-teal-500'} opacity-80`}></div>
      
      <div className="flex justify-between items-start">
        <div className="w-full">
          {/* Header Label */}
          <div className="flex items-center gap-2 mb-4">
            <div className={`p-1.5 rounded-full ${item.inQuotebook ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'}`}>
               {item.inQuotebook ? <BookMarked size={14} /> : <Quote size={14} />}
            </div>
            <span className={`text-xs font-bold tracking-wider uppercase ${item.inQuotebook ? 'text-rose-500' : 'text-emerald-600'}`}>
              {isPreview ? 'New Discovery' : (item.inQuotebook ? 'Collection' : 'Library')}
            </span>
          </div>
          
          {/* Quote Text */}
          <blockquote className="text-xl md:text-2xl font-serif text-stone-800 leading-relaxed mb-4">
            "{item.text}"
          </blockquote>

          {/* Metadata Section (Author/Source) */}
          <div className="mb-6">
            {isEditing ? (
              <div className="bg-stone-50 p-4 rounded-xl space-y-3 border border-stone-200 animate-in fade-in slide-in-from-top-2">
                <input
                  type="text"
                  value={editAuthor}
                  onChange={(e) => setEditAuthor(e.target.value)}
                  placeholder="Author"
                  className="w-full bg-white p-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400"
                />
                <input
                  type="text"
                  value={editSource}
                  onChange={(e) => setEditSource(e.target.value)}
                  placeholder="Source (Book, Movie, etc.)"
                  className="w-full bg-white p-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400"
                />
                <div className="flex gap-2 pt-1">
                  <button onClick={handleSave} className="flex items-center gap-1 px-3 py-1.5 bg-stone-800 text-white text-xs font-medium rounded-lg hover:bg-stone-900 transition-colors">
                    <Check size={12} /> Save
                  </button>
                  <button onClick={() => setIsEditing(false)} className="flex items-center gap-1 px-3 py-1.5 bg-white border border-stone-300 text-stone-600 text-xs font-medium rounded-lg hover:bg-stone-50 transition-colors">
                    <X size={12} /> Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between group/meta">
                <div className="flex flex-col">
                    <span className="text-stone-900 font-semibold text-base">— {item.author || 'Unknown Author'}</span>
                    {item.source && <span className="text-stone-500 text-sm italic">{item.source}</span>}
                </div>
                {/* make the edit btn visible in preview mode */}
                <button 
                  onClick={() => {
                      setEditAuthor(item.author || '');
                      setEditSource(item.source || '');
                      setIsEditing(true);
                  }}
                  className={`text-xs text-stone-400 hover:text-stone-800 transition-opacity flex items-center gap-1 bg-stone-50 px-2 py-1 rounded-md ${isPreview ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                >
                  <Edit2 size={12} /> Edit
                </button>
              </div>
            )}
          </div>

          {/* AI Insight - Conditionally Rendered */}
          {showInsight && (
            <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100/50 mb-4">
              <h4 className="text-xs font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <Sparkles size={12} /> Analysis
              </h4>
              <p className="text-sm text-stone-600 leading-relaxed">
                {item.analysis?.meaning}
              </p>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-stone-50">
            <div className="flex gap-2 flex-wrap">
                {item.analysis?.tags?.map((tag, idx) => (
                <span key={idx} className="px-2.5 py-0.5 bg-stone-100 text-stone-500 text-xs font-medium rounded-full capitalize tracking-wide">
                    #{tag}
                </span>
                ))}
            </div>
            
            {/* ACTION BUTTONS */}
            {isPreview ? (
                // PREVIEW MODE BUTTONS
                <div className="flex gap-3">
                    <button 
                        onClick={onDiscard}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-stone-100 text-stone-500 hover:bg-red-50 hover:text-red-600 transition-all"
                    >
                        <XCircle size={14} />
                        Discard
                    </button>
                    <button 
                        onClick={onSave}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-rose-500 text-white hover:bg-rose-600 shadow-md shadow-rose-200 transition-all transform active:scale-95"
                    >
                        <Heart size={14} className="fill-current" />
                        Save to Quotebook
                    </button>
                </div>
            ) : (
                // NORMAL MODE BUTTONS
                <div className="flex gap-2">
                    <button 
                        onClick={() => onToggleQuotebook(item.id, !item.inQuotebook)}
                        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-300 ${
                            item.inQuotebook 
                            ? 'bg-rose-100 text-rose-600 shadow-sm' 
                            : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                        }`}
                    >
                        <Heart size={14} className={item.inQuotebook ? "fill-current" : ""} />
                        {item.inQuotebook ? 'Saved' : 'Save to Book'}
                    </button>
                </div>
            )}
          </div>
        </div>
        
        {/* Only show trash icon in normal mode */}
        {!isPreview && (
            <button onClick={() => onDelete(item.id)} className="text-stone-300 hover:text-red-400 hover:bg-red-50 p-2 rounded-full transition-all ml-2">
            <Trash2 size={18} />
            </button>
        )}
      </div>
    </div>
  );
};

export default QuoteCard;