import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Headphones, 
  Mic, 
  BookOpen, 
  PenTool, 
  Library,
  ChevronDown,
  Moon,
  Sun,
  Play,
  SkipBack,
  SkipForward,
  Video
} from 'lucide-react';

// Modules
import Listening from './Listening';
import Speaking from './Speaking';
import Reading from './Reading';
import Writing from './Writing';
import Vocabulary from './Vocabulary';

const Course: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState('reading');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [books, setBooks] = useState<any[]>([]);
  const [selectedBookKey, setSelectedBookKey] = useState('');

  useEffect(() => {
    fetch('/data.json')
      .then(res => res.json())
      .then(data => {
        setBooks(data.books);
        if (data.books.length > 0) setSelectedBookKey(data.books[0].key);
      });
  }, []);

  const subTabs = [
    { id: 'reading', name: '课文', icon: BookOpen },
    { id: 'listening', name: '听力', icon: Headphones },
    { id: 'speaking', name: '口语', icon: Mic },
    { id: 'writing', name: '写作', icon: PenTool },
    { id: 'vocabulary', name: '词汇', icon: Library },
  ];

  return (
    <div className={`flex flex-col h-full -m-8 ${isDarkMode ? 'bg-[#141619] text-white' : 'bg-[#f7f3ee] text-gray-900'}`}>
      {/* NCE Header Style */}
      <header className={`px-8 py-6 flex items-center justify-between border-b ${isDarkMode ? 'border-white/5 bg-[#141619]' : 'border-black/5 bg-white'}`}>
        <div className="flex flex-col">
          <h1 className={`text-4xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>新概念英语</h1>
          <p className={`text-sm font-bold tracking-[0.2em] opacity-40 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>NEW CONCEPT ENGLISH</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <select 
              value={selectedBookKey}
              onChange={(e) => setSelectedBookKey(e.target.value)}
              className={`appearance-none pl-4 pr-10 py-2 rounded-xl border text-sm font-bold focus:outline-none transition-all ${isDarkMode ? 'bg-[#2a2e33] border-white/10 text-white' : 'bg-gray-50 border-black/5 text-gray-900'}`}
            >
              {books.map(book => (
                <option key={book.key} value={book.key}>{book.name}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 pointer-events-none" />
          </div>
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`p-2 rounded-xl border ${isDarkMode ? 'bg-[#2a2e33] border-white/10 text-gray-400' : 'bg-gray-50 border-black/5 text-gray-500'}`}
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col p-8 overflow-y-auto no-scrollbar">
          {/* Sub-navigation (Tabs like in screenshot) */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-1 bg-white/5 p-1 rounded-2xl border border-white/5">
              {subTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveSubTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-2 rounded-xl transition-all font-bold text-sm ${
                    activeSubTab === tab.id 
                      ? `${isDarkMode ? 'bg-white/10 text-white shadow-lg' : 'bg-white text-black shadow-sm'}` 
                      : 'opacity-40 hover:opacity-100'
                  }`}
                >
                  <tab.icon size={16} />
                  {tab.name}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 text-white text-sm font-bold shadow-lg shadow-orange-600/20 hover:bg-orange-500 transition-all">
                <Video size={16} />
                关联本地视频
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 min-h-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${activeSubTab}-${selectedBookKey}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                {activeSubTab === 'reading' && <Reading bookKey={selectedBookKey} />}
                {activeSubTab === 'listening' && <Listening />}
                {activeSubTab === 'speaking' && <Speaking />}
                {activeSubTab === 'writing' && <Writing />}
                {activeSubTab === 'vocabulary' && <Vocabulary />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Course;
