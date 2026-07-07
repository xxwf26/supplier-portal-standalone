import React, { useState, useEffect, useCallback, useRef } from 'react';
import { UserPlusIcon, PlusIcon, Trash2Icon, ArchiveRestoreIcon, UploadIcon, ImageIcon, SparklesIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle as AlertTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supplierApi } from '@/api/supplier';
import { scrapeApi } from '@/api/scrape';
import { artworkSrc } from '@/lib/imageSrc';
import { IPriceItem, IContactItem } from '@/api/types';
import { axiosForBackend } from '@/api';
import {
  PRICE_UNIT_OPTIONS, CONTACT_TYPE_OPTIONS, PLATFORM_OPTIONS,
  MAX_PRICE_ITEMS, MAX_CONTACT_ITEMS,
  type LinkEntry, type PriceItemEntry, type ContactItemEntry,
} from './supplierFormShared';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/polyfills/logger';
import { getDataloom, getDefaultBucketId } from '@/lib/polyfills/storage';
import { toast } from 'sonner';
import { useFilterOptions } from '@/hooks/useFilterOptions';
import { configApi } from '@/api/config';
import { LimitedTextarea } from '@/components/ui/limited-textarea';
import { findSimilarNames } from '@/lib/supplierUtils';
import { normalizeForSearch } from '@/lib/chineseNormalize';

interface NewSupplierModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  suppliers?: Array<{ id: string; accountName: string }>;
}

