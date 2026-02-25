import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save } from 'lucide-react';
import { Family, COUNTRIES } from '../types';

interface SettingsModalProps {
  ledgerName: string;
  families: Family[];
  destination: string;
  onSave: (ledgerName: string, families: Family[], destination: string, currency: string) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ ledgerName, families, destination, onSave, onClose }) => {
  const [localLedgerName, setLocalLedgerName] = useState(ledgerName);
  const [localFamilies, setLocalFamilies] = useState<Family[]>(families);
  const [localDestination, setLocalDestination] = useState(destination);

  useEffect(() => {
    setLocalLedgerName(ledgerName);
    setLocalFamilies(families);
    setLocalDestination(destination);
  }, [ledgerName, families, destination]);

  const handleDestinationChange = (newDest: string) => {
    setLocalDestination(newDest);
    // Auto-update ledger name if it follows the pattern or is default
    if (localLedgerName.includes('旅行账本') || localLedgerName === '新建账本' || localLedgerName.includes('分账本')) {
      setLocalLedgerName(`${newDest}旅行账本`);
    }
  };

  const handleAddFamily = () => {
    if (localFamilies.length >= 5) return;
    const newId = `f${Date.now()}`;
    setLocalFamilies([...localFamilies, { id: newId, name: `家庭 ${localFamilies.length + 1}`, count: 2 }]);
  };

  const handleRemoveFamily = (id: string) => {
    if (localFamilies.length <= 2) return;
    setLocalFamilies(localFamilies.filter(f => f.id !== id));
  };

  const handleUpdateFamily = (id: string, field: 'name' | 'count', value: string | number) => {
    setLocalFamilies(localFamilies.map(f => f.id === id ? { ...f, [field]: value } : f));
  };

  const handleSave = () => {
    const country = COUNTRIES.find(c => c.name === localDestination);
    const currency = country ? country.currency : 'IDR';
    onSave(localLedgerName, localFamilies, localDestination, currency);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-4 border-b flex justify-between items-center bg-teal-600 text-white">
          <h2 className="font-semibold text-lg">账本设置</h2>
          <button onClick={onClose} className="p-1 hover:bg-teal-700 rounded-full">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Ledger Name */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">账本名称</label>
            <input 
              type="text" 
              value={localLedgerName}
              onChange={(e) => setLocalLedgerName(e.target.value)}
              className="w-full p-3 border rounded-xl bg-gray-50 focus:ring-2 focus:ring-teal-500 outline-none"
              placeholder="例如：巴厘岛旅行账本"
            />
          </div>

          {/* Destination */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">旅行目的地</label>
            <select 
              value={localDestination} 
              onChange={(e) => handleDestinationChange(e.target.value)}
              className="w-full p-3 border rounded-xl bg-gray-50 focus:ring-2 focus:ring-teal-500 outline-none"
            >
              {COUNTRIES.map(c => (
                <option key={c.name} value={c.name}>{c.name} ({c.currency})</option>
              ))}
            </select>
          </div>

          {/* Families */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-bold text-gray-700">参与家庭 (2-5个)</label>
              {localFamilies.length < 5 && (
                <button onClick={handleAddFamily} className="text-teal-600 text-sm font-medium flex items-center gap-1">
                  <Plus size={16} /> 添加家庭
                </button>
              )}
            </div>
            
            <div className="space-y-3">
              {localFamilies.map((f, index) => (
                <div key={f.id} className="flex gap-2 items-center">
                  <div className="flex-1">
                    <input 
                      type="text" 
                      value={f.name}
                      onChange={(e) => handleUpdateFamily(f.id, 'name', e.target.value)}
                      className="w-full p-2 border rounded-lg text-sm"
                      placeholder="家庭名称"
                    />
                  </div>
                  <div className="w-20">
                    <input 
                      type="number" 
                      min="1"
                      value={f.count}
                      onChange={(e) => handleUpdateFamily(f.id, 'count', parseInt(e.target.value) || 1)}
                      className="w-full p-2 border rounded-lg text-sm text-center"
                    />
                  </div>
                  <div className="w-8 flex justify-center">
                    {localFamilies.length > 2 && (
                      <button onClick={() => handleRemoveFamily(f.id)} className="text-red-400 hover:text-red-600">
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">提示：结算时将按照列表顺序进行配对。</p>
          </div>
        </div>

        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-200 rounded-xl">取消</button>
          <button onClick={handleSave} className="px-8 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl flex items-center gap-2">
            <Save size={18} /> 保存设置
          </button>
        </div>
      </div>
    </div>
  );
};
