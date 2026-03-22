import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { TrendingUp, BookOpen, MessageSquare, PenTool, CheckCircle, Clock } from 'lucide-react';
import { UserProfile } from '../types';

interface DashboardProps {
  userProfile: UserProfile | null;
}

const Dashboard: React.FC<DashboardProps> = ({ userProfile }) => {
  const [data, setData] = useState([
    { name: 'Mon', chats: 4, words: 10, writing: 1 },
    { name: 'Tue', chats: 3, words: 15, writing: 0 },
    { name: 'Wed', chats: 5, words: 8, writing: 2 },
    { name: 'Thu', chats: 2, words: 20, writing: 1 },
    { name: 'Fri', chats: 6, words: 12, writing: 0 },
    { name: 'Sat', chats: 8, words: 25, writing: 3 },
    { name: 'Sun', chats: 7, words: 18, writing: 1 },
  ]);

  const stats = [
    { label: 'Total Chats', value: userProfile?.stats.chatsCount || 0, icon: MessageSquare, color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: 'Words Learned', value: userProfile?.stats.wordsCount || 0, icon: BookOpen, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { label: 'Writing Tasks', value: userProfile?.stats.writingCount || 0, icon: PenTool, color: 'text-purple-500', bg: 'bg-purple-50' },
    { label: 'Mastery Rate', value: '78%', icon: CheckCircle, color: 'text-orange-500', bg: 'bg-orange-50' },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className={`${stat.bg} p-6 rounded-2xl border border-black/5 shadow-sm flex items-center gap-4`}
          >
            <div className={`p-3 rounded-xl bg-white shadow-sm ${stat.color}`}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <TrendingUp size={20} className="text-blue-500" />
              Learning Activity
            </h3>
            <select className="text-sm border-none bg-gray-50 rounded-lg px-2 py-1 focus:ring-0">
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
            </select>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Line type="monotone" dataKey="chats" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6' }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="words" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
          <h3 className="text-lg font-bold flex items-center gap-2 mb-6">
            <Clock size={20} className="text-purple-500" />
            Recent History
          </h3>
          <div className="space-y-4">
            {[
              { type: 'Chat', title: 'Conversation about Travel', time: '2 hours ago', icon: MessageSquare, color: 'text-blue-500' },
              { type: 'Reading', title: 'NCE Unit 45: A Clear Conscience', time: '5 hours ago', icon: BookOpen, color: 'text-emerald-500' },
              { type: 'Writing', title: 'My Dream Job Essay', time: 'Yesterday', icon: PenTool, color: 'text-purple-500' },
              { type: 'Word', title: 'Learned "Conscience"', time: 'Yesterday', icon: CheckCircle, color: 'text-orange-500' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer group">
                <div className={`p-2 rounded-lg bg-gray-50 group-hover:bg-white shadow-sm ${item.color}`}>
                  <item.icon size={18} />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{item.title}</p>
                  <p className="text-xs text-gray-500">{item.type} • {item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default Dashboard;
