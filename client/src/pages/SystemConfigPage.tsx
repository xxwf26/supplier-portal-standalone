import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { CATEGORY_LABELS } from '@/lib/filterConfig';
import { configApi, IFilterOption } from '@/api/config';

const COLORS = [
  { v: 'blue', n: '蓝', hex: '#3b82f6' }, { v: 'amber', n: '琥珀', hex: '#f59e0b' },
  { v: 'green', n: '绿', hex: '#22c55e' }, { v: 'red', n: '红', hex: '#ef4444' },
  { v: 'purple', n: '紫', hex: '#a855f7' }, { v: 'pink', n: '粉', hex: '#ec4899' },
  { v: 'cyan', n: '青', hex: '#06b6d4' }, { v: 'yellow', n: '黄', hex: '#eab308' },
  { v: 'gray', n: '灰', hex: '#6b7280' }, { v: 'indigo', n: '靛', hex: '#6366f1' },
  { v: 'teal', n: '青绿', hex: '#14b8a6' }, { v: 'emerald', n: '翠', hex: '#10b981' },
  { v: 'orange', n: '橙', hex: '#f97316' }, { v: 'violet', n: '紫罗兰', hex: '#8b5cf6' },
  { v: 'rose', n: '玫瑰', hex: '#f43f5e' }, { v: 'slate', n: '石板', hex: '#64748b' },
  { v: 'lime', n: '石灰', hex: '#84cc16' }, { v: 'stone', n: '石', hex: '#78716c' },
  { v: 'sky', n: '天蓝', hex: '#0ea5e9' }, { v: 'fuchsia', n: '紫红', hex: '#d946ef' },
];

function errMsg(e: unknown, fallback: string): string {
  const anyE = e as { response?: { data?: { message?: string; error?: { message?: string } } } };
  // 后端全局异常过滤器把信息包在 data.error.message；兼容 data.message
  return anyE?.response?.data?.error?.message || anyE?.response?.data?.message || fallback;
}

export default function SystemConfigPage() {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <div className="p-10 text-center text-muted-foreground">仅管理员可访问</div>;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6">
        <h2 className="text-xl font-bold mb-1">系统配置 - 编辑筛选字段</h2>
        <p className="text-sm text-muted-foreground mb-5">
          以下是左侧筛选面板与详情页共用的所有字段和选项（存储于数据库，全员共享）。可以编辑、删除、新增。
          括号内为<strong>备注</strong>，仅本页可见、不会出现在筛选或详情页。
          <span className="text-orange-500 ml-2">⚠ 修改即刻保存到服务器，刷新页面后所有人生效。</span>
        </p>
        <ConfigManager />
      </div>
    </div>
  );
}

