import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward, Repeat, Volume2, Sparkles, HelpCircle, BookOpen, Clock, List } from 'lucide-react';
import { Book, Unit } from '../types';
import { aiService } from '../aiService';

const Listening: React.FC = () => {
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isRepeat, setIsRepeat] = useState(false);
  const [questions, setQuestions] = useState<any[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    fetch('/data.json')
      .then(res => res.json())
      .then(data => {
        setBooks(data.books);
        if (data.books.length > 0) setSelectedBook(data.books[0]);
      });
  }, []);

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

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const generateQuestions = async () => {
    if (!selectedUnit || !selectedBook) return;
    setIsLoadingQuestions(true);
    try {
      const lrcText = await fetch(`${selectedBook.path}/${selectedUnit.lrc}`).then(res => res.text());
      const prompt = `Based on the following English lesson text, generate 3 multiple-choice questions to test listening comprehension. Return in JSON format with fields: question, options (array), correctOption (index). Text: \n${lrcText}`;
      const response = await aiService.generateContent(prompt);
      const data = JSON.parse(response);
      setQuestions(data);
    } catch (error) {
      console.error("Questions error:", error);
    } finally {
      setIsLoadingQuestions(false);
    }
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
      {/* Player Section */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white p-8 rounded-3xl border border-black/5 shadow-sm space-y-8">
          <div className="flex items-center gap-6">
            <div className="w-32 h-32 rounded-2xl bg-gray-100 overflow-hidden shadow-inner flex-shrink-0">
              <img src={selectedBook?.cover} alt="Cover" className="w-full h-full object-cover" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-gray-900">{selectedUnit?.title}</h3>
              <p className="text-gray-500 font-medium">{selectedBook?.name} • Unit {selectedUnit?.id}</p>
              <div className="flex gap-2">
                <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold uppercase tracking-wider">Listening</span>
                <span className="px-2 py-1 bg-purple-50 text-purple-600 rounded-lg text-xs font-bold uppercase tracking-wider">NCE</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-bold text-gray-400 font-mono">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
            <input
              type="range"
              min="0"
              max={duration}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          <div className="flex items-center justify-center gap-8">
            <button className="p-3 text-gray-400 hover:text-blue-500 transition-all">
              <SkipBack size={24} />
            </button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={togglePlay}
              className="w-20 h-20 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/30 hover:bg-blue-600 transition-all"
            >
              {isPlaying ? <Pause size={32} /> : <Play size={32} className="ml-1" />}
            </motion.button>
            <button className="p-3 text-gray-400 hover:text-blue-500 transition-all">
              <SkipForward size={24} />
            </button>
          </div>

          <div className="flex items-center justify-between pt-6 border-t">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsRepeat(!isRepeat)}
                className={`p-2 rounded-lg transition-all ${isRepeat ? 'bg-blue-50 text-blue-500' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <Repeat size={20} />
              </button>
              <button className="p-2 text-gray-400 hover:text-gray-600 transition-all">
                <Volume2 size={20} />
              </button>
            </div>
            <button 
              onClick={generateQuestions}
              disabled={isLoadingQuestions}
              className="px-4 py-2 bg-purple-50 text-purple-600 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-purple-100 transition-all"
            >
              <Sparkles size={18} />
              {isLoadingQuestions ? 'Generating...' : 'Listen & Answer'}
            </button>
          </div>
        </div>

        <audio
          ref={audioRef}
          src={selectedUnit ? `${selectedBook?.path}/${selectedUnit.audio}` : ''}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
        />

        <AnimatePresence>
          {questions.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-8 rounded-3xl border border-black/5 shadow-sm space-y-6"
            >
              <h3 className="text-lg font-bold flex items-center gap-2">
                <HelpCircle size={20} className="text-purple-500" />
                Comprehension Check
              </h3>
              <div className="space-y-8">
                {questions.map((q, i) => (
                  <div key={i} className="space-y-4">
                    <p className="font-bold text-gray-900">{i + 1}. {q.question}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {q.options.map((opt: string, j: number) => (
                        <button 
                          key={j}
                          className="p-4 text-left text-sm border border-black/5 rounded-2xl hover:bg-blue-50 hover:border-blue-200 transition-all"
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Sidebar: Unit List */}
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-white p-6 rounded-3xl border border-black/5 shadow-sm space-y-6">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <List size={20} className="text-blue-500" />
            Playlist
          </h3>
          <div className="space-y-2 max-h-[600px] overflow-y-auto no-scrollbar">
            {units.map(unit => (
              <button
                key={unit.id}
                onClick={() => setSelectedUnit(unit)}
                className={`w-full flex items-center gap-4 p-3 rounded-2xl transition-all ${selectedUnit?.id === unit.id ? 'bg-blue-50 border border-blue-100' : 'hover:bg-gray-50'}`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${selectedUnit?.id === unit.id ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                  {unit.id}
                </div>
                <div className="text-left flex-1">
                  <p className={`text-sm font-bold ${selectedUnit?.id === unit.id ? 'text-blue-600' : 'text-gray-900'}`}>{unit.title}</p>
                  <p className="text-xs text-gray-400">NCE • Lesson {unit.id}</p>
                </div>
                {selectedUnit?.id === unit.id && isPlaying && (
                  <div className="flex gap-0.5 items-end h-3">
                    <div className="w-0.5 h-full bg-blue-500 animate-bounce" />
                    <div className="w-0.5 h-2/3 bg-blue-500 animate-bounce [animation-delay:0.2s]" />
                    <div className="w-0.5 h-full bg-blue-500 animate-bounce [animation-delay:0.4s]" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Listening;
