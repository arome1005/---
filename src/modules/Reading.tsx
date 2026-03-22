import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Headphones, Languages, Sparkles, Plus, Check, Volume2, ChevronLeft, ChevronRight, Settings, Type, Play } from 'lucide-react';
import { aiService } from '../aiService';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Book, Unit, Word } from '../types';

interface ReadingProps {
  bookKey?: string;
}

const Reading: React.FC<ReadingProps> = ({ bookKey }) => {
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [lyrics, setLyrics] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExplaining, setIsExplaining] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [selectedWord, setSelectedWord] = useState<any | null>(null);
  const [fontSize, setFontSize] = useState(18);
  const [fontFamily, setFontFamily] = useState('serif');

  useEffect(() => {
    fetch('/data.json')
      .then(res => res.json())
      .then(data => {
        setBooks(data.books);
        if (bookKey) {
          const book = data.books.find((b: Book) => b.key === bookKey);
          if (book) setSelectedBook(book);
        } else if (data.books.length > 0) {
          setSelectedBook(data.books[0]);
        }
      });
  }, [bookKey]);

  useEffect(() => {
    if (selectedBook) {
      fetch(`${selectedBook.path}/units.json`)
        .then(res => res.json())
        .then(data => {
          setUnits(data);
          if (data.length > 0) setSelectedUnit(data[0]);
        });
    }
  }, [selectedBook]);

  useEffect(() => {
    if (selectedUnit && selectedBook) {
      fetch(`${selectedBook.path}/${selectedUnit.lrc}`)
        .then(res => res.text())
        .then(text => {
          const parsed = parseLRC(text);
          setLyrics(parsed);
        });
    }
  }, [selectedUnit, selectedBook]);

  const parseLRC = (lrcText: string) => {
    const lines = lrcText.split('\n');
    const lyrics = [];
    for (const line of lines) {
      const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.+)/);
      if (match) {
        const minutes = parseInt(match[1]);
        const seconds = parseInt(match[2]);
        const milliseconds = parseInt(match[3]);
        const time = minutes * 60 + seconds + milliseconds / 1000 - 0.5;
        const text = match[4].trim();
        const parts = text.split('|').map((p: string) => p.trim());
        lyrics.push({
          time,
          english: parts[0] || '',
          chinese: parts[1] || '',
        });
      }
    }
    return lyrics;
  };

  const handleWordClick = async (word: string) => {
    setIsLoading(true);
    setSelectedWord({ word, loading: true });
    try {
      const prompt = `Translate and explain the word "${word}" in the context of learning English. Provide: 
      1. Phonetic symbol
      2. Chinese translation
      3. A simple English definition
      4. An example sentence
      Return in JSON format with fields: word, phonetic, translation, definition, example.`;
      
      const response = await aiService.generateContent(prompt);
      const data = JSON.parse(response);
      setSelectedWord(data);
    } catch (error) {
      console.error("Word translation error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveWord = async () => {
    if (!selectedWord || !auth.currentUser) return;
    try {
      await addDoc(collection(db, `users/${auth.currentUser.uid}/vocabulary`), {
        ...selectedWord,
        mastery: 'new',
        timestamp: serverTimestamp(),
      });
      setSelectedWord({ ...selectedWord, saved: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${auth.currentUser.uid}/vocabulary`);
    }
  };

  const handleExplain = async () => {
    if (!lyrics.length) return;
    setIsExplaining(true);
    setExplanation(null);
    try {
      const fullText = lyrics.map(l => l.english).join('\n');
      const prompt = `Explain this English lesson text for a student. Include key vocabulary, grammar points, and a summary. Text: \n${fullText}`;
      const response = await aiService.generateContent(prompt);
      setExplanation(response);
    } catch (error) {
      console.error("Explanation error:", error);
    } finally {
      setIsExplaining(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
      {/* Sidebar: Unit Selection (课程列表) */}
      <div className="lg:col-span-1 flex flex-col gap-4 overflow-y-auto pr-2 no-scrollbar">
        <div className="bg-[#2a2e33] p-4 rounded-2xl border border-white/5 shadow-sm">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">课程列表</h3>
          <div className="space-y-2">
            {units.map(unit => (
              <button
                key={unit.id}
                onClick={() => setSelectedUnit(unit)}
                className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-all border ${
                  selectedUnit?.id === unit.id 
                    ? 'bg-white/10 border-white/20 text-white font-bold' 
                    : 'bg-transparent border-transparent text-gray-400 hover:bg-white/5'
                }`}
              >
                {unit.id.toString().padStart(3, '0')}. {unit.title}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content: Reading Area */}
      <div className="lg:col-span-3 flex flex-col gap-4">
        <div className="bg-[#2a2e33] p-8 md:p-12 rounded-3xl border border-white/5 shadow-2xl flex-1 overflow-y-auto relative no-scrollbar">
          {/* Unit Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                <BookOpen size={32} className="text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white">《{selectedBook?.name}》</h2>
                <p className="text-gray-400 font-bold">{selectedUnit?.id}. {selectedUnit?.title}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={handleExplain}
                disabled={isExplaining}
                className="p-3 rounded-xl bg-white/5 border border-white/10 text-blue-400 hover:bg-white/10 transition-all"
              >
                <Sparkles size={20} className={isExplaining ? 'animate-pulse' : ''} />
              </button>
            </div>
          </div>

          {/* Player Controls (Mockup based on screenshot) */}
          <div className="bg-[#1a1d21] p-4 rounded-2xl border border-white/5 flex items-center gap-6 mb-8">
            <div className="flex items-center gap-4">
              <button className="p-2 text-gray-400 hover:text-white"><ChevronLeft size={20} /></button>
              <button className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
                <Play size={24} fill="currentColor" />
              </button>
              <button className="p-2 text-gray-400 hover:text-white"><ChevronRight size={20} /></button>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 text-sm font-bold text-gray-300">
              1.0x
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 text-sm font-bold text-gray-300">
              中
            </div>
          </div>

          <div className="max-w-2xl mx-auto space-y-8">
            <div className="space-y-6">
              {lyrics.map((line, i) => (
                <div key={i} className="group p-4 rounded-2xl hover:bg-white/5 transition-all border border-transparent hover:border-white/5">
                  <p 
                    className={`font-serif leading-relaxed text-gray-200 transition-all cursor-text`}
                    style={{ fontSize: `${fontSize}px` }}
                  >
                    {line.english.split(' ').map((word: string, j: number) => (
                      <span 
                        key={j} 
                        onClick={() => handleWordClick(word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,""))}
                        className="hover:text-blue-400 rounded px-0.5 transition-colors cursor-pointer"
                      >
                        {word}{' '}
                      </span>
                    ))}
                  </p>
                  <p className="text-sm text-gray-500 mt-2 font-medium">
                    {line.chinese}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Word Popup / Explanation Panel */}
        <AnimatePresence>
          {(selectedWord || explanation) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-white p-6 rounded-2xl border border-black/5 shadow-xl relative"
            >
              <button 
                onClick={() => { setSelectedWord(null); setExplanation(null); }}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              >
                &times;
              </button>

              {selectedWord && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900">{selectedWord.word}</h3>
                      <p className="text-blue-500 font-mono">{selectedWord.phonetic}</p>
                    </div>
                    <button 
                      onClick={saveWord}
                      disabled={selectedWord.saved}
                      className={`p-3 rounded-xl transition-all ${selectedWord.saved ? 'bg-emerald-50 text-emerald-500' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
                    >
                      {selectedWord.saved ? <Check size={20} /> : <Plus size={20} />}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <p className="text-xs font-bold text-gray-400 uppercase mb-1">Translation</p>
                      <p className="text-gray-900">{selectedWord.translation}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <p className="text-xs font-bold text-gray-400 uppercase mb-1">Definition</p>
                      <p className="text-gray-900 text-sm">{selectedWord.definition}</p>
                    </div>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                    <p className="text-xs font-bold text-blue-400 uppercase mb-1">Example</p>
                    <p className="text-blue-900 italic">"{selectedWord.example}"</p>
                  </div>
                </div>
              )}

              {explanation && (
                <div className="prose prose-sm max-w-none">
                  <h3 className="flex items-center gap-2 text-blue-600">
                    <Sparkles size={20} />
                    AI Lesson Insight
                  </h3>
                  <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                    {explanation}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Reading;