function ConfigManager() {
  const [config, setConfig] = useState<Record<string, IFilterOption[]>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('supplierType');

  const reload = useCallback(async () => {
    try {
      const data = await configApi.getAll();
      setConfig(data || {});
    } catch {
      setConfig({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const items = config[activeTab] || [];
  const isStyle = activeTab === 'style';
  // 供应商类型为固定项：暂不支持增删（仅允许改名/备注）
  const isLocked = activeTab === 'supplierType';
  const LOCKED_MSG = '供应商类型为固定字段，暂不支持新增或删除';
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editNote, setEditNote] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newNote, setNewNote] = useState('');
  const [newColor, setNewColor] = useState('');
  const [busy, setBusy] = useState(false);

  const startEdit = (item: IFilterOption) => {
    setEditingId(item.id); setEditLabel(item.label); setEditNote(item.note || '');
  };

  const saveEdit = async () => {
    if (editingId === null || !editLabel.trim()) return;
    setBusy(true);
    try {
      await configApi.update(editingId, { label: editLabel.trim(), note: editNote.trim() });
      setEditingId(null);
      await reload();
    } catch (e) {
      alert(errMsg(e, '保存失败'));
    } finally {
      setBusy(false);
    }
  };

  const addItem = async () => {
    if (isLocked) { alert(LOCKED_MSG); return; }
    if (!newLabel.trim()) return;
    setBusy(true);
    try {
      await configApi.create({
        category: activeTab,
        label: newLabel.trim(),
        ...(newNote.trim() ? { note: newNote.trim() } : {}),
        ...(newColor ? { color: newColor } : {}),
      });
      setNewLabel(''); setNewNote(''); setNewColor('');
      await reload();
    } catch (e) {
      alert(errMsg(e, '新增失败'));
    } finally {
      setBusy(false);
    }
  };

  const deleteItem = async (item: IFilterOption) => {
    if (isLocked) { alert(LOCKED_MSG); return; }
    if (!confirm(`确认删除「${item.label}」？`)) return;
    setBusy(true);
    try {
      await configApi.delete(item.id);
      await reload();
    } catch (e) {
      // 阶段2：后端会在有画师使用该选项时拒绝删除并返回使用名单
      alert(errMsg(e, '删除失败'));
    } finally {
      setBusy(false);
    }
  };

  const setColor = async (item: IFilterOption, color: string) => {
    setBusy(true);
    try {
      await configApi.update(item.id, { color });
      await reload();
    } catch (e) {
      alert(errMsg(e, '更新颜色失败'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex gap-1 mb-5 flex-wrap items-center">
        {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
          <button key={key} onClick={() => { setActiveTab(key); setEditingId(null); }}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${activeTab === key ? 'bg-primary text-primary-foreground' : 'bg-white border border-border hover:bg-muted'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-10 text-muted-foreground">加载中…</div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 bg-white border border-border rounded-lg px-4 py-2.5">
              {isStyle && (
                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  {COLORS.map(c => (
                    <button key={c.v} onClick={() => setColor(item, c.v)} disabled={busy}
                      style={{ backgroundColor: c.hex }}
                      className={`w-5 h-5 rounded-full transition-transform hover:scale-125 ${item.color === c.v ? 'ring-2 ring-offset-1 ring-primary scale-125' : 'opacity-50 hover:opacity-100'}`}
                      title={c.n} />
                  ))}
                </div>
              )}

              <div className="flex-1 min-w-0 flex items-center gap-2">
                {editingId === item.id ? (
                  <>
                    <input value={editLabel} onChange={e => setEditLabel(e.target.value)} className="border border-primary rounded px-2 py-1 text-sm w-28" placeholder="标签名" autoFocus />
                    <input value={editNote} onChange={e => setEditNote(e.target.value)} className="border border-primary rounded px-2 py-1 text-sm w-40" placeholder="备注（仅本页可见）" />
                    <button onClick={saveEdit} disabled={busy} className="px-2 py-1 bg-primary text-white rounded text-xs font-medium disabled:opacity-50">保存</button>
                    <button onClick={() => setEditingId(null)} className="px-2 py-1 border rounded text-xs">取消</button>
                  </>
                ) : (
                  <>
                    <span className="text-sm font-medium text-foreground">{item.label}</span>
                    {item.note && <span className="text-xs text-muted-foreground">（{item.note}）</span>}
                    {item.color && <span className="text-[10px] bg-muted px-1 rounded">{item.color}</span>}
                    <button onClick={() => startEdit(item)} className="ml-auto px-2 py-1 bg-primary text-white rounded text-xs font-medium hover:opacity-80">
                      编辑
                    </button>
                    {!isLocked && (
                      <button onClick={() => deleteItem(item)} disabled={busy} className="px-2 py-1 border border-red-200 text-red-600 rounded text-xs hover:bg-red-50 disabled:opacity-50">
                        删除
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}

          {items.length === 0 && <div className="text-center py-8 text-muted-foreground bg-white rounded-lg border">暂无数据</div>}

          {isLocked ? (
            <div className="text-center py-3 text-xs text-muted-foreground bg-muted/40 rounded-lg border border-dashed">
              {LOCKED_MSG}（可改名 / 备注）
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-white border-2 border-dashed border-primary/30 rounded-lg px-4 py-3">
              <input placeholder="标签名" value={newLabel} onChange={e => setNewLabel(e.target.value)} className="border rounded px-2 py-1 text-sm w-28" />
              <input placeholder="备注（可选，仅本页可见）" value={newNote} onChange={e => setNewNote(e.target.value)} className="border rounded px-2 py-1 text-sm w-44" />
              {isStyle && (
                <select value={newColor} onChange={e => setNewColor(e.target.value)} className="border rounded px-2 py-1 text-sm">
                  <option value="">颜色</option>
                  {COLORS.map(c => <option key={c.v} value={c.v}>{c.n}</option>)}
                </select>
              )}
              <button onClick={addItem} disabled={busy} className="px-3 py-1 bg-primary text-white rounded text-sm font-medium hover:opacity-80 disabled:opacity-50">
                + 新增
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
