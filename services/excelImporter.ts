import * as XLSX from 'xlsx';
import { api } from './api';

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
          
          // Generate Array of Arrays (robust mode)
          const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

          if (!jsonData || jsonData.length < 2) throw new Error("Arquivo vazio ou formato inválido.");

          // 1. Intelligent Structure Detection
          onProgress("Analisando estrutura do arquivo...");
          
          let headerRowIndex = -1;
          let maxScore = 0;
          
          // Scan first 40 rows to find the best header candidate
          const limit = Math.min(jsonData.length, 40);
          for (let i = 0; i < limit; i++) {
            const row = jsonData[i];
            if (!row || !Array.isArray(row)) continue; // Safety check

            const rowStr = row.map(c => c?.toString().toUpperCase() || '').join(' ');
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

          // Determine Title from context
          let titleRow = "Nova Turma Importada";
          // Safety Check: ensure row exists before accessing [0]
          if (headerRowIndex > 0 && jsonData[headerRowIndex - 1] && jsonData[headerRowIndex - 1][0]) {
              titleRow = jsonData[headerRowIndex - 1][0].toString();
          } else if (jsonData[0] && jsonData[0][0]) {
              titleRow = jsonData[0][0].toString();
          }
          
          const courseName = titleRow.length > 50 ? titleRow.substring(0, 50) + '...' : titleRow;
          const termName = "Importado " + new Date().toLocaleDateString('pt-BR');

          // 2. Create DB Structure (API Safety Checks)
          onProgress(`Criando Turma: ${courseName}...`);
          
          const termRes = await api.createTerm(termName, userId);
          if (!termRes.data || termRes.data.length === 0) throw new Error("Falha ao criar Período no banco de dados.");
          const termId = termRes.data[0].id;

          const courseRes = await api.createCourse(termId, courseName);
          if (!courseRes.data || courseRes.data.length === 0) throw new Error("Falha ao criar Turma no banco de dados.");
          const courseId = courseRes.data[0].id;
          
          const moduleRes = await api.addModule(courseId, "Dados Gerais");
          if (!moduleRes.data || moduleRes.data.length === 0) throw new Error("Falha ao criar Módulo padrão.");
          const moduleId = moduleRes.data[0].id;

          // 3. Create Columns
          onProgress("Criando colunas...");
          const headers = jsonData[headerRowIndex] || [];
          const columnMap: Record<number, string> = {}; // Index -> Column ID

          for (let i = 0; i < headers.length; i++) {
            let colName = headers[i]?.toString().trim();
            if (!colName) continue;
            
            // Clean up name
            colName = colName.replace(/\r?\n|\r/g, ' '); 

            // Skip identification columns
            if (colName.toUpperCase().includes('ALUNO') || colName.toUpperCase() === 'NOME') continue;
            if (colName.toUpperCase() === 'N°' || colName === '#' || colName === 'ID') continue;

            // Safe API call inside loop
            const colRes = await api.addColumn(moduleId, colName);
            if (colRes.data && colRes.data.length > 0) {
              columnMap[i] = colRes.data[0].id;
            }
          }

          // 4. Process Rows (Robust Iteration)
          const studentNameIndex = headers.findIndex((h: any) => 
            h?.toString().toUpperCase().includes('ALUNO') || h?.toString().toUpperCase() === 'NOME'
          );

          if (studentNameIndex === -1) throw new Error("Coluna de Aluno não encontrada.");

          // Slice safely
          const dataRows = jsonData.slice(headerRowIndex + 1);
          let processedCount = 0;
          let errors: string[] = [];
          const studentsToEnroll = [];

          for (const row of dataRows) {
            // CRITICAL: Safety Checks for Row validity
            if (!row || !Array.isArray(row)) continue; 
            
            // Check specific cell existence before access
            const rawNameCell = row[studentNameIndex];
            if (!rawNameCell) continue;

            const rawName = rawNameCell.toString().trim();
            
            // Logic filters
            if (rawName.length < 3) continue;
            if (rawName.toUpperCase() === 'ALUNO' || rawName.toUpperCase() === 'NOME') continue;
            if (rawName.includes('TRIMESTRE') || rawName.includes('TEOLOGIA') || rawName.includes('IBICAMP')) continue;

            processedCount++;
            onProgress(`Processando (${processedCount}): ${rawName}`);

            try {
                // Find or Create Student
                const studentRes = await api.addStudent(rawName, '', userId);
                const student = studentRes.data;
                
                if (!student) {
                    errors.push(`Erro ao criar aluno: ${rawName}`);
                    continue;
                }

                // Enroll
                const enrollRes = await api.enrollStudent(courseId, student.id);
                // Handle cases where enrollment already exists or is created
                const enrollmentId = enrollRes.data?.[0]?.id;

                if (!enrollmentId) {
                    errors.push(`Erro ao matricular: ${rawName}`);
                    continue;
                }

                // Prepare records for this student
                const studentRecords = [];
                for (let i = 0; i < row.length; i++) {
                    if (i === studentNameIndex) continue;
                    
                    const columnId = columnMap[i];
                    // Safe value access
                    const cellValue = row[i];
                    const value = (cellValue !== undefined && cellValue !== null) ? cellValue.toString().trim() : '';
                    
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
                errors.push(`Falha em ${rawName}: ${innerErr.message || 'Erro desconhecido'}`);
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
          console.error("Erro fatal na importação:", err);
          reject(new Error(err.message || "Erro desconhecido durante o processamento do arquivo."));
        }
      };
      
      reader.readAsBinaryString(file);
    });
  }
};