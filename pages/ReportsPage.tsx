import React, { useState } from 'react';
import { AppState } from '../types';
import { Download } from 'lucide-react';

interface Props {
  data: AppState;
}

export const ReportsPage: React.FC<Props> = ({ data }) => {
  const [selectedCourseId, setSelectedCourseId] = useState<string>(data.courses[0]?.id || '');
  
  const course = data.courses.find(c => c.id === selectedCourseId);
  const students = data.students.filter(s => s.courseId === selectedCourseId);
  
  // Logic to build the big spreadsheet table
  // Columns: Student | Book 1 (Date) | Class 1 (Status) | Class 2 (Status) ... | Book 2 (Date) ...
  // For simplicity, we will show all course books and all course dates.

  // We'll list all books that have ever been assigned to students in this course
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
    <div className="space-y-6">
       <div className="flex justify-between items-center">
         <div>
            <h2 className="text-2xl font-bold text-slate-800">Relatório Geral</h2>
            <p className="text-slate-500">Visão consolidada de livros e presenças.</p>
         </div>
         <div className="flex gap-4">
            <select 
              value={selectedCourseId} 
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-4 py-2"
            >
               {data.courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button 
              onClick={downloadCSV}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
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
                        <span className="text-[10px] font-normal">{new Date(date).getUTCDate()}/{new Date(date).getUTCMonth()+1}</span>
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
  );
};