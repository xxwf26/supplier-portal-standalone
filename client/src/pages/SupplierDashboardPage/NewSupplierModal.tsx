import React, { useState } from 'react';
import { UserPlusIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

export default function NewSupplierModal({ open, onClose, onCreated }: NewSupplierModalProps) {
  const [saving, setSaving] = useState(false);

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
  };

  const handleClose = () => {
    resetForm();
    onClose();
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
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl w-full max-h-[85vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <UserPlusIcon className="w-5 h-5 text-primary" />
            新建供应商
          </DialogTitle>
        </DialogHeader>

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
                onChange={(e) => setContactInfo(e.target.value)}
                placeholder="特殊要求等"
                className="min-h-[80px] text-sm"
              />
            </div>
          </div>

        <div className="px-6 py-4 border-t border-border flex justify-end gap-2 shrink-0">
          <Button variant="outline" onClick={handleClose}>取消</Button>
          <Button onClick={handleSubmit} disabled={saving || !accountName.trim()}>
            {saving ? '创建中...' : '创建供应商'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
