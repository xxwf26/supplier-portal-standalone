import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ExternalLinkIcon, MessageCircleIcon, StarIcon,
  TagIcon, BanknoteIcon, FileTextIcon, UploadIcon, Trash2Icon,
  PencilIcon, PlusIcon, LinkIcon, ImageIcon, XIcon, CheckIcon,
  PhoneIcon, ShieldIcon, ArchiveRestoreIcon,
  ChevronLeftIcon, ChevronRightIcon, Building2Icon, SparklesIcon,
  ListChecksIcon,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle as AlertTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ISupplier, IPriceItem, IContactItem } from '@/api/types';
import { supplierApi } from '@/api/supplier';
import { scrapeApi } from '@/api/scrape';
import { axiosForBackend } from '@/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/polyfills/logger';
import { getDataloom } from '@/lib/polyfills/storage';
import { getDefaultBucketId } from '@/lib/polyfills/storage';
import { useAuth } from '@/lib/auth';
import { useFilterOptions } from '@/hooks/useFilterOptions';
import { configApi } from '@/api/config';
import { normalizeSupplierType, SUPPLIER_TYPE_STYLE } from '@/lib/supplierUtils';
import { normalizeForSearch } from '@/lib/chineseNormalize';
import { artworkSrc } from '@/lib/imageSrc';
import {
  PRICE_UNIT_OPTIONS, CONTACT_TYPE_OPTIONS, PLATFORM_OPTIONS,
  PLATFORM_LABELS, CONTACT_TYPE_LABELS, MAX_PRICE_ITEMS, MAX_CONTACT_ITEMS,
  normalizeLinkMap,
  type PriceItemEntry, type ContactItemEntry,
} from './supplierFormShared';
import { LimitedTextarea } from '@/components/ui/limited-textarea';
import { AddToShortlistDialog } from './ShortlistPanel';

const typeConfig = SUPPLIER_TYPE_STYLE;

const statusConfig = {
  in_stock:   { label: '库内合作', color: 'bg-green-100 text-green-700 border-green-200',  dotColor: 'bg-green-500' },
  outreach:   { label: '库外建联', color: 'bg-blue-100 text-blue-700 border-blue-200',    dotColor: 'bg-blue-500' },
  blacklisted:{ label: '已拉黑',   color: 'bg-gray-100 text-gray-600 border-gray-200',    dotColor: 'bg-gray-400' },
  unset:      { label: '未填写',   color: 'bg-orange-50 text-orange-500 border-orange-200', dotColor: 'bg-orange-300' },
};

// 已存链接/联系方式的只读展示用共享 label 映射（PLATFORM_LABELS / CONTACT_TYPE_LABELS）
type ManualLinkEntry = { platform: string; url: string };

interface SupplierDetailModalProps {
  supplier: ISupplier | null;
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void;
}

