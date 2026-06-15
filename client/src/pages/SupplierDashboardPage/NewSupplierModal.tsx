import React, { useState, useEffect, useCallback } from 'react';
import { UserPlusIcon, PlusIcon, Trash2Icon, ArchiveRestoreIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle as AlertTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supplierApi } from '@/api/supplier';
import { IPriceItem, IContactItem } from '@/api/types';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/polyfills/logger';
import { toast } from 'sonner';

const SUPPLIER_TYPE_OPTIONS = [
  { value: '个人', label: '个人画师' },
  { value: '艺术家', label: '艺术家' },
  { value: '工作室', label: '工作室' },
  { value: '公司', label: '公司' },
  { value: '个体工商户', label: '个体工商户' },
];

const COOPERATION_CATEGORY_OPTIONS = [
  '原画', '视频', '建模', '平面设计', '文案', '编舞', '笔替', '市场推广',
];

const COOPERATION_TYPE_OPTIONS = [
  { value: '角色原画', label: '角色原画' },
  { value: '场景原画', label: '场景原画' },
  { value: '平面海报', label: '平面海报' },
  { value: 'UI图标', label: 'UI图标' },
  { value: '视频动效', label: '视频动效' },
  { value: '平面拍摄', label: '平面拍摄' },
  { value: '视频拍摄', label: '视频拍摄' },
  { value: '达人营销', label: '达人营销' },
  { value: '驻场合作', label: '驻场合作' },
];

const PRICE_UNIT_OPTIONS = [
  { value: '元/张', label: '元/张' },
  { value: '元/个', label: '元/个' },
  { value: '元/秒', label: '元/秒' },
  { value: '元/套', label: '元/套' },
  { value: '元/条', label: '元/条' },
  { value: '元/天', label: '元/天' },
];

const CONTACT_TYPE_OPTIONS = [
  { value: 'wechat', label: '微信' },
  { value: 'qq', label: 'QQ' },
  { value: 'phone', label: '电话' },
];

const STYLE_PRESETS = ['Q版', '正比', '古风', '欧风', '写实', '少女风', '赛博朋克', '立绘', '小物', '场景', 'KKV'];

const PROJECT_OPTIONS = [
  '恋与制作人', '深空', '闪暖', '无暖', '无期迷途', 'IP开发中心', '通用',
];

const PLATFORM_OPTIONS = [
  { value: 'xiaohongshu', label: '小红书' },
  { value: 'weibo', label: '微博' },
  { value: 'mihuashi', label: '米画师' },
  { value: 'x', label: 'X' },
];

const styleColors: Record<string, string> = {
  古风: 'bg-red-100 text-red-700 border-red-200',
  'Q版': 'bg-amber-100 text-amber-700 border-amber-200',
  正比: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  欧风: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  写实: 'bg-blue-100 text-blue-700 border-blue-200',
  少女风: 'bg-pink-100 text-pink-700 border-pink-200',
  赛博朋克: 'bg-purple-100 text-purple-700 border-purple-200',
};

interface LinkEntry {
  platform: string;
  url: string;
}

interface PriceItemEntry {
  cooperationType: string;
  unitPrice: string;
  priceUnit: string;
}

interface ContactItemEntry {
  type: string;
  value: string;
}

interface NewSupplierModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const MAX_PRICE_ITEMS = 5;

