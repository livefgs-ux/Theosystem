import React, { useState, useEffect, useRef } from 'react';
import { SpreadsheetData } from '../types';
import { api } from '../services/api';
import { Save, Plus, UserPlus, FileSpreadsheet, Download, RefreshCw } from 'lucide-react';

interface Props {
  courseId: string;
  onBack: () => void;
}

export const Spreadsheet: React.FC<Props> = ({ courseId, onBack }) => {
  const [data, setData] = useState<SpreadsheetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingCells, setSavingCells] = useState<Record<string, boolean>>({});
  
  // Modal / Input states
  const [newStudentName, setNewStudentName] = useState('');
  const [newModule, setNewModule] = useState('');
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [newColumnName, setNewColumnName] = useState('');

  useEffect(() => {
    loadData();
  }, [courseId]);

  const loadData = async () => {
    setLoading(true);
    const res = await api.getSpreadsheetData(courseId);
    setData(res);
    setLoading(false);
  };

  const handleCellChange = async (enrollmentId: string, columnId: string, value: string) => {
    // 1. Optimistic Update
    const key = `${enrollmentId}_${columnId}`;
    setData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        records: { ...prev.records, [key]: value }
      };
    });

    // 2. Debounced Save (simplified here to direct save for robustness)
    setSavingCells(prev => ({ ...prev, [key]: true }));
    try {
      await api.saveRecord(enrollmentId, columnId, value);
    } catch (e) {
      console.error("Save failed", e);
    } finally {
      setTimeout(() => {
        setSavingCells(prev => ({ ...prev, [key]: false }));
      }, 500);
    }
  };

  const handleAddStudent = async () => {
    if (!newStudentName || !data) return;
    // For simplicity, creating a new student and enrolling immediately
    // In a real app, you'd search existing students first
    const { data: student } = await api.addStudent(newStudentName, '', (await api.getTerms())?.data?.[0]?.user_id || ''); // This needs user_id, hack for now or use context
    if (student) {
        await api.enrollStudent(courseId, student.id);
        setNewStudentName('');
        loadData();
    }
  };

  const handleAddModule = async () => {
    if (!newModule) return;
    await api.addModule(courseId, newModule);
    setNewModule('');
    loadData();
  };

  const handleAddColumn = async (moduleId: string) => {
    if (!newColumnName) return;
    await api.addColumn(moduleId, newColumnName);
    setNewColumnName('');
    setActiveModuleId(null);
    loadData();
  };
  
  const exportCSV = () => {
    if (!data) return;
    let csv = "Aluno";
    
    // Header
    data.modules.forEach(m => {
        m.columns?.forEach(c => {
            csv += `,${m.name} - ${c.name}`;
        });
    });
    csv += "\n";

    // Rows
    data.enrollments.forEach(e => {
        csv += `"${e.student.name}"`;
        data.modules.forEach(m => {
            m.columns?.forEach(c => {
                const val = data.records[`${e.id}_${c.id}`] || "";
                csv += `,${val.replace(/,/g, " ")}`; // simple escape
            });
        });
        csv += "\n";
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Planilha_${data.course.name}.csv`;
    a.click();
  };

  if (loading) return <div className="flex justify-center p-12"><RefreshCw className="animate-spin text-blue-600"/></div>;
  if (!data) return <div>Erro ao carregar dados.</div>;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white shadow-xl rounded-lg border border-slate-200">
      {/* Toolbar */}
      <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
        <div className="flex items-center gap-4">
            <button onClick={onBack} className="text-slate-500 hover:text-slate-800 font-medium">← Voltar</button>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <FileSpreadsheet size={20} className="text-blue-600"/>
                {data.course.name}
            </h2>
        </div>
        <div className="flex gap-2">
            <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700">
                <Download size={14} /> Exportar
            </button>
        </div>
      </div>

      {/* Inputs Bar */}
      <div className="p-4 bg-white border-b border-slate-200 flex flex-wrap gap-4 items-end">
         <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Adicionar Aluno</label>
            <div className="flex">
                <input 
                  value={newStudentName}
                  onChange={e => setNewStudentName(e.target.value)}
                  placeholder="Nome Completo"
                  className="border border-slate-300 rounded-l px-2 py-1 text-sm w-48 focus:outline-blue-500"
                />
                <button onClick={handleAddStudent} className="bg-slate-800 text-white px-3 rounded-r hover:bg-slate-700"><Plus size={16}/></button>
            </div>
         </div>
         <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Novo Livro/Módulo</label>
            <div className="flex">
                <input 
                  value={newModule}
                  onChange={e => setNewModule(e.target.value)}
                  placeholder="Ex: Pentateuco"
                  className="border border-slate-300 rounded-l px-2 py-1 text-sm w-48 focus:outline-blue-500"
                />
                <button onClick={handleAddModule} className="bg-blue-600 text-white px-3 rounded-r hover:bg-blue-700"><Plus size={16}/></button>
            </div>
         </div>
      </div>

      {/* The Spreadsheet */}
      <div className="flex-1 overflow-auto custom-scrollbar relative">
        <table className="min-w-full border-collapse text-sm">
            <thead>
                {/* Module Header Row */}
                <tr>
                    <th className="sticky left-0 top-0 z-20 bg-slate-100 border border-slate-300 w-64 min-w-[200px] h-10"></th>
                    {data.modules.map(mod => (
                        <th key={mod.id} colSpan={mod.columns?.length || 1} className="sticky top-0 z-10 bg-slate-200 border border-slate-300 px-2 py-2 text-center text-slate-700 font-bold uppercase text-xs">
                            <div className="flex justify-between items-center">
                                <span>{mod.name}</span>
                                <button 
                                  onClick={() => setActiveModuleId(activeModuleId === mod.id ? null : mod.id)}
                                  className="text-slate-500 hover:text-blue-600 px-1" title="Adicionar Coluna"
                                >
                                    <Plus size={14}/>
                                </button>
                            </div>
                            {/* Add Column Popup */}
                            {activeModuleId === mod.id && (
                                <div className="absolute top-full left-0 bg-white shadow-xl border border-slate-300 p-2 z-50 w-48 flex flex-col gap-2 rounded">
                                    <input 
                                      autoFocus
                                      placeholder="Nome da Coluna" 
                                      className="border px-2 py-1 text-xs w-full"
                                      value={newColumnName}
                                      onChange={e => setNewColumnName(e.target.value)}
                                    />
                                    <button 
                                      onClick={() => handleAddColumn(mod.id)}
                                      className="bg-blue-600 text-white text-xs py-1 rounded w-full"
                                    >Adicionar</button>
                                </div>
                            )}
                        </th>
                    ))}
                    {data.modules.length === 0 && <th className="p-4 text-slate-400 font-normal italic">Adicione um módulo acima</th>}
                </tr>
                {/* Columns Header Row */}
                <tr>
                    <th className="sticky left-0 top-10 z-20 bg-slate-100 border border-slate-300 px-4 py-2 text-left font-bold text-slate-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                        Aluno
                    </th>
                    {data.modules.map(mod => (
                        <>
                            {mod.columns?.length === 0 && <th className="bg-slate-50 border border-slate-300 min-w-[100px]"></th>}
                            {mod.columns?.map(col => (
                                <th key={col.id} className="sticky top-10 z-10 bg-slate-100 border border-slate-300 px-2 py-2 min-w-[100px] text-center font-medium text-slate-600 text-xs">
                                    {col.name}
                                </th>
                            ))}
                        </>
                    ))}
                </tr>
            </thead>
            <tbody>
                {data.enrollments.map((enrollment, idx) => (
                    <tr key={enrollment.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="sticky left-0 z-10 bg-inherit border border-slate-300 px-4 py-2 font-medium text-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] truncate max-w-[200px]" title={enrollment.student.name}>
                            {enrollment.student.name}
                        </td>
                        {data.modules.map(mod => (
                            <>
                                {mod.columns?.length === 0 && <td className="border border-slate-300 bg-slate-100/50"></td>}
                                {mod.columns?.map(col => {
                                    const key = `${enrollment.id}_${col.id}`;
                                    const val = data.records[key] || '';
                                    const isSaving = savingCells[key];
                                    
                                    // Custom visual indicators based on text
                                    let cellClass = "w-full bg-transparent outline-none text-center focus:bg-blue-50 transition-colors";
                                    if (val.toUpperCase() === 'F') cellClass += " text-red-500 font-bold";
                                    else if (val.toUpperCase() === 'OK') cellClass += " text-emerald-600 font-bold";
                                    else if (val.includes('***')) cellClass += " text-orange-400 font-bold";

                                    return (
                                        <td key={col.id} className="border border-slate-300 p-0 relative">
                                            <input 
                                                className={cellClass}
                                                value={val}
                                                onChange={(e) => handleCellChange(enrollment.id, col.id, e.target.value)}
                                            />
                                            {isSaving && <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping"></div>}
                                        </td>
                                    );
                                })}
                            </>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
        {data.enrollments.length === 0 && (
            <div className="text-center p-12 text-slate-400">
                Nenhum aluno matriculado nesta turma.
            </div>
        )}
      </div>
    </div>
  );
};