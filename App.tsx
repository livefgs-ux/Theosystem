import React, { useState, useEffect } from 'react';
import { supabase } from './services/supabaseClient';
import { api } from './services/api';
import { Loader2, AlertTriangle, User, LogOut, Database, CheckCircle2, Copy } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { DashboardStats } from './components/DashboardStats';
import { CoursesPage } from './pages/CoursesPage';
import { Spreadsheet } from './components/Spreadsheet';
import { AttendancePage } from './pages/AttendancePage';
import { BooksPage } from './pages/BooksPage';
import { ReportsPage } from './pages/ReportsPage';
import { StudentsPage } from './pages/StudentsPage'; // Import new page
import { AppState } from './types';
import { SUPABASE_URL } from './config';
import { DB_SCHEMA } from './services/schema';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [setupRequired, setSetupRequired] = useState(false);

  // App Global State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [appData, setAppData] = useState<AppState>({
    students: [],
    courses: [],
    books: [],
    transactions: [],
    attendance: []
  });

  useEffect(() => {
    console.log("TheoSystem v1.3 loaded");
    checkConnection();
  }, []);

  useEffect(() => {
    if (session?.user) {
      loadGlobalData();
    }
  }, [session, activeTab]);

  const checkConnection = async () => {
    if (SUPABASE_URL.includes('your-project-id')) {
        setConnectionError("Configuração Pendente: Edite o arquivo config.ts com suas credenciais.");
        setLoading(false);
        return;
    }

    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        setSession(session);
    } catch (err: any) {
        console.error("Connection Error:", err);
        setConnectionError("Falha de conexão com o Supabase.");
    } finally {
        setLoading(false);
    }

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
  };

  const loadGlobalData = async () => {
    try {
      // Optimized: Fetch Metadata only. Heavy tables (attendance/transactions) are loaded on demand by pages.
      const data = await api.fetchMetadata();
      
      // Fetch full arrays for compatibility with Books/Dashboard
      const transactions = await api.getTransactions();
      const attendance = await api.getAllAttendance(); // Fetch attendance for Dashboard stats
      
      setAppData({
          ...data,
          transactions: transactions.data || [],
          attendance: attendance.data || []
      });
      
      setSetupRequired(false);
    } catch (err: any) {
      console.error("Data Load Error:", err);
      if (
        err.code === '42P01' || 
        err.status === 404 || 
        (err.message && (err.message.includes('does not exist') || err.message.includes('404')))
      ) {
        setSetupRequired(true);
      }
    }
  };

  // --- Auth & Setup Views ---

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-100"><Loader2 className="animate-spin text-indigo-600" size={40}/></div>;

  if (setupRequired && session) {
    return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 animate-in fade-in duration-500">
            <div className="bg-white p-8 rounded-xl max-w-2xl w-full shadow-2xl border-t-4 border-amber-500">
                <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
                    <div className="bg-amber-100 p-3 rounded-full">
                        <Database className="text-amber-600" size={32} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Banco de Dados Não Encontrado</h2>
                        <p className="text-slate-500 text-sm">Parece ser seu primeiro acesso. Vamos criar as tabelas necessárias.</p>
                    </div>
                </div>
                
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6">
                    <p className="text-sm text-slate-600 mb-2 font-semibold">Instruções:</p>
                    <ol className="list-decimal list-inside text-sm text-slate-500 space-y-1">
                        <li>Copie o código SQL abaixo.</li>
                        <li>Vá ao painel do Supabase {'>'} <strong>SQL Editor</strong>.</li>
                        <li>Cole o código e clique em <strong>Run</strong>.</li>
                        <li>Volte aqui e atualize a página.</li>
                    </ol>
                </div>

                <div className="relative group mb-6">
                    <button 
                        onClick={() => {
                            navigator.clipboard.writeText(DB_SCHEMA);
                            alert("SQL Copiado!");
                        }}
                        className="absolute top-2 right-2 bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1"
                    >
                        <Copy size={12}/> Copiar
                    </button>
                    <pre className="bg-slate-900 text-slate-300 p-4 rounded-lg overflow-auto max-h-64 text-xs font-mono border border-slate-700 shadow-inner custom-scrollbar">
                        {DB_SCHEMA}
                    </pre>
                </div>
                <button 
                    onClick={() => window.location.reload()}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-lg font-bold flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                >
                    <CheckCircle2 size={20} /> Já executei o SQL (Recarregar)
                </button>
            </div>
        </div>
    );
  }

  if (!session) {
    return <AuthScreen authLoading={authLoading} setAuthLoading={setAuthLoading} />;
  }

  // --- Main App Layout ---

  const handleEnterCourse = (courseId: string) => {
    setActiveCourseId(courseId);
    setActiveTab('spreadsheet');
  };

  return (
    <div className="flex min-h-screen bg-slate-100 font-sans text-slate-800">
      <Sidebar 
        activeTab={activeTab === 'spreadsheet' ? 'courses' : activeTab} 
        setActiveTab={(t) => { setActiveTab(t); setActiveCourseId(null); }} 
        onLogout={() => supabase.auth.signOut()} 
      />

      <main className="flex-1 ml-64 p-8 overflow-y-auto">
        {/* Header (Hidden on spreadsheet for more space) */}
        {activeTab !== 'spreadsheet' && (
           <header className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 capitalize">
                  {activeTab === 'dashboard' ? 'Visão Geral' : 
                   activeTab === 'courses' ? 'Turmas' :
                   activeTab === 'books' ? 'Biblioteca' :
                   activeTab === 'attendance' ? 'Presença' : 'Relatórios'}
                </h1>
                <p className="text-slate-500 text-sm">Bem-vindo, {session.user.user_metadata?.full_name || 'Professor'}.</p>
              </div>
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full shadow-sm border border-slate-200">
                 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                 <span className="text-xs font-medium text-slate-600">Sistema Online</span>
              </div>
           </header>
        )}

        {/* Views */}
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {activeTab === 'dashboard' && <DashboardStats data={appData} />}
            
            {activeTab === 'courses' && (
              <CoursesPage 
                userId={session.user.id} 
                onEnterCourse={handleEnterCourse} 
                onDataChange={loadGlobalData}
              />
            )}
            
            {activeTab === 'spreadsheet' && activeCourseId && (
              <Spreadsheet 
                courseId={activeCourseId} 
                onBack={() => setActiveTab('courses')} 
              />
            )}

            {activeTab === 'students' && (
              <StudentsPage data={appData} />
            )}

            {activeTab === 'books' && (
               <BooksPage data={appData} updateData={(d) => setAppData({...appData, ...d})} />
            )}

            {activeTab === 'attendance' && (
               <AttendancePage data={appData} updateData={(d) => setAppData({...appData, ...d})} />
            )}

            {activeTab === 'reports' && (
               <ReportsPage data={appData} />
            )}
        </div>
      </main>
    </div>
  );
}

