import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square, Play, RefreshCw, CheckCircle, AlertCircle, Volume2, Sparkles, MessageCircle } from 'lucide-react';
import { aiService } from '../aiService';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const PRACTICE_TEXTS = [
  "The quick brown fox jumps over the lazy dog.",
  "English is a global language spoken by millions.",
  "Practice makes perfect, especially in language learning.",
  "I would like to order a cup of coffee, please.",
  "What is the weather like in London today?"
];

const Speaking: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [targetText, setTargetText] = useState(PRACTICE_TEXTS[0]);
  const [result, setResult] = useState<any | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [mode, setMode] = useState<'scoring' | 'live'>('scoring');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/wav' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
      };

      mediaRecorder.start();
      setIsRecording(true);
      setResult(null);
    } catch (err) {
      console.error("Error accessing microphone:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const evaluate = async () => {
    if (!audioBlob || !auth.currentUser) return;
    setIsEvaluating(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(',')[1];
        const evaluation = await aiService.evaluatePronunciation(targetText, base64Audio);
        setResult(evaluation);

        // Save attempt to Firestore
        await addDoc(collection(db, `users/${auth.currentUser?.uid}/pronunciation`), {
          text: targetText,
          score: evaluation.score,
          feedback: evaluation.feedback,
          timestamp: serverTimestamp(),
        });
      };
    } catch (error) {
      console.error("Evaluation error:", error);
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Mode Switcher */}
      <div className="flex bg-gray-100 p-1 rounded-2xl w-fit mx-auto">
        <button 
          onClick={() => setMode('scoring')}
          className={`px-6 py-2 rounded-xl text-sm font-medium transition-all ${mode === 'scoring' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Pronunciation Scoring
        </button>
        <button 
          onClick={() => setMode('live')}
          className={`px-6 py-2 rounded-xl text-sm font-medium transition-all ${mode === 'live' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Live Voice (AI)
        </button>
      </div>

      {mode === 'scoring' ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-3xl border border-black/5 shadow-sm space-y-8"
        >
          <div className="text-center space-y-4">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Target Sentence</h3>
            <p className="text-2xl font-serif text-gray-900 leading-relaxed">"{targetText}"</p>
            <div className="flex justify-center gap-2">
              <button 
                onClick={() => setTargetText(PRACTICE_TEXTS[Math.floor(Math.random() * PRACTICE_TEXTS.length)])}
                className="p-2 text-gray-400 hover:text-blue-500 transition-colors"
                title="Change Sentence"
              >
                <RefreshCw size={20} />
              </button>
              <button className="p-2 text-gray-400 hover:text-blue-500 transition-colors" title="Listen to Sample">
                <Volume2 size={20} />
              </button>
            </div>
          </div>

          <div className="flex flex-col items-center gap-6">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={isRecording ? stopRecording : startRecording}
              className={`w-24 h-24 rounded-full flex items-center justify-center transition-all shadow-lg ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
            >
              {isRecording ? <Square size={32} /> : <Mic size={32} />}
            </motion.button>
            <p className="text-sm font-medium text-gray-500">
              {isRecording ? 'Recording... Click to stop' : 'Click to start recording'}
            </p>
          </div>

          <AnimatePresence>
            {audioUrl && !isRecording && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-4 p-6 bg-gray-50 rounded-2xl border border-black/5"
              >
                <audio src={audioUrl} controls className="w-full max-w-md" />
                <button
                  onClick={evaluate}
                  disabled={isEvaluating}
                  className="px-8 py-3 bg-emerald-500 text-white rounded-xl font-bold shadow-md hover:bg-emerald-600 transition-all flex items-center gap-2"
                >
                  {isEvaluating ? (
                    <>
                      <RefreshCw size={20} className="animate-spin" />
                      Evaluating...
                    </>
                  ) : (
                    <>
                      <Sparkles size={20} />
                      Get AI Feedback
                    </>
                  )}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {result && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 border-t"
              >
                <div className="text-center p-6 bg-blue-50 rounded-2xl border border-blue-100">
                  <p className="text-xs font-bold text-blue-400 uppercase mb-2">Score</p>
                  <p className="text-5xl font-black text-blue-600">{result.score}</p>
                </div>
                <div className="md:col-span-2 space-y-4">
                  <div>
                    <h4 className="flex items-center gap-2 font-bold text-gray-900 mb-2">
                      <CheckCircle size={18} className="text-emerald-500" />
                      Feedback
                    </h4>
                    <p className="text-gray-600 text-sm leading-relaxed">{result.feedback}</p>
                  </div>
                  <div>
                    <h4 className="flex items-center gap-2 font-bold text-gray-900 mb-2">
                      <AlertCircle size={18} className="text-orange-500" />
                      Suggestions
                    </h4>
                    <p className="text-gray-600 text-sm leading-relaxed">{result.suggestions}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      ) : (
        <div className="h-[400px] flex flex-col items-center justify-center bg-white rounded-3xl border border-black/5 shadow-sm text-center p-8 space-y-6">
          <div className="p-6 rounded-full bg-purple-50 text-purple-500">
            <MessageCircle size={64} />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-bold text-gray-900">Live Voice Chat</h3>
            <p className="text-gray-500 max-w-md mx-auto">
              Speak naturally and get instant voice responses from AI. Perfect for practicing fluency and listening.
            </p>
          </div>
          <button className="px-8 py-4 bg-purple-500 text-white rounded-2xl font-bold shadow-lg hover:bg-purple-600 transition-all flex items-center gap-3">
            <Mic size={24} />
            Start Voice Call
          </button>
          <p className="text-xs text-gray-400">Requires microphone access</p>
        </div>
      )}
    </div>
  );
};

export default Speaking;
