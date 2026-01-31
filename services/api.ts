import { supabase } from './supabaseClient';
import { AcademicTerm, Course, SpreadsheetData, Student } from '../types';

export const api = {
  // --- TERMS ---
  async getTerms() {
    return await supabase
      .from('academic_terms')
      .select('*')
      .order('created_at', { ascending: false });
  },

  async createTerm(name: string, userId: string) {
    return await supabase.from('academic_terms').insert({ name, user_id: userId });
  },

  async duplicateTerm(termId: string, newName: string) {
    return await supabase.rpc('clone_academic_term', { source_term_id: termId, new_name: newName });
  },

  async deleteTerm(id: string) {
    return await supabase.from('academic_terms').delete().eq('id', id);
  },

  // --- COURSES ---
  async getCourses(termId: string) {
    return await supabase
      .from('courses')
      .select('*')
      .eq('term_id', termId)
      .order('name');
  },

  async createCourse(termId: string, name: string) {
    return await supabase.from('courses').insert({ term_id: termId, name });
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
      .order('created_at'); // Ideally order by student name, handled in JS

    // 4. Get Records (Cells)
    // We only get records for enrollments in this course
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

    // Sort columns inside modules
    const modules = (modulesData || []).map((m: any) => ({
      ...m,
      columns: (m.columns || []).sort((a: any, b: any) => a.order_index - b.order_index)
    }));

    // Sort enrollments by student name
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

  // --- MANIPULATION ---
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

  async addStudent(name: string, matricula: string, userId: string) {
    return await supabase.from('students').insert({ name, matricula, user_id: userId }).select().single();
  },

  async searchStudents(query: string) {
    return await supabase.from('students').select('*').ilike('name', `%${query}%`).limit(10);
  },

  async enrollStudent(courseId: string, studentId: string) {
    return await supabase.from('enrollments').insert({ course_id: courseId, student_id: studentId });
  },

  async addModule(courseId: string, name: string) {
    return await supabase.from('course_modules').insert({ course_id: courseId, name });
  },

  async addColumn(moduleId: string, name: string) {
    return await supabase.from('module_columns').insert({ module_id: moduleId, name });
  },

  // --- ATTENDANCE ---
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

  // --- BOOK TRANSACTIONS ---
  async createTransaction(data: { studentId: string, bookId: string, type: string, date: string }) {
    return await supabase
      .from('book_transactions')
      .insert({
        student_id: data.studentId,
        book_id: data.bookId,
        type: data.type,
        date: data.date
      });
  }
};