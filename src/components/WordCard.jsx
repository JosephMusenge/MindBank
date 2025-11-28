import React, { useState } from 'react';
import { Trash2, Save, XCircle, Volume2, StopCircle } from 'lucide-react';

const WordCard = ({ item, onDelete, isPreview = false, onSave, onDiscard }) => {
  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleSpeak = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(item.text);
    // Use a slightly slower rate for definitions/words to ensure clarity
    utterance.rate = 0.8; 
    utterance.onend = () => setIsSpeaking(false);
    
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
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
            
            {/* Audio Button */}
            <button 
              onClick={handleSpeak}
              className={`p-2 rounded-full transition-colors ${isSpeaking ? 'bg-indigo-100 text-indigo-600' : 'text-stone-300 hover:text-indigo-500 hover:bg-indigo-50'}`}
              title="Pronounce"
            >
              {isSpeaking ? <StopCircle size={20} /> : <Volume2 size={20} />}
            </button>
          </div>

        <p className="mt-3 text-stone-600 text-lg leading-relaxed">{item.analysis?.definition}</p>
        
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