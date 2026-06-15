import React, { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { DEFAULT_FILTER_CONFIG, CATEGORY_LABELS, STORAGE_KEY, FilterOption } from '@/lib/filterConfig';

const COLORS = [
  { v: 'blue', n: '蓝' }, { v: 'amber', n: '琥珀' }, { v: 'green', n: '绿' },
  { v: 'red', n: '红' }, { v: 'purple', n: '紫' }, { v: 'pink', n: '粉' },
  { v: 'cyan', n: '青' }, { v: 'yellow', n: '黄' }, { v: 'gray', n: '灰' },
  { v: 'indigo', n: '靛' }, { v: 'teal', n: '青绿' }, { v: 'emerald', n: '翠' },
  { v: 'orange', n: '橙' }, { v: 'violet', n: '紫罗兰' }, { v: 'rose', n: '玫瑰' },
  { v: 'slate', n: '石板' }, { v: 'lime', n: '石灰' }, { v: 'stone', n: '石' },
  { v: 'sky', n: '天蓝' }, { v: 'fuchsia', n: '紫红' },
];

export default function SystemConfigPage() {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <div className="p-10 text-center text-muted-foreground">仅管理员可访问</div>;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6">
        <h2 className="text-xl font-bold mb-1">系统配置 - 编辑筛选字段</h2>
        <p className="text-sm text-muted-foreground mb-5">
          以下展示的是左侧筛选面板当前使用的所有字段和选项。可以编辑、删除、新增。
          <span className="text-orange-500 ml-2">⚠ 修改后刷新页面即刻生效。</span>
        </p>
        <ConfigManager />
      </div>
    </div>
  );
}

function ConfigManager() {
  const [activeTab, setActiveTab] = useState('supplierType');
  const [config, setConfig] = useState<Record<string, FilterOption[]>>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : DEFAULT_FILTER_CONFIG;
  });

  const saveConfig = (newConfig: Record<string, FilterOption[]>) => {
    setConfig(newConfig);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
  };

  const items = config[activeTab] || [];
  const isStyle = activeTab === 'style';
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editValue, setEditValue] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newColor, setNewColor] = useState('');

  const startEdit = (idx: number, item: FilterOption) => {
    setEditingIdx(idx); setEditLabel(item.label); setEditValue(item.value);
  };

  const saveEdit = () => {
    if (editingIdx === null || !editLabel.trim()) return;
    const newItems = [...items];
    newItems[editingIdx] = { ...newItems[editingIdx], label: editLabel.trim(), value: editValue.trim() };
    saveConfig({ ...config, [activeTab]: newItems });
    setEditingIdx(null);
  };

  const addItem = () => {
    if (!newLabel.trim() || !newValue.trim()) return;
    const item: FilterOption = { label: newLabel.trim(), value: newValue.trim() };
    if (newColor) item.color = newColor;
    saveConfig({ ...config, [activeTab]: [...items, item] });
    setNewLabel(''); setNewValue(''); setNewColor('');
  };

  const deleteItem = (idx: number) => {
    const newItems = items.filter((_, i) => i !== idx);
    saveConfig({ ...config, [activeTab]: newItems });
  };

  const setColor = (idx: number, color: string) => {
    const newItems = [...items];
    newItems[idx] = { ...newItems[idx], color: color || undefined };
    saveConfig({ ...config, [activeTab]: newItems });
  };

  const resetToDefault = () => {
    if (confirm('确认恢复到默认配置？')) {
      localStorage.removeItem(STORAGE_KEY);
      setConfig(DEFAULT_FILTER_CONFIG);
    }
  };

  return (
    <div>
      <div className="flex gap-1 mb-5 flex-wrap items-center">
        {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${activeTab === key ? 'bg-primary text-primary-foreground' : 'bg-white border border-border hover:bg-muted'}`}>
            {label}
          </button>
        ))}
        <button onClick={resetToDefault} className="ml-auto px-3 py-1.5 rounded-md text-sm border border-red-200 text-red-600 hover:bg-red-50">
          恢复默认
        </button>
      </div>

      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-3 bg-white border border-border rounded-lg px-4 py-2.5">
            {isStyle && (
              <div className="flex items-center gap-1 shrink-0">
                {COLORS.slice(0, 10).map(c => (
                  <button key={c.v} onClick={() => setColor(idx, c.v)}
                    className={`w-4 h-4 rounded-full bg-${c.v}-500 transition-transform hover:scale-125 ${item.color === c.v ? 'ring-2 ring-offset-1 ring-primary scale-125' : 'opacity-40 hover:opacity-80'}`}
                    title={c.n} />
                ))}
              </div>
            )}

            <div className="flex-1 min-w-0 flex items-center gap-2">
              {editingIdx === idx ? (
                <>
                  <input value={editLabel} onChange={e => setEditLabel(e.target.value)} className="border border-primary rounded px-2 py-1 text-sm w-28" placeholder="标签名" autoFocus />
                  <input value={editValue} onChange={e => setEditValue(e.target.value)} className="border border-primary rounded px-2 py-1 text-sm w-36" placeholder="值" />
                  <button onClick={saveEdit} className="px-2 py-1 bg-primary text-white rounded text-xs font-medium">保存</button>
                  <button onClick={() => setEditingIdx(null)} className="px-2 py-1 border rounded text-xs">取消</button>
                </>
              ) : (
                <>
                  <span className="text-sm font-medium text-foreground">{item.label}</span>
                  <span className="text-xs text-muted-foreground">({item.value})</span>
                  {item.color && <span className="text-[10px] bg-muted px-1 rounded">{item.color}</span>}
                  <button onClick={() => startEdit(idx, item)} className="ml-auto px-2 py-1 bg-primary text-white rounded text-xs font-medium hover:opacity-80">
                    编辑
                  </button>
                  <button onClick={() => deleteItem(idx)} className="px-2 py-1 border border-red-200 text-red-600 rounded text-xs hover:bg-red-50">
                    删除
                  </button>
                </>
              )}
            </div>
          </div>
        ))}

        {items.length === 0 && <div className="text-center py-8 text-muted-foreground bg-white rounded-lg border">暂无数据</div>}

        <div className="flex items-center gap-2 bg-white border-2 border-dashed border-primary/30 rounded-lg px-4 py-3">
          <input placeholder="标签名" value={newLabel} onChange={e => setNewLabel(e.target.value)} className="border rounded px-2 py-1 text-sm w-28" />
          <input placeholder="值" value={newValue} onChange={e => setNewValue(e.target.value)} className="border rounded px-2 py-1 text-sm w-36" />
          {isStyle && (
            <select value={newColor} onChange={e => setNewColor(e.target.value)} className="border rounded px-2 py-1 text-sm">
              <option value="">颜色</option>
              {COLORS.map(c => <option key={c.v} value={c.v}>{c.n}</option>)}
            </select>
          )}
          <button onClick={addItem} className="px-3 py-1 bg-primary text-white rounded text-sm font-medium hover:opacity-80">
            + 新增
          </button>
        </div>
      </div>
    </div>
  );
}