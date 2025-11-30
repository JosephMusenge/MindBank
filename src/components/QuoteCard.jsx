import React, { useState, useRef } from 'react';
import { Trash2, Sparkles, Quote, Heart, Edit2, Check, X, BookMarked, XCircle, Volume2, StopCircle, Share2, Copy, Download, Image as ImageIcon, Globe, Loader2  } from 'lucide-react';
import { toast } from 'sonner';
import { toPng } from 'html-to-image';
import { playAiAudio } from '../lib/audioService';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`;

const LANGUAGES = [
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ja', label: 'Japanese' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ru', label: 'Russian' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ar', label: 'Arabic' },
];

const QuoteCard = ({ item, onDelete, onUpdate, onToggleQuotebook, showInsight = true, isPreview = false, onSave, onDiscard }) => {
  const cardRef = useRef(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  // Translation State
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translation, setTranslation] = useState(null); // { text: string, lang: string }

  const [editAuthor, setEditAuthor] = useState(item.author || '');
  const [editSource, setEditSource] = useState(item.source || '');
  const [isLoadingAudio, setIsLoadingAudio] = useState(false); // NEW State
  const audioRef = useRef(null);

  const handleSave = () => {
    onUpdate(item.id, { author: editAuthor, source: editSource });
    setIsEditing(false);
  };

  // Handle Text-to-Speech for quote and word readings
  const handleSpeak = async (textToSpeak) => {
    if (isSpeaking || isLoadingAudio) {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
      setIsSpeaking(false);
      setIsLoadingAudio(false);
      return;
    }

    // Start Loading
    setIsLoadingAudio(true);

    try {
        const voice = item.inQuotebook ? 'onyx' : 'nova'; 
      const audio = await playAiAudio(textToSpeak || item.text, voice);
      
      audioRef.current = audio;
      setIsSpeaking(true);
      setIsLoadingAudio(false);
      // Reset state when audio finishes
      audio.onended = () => {
        setIsSpeaking(false);
        audioRef.current = null;
      };

    } catch (error) {
      toast.error("Could not generate AI audio. Check API Key.");
      setIsLoadingAudio(false);
      setIsSpeaking(false);
    }
  };

  const handleTranslate = async (langName) => {
    setShowLangMenu(false);
    setIsTranslating(true);
    
    try {
      const prompt = `Translate the following quote into ${langName}. Return ONLY the translated text, nothing else. Text: "${item.text}"`;
      
      const response = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      
      const data = await response.json();
      const translatedText = data.candidates[0].content.parts[0].text.trim();
      
      setTranslation({ text: translatedText, lang: langName });
      toast.success(`Translated to ${langName}`);
    } catch (error) {
      console.error("Translation failed", error);
      toast.error("Translation failed. Try again.");
    } finally {
      setIsTranslating(false);
    }
  };

  // Share quotes functions
  const copyText = () => {
    const textToShare = `"${item.text}" — ${item.author || 'Unknown'}`;
    navigator.clipboard.writeText(textToShare);
    toast.success("Quote copied to clipboard");
    setShowShareMenu(false);
  };

  const downloadImage = async () => {
    if (cardRef.current === null) return;
    // Show a loading toast
    const toastId = toast.loading("Generating image...");

    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        backgroundColor: '#ffffff', 
        filter: (node) => {
          // Exclude elements with the 'share-exclude' class (like buttons)
          return !node.classList?.contains('share-exclude');
        },
        style: {
           margin: '0', // Reset margins for the snapshot
           transform: 'none' // Remove hover transforms if active
        }
      });

      const link = document.createElement('a');
      link.download = `mindbank-quote-${item.id}.png`;
      link.href = dataUrl;
      link.click();
      toast.dismiss(toastId);
      toast.success("Image saved to downloads");
    } catch (err) {
      console.error(err);
      toast.dismiss(toastId);
      toast.error("Failed to generate image");
    } finally {
      setShowShareMenu(false);
    }
  };

  return (
    <div 
        ref={cardRef}
        className={`bg-white rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all border border-stone-100 mb-4 group relative overflow-hidden`}
    >
      {/* Colored Top Border Indicator */}
      <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${item.inQuotebook ? 'from-rose-400 to-pink-500' : 'from-emerald-400 to-teal-500'} opacity-80`}></div>
      
      <div className="flex justify-between items-start">
      <div className="w-full">
          {/* Header Label + Buttons */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-full ${item.inQuotebook ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'}`}>
                {item.inQuotebook ? <BookMarked size={14} /> : <Quote size={14} />}
                </div>
                <span className={`text-xs font-bold tracking-wider uppercase ${item.inQuotebook ? 'text-rose-500' : 'text-emerald-600'}`}>
                {isPreview ? 'New Discovery' : (item.inQuotebook ? 'Collection' : 'Library')}
                </span>
            </div>

            {/* Header Tools (Audio + Share) - Excluded from Image Share */}
            <div className="flex items-center gap-1 share-exclude">
                {/* Translate Menu */}
                <div className="relative">
                   <button
                     onClick={() => setShowLangMenu(!showLangMenu)}
                     className={`p-2 rounded-full transition-colors ${showLangMenu || translation ? 'bg-indigo-50 text-indigo-600' : 'text-stone-300 hover:text-indigo-500 hover:bg-indigo-50'}`}
                     title="Translate"
                   >
                     {isTranslating ? <Loader2 size={18} className="animate-spin" /> : <Globe size={18} />}
                   </button>
                   
                   {showLangMenu && (
                     <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowLangMenu(false)} />
                        <div className="absolute right-0 mt-2 w-40 bg-white rounded-xl shadow-xl border border-stone-100 z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-60 overflow-y-auto">
                            <div className="px-3 py-2 text-xs font-bold text-stone-400 uppercase tracking-wider bg-stone-50 border-b border-stone-100">Translate to</div>
                            {LANGUAGES.map(lang => (
                                <button 
                                    key={lang.code}
                                    onClick={() => handleTranslate(lang.label)}
                                    className="w-full text-left px-4 py-2 text-sm text-stone-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                                >
                                    {lang.label}
                                </button>
                            ))}
                        </div>
                     </>
                   )}
                </div>

                <button 
                    onClick={() => handleSpeak(translation ? translation.text : item.text)}
                    className={`p-2 rounded-full transition-colors ${isSpeaking ? 'bg-indigo-100 text-indigo-600' : 'text-stone-300 hover:text-indigo-500 hover:bg-indigo-50'}`}
                    title={translation ? "Read Translation" : "Read Aloud"}
                >
                    {isLoadingAudio ? (
                    <Loader2 size={18} className="animate-spin" /> 
                    ) : isSpeaking ? (
                    <StopCircle size={18} /> 
                    ) : (
                    <Volume2 size={18} />
                    )}
                </button>

                {/* Share Menu */}
                <div className="relative">
                    <button 
                        onClick={() => setShowShareMenu(!showShareMenu)}
                        className={`p-2 rounded-full transition-colors ${showShareMenu ? 'bg-stone-100 text-stone-600' : 'text-stone-300 hover:text-stone-600 hover:bg-stone-100'}`}
                        title="Share"
                    >
                        <Share2 size={18} />
                    </button>
                    
                    {/* Dropdown */}
                    {showShareMenu && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setShowShareMenu(false)} />
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-stone-100 z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                <button onClick={copyText} className="w-full text-left px-4 py-3 text-sm text-stone-600 hover:bg-stone-50 flex items-center gap-2 transition-colors">
                                    <Copy size={16} /> Copy Text
                                </button>
                                <button onClick={downloadImage} className="w-full text-left px-4 py-3 text-sm text-stone-600 hover:bg-stone-50 flex items-center gap-2 transition-colors border-t border-stone-50">
                                    <ImageIcon size={16} /> Save Image
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
          </div>
          
          <blockquote className="text-xl md:text-2xl font-serif text-stone-800 leading-relaxed mb-4">
            "{item.text}"
          </blockquote>

          {/* Translation Display */}
          {translation && (
              <div className="mb-6 bg-indigo-50/50 rounded-xl p-4 border border-indigo-100 relative group/trans">
                  <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">{translation.lang} Translation</span>
                      <button onClick={() => setTranslation(null)} className="text-indigo-300 hover:text-indigo-500"><X size={14}/></button>
                  </div>
                  <p className="text-lg font-serif text-indigo-900 italic">"{translation.text}"</p>
              </div>
          )}

          {/* Metadata Section */}
          <div className="mb-6">
            {isEditing ? (
              <div className="bg-stone-50 p-4 rounded-xl space-y-3 border border-stone-200 animate-in fade-in slide-in-from-top-2 share-exclude">
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
                
                <button 
                  onClick={() => {
                      setEditAuthor(item.author || '');
                      setEditSource(item.source || '');
                      setIsEditing(true);
                  }}
                  className={`share-exclude text-xs text-stone-400 hover:text-stone-800 transition-opacity flex items-center gap-1 bg-stone-50 px-2 py-1 rounded-md ${isPreview ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                >
                  <Edit2 size={12} /> Edit
                </button>
              </div>
            )}
          </div>

          {/* AI Insight */}
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

          {/* Footer Actions (Tags + Buttons) */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-stone-50">
            <div className="flex gap-2 flex-wrap">
                {item.analysis?.tags?.map((tag, idx) => (
                <span key={idx} className="px-2.5 py-0.5 bg-stone-100 text-stone-500 text-xs font-medium rounded-full capitalize tracking-wide">
                    #{tag}
                </span>
                ))}
            </div>
            
            {/* ACTION BUTTONS - Hidden during Share Snapshot */}
            <div className="share-exclude">
                {isPreview ? (
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
        </div>
        
        {/* Only show trash icon in normal mode */}
        {!isPreview && (
            <div className="share-exclude ml-2">
                <button onClick={() => onDelete(item.id)} className="text-stone-300 hover:text-red-400 hover:bg-red-50 p-2 rounded-full transition-all">
                <Trash2 size={18} />
                </button>
             </div>
        )}
      </div>
    </div>
  );
};

export default QuoteCard;