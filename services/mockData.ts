import { Student, Course, Book, BookTransaction, Attendance, BookStatus } from '../types';

export const initialCourses: Course[] = [
  {
    id: 'c1',
    name: 'Teologia Sistemática I',
    term: '1º Trimestre 2024',
    schedule: ['2024-02-05', '2024-02-12', '2024-02-19', '2024-02-26']
  },
  {
    id: 'c2',
    name: 'Hebraico Bíblico',
    term: '1º Trimestre 2024',
    schedule: ['2024-02-06', '2024-02-13', '2024-02-20', '2024-02-27']
  }
];

export const initialStudents: Student[] = [
  { id: 's1', name: 'Ana Silva', matricula: '2024001', email: 'ana@email.com', phone: '(11) 99999-0001', courseId: 'c1' },
  { id: 's2', name: 'Bruno Santos', matricula: '2024002', email: 'bruno@email.com', phone: '(11) 99999-0002', courseId: 'c1' },
  { id: 's3', name: 'Carlos Oliveira', matricula: '2024003', email: 'carlos@email.com', phone: '(11) 99999-0003', courseId: 'c1' },
  { id: 's4', name: 'Daniela Lima', matricula: '2024004', email: 'dani@email.com', phone: '(11) 99999-0004', courseId: 'c2' },
  { id: 's5', name: 'Eduardo Costa', matricula: '2024005', email: 'edu@email.com', phone: '(11) 99999-0005', courseId: 'c2' },
];

export const initialBooks: Book[] = [
  { id: 'b1', code: 'TEO-001', title: 'Teologia Sistemática - Berkhof', author: 'Louis Berkhof', category: 'Sistemática', stock: 15 },
  { id: 'b2', code: 'HEB-001', title: 'Gramática do Hebraico', author: 'Allen Ross', category: 'Idiomas', stock: 8 },
  { id: 'b3', code: 'HIS-001', title: 'História dos Hebreus', author: 'Flávio Josefo', category: 'Históricos', stock: 20 },
];

export const initialTransactions: BookTransaction[] = [
  { id: 't1', studentId: 's1', bookId: 'b1', type: 'delivery', date: '2024-02-01' },
  { id: 't2', studentId: 's2', bookId: 'b1', type: 'delivery', date: '2024-02-01' },
  { id: 't3', studentId: 's1', bookId: 'b1', type: 'return', date: '2024-06-01' }, // Returned example
];

export const initialAttendance: Attendance[] = [
  { id: 'a1', studentId: 's1', courseId: 'c1', date: '2024-02-05', status: 'present' },
  { id: 'a2', studentId: 's2', courseId: 'c1', date: '2024-02-05', status: 'absent' },
  { id: 'a3', studentId: 's3', courseId: 'c1', date: '2024-02-05', status: 'present' },
];