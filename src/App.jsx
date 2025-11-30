import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, BookOpen, Loader2, Volume2, Sparkles, Heart, Eraser, Feather, LogIn, LogOut } from 'lucide-react';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, onSnapshot, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Toaster, toast } from 'sonner';

// Import our local files
import { auth, db, googleProvider } from './lib/firebase';
import WordCard from './components/WordCard';
import QuoteCard from './components/QuoteCard';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`;

export default function App() {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [items, setItems] = useState([]);
  
  // State to hold the temporary result BEFORE saving
  const [captureResult, setCaptureResult] = useState(null);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [filter, setFilter] = useState('all'); 
  const recognitionRef = useRef(null);

  // Auth Initialization
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  // Login Function
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success("Welcome back!");
    } catch (error) {
      console.error(error);
      toast.error("Login failed");
    }
  };

  // Logout Function
  const handleLogout = async () => {
    await signOut(auth);
    setItems([]); 
    toast.info("Logged out");
  };

  // Firestore Data Sync
  useEffect(() => {
    if (!user) return;

    const q = collection(db, 'users', user.uid, 'mindbank_items');
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setItems(data);
    }, (error) => {
      console.error("Firestore error:", error);
    });

    return () => unsubscribe();
  }, [user]);

  // Web Speech API
  useEffect(() => {
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

  // AI Analysis - Saves to local state
  const analyzeAndPreview = async () => {
    if (!inputText.trim() || !user) return;
    
    setIsProcessing(true);
    
    try {
      const prompt = `
        Analyze this spoken text: "${inputText}".
        
        TASK:
        1. Determine if it is a single word/idiom definition, or a quote.
        2. If it is a quote, look for spoken attribution cues like "by [Author]" or "from [Source]".
        3. EXTRACT the actual quote content separately from the attribution.
        
        Return ONLY a JSON object with this schema:
        {
          "type": "word" | "quote",
          "cleaned_text": "The content WITHOUT the 'by Author' part. Capitalize correctly.",
          "definition": "dictionary definition if word",
          "partOfSpeech": "noun/verb/etc if word",
          "example": "example sentence if word",
          "meaning": "explanation of the quote's significance if quote",
          "author": "Extracted Author Name (if spoken or known)",
          "source": "Extracted Book/Source Title (if spoken or known)",
          "tags": ["array", "of", "3", "relevant", "tags"]
        }
      `;

      const response = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      const data = await response.json();
      
      if (!data.candidates || !data.candidates[0]?.content) {
        throw new Error("AI Analysis failed");
      }

      const aiText = data.candidates[0].content.parts[0].text;
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      const analysis = JSON.parse(jsonMatch ? jsonMatch[0] : aiText);

      // Save to TEMP state (Preview)
      setCaptureResult({
        id: 'temp-preview', 
        text: analysis.cleaned_text || inputText,
        analysis,
        type: analysis.type,
        author: analysis.author || '',
        source: analysis.source || '',
        inQuotebook: false, 
        createdAt: new Date()
      });

      setInputText('');
    } catch (error) {
      console.error("Analysis failed:", error);
      toast.error("Could not analyze text. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Actions ---
  // Explicitly save the previewed item to Firestore
  const saveToLibrary = async (asFavorite = false) => {
    if (!captureResult || !user) return;
    
    try {
      const { id, ...dataToSave } = captureResult;
      
      await addDoc(collection(db, 'users', user.uid, 'mindbank_items'), {
        ...dataToSave,
        inQuotebook: asFavorite, 
        createdAt: serverTimestamp()
      });
      
      setCaptureResult(null); // Clear the preview
      // Success Toast
      const destination = asFavorite ? "Quotebook" : "Dictionary";
      toast.success(`Saved to ${destination}`);
    } catch (error) {
      console.error("Error saving to library:", error);
      toast.error("Failed to save item.");
    }
  };

  const discardPreview = () => {
    setCaptureResult(null);
    toast.info("Preview discarded");
  };

  const updatePreviewItem = (id, data) => {
    setCaptureResult(prev => ({ ...prev, ...data }));
  };

  // --- Existing Firestore Actions ---
  const deleteItem = async (id) => {
    if(!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'mindbank_items', id));
      toast.success("Item deleted");
    } catch (error) {
      console.error(error);
      toast.error("Could not delete item");
    }
  };

  const updateItem = async (id, data) => {
    if(!user) return;
    await updateDoc(doc(db, 'users', user.uid, 'mindbank_items', id), data);
  };

  const toggleQuotebook = async (id, status) => {
    try {
      await updateItem(id, { inQuotebook: status });
      toast.success(status ? "Added to Quotebook" : "Removed from Quotebook");
    } catch (error) {
      toast.error("Update failed");
    }
  };

  const clearFeed = async () => {
    if (!user) return;
    const itemsToDelete = items.filter(item => !item.inQuotebook && item.type !== 'word');
    if (itemsToDelete.length === 0) return;
    if (!confirm(`Clear ${itemsToDelete.length} unsaved items from the feed?`)) return;
    
    try {
      const deletePromises = itemsToDelete.map(item => 
        deleteDoc(doc(db, 'users', user.uid, 'mindbank_items', item.id))
      );
      await Promise.all(deletePromises);
      toast.success("Inbox cleared");
    } catch (error) {
      toast.error("Failed to clear inbox");
    }
  };

  const filteredItems = items.filter(item => {
    if (filter === 'all') {
      // "Clean Feed" Logic:
      // Exclude items that are already in the Quotebook
      // AND exclude items that are Words (which go to Dictionary)
      // This view now acts as an "Inbox" for anything that hasn't been sorted yet.
      return !item.inQuotebook && item.type !== 'word';
    }
    if (filter === 'quotebook') return item.inQuotebook === true;
    return item.type === filter; // 'word' tab shows words
  });

  const hasDeletableItems = items.some(item => !item.inQuotebook && item.type !== 'word');
  // Only center if we are on the "Library" tab, we are not currently previewing, and the library is empty.
  const isIdleCentered = filter === 'all' && !captureResult && filteredItems.length === 0;

  // --- RENDER ---
  // Loading State
  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-[#FDFCF8] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-stone-300 animate-spin" />
      </div>
    );
  }

  // Login Screen (If not authenticated)
  if (!user) {
    return (
      <div className="min-h-screen bg-[#FDFCF8] flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 bg-stone-900 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-stone-200 mb-6">
          <Feather size={32} />
        </div>
        <h1 className="text-3xl font-serif font-bold text-stone-800 mb-2">MindBank</h1>
        <p className="text-stone-500 mb-8 text-center max-w-sm">Your personal AI-powered library for quotes, thoughts, and vocabulary.</p>
        
        <button 
          onClick={handleLogin}
          className="flex items-center gap-3 px-8 py-3 bg-white border border-stone-200 rounded-xl text-stone-700 font-semibold hover:bg-stone-50 hover:border-stone-300 transition-all shadow-sm"
        >
          <img src="https://www.google.com/favicon.ico" alt="G" className="w-5 h-5" />
          Continue with Google
        </button>
      </div>
    );
  }

  // main app 
  return (
    <div className="min-h-screen bg-[#FDFCF8] text-stone-900 font-sans pb-32 selection:bg-indigo-100 selection:text-indigo-900">
      {/* Toast Notification Container */}
      <Toaster position="bottom-center" richColors />
      
      {/* Header */}
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
              <button onClick={() => setFilter('all')} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${filter === 'all' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-900 hover:bg-stone-200/50'}`}>Library</button>
              <button onClick={() => setFilter('quotebook')} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${filter === 'quotebook' ? 'bg-white text-rose-600 shadow-sm' : 'text-stone-500 hover:text-rose-600 hover:bg-stone-200/50'}`}><Heart size={14} className={filter === 'quotebook' ? "fill-current" : ""} /> Quotebook</button>
              <button onClick={() => setFilter('word')} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${filter === 'word' ? 'bg-white text-indigo-600 shadow-sm' : 'text-stone-500 hover:text-indigo-600 hover:bg-stone-200/50'}`}>Dictionary</button>
            </nav>

            <div className="flex items-center gap-2">
                {filter === 'all' && hasDeletableItems && (
                    <button 
                        onClick={clearFeed}
                        className="w-9 h-9 flex items-center justify-center rounded-full transition-all border bg-white border-stone-200 text-stone-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 shadow-sm cursor-pointer"
                        title="Clear unsaved"
                    >
                        <Eraser size={16} />
                    </button>
                )}
                
                {/* Logout Button */}
                <button 
                    onClick={handleLogout}
                    className="w-9 h-9 flex items-center justify-center rounded-full transition-all hover:bg-stone-100 text-stone-400 hover:text-stone-600"
                    title="Logout"
                >
                    <LogOut size={18} />
                </button>
            </div>
          </div>
        </div>
        {/* Mobile Nav */}
        <div className="sm:hidden flex justify-around pb-3 px-4 border-t border-stone-100 pt-3">
             <button onClick={() => setFilter('all')} className={`text-sm font-medium ${filter === 'all' ? 'text-stone-900' : 'text-stone-400'}`}>Library</button>
             <button onClick={() => setFilter('quotebook')} className={`text-sm font-medium ${filter === 'quotebook' ? 'text-rose-600' : 'text-stone-400'}`}>Quotebook</button>
             <button onClick={() => setFilter('word')} className={`text-sm font-medium ${filter === 'word' ? 'text-indigo-600' : 'text-stone-400'}`}>Dictionary</button>
        </div>
      </header>

      {/* Main Container */}
      <main className={`max-w-3xl mx-auto px-4 ${isIdleCentered ? 'min-h-[75vh] flex flex-col justify-center' : 'py-8 space-y-8'}`}>
        
        {/* INPUT AREA */}
        {filter !== 'quotebook' && !captureResult && (
            <div className={`relative group animate-in fade-in duration-700 ${isIdleCentered ? 'w-full transform -translate-y-8' : 'slide-in-from-top-4'}`}>
                <div className={`absolute -inset-0.5 bg-gradient-to-r from-indigo-300 to-violet-300 rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-500`}></div>
                <div className="relative bg-white rounded-3xl shadow-xl shadow-indigo-900/5 border border-stone-100 p-1 overflow-hidden transition-transform">
                    <textarea
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="What's on your mind? Capture a quote or define a word..."
                        className="w-full p-5 text-lg text-stone-800 placeholder:text-stone-300 outline-none resize-none bg-transparent font-medium leading-relaxed"
                        rows={isIdleCentered ? 2 : 3}
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
                            onClick={analyzeAndPreview}
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

        {/* EMPTY STATE STATUS (Only when Centered) */}
        {isIdleCentered && (
             <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
                {items.length === 0 ? (
                    <p className="text-stone-400 font-medium">Start building your second brain.</p>
                ) : (
                    <p className="text-stone-300 font-medium flex items-center justify-center gap-2">
                        <Feather className="w-4 h-4" />
                        All caught up. Ready for the next thought.
                    </p>
                )}
             </div>
        )}

        {/* PREVIEW AREA */}
        {captureResult && (
           <div className="animate-in fade-in zoom-in-95 duration-300">
              <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold text-stone-400 uppercase tracking-wider flex items-center gap-2">
                    <Sparkles size={16} className="text-indigo-500" />
                    New Capture Preview
                  </h2>
              </div>
              {captureResult.type === 'word' ? (
                <WordCard item={captureResult} isPreview={true} onSave={() => saveToLibrary(false)} onDiscard={discardPreview} />
              ) : (
                <QuoteCard item={captureResult} isPreview={true} onSave={() => saveToLibrary(true)} onDiscard={discardPreview} onUpdate={updatePreviewItem} onToggleQuotebook={() => {}} showInsight={true} />
              )}
              <div className="my-8 border-b border-stone-200/60 w-full"></div>
           </div>
        )}

        {/* FEED / LIBRARY LIST */}
        {!captureResult && !isIdleCentered && (
            <>
                <div className="flex items-center justify-between pb-2 border-b border-stone-200/60">
                    <h2 className="text-sm font-bold text-stone-400 uppercase tracking-wider">
                        {filter === 'all' && 'Inbox'}
                        {filter === 'quotebook' && 'Curated Collection'}
                        {filter === 'word' && 'Personal Dictionary'}
                    </h2>
                    <span className="text-xs font-medium text-stone-300">{filteredItems.length} items</span>
                </div>

                <div className="space-y-6 min-h-[300px]">
                    {/* View Specific Empty States */}
                    {filteredItems.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="w-20 h-20 bg-stone-50 rounded-full flex items-center justify-center mb-4">
                                {filter === 'quotebook' ? <Heart className="text-stone-300" /> : <BookOpen className="text-stone-300" />}
                            </div>
                            <p className="text-stone-400">This collection is empty.</p>
                        </div>
                    )}
                    
                    <div className="space-y-6">
                        {filteredItems.map((item) => (
                            item.type === 'word' 
                            ? <WordCard key={item.id} item={item} onDelete={deleteItem} />
                            : <QuoteCard key={item.id} item={item} onDelete={deleteItem} onUpdate={updateItem} onToggleQuotebook={toggleQuotebook} showInsight={filter !== 'quotebook'} />
                        ))}
                    </div>
                </div>
            </>
        )}
      </main>
    </div>
  );
}