import React, { useState, useEffect } from 'react';
import { supabase } from './services/supabaseClient';
import { api } from './services/api';
import { AcademicTerm, Course } from './types';
import { User, Loader2, Plus, Copy, Trash2, FolderOpen, LogOut, ArrowRight, AlertTriangle } from 'lucide-react';
import { Spreadsheet } from './components/Spreadsheet';
import { SUPABASE_URL } from './config';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  // Navigation State
  const [view, setView] = useState<'dashboard' | 'spreadsheet'>('dashboard');
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  
  // Dashboard Data
  const [terms, setTerms] = useState<any[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [expandedTerm, setExpandedTerm] = useState<string | null>(null);

  // Forms
  const [newTermName, setNewTermName] = useState('');
  const [newCourseName, setNewCourseName] = useState('');

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    // 1. Check Config
    if (SUPABASE_URL.includes('your-project-id')) {
        setConnectionError("Configuração Pendente: Edite o arquivo config.ts com suas credenciais do Supabase.");
        setLoading(false);
        return;
    }

    // 2. Check Session
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        setSession(session);
        if(session) {
            await loadTerms();
        } else {
            setLoading(false);
        }
    } catch (err: any) {
        console.error("Connection Error:", err);
        setConnectionError("Falha de conexão com o servidor. Verifique se o projeto Supabase está ativo e as credenciais estão corretas.");
        setLoading(false);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) loadTerms();
    });

    return () => subscription.unsubscribe();
  };

  const loadTerms = async () => {
    setLoading(true);
    setConnectionError(null);
    try {
        const { data, error } = await api.getTerms();
        if (error) throw error;
        setTerms(data || []);
    } catch (err: any) {
        console.error("Load Terms Error:", err);
        // If it's a fetch error, it might be CORS or network
        setConnectionError("Erro ao carregar dados. Verifique sua conexão com a internet.");
    } finally {
        setLoading(false);
    }
  };

  const handleCreateTerm = async () => {
    if (!newTermName || !session) return;
    try {
        const { error } = await api.createTerm(newTermName, session.user.id);
        if (error) throw error;
        setNewTermName('');
        loadTerms();
    } catch (err: any) {
        alert("Erro ao criar período: " + err.message);
    }
  };

  const handleDuplicateTerm = async (termId: string, currentName: string) => {
    const newName = prompt("Nome para o novo período (cópia):", `${currentName} (Cópia)`);
    if (newName) {
        setLoading(true);
        try {
            const { error } = await api.duplicateTerm(termId, newName);
            if (error) throw error;
            await loadTerms();
        } catch (err: any) {
            alert("Erro ao duplicar: " + err.message);
            setLoading(false);
        }
    }
  };

  const handleDeleteTerm = async (id: string) => {
    if (confirm("Tem certeza? Isso apagará TODAS as turmas e registros deste período.")) {
        try {
            await api.deleteTerm(id);
            loadTerms();
        } catch (err: any) {
            alert("Erro ao apagar: " + err.message);
        }
    }
  };

  const toggleTerm = async (termId: string) => {
    if (expandedTerm === termId) {
        setExpandedTerm(null);
    } else {
        setExpandedTerm(termId);
        const { data, error } = await api.getCourses(termId);
        if (!error) {
            setCourses(data || []);
        }
    }
  };

  const handleCreateCourse = async (termId: string) => {
    if (!newCourseName) return;
    try {
        await api.createCourse(termId, newCourseName);
        setNewCourseName('');
        const { data } = await api.getCourses(termId);
        setCourses(data || []);
    } catch (err: any) {
        alert("Erro ao criar turma: " + err.message);
    }
  };

  const enterCourse = (courseId: string) => {
    setActiveCourseId(courseId);
    setView('spreadsheet');
  };

  // --- Auth Logic ---
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [fullName, setFullName] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
        if (isSignUp) {
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { full_name: fullName }
                }
            });
            if (error) throw error;
            alert("Cadastro realizado! Se o email de confirmação estiver desativado no Supabase, você já pode fazer login. Caso contrário, verifique seu email.");
            setIsSignUp(false);
        } else {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
        }
    } catch (err: any) {
        alert(err.message || "Erro de autenticação");
    } finally {
        setAuthLoading(false);
    }
  };

  // --- Connection Error View ---
  if (connectionError) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-xl max-w-md w-full text-center shadow-2xl">
                <div className="text-amber-500 mb-4 flex justify-center">
                    <AlertTriangle size={48} />
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">Configuração Necessária</h2>
                <p className="text-slate-600 mb-6">{connectionError}</p>
                
                {connectionError.includes('config.ts') && (
                    <div className="bg-slate-100 p-4 rounded text-left text-xs font-mono text-slate-600 overflow-x-auto">
                        <p className="font-bold mb-2">Como corrigir:</p>
                        <ol className="list-decimal pl-4 space-y-1">
                            <li>Crie um projeto em <a href="https://supabase.com" target="_blank" className="text-blue-600 underline">supabase.com</a></li>
                            <li>Vá em Project Settings -&gt; API</li>
                            <li>Copie a <strong>URL</strong> e a <strong>anon public key</strong></li>
                            <li>Cole no arquivo <code>config.ts</code></li>
                        </ol>
                    </div>
                )}
                
                <button 
                  onClick={() => window.location.reload()}
                  className="mt-6 bg-slate-800 text-white px-6 py-2 rounded-lg hover:bg-slate-700 transition-colors"
                >
                    Tentar Novamente
                </button>
            </div>
        </div>
      );
  }

  if (!session) {
    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-xl max-w-md w-full text-center shadow-2xl">
                <div className="w-16 h-16 bg-blue-900 rounded-full mx-auto flex items-center justify-center mb-4 shadow-lg">
                    <User className="text-white" size={32} />
                </div>
                <h1 className="text-2xl font-serif text-slate-900 font-bold mb-1">TheoSystem</h1>
                <p className="text-slate-500 text-sm mb-6">Acesso Exclusivo para Docentes</p>
                
                <form onSubmit={handleAuth} className="space-y-4 text-left">
                    {isSignUp && (
                        <div>
                            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Nome Completo</label>
                            <input 
                                type="text" 
                                placeholder="Ex: Prof. João Silva" 
                                value={fullName} 
                                onChange={e=>setFullName(e.target.value)} 
                                className="w-full border border-slate-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                                required={isSignUp}
                            />
                        </div>
                    )}
                    <div>
                        <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Email</label>
                        <input 
                            type="email" 
                            placeholder="professor@exemplo.com" 
                            value={email} 
                            onChange={e=>setEmail(e.target.value)} 
                            className="w-full border border-slate-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Senha</label>
                        <input 
                            type="password" 
                            placeholder="******" 
                            value={password} 
                            onChange={e=>setPassword(e.target.value)} 
                            className="w-full border border-slate-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                            required
                        />
                    </div>
                    
                    <button 
                        disabled={authLoading}
                        className="w-full bg-blue-900 text-white p-3 rounded-lg font-bold hover:bg-blue-800 transition-all flex justify-center items-center gap-2"
                    >
                        {authLoading ? <Loader2 className="animate-spin" /> : (isSignUp ? 'Criar Conta' : 'Entrar no Sistema')}
                    </button>
                </form>

                <div className="mt-6 pt-6 border-t border-slate-100">
                    <button 
                        onClick={() => setIsSignUp(!isSignUp)}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                        {isSignUp ? 'Já tem uma conta? Fazer Login' : 'Não tem conta? Cadastrar-se'}
                    </button>
                </div>
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800">
        {/* Header */}
        <header className="bg-slate-900 text-slate-200 px-6 py-4 flex justify-between items-center shadow-md">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-serif font-bold text-white shadow-lg shadow-blue-900/50">TS</div>
                <h1 className="font-serif text-lg tracking-wide">TheoSystem <span className="text-slate-500 text-sm font-sans font-normal ml-2">Painel Administrativo</span></h1>
            </div>
            <div className="flex items-center gap-4">
                <span className="text-sm hidden sm:inline-block opacity-80">{session.user.user_metadata?.full_name || session.user.email}</span>
                <button 
                    onClick={() => supabase.auth.signOut()} 
                    className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-800 rounded-full"
                    title="Sair"
                >
                    <LogOut size={18}/>
                </button>
            </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-6 overflow-hidden flex flex-col">
            {view === 'dashboard' && (
                <div className="max-w-4xl mx-auto w-full space-y-8 animate-in fade-in duration-500">
                    {/* Toolbar */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800">Períodos Acadêmicos</h2>
                            <p className="text-slate-500">Gerencie seus semestres e turmas.</p>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <input 
                              value={newTermName} 
                              onChange={e => setNewTermName(e.target.value)}
                              placeholder="Novo Ano/Semestre..." 
                              className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full sm:w-64 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                            />
                            <button onClick={handleCreateTerm} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium shadow-sm transition-all active:scale-95">
                                <Plus size={18}/> Criar
                            </button>
                        </div>
                    </div>

                    {/* Terms List */}
                    <div className="space-y-4">
                        {loading ? <div className="text-center py-10"><Loader2 className="animate-spin mx-auto text-blue-600"/></div> : 
                         terms.map(term => (
                            <div key={term.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transition-all hover:shadow-md">
                                <div className="p-4 flex items-center justify-between bg-slate-50 border-b border-slate-100">
                                    <div 
                                      className="flex items-center gap-3 cursor-pointer select-none group"
                                      onClick={() => toggleTerm(term.id)}
                                    >
                                        <div className={`p-2 rounded-lg transition-colors ${expandedTerm === term.id ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500 group-hover:bg-slate-300'}`}>
                                            <FolderOpen size={20} />
                                        </div>
                                        <span className="font-bold text-lg text-slate-700 group-hover:text-slate-900">{term.name}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button 
                                          onClick={() => handleDuplicateTerm(term.id, term.name)}
                                          title="Duplicar Estrutura"
                                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        >
                                            <Copy size={18}/>
                                        </button>
                                        <button 
                                          onClick={() => handleDeleteTerm(term.id)}
                                          title="Apagar Período"
                                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={18}/>
                                        </button>
                                    </div>
                                </div>
                                
                                {expandedTerm === term.id && (
                                    <div className="p-6 bg-white animate-in slide-in-from-top-2 duration-200">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                                            {courses.map(course => (
                                                <div 
                                                  key={course.id} 
                                                  onClick={() => enterCourse(course.id)}
                                                  className="group p-5 rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-md cursor-pointer transition-all bg-slate-50 hover:bg-white relative overflow-hidden"
                                                >
                                                    <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
                                                    <h3 className="font-bold text-slate-800 group-hover:text-blue-700 relative z-10 pr-2">{course.name}</h3>
                                                    <div className="flex items-center gap-2 mt-3 text-xs text-slate-400 group-hover:text-blue-500 font-medium">
                                                        <span>Abrir Planilha</span>
                                                        <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform"/>
                                                    </div>
                                                </div>
                                            ))}
                                            {courses.length === 0 && (
                                                <div className="col-span-full py-8 text-center border-2 border-dashed border-slate-200 rounded-xl">
                                                    <p className="text-sm text-slate-400 italic">Nenhuma turma cadastrada neste período.</p>
                                                </div>
                                            )}
                                        </div>
                                        
                                        <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
                                            <input 
                                                value={newCourseName}
                                                onChange={e => setNewCourseName(e.target.value)}
                                                placeholder="Nome da Nova Turma..."
                                                className="text-sm border border-slate-300 rounded-lg px-3 py-2 w-64 focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                            <button 
                                              onClick={() => handleCreateCourse(term.id)}
                                              className="text-sm bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-700 font-medium transition-colors"
                                            >
                                                Adicionar Turma
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                        
                        {terms.length === 0 && !loading && (
                            <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-300">
                                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <FolderOpen className="text-slate-400" size={32} />
                                </div>
                                <h3 className="text-lg font-bold text-slate-700">Bem-vindo ao TheoSystem</h3>
                                <p className="text-slate-500 max-w-sm mx-auto mt-2">Comece criando um Ano Acadêmico ou Semestre no topo da página.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {view === 'spreadsheet' && activeCourseId && (
                <Spreadsheet 
                    courseId={activeCourseId} 
                    onBack={() => setView('dashboard')} 
                />
            )}
        </main>
    </div>
  );
}