const DRAFT_KEY = '__draft_new_supplier';

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m} 分钟前`;
  return `${Math.floor(m / 60)} 小时前`;
}

export default function NewSupplierModal({ open, onClose, onCreated, suppliers = [] }: NewSupplierModalProps) {
  const filterConfig = useFilterOptions();

  // 动态选项
  const supplierTypeOptions = filterConfig.supplierType.map((o) => ({
    value: o.label, // 直接存中文全称
    label: o.label,
  }));
  const cooperationTypeOptions = filterConfig.cooperationType.map((o) => ({
    value: o.value,
    label: o.label,
  }));
  const stylePresets = filterConfig.style.map((o) => o.value);
  const projectOptions = filterConfig.project.map((o) => o.value);

  // 根据 config 颜色值生成 style badge 样式
  const styleColorMap: Record<string, string> = {};
  filterConfig.style.forEach((o) => {
    if (o.color) {
      styleColorMap[o.value] = `bg-${o.color}-100 text-${o.color}-700 border-${o.color}-200`;
    }
  });

  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [artworkUrls, setArtworkUrls] = useState<string[]>([]);
  const [noteImages, setNoteImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const noteImageInputRef = useRef<HTMLInputElement>(null);
  const [similarSuppliers, setSimilarSuppliers] = useState<string[]>([]);

  const [accountName, setAccountName] = useState('');
  const [supplierType, setSupplierType] = useState('');
  const [cooperationTypes, setCooperationTypes] = useState<string[]>([]);
  const [contactInfo, setContactInfo] = useState('');
  const [entityType, setEntityType] = useState('');
  const [contractEntity, setContractEntity] = useState('');
  const [contractType, setContractType] = useState('');
  const [contractNo, setContractNo] = useState('');
  const [contractDeadline, setContractDeadline] = useState('');
  const [styleTags, setStyleTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [linkEntries, setLinkEntries] = useState<LinkEntry[]>([]);
  const [priceItemEntries, setPriceItemEntries] = useState<PriceItemEntry[]>([]);
  const [priceRange, setPriceRange] = useState('');
  const [contactItemEntries, setContactItemEntries] = useState<ContactItemEntry[]>([]);

  // 小红书链接 AI 自动填充
  const [xhsUrl, setXhsUrl] = useState('');
  const [scraping, setScraping] = useState(false);

  const isDirty = accountName.trim() !== '' || supplierType !== '' || cooperationTypes.length > 0 ||
    contactInfo !== '' || entityType !== '' || styleTags.length > 0 ||
    priceItemEntries.length > 0 || contactItemEntries.length > 0 || linkEntries.length > 0 ||
    noteImages.length > 0 || priceRange !== '' ||
    contractEntity !== '' || contractType !== '' || contractNo !== '' || contractDeadline !== '';

  // 输入名称时实时检测相似画师（纯前端比对，无需 API，防抖 400ms）
  useEffect(() => {
    const name = accountName.trim();
    if (name.length < 2) { setSimilarSuppliers([]); return; }
    const timer = setTimeout(() => {
      const existingNames = suppliers.map(s => s.accountName).filter(Boolean);
      const matched = findSimilarNames(name, existingNames);
      // 排除与自己完全一致的（新建时输入的名字本身就是相似的起点）
      setSimilarSuppliers(matched.filter(n => n !== name));
    }, 400);
    return () => clearTimeout(timer);
  }, [accountName, suppliers]);

  // 草稿自动保存（防抖 400ms）
  useEffect(() => {
    if (!open || !isDirty) return;
    const timer = setTimeout(() => {
      const draft = {
        _v: 2,
        accountName, supplierType, cooperationTypes,
        contactInfo, entityType, styleTags, linkEntries, priceItemEntries,
        contactItemEntries, noteImages, priceRange,
        contractEntity, contractType, contractNo, contractDeadline,
        savedAt: new Date().toISOString(),
      };
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch {}
    }, 400);
    return () => clearTimeout(timer);
  }, [open, isDirty, accountName, supplierType, cooperationTypes,
    contactInfo, entityType, styleTags, linkEntries, priceItemEntries, contactItemEntries,
    contractEntity, contractType, contractNo, contractDeadline, priceRange]);

  // 打开时检测草稿（修复 stale closure：移除 !isDirty 条件，有草稿就显示 banner）
  useEffect(() => {
    if (!open) return;
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const d = JSON.parse(saved);
        if (d._v !== 2) { localStorage.removeItem(DRAFT_KEY); return; }
        if (d.savedAt) setDraftSavedAt(d.savedAt);
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
      setCooperationTypes(d.cooperationTypes ?? []);
      setContactInfo(d.contactInfo ?? '');
      setEntityType(d.entityType ?? '');
      setStyleTags(d.styleTags ?? []);
      setLinkEntries(d.linkEntries ?? []);
      setPriceItemEntries(d.priceItemEntries ?? []);
      setContactItemEntries(d.contactItemEntries ?? []);
      setNoteImages(d.noteImages ?? []);
      setPriceRange(d.priceRange ?? '');
      setContractEntity(d.contractEntity ?? '');
      setContractType(d.contractType ?? '');
      setContractNo(d.contractNo ?? '');
      setContractDeadline(d.contractDeadline ?? '');
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
    setCooperationTypes([]);
    setContactInfo('');
    setEntityType('');
    setStyleTags([]);
    setNewTagInput('');
    setLinkEntries([]);
    setPriceItemEntries([]);
    setPriceRange('');
    setContactItemEntries([]);
    setArtworkUrls([]);
    setNoteImages([]);
    setXhsUrl('');
    setContractEntity('');
    setContractType('');
    setContractNo('');
    setContractDeadline('');
    setDraftSavedAt(null);
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const dataloom = await getDataloom();
      const { data, error } = await dataloom.storage.from(getDefaultBucketId()).uploadFile(file);
      if (error || !data) {
        const msg = (error && 'error_msg' in error ? (error as any).error_msg : undefined)
          || (error && 'message' in error ? (error as any).message : undefined) || '上传失败';
        throw new Error(msg);
      }
      setArtworkUrls(prev => [...prev, data.download_url]);
    } catch (err) {
      logger.error('Upload failed:', String(err));
      toast.error('图片上传失败，请重试');
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => handleUpload(file));
    e.target.value = '';
  };

  const handleNoteImageUpload = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await axiosForBackend({ url: '/api/upload', method: 'POST', data: form, headers: { 'Content-Type': 'multipart/form-data' } });
      setNoteImages(prev => [...prev, res.data.url]);
    } catch (err) {
      logger.error('Note image upload failed:', String(err));
      toast.error('图片上传失败，请重试');
    } finally {
      setUploading(false);
    }
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

  // 粘贴小红书链接 → 后端抓取 + AI 总结 → 预填表单（仅预填，人工确认后再保存）
  const handleScrape = async () => {
    const url = xhsUrl.trim();
    if (!url) { toast.error('请先粘贴小红书主页链接'); return; }
    setScraping(true);
    try {
      const res = await scrapeApi.fromXiaohongshu(url);
      if (!res.ok) {
        toast.error(res.reason || '抓取失败，请手动填写');
        // 即便失败，若抓到了图也给出来供参考
        if (res.images?.length) setArtworkUrls((prev) => [...prev, ...res.images!.filter((u) => !prev.includes(u))]);
        return;
      }

      // 1) 账号名：仅在当前为空时填，避免覆盖用户已输入
      if (res.accountName && !accountName.trim()) setAccountName(res.accountName);

      // 2) 小红书链接：加进平台链接（去重）。用后端解析出的纯链接，而非用户粘的整段文本
      const linkUrl = res.resolvedUrl || url;
      setLinkEntries((prev) =>
        prev.some((e) => e.url === linkUrl) ? prev : [...prev, { platform: 'xiaohongshu', url: linkUrl }],
      );

      // 3) 作品图（去重追加，人工可删）
      if (res.images?.length) {
        setArtworkUrls((prev) => [...prev, ...res.images!.filter((u) => !prev.includes(u))]);
      }

      // 4) AI 摘要：追加进备注，带前缀，绝不覆盖已输入内容
      if (res.summary) {
        const block = `【AI摘要】${res.summary}`;
        setContactInfo((prev) => (prev.trim() ? `${prev}\n${block}` : block));
      }

      // 5) 风格候选映射白名单：命中的自动加进标签；未命中的只提示、不污染白名单
      const matched: string[] = [];
      const unmatched: string[] = [];
      (res.styleGuesses || []).forEach((g) => {
        const ng = normalizeForSearch(g);
        // 仅归一化（繁简/大小写）后「精确相等」才算命中白名单。
        // 不用 substring 双向包含——那会把 AI 的「古」误配「古风」、「复古风」误配「古风」，
        // 破坏「配置=白名单」原则。未命中的进 unmatched，只提示用户手动加。
        const hit = stylePresets.find((p) => normalizeForSearch(p) === ng);
        if (hit) { if (!styleTags.includes(hit)) matched.push(hit); }
        else unmatched.push(g);
      });
      if (matched.length) setStyleTags((prev) => [...prev, ...matched.filter((m) => !prev.includes(m))]);

      let msg = 'AI 已填充：账号名/链接/作品图/摘要';
      if (matched.length) msg += `，风格标签「${matched.join('、')}」`;
      toast.success(msg);
      if (unmatched.length) {
        toast.message(`AI 还建议了风格：${unmatched.join('、')}（不在配置中，可手动添加）`);
      }
    } catch (err: any) {
      logger.error('Scrape failed:', String(err));
      toast.error('抓取请求失败，请稍后重试或手动填写');
    } finally {
      setScraping(false);
    }
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
    if (contactItemEntries.length >= MAX_CONTACT_ITEMS) {
      toast.warning(`最多添加 ${MAX_CONTACT_ITEMS} 条联系方式`);
      return;
    }
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

  const toggleCooperationType = (value: string) => {
    setCooperationTypes((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const handleSubmit = async () => {
    if (!accountName.trim()) {
      toast.error('请填写供应商名称');
      return;
    }

    setSaving(true);
    try {
      const manualLinks: Record<string, string> = {};
      for (const entry of linkEntries) {
        if (entry.platform && entry.url) {
          const url = entry.url.trim();
          if (!url.startsWith('http://') && !url.startsWith('https://')) {
            toast.error(`链接格式不正确（需以 http:// 或 https:// 开头）`);
            setSaving(false);
            return;
          }
          manualLinks[entry.platform] = url;
        }
      }

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

      for (const s of styleTags) {
        if (!s) continue;
        try {
          await configApi.create({ category: 'style', label: s });
        } catch {
          // 忽略错误，不阻断创建
        }
      }

      for (const t of cooperationTypes) {
        if (!t) continue;
        try {
          await configApi.create({ category: 'cooperationType', label: t });
        } catch {
          // 忽略错误，不阻断创建
        }
      }

      await supplierApi.create({
        accountName: accountName.trim(),
        supplierType: supplierType || undefined,
        cooperationType: cooperationTypes.length > 0 ? cooperationTypes.join('、') : undefined,
        contactInfo: contactInfo || undefined,
        entityType: entityType || undefined,
        contractEntity: contractEntity.trim() || undefined,
        contractType: contractType.trim() || undefined,
        contractNo: contractNo.trim() || undefined,
        contractDeadline: contractDeadline || undefined,
        subCategory: styleTags.join('、') || undefined,
        socialLinks: Object.keys(manualLinks).length > 0 ? manualLinks : undefined,
        priceItems,
        priceRange: priceRange.trim() || undefined,
        contactItems,
        artworkUrls: artworkUrls.length > 0 ? artworkUrls : undefined,
        noteImages: noteImages.length > 0 ? noteImages : undefined,
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

  const availablePresets = stylePresets.filter((p) => !styleTags.includes(p));

  return (
    <>
    <Dialog open={open} onOpenChange={(v) => !v && handleWantsToClose()}>
      <DialogContent
        aria-describedby={undefined}
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
                {similarSuppliers.length > 0 && (
                  <div className="mt-1.5 rounded-md border border-orange-200 bg-orange-50 px-3 py-2">
                    <p className="text-xs font-medium text-orange-700 mb-1">⚠ 库中存在相似画师，请确认是否重复：</p>
                    {similarSuppliers.map((name, i) => (
                      <p key={i} className="text-xs text-orange-600">「{name}」</p>
                    ))}
                  </div>
                )}
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
                    {supplierTypeOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  合作类型
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {cooperationTypeOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleCooperationType(opt.value)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-150 ${
                        cooperationTypes.includes(opt.value)
                          ? 'bg-primary/10 text-primary ring-1 ring-primary/30'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                  {cooperationTypeOptions.length === 0 && (
                    <p className="text-xs text-muted-foreground">暂无合作类型选项</p>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  历史参与项目
                </label>
                <Select value={entityType} onValueChange={setEntityType}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="选择项目" />
                  </SelectTrigger>
                  <SelectContent>
                    {projectOptions.map((opt) => (
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
                        {cooperationTypeOptions.map((opt) => (
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
                <div className="pt-1">
                  <label className="text-[11px] text-muted-foreground mb-1 block">报价备注（自由文本）</label>
                  <textarea
                    value={priceRange}
                    onChange={(e) => setPriceRange(e.target.value)}
                    placeholder="补充说明，如「线稿300，含商用+700」"
                    rows={2}
                    className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs resize-y focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
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
                        styleColorMap[style] || 'bg-muted text-muted-foreground border-border'
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

            {/* 作品图片上传 */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">作品图片</label>
              {artworkUrls.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {artworkUrls.map((url, idx) => (
                    <div key={idx} className="relative aspect-[4/3] rounded-lg overflow-hidden group border border-border">
                      <img src={artworkSrc(url)} alt={`作品 ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setArtworkUrls(prev => prev.filter((_, i) => i !== idx))}
                        className="absolute top-1 right-1 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2Icon className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div
                className="border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-primary/50 transition-colors cursor-pointer flex flex-col items-center justify-center gap-1 min-h-[80px]"
                onClick={() => fileInputRef.current?.click()}
              >
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} />
                {uploading ? (
                  <p className="text-xs text-primary">上传中...</p>
                ) : (
                  <>
                    <UploadIcon className="w-5 h-5 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">点击上传作品图片（可多选）</p>
                  </>
                )}
              </div>
            </div>

            {/* 小红书链接 AI 自动填充 */}
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              <label className="text-xs font-medium text-primary mb-2 flex items-center gap-1">
                <SparklesIcon className="w-3.5 h-3.5" />
                小红书链接 · AI 自动填充
              </label>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="粘贴小红书笔记链接，或 App 分享的整段文字"
                  value={xhsUrl}
                  onChange={(e) => setXhsUrl(e.target.value)}
                  className="flex-1 text-sm"
                  disabled={scraping}
                />
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleScrape}
                  disabled={scraping || !xhsUrl.trim()}
                  className="gap-1 shrink-0"
                >
                  <SparklesIcon className="w-3.5 h-3.5" />
                  {scraping ? '抓取中…' : '抓取填充'}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">
                粘小红书<strong>笔记</strong>链接（非主页），AI 会读取图文归纳画风/题材/采购建议，预填到下方，请人工确认后再保存。
              </p>
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
              <LimitedTextarea
                value={contactInfo}
                onChange={setContactInfo}
                placeholder="特殊要求等"
              />
              {/* 佐证图片 */}
              <div className="mt-2 space-y-2">
                <p className="text-[10px] text-muted-foreground">佐证图片</p>
                {noteImages.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {noteImages.map((url, idx) => (
                      <div key={idx} className="relative aspect-[4/3] rounded-lg overflow-hidden group border border-border">
                        <img src={url} alt={`佐证 ${idx + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setNoteImages(prev => prev.filter((_, i) => i !== idx))}
                          className="absolute top-1 right-1 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2Icon className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div
                  className="border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-primary/50 transition-colors cursor-pointer flex flex-col items-center justify-center gap-1 min-h-[70px]"
                  onClick={() => noteImageInputRef.current?.click()}
                  tabIndex={0}
                  onPaste={(e) => {
                    const items = e.clipboardData?.items;
                    if (!items) return;
                    for (let i = 0; i < items.length; i++) {
                      if (items[i].type.startsWith('image/')) {
                        const file = items[i].getAsFile();
                        if (file) handleNoteImageUpload(file);
                      }
                    }
                    e.stopPropagation();
                  }}
                >
                  <input
                    ref={noteImageInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      e.target.value = '';
                      files.forEach(handleNoteImageUpload);
                    }}
                  />
                  <UploadIcon className="w-4 h-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">点击上传或粘贴图片</p>
                </div>
              </div>
            </div>

            {/* 合同（放在最后） */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">合同</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">合同主体</label>
                  <Input value={contractEntity} onChange={(e) => setContractEntity(e.target.value)} placeholder="签约主体" />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">合同类型</label>
                  <Input value={contractType} onChange={(e) => setContractType(e.target.value)} placeholder="如 框架/单次" />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">合同编号</label>
                  <Input value={contractNo} onChange={(e) => setContractNo(e.target.value)} placeholder="编号" />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">合同到期日</label>
                  <Input type="date" value={contractDeadline} onChange={(e) => setContractDeadline(e.target.value)} />
                </div>
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
