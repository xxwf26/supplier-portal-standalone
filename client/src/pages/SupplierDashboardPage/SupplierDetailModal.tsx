import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ExternalLinkIcon, MessageCircleIcon, StarIcon,
  TagIcon, BanknoteIcon, FileTextIcon, UploadIcon, Trash2Icon,
  PencilIcon, PlusIcon, LinkIcon, ImageIcon, XIcon, CheckIcon,
  PhoneIcon, ShieldIcon, ArchiveRestoreIcon,
  ChevronLeftIcon, ChevronRightIcon, Building2Icon,
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
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/polyfills/logger';
import { getDataloom } from '@/lib/polyfills/storage';
import { getDefaultBucketId } from '@/lib/polyfills/storage';
import { useAuth } from '@/lib/auth';
import { useFilterOptions } from '@/hooks/useFilterOptions';
import { supplierTypeToBackend } from '@/lib/filterConfig';
import { inferSupplierType } from '@/lib/supplierUtils';
import { LimitedTextarea } from '@/components/ui/limited-textarea';

const typeConfig = {
  individual: { label: '个人画师', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  artist: { label: '艺术家', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  studio: { label: '工作室', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  company: { label: '公司', color: 'bg-amber-100 text-amber-700 border-amber-200' },
};

const statusConfig = {
  in_stock: { label: '库内合作', color: 'bg-green-100 text-green-700 border-green-200', dotColor: 'bg-green-500' },
  outreach: { label: '库外建联', color: 'bg-blue-100 text-blue-700 border-blue-200', dotColor: 'bg-blue-500' },
  blacklisted: { label: '已拉黑', color: 'bg-gray-100 text-gray-600 border-gray-200', dotColor: 'bg-gray-400' },
};

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

const PLATFORM_OPTIONS = [
  { value: 'xiaohongshu', label: '小红书' },
  { value: 'weibo', label: '微博' },
  { value: 'mihuashi', label: '米画师' },
  { value: 'x', label: 'X' },
];

const platformLabels: Record<string, string> = {
  weibo: '微博',
  pixiv: 'Pixiv',
  xiaohongshu: '小红书',
  website: '官网',
  bilibili: 'B站',
  mihuashi: '米画师',
  x: 'X',
};

const contactTypeLabels: Record<string, string> = {
  wechat: '微信',
  qq: 'QQ',
  phone: '电话',
};

interface ManualLinkEntry {
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

interface SupplierDetailModalProps {
  supplier: ISupplier | null;
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void;
}

const MAX_PRICE_ITEMS = 5;
const MAX_CONTACT_ITEMS = 10;

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
      className="fixed inset-0 z-[200] bg-black/92 flex items-center justify-center"
      onClick={onClose}
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

function getStatusFromData(supplier: ISupplier): 'in_stock' | 'outreach' | 'blacklisted' {
  if (supplier.riskStatus === '拉黑') return 'blacklisted';
  if (supplier.isInStock) return 'in_stock';
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
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [artworkUrls, setArtworkUrls] = useState<string[]>([]);
  const [manualLinkEntries, setManualLinkEntries] = useState<ManualLinkEntry[]>([]);
  const [priceItemEntries, setPriceItemEntries] = useState<PriceItemEntry[]>([]);
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
  const [newTagInput, setNewTagInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

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
      if (d.manualLinkEntries) setManualLinkEntries(d.manualLinkEntries);
      if (d.priceItemEntries) setPriceItemEntries(d.priceItemEntries);
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
          artworkUrls, manualLinkEntries, priceItemEntries, contactItemEntries,
          cooperationTypeVal, cooperationCountVal, ratingVal, statusVal,
          styleTags, contactInfoText, nameVal, supplierTypeVal, entityTypeVal,
          savedAt: new Date().toISOString(),
        }));
      } catch {}
    }, 400);
    return () => clearTimeout(timer);
  }, [isEditing, draftKey, artworkUrls, manualLinkEntries, priceItemEntries,
    contactItemEntries, cooperationTypeVal, cooperationCountVal, ratingVal,
    statusVal, styleTags, contactInfoText, nameVal, supplierTypeVal, entityTypeVal]);

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

  const handleWantsToClose = () => {
    if (isEditing) { setShowConfirm(true); return; }
    onClose();
  };

  const resetForm = () => {
    if (!supplier) return;
    setArtworkUrls(supplier.artworkUrls || []);
    const entries: ManualLinkEntry[] = Object.entries(supplier.manualLinks || {})
      .filter(([, v]) => v)
      .map(([platform, url]) => ({ platform, url }));
    setManualLinkEntries(entries);
    setPriceItemEntries(
      (supplier.priceItems || []).map((p) => ({
        cooperationType: p.cooperationType,
        unitPrice: String(p.unitPrice),
        priceUnit: p.priceUnit,
      }))
    );
    setContactItemEntries(
      (supplier.contactItems || []).map((c) => ({
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
      setCooperationCountVal(String(supplier.cooperationCount || 0));
      setRatingVal(supplier.rating != null ? String(supplier.rating) : '');
      setStatusVal(getStatusFromData(supplier));
      setSupplierTypeVal(supplier.supplierType || '');
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
    setSaving(true);
    try {
      const manualLinksRecord: Record<string, string> = {};
      manualLinkEntries.forEach((entry) => {
        if (entry.platform && entry.url) {
          const url = entry.url.trim();
          if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
            toast.error(`链接格式不正确：${url}（需以 http:// 或 https:// 开头）`);
            setSaving(false);
            return;
          }
          manualLinksRecord[entry.platform] = url;
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

      await supplierApi.update(supplier.id, {
        accountName: nameVal.trim(),
        artworkUrls,
        manualLinks: manualLinksRecord,
        priceItems,
        contactItems,
        cooperationType: cooperationTypeVal.length > 0 ? cooperationTypeVal.join('、') : undefined,
        cooperationCount: cooperationCountVal ? Number(cooperationCountVal) : 0,
        rating: ratingVal ? Number(ratingVal) : null,
        subCategory: styleTags.join('、') || undefined,
        contactInfo: contactInfoText,
        supplierType: supplierTypeVal ? supplierTypeToBackend(supplierTypeVal) : undefined,
        entityType: entityTypeVal || undefined,
        isInStock: statusVal === 'in_stock',
        riskStatus: statusVal === 'blacklisted' ? '拉黑' : '暂无',
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

  const allLinks: Record<string, string> = {};
  Object.entries(supplier.socialLinks || {}).forEach(([k, v]) => { if (v) allLinks[k] = v; });
  Object.entries(supplier.manualLinks || {}).forEach(([k, v]) => { if (v) allLinks[k] = v; });

  const type = inferSupplierType(supplier.accountName || '', supplier.supplierType);

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

  const availablePresets = stylePresets.filter((p: string) => !styleTags.includes(p));

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
        onPointerDownOutside={(e) => { if (isEditing) { e.preventDefault(); setShowConfirm(true); } }}
        onEscapeKeyDown={(e) => { if (isEditing) { e.preventDefault(); setShowConfirm(true); } }}
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
                    {typeInfo.label}
                  </Badge>
                )}
                <Badge variant="outline" className={cn(statusInfo.color, 'text-xs')}>
                  <span className={cn('w-1.5 h-1.5 rounded-full mr-1.5', statusInfo.dotColor)} />
                  {statusInfo.label}
                </Badge>
              </div>
            </div>
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

        <ScrollArea className="max-h-[calc(90vh-100px)]">
          <div className="px-4 py-4 space-y-3">

            {/* Row 1: Stats Dashboard — 3 column */}
            <div className={cn(moduleBase)}>
              <div className={moduleHeader}>
                <ShieldIcon className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-semibold">概览</span>
              </div>
              <div className="grid grid-cols-3 divide-x divide-border/40">
                {/* Status */}
                <div className="p-3 text-center">
                  <p className="text-[10px] text-muted-foreground mb-1">合作状态</p>
                  {isEditing ? (
                    <Select value={statusVal} onValueChange={setStatusVal}>
                      <SelectTrigger className="h-7 text-xs px-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
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
                              src={url}
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
                            src={url}
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
                    <div className="space-y-1 max-h-[180px] overflow-y-auto">
                      {cooperationTypeOptions.map((opt) => (
                        <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer group">
                          <Checkbox
                            checked={cooperationTypeVal.includes(opt.value)}
                            onCheckedChange={() => toggleCooperationType(opt.value)}
                            className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                          />
                          <span className="text-xs text-foreground group-hover:text-primary transition-colors">
                            {opt.label}
                          </span>
                        </label>
                      ))}
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
                  supplier.priceItems && supplier.priceItems.length > 0 ? (
                    <div className="space-y-0">
                      {supplier.priceItems.map((item, i) => (
                        <div key={i} className={cn(
                          'flex items-center justify-between py-1.5 px-1',
                          i < supplier.priceItems!.length - 1 && 'border-b border-border/30'
                        )}>
                          <Badge variant="outline" className="text-[10px] bg-muted/30">{item.cooperationType}</Badge>
                          <div className="flex items-baseline gap-1">
                            <span className="text-sm font-bold font-mono text-primary">{item.unitPrice}</span>
                            <span className="text-[10px] text-muted-foreground">{item.priceUnit}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : supplier.priceRange ? (
                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{supplier.priceRange}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-1">暂无报价信息</p>
                  )
                )}
              </div>
            </div>

            {/* Row 5: Contacts + Links — 2 column */}
            <div className="grid grid-cols-2 gap-3">
              {/* Contact Module */}
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
                    supplier.contactItems && supplier.contactItems.length > 0 ? (
                      <div className="space-y-1">
                        {supplier.contactItems.map((item, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-xs">
                            <Badge variant="outline" className="text-[10px] bg-muted/30 shrink-0">
                              {contactTypeLabels[item.type] || item.type}
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
                      {Object.entries(supplier.socialLinks || {}).filter(([, v]) => v).map(([platform, url]) => (
                        <div key={platform} className="flex items-center gap-1.5 text-xs">
                          <span className="w-12 text-muted-foreground shrink-0 text-[10px]">
                            {platformLabels[platform] || platform}
                          </span>
                          <Input value={url} readOnly className="flex-1 text-[10px] h-6 bg-muted/50 px-1.5" />
                          <span className="text-[9px] text-muted-foreground shrink-0">(导入)</span>
                        </div>
                      ))}
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
                        {Object.entries(allLinks).map(([platform, url]) => (
                          <Button
                            key={platform}
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 gap-1 text-[10px]"
                            onClick={() => window.open(url, '_blank')}
                          >
                            {platformLabels[platform] || platform}
                            <ExternalLinkIcon className="w-2.5 h-2.5" />
                          </Button>
                        ))}
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
                  <LimitedTextarea
                    value={contactInfoText}
                    onChange={setContactInfoText}
                    placeholder="特殊要求等"
                    className="text-xs"
                    minHeight="min-h-[120px]"
                  />
                ) : (
                  supplier.contactInfo ? (
                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                      {supplier.contactInfo}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-1">暂无备注</p>
                  )
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
                  <Select value={entityTypeVal} onValueChange={setEntityTypeVal}>
                    <SelectTrigger className="h-7 text-xs w-full">
                      <SelectValue placeholder="选择项目" />
                    </SelectTrigger>
                    <SelectContent>
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

    {/* 全屏灯箱 */}
    {lightboxIndex !== null && artworkUrls.length > 0 && (
      <LightboxOverlay
        urls={artworkUrls}
        startIndex={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
      />
    )}
    </>
  );
}
