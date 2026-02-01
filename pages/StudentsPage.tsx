import React, { useState } from 'react';
import { AppState, Student } from '../types';
import { Search, User, ChevronRight, BookOpen, GraduationCap, Calendar, CheckCircle2, XCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { api } from '../services/api';

interface Props {
  data: AppState;
}

export const StudentsPage: React.FC<Props> = ({ data }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentHistory, setStudentHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Filter students
  const filteredStudents = data.students.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.matricula?.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => a.name.localeCompare(b.name));

  const handleSelectStudent = async (student: Student) => {
    setSelectedStudent(student);
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

  // --- VIEW: STUDENT PROFILE ---
  if (selectedStudent) {
    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button 
                  onClick={handleBack}
                  className="p-2 rounded-full hover:bg-slate-200 transition-colors"
                >
                    <ArrowLeft className="text-slate-600" />
                </button>
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">{selectedStudent.name}</h2>
                    <p className="text-slate-500 text-sm">Matrícula: {selectedStudent.matricula || 'N/A'} • {selectedStudent.email || 'Sem email'}</p>
                </div>
            </div>

            {loadingHistory ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="animate-spin text-indigo-600 w-10 h-10" />
                </div>
            ) : (
                <div className="grid gap-8">
                    {studentHistory.length === 0 && (
                        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
                            <GraduationCap className="mx-auto text-slate-300 mb-2" size={48} />
                            <p className="text-slate-500">Este aluno ainda não está matriculado em nenhuma turma.</p>
                        </div>
                    )}

                    {studentHistory.map((course, idx) => (
                        <div key={idx} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                                        <GraduationCap className="text-indigo-600" size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800">{course.courseName}</h3>
                                        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{course.termName}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="divide-y divide-slate-100">
                                {course.modules.map((mod: any, mIdx: number) => (
                                    <div key={mIdx} className="p-6">
                                        <div className="flex items-center gap-2 mb-4">
                                            <BookOpen size={18} className="text-slate-400" />
                                            <h4 className="font-bold text-slate-700 text-sm uppercase tracking-wide">{mod.name}</h4>
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                            {mod.columns.map((col: any) => (
                                                <div key={col.id} className="bg-slate-50 rounded-lg p-3 border border-slate-100 relative group hover:border-indigo-200 transition-colors">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">{col.name}</span>
                                                    <div className="font-medium text-slate-800 text-sm truncate" title={col.value}>
                                                        {col.type === 'check' ? (
                                                            col.value === 'true' ? 
                                                            <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 size={14}/> Sim</span> : 
                                                            <span className="flex items-center gap-1 text-slate-400"><XCircle size={14}/> Não</span>
                                                        ) : (
                                                            col.value || <span className="text-slate-300 italic">-</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                            {mod.columns.length === 0 && (
                                                <p className="text-xs text-slate-400 italic col-span-full">Sem registros neste módulo.</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {course.modules.length === 0 && (
                                    <div className="p-6 text-center text-sm text-slate-400 italic">
                                        A estrutura desta turma ainda não foi definida (sem módulos/colunas).
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
           <p className="text-slate-500">Gerencie o cadastro e consulte o histórico escolar.</p>
        </div>
        <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-3 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Buscar aluno por nome ou matrícula..." 
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
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
                            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                                {student.name.charAt(0)}
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 group-hover:text-indigo-700">{student.name}</h3>
                                <div className="flex items-center gap-3 text-xs text-slate-500">
                                    <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">Mat: {student.matricula || '---'}</span>
                                    <span>{student.email}</span>
                                </div>
                            </div>
                        </div>
                        <ChevronRight className="text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
                    </div>
                ))}
            </div>
        )}
      </div>
      <p className="text-xs text-center text-slate-400 mt-4">Mostrando {filteredStudents.length} alunos (Ordem Alfabética)</p>
    </div>
  );
};