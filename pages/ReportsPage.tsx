import React, { useState, useEffect } from 'react';
import { AppState } from '../types';
import { Download, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';

interface Props {
  data: AppState;
}

export const ReportsPage: React.FC<Props> = ({ data }) => {
  const [selectedCourseId, setSelectedCourseId] = useState<string>(data.courses[0]?.id || '');
  const [pendingReturns, setPendingReturns] = useState<any[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);

  useEffect(() => {
      loadPending();
  }, []);

  const loadPending = async () => {
      setLoadingPending(true);
      const res = await api.getPendingReturns();
      setPendingReturns(res || []);
      setLoadingPending(false);
  };
  
  const course = data.courses.find(c => c.id === selectedCourseId);
  const students = data.students.filter(s => s.courseId === selectedCourseId); // Fallback filter, ideally use enrollments
  
  // Logic to build the big spreadsheet table
  // We'll list all books that have ever been assigned to students in this course
  // Note: Using global transactions from data props might be empty due to optimization
  // For the report, we might need to fetch specific course transactions if we optimized App.tsx too much.
  // Assuming data.transactions still exists for now or we fetch it.
  
  const courseBookIds = Array.from(new Set(data.transactions
    .filter(t => students.some(s => s.id === t.studentId))
    .map(t => t.bookId)));
  
  const courseBooks = data.books.filter(b => courseBookIds.includes(b.id));

  const downloadCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Header
    let header = ["Nome", "Matricula"];
    courseBooks.forEach(b => header.push(`Livro: ${b.title}`));
    course?.schedule.forEach(date => header.push(`Aula: ${date}`));
    csvContent += header.join(",") + "\r\n";

    // Rows
    students.forEach(student => {
      let row = [student.name, student.matricula];
      
      // Books
      courseBooks.forEach(book => {
        const delivery = data.transactions.find(t => t.studentId === student.id && t.bookId === book.id && t.type === 'delivery');
        row.push(delivery ? delivery.date : '-');
      });

      // Attendance
      course?.schedule.forEach(date => {
        const att = data.attendance.find(a => a.studentId === student.id && a.courseId === selectedCourseId && a.date === date);
        row.push(att ? att.status : '-');
      });

      csvContent += row.join(",") + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `relatorio_${course?.name}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
       
       {/* SECTION: PENDING RETURNS */}
       <div className="bg-white border border-orange-200 rounded-xl overflow-hidden shadow-sm">
           <div className="p-4 bg-orange-50 border-b border-orange-100 flex items-center gap-3">
               <div className="bg-orange-100 p-2 rounded-lg text-orange-600">
                   <AlertCircle size={20} />
               </div>
               <div>
                   <h3 className="font-bold text-orange-900">Devoluções Pendentes</h3>
                   <p className="text-xs text-orange-700">Livros entregues que ainda não foram devolvidos.</p>
               </div>
               <button onClick={loadPending} className="ml-auto text-xs text-orange-600 hover:text-orange-800 underline">Atualizar</button>
           </div>
           
           <div className="max-h-64 overflow-y-auto custom-scrollbar">
                {loadingPending ? (
                    <div className="p-8 text-center text-slate-400">Carregando pendências...</div>
                ) : (
                    <table className="w-full text-sm text-left">
                        <thead className="bg-white text-slate-500 sticky top-0 shadow-sm">
                            <tr>
                                <th className="px-4 py-2 font-medium">Aluno</th>
                                <th className="px-4 py-2 font-medium">Livro</th>
                                <th className="px-4 py-2 font-medium">Data Entrega</th>
                                <th className="px-4 py-2 font-medium">Dias em Aberto</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-orange-100/50">
                            {pendingReturns.map((p, idx) => {
                                const days = Math.floor((new Date().getTime() - new Date(p.date).getTime()) / (1000 * 3600 * 24));
                                return (
                                    <tr key={idx} className="hover:bg-orange-50/30 transition-colors">
                                        <td className="px-4 py-2 font-medium text-slate-800">{p.student?.name}</td>
                                        <td className="px-4 py-2 text-slate-600">{p.book?.title} <span className="text-xs text-slate-400">({p.book?.code})</span></td>
                                        <td className="px-4 py-2 text-slate-600">{new Date(p.date).toLocaleDateString('pt-BR')}</td>
                                        <td className="px-4 py-2">
                                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${days > 90 ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                                                {days} dias
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                            {pendingReturns.length === 0 && (
                                <tr><td colSpan={4} className="p-8 text-center text-slate-400 flex flex-col items-center gap-2"><CheckCircle2 size={24} className="text-emerald-400"/> Tudo em dia! Nenhuma pendência encontrada.</td></tr>
                            )}
                        </tbody>
                    </table>
                )}
           </div>
       </div>

       {/* SECTION: GENERAL REPORT */}
       <div className="space-y-4">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <FileText size={24} className="text-slate-400"/>
                        Relatório Consolidado
                    </h2>
                    <p className="text-slate-500 text-sm">Visão geral de presenças e livros por turma.</p>
                </div>
                <div className="flex gap-4">
                    <select 
                    value={selectedCourseId} 
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                    className="bg-white border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                        {data.courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <button 
                    onClick={downloadCSV}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
                    >
                    <Download size={18}/>
                    Exportar CSV
                    </button>
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-slate-100 text-slate-600 uppercase text-xs font-bold">
                    <tr>
                        <th className="px-4 py-4 sticky left-0 bg-slate-100 z-20 border-r border-slate-200 min-w-[200px]">Aluno</th>
                        
                        {/* Books Header Group */}
                        {courseBooks.map(book => (
                        <th key={book.id} className="px-4 py-3 bg-blue-50/50 text-blue-800 border-r border-slate-200 min-w-[140px]">
                            <div className="flex flex-col">
                            <span className="truncate w-32" title={book.title}>{book.title}</span>
                            <span className="text-[10px] opacity-70 font-normal">Data Entrega</span>
                            </div>
                        </th>
                        ))}

                        {/* Attendance Header Group */}
                        {course?.schedule.map((date, idx) => (
                        <th key={date} className="px-2 py-3 bg-orange-50/50 text-orange-800 border-r border-slate-200 text-center min-w-[80px]">
                            <div className="flex flex-col">
                                <span>Aula {idx + 1}</span>
                                <span className="text-[10px] font-normal">Data</span>
                            </div>
                        </th>
                        ))}
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                    {students.map(student => (
                        <tr key={student.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-medium text-slate-800 sticky left-0 bg-white z-10 border-r border-slate-200">
                            {student.name}
                            </td>

                            {/* Book Data */}
                            {courseBooks.map(book => {
                            const delivery = data.transactions.find(t => t.studentId === student.id && t.bookId === book.id && t.type === 'delivery');
                            return (
                                <td key={book.id} className="px-4 py-3 border-r border-slate-100 text-slate-600">
                                {delivery ? new Date(delivery.date).toLocaleDateString('pt-BR') : '-'}
                                </td>
                            );
                            })}

                            {/* Attendance Data */}
                            {course?.schedule.map(date => {
                            const att = data.attendance.find(a => a.studentId === student.id && a.courseId === selectedCourseId && a.date === date);
                            let statusLabel = '-';
                            let statusColor = 'text-slate-300';
                            
                            if(att?.status === 'present') { statusLabel = 'P'; statusColor = 'text-emerald-600 font-bold'; }
                            if(att?.status === 'absent') { statusLabel = 'F'; statusColor = 'text-red-500 font-bold'; }
                            if(att?.status === 'excused') { statusLabel = 'J'; statusColor = 'text-orange-500'; }

                            return (
                                <td key={date} className={`px-2 py-3 border-r border-slate-100 text-center ${statusColor}`}>
                                {statusLabel}
                                </td>
                            );
                            })}
                        </tr>
                    ))}
                    </tbody>
                </table>
                </div>
            </div>
       </div>
    </div>
  );
};