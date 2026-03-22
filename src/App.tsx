import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  MessageSquare, 
  GraduationCap,
  LogOut, 
  User as UserIcon,
  Menu,
  X,
  Sparkles,
  Search,
  Bell,
  Settings
} from 'lucide-react';
import { auth, signInWithGoogle, logout, db, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { UserProfile } from './types';

// Modules
import Dashboard from './modules/Dashboard';
import AIChat from './modules/AIChat';
import Course from './modules/Course';

// Error Boundary Component
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong.";
      if (this.state.error && this.state.error.message) {
        try {
          const parsedError = JSON.parse(this.state.error.message);
          if (parsedError.error) {
            errorMessage = `Firestore Error: ${parsedError.error} during ${parsedError.operationType} on ${parsedError.path}`;
          }
        } catch (e) {
          errorMessage = this.state.error.message;
        }
      }

      return (
        <div className="h-screen w-full flex items-center justify-center bg-red-50 p-4">
          <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl border border-red-100 text-center space-y-4">
            <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto">
              <X size={32} />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Application Error</h2>
            <p className="text-sm text-gray-500 bg-gray-50 p-4 rounded-xl break-words font-mono">
              {errorMessage}
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-all"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState('course');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      setIsAuthReady(true);
      if (user) {
        // Fetch or create user profile
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);
        
        if (!userDoc.exists()) {
          const newProfile: UserProfile = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            stats: {
              chatsCount: 0,
              wordsCount: 0,
              writingCount: 0,
              lastActive: serverTimestamp(),
            }
          };
          await setDoc(userRef, newProfile);
          setUserProfile(newProfile);
        } else {
          setUserProfile(userDoc.data() as UserProfile);
        }

        // Listen for profile updates
        onSnapshot(userRef, (doc) => {
          if (doc.exists()) setUserProfile(doc.data() as UserProfile);
        });
      } else {
        setUserProfile(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const tabs = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard, color: 'text-blue-500', bg: 'bg-blue-50' },
    { id: 'chat', name: 'AI Chat', icon: MessageSquare, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { id: 'course', name: 'Course', icon: GraduationCap, color: 'text-purple-500', bg: 'bg-purple-50' },
  ];

  if (!isAuthReady) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#f7f3ee]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Loading English Buddy...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#f7f3ee] p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white p-12 rounded-[40px] shadow-2xl border border-black/5 text-center space-y-8"
        >
          <div className="w-24 h-24 bg-blue-500 rounded-[32px] flex items-center justify-center mx-auto shadow-xl shadow-blue-500/20 rotate-12">
            <Sparkles size={48} className="text-white -rotate-12" />
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-black text-gray-900 tracking-tight">English Buddy</h1>
            <p className="text-gray-500 font-medium">Your AI-powered English learning companion.</p>
          </div>
          <button 
            onClick={signInWithGoogle}
            className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-black transition-all shadow-lg shadow-black/10"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
            Sign in with Google
          </button>
          <p className="text-xs text-gray-400">By signing in, you agree to our Terms of Service.</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-[#f7f3ee] flex overflow-hidden">
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 280 : 88 }}
        className="bg-white border-r border-black/5 flex flex-col z-50"
      >
        <div className="p-6 flex items-center justify-between">
          <AnimatePresence mode="wait">
            {isSidebarOpen ? (
              <motion.div 
                key="logo"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-3"
              >
                <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <Sparkles size={20} className="text-white" />
                </div>
                <span className="font-black text-xl tracking-tight text-gray-900">Buddy</span>
              </motion.div>
            ) : (
              <motion.div 
                key="logo-small"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 mx-auto"
              >
                <Sparkles size={20} className="text-white" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <nav className="flex-1 px-4 space-y-2 py-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-4 p-3 rounded-2xl transition-all group ${activeTab === tab.id ? `${tab.bg} ${tab.color} shadow-sm` : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'}`}
            >
              <tab.icon size={24} className={activeTab === tab.id ? tab.color : 'group-hover:text-gray-600'} />
              {isSidebarOpen && <span className="font-bold text-sm">{tab.name}</span>}
              {activeTab === tab.id && isSidebarOpen && (
                <motion.div layoutId="active-pill" className="ml-auto w-1.5 h-1.5 rounded-full bg-current" />
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-black/5 space-y-4">
          <div className={`flex items-center gap-4 p-2 rounded-2xl ${isSidebarOpen ? 'bg-gray-50' : ''}`}>
            <img src={user.photoURL || ''} alt="User" className="w-10 h-10 rounded-xl shadow-sm" />
            {isSidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{user.displayName}</p>
                <p className="text-xs text-gray-400 truncate">{user.email}</p>
              </div>
            )}
          </div>
          <button 
            onClick={logout}
            className={`w-full flex items-center gap-4 p-3 rounded-2xl text-red-500 hover:bg-red-50 transition-all ${!isSidebarOpen ? 'justify-center' : ''}`}
          >
            <LogOut size={24} />
            {isSidebarOpen && <span className="font-bold text-sm">Logout</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-black/5 px-8 flex items-center justify-between z-40">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-all"
            >
              {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <h2 className="text-2xl font-black text-gray-900 capitalize">{activeTab}</h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-xl border border-black/5">
              <Search size={18} className="text-gray-400" />
              <input placeholder="Search..." className="bg-transparent border-none focus:ring-0 text-sm w-40" />
            </div>
            <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-all relative">
              <Bell size={24} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
            </button>
            <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-all">
              <Settings size={24} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {activeTab === 'dashboard' && <Dashboard userProfile={userProfile} />}
              {activeTab === 'chat' && <AIChat />}
              {activeTab === 'course' && <Course />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

export default function Root() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
