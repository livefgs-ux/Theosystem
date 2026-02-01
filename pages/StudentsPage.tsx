import React, { useState } from 'react';
import { AppState, Student } from '../types';
import { Search, User, ChevronRight, BookOpen, GraduationCap, CheckCircle2, XCircle, ArrowLeft, Loader2, Edit2, Save, X } from 'lucide-react';
import { api } from '../services/api';

interface Props {
  data: AppState;
}

export const StudentsPage: React.FC<Props> = ({ data }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentHistory, setStudentHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Edit State for Profile
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState<Partial<Student>>({});
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Saving state for individual cells
  const [savingCells, setSavingCells] = useState<Record<string, boolean>>({});

  // Filter students
  const filteredStudents = data.students.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.matricula?.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => a.name.localeCompare(b.name));

  const handleSelectStudent = async (student: Student) => {
    setSelectedStudent(student);
    setProfileForm(student);
    setIsEditingProfile(false);
    setLoadingHistory(true);
    try {
        const { history } = await api.getStudentCompleteHistory(student.id);
        setStudentHistory(history);
    } catch (err) {
        console.error(err);
        alert("Erro ao carregar histórico do aluno.");
    } finally {
        setLoadingHistory(false);
    }
  };

  const handleBack = () => {
    setSelectedStudent(null);
    setStudentHistory([]);
  };

  const handleSaveProfile = async () => {
      if (!selectedStudent || !profileForm.name) return;
      setIsSavingProfile(true);
      try {
          await api.updateStudent(selectedStudent.id, profileForm);
          setSelectedStudent({ ...selectedStudent, ...profileForm } as Student);
          setIsEditingProfile(false);
          alert("Dados pessoais atualizados!");
      } catch (err) {
          console.error(err);
          alert("Erro ao salvar perfil.");
      } finally {
          setIsSavingProfile(false);
      }
  };

  // The Magic: Handle Cell Edit
  const handleCellChange = async (enrollmentId: string, columnId: string, newValue: string, courseIdx: number, moduleIdx: number, colIdx: number) => {
      // 1. Optimistic UI Update (Update local state immediately)
      const newHistory = [...studentHistory];
      newHistory[courseIdx].modules[moduleIdx].columns[colIdx].value = newValue;
      setStudentHistory(newHistory);

      // 2. Background Save
      const key = `${enrollmentId}_${columnId}`;
      setSavingCells(prev => ({ ...prev, [key]: true }));
      
      try {
          await api.saveRecord(enrollmentId, columnId, newValue);
      } catch (err) {
          console.error("Erro ao salvar célula:", err);
          // Revert on error could be implemented here
      } finally {
          setTimeout(() => {
            setSavingCells(prev => ({ ...prev, [key]: false }));
          }, 500);
      }
  };

  // Helper for dynamic coloring based on content
  const getInputStyle = (val: string) => {
    if (!val) return "bg-white border-slate-200 focus:border-blue-500 focus:bg-blue-50";
    const v = val.toUpperCase();
    if (v === 'F') return "text-red-600 font-bold bg-red-50 border-red-200 focus:border-red-400";
    if (v === 'OK') return "text-emerald-600 font-bold bg-emerald-50 border-emerald-200 focus:border-emerald-400";
    if (v.includes('***')) return "text-orange-500 font-bold bg-orange-50 border-orange-200";
    if (v.startsWith('OK')) return "text-emerald-700 font-semibold bg-emerald-50 border-emerald-200"; 
    return "text-slate-800 bg-white border-slate-200 focus:border-blue-500 focus:bg-blue-50";
  };

  // --- VIEW: STUDENT DETAILS (EDITABLE) ---
  if (selectedStudent) {
    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            {/* Header: Student Profile */}
            <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm sticky top-0 z-20">
                <div className="flex items-center gap-4">
                    <button 
                    onClick={handleBack}
                    className="p-2 rounded-full hover:bg-slate-100 transition-colors text-slate-500"
                    title="Voltar"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    
                    {isEditingProfile ? (
                        <div className="flex flex-col gap-2">
                            <input 
                                className="text-lg font-bold text-slate-800 border-b-2 border-indigo-500 outline-none bg-transparent px-1"
                                value={profileForm.name}
                                onChange={e => setProfileForm({...profileForm, name: e.target.value})}
                                placeholder="Nome Completo"
                                autoFocus
                            />
                            <div className="flex gap-2">
                                <input 
                                    className="text-xs text-slate-500 border border-slate-300 rounded px-2 py-1 w-28"
                                    value={profileForm.matricula}
                                    onChange={e => setProfileForm({...profileForm, matricula: e.target.value})}
                                    placeholder="Matrícula"
                                />
                                <input 
                                    className="text-xs text-slate-500 border border-slate-300 rounded px-2 py-1 w-48"
                                    value={profileForm.email}
                                    onChange={e => setProfileForm({...profileForm, email: e.target.value})}
                                    placeholder="Email"
                                />
                            </div>
                        </div>
                    ) : (
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">{selectedStudent.name}</h2>
                            <p className="text-slate-500 text-xs flex items-center gap-2">
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">ID: {selectedStudent.matricula || '---'}</span>
                                <span>{selectedStudent.email}</span>
                            </p>
                        </div>
                    )}
                </div>

                <div className="flex gap-2">
                    {isEditingProfile ? (
                        <>
                             <button 
                                onClick={() => setIsEditingProfile(false)}
                                className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                            >
                                <X size={20} />
                            </button>
                            <button 
                                onClick={handleSaveProfile}
                                disabled={isSavingProfile}
                                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                            >
                                {isSavingProfile ? <Loader2 className="animate-spin" size={16}/> : <Save size={16} />}
                                Salvar
                            </button>
                        </>
                    ) : (
                        <button 
                            onClick={() => setIsEditingProfile(true)}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Editar Perfil"
                        >
                            <Edit2 size={18} />
                        </button>
                    )}
                </div>
            </div>

            {loadingHistory ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="animate-spin text-indigo-600 w-10 h-10" />
                </div>
            ) : (
                <div className="grid gap-6">
                    {studentHistory.length === 0 && (
                        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
                            <GraduationCap className="mx-auto text-slate-300 mb-2" size={48} />
                            <p className="text-slate-500">Este aluno ainda não está matriculado em nenhuma turma.</p>
                        </div>
                    )}

                    {studentHistory.map((course, courseIdx) => (
                        <div key={courseIdx} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            {/* Course Header */}
                            <div className="bg-slate-50/80 px-5 py-3 border-b border-slate-200 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="p-1.5 bg-white rounded border border-slate-200 shadow-sm">
                                        <GraduationCap className="text-indigo-600" size={18} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800 text-sm">{course.courseName}</h3>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{course.termName}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="divide-y divide-slate-100">
                                {course.modules.map((mod: any, moduleIdx: number) => (
                                    <div key={mod.id} className="p-5">
                                        <div className="flex items-center gap-2 mb-3">
                                            <BookOpen size={16} className="text-slate-400" />
                                            <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wide">{mod.name}</h4>
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                            {mod.columns.map((col: any, colIdx: number) => {
                                                const recordKey = `${course.enrollmentId}_${col.id}`;
                                                const isSaving = savingCells[recordKey];
                                                
                                                return (
                                                    <div key={col.id} className="relative group">
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block truncate" title={col.name}>
                                                            {col.name}
                                                        </label>
                                                        
                                                        {col.type === 'check' ? (
                                                             <div 
                                                               onClick={() => handleCellChange(course.enrollmentId, col.id, col.value === 'true' ? 'false' : 'true', courseIdx, moduleIdx, colIdx)}
                                                               className={`h-9 w-full rounded-lg border flex items-center justify-center cursor-pointer transition-all ${col.value === 'true' ? 'bg-emerald-50 border-emerald-300 text-emerald-600' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                                                             >
                                                                 {col.value === 'true' ? <CheckCircle2 size={18}/> : <div className="w-4 h-4 rounded-full border-2 border-slate-300"></div>}
                                                             </div>
                                                        ) : (
                                                            <div className="relative">
                                                                <input 
                                                                    type={col.type === 'date' ? 'date' : 'text'}
                                                                    className={`w-full rounded-lg border px-3 py-2 text-sm transition-all outline-none shadow-sm ${getInputStyle(col.value)}`}
                                                                    value={col.value || ''}
                                                                    placeholder={col.type === 'date' ? '' : '-'}
                                                                    onChange={(e) => {
                                                                        // Update local state immediately for responsiveness
                                                                        const newHistory = [...studentHistory];
                                                                        newHistory[courseIdx].modules[moduleIdx].columns[colIdx].value = e.target.value;
                                                                        setStudentHistory(newHistory);
                                                                    }}
                                                                    onBlur={(e) => handleCellChange(course.enrollmentId, col.id, e.target.value, courseIdx, moduleIdx, colIdx)}
                                                                />
                                                                {/* Saving Indicator */}
                                                                {isSaving && (
                                                                    <div className="absolute right-2 top-2.5">
                                                                        <Loader2 className="animate-spin text-blue-500" size={14} />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            {mod.columns.length === 0 && (
                                                <p className="text-xs text-slate-400 italic col-span-full">Sem colunas definidas.</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {course.modules.length === 0 && (
                                    <div className="p-6 text-center text-sm text-slate-400 italic">
                                        Estrutura da turma vazia.
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
  }

  // --- VIEW: STUDENT LIST ---
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-slate-800">Alunos</h2>
           <p className="text-slate-500">Clique em um aluno para editar notas, presenças e livros.</p>
        </div>
        <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-3 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Buscar por nome..." 
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm transition-shadow"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[400px]">
        {filteredStudents.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
                <User size={48} className="mx-auto text-slate-300 mb-3" />
                <p>Nenhum aluno encontrado.</p>
            </div>
        ) : (
            <div className="divide-y divide-slate-100">
                {filteredStudents.map(student => (
                    <div 
                      key={student.id} 
                      onClick={() => handleSelectStudent(student)}
                      className="p-4 hover:bg-slate-50 cursor-pointer transition-all flex items-center justify-between group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                                {student.name.charAt(0)}
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">{student.name}</h3>
                                <div className="flex items-center gap-3 text-xs text-slate-500">
                                    {student.matricula && <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">Mat: {student.matricula}</span>}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-slate-400 group-hover:text-indigo-500">
                            <span className="text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">Ver Detalhes</span>
                            <ChevronRight size={18} />
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>
      <p className="text-xs text-center text-slate-400 mt-4">Total: {filteredStudents.length} alunos</p>
    </div>
  );
};