/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  auth, db, googleProvider, signInWithPopup, signOut, onAuthStateChanged, 
  collection, doc, setDoc, getDoc, query, where, onSnapshot, addDoc, serverTimestamp, Timestamp, User
} from './firebase';
import { 
  LayoutDashboard, 
  Activity, 
  Cpu, 
  Terminal, 
  Settings, 
  LogOut, 
  LogIn, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  CheckCircle2, 
  Clock,
  ShieldCheck,
  Zap,
  RefreshCw,
  Github,
  Link2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---

interface Signal {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  entry: number;
  tp: number;
  sl: number;
  confidence: number;
  status: 'PENDING' | 'ACTIVE' | 'CLOSED';
  timestamp: Timestamp;
}

interface SystemLog {
  id: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  source: string;
  timestamp: Timestamp;
}

interface ProfitData {
  time: string;
  profit: number;
}

// --- Components ---

const StatCard = ({ title, value, subValue, icon: Icon, trend }: { 
  title: string, 
  value: string, 
  subValue?: string, 
  icon: any, 
  trend?: 'up' | 'down' 
}) => (
  <div className="bg-[#151619] border border-[#2A2B2F] rounded-xl p-5 flex flex-col gap-1">
    <div className="flex justify-between items-start mb-2">
      <span className="text-[11px] font-mono text-[#8E9299] uppercase tracking-wider">{title}</span>
      <Icon className="w-4 h-4 text-[#8E9299]" />
    </div>
    <div className="flex items-baseline gap-2">
      <span className="text-2xl font-mono font-medium text-white tracking-tight">{value}</span>
      {trend && (
        <span className={cn(
          "text-[10px] font-mono font-bold px-1.5 py-0.5 rounded",
          trend === 'up' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
        )}>
          {trend === 'up' ? '▲' : '▼'}
        </span>
      )}
    </div>
    {subValue && <span className="text-[11px] font-mono text-[#5C5F66]">{subValue}</span>}
  </div>
);

const SignalRow = ({ signal }: { signal: Signal }) => (
  <div className="grid grid-cols-6 gap-4 py-3 px-4 border-b border-[#2A2B2F] hover:bg-[#1C1D21] transition-colors items-center">
    <div className="flex flex-col">
      <span className="text-sm font-mono font-bold text-white">{signal.symbol}</span>
      <span className="text-[10px] font-mono text-[#5C5F66]">{signal.timestamp.toDate().toLocaleTimeString()}</span>
    </div>
    <div className={cn(
      "text-[10px] font-mono font-bold px-2 py-1 rounded w-fit",
      signal.type === 'BUY' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
    )}>
      {signal.type}
    </div>
    <div className="text-sm font-mono text-[#E6E6E6]">{signal.entry.toFixed(5)}</div>
    <div className="text-sm font-mono text-[#8E9299]">{signal.tp.toFixed(5)}</div>
    <div className="text-sm font-mono text-[#8E9299]">{signal.sl.toFixed(5)}</div>
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-[#2A2B2F] rounded-full overflow-hidden">
        <div 
          className="h-full bg-indigo-500" 
          style={{ width: `${signal.confidence * 100}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-[#8E9299]">{(signal.confidence * 100).toFixed(0)}%</span>
    </div>
  </div>
);

const LogItem = ({ log }: { log: SystemLog }) => (
  <div className="flex gap-3 py-2 px-4 border-l-2 border-transparent hover:border-indigo-500 hover:bg-[#1C1D21] transition-all">
    <div className={cn(
      "mt-1 w-1.5 h-1.5 rounded-full shrink-0",
      log.level === 'ERROR' ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]" :
      log.level === 'WARN' ? "bg-amber-500" : "bg-indigo-500"
    )} />
    <div className="flex flex-col gap-0.5 overflow-hidden">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono text-[#5C5F66]">{log.timestamp.toDate().toLocaleTimeString()}</span>
        <span className="text-[10px] font-mono font-bold text-[#8E9299] uppercase tracking-tighter">[{log.source}]</span>
      </div>
      <p className="text-[11px] font-mono text-[#E6E6E6] leading-relaxed truncate">{log.message}</p>
    </div>
  </div>
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'signals' | 'ai' | 'logs'>('dashboard');

  // Mock Profit Data
  const profitData = useMemo(() => [
    { time: '08:00', profit: 120 },
    { time: '10:00', profit: 450 },
    { time: '12:00', profit: 320 },
    { time: '14:00', profit: 890 },
    { time: '16:00', profit: 1240 },
    { time: '18:00', profit: 1100 },
    { time: '20:00', profit: 1560 },
  ], []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (currentUser) {
        // Sync user profile
        const userRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userRef);
        if (!userDoc.exists()) {
          await setDoc(userRef, {
            uid: currentUser.uid,
            email: currentUser.email,
            role: currentUser.email === 'nuna69v@gmail.com' ? 'admin' : 'viewer',
            createdAt: serverTimestamp()
          });
        }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Real-time Signals
    const signalsQuery = query(collection(db, 'signals'), where('status', '!=', 'CLOSED'));
    const unsubSignals = onSnapshot(signalsQuery, (snapshot) => {
      setSignals(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Signal)));
    });

    // Real-time Logs
    const logsQuery = query(collection(db, 'logs'));
    const unsubLogs = onSnapshot(logsQuery, (snapshot) => {
      setLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SystemLog)).sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis()));
    });

    return () => {
      unsubSignals();
      unsubLogs();
    };
  }, [user]);

  const handleLogin = () => signInWithPopup(auth, googleProvider);
  const handleLogout = () => signOut(auth);

  const seedData = async () => {
    if (!user || user.email !== 'nuna69v@gmail.com') return;
    
    const mockSignals = [
      { symbol: 'EURUSD', type: 'BUY', entry: 1.08542, tp: 1.09200, sl: 1.08200, confidence: 0.92, status: 'ACTIVE', timestamp: serverTimestamp() },
      { symbol: 'GBPUSD', type: 'SELL', entry: 1.26450, tp: 1.25800, sl: 1.26800, confidence: 0.88, status: 'ACTIVE', timestamp: serverTimestamp() },
      { symbol: 'XAUUSD', type: 'BUY', entry: 2154.20, tp: 2180.00, sl: 2140.00, confidence: 0.95, status: 'ACTIVE', timestamp: serverTimestamp() },
    ];

    const mockLogs = [
      { level: 'INFO', message: 'AI Engine initialized successfully. Version 3.1.0-STABLE', source: 'CORE', timestamp: serverTimestamp() },
      { level: 'INFO', message: 'Market data stream connected. Latency: 14ms', source: 'NETWORK', timestamp: serverTimestamp() },
      { level: 'WARN', message: 'High volatility detected in XAUUSD. Risk parameters adjusted.', source: 'RISK', timestamp: serverTimestamp() },
      { level: 'INFO', message: 'New BUY signal generated for EURUSD. Confidence: 92%', source: 'AI', timestamp: serverTimestamp() },
    ];

    for (const s of mockSignals) await addDoc(collection(db, 'signals'), s);
    for (const l of mockLogs) await addDoc(collection(db, 'logs'), l);
    alert('Seed data injected successfully.');
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0A0B0D] flex items-center justify-center">
      <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
    </div>
  );

  if (!user) return (
    <div className="min-h-screen bg-[#0A0B0D] flex flex-col items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-[#151619] border border-[#2A2B2F] rounded-2xl p-10 text-center shadow-2xl"
      >
        <div className="w-20 h-20 bg-indigo-500/10 border border-indigo-500/20 rounded-3xl flex items-center justify-center mx-auto mb-8 relative">
          <Zap className="w-10 h-10 text-indigo-500 fill-indigo-500/20" />
          <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-20" />
        </div>
        <h1 className="text-2xl font-mono font-bold text-white mb-2 tracking-tight">DESKTOP DEVICE 770099</h1>
        <p className="text-[#8E9299] text-sm font-mono mb-10 leading-relaxed">
          SIMULATED COMPUTER SYSTEM<br/>
          VERSION 7700.99.0
        </p>
        <button 
          onClick={handleLogin}
          className="w-full flex items-center justify-center gap-3 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-mono font-bold transition-all shadow-lg shadow-indigo-500/20"
        >
          <LogIn className="w-5 h-5" />
          INITIALIZE SESSION
        </button>
      </motion.div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0A0B0D] text-[#E6E6E6] flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-[#2A2B2F] bg-[#0F1012] flex flex-col">
        <div className="p-6 flex items-center gap-3 border-b border-[#2A2B2F]">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(79,70,229,0.4)]">
            <Zap className="w-5 h-5 text-white fill-white/20" />
          </div>
          <span className="font-mono font-bold text-sm tracking-widest">DEVICE 770099</span>
        </div>

        <nav className="flex-1 p-4 flex flex-col gap-1">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'DASHBOARD' },
            { id: 'signals', icon: Activity, label: 'SIGNALS' },
            { id: 'ai', icon: Cpu, label: 'AI ENGINE' },
            { id: 'logs', icon: Terminal, label: 'SYSTEM LOGS' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg font-mono text-[11px] font-bold tracking-wider transition-all",
                activeTab === item.id 
                  ? "bg-indigo-600/10 text-indigo-500 border border-indigo-500/20" 
                  : "text-[#5C5F66] hover:text-[#8E9299] hover:bg-[#1C1D21]"
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
          {user.email === 'nuna69v@gmail.com' && (
          <button
            onClick={seedData}
            className="flex items-center gap-3 px-4 py-3 rounded-lg font-mono text-[11px] font-bold tracking-wider text-amber-500 hover:bg-amber-500/5 transition-all mt-4 border border-amber-500/20"
          >
            <RefreshCw className="w-4 h-4" />
            SEED DATA
          </button>
        )}
      </nav>

        <div className="p-4 border-t border-[#2A2B2F]">
          <div className="bg-[#151619] rounded-xl p-4 mb-4 border border-[#2A2B2F]">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              <span className="text-[10px] font-mono font-bold text-[#8E9299]">SYSTEM ONLINE</span>
            </div>
            <div className="text-[10px] font-mono text-[#5C5F66] flex flex-col gap-1">
              <span>LATENCY: 42ms</span>
              <span>UPTIME: 99.9%</span>
            </div>
            
            <div className="mt-4 pt-4 border-t border-[#2A2B2F] flex flex-col gap-2 max-h-40 overflow-y-auto custom-scrollbar">
              {[
                'nuna69v-cell/.github',
                'nuna69v-cell/A6..9V-GenX_FX.main',
                'nuna69v-cell/agency-agents',
                'nuna69v-cell/agent-skills',
                'nuna69v-cell/AI-model',
                'nuna69v-cell/aif_tutorial',
                'nuna69v-cell/AJBrownThesisIsotherms',
                'nuna69v-cell/all-in-one-desktop-mode-',
                'nuna69v-cell/androidx',
                'nuna69v-cell/android_kernel_microsoft_WSA',
                'nuna69v-cell/ansible-role-api-bridge',
                'nuna69v-cell/api-cli',
                'nuna69v-cell/Autonomous-trading-Exness',
                'nuna69v-cell/awesome',
                'nuna69v-cell/aws-ec2-t-unlimited',
                'nuna69v-cell/circleci-docs',
                'nuna69v-cell/Complete-backend-',
                'nuna69v-cell/Core',
                'nuna69v-cell/cursor',
                'nuna69v-cell/Database-collaborate-components',
                'nuna69v-cell/Demo-driver-Bridge',
                'nuna69v-cell/demo-repository',
                'nuna69v-cell/demy-landing',
                'nuna69v-cell/Desktop-device-770099',
                'nuna69v-cell/Dev-handbooks',
                'nuna69v-cell/docker',
                'nuna69v-cell/docker-images',
                'nuna69v-cell/docker.com',
                'nuna69v-cell/Domain',
                'nuna69v-cell/drive-mobile',
                'nuna69v-cell/EA',
                'nuna69v-cell/edgetunnel',
                'nuna69v-cell/eXPerienceBar',
                'nuna69v-cell/eXPeriencefox',
                'nuna69v-cell/fontforge.github.io',
                'nuna69v-cell/FXPRO-broker',
                'nuna69v-cell/gitbook',
                'nuna69v-cell/GitHub-document',
                'nuna69v-cell/github-mcp-server',
                'nuna69v-cell/hardhat-starter-kit',
                'nuna69v-cell/HEARTBEAT',
                'nuna69v-cell/hosts-farm',
                'nuna69v-cell/Indexing-Workflow-controller',
                'nuna69v-cell/isodb-library',
                'nuna69v-cell/isodbtools',
                'nuna69v-cell/isotherm-digitizer-panel',
                'nuna69v-cell/jet',
                'nuna69v-cell/JETSCAPE',
                'nuna69v-cell/jules-action',
                'nuna69v-cell/jules-awesome-list',
                'nuna69v-cell/jules-sdk',
                'nuna69v-cell/Launcher-',
                'nuna69v-cell/linux_kernel_microsoft_wsa',
                'nuna69v-cell/Memory',
                'nuna69v-cell/Microsoft-Teams-Samples',
                'nuna69v-cell/MinecraftForge',
                'nuna69v-cell/ML',
                'nuna69v-cell/MQL5-Google-Onedrive',
                'nuna69v-cell/my-driver-projects',
                'nuna69v-cell/NIST-Cybersecurity-Framework-R1-1.github.io',
                'nuna69v-cell/nist-data-mirror',
                'nuna69v-cell/numpy',
                'nuna69v-cell/Octopus-station',
                'nuna69v-cell/office-js',
                'nuna69v-cell/openscap',
                'nuna69v-cell/pandas',
                'nuna69v-cell/parrot-iso-build',
                'nuna69v-cell/render-mcp-server',
                'nuna69v-cell/sdk',
                'nuna69v-cell/Security-manager-directory',
                'nuna69v-cell/skills-hello-github-actions',
                'nuna69v-cell/termius-cli',
                'nuna69v-cell/termux-packages',
                'nuna69v-cell/ToolJet',
                'nuna69v-cell/Trading-engine',
                'nuna69v-cell/Warp',
                'nuna69v-cell/Windows11-Bypass',
                'nuna69v-cell/windup',
              ].map(repo => (
                <div key={repo} className="flex items-center gap-2 text-[9px] font-mono text-[#5C5F66]">
                  <Github className="w-3 h-3 shrink-0" />
                  <span className="truncate">{repo}</span>
                </div>
              ))}
              <div className="mt-2 flex items-center gap-2 text-[8px] font-mono text-[#3D4047] bg-[#0A0B0D] px-2 py-1 rounded">
                <ShieldCheck className="w-2.5 h-2.5" />
                <span>GPG: B5690EEEBB952194</span>
              </div>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-rose-500 hover:bg-rose-500/5 rounded-lg font-mono text-[11px] font-bold tracking-wider transition-all"
          >
            <LogOut className="w-4 h-4" />
            TERMINATE
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-16 border-b border-[#2A2B2F] bg-[#0F1012] flex items-center justify-between px-8">
          <div className="flex items-center gap-4">
            <span className="text-[11px] font-mono text-[#5C5F66] uppercase tracking-widest">SESSION: {user.uid.slice(0, 8)}</span>
            <div className="h-4 w-px bg-[#2A2B2F]" />
            <span className="text-[11px] font-mono text-[#5C5F66] uppercase tracking-widest">MARKET: OPEN</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span className="text-[11px] font-mono font-bold text-[#8E9299]">ENCRYPTED</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-[11px] font-mono font-bold text-white">{user.displayName}</div>
                <div className="text-[9px] font-mono text-[#5C5F66]">{user.email}</div>
              </div>
              <img src={user.photoURL || ''} className="w-8 h-8 rounded-lg border border-[#2A2B2F]" referrerPolicy="no-referrer" />
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col gap-8"
              >
                {/* Stats Grid */}
                <div className="grid grid-cols-4 gap-6">
                  <StatCard title="ACCOUNT BALANCE" value="$42,850.24" subValue="+12.4% THIS MONTH" icon={TrendingUp} trend="up" />
                  <StatCard title="DAILY PROFIT" value="+$1,560.00" subValue="4 ACTIVE TRADES" icon={Activity} trend="up" />
                  <StatCard title="AI CONFIDENCE" value="94.2%" subValue="HIGH PROBABILITY" icon={Cpu} />
                  <StatCard title="RISK LEVEL" value="LOW" subValue="0.5% PER TRADE" icon={ShieldCheck} />
                </div>

                <div className="grid grid-cols-3 gap-8">
                  {/* Profit Chart */}
                  <div className="col-span-2 bg-[#151619] border border-[#2A2B2F] rounded-2xl p-6">
                    <div className="flex justify-between items-center mb-8">
                      <h3 className="text-sm font-mono font-bold text-white tracking-widest">PROFIT PERFORMANCE (USD)</h3>
                      <div className="flex gap-2">
                        {['1D', '1W', '1M', 'ALL'].map(p => (
                          <button key={p} className="px-2 py-1 text-[9px] font-mono font-bold text-[#5C5F66] hover:text-white transition-colors">{p}</button>
                        ))}
                      </div>
                    </div>
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={profitData}>
                          <defs>
                            <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#2A2B2F" vertical={false} />
                          <XAxis 
                            dataKey="time" 
                            stroke="#5C5F66" 
                            fontSize={10} 
                            tickLine={false} 
                            axisLine={false}
                            fontFamily="monospace"
                          />
                          <YAxis 
                            stroke="#5C5F66" 
                            fontSize={10} 
                            tickLine={false} 
                            axisLine={false}
                            fontFamily="monospace"
                            tickFormatter={(v) => `$${v}`}
                          />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#151619', border: '1px solid #2A2B2F', borderRadius: '8px', fontFamily: 'monospace', fontSize: '11px' }}
                            itemStyle={{ color: '#6366f1' }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="profit" 
                            stroke="#6366f1" 
                            strokeWidth={2}
                            fillOpacity={1} 
                            fill="url(#colorProfit)" 
                            animationDuration={1500}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Recent Logs */}
                  <div className="bg-[#151619] border border-[#2A2B2F] rounded-2xl flex flex-col overflow-hidden">
                    <div className="p-6 border-b border-[#2A2B2F] flex justify-between items-center">
                      <h3 className="text-sm font-mono font-bold text-white tracking-widest">SYSTEM LOGS</h3>
                      <Terminal className="w-4 h-4 text-[#5C5F66]" />
                    </div>
                    <div className="flex-1 overflow-y-auto py-2">
                      {logs.length > 0 ? (
                        logs.slice(0, 10).map(log => <LogItem key={log.id} log={log} />)
                      ) : (
                        <div className="h-full flex items-center justify-center text-[10px] font-mono text-[#5C5F66]">NO LOGS DETECTED</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Signals Preview */}
                <div className="bg-[#151619] border border-[#2A2B2F] rounded-2xl overflow-hidden">
                  <div className="p-6 border-b border-[#2A2B2F] flex justify-between items-center">
                    <h3 className="text-sm font-mono font-bold text-white tracking-widest">ACTIVE AI SIGNALS</h3>
                    <button className="text-[10px] font-mono font-bold text-indigo-500 hover:text-indigo-400">VIEW ALL</button>
                  </div>
                  <div className="grid grid-cols-6 gap-4 px-4 py-3 bg-[#1C1D21] border-b border-[#2A2B2F]">
                    {['SYMBOL', 'TYPE', 'ENTRY', 'TP', 'SL', 'CONFIDENCE'].map(h => (
                      <span key={h} className="text-[9px] font-mono font-bold text-[#5C5F66] tracking-tighter">{h}</span>
                    ))}
                  </div>
                  <div className="flex flex-col">
                    {signals.length > 0 ? (
                      signals.slice(0, 5).map(s => <SignalRow key={s.id} signal={s} />)
                    ) : (
                      <div className="py-12 text-center text-[11px] font-mono text-[#5C5F66]">WAITING FOR AI SIGNAL GENERATION...</div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'signals' && (
              <motion.div 
                key="signals"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-[#151619] border border-[#2A2B2F] rounded-2xl overflow-hidden"
              >
                <div className="p-8 border-b border-[#2A2B2F] flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-mono font-bold text-white mb-1">SIGNAL TERMINAL</h2>
                    <p className="text-[11px] font-mono text-[#5C5F66]">REAL-TIME MARKET ANALYSIS & EXECUTION</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2 px-4 py-2 bg-[#1C1D21] border border-[#2A2B2F] rounded-lg">
                      <span className="text-[10px] font-mono text-[#5C5F66]">AUTO-EXECUTION:</span>
                      <span className="text-[10px] font-mono font-bold text-emerald-500">ENABLED</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-6 gap-4 px-8 py-4 bg-[#1C1D21] border-b border-[#2A2B2F]">
                  {['SYMBOL', 'TYPE', 'ENTRY', 'TP', 'SL', 'CONFIDENCE'].map(h => (
                    <span key={h} className="text-[10px] font-mono font-bold text-[#5C5F66] tracking-widest">{h}</span>
                  ))}
                </div>
                <div className="flex flex-col">
                  {signals.map(s => <SignalRow key={s.id} signal={s} />)}
                  {signals.length === 0 && (
                    <div className="py-32 flex flex-col items-center justify-center gap-4">
                      <Activity className="w-12 h-12 text-[#1C1D21]" />
                      <p className="text-[11px] font-mono text-[#5C5F66]">SCANNING MARKETS FOR OPPORTUNITIES...</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'ai' && (
              <motion.div 
                key="ai"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="grid grid-cols-2 gap-8"
              >
                <div className="bg-[#151619] border border-[#2A2B2F] rounded-2xl p-8">
                  <h3 className="text-sm font-mono font-bold text-white mb-8 tracking-widest">AI ENGINE STATUS</h3>
                  <div className="space-y-6">
                    {[
                      { label: 'MODEL VERSION', value: 'GENX-V3.1-PRO', icon: Cpu },
                      { label: 'INFERENCE TIME', value: '14ms', icon: Clock },
                      { label: 'DATA THROUGHPUT', value: '1.2 GB/s', icon: Zap },
                      { label: 'ACCURACY SCORE', value: '92.4%', icon: CheckCircle2 },
                    ].map(item => (
                      <div key={item.label} className="flex items-center justify-between p-4 bg-[#1C1D21] border border-[#2A2B2F] rounded-xl">
                        <div className="flex items-center gap-3">
                          <item.icon className="w-4 h-4 text-indigo-500" />
                          <span className="text-[11px] font-mono font-bold text-[#8E9299]">{item.label}</span>
                        </div>
                        <span className="text-sm font-mono font-bold text-white">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-[#151619] border border-[#2A2B2F] rounded-2xl p-8">
                  <h3 className="text-sm font-mono font-bold text-white mb-8 tracking-widest">NEURAL NETWORK LOAD</h3>
                  <div className="h-[200px] w-full flex items-end gap-2 px-4">
                    {[40, 65, 45, 80, 55, 90, 70, 85, 60, 75, 50, 95].map((h, i) => (
                      <div key={i} className="flex-1 bg-indigo-500/20 border-t border-indigo-500/40 rounded-t-sm relative group">
                        <motion.div 
                          initial={{ height: 0 }}
                          animate={{ height: `${h}%` }}
                          className="absolute bottom-0 left-0 right-0 bg-indigo-500 rounded-t-sm"
                        />
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-[8px] font-mono text-indigo-500">{h}%</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-8 p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-xl">
                    <p className="text-[10px] font-mono text-indigo-400 leading-relaxed">
                      AI ENGINE IS CURRENTLY OPTIMIZING FOR HIGH VOLATILITY MARKETS. 
                      BOLT (NUMPY) ACCELERATION IS ACTIVE.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'logs' && (
              <motion.div 
                key="logs"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-[#0F1012] border border-[#2A2B2F] rounded-2xl flex flex-col h-[calc(100vh-200px)]"
              >
                <div className="p-6 border-b border-[#2A2B2F] flex justify-between items-center bg-[#151619] rounded-t-2xl">
                  <div className="flex items-center gap-3">
                    <Terminal className="w-5 h-5 text-indigo-500" />
                    <h2 className="text-sm font-mono font-bold text-white tracking-widest">SYSTEM TERMINAL</h2>
                  </div>
                  <div className="flex gap-2">
                    <button className="px-3 py-1.5 bg-[#1C1D21] border border-[#2A2B2F] rounded-lg text-[10px] font-mono font-bold text-[#5C5F66] hover:text-white transition-colors">CLEAR</button>
                    <button className="px-3 py-1.5 bg-[#1C1D21] border border-[#2A2B2F] rounded-lg text-[10px] font-mono font-bold text-[#5C5F66] hover:text-white transition-colors">EXPORT</button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto font-mono p-4 space-y-1">
                  {logs.map(log => (
                    <div key={log.id} className="flex gap-4 text-[11px] py-1 px-4 hover:bg-[#1C1D21] rounded transition-colors group">
                      <span className="text-[#5C5F66] shrink-0">{log.timestamp.toDate().toLocaleTimeString()}</span>
                      <span className={cn(
                        "font-bold shrink-0 w-12",
                        log.level === 'ERROR' ? "text-rose-500" :
                        log.level === 'WARN' ? "text-amber-500" : "text-indigo-500"
                      )}>{log.level}</span>
                      <span className="text-[#8E9299] shrink-0">[{log.source}]</span>
                      <span className="text-[#E6E6E6]">{log.message}</span>
                    </div>
                  ))}
                  {logs.length === 0 && (
                    <div className="h-full flex items-center justify-center text-[#5C5F66] text-[11px] animate-pulse">
                      INITIALIZING TERMINAL STREAMS...
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
