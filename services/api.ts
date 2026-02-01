import { supabase } from './supabaseClient';
import { AcademicTerm, Course, SpreadsheetData, Student, Book, AppState } from '../types';

export const api = {
  // --- TERMS ---
  async getTerms() {
    return await supabase
      .from('academic_terms')
      .select('*')
      .order('created_at', { ascending: false });
  },

  async createTerm(name: string, userId: string) {
    return await supabase.from('academic_terms').insert({ name, user_id: userId }).select();
  },

  async duplicateTerm(termId: string, newName: string) {
    return await supabase.rpc('clone_academic_term', { source_term_id: termId, new_name: newName });
  },

  async deleteTerm(id: string) {
    return await supabase.from('academic_terms').delete().eq('id', id);
  },

  // --- COURSES ---
  async getCourses(termId?: string) {
    let query = supabase.from('courses').select('*, term:academic_terms(name)').order('name');
    if (termId) {
      query = query.eq('term_id', termId);
    }
    return await query;
  },

  async createCourse(termId: string, name: string) {
    return await supabase.from('courses').insert({ term_id: termId, name }).select();
  },

  // --- STUDENTS ---
  async getAllStudents() {
    return await supabase.from('students').select('*').order('name');
  },

  async findStudent(name: string, userId: string) {
    return await supabase
      .from('students')
      .select('*')
      .eq('user_id', userId)
      .ilike('name', name)
      .maybeSingle();
  },

  async addStudent(name: string, matricula: string, userId: string) {
    return await supabase.from('students').insert({ name, matricula, user_id: userId }).select().single();
  },

  async searchStudents(query: string) {
    return await supabase.from('students').select('*').ilike('name', `%${query}%`).limit(10);
  },

  async enrollStudent(courseId: string, studentId: string) {
    return await supabase.from('enrollments').insert({ course_id: courseId, student_id: studentId }).select();
  },

  async getStudentCompleteHistory(studentId: string) {
    // 1. Get Student Info
    const { data: student } = await supabase.from('students').select('*').eq('id', studentId).single();
    if (!student) throw new Error("Student not found");

    // 2. Get Enrollments with Course Details
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('*, course:courses(*, term:academic_terms(name))')
      .eq('student_id', studentId);

    const history = [];

    if (enrollments) {
        for (const enroll of enrollments) {
            // 3. For each course, get structure (Modules + Columns) and Records
            const { data: modulesData } = await supabase
                .from('course_modules')
                .select('*, columns:module_columns(*)')
                .eq('course_id', enroll.course_id)
                .order('order_index');

            const { data: records } = await supabase
                .from('academic_records')
                .select('*')
                .eq('enrollment_id', enroll.id);

            // Map records for easy access
            const recordsMap: Record<string, string> = {};
            (records || []).forEach((r: any) => {
                recordsMap[r.column_id] = r.value;
            });

            // Organize modules with their filled values
            const organizedModules = (modulesData || []).map((m: any) => ({
                id: m.id,
                name: m.name,
                columns: (m.columns || []).sort((a: any, b: any) => a.order_index - b.order_index).map((col: any) => ({
                    id: col.id,
                    name: col.name,
                    type: col.type,
                    value: recordsMap[col.id] || ''
                }))
            }));

            history.push({
                courseName: enroll.course?.name,
                termName: enroll.course?.term?.name,
                modules: organizedModules
            });
        }
    }

    return { student, history };
  },

  // --- SPREADSHEET DATA ---
  async getSpreadsheetData(courseId: string): Promise<SpreadsheetData | null> {
    // 1. Get Course Info
    const { data: course } = await supabase.from('courses').select('*').eq('id', courseId).single();
    if (!course) return null;

    // 2. Get Modules & Columns
    const { data: modulesData } = await supabase
      .from('course_modules')
      .select('*, columns:module_columns(*)')
      .eq('course_id', courseId)
      .order('order_index');

    // 3. Get Enrollments (Students)
    const { data: enrollmentsData } = await supabase
      .from('enrollments')
      .select('*, student:students(*)')
      .eq('course_id', courseId)
      .order('created_at'); 

    // 4. Get Records (Cells)
    const enrollmentIds = (enrollmentsData || []).map(e => e.id);
    let recordsMap: Record<string, string> = {};

    if (enrollmentIds.length > 0) {
      const { data: records } = await supabase
        .from('academic_records')
        .select('*')
        .in('enrollment_id', enrollmentIds);
      
      (records || []).forEach((r: any) => {
        recordsMap[`${r.enrollment_id}_${r.column_id}`] = r.value;
      });
    }

    const modules = (modulesData || []).map((m: any) => ({
      ...m,
      columns: (m.columns || []).sort((a: any, b: any) => a.order_index - b.order_index)
    }));

    const enrollments = (enrollmentsData || []).sort((a: any, b: any) => 
      (a.student?.name || '').localeCompare(b.student?.name || '')
    );

    return {
      course,
      modules,
      enrollments,
      records: recordsMap
    };
  },

  async saveRecord(enrollmentId: string, columnId: string, value: string) {
    return await supabase
      .from('academic_records')
      .upsert({ 
        enrollment_id: enrollmentId, 
        column_id: columnId, 
        value: value,
        updated_at: new Date().toISOString()
      }, { onConflict: 'enrollment_id,column_id' });
  },

  async addModule(courseId: string, name: string) {
    return await supabase.from('course_modules').insert({ course_id: courseId, name }).select();
  },

  async addColumn(moduleId: string, name: string, type: 'text' | 'date' | 'check' = 'text') {
    return await supabase.from('module_columns').insert({ module_id: moduleId, name, type }).select();
  },

  // --- LIBRARY BOOKS ---
  async getLibraryBooks() {
    return await supabase.from('library_books').select('*').order('title');
  },

  async createBook(book: Partial<Book> & { user_id: string }) {
    return await supabase.from('library_books').insert(book).select();
  },

  // --- BOOK TRANSACTIONS ---
  async getTransactions() {
    return await supabase.from('book_transactions').select('*').order('date', { ascending: false });
  },

  async createTransaction(data: { studentId: string, bookId: string, type: string, date: string }) {
    return await supabase
      .from('book_transactions')
      .insert({
        student_id: data.studentId,
        book_id: data.bookId,
        type: data.type,
        date: data.date
      });
  },

  // --- ATTENDANCE ---
  async getAttendance() {
    return await supabase.from('attendance').select('*');
  },

  async deleteAttendance(studentId: string, courseId: string, date: string) {
    return await supabase
      .from('attendance')
      .delete()
      .match({ student_id: studentId, course_id: courseId, date: date });
  },

  async upsertAttendance(data: { studentId: string, courseId: string, date: string, status: string }) {
    return await supabase
      .from('attendance')
      .upsert({
        student_id: data.studentId,
        course_id: data.courseId,
        date: data.date,
        status: data.status
      }, { onConflict: 'student_id,course_id,date' });
  },

  // --- GLOBAL DATA ---
  async fetchGlobalData(): Promise<AppState> {
    const [students, courses, books, transactions, attendance] = await Promise.all([
      this.getAllStudents(),
      this.getCourses(),
      this.getLibraryBooks(),
      this.getTransactions(),
      this.getAttendance()
    ]);

    // Format courses with simple term string if term is joined
    const formattedCourses = (courses.data || []).map((c: any) => ({
      ...c,
      term: c.term?.name || 'Geral',
      schedule: [] // Could calculate this from modules or attendance logs
    }));

    return {
      students: students.data || [],
      courses: formattedCourses,
      books: books.data || [],
      transactions: transactions.data || [],
      attendance: attendance.data || []
    };
  }
};