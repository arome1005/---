import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PenTool, Sparkles, CheckCircle, AlertCircle, BookOpen, RefreshCw, Send, Save, FileText } from 'lucide-react';
import { aiService } from '../aiService';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import ReactMarkdown from 'react-markdown';

const TOPICS = [
  "Describe your dream job and why you want to do it.",
  "What are the advantages and disadvantages of social media?",
  "Tell a story about a memorable trip you took.",
  "How has technology changed the way we learn?",
  "Describe your favorite hobby and how you started it."
];

const Writing: React.FC = () => {
  const [topic, setTopic] = useState(TOPICS[0]);
  const [content, setContent] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [isGeneratingModel, setIsGeneratingModel] = useState(false);
  const [modelEssay, setModelEssay] = useState<string | null>(null);

  const generateTopic = () => {
    setTopic(TOPICS[Math.floor(Math.random() * TOPICS.length)]);
    setContent('');
    setResult(null);
    setModelEssay(null);
  };

  const evaluate = async () => {
    if (!content.trim() || !auth.currentUser) return;
    setIsEvaluating(true);
    try {
      const prompt = `
        Evaluate the following English essay on the topic: "${topic}".
        Essay: "${content}"
        Provide:
        1. A score (0-100).
        2. Detailed feedback on grammar, vocabulary, and logic.
        3. A corrected version of the essay.
        Return in JSON format with fields: score, feedback, correctedVersion.
      `;
      const response = await aiService.generateContent(prompt);
      const data = JSON.parse(response);
      setResult(data);

      // Save to Firestore
      await addDoc(collection(db, `users/${auth.currentUser?.uid}/writing`), {
        topic,
        content,
        score: data.score,
        feedback: data.feedback,
        timestamp: serverTimestamp(),
      });
    } catch (error) {
      console.error("Evaluation error:", error);
    } finally {
      setIsEvaluating(false);
    }
  };

  const generateModelEssay = async () => {
    setIsGeneratingModel(true);
    try {
      const prompt = `Write a high-quality model essay for the topic: "${topic}". Use advanced vocabulary and varied sentence structures.`;
      const response = await aiService.generateContent(prompt);
      setModelEssay(response);
    } catch (error) {
      console.error("Model essay error:", error);
    } finally {
      setIsGeneratingModel(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Writing Area */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white p-8 rounded-3xl border border-black/5 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Topic</h3>
            <button 
              onClick={generateTopic}
              className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
              title="New Topic"
            >
              <RefreshCw size={20} />
            </button>
          </div>
          <p className="text-xl font-bold text-gray-900 leading-tight">"{topic}"</p>
          
          <div className="relative">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Start writing your essay here..."
              className="w-full h-[400px] p-6 bg-gray-50 rounded-2xl border border-black/5 focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all text-gray-800 leading-relaxed resize-none"
            />
            <div className="absolute bottom-4 right-4 text-xs text-gray-400">
              {content.split(/\s+/).filter(Boolean).length} words
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={evaluate}
              disabled={!content.trim() || isEvaluating}
              className="px-8 py-3 bg-blue-500 text-white rounded-xl font-bold shadow-md hover:bg-blue-600 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isEvaluating ? (
                <>
                  <RefreshCw size={20} className="animate-spin" />
                  Evaluating...
                </>
              ) : (
                <>
                  <Send size={20} />
                  Submit for Review
                </>
              )}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {result && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-8 rounded-3xl border border-black/5 shadow-sm space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Sparkles size={20} className="text-blue-500" />
                  AI Feedback
                </h3>
                <div className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-black text-xl">
                  {result.score}
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <h4 className="font-bold text-sm text-gray-500 uppercase mb-2">Detailed Feedback</h4>
                  <div className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                    {result.feedback}
                  </div>
                </div>
                
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                  <h4 className="font-bold text-sm text-emerald-500 uppercase mb-2">Corrected Version</h4>
                  <div className="text-emerald-900 text-sm leading-relaxed italic">
                    {result.correctedVersion}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Sidebar: Resources & Model Essays */}
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-white p-6 rounded-3xl border border-black/5 shadow-sm space-y-6">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <BookOpen size={20} className="text-purple-500" />
            Model Essay
          </h3>
          
          {!modelEssay ? (
            <div className="text-center space-y-4 py-8">
              <div className="p-4 rounded-full bg-purple-50 text-purple-500 w-fit mx-auto">
                <FileText size={32} />
              </div>
              <p className="text-sm text-gray-500">Need inspiration? Generate a model essay for this topic.</p>
              <button
                onClick={generateModelEssay}
                disabled={isGeneratingModel}
                className="w-full py-3 bg-purple-500 text-white rounded-xl font-bold shadow-md hover:bg-purple-600 transition-all flex items-center justify-center gap-2"
              >
                {isGeneratingModel ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    Generate Model
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-purple-50 rounded-xl border border-purple-100 max-h-[500px] overflow-y-auto no-scrollbar">
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown>{modelEssay}</ReactMarkdown>
                </div>
              </div>
              <button 
                onClick={() => setModelEssay(null)}
                className="w-full py-2 text-sm text-purple-500 font-medium hover:bg-purple-50 rounded-lg transition-all"
              >
                Clear Model Essay
              </button>
            </div>
          )}
        </div>

        <div className="bg-blue-500 p-6 rounded-3xl text-white space-y-4 shadow-lg shadow-blue-500/20">
          <h3 className="font-bold flex items-center gap-2">
            <CheckCircle size={20} />
            Writing Tips
          </h3>
          <ul className="text-sm space-y-2 opacity-90">
            <li>• Use varied sentence structures (Simple, Compound, Complex).</li>
            <li>• Link your ideas with transition words (However, Moreover, Therefore).</li>
            <li>• Check your subject-verb agreement.</li>
            <li>• Avoid repeating the same words; use synonyms.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Writing;
