import React, { useState, useEffect, useRef } from 'react';
import { SpreadsheetData } from '../types';
import { api } from '../services/api';
import { Save, Plus, UserPlus, FileSpreadsheet, Download, RefreshCw, GripVertical } from 'lucide-react';

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
  const [newColumnType, setNewColumnType] = useState<'text' | 'date' | 'check'>('text');

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

    // 2. Save
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
    const { data: student } = await api.addStudent(newStudentName, '', (await api.getTerms())?.data?.[0]?.user_id || ''); 
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
    try {
      await api.addColumn(moduleId, newColumnName, newColumnType);
      setNewColumnName('');
      setNewColumnType('text');
      setActiveModuleId(null);
      loadData();
    } catch (err) {
      alert("Erro ao adicionar coluna. Verifique se o banco de dados está atualizado.");
    }
  };
  
  const exportCSV = () => {
    if (!data) return;
    let csv = "Aluno";
    data.modules.forEach(m => {
        m.columns?.forEach(c => {
            csv += `,${m.name} - ${c.name}`;
        });
    });
    csv += "\n";
    data.enrollments.forEach(e => {
        csv += `"${e.student?.name || 'Desconhecido'}"`;
        data.modules.forEach(m => {
            m.columns?.forEach(c => {
                const val = data.records[`${e.id}_${c.id}`] || "";
                csv += `,${val.replace(/,/g, " ")}`; 
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
            <button onClick={onBack} className="text-slate-500 hover:text-slate-800 font-medium flex items-center gap-1 transition-colors">
              ← Voltar
            </button>
            <div className="h-6 w-px bg-slate-300"></div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <FileSpreadsheet size={20} className="text-blue-600"/>
                {data.course.name}
            </h2>
        </div>
        <div className="flex gap-2">
            <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-sm transition-all hover:-translate-y-0.5">
                <Download size={16} /> Exportar Planilha
            </button>
        </div>
      </div>

      {/* Inputs Bar */}
      <div className="p-4 bg-white border-b border-slate-200 flex flex-wrap gap-6 items-end">
         <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Novo Aluno</label>
            <div className="flex shadow-sm rounded-lg overflow-hidden">
                <input 
                  value={newStudentName}
                  onChange={e => setNewStudentName(e.target.value)}
                  placeholder="Nome Completo"
                  className="border border-r-0 border-slate-300 px-3 py-2 text-sm w-56 focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button onClick={handleAddStudent} className="bg-slate-800 text-white px-3 hover:bg-slate-700 transition-colors flex items-center">
                  <UserPlus size={18}/>
                </button>
            </div>
         </div>
         <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Novo Módulo (Livro/Assunto)</label>
            <div className="flex shadow-sm rounded-lg overflow-hidden">
                <input 
                  value={newModule}
                  onChange={e => setNewModule(e.target.value)}
                  placeholder="Ex: Pentateuco"
                  className="border border-slate-300 px-3 py-2 text-sm w-56 focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button onClick={handleAddModule} className="bg-blue-600 text-white px-3 hover:bg-blue-700 transition-colors flex items-center">
                  <Plus size={18}/>
                </button>
            </div>
         </div>
      </div>

      {/* The Spreadsheet */}
      <div className="flex-1 overflow-auto custom-scrollbar relative bg-slate-50/50">
        <table className="min-w-full border-collapse text-sm">
            <thead>
                {/* Module Header Row */}
                <tr>
                    <th className="sticky left-0 top-0 z-20 bg-slate-100 border border-slate-300 w-64 min-w-[200px] h-11"></th>
                    {data.modules.map(mod => (
                        <th key={mod.id} colSpan={mod.columns?.length || 1} className="sticky top-0 z-10 bg-slate-200 border border-slate-300 px-2 py-2 text-center text-slate-700 font-bold uppercase text-xs">
                            <div className="flex justify-between items-center group relative">
                                <span className="pl-4 w-full truncate">{mod.name}</span>
                                <button 
                                  onClick={() => setActiveModuleId(activeModuleId === mod.id ? null : mod.id)}
                                  className={`p-1 rounded transition-colors ${activeModuleId === mod.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-100'}`} 
                                  title="Adicionar Coluna"
                                >
                                    <Plus size={16}/>
                                </button>
                                
                                {/* Add Column Popup */}
                                {activeModuleId === mod.id && (
                                    <div className="absolute top-full right-0 bg-white shadow-2xl border border-slate-200 p-4 z-50 w-64 flex flex-col gap-3 rounded-xl mt-2 text-left animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                                        <div className="flex flex-col gap-1">
                                           <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nova Coluna em "{mod.name}"</span>
                                           <input 
                                             autoFocus
                                             placeholder="Nome (ex: Prova 1)" 
                                             className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full focus:ring-2 focus:ring-blue-500 outline-none font-normal"
                                             value={newColumnName}
                                             onChange={e => setNewColumnName(e.target.value)}
                                           />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                           <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tipo de Dado</span>
                                           <select 
                                               value={newColumnType}
                                               onChange={(e: any) => setNewColumnType(e.target.value)}
                                               className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full bg-white focus:ring-2 focus:ring-blue-500 outline-none font-normal"
                                           >
                                               <option value="text">Texto Livre (Padrão)</option>
                                               <option value="date">Data (Calendário)</option>
                                               <option value="check">Checkbox (Sim/Não)</option>
                                           </select>
                                        </div>
                                        <button 
                                          onClick={() => handleAddColumn(mod.id)}
                                          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-2 rounded-lg w-full transition-colors shadow-md mt-1"
                                        >
                                            Adicionar Coluna
                                        </button>
                                    </div>
                                )}
                            </div>
                        </th>
                    ))}
                    {data.modules.length === 0 && <th className="p-4 text-slate-400 font-normal italic bg-slate-50 border border-slate-200">Adicione um módulo acima para começar</th>}
                </tr>
                {/* Columns Header Row */}
                <tr>
                    <th className="sticky left-0 top-11 z-20 bg-slate-100 border border-slate-300 px-4 py-3 text-left font-bold text-slate-700 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)]">
                        <div className="flex items-center gap-2">
                           <UserPlus size={14} className="text-slate-400"/>
                           <span>Aluno</span>
                        </div>
                    </th>
                    {data.modules.map(mod => (
                        <>
                            {mod.columns?.length === 0 && <th className="bg-slate-50 border border-slate-300 min-w-[100px] text-xs text-slate-400 font-normal italic">Sem colunas</th>}
                            {mod.columns?.map(col => (
                                <th key={col.id} className="sticky top-11 z-10 bg-white border border-slate-300 px-2 py-3 min-w-[120px] text-center font-medium text-slate-600 text-xs shadow-sm">
                                    <div className="flex flex-col items-center gap-1">
                                        <span>{col.name}</span>
                                        {col.type !== 'text' && (
                                            <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${col.type === 'check' ? 'bg-purple-100 text-purple-600' : 'bg-orange-100 text-orange-600'}`}>
                                               {col.type === 'check' ? 'CHECKBOX' : 'DATA'}
                                            </span>
                                        )}
                                    </div>
                                </th>
                            ))}
                        </>
                    ))}
                </tr>
            </thead>
            <tbody>
                {data.enrollments.map((enrollment, idx) => (
                    <tr key={enrollment.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}>
                        <td className="sticky left-0 z-10 bg-inherit border border-slate-300 px-4 py-2 font-medium text-slate-800 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)] truncate max-w-[200px]" title={enrollment.student?.name}>
                            {enrollment.student?.name || 'Aluno Desconhecido'}
                        </td>
                        {data.modules.map(mod => (
                            <>
                                {mod.columns?.length === 0 && <td className="border border-slate-300 bg-slate-100/50"></td>}
                                {mod.columns?.map(col => {
                                    const key = `${enrollment.id}_${col.id}`;
                                    const val = data.records[key] || '';
                                    const isSaving = savingCells[key];
                                    
                                    // Custom visual indicators based on text
                                    let cellClass = "w-full bg-transparent outline-none text-center focus:bg-blue-50 transition-colors py-1.5 h-full";
                                    if (val.toUpperCase() === 'F') cellClass += " text-red-500 font-bold bg-red-50/50";
                                    else if (val.toUpperCase() === 'OK') cellClass += " text-emerald-600 font-bold bg-emerald-50/50";
                                    else if (val.includes('***')) cellClass += " text-orange-400 font-bold";

                                    return (
                                        <td key={col.id} className="border border-slate-300 p-0 relative h-10">
                                            {col.type === 'check' ? (
                                                 <div className="flex justify-center items-center h-full py-1 hover:bg-slate-50 transition-colors">
                                                     <input 
                                                        type="checkbox"
                                                        checked={val === 'true'}
                                                        onChange={(e) => handleCellChange(enrollment.id, col.id, e.target.checked ? 'true' : 'false')}
                                                        className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                                                     />
                                                 </div>
                                            ) : (
                                                <input 
                                                    type={col.type === 'date' ? 'date' : 'text'}
                                                    className={cellClass}
                                                    value={val}
                                                    onChange={(e) => handleCellChange(enrollment.id, col.id, e.target.value)}
                                                    placeholder={col.type === 'date' ? '' : '-'}
                                                />
                                            )}
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
            <div className="flex flex-col items-center justify-center p-20 text-slate-400 bg-white m-4 rounded-xl border border-dashed border-slate-200">
                <UserPlus size={48} className="text-slate-200 mb-4"/>
                <p>Nenhum aluno matriculado nesta turma.</p>
                <p className="text-sm">Adicione alunos acima para começar.</p>
            </div>
        )}
      </div>
    </div>
  );
};