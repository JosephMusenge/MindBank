import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, BookOpen, Loader2, Volume2, Sparkles, Heart, Eraser, Feather, LogIn, LogOut, Dices, X, Search, Library, ArrowLeft, Book } from 'lucide-react';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, onSnapshot, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Toaster, toast } from 'sonner';

// Import our local files
import { auth, db, googleProvider } from './lib/firebase';
import WordCard from './components/WordCard';
import QuoteCard from './components/QuoteCard';
import BookCard from './components/BookCard';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`;
const GOOGLE_BOOKS_URL = "https://www.googleapis.com/books/v1/volumes";

export default function App() {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [items, setItems] = useState([]);
  const [randomItem, setRandomItem] = useState(null);
  
  // State to hold the temporary result BEFORE saving
  const [captureResult, setCaptureResult] = useState(null);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [filter, setFilter] = useState('all'); 
  const recognitionRef = useRef(null);

  // --- State for bookshelft feature ---
  const [selectedBook, setSelectedBook] = useState(null); 
  const [showBookSearch, setShowBookSearch] = useState(false); 
  const [bookQuery, setBookQuery] = useState('');
  const [bookResults, setBookResults] = useState([]);
  const [isSearchingBooks, setIsSearchingBooks] = useState(false);

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

  // --- GOOGLE BOOKS SEARCH (FEATURE #1) ---
  const searchBooks = async () => {
    if (!bookQuery.trim()) return;
    setIsSearchingBooks(true);
    try {
      const res = await fetch(`${GOOGLE_BOOKS_URL}?q=${encodeURIComponent(bookQuery)}&maxResults=5`);
      const data = await res.json();
      setBookResults(data.items || []);
    } catch (error) {
      toast.error("Book search failed");
    } finally {
      setIsSearchingBooks(false);
    }
  };

  const attachBookMetadata = (book) => {
    // When user selects a book, we update the captureResult with accurate metadata
    const info = book.volumeInfo;
    setCaptureResult(prev => ({
      ...prev,
      source: info.title,
      author: info.authors ? info.authors[0] : prev.author,
      coverUrl: info.imageLinks?.thumbnail || null, // Store the cover URL!
      bookId: book.id
    }));
    setShowBookSearch(false);
    toast.success("Book context added!");
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

  const updateItem = async (id, data) => updateDoc(doc(db, 'users', user.uid, 'mindbank_items', id), data);
  const deleteItem = async (id) => {
    await deleteDoc(doc(db, 'users', user.uid, 'mindbank_items', id));
    toast.success("Deleted");
  };
  const toggleQuotebook = async (id, status) => {
    updateItem(id, { inQuotebook: status });
    toast.success(status ? "Added to Quotebook" : "Removed");
  };
  
  const handleShuffle = () => {
    const validItems = items.filter(item => item.inQuotebook || item.type === 'word');
    if (validItems.length === 0) return toast.error("Collection empty!");
    setRandomItem(validItems[Math.floor(Math.random() * validItems.length)]);
  };

  // --- BOOKSHELF LOGIC (FEATURE #2) ---
  // Group quotes by source field
  const bookshelf = items
    .filter(item => item.type === 'quote' && item.source) // Only quotes with a source
    .reduce((acc, item) => {
      const key = item.source.trim();
      if (!acc[key]) {
        acc[key] = {
          title: key,
          author: item.author,
          coverUrl: item.coverUrl, // New field added
          quotes: []
        };
      }
      acc[key].quotes.push(item);
      return acc;
    }, {});
  
  const books = Object.values(bookshelf).sort((a,b) => b.quotes.length - a.quotes.length);

  // Filter Logic
  const filteredItems = items.filter(item => {
    if (selectedBook) return item.source === selectedBook.title; // Show only selected book items
    if (filter === 'all') return !item.inQuotebook && item.type !== 'word';
    if (filter === 'quotebook') return item.inQuotebook === true;
    if (filter === 'word') return item.type === 'word';
    return true; 
  });

  const isIdleCentered = filter === 'all' && !captureResult && filteredItems.length === 0 && !selectedBook;

  if (loadingAuth) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-stone-300" /></div>;
  if (!user) return <div className="h-screen flex flex-col items-center justify-center p-4"><Feather size={48} className="mb-4 text-stone-800" /><h1 className="text-2xl font-serif font-bold mb-6">MindBank</h1><button onClick={handleLogin} className="px-6 py-3 bg-stone-900 text-white rounded-xl font-medium">Continue with Google</button></div>;


  // main app 
  return (
    <div className="min-h-screen bg-[#FDFCF8] text-stone-900 font-sans pb-32">
      <div className="paper-texture"></div>
      {/* Toast Notification Container */}
      <Toaster position="bottom-center" richColors />
      
      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur-md bg-[#FDFCF8]/90 border-b border-stone-200/60 transition-all">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-stone-800" onClick={() => {setFilter('all'); setSelectedBook(null);}}>
              <div className="w-9 h-9 bg-stone-900 rounded-xl flex items-center justify-center text-white shadow-lg shadow-stone-200">
                <Feather size={18} />
              </div>
              <h1 className="text-xl font-bold tracking-tight font-serif hidden sm:block">MindBank</h1>
            </div>
            
            <div className="flex items-center gap-2">
              <nav className="hidden sm:flex bg-stone-100/80 p-1 rounded-xl">
                <button onClick={() => {setFilter('all'); setSelectedBook(null);}} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${filter === 'all' && !selectedBook ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-900'}`}>Library</button>
                <button onClick={() => {setFilter('quotebook'); setSelectedBook(null);}} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${filter === 'quotebook' ? 'bg-white text-rose-600 shadow-sm' : 'text-stone-500 hover:text-rose-600'}`}><Heart size={14} className={filter === 'quotebook' ? "fill-current" : ""} /> Quotebook</button>
                <button onClick={() => {setFilter('bookshelf'); setSelectedBook(null);}} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${filter === 'bookshelf' || selectedBook ? 'bg-white text-amber-700 shadow-sm' : 'text-stone-500 hover:text-amber-700'}`}><Library size={14} /> Bookshelf</button>
                <button onClick={() => {setFilter('word'); setSelectedBook(null);}} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${filter === 'word' ? 'bg-white text-indigo-600 shadow-sm' : 'text-stone-500 hover:text-indigo-600'}`}>Words</button>
              </nav>
              
              {/* Mobile Nav Trigger / Shuffle / Logout */}
              <button onClick={handleShuffle} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-stone-100 text-stone-400 hover:text-indigo-600"><Dices size={20} /></button>
              <button onClick={handleLogout} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-600"><LogOut size={18} /></button>
            </div>
          </div>
          {/* Mobile Nav Tabs */}
          <div className="sm:hidden flex justify-around pb-3 px-4 border-t border-stone-100 pt-3 overflow-x-auto">
              <button onClick={() => setFilter('all')} className={`text-sm font-medium whitespace-nowrap px-2 ${filter === 'all' ? 'text-stone-900' : 'text-stone-400'}`}>Library</button>
              <button onClick={() => setFilter('quotebook')} className={`text-sm font-medium whitespace-nowrap px-2 ${filter === 'quotebook' ? 'text-rose-600' : 'text-stone-400'}`}>Quotes</button>
              <button onClick={() => setFilter('bookshelf')} className={`text-sm font-medium whitespace-nowrap px-2 ${filter === 'bookshelf' ? 'text-amber-700' : 'text-stone-400'}`}>Books</button>
              <button onClick={() => setFilter('word')} className={`text-sm font-medium whitespace-nowrap px-2 ${filter === 'word' ? 'text-indigo-600' : 'text-stone-400'}`}>Words</button>
          </div>
      </header>

      {/* Main Container */}
      <main className={`max-w-3xl mx-auto px-4 ${isIdleCentered ? 'min-h-[75vh] flex flex-col justify-center' : 'py-8 space-y-8'}`}>
        
        {/* --- Bookshelf View --- */}
        {filter === 'bookshelf' && !selectedBook && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-serif font-bold text-stone-800">Your Library</h2>
                    <span className="text-sm text-stone-400">{books.length} Books</span>
                </div>
                {books.length === 0 ? (
                    <div className="text-center py-20 bg-stone-50 rounded-3xl border border-stone-100">
                        <Library className="w-12 h-12 text-stone-300 mx-auto mb-3" />
                        <p className="text-stone-500">No books detected yet.</p>
                        <p className="text-sm text-stone-400 mt-1">Add quotes with a Source to populate your shelf.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6">
                        {books.map((book) => (
                            <BookCard 
                                key={book.title} 
                                {...book} 
                                quoteCount={book.quotes.length}
                                onClick={() => setSelectedBook(book)}
                            />
                        ))}
                    </div>
                )}
            </div>
        )}

        {/* --- Selected book view --- */}
        {selectedBook && (
            <div className="animate-in fade-in duration-300">
                <button onClick={() => setSelectedBook(null)} className="flex items-center gap-2 text-stone-500 hover:text-stone-900 mb-6 font-medium transition-colors">
                    <ArrowLeft size={18} /> Back to Shelf
                </button>
                <div className="flex items-start gap-6 mb-8">
                    {/* Big Cover */}
                    <div className="w-24 sm:w-32 aspect-[2/3] rounded-lg shadow-lg overflow-hidden shrink-0 bg-stone-200">
                        {selectedBook.coverUrl ? (
                            <img src={selectedBook.coverUrl} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-stone-800 text-stone-500"><Book size={32} /></div>
                        )}
                    </div>
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 mb-2 leading-tight">{selectedBook.title}</h2>
                        <p className="text-lg text-stone-500 mb-4">{selectedBook.author}</p>
                        <div className="flex gap-2">
                             <span className="bg-stone-100 text-stone-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">{selectedBook.quotes.length} Quotes Saved</span>
                        </div>
                    </div>
                </div>
                <div className="space-y-6">
                    {filteredItems.map(item => (
                        <QuoteCard key={item.id} item={item} onDelete={deleteItem} onUpdate={updateItem} onToggleQuotebook={toggleQuotebook} />
                    ))}
                </div>
            </div>
        )}


        {/* --- Standard Input Area (Hidden on Bookshelf) --- */}
        {filter !== 'bookshelf' && !selectedBook && !captureResult && (
             <div className={`relative group animate-in fade-in duration-700 ${isIdleCentered ? 'w-full transform -translate-y-8' : ''}`}>
                <div className="relative bg-white rounded-3xl shadow-xl shadow-indigo-900/5 border border-stone-100 p-1 overflow-hidden">
                    <textarea
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="What's on your mind? Capture a quote..."
                        className="w-full p-5 text-lg text-stone-800 placeholder:text-stone-300 outline-none resize-none bg-transparent font-medium leading-relaxed"
                        rows={isIdleCentered ? 2 : 3}
                    />
                    <div className="flex items-center justify-between px-4 pb-3 bg-white rounded-b-2xl">
                        <button onClick={toggleRecording} className={`flex items-center justify-center w-10 h-10 rounded-full transition-all ${isRecording ? 'bg-rose-50 text-rose-500 animate-pulse' : 'bg-stone-50 text-stone-400 hover:bg-stone-100'}`}>
                             {isRecording ? <Square size={18} fill="currentColor" /> : <Mic size={20} />}
                        </button>
                        <button onClick={analyzeAndPreview} disabled={!inputText.trim() || isProcessing} className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl font-bold text-sm tracking-wide transition-all ${!inputText.trim() ? 'bg-stone-100 text-stone-300' : 'bg-stone-900 text-white hover:bg-stone-800 shadow-lg'}`}>
                            {isProcessing ? <Loader2 className="animate-spin w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                            <span>{isProcessing ? 'THINKING' : 'CAPTURE'}</span>
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* --- Empty State --- */}
        {isIdleCentered && (
             <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
                <p className="text-stone-300 font-medium flex items-center justify-center gap-2">
                    <Feather className="w-4 h-4" /> Ready for the next thought.
                </p>
             </div>
        )}

        {/* --- Preview Area with book search --- */}
        {captureResult && (
           <div className="animate-in fade-in zoom-in-95 duration-300">
              <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs font-bold text-stone-400 uppercase tracking-wider flex items-center gap-2">
                    <Sparkles size={14} className="text-indigo-500" /> New Capture Preview
                  </h2>
                  {/* Book search trigger */}
                  {captureResult.type === 'quote' && (
                      <button 
                        onClick={() => { setBookQuery(captureResult.source || ''); setShowBookSearch(true); }}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-colors"
                      >
                        <BookOpen size={14} /> 
                        {captureResult.coverUrl ? 'Change Book' : 'Find Book Cover'}
                      </button>
                  )}
              </div>

              {captureResult.type === 'word' ? (
                <WordCard item={captureResult} isPreview={true} onSave={() => saveToLibrary(false)} onDiscard={() => setCaptureResult(null)} />
              ) : (
                <QuoteCard item={captureResult} isPreview={true} onSave={() => saveToLibrary(true)} onDiscard={() => setCaptureResult(null)} onUpdate={(id, data) => setCaptureResult(prev => ({ ...prev, ...data }))} showInsight={true} onToggleQuotebook={() => {}} />
              )}
           </div>
        )}

        {/* --- Standard List View (Library/Quotes/Words) --- */}
        {!captureResult && !isIdleCentered && filter !== 'bookshelf' && !selectedBook && (
            <div className="space-y-6">
                 {filteredItems.map((item) => (
                    item.type === 'word' 
                    ? <WordCard key={item.id} item={item} onDelete={deleteItem} />
                    : <QuoteCard key={item.id} item={item} onDelete={deleteItem} onUpdate={updateItem} onToggleQuotebook={toggleQuotebook} showInsight={filter !== 'quotebook'} />
                ))}
            </div>
        )}
      </main>
      {/* --- BOOK SEARCH MODAL --- */}
      {showBookSearch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
             <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" onClick={() => setShowBookSearch(false)}></div>
             <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-serif font-bold text-xl">Find Book Context</h3>
                    <button onClick={() => setShowBookSearch(false)} className="text-stone-400 hover:text-stone-900"><X size={20}/></button>
                </div>
                <div className="flex gap-2 mb-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 text-stone-400" size={16} />
                        <input 
                            value={bookQuery} 
                            onChange={(e) => setBookQuery(e.target.value)} 
                            onKeyDown={(e) => e.key === 'Enter' && searchBooks()}
                            placeholder="Search by Title or ISBN..." 
                            className="w-full pl-9 pr-4 py-2 bg-stone-50 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" 
                            autoFocus
                        />
                    </div>
                    <button onClick={searchBooks} disabled={isSearchingBooks} className="px-4 py-2 bg-stone-900 text-white rounded-xl font-bold text-sm">
                        {isSearchingBooks ? <Loader2 className="animate-spin" size={18} /> : 'Search'}
                    </button>
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {bookResults.map(book => (
                        <button key={book.id} onClick={() => attachBookMetadata(book)} className="flex items-start gap-3 w-full p-2 hover:bg-stone-50 rounded-lg transition-colors text-left group">
                            <div className="w-10 h-14 bg-stone-200 rounded shrink-0 overflow-hidden">
                                {book.volumeInfo.imageLinks?.smallThumbnail && <img src={book.volumeInfo.imageLinks.smallThumbnail} className="w-full h-full object-cover" />}
                            </div>
                            <div>
                                <h4 className="font-bold text-sm text-stone-800 group-hover:text-indigo-600 line-clamp-1">{book.volumeInfo.title}</h4>
                                <p className="text-xs text-stone-500 line-clamp-1">{book.volumeInfo.authors?.join(', ')}</p>
                                <p className="text-[10px] text-stone-400 mt-1">{book.volumeInfo.publishedDate?.substring(0,4)}</p>
                            </div>
                        </button>
                    ))}
                    {bookResults.length === 0 && !isSearchingBooks && <p className="text-center text-stone-400 text-sm py-4">Search for a book to see results</p>}
                </div>
             </div>
        </div>
      )}

      {/* --- Shuffle modal --- */}
      {randomItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            {/* Dark Backdrop with Blur */}
            <div 
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" 
              onClick={() => setRandomItem(null)} // Click outside to close
            ></div>

            {/* The Modal Content */}
            <div className="relative w-full max-w-xl z-10 animate-in zoom-in-95 duration-300">
              {/* Close Button */}
              <button 
                onClick={() => setRandomItem(null)}
                className="absolute -top-12 right-0 text-white/80 hover:text-white transition-colors"
              >
                <X size={32} />
              </button>

              {/* The Card Display */}
              <div className="transform transition-all">
                {randomItem.type === 'word' ? (
                  <WordCard item={randomItem} isPreview={true} onSave={() => {}} onDiscard={() => {}} />
                ) : (
                  <QuoteCard 
                    item={randomItem} 
                    // We pass showInsight={true} to make sure the user sees the AI analysis
                    showInsight={true} 
                    // We disable editing in this view to keep it clean
                    onUpdate={() => {}} 
                    onDelete={() => {}} 
                    onToggleQuotebook={() => {}}
                    // Hide the standard save/discard buttons by passing mock functions
                    isPreview={true} 
                    onSave={() => {}} 
                    onDiscard={() => {}}
                  />
                )}
              </div>

              {/* "Shuffle Again" Button */}
              <div className="mt-8 flex justify-center">
                <button
                  onClick={handleShuffle}
                  className="flex items-center gap-3 px-8 py-4 bg-white text-stone-900 rounded-full font-bold shadow-2xl hover:scale-105 active:scale-95 transition-all group"
                >
                  <Dices className="group-hover:rotate-180 transition-transform duration-500 text-indigo-600" />
                  Shuffle Again
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}