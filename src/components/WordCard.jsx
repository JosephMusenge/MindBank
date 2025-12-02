import React, { useState, useRef } from 'react';
import { Trash2, Save, XCircle, Volume2, StopCircle, Globe, Loader2, X } from 'lucide-react';
import { playAiAudio } from '../lib/audioService';
import { toast } from 'sonner';

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

const WordCard = ({ item, onDelete, isPreview = false, onSave, onDiscard }) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translation, setTranslation] = useState(null);

  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const audioRef = useRef(null);

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

    setIsLoadingAudio(true);

    try {
      // use 'alloy' for words 
      const audio = await playAiAudio(textToSpeak || item.text, 'alloy');
      
      audioRef.current = audio;
      setIsSpeaking(true);
      setIsLoadingAudio(false);
      
      // Reset state when audio finishes
      audio.onended = () => {
        setIsSpeaking(false);
        audioRef.current = null;
      };
    } catch (error) {
      toast.error("Audio failed");
      setIsLoadingAudio(false);
      setIsSpeaking(false);
    }
  };

  const handleTranslate = async (langName) => {
    setShowLangMenu(false);
    setIsTranslating(true);
    try {
      // translate the word AND the definition
      const prompt = `Translate this word and definition into ${langName}. 
      Word: "${item.text}"
      Definition: "${item.analysis?.definition}"
      Return ONLY a JSON object with this schema: { "word": "translated_word", "definition": "translated_definition" }`;
      
      const response = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      
      const data = await response.json();
      const aiText = data.candidates[0].content.parts[0].text;
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      const result = JSON.parse(jsonMatch ? jsonMatch[0] : aiText);
      
      setTranslation({ ...result, lang: langName });
      toast.success(`Translated to ${langName}`);
    } catch (error) {
      console.error(error);
      toast.error("Translation failed");
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all border border-stone-100 group relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-400 to-violet-500 opacity-80"></div>
      <div className="flex justify-between items-start">
        <div className="w-full">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-baseline gap-3">
                <h3 className="text-3xl font-bold text-stone-800 tracking-tight">{item.text}</h3>
                <span className="text-sm font-medium text-indigo-500 bg-indigo-50 px-2 py-1 rounded-full">{item.analysis?.partOfSpeech}</span>
              </div>
              
              <div className="flex items-center gap-1">
                 {/* Translate Menu */}
                 <div className="relative">
                   <button
                     onClick={() => setShowLangMenu(!showLangMenu)}
                     className={`p-2 rounded-full transition-colors ${showLangMenu || translation ? 'bg-indigo-50 text-indigo-600' : 'text-stone-300 hover:text-indigo-500 hover:bg-indigo-50'}`}
                     title="Translate"
                   >
                     {isTranslating ? <Loader2 size={20} className="animate-spin" /> : <Globe size={20} />}
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

                {/* Audion Btn */}
                <button 
                  onClick={() => {
                    // Combine Word + Definition for full reading
                    // If translated, use translated word + translated definition
                    const textToRead = translation 
                        ? `${translation.word}. ${translation.definition}` 
                        : `${item.text}. ${item.analysis?.definition}`;
                    
                    handleSpeak(textToRead);
                  }}
                  className={`p-2 rounded-full transition-colors ${isSpeaking ? 'bg-indigo-100 text-indigo-600' : 'text-stone-300 hover:text-indigo-500 hover:bg-indigo-50'}`}
                  title="Pronounce"
                >
                  {isLoadingAudio ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : isSpeaking ? (
                    <StopCircle size={20} />
                  ) : (
                    <Volume2 size={20} />
                  )}
                </button>
              </div>
            </div>

            <p className="mt-3 text-stone-600 text-lg leading-relaxed">{item.analysis?.definition}</p>

            {/* Translation Display */}
            {translation && (
                <div className="mt-4 mb-2 bg-indigo-50/50 rounded-xl p-4 border border-indigo-100 relative group/trans">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">{translation.lang}</span>
                        <button onClick={() => setTranslation(null)} className="text-indigo-300 hover:text-indigo-500"><X size={14}/></button>
                    </div>
                    <p className="text-xl font-bold text-indigo-900">{translation.word}</p>
                    <p className="text-sm text-indigo-800">{translation.definition}</p>
                </div>
            )}
          
            <div className="mt-4 pl-4 border-l-2 border-indigo-100 text-stone-500 italic text-base">
              "{item.analysis?.example}"
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-2 flex-wrap">
                    {item.analysis?.tags?.map((tag, idx) => (
                        <span key={idx} className="px-2.5 py-0.5 bg-stone-100 text-stone-500 text-xs font-medium rounded-full capitalize tracking-wide">
                        #{tag}
                        </span>
                    ))}
                </div>

                {/* ACTION BUTTONS FOR PREVIEW */}
                {isPreview && (
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
                            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all transform active:scale-95"
                        >
                            <Save size={14} />
                            Save to Dictionary
                        </button>
                    </div>
                )}
            </div>
        </div>

        {/* Standard Delete Button (Hidden in Preview) */}
        {!isPreview && (
          <button onClick={() => onDelete(item.id)} className="text-stone-300 hover:text-red-400 hover:bg-red-50 p-2 rounded-full transition-all ml-2">
              <Trash2 size={18} />
          </button>
        )}
      </div>
  </div>
  )
};

export default WordCard;