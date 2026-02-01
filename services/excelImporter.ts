import * as XLSX from 'xlsx';
import { api } from './api';
import { supabase } from './supabaseClient';

export interface ImportResult {
    success: boolean;
    count: number;
    errors: string[];
    termName: string;
    courseName: string;
}

export const excelImporter = {
  async parseAndImport(file: File, userId: string, onProgress: (msg: string) => void): Promise<ImportResult> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

          if (jsonData.length < 2) throw new Error("Arquivo vazio ou formato inválido.");

          // 1. Identify Structure
          onProgress("Analisando estrutura do arquivo...");
          
          let headerRowIndex = -1;
          // Look for the row that contains "ALUNO" or "NOME"
          for (let i = 0; i < Math.min(jsonData.length, 10); i++) {
            const rowStr = jsonData[i].join(' ').toUpperCase();
            if (rowStr.includes('ALUNO') || rowStr.includes('NOME')) {
              headerRowIndex = i;
              break;
            }
          }

          if (headerRowIndex === -1) throw new Error("Não foi possível encontrar a coluna 'ALUNO' no cabeçalho.");

          // Context (Title) is usually above the header
          const titleRow = headerRowIndex > 0 ? jsonData[0][0] : "Nova Turma Importada";
          const courseName = typeof titleRow === 'string' ? titleRow : "Turma Importada";
          const termName = "Período Importado " + new Date().getFullYear();

          // 2. Create Structure in DB
          onProgress("Criando Período e Turma...");
          
          // Create Term (or use existing if we implemented search, but for now create new to be safe)
          const { data: term, error: termError } = await api.createTerm(termName, userId);
          if (termError) throw termError;
          const termId = term![0].id;

          // Create Course
          const { data: course, error: courseError } = await api.createCourse(termId, courseName);
          if (courseError) throw courseError;
          const courseId = course![0].id;

          // Create a default Module "Geral" to hold the imported columns
          // (Improving this to split by 'LIVRO' if possible would be advanced, sticking to flat for robustness)
          const { data: module, error: modError } = await api.addModule(courseId, "Dados Importados");
          if (modError) throw modError;
          const moduleId = module![0].id;

          // 3. Create Columns
          onProgress("Criando colunas...");
          const headers = jsonData[headerRowIndex];
          const columnMap: Record<number, string> = {}; // Index -> Column ID

          for (let i = 0; i < headers.length; i++) {
            const colName = headers[i]?.toString().trim();
            if (!colName) continue;
            
            // Skip "ALUNO" column creation, as it maps to the student entity
            if (colName.toUpperCase().includes('ALUNO') || colName.toUpperCase() === 'NOME') {
              continue;
            }

            const { data: colData } = await api.addColumn(moduleId, colName);
            if (colData && colData[0]) {
              columnMap[i] = colData[0].id;
            }
          }

          // 4. Process Rows (Students & Records)
          const studentNameIndex = headers.findIndex((h: any) => 
            h?.toString().toUpperCase().includes('ALUNO') || h?.toString().toUpperCase() === 'NOME'
          );

          if (studentNameIndex === -1) throw new Error("Coluna de Aluno não identificada.");

          const dataRows = jsonData.slice(headerRowIndex + 1);
          let processedCount = 0;
          let errors: string[] = [];

          for (const row of dataRows) {
            if (!row[studentNameIndex]) continue; // Skip empty names

            const studentName = row[studentNameIndex].toString().trim();
            processedCount++;
            onProgress(`Processando aluno ${processedCount}/${dataRows.length}: ${studentName}`);

            try {
                // Find or Create Student
                let studentId: string;
                
                // Try to find existing student by name to avoid duplicates
                const { data: existing } = await api.searchStudents(studentName);
                if (existing && existing.length > 0 && existing[0].name.toUpperCase() === studentName.toUpperCase()) {
                    studentId = existing[0].id;
                } else {
                    const { data: newStudent } = await api.addStudent(studentName, '', userId);
                    if (!newStudent) {
                        errors.push(`Falha ao criar aluno: ${studentName}`);
                        continue;
                    }
                    studentId = newStudent.id;
                }

                // Enroll
                const { data: enrollment } = await api.enrollStudent(courseId, studentId);
                let enrollmentId = enrollment && enrollment[0] ? enrollment[0].id : null;
                
                if(!enrollmentId) {
                    // Maybe already enrolled, try to fetch
                     const { data: existingEnroll } = await supabase.from('enrollments').select('id').eq('course_id', courseId).eq('student_id', studentId).single();
                     if(existingEnroll) enrollmentId = existingEnroll.id;
                }

                if(!enrollmentId) {
                     errors.push(`Falha ao matricular aluno: ${studentName}`);
                     continue;
                }

                // Insert Records
                for (let i = 0; i < row.length; i++) {
                    if (i === studentNameIndex) continue;
                    const columnId = columnMap[i];
                    const value = row[i] ? row[i].toString() : '';
                    
                    if (columnId && value) {
                        await api.saveRecord(enrollmentId, columnId, value);
                    }
                }
            } catch (innerErr: any) {
                console.error(innerErr);
                errors.push(`Erro ao processar ${studentName}: ${innerErr.message}`);
            }
          }

          onProgress("Concluído!");
          resolve({
              success: true,
              count: processedCount,
              errors: errors,
              termName,
              courseName
          });

        } catch (err: any) {
          reject(err);
        }
      };
      
      reader.readAsBinaryString(file);
    });
  }
};