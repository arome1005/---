import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Volume2, CheckCircle, RefreshCw, Trash2, Search, Filter, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { Word } from '../types';

const Vocabulary: React.FC = () => {
  const [words, setWords] = useState<Word[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [filter, setFilter] = useState<'all' | 'new' | 'learning' | 'mastered'>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, `users/${auth.currentUser.uid}/vocabulary`),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const wds = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Word));
      setWords(wds);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${auth.currentUser?.uid}/vocabulary`);
    });

    return () => unsubscribe();
  }, []);

  const filteredWords = words.filter(w => {
    const matchesFilter = filter === 'all' || w.mastery === filter;
    const matchesSearch = w.word.toLowerCase().includes(search.toLowerCase()) || 
                          w.translation.includes(search);
    return matchesFilter && matchesSearch;
  });

  const currentWord = filteredWords[currentIndex];

  const handleNext = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % filteredWords.length);
    }, 150);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + filteredWords.length) % filteredWords.length);
    }, 150);
  };

  const updateMastery = async (id: string, mastery: 'new' | 'learning' | 'mastered') => {
    if (!auth.currentUser) return;
    try {
      await updateDoc(doc(db, `users/${auth.currentUser.uid}/vocabulary`, id), { mastery });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${auth.currentUser.uid}/vocabulary/${id}`);
    }
  };

  const deleteWord = async (id: string) => {
    if (!auth.currentUser) return;
    try {
      await deleteDoc(doc(db, `users/${auth.currentUser.uid}/vocabulary`, id));
      if (currentIndex >= filteredWords.length - 1) setCurrentIndex(0);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${auth.currentUser.uid}/vocabulary/${id}`);
    }
  };

  const speak = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search words..."
            className="w-full pl-10 pr-4 py-2 bg-white rounded-xl border border-black/5 focus:ring-2 focus:ring-blue-500/20 transition-all text-sm"
          />
        </div>
        <div className="flex bg-gray-100 p-1 rounded-xl">
          {['all', 'new', 'learning', 'mastered'].map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f as any); setCurrentIndex(0); }}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${filter === f ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {filteredWords.length > 0 ? (
        <div className="space-y-8">
          {/* Flashcard */}
          <div className="perspective-1000 h-[400px] w-full max-w-lg mx-auto relative group">
            <motion.div
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className="w-full h-full relative preserve-3d cursor-pointer"
              onClick={() => setIsFlipped(!isFlipped)}
            >
              {/* Front */}
              <div className="absolute inset-0 backface-hidden bg-white rounded-3xl border-2 border-black/5 shadow-xl flex flex-col items-center justify-center p-8 space-y-6">
                <div className="p-4 rounded-full bg-blue-50 text-blue-500">
                  <Sparkles size={32} />
                </div>
                <div className="text-center">
                  <h2 className="text-5xl font-bold text-gray-900 mb-2">{currentWord.word}</h2>
                  <p className="text-blue-500 font-mono text-lg">{currentWord.phonetic}</p>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); speak(currentWord.word); }}
                  className="p-3 rounded-full bg-gray-50 text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-all"
                >
                  <Volume2 size={24} />
                </button>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-widest">Click to flip</p>
              </div>

              {/* Back */}
              <div className="absolute inset-0 backface-hidden bg-blue-500 rounded-3xl border-2 border-blue-400 shadow-xl flex flex-col items-center justify-center p-8 space-y-6 rotate-y-180 text-white">
                <div className="text-center space-y-4">
                  <p className="text-3xl font-bold">{currentWord.translation}</p>
                  <div className="h-px w-12 bg-white/30 mx-auto" />
                  <p className="text-lg italic opacity-90 leading-relaxed">"{currentWord.example}"</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={(e) => { e.stopPropagation(); updateMastery(currentWord.id, 'mastered'); }}
                    className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                  >
                    <CheckCircle size={14} /> Mastered
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); deleteWord(currentWord.id); }}
                    className="px-4 py-2 bg-red-500/20 hover:bg-red-500/40 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                  >
                    <Trash2 size={14} /> Remove
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Navigation Controls */}
            <div className="absolute -bottom-16 left-0 right-0 flex items-center justify-center gap-8">
              <button 
                onClick={handlePrev}
                className="p-4 rounded-full bg-white border border-black/5 shadow-md text-gray-400 hover:text-blue-500 transition-all"
              >
                <ChevronLeft size={24} />
              </button>
              <div className="text-sm font-bold text-gray-400">
                {currentIndex + 1} / {filteredWords.length}
              </div>
              <button 
                onClick={handleNext}
                className="p-4 rounded-full bg-white border border-black/5 shadow-md text-gray-400 hover:text-blue-500 transition-all"
              >
                <ChevronRight size={24} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="h-[400px] flex flex-col items-center justify-center text-center space-y-4 opacity-50">
          <div className="p-6 rounded-full bg-blue-50 text-blue-500">
            <BookOpen size={64} />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">No words found</p>
            <p className="text-sm text-gray-500">Words you save from reading or chat will appear here.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Vocabulary;
