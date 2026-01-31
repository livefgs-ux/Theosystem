export interface Profile {
  id: string;
  email: string;
  full_name: string;
}

export interface AcademicTerm {
  id: string;
  name: string;
  is_archived: boolean;
  created_at: string;
}

export interface Course {
  id: string;
  term_id?: string;
  name: string;
  // Added for compatibility with UI components and mock data
  term?: string;
  schedule?: string[];
}

export interface Student {
  id: string;
  name: string;
  matricula: string;
  phone?: string;
  email?: string;
  // Added for compatibility with UI components and mock data
  courseId?: string;
}

export interface Enrollment {
  id: string;
  course_id: string;
  student_id: string;
  student: Student; // Joined
}

export interface CourseModule {
  id: string;
  course_id: string;
  name: string;
  order_index: number;
  columns?: ModuleColumn[];
}

export interface ModuleColumn {
  id: string;
  module_id: string;
  name: string;
  type: 'text' | 'date' | 'check';
  order_index: number;
}

export interface AcademicRecord {
  id: string;
  enrollment_id: string;
  column_id: string;
  value: string;
}

// Helper type for the Spreadsheet Grid
export interface SpreadsheetData {
  course: Course;
  modules: CourseModule[]; // Includes columns
  enrollments: Enrollment[]; // Includes student
  records: Record<string, string>; // Key: "enrollmentId_columnId", Value: value
}

// Additional Types for Dashboard, Books, and Attendance

export interface Book {
  id: string;
  code: string;
  title: string;
  author: string;
  category: string;
  stock: number;
}

export type BookStatus = 'available' | 'borrowed';

export interface BookTransaction {
  id: string;
  studentId: string;
  bookId: string;
  type: 'delivery' | 'return';
  date: string;
}

export interface Attendance {
  id?: string;
  studentId: string;
  courseId: string;
  date: string;
  status: 'present' | 'absent' | 'excused';
}

export interface AppState {
  students: Student[];
  courses: Course[];
  books: Book[];
  transactions: BookTransaction[];
  attendance: Attendance[];
}