// 容错：JSON 列可能以字符串/双重编码形式回传，统一转数组/对象，避免脏数据崩溃
function toArr<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (typeof v === 'string') {
    try { const p = JSON.parse(v); return Array.isArray(p) ? (p as T[]) : []; } catch { return []; }
  }
  return [];
}
// ── 全屏灯箱 ────────────────────────────────────────────
function LightboxOverlay({
  urls,
  startIndex,
  onClose,
}: {
  urls: string[];
  startIndex: number;
  onClose: () => void;
}) {
  const [current, setCurrent] = React.useState(startIndex);
  const total = urls.length;

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setCurrent(i => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setCurrent(i => Math.min(total - 1, i + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, total]);

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/92 flex items-center justify-center pointer-events-auto"
      onClick={onClose}
      onPointerDown={e => e.stopPropagation()}
    >
      {/* 关闭 */}
      <button
        className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
        onClick={onClose}
      >
        <XIcon className="w-5 h-5" />
      </button>

      {/* 计数 */}
      {total > 1 && (
        <span className="absolute top-4 left-1/2 -translate-x-1/2 text-white/70 text-sm tabular-nums">
          {current + 1} / {total}
        </span>
      )}

      {/* 图片 */}
      <div className="relative max-w-[92vw] max-h-[88vh]" onClick={e => e.stopPropagation()}>
        <img
          key={current}
          src={urls[current]}
          alt={`作品 ${current + 1}`}
          className="max-w-[92vw] max-h-[88vh] object-contain rounded-lg shadow-2xl"
        />
      </div>

      {/* 左右导航 */}
      {current > 0 && (
        <button
          className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition-colors"
          onClick={e => { e.stopPropagation(); setCurrent(i => i - 1); }}
        >
          <ChevronLeftIcon className="w-6 h-6" />
        </button>
      )}
      {current < total - 1 && (
        <button
          className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition-colors"
          onClick={e => { e.stopPropagation(); setCurrent(i => i + 1); }}
        >
          <ChevronRightIcon className="w-6 h-6" />
        </button>
      )}

      {/* 缩略图导航栏（多图时） */}
      {total > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 px-3 py-1.5 bg-black/40 rounded-2xl overflow-x-auto max-w-[80vw]">
          {urls.map((url, i) => (
            <button
              key={i}
              onClick={e => { e.stopPropagation(); setCurrent(i); }}
              className={cn(
                'w-10 h-7 rounded overflow-hidden border-2 transition-all',
                i === current ? 'border-white scale-110' : 'border-white/30 opacity-60 hover:opacity-90'
              )}
            >
              <img src={url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function getStatusFromData(supplier: ISupplier): 'in_stock' | 'outreach' | 'blacklisted' | 'unset' {
  if (supplier.riskStatus === '拉黑') return 'blacklisted';
  if (supplier.isInStock) return 'in_stock';
  if (!supplier.riskStatus || supplier.riskStatus === '未填写') return 'unset';
  return 'outreach';
}

export default function SupplierDetailModal({
  supplier,
  open,
  onClose,
  onSave,
  onDelete,
}: SupplierDetailModalProps) {
  const { isAdmin } = useAuth();
  const filterConfig = useFilterOptions();

  // 动态选项
  const supplierTypeOptions = filterConfig.supplierType.map((o) => ({
    value: o.label,
    label: o.label,
  }));
  const cooperationTypeOptions = filterConfig.cooperationType.map((o) => ({
    value: o.value,
    label: o.label,
  }));
  const stylePresets = filterConfig.style.map((o) => o.value);
  const projectOptions = filterConfig.project.map((o) => o.value);

  // 动态风格颜色
  const styleColorMap: Record<string, string> = {};
  filterConfig.style.forEach((o) => {
    if (o.color) {
      styleColorMap[o.value] = `bg-${o.color}-100 text-${o.color}-700 border-${o.color}-200`;
    }
  });

  const [isEditing, setIsEditing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [addShortlistOpen, setAddShortlistOpen] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [noteLightboxIndex, setNoteLightboxIndex] = useState<number | null>(null);
  const [artworkUrls, setArtworkUrls] = useState<string[]>([]);
  const [noteImages, setNoteImages] = useState<string[]>([]);
  const [manualLinkEntries, setManualLinkEntries] = useState<ManualLinkEntry[]>([]);
  const [priceItemEntries, setPriceItemEntries] = useState<PriceItemEntry[]>([]);
  const [priceRangeVal, setPriceRangeVal] = useState('');
  const [contactItemEntries, setContactItemEntries] = useState<ContactItemEntry[]>([]);
  const [cooperationTypeVal, setCooperationTypeVal] = useState<string[]>([]);
  const [cooperationCountVal, setCooperationCountVal] = useState('');
  const [ratingVal, setRatingVal] = useState('');
  const [statusVal, setStatusVal] = useState('');
  const [styleTags, setStyleTags] = useState<string[]>([]);
  const [contactInfoText, setContactInfoText] = useState('');
  const [nameVal, setNameVal] = useState('');
  const [supplierTypeVal, setSupplierTypeVal] = useState('');
  const [entityTypeVal, setEntityTypeVal] = useState('');
  // 合同 / 税务
  const [contractEntityVal, setContractEntityVal] = useState('');
  const [contractTypeVal, setContractTypeVal] = useState('');
  const [contractNoVal, setContractNoVal] = useState('');
  const [contractDeadlineVal, setContractDeadlineVal] = useState('');
  const [taxStatusVal, setTaxStatusVal] = useState('');
  const [newTagInput, setNewTagInput] = useState('');
  const [newCoopInput, setNewCoopInput] = useState('');
  const [uploading, setUploading] = useState(false);

  // 小红书链接 AI 自动填充
  const [xhsUrl, setXhsUrl] = useState('');
  const [scraping, setScraping] = useState(false);

  // 备注快捷模板
  const PRESET_NOTES = ['试稿未通过', '绘制沟通情况', '预警', '档期满', '价格偏高', '质量不稳定'];
  const [customNotes, setCustomNotes] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('__notes_templates') || '[]'); } catch { return []; }
  });
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteInput, setNoteInput] = useState('');
  const appendNote = (text: string) => {
    setContactInfoText(prev => prev ? `${prev}\n${text}` : text);
  };
  const saveCustomNote = () => {
    const t = noteInput.trim();
    if (!t) return;
    const next = [...customNotes, t];
    setCustomNotes(next);
    try { localStorage.setItem('__notes_templates', JSON.stringify(next)); } catch {}
    setNoteInput('');
    setShowNoteInput(false);
  };
  const removeCustomNote = (idx: number) => {
    const next = customNotes.filter((_, i) => i !== idx);
    setCustomNotes(next);
    try { localStorage.setItem('__notes_templates', JSON.stringify(next)); } catch {}
  };
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const noteImageInputRef = useRef<HTMLInputElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const coopInputRef = useRef<HTMLInputElement>(null);

  const draftKey = supplier ? `__draft_edit_${supplier.id}` : null;

  const clearDraft = useCallback(() => {
    if (draftKey) localStorage.removeItem(draftKey);
    setDraftSavedAt(null);
  }, [draftKey]);

  const restoreDraft = useCallback(() => {
    if (!draftKey) return;
    try {
      const saved = localStorage.getItem(draftKey);
      if (!saved) return;
      const d = JSON.parse(saved);
      if (d.artworkUrls) setArtworkUrls(d.artworkUrls);
      if (d.noteImages) setNoteImages(d.noteImages);
      if (d.manualLinkEntries) setManualLinkEntries(d.manualLinkEntries);
      if (d.priceItemEntries) setPriceItemEntries(d.priceItemEntries);
      if (d.priceRangeVal !== undefined) setPriceRangeVal(d.priceRangeVal);
      if (d.contactItemEntries) setContactItemEntries(d.contactItemEntries);
      if (d.cooperationTypeVal !== undefined) setCooperationTypeVal(d.cooperationTypeVal);
      if (d.cooperationCountVal !== undefined) setCooperationCountVal(d.cooperationCountVal);
      if (d.ratingVal !== undefined) setRatingVal(d.ratingVal);
      if (d.statusVal !== undefined) setStatusVal(d.statusVal);
      if (d.styleTags) setStyleTags(d.styleTags);
      if (d.contactInfoText !== undefined) setContactInfoText(d.contactInfoText);
      if (d.nameVal !== undefined) setNameVal(d.nameVal);
      if (d.supplierTypeVal !== undefined) setSupplierTypeVal(d.supplierTypeVal);
      if (d.entityTypeVal !== undefined) setEntityTypeVal(d.entityTypeVal);
      if (d.contractEntityVal !== undefined) setContractEntityVal(d.contractEntityVal);
      if (d.contractTypeVal !== undefined) setContractTypeVal(d.contractTypeVal);
      if (d.contractNoVal !== undefined) setContractNoVal(d.contractNoVal);
      if (d.contractDeadlineVal !== undefined) setContractDeadlineVal(d.contractDeadlineVal);
      if (d.taxStatusVal !== undefined) setTaxStatusVal(d.taxStatusVal);
    } catch {}
    setDraftSavedAt(null);
  }, [draftKey]);

  // 草稿自动保存（编辑中，防抖 400ms）
  useEffect(() => {
    if (!isEditing || !draftKey) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify({
          _v: 2,
          artworkUrls, manualLinkEntries, priceItemEntries, priceRangeVal, contactItemEntries,
          cooperationTypeVal, cooperationCountVal, ratingVal, statusVal,
          styleTags, contactInfoText, nameVal, supplierTypeVal, entityTypeVal,
          contractEntityVal, contractTypeVal, contractNoVal, contractDeadlineVal, taxStatusVal,
          noteImages,
          savedAt: new Date().toISOString(),
        }));
      } catch {}
    }, 400);
    return () => clearTimeout(timer);
  }, [isEditing, draftKey, artworkUrls, manualLinkEntries, priceItemEntries,
    contactItemEntries, cooperationTypeVal, cooperationCountVal, ratingVal,
    statusVal, styleTags, contactInfoText, nameVal, supplierTypeVal, entityTypeVal,
    contractEntityVal, contractTypeVal, contractNoVal, contractDeadlineVal, taxStatusVal, priceRangeVal, noteImages]);

  // 进入编辑时检查草稿
  useEffect(() => {
    if (!isEditing || !draftKey) { setDraftSavedAt(null); return; }
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const d = JSON.parse(saved);
        if (d._v !== 2) { localStorage.removeItem(draftKey); return; }
        if (d.savedAt) setDraftSavedAt(d.savedAt);
      }
    } catch {}
  }, [isEditing, draftKey]);

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return '刚刚';
    if (m < 60) return `${m} 分钟前`;
    return `${Math.floor(m / 60)} 小时前`;
  }

  // 合同到期状态：返回剩余天数与语义色（过期红 / 30 天内橙 / 其余常规）
  function deadlineStatus(dateStr: string | null | undefined) {
    if (!dateStr) return null;
    const d = new Date(String(dateStr).slice(0, 10));
    if (isNaN(d.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Math.round((d.getTime() - today.getTime()) / 86400000);
    if (days < 0) return { days, label: `已过期 ${-days} 天`, tone: 'text-red-600' };
    if (days === 0) return { days, label: '今天到期', tone: 'text-red-600' };
    if (days <= 30) return { days, label: `${days} 天后到期`, tone: 'text-amber-600' };
    return { days, label: `${days} 天后到期`, tone: 'text-muted-foreground' };
  }

  // 当前表单值的签名（用于脏检查 / 判断"是否真的改过"）。字段集与草稿一致。
  const formSignature = useMemo(
    () => JSON.stringify({
      artworkUrls, manualLinkEntries, priceItemEntries, priceRangeVal, contactItemEntries,
      cooperationTypeVal, cooperationCountVal, ratingVal, statusVal,
      styleTags, contactInfoText, nameVal, supplierTypeVal, entityTypeVal, noteImages,
      contractEntityVal, contractTypeVal, contractNoVal, contractDeadlineVal, taxStatusVal,
    }),
    [artworkUrls, manualLinkEntries, priceItemEntries, priceRangeVal, contactItemEntries,
      cooperationTypeVal, cooperationCountVal, ratingVal, statusVal, styleTags,
      contactInfoText, nameVal, supplierTypeVal, entityTypeVal, noteImages,
      contractEntityVal, contractTypeVal, contractNoVal, contractDeadlineVal, taxStatusVal],
  );
  // 进入编辑态那一刻的基线签名；与当前签名不同即为"脏"
  const editBaselineRef = useRef<string | null>(null);
  const isDirty = editBaselineRef.current !== null && formSignature !== editBaselineRef.current;

  const handleWantsToClose = () => {
    if (isEditing && isDirty) { setShowConfirm(true); return; }
    onClose();
  };

  const resetForm = () => {
    if (!supplier) return;
    setArtworkUrls(toArr<string>(supplier.artworkUrls));
    setNoteImages(toArr<string>(supplier.noteImages));
    // 每平台的多条链接展开成多行 entry（每条 url 一行）
    const entries: ManualLinkEntry[] = Object.entries(normalizeLinkMap(supplier.manualLinks))
      .flatMap(([platform, urls]) => urls.map((url) => ({ platform, url })));
    setManualLinkEntries(entries);
    setPriceItemEntries(
      toArr<IPriceItem>(supplier.priceItems).map((p) => ({
        cooperationType: p.cooperationType,
        unitPrice: String(p.unitPrice),
        priceUnit: p.priceUnit,
      }))
    );
    setPriceRangeVal(supplier.priceRange || '');
    setContactItemEntries(
      toArr<IContactItem>(supplier.contactItems).map((c) => ({
        type: c.type,
        value: c.value,
      }))
    );
    setCooperationTypeVal(
        supplier.cooperationType
          ? supplier.cooperationType.split(/[/、，]/).map((s: string) => s.trim()).filter(Boolean)
          : []
      );
      setEntityTypeVal(supplier.entityType || '');
      setContractEntityVal(supplier.contractEntity || '');
      setContractTypeVal(supplier.contractType || '');
      setContractNoVal(supplier.contractNo || '');
      setContractDeadlineVal(supplier.contractDeadline ? String(supplier.contractDeadline).slice(0, 10) : '');
      setTaxStatusVal(supplier.taxStatus || '');
      setCooperationCountVal(String(supplier.cooperationCount || 0));
      setRatingVal(supplier.rating != null ? String(supplier.rating) : '');
      setStatusVal(getStatusFromData(supplier));
      setSupplierTypeVal(normalizeSupplierType(supplier.supplierType, supplier.accountName || ''));
      setNameVal(supplier.accountName || '');
    setStyleTags(
      supplier.subCategory
        ? supplier.subCategory.split(/[\/、，]/).map((s) => s.trim()).filter(Boolean)
        : []
    );
    setContactInfoText(supplier.contactInfo || '');
    setNewTagInput('');
  };

  useEffect(() => {
    resetForm();
    setIsEditing(false);
  }, [supplier]);

  // 进入编辑态时记录基线签名（此刻表单值 = 供应商原值）；退出编辑态清空
  useEffect(() => {
    editBaselineRef.current = isEditing ? formSignature : null;
    // 只在 isEditing 翻转时捕获，故意不把 formSignature 放进依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  useEffect(() => {
    if (!isEditing || !open) return;
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) handleUpload(file);
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isEditing, open]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const dataloom = await getDataloom();
      const { data, error } = await dataloom
        .storage
        .from(getDefaultBucketId())
        .uploadFile(file);
      if (error || !data) {
        const msg = (error && 'error_msg' in error ? (error as { error_msg: string }).error_msg : undefined)
          || (error && 'message' in error ? (error as { message: string }).message : undefined)
          || '上传失败';
        throw new Error(msg);
      }
      setArtworkUrls((prev) => [...prev, data.download_url]);
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
    Array.from(files).forEach((file) => handleUpload(file));
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

  const removeArtwork = (index: number) => {
    setArtworkUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const addManualLink = () => {
    setManualLinkEntries((prev) => [...prev, { platform: '', url: '' }]);
  };

  const updateManualLink = (index: number, field: 'platform' | 'url', value: string) => {
    setManualLinkEntries((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry))
    );
  };

  const removeManualLink = (index: number) => {
    setManualLinkEntries((prev) => prev.filter((_, i) => i !== index));
  };

  // 粘贴画师链接（小红书/米画师）→ 后端抓取 + AI 总结 → 预填（编辑态，仅预填人工确认后保存）
  const handleScrape = async () => {
    const url = xhsUrl.trim();
    if (!url) { toast.error('请先粘贴小红书或米画师画师链接'); return; }
    setScraping(true);
    try {
      const res = await scrapeApi.fromLink(url);
      if (!res.ok) {
        toast.error(res.reason || '抓取失败，请手动填写');
        if (res.images?.length) setArtworkUrls((prev) => [...prev, ...res.images!.filter((u) => !prev.includes(u))]);
        return;
      }

      // 账号名：仅在为空时填
      if (res.accountName && !nameVal.trim()) setNameVal(res.accountName);

      // 画师链接进手动链接（去重）。用后端解析出的纯链接，平台按识别结果选
      const linkUrl = res.resolvedUrl || url;
      const platform = res.platform || 'xiaohongshu';
      setManualLinkEntries((prev) =>
        prev.some((e) => e.url === linkUrl) ? prev : [...prev, { platform, url: linkUrl }],
      );

      // 作品图（去重追加）
      if (res.images?.length) {
        setArtworkUrls((prev) => [...prev, ...res.images!.filter((u) => !prev.includes(u))]);
      }

      // AI 摘要追加进备注，绝不覆盖
      if (res.summary) {
        const block = `【AI摘要】${res.summary}`;
        setContactInfoText((prev) => (prev.trim() ? `${prev}\n${block}` : block));
      }

      // 风格候选映射白名单
      const matched: string[] = [];
      const unmatched: string[] = [];
      (res.styleGuesses || []).forEach((g) => {
        const ng = normalizeForSearch(g);
        // 仅归一化（繁简/大小写）后「精确相等」才算命中白名单，避免 substring 误配。
        const hit = stylePresets.find((p: string) => normalizeForSearch(p) === ng);
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

  const addStyleTag = (tag: string) => {
    if (!tag.trim() || styleTags.includes(tag.trim())) return;
    setStyleTags((prev) => [...prev, tag.trim()]);
  };

  const removeStyleTag = (index: number) => {
    setStyleTags((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddTagFromInput = () => {
    if (newTagInput.trim()) {
      addStyleTag(newTagInput);
      setNewTagInput('');
    }
  };

  const handleSave = async () => {
    if (!supplier) return;
    if (!nameVal.trim()) {
      toast.error('画师名称不能为空');
      return;
    }

    // 链接格式校验：必须在进入 try 前用 for...of 做，才能真正中止保存。
    // （原先写在 forEach 回调里 return 只跳出迭代、不中止 handleSave，非法链接照样提交）
    const manualLinksRecord: Record<string, string[]> = {};
    for (const entry of manualLinkEntries) {
      if (entry.platform && entry.url) {
        const url = entry.url.trim();
        if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
          toast.error(`链接格式不正确：${url}（需以 http:// 或 https:// 开头）`);
          return;
        }
        // 同平台累加进数组，完全相同的 url 去重
        const list = (manualLinksRecord[entry.platform] ??= []);
        if (!list.includes(url)) list.push(url);
      }
    }

    setSaving(true);
    try {
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

      // 把新输入的、系统配置里还没有的擅长风格同步进配置（之后筛选/配置/下拉即可见）
      for (const s of styleTags) {
        if (!s) continue;
        try {
          await configApi.create({ category: 'style', label: s });
        } catch {
          // 忽略错误，不阻断画师保存
        }
      }

      for (const t of cooperationTypeVal) {
        if (!t) continue;
        try {
          await configApi.create({ category: 'cooperationType', label: t });
        } catch {
          // 忽略错误，不阻断画师保存
        }
      }

      await supplierApi.update(supplier.id, {
        accountName: nameVal.trim(),
        artworkUrls,
        manualLinks: manualLinksRecord,
        priceItems,
        priceRange: priceRangeVal.trim() || null,
        contactItems,
        noteImages,
        cooperationType: cooperationTypeVal.length > 0 ? cooperationTypeVal.join('、') : null,
        cooperationCount: cooperationCountVal ? Number(cooperationCountVal) : 0,
        rating: ratingVal ? Number(ratingVal) : null,
        subCategory: styleTags.join('、') || null,
        contactInfo: contactInfoText,
        supplierType: supplierTypeVal || undefined,
        entityType: entityTypeVal || null,
        contractEntity: contractEntityVal.trim() || null,
        contractType: contractTypeVal.trim() || null,
        contractNo: contractNoVal.trim() || null,
        contractDeadline: contractDeadlineVal || null,
        taxStatus: taxStatusVal.trim() || null,
        isInStock: statusVal === 'in_stock',
        riskStatus: statusVal === 'blacklisted' ? '拉黑' : statusVal === 'outreach' ? '暂无' : '未填写',
      });
      setIsEditing(false);
      clearDraft();
      onSave();
    } catch (err) {
      logger.error('Save failed:', String(err));
      toast.error('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    resetForm();
    setIsEditing(false);
    setConfirmingDelete(false);
    clearDraft();
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = async () => {
    if (!supplier) return;
    setShowDeleteConfirm(false);
    try {
      await supplierApi.delete(supplier.id);
      toast.success('已删除供应商');
      onClose();
      onDelete?.();
    } catch (err) {
      logger.error('Delete failed:', String(err));
      toast.error('删除失败，请重试');
    }
  };

  if (!supplier) return null;

  // 合并 social + manual 平台链接，同平台多条合并去重
  const allLinks: Record<string, string[]> = {};
  const mergeInto = (src: Record<string, string[]>) => {
    Object.entries(src).forEach(([k, urls]) => {
      allLinks[k] = Array.from(new Set([...(allLinks[k] || []), ...urls]));
    });
  };
  mergeInto(normalizeLinkMap(supplier.socialLinks));
  mergeInto(normalizeLinkMap(supplier.manualLinks));

  // 查看模式下渲染用的规范化 JSON 字段（容错脏数据）
  const priceItemsView = toArr<IPriceItem>(supplier.priceItems);
  const contactItemsView = toArr<IContactItem>(supplier.contactItems);
  const socialLinksView = normalizeLinkMap(supplier.socialLinks);

  const type = normalizeSupplierType(supplier.supplierType, supplier.accountName || '');

  const status = getStatusFromData(supplier);
  const typeInfo = typeConfig[type];
  const statusInfo = statusConfig[status];
  const displayStyles = supplier.subCategory
    ? supplier.subCategory.split(/[\/、，]/).map((s) => s.trim()).filter(Boolean)
    : [];
  const toggleCooperationType = (value: string) => {
    setCooperationTypeVal((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };
  const addCoopFromInput = () => {
    const t = newCoopInput.trim();
    if (!t || cooperationTypeVal.includes(t)) { setNewCoopInput(''); return; }
    setCooperationTypeVal(prev => [...prev, t]);
    setNewCoopInput('');
  };

  const availablePresets = stylePresets.filter((p: string) => !styleTags.includes(p));
  const availableCoopTypes = cooperationTypeOptions.filter(o => !cooperationTypeVal.includes(o.value));

  const moduleBase = 'rounded-xl border border-border/60 bg-card overflow-hidden';
  const moduleHeader = 'flex items-center gap-1.5 px-3 py-2 bg-muted/40 border-b border-border/40';
  const moduleBody = 'px-3 py-2.5';

  return (
    <>
    <Dialog open={open} onOpenChange={(v) => !v && handleWantsToClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="max-w-3xl w-full max-h-[90vh] p-0 overflow-hidden"
        showCloseButton={false}
        onPointerDownOutside={(e) => {
          // 灯箱开着时，点击灯箱不应关闭详情弹窗
          if (lightboxIndex !== null || noteLightboxIndex !== null) { e.preventDefault(); return; }
          if (isEditing && isDirty) { e.preventDefault(); setShowConfirm(true); }
        }}
        onEscapeKeyDown={(e) => {
          // 灯箱开着时，Esc 只交给灯箱自身关闭，不关详情弹窗
          if (lightboxIndex !== null || noteLightboxIndex !== null) { e.preventDefault(); return; }
          if (isEditing && isDirty) { e.preventDefault(); setShowConfirm(true); }
        }}
      >
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                {isEditing ? (
                  <>
                    <DialogTitle className="sr-only">编辑画师：{supplier.accountName}</DialogTitle>
                    <Input
                      value={nameVal}
                      onChange={(e) => setNameVal(e.target.value)}
                      placeholder="画师名称"
                      maxLength={255}
                      className="h-9 text-xl font-bold flex-1 min-w-0"
                    />
                  </>
                ) : (
                  <DialogTitle className="text-xl font-bold text-foreground">
                    {supplier.accountName}
                  </DialogTitle>
                )}
                {supplier.cooperationCategory && (
                  <Badge variant="outline" className="text-xs bg-muted/50">
                    {supplier.cooperationCategory}
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {isEditing ? (
                  <Select value={supplierTypeVal} onValueChange={setSupplierTypeVal}>
                    <SelectTrigger className="h-7 text-xs w-[110px]">
                      <SelectValue placeholder="选择类型" />
                    </SelectTrigger>
                    <SelectContent>
                      {supplierTypeOptions.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="outline" className={cn(typeInfo.color, 'text-xs')}>
                    {type}
                  </Badge>
                )}
                {isAdmin && (
                <Badge variant="outline" className={cn(statusInfo.color, 'text-xs')}>
                  <span className={cn('w-1.5 h-1.5 rounded-full mr-1.5', statusInfo.dotColor)} />
                  {statusInfo.label}
                </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isEditing && supplier && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAddShortlistOpen(true)}
                >
                  <ListChecksIcon className="w-3.5 h-3.5 mr-1" />加入清单
                </Button>
              )}
              {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => isEditing ? handleCancel() : setIsEditing(true)}
              >
                {isEditing ? '取消' : <><PencilIcon className="w-3.5 h-3.5 mr-1" />编辑</>}
              </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* 草稿恢复横幅（仅编辑模式下出现） */}
        {isEditing && draftSavedAt && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-sm shrink-0">
            <ArchiveRestoreIcon className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="flex-1 text-amber-800">发现上次未保存的草稿（{timeAgo(draftSavedAt)}）</span>
            <button className="text-xs font-medium text-amber-700 underline underline-offset-2 mr-2" onClick={restoreDraft}>恢复草稿</button>
            <button className="text-xs text-amber-500 hover:text-amber-700" onClick={() => { clearDraft(); }}>忽略</button>
          </div>
        )}

        {/* min-w-0 + 强制 Radix viewport 内层 table wrapper 为 block：
            避免横向超宽内容（如多张作品图）把 ScrollArea 撑出弹窗、被 overflow-hidden 裁剪
            而无法查看。仅作用于本弹窗，不影响其他 ScrollArea。 */}
        <ScrollArea className="max-h-[calc(90vh-100px)] min-w-0 [&_[data-slot=scroll-area-viewport]>div]:!block">
          <div className="px-4 py-4 space-y-3">

            {/* Row 1: Stats Dashboard — 3 column */}
            <div className={cn(moduleBase)}>
              <div className={moduleHeader}>
                <ShieldIcon className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-semibold">概览</span>
              </div>
              <div className={isAdmin ? "grid grid-cols-3 divide-x divide-border/40" : "grid grid-cols-2 divide-x divide-border/40"}>
                {/* Status — 仅管理员可见 */}
                {isAdmin && (
                <div className="p-3 text-center">
                  <p className="text-[10px] text-muted-foreground mb-1">合作状态</p>
                  {isEditing ? (
                    <Select value={statusVal} onValueChange={setStatusVal}>
                      <SelectTrigger className="h-7 text-xs px-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unset">未填写</SelectItem>
                        <SelectItem value="in_stock">库内合作</SelectItem>
                        <SelectItem value="outreach">库外建联</SelectItem>
                        <SelectItem value="blacklisted">已拉黑</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className={cn('inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full', statusInfo.color)}>
                      <span className={cn('w-1.5 h-1.5 rounded-full mr-1', statusInfo.dotColor)} />
                      {statusInfo.label}
                    </span>
                  )}
                </div>
                )}
                {/* Frequency */}
                <div className="p-3 text-center">
                  <p className="text-[10px] text-muted-foreground mb-1">合作频次</p>
                  {isEditing ? (
                    <Input
                      type="number"
                      min={0}
                      value={cooperationCountVal}
                      onChange={(e) => setCooperationCountVal(e.target.value)}
                      className="h-7 text-xs text-center px-1"
                    />
                  ) : (
                    <span className="text-lg font-bold text-foreground">
                      {supplier.cooperationCount}
                      <span className="text-xs font-normal text-muted-foreground ml-0.5">次</span>
                    </span>
                  )}
                </div>
                {/* Rating */}
                <div className="p-3 text-center">
                  <p className="text-[10px] text-muted-foreground mb-1">评分</p>
                  {isEditing ? (
                    <Select
                      value={ratingVal === '' ? 'none' : ratingVal}
                      onValueChange={(v) => setRatingVal(v === 'none' ? '' : v)}
                    >
                      <SelectTrigger className="h-7 text-xs px-2">
                        <SelectValue placeholder="评分" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">未评分</SelectItem>
                        <SelectItem value="1">1 分</SelectItem>
                        <SelectItem value="2">2 分</SelectItem>
                        <SelectItem value="3">3 分</SelectItem>
                        <SelectItem value="4">4 分</SelectItem>
                        <SelectItem value="5">5 分</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="inline-flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <StarIcon
                          key={i}
                          className={cn(
                            'w-4 h-4',
                            i < (supplier.rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'
                          )}
                        />
                      ))}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Row 2: Artwork (full width) */}
            <div className={cn(moduleBase)}>
              <div className={cn(moduleHeader, 'justify-between')}>
                <div className="flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-semibold">作品展示</span>
                  {artworkUrls.length > 0 && (
                    <span className="text-[10px] text-muted-foreground">({artworkUrls.length} 张)</span>
                  )}
                </div>
                {isEditing && (
                  <span className="text-[10px] text-muted-foreground">支持粘贴上传</span>
                )}
              </div>
              <div className={moduleBody}>
                {isEditing ? (
                  <div className="space-y-2">
                    {artworkUrls.length > 0 && (
                      <div className="grid grid-cols-3 gap-2">
                        {artworkUrls.map((url, index) => (
                          <div key={index} className="relative aspect-[4/3] rounded-lg overflow-hidden group border border-border">
                            <img
                              src={artworkSrc(url)}
                              alt={`作品 ${index + 1}`}
                              className="w-full h-full object-cover cursor-zoom-in"
                              onClick={() => setLightboxIndex(index)}
                            />
                            <button
                              onClick={(e) => { e.stopPropagation(); removeArtwork(index); }}
                              className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2Icon className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div
                      className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer min-h-[120px] flex flex-col items-center justify-center"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleFileSelect}
                      />
                      <UploadIcon className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
                      <p className="text-xs text-muted-foreground">点击上传或粘贴图片</p>
                      {uploading && <p className="text-xs text-primary mt-1">上传中...</p>}
                    </div>
                  </div>
                ) : (
                  artworkUrls.length > 0 ? (
                    <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
                      {artworkUrls.map((url, index) => (
                        <div
                          key={index}
                          className="flex-shrink-0 h-[200px] rounded-lg overflow-hidden bg-muted border border-border cursor-zoom-in hover:border-primary/50 transition-colors group relative"
                          onClick={() => setLightboxIndex(index)}
                        >
                          <img
                            src={artworkSrc(url)}
                            alt={`作品 ${index + 1}`}
                            className="h-full w-auto max-w-[360px] object-cover group-hover:scale-[1.02] transition-transform duration-200"
                            onError={(e) => {
                              const img = e.currentTarget;
                              img.style.display = 'none';
                              const fb = img.nextElementSibling as HTMLElement | null;
                              if (fb) fb.style.display = 'flex';
                            }}
                          />
                          <div className="hidden w-full h-full items-center justify-center bg-muted text-muted-foreground/30">
                            <ImageIcon className="w-8 h-8" />
                          </div>
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs bg-black/50 px-2 py-1 rounded-full">查看大图</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-4">暂无作品图片</p>
                  )
                )}
              </div>
            </div>

            {/* Row 3: Styles + Cooperation Type — 2 column */}
            <div className="grid grid-cols-2 gap-3">
              {/* Styles Module */}
              <div className={cn(moduleBase)}>
                <div className={moduleHeader}>
                  <TagIcon className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-semibold">擅长风格</span>
                </div>
                <div className={moduleBody}>
                  {isEditing ? (
                    <div className="space-y-2">
                      {styleTags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {styleTags.map((style, index) => (
                            <Badge
                              key={style}
                              variant="outline"
                              className={cn(
                                'text-xs cursor-pointer group',
                                styleColorMap[style] || 'bg-muted text-muted-foreground border-border'
                              )}
                            >
                              {style}
                              <button
                                onClick={() => removeStyleTag(index)}
                                className="ml-0.5 opacity-60 hover:opacity-100"
                              >
                                <XIcon className="w-2.5 h-2.5" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                      {availablePresets.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {availablePresets.map((preset) => (
                            <button
                              key={preset}
                              onClick={() => addStyleTag(preset)}
                              className="px-1.5 py-0.5 rounded-full text-xs border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                            >
                              + {preset}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Input
                          ref={tagInputRef}
                          placeholder="自定义"
                          value={newTagInput}
                          onChange={(e) => setNewTagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddTagFromInput();
                            }
                          }}
                          className="flex-1 text-xs h-7"
                        />
                        <Button variant="outline" size="sm" onClick={handleAddTagFromInput} className="h-6 w-6 p-0">
                          <PlusIcon className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    displayStyles.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {displayStyles.map((style) => (
                          <Badge
                            key={style}
                            variant="outline"
                            className={cn(
                              'text-xs',
                              styleColorMap[style] || 'bg-muted text-muted-foreground border-border'
                            )}
                          >
                            {style}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-1">暂未设置</p>
                    )
                  )}
                </div>
              </div>

              {/* Cooperation Type Module */}
              <div className={cn(moduleBase)}>
                <div className={moduleHeader}>
                  <MessageCircleIcon className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-semibold">合作类型</span>
                </div>
                <div className={moduleBody}>
                  {isEditing ? (
                    <div className="space-y-2">
                      {/* 已选合作类型 - 带 × 删除 */}
                      {cooperationTypeVal.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {cooperationTypeVal.map((ct, index) => (
                            <Badge
                              key={ct}
                              variant="outline"
                              className="text-xs cursor-pointer bg-primary/5 text-primary border-primary/20"
                            >
                              {ct}
                              <button
                                onClick={() => toggleCooperationType(ct)}
                                className="ml-0.5 opacity-60 hover:opacity-100"
                              >
                                <XIcon className="w-2.5 h-2.5" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                      {/* 可添加的预设选项 */}
                      {availableCoopTypes.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {availableCoopTypes.map((opt) => (
                            <button
                              key={opt.value}
                              onClick={() => toggleCooperationType(opt.value)}
                              className="px-1.5 py-0.5 rounded-full text-xs border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                            >
                              + {opt.label}
                            </button>
                          ))}
                        </div>
                      )}
                      {/* 自定义输入 */}
                      <div className="flex items-center gap-1">
                        <Input
                          ref={coopInputRef}
                          placeholder="自定义"
                          value={newCoopInput}
                          onChange={(e) => setNewCoopInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCoopFromInput(); } }}
                          className="flex-1 text-xs h-7"
                        />
                        <Button variant="outline" size="sm" onClick={addCoopFromInput} className="h-6 w-6 p-0">
                          <PlusIcon className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    supplier.cooperationType ? (
                      <div className="flex flex-wrap gap-1">
                        {supplier.cooperationType.split(/[\/、，]/).map((s) => s.trim()).filter(Boolean).map((ct) => (
                          <Badge key={ct} variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
                            {ct}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-1">未设置</p>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Row 4: Price Table (full width) */}
            <div className={cn(moduleBase)}>
              <div className={cn(moduleHeader, 'justify-between')}>
                <div className="flex items-center gap-1.5">
                  <BanknoteIcon className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-semibold">报价参考</span>
                </div>
                {isEditing && priceItemEntries.length < MAX_PRICE_ITEMS && (
                  <Button variant="ghost" size="sm" onClick={addPriceItem} className="h-5 px-1.5 text-[10px] gap-0.5">
                    <PlusIcon className="w-3 h-3" />
                    添加
                  </Button>
                )}
              </div>
              <div className={moduleBody}>
                {isEditing ? (
                  <div className="space-y-1.5">
                    {priceItemEntries.map((entry, index) => (
                      <div key={index} className="flex items-center gap-1.5">
                        <Select
                          value={entry.cooperationType}
                          onValueChange={(val) => updatePriceItem(index, 'cooperationType', val)}
                        >
                          <SelectTrigger className="w-[110px] shrink-0 h-7 text-xs">
                            <SelectValue placeholder="类型" />
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
                          className="w-[80px] shrink-0 text-xs h-7"
                        />
                        <Select
                          value={entry.priceUnit}
                          onValueChange={(val) => updatePriceItem(index, 'priceUnit', val)}
                        >
                          <SelectTrigger className="w-[80px] shrink-0 h-7 text-xs">
                            <SelectValue placeholder="单位" />
                          </SelectTrigger>
                          <SelectContent>
                            {PRICE_UNIT_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => removePriceItem(index)}>
                          <Trash2Icon className="w-3 h-3 text-muted-foreground" />
                        </Button>
                      </div>
                    ))}
                    {priceItemEntries.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-1">暂无报价，点击上方「添加」</p>
                    )}
                    {priceItemEntries.length >= MAX_PRICE_ITEMS && (
                      <p className="text-[10px] text-muted-foreground">已达上限 {MAX_PRICE_ITEMS} 条</p>
                    )}
                  </div>
                ) : (
                  priceItemsView.length > 0 ? (
                    <div className="space-y-0">
                      {priceItemsView.map((item, i) => (
                        <div key={i} className={cn(
                          'flex items-center justify-between py-1.5 px-1',
                          i < priceItemsView.length - 1 && 'border-b border-border/30'
                        )}>
                          <Badge variant="outline" className="text-[10px] bg-muted/30">{item.cooperationType}</Badge>
                          <div className="flex items-baseline gap-1">
                            <span className="text-sm font-bold font-mono text-primary">{item.unitPrice}</span>
                            <span className="text-[10px] text-muted-foreground">{item.priceUnit}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    !priceRangeVal ? <p className="text-xs text-muted-foreground text-center py-1">暂无报价信息</p> : null
                  )
                )}

                {/* 报价备注（自由文本）——承接旧的 priceRange 字段，可与结构化报价并存 */}
                {isEditing ? (
                  <div className="mt-2 pt-2 border-t border-border/40">
                    <label className="text-[10px] text-muted-foreground mb-1 block">报价备注（自由文本）</label>
                    <textarea
                      value={priceRangeVal}
                      onChange={(e) => setPriceRangeVal(e.target.value)}
                      placeholder="补充说明，如「线稿300，含商用+700」；导入的旧报价也在这里"
                      rows={2}
                      className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs resize-y focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                ) : (
                  priceRangeVal ? (
                    <div className="mt-2 pt-2 border-t border-border/40">
                      <span className="text-[10px] text-muted-foreground">报价备注：</span>
                      <p className="text-xs whitespace-pre-wrap mt-0.5">{priceRangeVal}</p>
                    </div>
                  ) : null
                )}
              </div>
            </div>

            {/* Row 5: Contacts + Links — 2 column */}
            <div className={isAdmin ? "grid grid-cols-2 gap-3" : "grid grid-cols-1 gap-3"}>
              {/* Contact Module — 仅管理员可见 */}
              {isAdmin && (
              <div className={cn(moduleBase)}>
                <div className={cn(moduleHeader, 'justify-between')}>
                  <div className="flex items-center gap-1.5">
                    <PhoneIcon className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-semibold">联系方式</span>
                  </div>
                  {isEditing && (
                    <Button variant="ghost" size="sm" onClick={addContactItem} className="h-5 px-1.5 text-[10px] gap-0.5">
                      <PlusIcon className="w-3 h-3" />
                      添加
                    </Button>
                  )}
                </div>
                <div className={moduleBody}>
                  {isEditing ? (
                    <div className="space-y-1.5">
                      {contactItemEntries.map((entry, index) => (
                        <div key={index} className="flex items-center gap-1.5">
                          <Select
                            value={entry.type}
                            onValueChange={(val) => updateContactItem(index, 'type', val)}
                          >
                            <SelectTrigger className="w-[70px] shrink-0 h-7 text-xs">
                              <SelectValue placeholder="类型" />
                            </SelectTrigger>
                            <SelectContent>
                              {CONTACT_TYPE_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            placeholder="号码"
                            value={entry.value}
                            onChange={(e) => updateContactItem(index, 'value', e.target.value)}
                            className="flex-1 text-xs h-7"
                          />
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => removeContactItem(index)}>
                            <Trash2Icon className="w-3 h-3 text-muted-foreground" />
                          </Button>
                        </div>
                      ))}
                      {contactItemEntries.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-1">暂无，点击上方「添加」</p>
                      )}
                    </div>
                  ) : (
                    contactItemsView.length > 0 ? (
                      <div className="space-y-1">
                        {contactItemsView.map((item, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-xs">
                            <Badge variant="outline" className="text-[10px] bg-muted/30 shrink-0">
                              {CONTACT_TYPE_LABELS[item.type] || item.type}
                            </Badge>
                            <span className="text-foreground truncate">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-1">暂无联系方式</p>
                    )
                  )}
                </div>
              </div>
              )}

              {/* Platform Links Module */}
              <div className={cn(moduleBase)}>
                <div className={cn(moduleHeader, 'justify-between')}>
                  <div className="flex items-center gap-1.5">
                    <LinkIcon className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-semibold">平台链接</span>
                  </div>
                  {isEditing && (
                    <Button variant="ghost" size="sm" onClick={addManualLink} className="h-5 px-1.5 text-[10px] gap-0.5">
                      <PlusIcon className="w-3 h-3" />
                      添加
                    </Button>
                  )}
                </div>
                <div className={moduleBody}>
                  {isEditing ? (
                    <div className="space-y-1.5">
                      {/* 画师链接 AI 自动填充（小红书 / 米画师，自动识别平台） */}
                      <div className="rounded-md border border-primary/30 bg-primary/5 p-2 space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <Input
                            placeholder="粘贴小红书笔记链接 或 米画师画师主页链接"
                            value={xhsUrl}
                            onChange={(e) => setXhsUrl(e.target.value)}
                            className="flex-1 text-xs h-7"
                            disabled={scraping}
                          />
                          <Button
                            variant="default"
                            size="sm"
                            onClick={handleScrape}
                            disabled={scraping || !xhsUrl.trim()}
                            className="h-7 px-2 text-[10px] gap-1 shrink-0"
                          >
                            <SparklesIcon className="w-3 h-3" />
                            {scraping ? '抓取中…' : 'AI 填充'}
                          </Button>
                        </div>
                        <p className="text-[9px] text-muted-foreground">
                          支持小红书笔记链接与米画师画师主页链接，AI 自动识别平台、归纳画风/题材/采购建议，预填账号名·链接·作品图·备注，请人工确认后保存。
                        </p>
                      </div>
                      {Object.entries(socialLinksView).flatMap(([platform, urls]) =>
                        urls.map((url, ui) => (
                          <div key={`${platform}-${ui}`} className="flex items-center gap-1.5 text-xs">
                            <span className="w-12 text-muted-foreground shrink-0 text-[10px]">
                              {PLATFORM_LABELS[platform] || platform}
                            </span>
                            <Input value={url} readOnly className="flex-1 text-[10px] h-6 bg-muted/50 px-1.5" />
                            <span className="text-[9px] text-muted-foreground shrink-0">(导入)</span>
                          </div>
                        )),
                      )}
                      {manualLinkEntries.map((entry, index) => (
                        <div key={index} className="flex items-center gap-1.5">
                          <Select
                            value={entry.platform}
                            onValueChange={(val) => updateManualLink(index, 'platform', val)}
                          >
                            <SelectTrigger className="w-[70px] shrink-0 h-7 text-xs">
                              <SelectValue placeholder="平台" />
                            </SelectTrigger>
                            <SelectContent>
                              {PLATFORM_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            placeholder="链接"
                            value={entry.url}
                            onChange={(e) => updateManualLink(index, 'url', e.target.value)}
                            className="flex-1 text-xs h-7"
                          />
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => removeManualLink(index)}>
                            <Trash2Icon className="w-3 h-3 text-muted-foreground" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    Object.keys(allLinks).length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(allLinks).flatMap(([platform, urls]) =>
                          urls.map((url, ui) => (
                            <Button
                              key={`${platform}-${ui}`}
                              variant="outline"
                              size="sm"
                              className="h-6 px-2 gap-1 text-[10px]"
                              onClick={() => window.open(url, '_blank')}
                            >
                              {PLATFORM_LABELS[platform] || platform}
                              {urls.length > 1 ? ` ${ui + 1}` : ''}
                              <ExternalLinkIcon className="w-2.5 h-2.5" />
                            </Button>
                          )),
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-1">暂无平台链接</p>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Row 6: Notes (full width) */}
            <div className={cn(moduleBase)}>
              <div className={moduleHeader}>
                <FileTextIcon className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-semibold">备注</span>
              </div>
              <div className={moduleBody}>
                {isEditing ? (
                  <div className="space-y-2">
                    {/* 快捷模板标签 */}
                    <div className="flex flex-wrap gap-1.5 items-center">
                      {PRESET_NOTES.map(t => (
                        <button key={t} type="button" onClick={() => appendNote(t)}
                          className="px-2 py-0.5 rounded-full text-[11px] bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary border border-border hover:border-primary/30 transition-colors">
                          {t}
                        </button>
                      ))}
                      {customNotes.map((t, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-blue-50 text-blue-700 border border-blue-200">
                          <button type="button" onClick={() => appendNote(t)} className="hover:underline">{t}</button>
                          <button type="button" onClick={() => removeCustomNote(i)} className="opacity-50 hover:opacity-100 text-[10px] leading-none">×</button>
                        </span>
                      ))}
                      {showNoteInput ? (
                        <span className="inline-flex items-center gap-1">
                          <input
                            autoFocus
                            value={noteInput}
                            onChange={e => setNoteInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveCustomNote(); if (e.key === 'Escape') { setShowNoteInput(false); setNoteInput(''); } }}
                            placeholder="输入常用语"
                            className="h-6 px-2 text-[11px] border rounded-full w-24 outline-none focus:border-primary"
                          />
                          <button type="button" onClick={saveCustomNote} className="text-[11px] text-primary hover:underline">保存</button>
                          <button type="button" onClick={() => { setShowNoteInput(false); setNoteInput(''); }} className="text-[11px] text-muted-foreground hover:text-foreground">取消</button>
                        </span>
                      ) : (
                        <button type="button" onClick={() => setShowNoteInput(true)}
                          className="px-2 py-0.5 rounded-full text-[11px] border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                          ＋ 添加常用语
                        </button>
                      )}
                    </div>
                    <LimitedTextarea
                      value={contactInfoText}
                      onChange={setContactInfoText}
                      placeholder="特殊要求等"
                      className="text-xs"
                      minHeight="min-h-[100px]"
                    />
                    {/* 佐证图片区 */}
                    <div className="border-t border-border/40 pt-2 space-y-2">
                      <p className="text-[10px] text-muted-foreground">佐证图片</p>
                      {noteImages.length > 0 && (
                        <div className="grid grid-cols-3 gap-2">
                          {noteImages.map((url, idx) => (
                            <div key={idx} className="relative aspect-[4/3] rounded-lg overflow-hidden group border border-border">
                              <img
                                src={url}
                                alt={`佐证 ${idx + 1}`}
                                className="w-full h-full object-cover cursor-zoom-in"
                                onClick={() => setNoteLightboxIndex(idx)}
                              />
                              <button
                                onClick={(e) => { e.stopPropagation(); setNoteImages(prev => prev.filter((_, i) => i !== idx)); }}
                                className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2Icon className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div
                        className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer min-h-[80px] flex flex-col items-center justify-center"
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
                        <UploadIcon className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
                        <p className="text-xs text-muted-foreground">点击上传或粘贴图片</p>
                        {uploading && <p className="text-xs text-primary mt-1">上传中...</p>}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {supplier.contactInfo ? (
                      <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                        {supplier.contactInfo}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-1">暂无备注</p>
                    )}
                    {noteImages.length > 0 && (
                      <div className="border-t border-border/40 pt-2">
                        <p className="text-[10px] text-muted-foreground mb-1.5">佐证图片</p>
                        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
                          {noteImages.map((url, idx) => (
                            <div
                              key={idx}
                              className="flex-shrink-0 h-[160px] rounded-lg overflow-hidden bg-muted border border-border cursor-zoom-in hover:border-primary/50 transition-colors group relative"
                              onClick={() => setNoteLightboxIndex(idx)}
                            >
                              <img
                                src={url}
                                alt={`佐证 ${idx + 1}`}
                                className="h-full w-auto max-w-[280px] object-cover group-hover:scale-[1.02] transition-transform duration-200"
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs bg-black/50 px-2 py-1 rounded-full">查看大图</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Row 7: 历史参与项目 (full width) */}
            <div className={cn(moduleBase)}>
              <div className={moduleHeader}>
                <Building2Icon className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-semibold">历史参与项目</span>
              </div>
              <div className={moduleBody}>
                {isEditing ? (
                  <Select value={entityTypeVal || '__none__'} onValueChange={(v) => setEntityTypeVal(v === '__none__' ? '' : v)}>
                    <SelectTrigger className="h-7 text-xs w-full">
                      <SelectValue placeholder="选择项目" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">
                        <span className="text-muted-foreground">未设置</span>
                      </SelectItem>
                      {projectOptions.map((opt: string) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  supplier.entityType ? (
                    <Badge variant="outline" className="text-[10px] bg-accent text-accent-foreground">
                      {supplier.entityType}
                    </Badge>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-1">未设置</p>
                  )
                )}
              </div>
            </div>

            {/* Row 8: 合同 / 税务 (仅管理员) */}
            {isAdmin && (
            <div className={cn(moduleBase)}>
              <div className={moduleHeader}>
                <FileTextIcon className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-semibold">合同 / 税务</span>
                {!isEditing && (() => {
                  const st = deadlineStatus(supplier.contractDeadline);
                  return st && st.days <= 30 ? (
                    <Badge variant="outline" className={cn('ml-auto text-[10px]', st.tone)}>
                      {st.label}
                    </Badge>
                  ) : null;
                })()}
              </div>
              <div className={moduleBody}>
                {isEditing ? (
                  <div className="grid grid-cols-2 gap-2.5">
                    <label className="flex flex-col gap-1">
                      <span className="text-[10px] text-muted-foreground">合同主体</span>
                      <Input value={contractEntityVal} onChange={(e) => setContractEntityVal(e.target.value)} className="h-7 text-xs" placeholder="签约主体" />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[10px] text-muted-foreground">合同类型</span>
                      <Input value={contractTypeVal} onChange={(e) => setContractTypeVal(e.target.value)} className="h-7 text-xs" placeholder="如 框架/单次" />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[10px] text-muted-foreground">合同编号</span>
                      <Input value={contractNoVal} onChange={(e) => setContractNoVal(e.target.value)} className="h-7 text-xs" placeholder="编号" />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[10px] text-muted-foreground">合同到期日</span>
                      <Input type="date" value={contractDeadlineVal} onChange={(e) => setContractDeadlineVal(e.target.value)} className="h-7 text-xs" />
                    </label>
                    <label className="flex flex-col gap-1 col-span-2">
                      <span className="text-[10px] text-muted-foreground">税务状态</span>
                      <Input value={taxStatusVal} onChange={(e) => setTaxStatusVal(e.target.value)} className="h-7 text-xs" placeholder="如 已开票/待开票/免税" />
                    </label>
                  </div>
                ) : (
                  (supplier.contractEntity || supplier.contractType || supplier.contractNo || supplier.contractDeadline || supplier.taxStatus) ? (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                      <div><span className="text-muted-foreground">合同主体：</span>{supplier.contractEntity || '—'}</div>
                      <div><span className="text-muted-foreground">合同类型：</span>{supplier.contractType || '—'}</div>
                      <div><span className="text-muted-foreground">合同编号：</span>{supplier.contractNo || '—'}</div>
                      <div>
                        <span className="text-muted-foreground">到期日：</span>
                        {supplier.contractDeadline ? (
                          <>
                            {String(supplier.contractDeadline).slice(0, 10)}
                            {(() => {
                              const st = deadlineStatus(supplier.contractDeadline);
                              return st ? <span className={cn('ml-1', st.tone)}>（{st.label}）</span> : null;
                            })()}
                          </>
                        ) : '—'}
                      </div>
                      <div className="col-span-2"><span className="text-muted-foreground">税务状态：</span>{supplier.taxStatus || '—'}</div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-1">未设置</p>
                  )
                )}
              </div>
            </div>
            )}

            {/* Edit action buttons */}
            {isEditing && (
              <div className="flex justify-between pt-1 pb-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2Icon className="w-3.5 h-3.5 mr-1" />
                  删除
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCancel}>
                    取消
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? '保存中...' : <><CheckIcon className="w-3.5 h-3.5 mr-1" />保存</>}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>

    {/* 放弃编辑确认 */}
    <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertTitle>放弃编辑？</AlertTitle>
          <AlertDialogDescription>未保存的修改将会丢失。</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>继续编辑</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive hover:bg-destructive/90"
            onClick={() => { handleCancel(); onClose(); }}
          >
            放弃
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    {/* 删除确认 AlertDialog */}
    <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertTitle>确认删除？</AlertTitle>
          <AlertDialogDescription>
            将永久删除「{supplier?.accountName}」，此操作可通过变更记录撤回。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive hover:bg-destructive/90"
            onClick={handleDelete}
          >
            确认删除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* 加入候选清单 */}
    {supplier && (
      <AddToShortlistDialog
        open={addShortlistOpen}
        onClose={() => setAddShortlistOpen(false)}
        supplierIds={[supplier.id]}
      />
    )}

    {/* 作品灯箱 */}
    {lightboxIndex !== null && artworkUrls.length > 0 && (
      <LightboxOverlay
        urls={artworkUrls.map(artworkSrc)}
        startIndex={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
      />
    )}

    {/* 备注佐证图片灯箱 */}
    {noteLightboxIndex !== null && noteImages.length > 0 && (
      <LightboxOverlay
        urls={noteImages}
        startIndex={noteLightboxIndex}
        onClose={() => setNoteLightboxIndex(null)}
      />
    )}
    </>
  );
}
