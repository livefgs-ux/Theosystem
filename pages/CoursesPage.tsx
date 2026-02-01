import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { excelImporter, ImportResult } from '../services/excelImporter';
import { Loader2, Plus, Copy, Trash2, FolderOpen, ArrowRight, FileSpreadsheet, UploadCloud, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Course } from '../types';

interface Props {
  userId: string;
  onEnterCourse: (courseId: string) => void;
  onDataChange: () => void;
}

export const CoursesPage: React.FC<Props> = ({ userId, onEnterCourse, onDataChange }) => {
  const [terms, setTerms] = useState<any[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTerm, setExpandedTerm] = useState<string | null>(null);

  // Forms
  const [newTermName, setNewTermName] = useState('');
  const [newCourseName, setNewCourseName] = useState('');
  
  // Import State
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadTerms();
  }, []);

  const loadTerms = async () => {
    setLoading(true);
    const { data } = await api.getTerms();
    setTerms(data || []);
    setLoading(false);
  };

  const handleCreateTerm = async () => {
    if (!newTermName) return;
    try {
        await api.createTerm(newTermName, userId);
        setNewTermName('');
        loadTerms();
    } catch (err: any) {
        alert("Erro ao criar período: " + err.message);
    }
  };

  const handleDuplicateTerm = async (termId: string, currentName: string) => {
    const newName = prompt("Nome para o novo período (cópia):", `${currentName} (Cópia)`);
    if (newName) {
        try {
            await api.duplicateTerm(termId, newName);
            loadTerms();
        } catch (err: any) {
            alert("Erro ao duplicar: " + err.message);
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
        const { data } = await api.getCourses(termId);
        setCourses(data || []);
    }
  };

  const handleCreateCourse = async (termId: string) => {
    if (!newCourseName) return;
    try {
        await api.createCourse(termId, newCourseName);
        setNewCourseName('');
        const { data } = await api.getCourses(termId);
        setCourses(data || []);
        onDataChange();
    } catch (err: any) {
        alert("Erro ao criar turma: " + err.message);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportStatus("Lendo arquivo...");
    setImportResult(null);
    
    try {
        const result = await excelImporter.parseAndImport(file, userId, (msg) => setImportStatus(msg));
        await loadTerms();
        onDataChange();
        setImportResult(result);
    } catch (err: any) {
        console.error(err);
        alert("Erro na importação: " + err.message);
    } finally {
        setImporting(false);
        setImportStatus('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 relative">
        
        {/* Loading Overlay */}
        {importing && (
            <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center backdrop-blur-sm">
                <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-6 max-w-sm w-full animate-in zoom-in-95 duration-200">
                    <div className="relative">
                         <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                         <div className="absolute inset-0 flex items-center justify-center">
                             <UploadCloud size={24} className="text-indigo-600" />
                         </div>
                    </div>
                    <div className="text-center">
                        <h3 className="font-bold text-xl text-slate-800 mb-2">Importando Planilha</h3>
                        <p className="text-slate-500 text-sm font-medium animate-pulse">{importStatus}</p>
                    </div>
                </div>
            </div>
        )}

        {/* Success Modal */}
        {importResult && (
             <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center backdrop-blur-md animate-in fade-in duration-300">
                <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in slide-in-from-bottom-4 duration-300 transform transition-all">
                    <div className="bg-emerald-600 p-8 flex flex-col items-center text-white text-center">
                        <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mb-4 backdrop-blur-sm shadow-inner">
                            <CheckCircle2 size={40} className="text-white drop-shadow-md" />
                        </div>
                        <h3 className="text-2xl font-bold">Importação Concluída!</h3>
                        <p className="text-emerald-100 mt-2 font-medium">Os dados foram processados e salvos.</p>
                    </div>
                    
                    <div className="p-6 space-y-5">
                        <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 space-y-3 shadow-inner">
                             <div className="flex justify-between items-center border-b border-slate-200/60 pb-3">
                                 <span className="text-slate-500 text-sm font-medium">Turma Criada</span>
                                 <span className="font-bold text-slate-800 text-right truncate max-w-[180px]" title={importResult.courseName}>
                                    {importResult.courseName}
                                 </span>
                             </div>
                             <div className="flex justify-between items-center border-b border-slate-200/60 pb-3">
                                 <span className="text-slate-500 text-sm font-medium">Alunos Processados</span>
                                 <span className="font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                                    {importResult.count}
                                 </span>
                             </div>
                             <div className="flex justify-between items-center">
                                 <span className="text-slate-500 text-sm font-medium">Erros Encontrados</span>
                                 <span className={`font-bold px-2 py-0.5 rounded border ${importResult.errors.length > 0 ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                                     {importResult.errors.length}
                                 </span>
                             </div>
                        </div>

                        {importResult.errors.length > 0 && (
                            <div className="bg-red-50 p-4 rounded-xl border border-red-100 max-h-32 overflow-y-auto custom-scrollbar">
                                <h4 className="text-red-800 font-bold text-xs uppercase mb-2 flex items-center gap-1">
                                    <AlertTriangle size={12}/> Detalhes dos Erros
                                </h4>
                                <ul className="list-disc list-inside space-y-1">
                                    {importResult.errors.map((err, i) => (
                                        <li key={i} className="text-xs text-red-600 truncate">{err}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <button 
                            onClick={() => setImportResult(null)}
                            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg hover:shadow-xl transform active:scale-[0.98]"
                        >
                            Fechar e Continuar
                        </button>
                    </div>
                </div>
             </div>
        )}

        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div>
                <h2 className="text-2xl font-bold text-slate-800">Turmas e Períodos</h2>
                <p className="text-slate-500 mt-1">Gerencie seus semestres, turmas e faça a importação de dados.</p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept=".xlsx,.xls,.csv" 
                  className="hidden" 
                />
                
                {/* Botão de Importar */}
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 font-semibold transition-all"
                >
                    <FileSpreadsheet size={20}/> 
                    <span>Importar Planilha</span>
                </button>
                
                {/* Botão de Criar (Agora Índigo para combinar com Sidebar) */}
                <div className="flex gap-2 w-full sm:w-auto">
                    <input 
                      value={newTermName} 
                      onChange={e => setNewTermName(e.target.value)}
                      placeholder="Novo Semestre/Ano..." 
                      className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm w-full md:w-64 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                    />
                    <button 
                      onClick={handleCreateTerm} 
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl flex items-center justify-center gap-2 font-bold shadow-md shadow-indigo-900/10 transition-all hover:-translate-y-0.5"
                    >
                        <Plus size={20}/>
                        <span>Criar</span>
                    </button>
                </div>
            </div>
        </div>

        {/* Terms List */}
        <div className="space-y-4">
            {loading ? <div className="text-center py-12"><Loader2 className="animate-spin mx-auto text-indigo-600 w-8 h-8"/></div> : 
             terms.map(term => (
                <div key={term.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transition-all hover:shadow-md">
                    <div className="p-4 flex items-center justify-between bg-slate-50 border-b border-slate-100">
                        <div 
                          className="flex items-center gap-4 cursor-pointer select-none group flex-1"
                          onClick={() => toggleTerm(term.id)}
                        >
                            <div className={`p-2.5 rounded-lg transition-colors ${expandedTerm === term.id ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-400 border border-slate-200 group-hover:border-indigo-300 group-hover:text-indigo-500'}`}>
                                <FolderOpen size={20} />
                            </div>
                            <span className="font-bold text-lg text-slate-700 group-hover:text-slate-900">{term.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <button 
                              onClick={() => handleDuplicateTerm(term.id, term.name)}
                              title="Duplicar Estrutura"
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
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
                                      onClick={() => onEnterCourse(course.id)}
                                      className="group p-5 rounded-xl border border-slate-200 hover:border-indigo-500 hover:ring-1 hover:ring-indigo-500 cursor-pointer transition-all bg-slate-50 hover:bg-indigo-50/10 relative overflow-hidden"
                                    >
                                        <div className="flex justify-between items-start">
                                            <h3 className="font-bold text-slate-800 group-hover:text-indigo-700 relative z-10 pr-2 text-lg">{course.name}</h3>
                                            <ArrowRight size={18} className="text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all"/>
                                        </div>
                                        <div className="mt-4 pt-4 border-t border-slate-200/60 flex items-center gap-2 text-xs font-medium text-slate-500 group-hover:text-indigo-600">
                                            <FileSpreadsheet size={14} />
                                            <span>Abrir Planilha</span>
                                        </div>
                                    </div>
                                ))}
                                {courses.length === 0 && (
                                    <div className="col-span-full py-8 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                                        <p className="text-sm text-slate-400 italic">Nenhuma turma cadastrada neste período.</p>
                                    </div>
                                )}
                            </div>
                            
                            <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
                                <input 
                                    value={newCourseName}
                                    onChange={e => setNewCourseName(e.target.value)}
                                    placeholder="Nome da Nova Turma..."
                                    className="text-sm border border-slate-300 rounded-lg px-3 py-2 w-64 focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                                <button 
                                  onClick={() => handleCreateCourse(term.id)}
                                  className="text-sm bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-700 font-medium transition-colors flex items-center gap-2"
                                >
                                    <Plus size={16}/> Adicionar Turma
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ))}
            
            {terms.length === 0 && !loading && (
                <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
                    <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <FolderOpen className="text-indigo-200" size={40} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-700">Bem-vindo ao TheoSystem</h3>
                    <p className="text-slate-500 max-w-md mx-auto mt-2">Comece criando um <strong>Ano Acadêmico</strong> acima ou use o botão de <strong>Importar Excel</strong> para carregar seus dados.</p>
                </div>
            )}
        </div>
    </div>
  );
};