import React, { useState, useEffect } from 'react';
import { AppState, Attendance, Student, Course } from '../types';
import { Check, X, Clock, Loader2, CalendarCheck } from 'lucide-react';
import { api } from '../services/api';

interface Props {
  data: AppState;
  updateData: (newData: Partial<AppState>) => void;
}

export const AttendancePage: React.FC<Props> = ({ data, updateData }) => {
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [courseAttendance, setCourseAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Group Courses by Term for better selection
  const coursesByTerm = data.courses.reduce((acc, course) => {
    const term = course.term || 'Outros';
    if (!acc[term]) acc[term] = [];
    acc[term].push(course);
    return acc;
  }, {} as Record<string, Course[]>);

  useEffect(() => {
    if (selectedCourseId) {
        loadCourseAttendance(selectedCourseId);
    } else {
        setCourseAttendance([]);
    }
  }, [selectedCourseId]);

  const loadCourseAttendance = async (cId: string) => {
      setLoading(true);
      const { data: att } = await api.getAttendanceByCourse(cId);
      setCourseAttendance(att || []);
      setLoading(false);
  };

  const selectedCourse = data.courses.find(c => c.id === selectedCourseId);
  
  const [enrolledStudents, setEnrolledStudents] = useState<Student[]>([]);
  
  useEffect(() => {
     if(selectedCourseId) {
         api.getSpreadsheetData(selectedCourseId).then(res => {
             if(res) {
                 // Safely map and filter students to ensure no nulls
                 const students = res.enrollments.map(e => e.student).filter((s): s is Student => !!s);
                 setEnrolledStudents(students);
             }
         });
     }
  }, [selectedCourseId]);


  const getStatus = (studentId: string, date: string): Attendance['status'] | undefined => {
    return courseAttendance.find(a => a.studentId === studentId && a.courseId === selectedCourseId && a.date === date)?.status;
  };

  const handleToggle = async (studentId: string, date: string) => {
    if (savingId) return;
    setSavingId(`${studentId}-${date}`);

    const currentStatus = getStatus(studentId, date);
    
    // Cycle: undefined -> present -> absent -> excused -> undefined
    let nextStatus: Attendance['status'] | null = 'present';
    if (currentStatus === 'present') nextStatus = 'absent';
    else if (currentStatus === 'absent') nextStatus = 'excused';
    else if (currentStatus === 'excused') nextStatus = null;

    try {
      if (nextStatus === null) {
        await api.deleteAttendance(studentId, selectedCourseId, date);
        setCourseAttendance(prev => prev.filter(a => !(a.studentId === studentId && a.date === date)));
      } else {
        await api.upsertAttendance({
           studentId,
           courseId: selectedCourseId,
           date,
           status: nextStatus
        });
        
        const newEntry: Attendance = { id: 'temp', studentId, courseId: selectedCourseId, date, status: nextStatus };
        setCourseAttendance(prev => {
            const filtered = prev.filter(a => !(a.studentId === studentId && a.date === date));
            return [...filtered, newEntry];
        });
      }
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar presença.");
    } finally {
      setSavingId(null);
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'present': return <Check size={16} className="text-emerald-600" />;
      case 'absent': return <X size={16} className="text-red-500" />;
      case 'excused': return <Clock size={16} className="text-orange-500" />;
      default: return <div className="w-4 h-4 rounded-full border border-slate-300"></div>;
    }
  };

  const getStatusClass = (status?: string) => {
    switch (status) {
      case 'present': return 'bg-emerald-50 border-emerald-200';
      case 'absent': return 'bg-red-50 border-red-200';
      case 'excused': return 'bg-orange-50 border-orange-200';
      default: return 'bg-white border-slate-200 hover:bg-slate-50';
    }
  };

  // Safe access to schedule
  const courseSchedule: string[] = selectedCourse?.schedule || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h2 className="text-2xl font-bold text-slate-800">Controle de Presença</h2>
           <p className="text-slate-500">Selecione uma turma para gerenciar a chamada.</p>
        </div>
        
        <div className="w-full md:w-80">
            <select 
            value={selectedCourseId} 
            onChange={(e) => setSelectedCourseId(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
            >
            <option value="">-- Selecione a Turma --</option>
            {Object.entries(coursesByTerm).map(([term, courses]) => (
                <optgroup key={term} label={term}>
                    {(courses as Course[]).map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </optgroup>
            ))}
            </select>
        </div>
      </div>

      {!selectedCourse ? (
          <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center">
              <CalendarCheck className="mx-auto text-slate-300 mb-4" size={48} />
              <p className="text-slate-500">Selecione uma turma acima para carregar a lista de alunos.</p>
          </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in duration-300">
            {loading ? (
                <div className="p-12 text-center"><Loader2 className="animate-spin mx-auto text-indigo-600"/> Carregando lista...</div>
            ) : (
                <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                    <tr>
                        <th className="px-6 py-4 font-semibold text-slate-700 w-64 sticky left-0 bg-slate-50 z-10">Aluno</th>
                        {courseSchedule.map((date, idx) => {
                        const dateObj = new Date(date);
                        const formatted = isNaN(dateObj.getTime()) ? `Aula ${idx+1}` : `${dateObj.getUTCDate()}/${dateObj.getUTCMonth()+1}`;
                        return (
                            <th key={idx} className="px-4 py-3 text-center min-w-[80px]">
                            <div className="flex flex-col items-center">
                                <span className="font-bold text-slate-800">{formatted}</span>
                            </div>
                            </th>
                        );
                        })}
                        {courseSchedule.length === 0 && <th className="px-4 py-4 text-slate-400 font-normal normal-case italic">Sem datas definidas</th>}
                        <th className="px-4 py-3 text-center w-24 border-l border-slate-100">Freq.</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                    {enrolledStudents.map(student => {
                        const totalClasses = courseSchedule.length || 1;
                        const studentAttendance = courseAttendance.filter(a => a.studentId === student.id && a.status === 'present').length;
                        const percentage = totalClasses > 0 ? Math.round((studentAttendance / totalClasses) * 100) : 0;

                        return (
                        <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 font-medium text-slate-800 bg-white sticky left-0 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] border-r border-slate-100">
                            {student.name}
                            <div className="text-xs text-slate-400 font-normal">{student.matricula || 'S/ Matrícula'}</div>
                            </td>
                            {courseSchedule.map((date, idx) => {
                            const status = getStatus(student.id, date);
                            const isSaving = savingId === `${student.id}-${date}`;
                            return (
                                <td key={idx} className="px-2 py-2 text-center">
                                <button
                                    onClick={() => handleToggle(student.id, date)}
                                    disabled={!!savingId}
                                    className={`w-10 h-10 rounded-lg flex items-center justify-center border transition-all mx-auto ${getStatusClass(status)}`}
                                >
                                    {isSaving ? <Loader2 size={16} className="animate-spin text-slate-400"/> : getStatusIcon(status)}
                                </button>
                                </td>
                            );
                            })}
                             {courseSchedule.length === 0 && <td className="text-center text-slate-300">-</td>}
                            <td className="px-4 py-3 text-center font-bold text-slate-700 border-l border-slate-100">
                            <span className={`${percentage < 75 ? 'text-red-600' : 'text-emerald-600'}`}>
                                {percentage}%
                            </span>
                            </td>
                        </tr>
                        );
                    })}
                    {enrolledStudents.length === 0 && (
                        <tr>
                            <td colSpan={10} className="p-8 text-center text-slate-500">Nenhum aluno matriculado nesta turma.</td>
                        </tr>
                    )}
                    </tbody>
                </table>
                </div>
            )}
        </div>
      )}
    </div>
  );
};