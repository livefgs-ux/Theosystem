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

          // 1. Intelligent Structure Detection
          onProgress("Analisando estrutura do arquivo...");
          
          let headerRowIndex = -1;
          let maxScore = 0;
          
          // Scan first 30 rows to find the best header candidate
          for (let i = 0; i < Math.min(jsonData.length, 30); i++) {
            const rowStr = jsonData[i].map(c => c?.toString().toUpperCase() || '').join(' ');
            let score = 0;
            if (rowStr.includes('ALUNO')) score += 10;
            if (rowStr.includes('NOME')) score += 5;
            if (rowStr.includes('LIVRO')) score += 2;
            if (rowStr.includes('AULA')) score += 2;
            if (rowStr.includes('PROVA')) score += 2;
            
            if (score > maxScore) {
                maxScore = score;
                headerRowIndex = i;
            }
          }

          if (headerRowIndex === -1) throw new Error("Não foi possível identificar a linha de cabeçalho (procurei por 'ALUNO' ou 'NOME').");

          // Determine Title from context (usually row above header or row 0)
          let titleRow = "Nova Turma Importada";
          if (headerRowIndex > 0 && jsonData[headerRowIndex - 1][0]) {
              titleRow = jsonData[headerRowIndex - 1][0].toString();
          } else if (jsonData[0][0]) {
              titleRow = jsonData[0][0].toString();
          }
          
          const courseName = titleRow.length > 50 ? titleRow.substring(0, 50) + '...' : titleRow;
          const termName = "Importado " + new Date().toLocaleDateString('pt-BR');

          // 2. Create DB Structure
          onProgress(`Criando Turma: ${courseName}...`);
          
          const { data: term } = await api.createTerm(termName, userId);
          const termId = term![0].id;
          const { data: course } = await api.createCourse(termId, courseName);
          const courseId = course![0].id;
          const { data: module } = await api.addModule(courseId, "Dados Gerais");
          const moduleId = module![0].id;

          // 3. Create Columns
          onProgress("Criando colunas...");
          const headers = jsonData[headerRowIndex];
          const columnMap: Record<number, string> = {}; // Index -> Column ID

          for (let i = 0; i < headers.length; i++) {
            let colName = headers[i]?.toString().trim();
            if (!colName) continue;
            
            // Clean up name
            colName = colName.replace(/\r?\n|\r/g, ' '); 

            // Identify Student Column
            if (colName.toUpperCase().includes('ALUNO') || colName.toUpperCase() === 'NOME') {
              continue; // Don't create a column for the student name itself
            }
            // Ignore generic index columns
            if (colName.toUpperCase() === 'N°' || colName === '#' || colName === 'ID') {
                continue;
            }

            const { data: colData } = await api.addColumn(moduleId, colName);
            if (colData && colData[0]) {
              columnMap[i] = colData[0].id;
            }
          }

          // 4. Process Rows (Bulk Insert Mode)
          const studentNameIndex = headers.findIndex((h: any) => 
            h?.toString().toUpperCase().includes('ALUNO') || h?.toString().toUpperCase() === 'NOME'
          );

          if (studentNameIndex === -1) throw new Error("Coluna de Aluno não encontrada.");

          const dataRows = jsonData.slice(headerRowIndex + 1);
          let processedCount = 0;
          let errors: string[] = [];

          for (const row of dataRows) {
            // Robustness: Skip rows that look like repeated headers or empty
            if (!row[studentNameIndex]) continue;
            
            const rawName = row[studentNameIndex].toString().trim();
            if (rawName.toUpperCase() === 'ALUNO' || rawName.toUpperCase() === 'NOME' || rawName.length < 3) continue;

            // Also skip if it looks like a summary row (e.g., "1° TRIMESTRE" inside the name col)
            if (rawName.includes('TRIMESTRE') || rawName.includes('TEOLOGIA')) continue;

            processedCount++;
            onProgress(`Importando (${processedCount}): ${rawName}`);

            try {
                // Find or Create Student
                const { data: student } = await api.addStudent(rawName, '', userId);
                if (!student) {
                    errors.push(`Erro ao criar: ${rawName}`);
                    continue;
                }

                // Enroll
                const { data: enrollmentData } = await api.enrollStudent(courseId, student.id);
                const enrollmentId = enrollmentData?.[0]?.id;

                if (!enrollmentId) {
                    errors.push(`Erro matrícula: ${rawName}`);
                    continue;
                }

                // Prepare records for this student
                const studentRecords = [];
                for (let i = 0; i < row.length; i++) {
                    if (i === studentNameIndex) continue;
                    const columnId = columnMap[i];
                    const value = row[i] !== undefined ? row[i].toString().trim() : '';
                    
                    if (columnId && value) {
                        studentRecords.push({
                            enrollment_id: enrollmentId,
                            column_id: columnId,
                            value: value
                        });
                    }
                }

                // Bulk Save Records
                if (studentRecords.length > 0) {
                    await api.saveRecordsBatch(studentRecords);
                }

            } catch (innerErr: any) {
                console.warn(innerErr);
                errors.push(`Falha em ${rawName}: ${innerErr.message}`);
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