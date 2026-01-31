import React from 'react';
import { AppState } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Users, Book, BookOpenCheck, AlertTriangle } from 'lucide-react';

interface Props {
  data: AppState;
}

export const DashboardStats: React.FC<Props> = ({ data }) => {
  const totalStudents = data.students.length;
  const totalBooks = data.books.reduce((acc, b) => acc + b.stock, 0);
  const deliveredBooks = data.transactions.filter(t => t.type === 'delivery').length;
  const returnedBooks = data.transactions.filter(t => t.type === 'return').length;
  const pendingReturn = deliveredBooks - returnedBooks;

  // Attendance Stats
  const totalAttendanceRecords = data.attendance.length;
  const absences = data.attendance.filter(a => a.status === 'absent').length;
  const absenceRate = totalAttendanceRecords > 0 ? (absences / totalAttendanceRecords) * 100 : 0;

  const cards = [
    { title: 'Total de Alunos', value: totalStudents, icon: Users, color: 'bg-blue-500' },
    { title: 'Livros em Circulação', value: pendingReturn, icon: BookOpenCheck, color: 'bg-orange-500' },
    { title: 'Estoque Total', value: totalBooks, icon: Book, color: 'bg-emerald-500' },
    { title: 'Taxa de Faltas', value: `${absenceRate.toFixed(1)}%`, icon: AlertTriangle, color: 'bg-red-500' },
  ];

  const bookStatusData = [
    { name: 'Entregues (Pendentes)', value: pendingReturn },
    { name: 'Devolvidos', value: returnedBooks },
    { name: 'Em Estoque', value: totalBooks },
  ];
  
  const COLORS = ['#f97316', '#10b981', '#3b82f6'];

  const attendanceData = data.courses.map(course => {
    const courseAttendance = data.attendance.filter(a => a.courseId === course.id);
    const present = courseAttendance.filter(a => a.status === 'present').length;
    const absent = courseAttendance.filter(a => a.status === 'absent').length;
    return {
      name: course.name.substring(0, 15) + '...',
      Presente: present,
      Ausente: absent,
    };
  });

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">{card.title}</p>
                <h3 className="text-2xl font-bold text-slate-800">{card.value}</h3>
              </div>
              <div className={`${card.color} p-3 rounded-lg text-white shadow-md`}>
                <Icon size={24} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance Bar Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h4 className="text-lg font-semibold text-slate-800 mb-6">Frequência por Turma</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attendanceData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip cursor={{fill: '#f1f5f9'}} />
                <Bar dataKey="Presente" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Ausente" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Book Status Pie Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h4 className="text-lg font-semibold text-slate-800 mb-6">Status dos Materiais</h4>
          <div className="h-64 flex justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={bookStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {bookStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 mt-4">
            {bookStatusData.map((entry, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index] }}></div>
                <span className="text-sm text-slate-600">{entry.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};