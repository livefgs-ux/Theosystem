import React, { useState } from 'react';
import { AppState, Attendance } from '../types';
import { Check, X, Clock } from 'lucide-react';
import { api } from '../services/api';

interface Props {
  data: AppState;
  updateData: (newData: Partial<AppState>) => void;
}

export const AttendancePage: React.FC<Props> = ({ data, updateData }) => {
  const [selectedCourseId, setSelectedCourseId] = useState<string>(data.courses[0]?.id || '');
  const [saving, setSaving] = useState(false);

  const selectedCourse = data.courses.find(c => c.id === selectedCourseId);
  const studentsInCourse = data.students.filter(s => s.courseId === selectedCourseId);

  const getStatus = (studentId: string, date: string): Attendance['status'] | undefined => {
    return data.attendance.find(a => a.studentId === studentId && a.courseId === selectedCourseId && a.date === date)?.status;
  };

  const handleToggle = async (studentId: string, date: string) => {
    if (saving) return;
    setSaving(true);

    const currentStatus = getStatus(studentId, date);
    
    // Cycle logic: undefined -> present -> absent -> excused -> undefined (delete)
    let nextStatus: Attendance['status'] | null = 'present';
    if (currentStatus === 'present') nextStatus = 'absent';
    else if (currentStatus === 'absent') nextStatus = 'excused';
    else if (currentStatus === 'excused') nextStatus = null;

    try {
      if (nextStatus === null) {
        await api.deleteAttendance(studentId, selectedCourseId, date);
        // Optimistic UI Update
        const newAtt = data.attendance.filter(a => !(a.studentId === studentId && a.courseId === selectedCourseId && a.date === date));
        updateData({ attendance: newAtt });
      } else {
        await api.upsertAttendance({
           studentId,
           courseId: selectedCourseId,
           date,
           status: nextStatus
        });
        
        // Optimistic UI Update
        const newEntry = { id: 'temp', studentId, courseId: selectedCourseId, date, status: nextStatus };
        const otherAtt = data.attendance.filter(a => !(a.studentId === studentId && a.courseId === selectedCourseId && a.date === date));
        updateData({ attendance: [...otherAtt, newEntry] });
      }
    } catch (err) {
      console.error("Failed to save attendance", err);
      alert("Erro ao salvar presença. Verifique sua conexão.");
    } finally {
      setSaving(false);
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

  if (!selectedCourse) {
     return <div className="text-slate-500">Nenhuma turma encontrada. Cadastre turmas no banco de dados.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h2 className="text-2xl font-bold text-slate-800">Controle de Presença</h2>
           <p className="text-slate-500">Gerencie a frequência das aulas por turma.</p>
        </div>
        <select 
          value={selectedCourseId} 
          onChange={(e) => setSelectedCourseId(e.target.value)}
          className="bg-white border border-slate-300 rounded-lg px-4 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {data.courses.map(c => (
            <option key={c.id} value={c.id}>{c.name} - {c.term}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold text-slate-700 w-64 sticky left-0 bg-slate-50 z-10">Aluno</th>
                {selectedCourse.schedule.map(date => {
                   const dateObj = new Date(date);
                   const formatted = `${dateObj.getUTCDate()}/${dateObj.getUTCMonth()+1}`;
                   return (
                    <th key={date} className="px-4 py-3 text-center min-w-[80px]">
                      <div className="flex flex-col items-center">
                        <span className="font-bold text-slate-800">{formatted}</span>
                        <span className="text-[10px] font-normal">Aula</span>
                      </div>
                    </th>
                   );
                })}
                <th className="px-4 py-3 text-center w-24">Total %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {studentsInCourse.map(student => {
                const totalClasses = selectedCourse.schedule.length || 1;
                const studentAttendance = data.attendance.filter(a => a.studentId === student.id && a.courseId === selectedCourseId && a.status === 'present').length;
                const percentage = Math.round((studentAttendance / totalClasses) * 100);

                return (
                  <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-800 bg-white sticky left-0 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                      {student.name}
                      <div className="text-xs text-slate-400 font-normal">{student.matricula}</div>
                    </td>
                    {selectedCourse.schedule.map(date => {
                      const status = getStatus(student.id, date);
                      return (
                        <td key={date} className="px-2 py-2 text-center">
                          <button
                            onClick={() => handleToggle(student.id, date)}
                            disabled={saving}
                            className={`w-10 h-10 rounded-lg flex items-center justify-center border transition-all mx-auto ${getStatusClass(status)}`}
                          >
                            {getStatusIcon(status)}
                          </button>
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-center font-bold text-slate-700">
                      <span className={`${percentage < 75 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {percentage}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};