// Simple Auth Component to keep App.tsx clean
function AuthScreen({ authLoading, setAuthLoading }: any) {
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
  
    const handleAuth = async (e: React.FormEvent) => {
      e.preventDefault();
      setAuthLoading(true);
      try {
          if (isSignUp) {
              const { error } = await supabase.auth.signUp({
                  email,
                  password,
                  options: { data: { full_name: fullName } }
              });
              if (error) throw error;
              alert("Cadastro realizado!");
              setIsSignUp(false);
          } else {
              const { error } = await supabase.auth.signInWithPassword({ email, password });
              if (error) throw error;
          }
      } catch (err: any) {
          alert(err.message);
      } finally {
          setAuthLoading(false);
      }
    };
  
    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-xl max-w-md w-full text-center shadow-2xl">
                <div className="w-16 h-16 bg-indigo-900 rounded-full mx-auto flex items-center justify-center mb-4 shadow-lg">
                    <User className="text-white" size={32} />
                </div>
                <h1 className="text-2xl font-serif text-slate-900 font-bold mb-1">TheoSystem</h1>
                <p className="text-slate-500 text-sm mb-6">Acesso Exclusivo para Docentes</p>
                <form onSubmit={handleAuth} className="space-y-4 text-left">
                    {isSignUp && (
                        <input type="text" placeholder="Nome Completo" value={fullName} onChange={e=>setFullName(e.target.value)} className="w-full border p-3 rounded-lg" required />
                    )}
                    <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full border p-3 rounded-lg" required />
                    <input type="password" placeholder="Senha" value={password} onChange={e=>setPassword(e.target.value)} className="w-full border p-3 rounded-lg" required />
                    <button disabled={authLoading} className="w-full bg-indigo-900 text-white p-3 rounded-lg font-bold flex justify-center items-center gap-2">
                        {authLoading ? <Loader2 className="animate-spin" /> : (isSignUp ? 'Criar Conta' : 'Entrar')}
                    </button>
                </form>
                <button onClick={() => setIsSignUp(!isSignUp)} className="text-sm text-indigo-600 mt-4">
                    {isSignUp ? 'Já tem conta? Login' : 'Criar conta'}
                </button>
            </div>
        </div>
    );
}