import React, { useState } from 'react';
import { AppState } from '../types';
import { Book, ArrowRightLeft, Calendar, Loader2 } from 'lucide-react';
import { api } from '../services/api';

interface Props {
  data: AppState;
  updateData: (newData: Partial<AppState>) => void;
}

export const BooksPage: React.FC<Props> = ({ data, updateData }) => {
  const [view, setView] = useState<'inventory' | 'delivery'>('inventory');
  const [submitting, setSubmitting] = useState(false);
  
  // Delivery Form State
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedBookId, setSelectedBookId] = useState('');
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);
  const [transactionType, setTransactionType] = useState<'delivery' | 'return'>('delivery');

  const handleTransaction = async () => {
    if(!selectedStudentId || !selectedBookId || !transactionDate) return;
    setSubmitting(true);

    try {
      await api.createTransaction({
        studentId: selectedStudentId,
        bookId: selectedBookId,
        type: transactionType,
        date: transactionDate
      });

      // Optimistic Update
      const newTx = {
         id: 'temp-' + Date.now(),
         studentId: selectedStudentId,
         bookId: selectedBookId,
         type: transactionType,
         date: transactionDate
      };

      updateData({
        transactions: [...data.transactions, newTx]
      });

      alert('Movimentação registrada com sucesso!');
      setSelectedBookId('');
      setSelectedStudentId('');
    } catch (err) {
      console.error(err);
      alert('Erro ao registrar transação.');
    } finally {
      setSubmitting(false);
    }
  };

  const getFilteredStudents = () => {
    if (!selectedCourseId) return [];
    return data.students.filter(s => s.courseId === selectedCourseId);
  };

  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
         <h2 className="text-2xl font-bold text-slate-800">Livros e Materiais</h2>
         <div className="flex bg-slate-100 p-1 rounded-lg">
           <button 
            onClick={() => setView('inventory')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${view === 'inventory' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
           >
             Estoque
           </button>
           <button 
            onClick={() => setView('delivery')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${view === 'delivery' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
           >
             Entregas e Devoluções
           </button>
         </div>
       </div>

       {view === 'inventory' && (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.books.map(book => {
               const delivered = data.transactions.filter(t => t.bookId === book.id && t.type === 'delivery').length;
               const returned = data.transactions.filter(t => t.bookId === book.id && t.type === 'return').length;
               const currentlyOut = delivered - returned;
               const available = book.stock - currentlyOut;

               return (
                 <div key={book.id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between h-full">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <span className="bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded font-medium">{book.code}</span>
                        <span className="text-xs text-slate-400">{book.category}</span>
                      </div>
                      <h3 className="font-bold text-lg text-slate-800 mb-1">{book.title}</h3>
                      <p className="text-sm text-slate-500 mb-4">{book.author}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm mt-4 pt-4 border-t border-slate-100">
                       <div className="bg-blue-50 p-2 rounded text-center">
                          <span className="block font-bold text-blue-700 text-lg">{available}</span>
                          <span className="text-blue-600 text-xs">Disponível</span>
                       </div>
                       <div className="bg-orange-50 p-2 rounded text-center">
                          <span className="block font-bold text-orange-700 text-lg">{currentlyOut}</span>
                          <span className="text-orange-600 text-xs">Em Uso</span>
                       </div>
                    </div>
                 </div>
               )
            })}
         </div>
       )}

       {view === 'delivery' && (
         <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <ArrowRightLeft className="text-blue-600" size={24}/>
              Registrar Movimentação
            </h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                 <button 
                  onClick={() => setTransactionType('delivery')}
                  className={`py-3 px-4 rounded-lg border-2 font-medium text-sm text-center transition-all ${transactionType === 'delivery' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                 >
                   Entregar Livro
                 </button>
                 <button 
                  onClick={() => setTransactionType('return')}
                  className={`py-3 px-4 rounded-lg border-2 font-medium text-sm text-center transition-all ${transactionType === 'return' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                 >
                   Receber Devolução
                 </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Turma</label>
                <select 
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  value={selectedCourseId}
                  onChange={(e) => { setSelectedCourseId(e.target.value); setSelectedStudentId(''); }}
                >
                  <option value="">Selecione a turma...</option>
                  {data.courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Aluno</label>
                <select 
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  disabled={!selectedCourseId}
                >
                  <option value="">Selecione o aluno...</option>
                  {getFilteredStudents().map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Livro</label>
                <select 
                   className="w-full border border-slate-300 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                   value={selectedBookId}
                   onChange={(e) => setSelectedBookId(e.target.value)}
                >
                  <option value="">Selecione o livro...</option>
                  {data.books.map(b => <option key={b.id} value={b.id}>{b.code} - {b.title}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Data</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 text-slate-400" size={18}/>
                  <input 
                    type="date" 
                    value={transactionDate}
                    onChange={(e) => setTransactionDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 pl-10 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <button 
                onClick={handleTransaction}
                disabled={!selectedStudentId || !selectedBookId || submitting}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 rounded-lg mt-4 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="animate-spin" size={20} />}
                {transactionType === 'delivery' ? 'Confirmar Entrega' : 'Confirmar Devolução'}
              </button>

            </div>
         </div>
       )}
    </div>
  );
};