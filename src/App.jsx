import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, BookOpen, Loader2, Volume2, Sparkles, Heart, Eraser, Feather } from 'lucide-react';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, onSnapshot, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';

// Import our new local files
import { auth, db } from './lib/firebase';
import WordCard from './components/WordCard';
import QuoteCard from './components/QuoteCard';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`;

export default function App() {
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [filter, setFilter] = useState('all'); 
  const recognitionRef = useRef(null);

  // Auth Initialization
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        signInAnonymously(auth).catch((error) => {
            console.error("Auth error:", error);
        });
      }
    });
    return () => unsubscribe();
  }, []);

  // Firestore Data Sync
  useEffect(() => {
    if (!user) return;

    // Local Path: users -> [userID] -> mindbank_items
    const q = collection(db, 'users', user.uid, 'mindbank_items');
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Client-side sort
      data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setItems(data);
    }, (error) => {
      console.error("Firestore error:", error);
    });

    return () => unsubscribe();
  }, [user]);

  // Web Speech API
  useEffect(() => {
    // Check browser support
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
            setInputText(prev => (prev ? prev + ' ' : '') + finalTranscript);
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        setIsRecording(false);
      };
    }
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
    } else {
      recognitionRef.current?.start();
      setIsRecording(true);
    }
  };

  // AI Analysis with Gemini
  

  // --- Actions ---
  const deleteItem = async (id) => {
    if(!user) return;
    await deleteDoc(doc(db, 'users', user.uid, 'mindbank_items', id));
  };

  const updateItem = async (id, data) => {
    if(!user) return;
    await updateDoc(doc(db, 'users', user.uid, 'mindbank_items', id), data);
  };

  const toggleQuotebook = async (id, status) => {
    updateItem(id, { inQuotebook: status });
  };

  const clearFeed = async () => {
    if (!user) return;
    const itemsToDelete = items.filter(item => !item.inQuotebook && item.type !== 'word');
    if (itemsToDelete.length === 0) return;
    if (!confirm(`Clear ${itemsToDelete.length} unsaved items from the feed?`)) return;
    
    const deletePromises = itemsToDelete.map(item => 
      deleteDoc(doc(db, 'users', user.uid, 'mindbank_items', item.id))
    );
    await Promise.all(deletePromises);
  };

  const filteredItems = items.filter(item => {
    if (filter === 'all') return true;
    if (filter === 'quotebook') return item.inQuotebook === true;
    return item.type === filter;
  });

  const hasDeletableItems = items.some(item => !item.inQuotebook && item.type !== 'word');

  return (
    <div className="min-h-screen bg-[#FDFCF8] text-stone-900 font-sans pb-32 selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* Premium Sticky Header */}
      <header className="sticky top-0 z-20 backdrop-blur-md bg-[#FDFCF8]/90 border-b border-stone-200/60 transition-all">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-stone-800 group cursor-pointer">
            <div className="w-9 h-9 bg-stone-900 rounded-xl flex items-center justify-center text-white shadow-lg shadow-stone-200 group-hover:shadow-stone-300 transition-all group-hover:scale-105">
              <Feather size={18} />
            </div>
            <h1 className="text-xl font-bold tracking-tight font-serif">MindBank</h1>
          </div>
          
          <div className="flex items-center gap-3">
            <nav className="hidden sm:flex bg-stone-100/80 p-1 rounded-xl">
              <button 
                onClick={() => setFilter('all')}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${filter === 'all' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-900 hover:bg-stone-200/50'}`}
              >
                Feed
              </button>
              <button 
                onClick={() => setFilter('quotebook')}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${filter === 'quotebook' ? 'bg-white text-rose-600 shadow-sm' : 'text-stone-500 hover:text-rose-600 hover:bg-stone-200/50'}`}
              >
                <Heart size={14} className={filter === 'quotebook' ? "fill-current" : ""} /> Quotebook
              </button>
              <button 
                onClick={() => setFilter('word')}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${filter === 'word' ? 'bg-white text-indigo-600 shadow-sm' : 'text-stone-500 hover:text-indigo-600 hover:bg-stone-200/50'}`}
              >
                Lexicon
              </button>
            </nav>
            
            {/* Mobile Menu / Clear Button */}
            {filter === 'all' && (
                <button 
                    onClick={clearFeed}
                    disabled={!hasDeletableItems}
                    className={`w-9 h-9 flex items-center justify-center rounded-full transition-all border ${
                        hasDeletableItems 
                        ? 'bg-white border-stone-200 text-stone-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 shadow-sm cursor-pointer' 
                        : 'bg-stone-50 border-transparent text-stone-200 cursor-not-allowed'
                    }`}
                    title="Clear unsaved"
                >
                    <Eraser size={16} />
                </button>
            )}
          </div>
        </div>
        
        {/* Mobile Sub-nav (Visible only on small screens) */}
        <div className="sm:hidden flex justify-around pb-3 px-4 border-t border-stone-100 pt-3">
             <button onClick={() => setFilter('all')} className={`text-sm font-medium ${filter === 'all' ? 'text-stone-900' : 'text-stone-400'}`}>Feed</button>
             <button onClick={() => setFilter('quotebook')} className={`text-sm font-medium ${filter === 'quotebook' ? 'text-rose-600' : 'text-stone-400'}`}>Quotebook</button>
             <button onClick={() => setFilter('word')} className={`text-sm font-medium ${filter === 'word' ? 'text-indigo-600' : 'text-stone-400'}`}>Dictionary</button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        
        {/* Floating Input Composer */}
        {filter !== 'quotebook' && (
            <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-300 to-violet-300 rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
                <div className="relative bg-white rounded-3xl shadow-xl shadow-indigo-900/5 border border-stone-100 p-1 overflow-hidden transition-transform">
                    <textarea
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Type a word to define, or capture a thought..."
                        className="w-full p-5 text-lg text-stone-800 placeholder:text-stone-300 outline-none resize-none bg-transparent font-medium leading-relaxed"
                        rows={3}
                    />
                    
                    <div className="flex items-center justify-between px-4 pb-3 bg-white rounded-b-2xl">
                        <div className="flex gap-2">
                            <button
                                onClick={toggleRecording}
                                className={`flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300 ${
                                isRecording 
                                    ? 'bg-rose-50 text-rose-500 ring-2 ring-rose-100 animate-pulse' 
                                    : 'bg-stone-50 text-stone-400 hover:bg-stone-100 hover:text-stone-600'
                                }`}
                                title={isRecording ? "Stop Recording" : "Start Voice Input"}
                            >
                                {isRecording ? <Square size={18} fill="currentColor" /> : <Mic size={20} />}
                            </button>
                        </div>

                        <button
                            onClick={analyzeAndSave}
                            disabled={!inputText.trim() || isProcessing}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl font-bold text-sm tracking-wide transition-all transform active:scale-95 ${
                                !inputText.trim() || isProcessing
                                ? 'bg-stone-100 text-stone-300 cursor-not-allowed'
                                : 'bg-stone-900 text-white hover:bg-stone-800 shadow-lg hover:shadow-xl shadow-stone-200'
                            }`}
                        >
                            {isProcessing ? (
                                <>
                                <Loader2 className="animate-spin w-4 h-4" />
                                <span>THINKING</span>
                                </>
                            ) : (
                                <>
                                <Sparkles className="w-4 h-4" />
                                <span>CAPTURE</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Feed Header */}
        <div className="flex items-center justify-between pb-2 border-b border-stone-200/60">
            <h2 className="text-sm font-bold text-stone-400 uppercase tracking-wider">
                {filter === 'all' && 'Recent Captures'}
                {filter === 'quotebook' && 'Curated Collection'}
                {filter === 'word' && 'Personal Lexicon'}
            </h2>
            <span className="text-xs font-medium text-stone-300">{filteredItems.length} items</span>
        </div>

        {/* Content Feed */}
        <div className="space-y-6 min-h-[300px]">
          {items.length === 0 && !isProcessing && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-24 h-24 bg-gradient-to-br from-stone-100 to-white rounded-full flex items-center justify-center mb-6 border border-stone-100 shadow-inner">
                <BookOpen className="text-stone-300 w-10 h-10" />
              </div>
              <h3 className="text-xl font-serif font-bold text-stone-800 mb-2">Your MindBank is Empty</h3>
              <p className="text-stone-500 max-w-xs leading-relaxed">
                Start building your second brain. Capture a quote or learn a new word today.
              </p>
            </div>
          )}

          {filter === 'quotebook' && filteredItems.length === 0 && items.length > 0 && (
             <div className="flex flex-col items-center justify-center py-16 px-8 border-2 border-dashed border-stone-200 rounded-3xl bg-stone-50/50">
                <div className="p-4 bg-white rounded-full shadow-sm mb-4">
                    <Heart className="w-8 h-8 text-rose-200" />
                </div>
                <p className="text-stone-500 font-medium text-center">Your collection is waiting for its first gem.</p>
             </div>
          )}

          <div className="space-y-6">
            {filteredItems.map((item) => (
                item.type === 'word' 
                ? <WordCard key={item.id} item={item} onDelete={deleteItem} />
                : <QuoteCard 
                    key={item.id} 
                    item={item} 
                    onDelete={deleteItem} 
                    onUpdate={updateItem}
                    onToggleQuotebook={toggleQuotebook}
                    showInsight={filter !== 'quotebook'}
                    />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}