const DRAFT_KEY = '__draft_new_supplier';

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m} 分钟前`;
  return `${Math.floor(m / 60)} 小时前`;
}

export default function NewSupplierModal({ open, onClose, onCreated }: NewSupplierModalProps) {
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);

  const [accountName, setAccountName] = useState('');
  const [supplierType, setSupplierType] = useState('');
  const [cooperationCategory, setCooperationCategory] = useState('');
  const [cooperationType, setCooperationType] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [entityType, setEntityType] = useState('');
  const [styleTags, setStyleTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [linkEntries, setLinkEntries] = useState<LinkEntry[]>([]);
  const [priceItemEntries, setPriceItemEntries] = useState<PriceItemEntry[]>([]);
  const [contactItemEntries, setContactItemEntries] = useState<ContactItemEntry[]>([]);

  const isDirty = accountName.trim() !== '' || supplierType !== '' || cooperationCategory !== '' ||
    cooperationType !== '' || contactInfo !== '' || entityType !== '' || styleTags.length > 0 ||
    priceItemEntries.length > 0 || contactItemEntries.length > 0 || linkEntries.length > 0;

  // 草稿自动保存
  useEffect(() => {
    if (!open || !isDirty) return;
    const draft = {
      accountName, supplierType, cooperationCategory, cooperationType,
      contactInfo, entityType, styleTags, linkEntries, priceItemEntries,
      contactItemEntries, savedAt: new Date().toISOString(),
    };
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch {}
  }, [open, isDirty, accountName, supplierType, cooperationCategory, cooperationType,
    contactInfo, entityType, styleTags, linkEntries, priceItemEntries, contactItemEntries]);

  // 打开时检测草稿
  useEffect(() => {
    if (!open) return;
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const d = JSON.parse(saved);
        if (d.savedAt && !isDirty) setDraftSavedAt(d.savedAt);
      }
    } catch {}
  }, [open]);

  const restoreDraft = useCallback(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (!saved) return;
      const d = JSON.parse(saved);
      setAccountName(d.accountName ?? '');
      setSupplierType(d.supplierType ?? '');
      setCooperationCategory(d.cooperationCategory ?? '');
      setCooperationType(d.cooperationType ?? '');
      setContactInfo(d.contactInfo ?? '');
      setEntityType(d.entityType ?? '');
      setStyleTags(d.styleTags ?? []);
      setLinkEntries(d.linkEntries ?? []);
      setPriceItemEntries(d.priceItemEntries ?? []);
      setContactItemEntries(d.contactItemEntries ?? []);
    } catch {}
    setDraftSavedAt(null);
  }, []);

  const discardDraft = useCallback(() => {
    localStorage.removeItem(DRAFT_KEY);
    setDraftSavedAt(null);
  }, []);

  const clearDraft = useCallback(() => { localStorage.removeItem(DRAFT_KEY); }, []);

  const resetForm = () => {
    setAccountName('');
    setSupplierType('');
    setCooperationCategory('');
    setCooperationType('');
    setContactInfo('');
    setEntityType('');
    setStyleTags([]);
    setNewTagInput('');
    setLinkEntries([]);
    setPriceItemEntries([]);
    setContactItemEntries([]);
    setDraftSavedAt(null);
  };

  const handleClose = () => {
    clearDraft();
    resetForm();
    onClose();
  };

  const handleWantsToClose = () => {
    if (isDirty) { setShowConfirm(true); return; }
    handleClose();
  };

  const addStyleTag = (tag: string) => {
    if (!tag.trim() || styleTags.includes(tag.trim())) return;
    setStyleTags((prev) => [...prev, tag.trim()]);
  };

  const removeStyleTag = (index: number) => {
    setStyleTags((prev) => prev.filter((_, i) => i !== index));
  };

  const addLink = () => {
    setLinkEntries((prev) => [...prev, { platform: '', url: '' }]);
  };

  const updateLink = (index: number, field: 'platform' | 'url', value: string) => {
    setLinkEntries((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry))
    );
  };

  const removeLink = (index: number) => {
    setLinkEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const addPriceItem = () => {
    if (priceItemEntries.length >= MAX_PRICE_ITEMS) {
      toast.warning(`最多添加 ${MAX_PRICE_ITEMS} 条报价`);
      return;
    }
    setPriceItemEntries((prev) => [...prev, { cooperationType: '', unitPrice: '', priceUnit: '元/张' }]);
  };

  const updatePriceItem = (index: number, field: keyof PriceItemEntry, value: string) => {
    setPriceItemEntries((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry))
    );
  };

  const removePriceItem = (index: number) => {
    setPriceItemEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const addContactItem = () => {
    setContactItemEntries((prev) => [...prev, { type: '', value: '' }]);
  };

  const updateContactItem = (index: number, field: keyof ContactItemEntry, value: string) => {
    setContactItemEntries((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry))
    );
  };

  const removeContactItem = (index: number) => {
    setContactItemEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!accountName.trim()) {
      toast.error('请填写供应商名称');
      return;
    }

    setSaving(true);
    try {
      const manualLinks: Record<string, string> = {};
      linkEntries.forEach((entry) => {
        if (entry.platform && entry.url) {
          manualLinks[entry.platform] = entry.url;
        }
      });

      const priceItems: IPriceItem[] = priceItemEntries
        .filter((e) => e.cooperationType && e.unitPrice)
        .map((e) => ({
          cooperationType: e.cooperationType,
          unitPrice: Number(e.unitPrice),
          priceUnit: e.priceUnit,
        }));

      const contactItems: IContactItem[] = contactItemEntries
        .filter((e) => e.type && e.value.trim())
        .map((e) => ({ type: e.type, value: e.value.trim() }));

      await supplierApi.create({
        accountName: accountName.trim(),
        supplierType: supplierType || undefined,
        cooperationCategory: cooperationCategory || undefined,
        cooperationType: cooperationType || undefined,
        contactInfo: contactInfo || undefined,
        entityType: entityType || undefined,
        subCategory: styleTags.join('、') || undefined,
        socialLinks: Object.keys(manualLinks).length > 0 ? manualLinks : undefined,
        priceItems,
        contactItems,
      });

      toast.success(`供应商「${accountName}」创建成功`);
      clearDraft();
      resetForm();
      onCreated();
    } catch (err) {
      logger.error('Create supplier failed:', String(err));
      toast.error('创建失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const availablePresets = STYLE_PRESETS.filter((p) => !styleTags.includes(p));

  return (
    <>
    <Dialog open={open} onOpenChange={(v) => !v && handleWantsToClose()}>
      <DialogContent
        className="max-w-2xl w-full max-h-[85vh] p-0 overflow-hidden flex flex-col"
        onPointerDownOutside={(e) => isDirty && e.preventDefault()}
        onEscapeKeyDown={(e) => isDirty && e.preventDefault()}
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <UserPlusIcon className="w-5 h-5 text-primary" />
            新建供应商
          </DialogTitle>
        </DialogHeader>

        {/* 草稿恢复横幅 */}
        {draftSavedAt && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-sm shrink-0">
            <ArchiveRestoreIcon className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="flex-1 text-amber-800">发现未保存的草稿（{timeAgo(draftSavedAt)}）</span>
            <Button size="sm" variant="outline" className="h-6 text-xs border-amber-300 text-amber-700 hover:bg-amber-100" onClick={restoreDraft}>恢复草稿</Button>
            <Button size="sm" variant="ghost" className="h-6 text-xs text-amber-600" onClick={discardDraft}>忽略</Button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  供应商名称 <span className="text-destructive">*</span>
                </label>
                <Input
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="输入名称"
                  className="text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  供应商类型
                </label>
                <Select value={supplierType} onValueChange={setSupplierType}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="选择类型" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPLIER_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  合作类型
                </label>
                <Select value={cooperationType} onValueChange={setCooperationType}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="选择合作类型" />
                  </SelectTrigger>
                  <SelectContent>
                    {COOPERATION_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  合作品类
                </label>
                <Select value={cooperationCategory} onValueChange={setCooperationCategory}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="选择品类" />
                  </SelectTrigger>
                  <SelectContent>
                    {COOPERATION_CATEGORY_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  所属项目
                </label>
                <Select value={entityType} onValueChange={setEntityType}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="选择项目" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECT_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 报价参考 - 结构化 */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">报价参考</label>
              <div className="space-y-2">
                {priceItemEntries.map((entry, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Select
                      value={entry.cooperationType}
                      onValueChange={(val) => updatePriceItem(index, 'cooperationType', val)}
                    >
                      <SelectTrigger className="w-[130px] shrink-0">
                        <SelectValue placeholder="合作类型" />
                      </SelectTrigger>
                      <SelectContent>
                        {COOPERATION_TYPE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      placeholder="单价"
                      value={entry.unitPrice}
                      onChange={(e) => updatePriceItem(index, 'unitPrice', e.target.value)}
                      className="w-[100px] shrink-0 text-sm"
                    />
                    <Select
                      value={entry.priceUnit}
                      onValueChange={(val) => updatePriceItem(index, 'priceUnit', val)}
                    >
                      <SelectTrigger className="w-[90px] shrink-0">
                        <SelectValue placeholder="计价" />
                      </SelectTrigger>
                      <SelectContent>
                        {PRICE_UNIT_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="sm" onClick={() => removePriceItem(index)}>
                      <Trash2Icon className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
                {priceItemEntries.length < MAX_PRICE_ITEMS && (
                  <Button variant="outline" size="sm" onClick={addPriceItem} className="gap-1">
                    <PlusIcon className="w-3.5 h-3.5" />
                    添加报价
                  </Button>
                )}
              </div>
            </div>

            {/* 联系方式 - 结构化 */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">联系方式</label>
              <div className="space-y-2">
                {contactItemEntries.map((entry, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Select
                      value={entry.type}
                      onValueChange={(val) => updateContactItem(index, 'type', val)}
                    >
                      <SelectTrigger className="w-[100px] shrink-0">
                        <SelectValue placeholder="类型" />
                      </SelectTrigger>
                      <SelectContent>
                        {CONTACT_TYPE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="微信号/QQ号/电话号码"
                      value={entry.value}
                      onChange={(e) => updateContactItem(index, 'value', e.target.value)}
                      className="flex-1 text-sm"
                    />
                    <Button variant="ghost" size="sm" onClick={() => removeContactItem(index)}>
                      <Trash2Icon className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addContactItem} className="gap-1">
                  <PlusIcon className="w-3.5 h-3.5" />
                  添加联系方式
                </Button>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">擅长风格</label>
              {styleTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {styleTags.map((style, index) => (
                    <Badge
                      key={style}
                      variant="outline"
                      className={cn(
                        'text-xs cursor-pointer',
                        styleColors[style] || 'bg-muted text-muted-foreground border-border'
                      )}
                    >
                      {style}
                      <button onClick={() => removeStyleTag(index)} className="ml-1 opacity-60 hover:opacity-100">
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              {availablePresets.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {availablePresets.map((preset) => (
                    <button
                      key={preset}
                      onClick={() => addStyleTag(preset)}
                      className="px-2 py-0.5 rounded-full text-xs border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <Input
                  placeholder="输入自定义标签"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addStyleTag(newTagInput);
                      setNewTagInput('');
                    }
                  }}
                  className="flex-1 text-sm h-8"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { addStyleTag(newTagInput); setNewTagInput(''); }}
                >
                  <PlusIcon className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">平台链接</label>
              <div className="space-y-2">
                {linkEntries.map((entry, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Select
                      value={entry.platform}
                      onValueChange={(val) => updateLink(index, 'platform', val)}
                    >
                      <SelectTrigger className="w-[120px] shrink-0">
                        <SelectValue placeholder="选择平台" />
                      </SelectTrigger>
                      <SelectContent>
                        {PLATFORM_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="链接地址"
                      value={entry.url}
                      onChange={(e) => updateLink(index, 'url', e.target.value)}
                      className="flex-1 text-sm"
                    />
                    <Button variant="ghost" size="sm" onClick={() => removeLink(index)}>
                      <Trash2Icon className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addLink} className="gap-1">
                  <PlusIcon className="w-3.5 h-3.5" />
                  添加链接
                </Button>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">备注</label>
              <Textarea
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value.slice(0, 500))}
                placeholder="特殊要求等"
                className="min-h-[100px] text-sm resize-none"
              />
              <div className="flex justify-end mt-1">
                <span className={`text-[11px] tabular-nums ${contactInfo.length >= 500 ? 'text-destructive font-medium' : contactInfo.length >= 400 ? 'text-orange-500' : 'text-muted-foreground'}`}>
                  {contactInfo.length} / 500
                </span>
              </div>
            </div>
          </div>

        <div className="px-6 py-4 border-t border-border flex justify-end gap-2 shrink-0">
          <Button variant="outline" onClick={handleWantsToClose}>取消</Button>
          <Button onClick={handleSubmit} disabled={saving || !accountName.trim()}>
            {saving ? '创建中...' : '创建供应商'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* 放弃编辑确认 */}
    <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertTitle>放弃填写？</AlertTitle>
          <AlertDialogDescription>已填写的内容将不会保存。</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>继续填写</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive hover:bg-destructive/90"
            onClick={handleClose}
          >
            放弃
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
