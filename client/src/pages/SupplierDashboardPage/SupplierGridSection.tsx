import React from 'react';
import { motion } from 'framer-motion';
import {
  AwardIcon,
  Building2Icon,
  GraduationCapIcon,
  ImageIcon,
  PaletteIcon,
  UserIcon,
  CheckIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import { IPriceItem, IContactItem } from '@/api/types';

export interface IProcessedSupplier {
  id: string;
  name: string;
  type: 'individual' | 'studio' | 'company' | 'artist';
  styles: string[];
  cooperationTypes: string[];
  priceRange: [number, number];
  priceUnit: string;
  priceText: string | null;
  priceItems: IPriceItem[];
  contactItems: IContactItem[];
  status: 'in_stock' | 'outreach' | 'blacklisted';
  project: string[];
  contacts?: {
    wechat?: string;
    email?: string;
  };
  links?: Record<string, string>;
  notes?: string;
  works?: string[];
  history?: string[];
  rating: number | null;
  cooperationCount: number;
  riskStatus: string;
  cooperationCategory: string | null;
}

const typeConfig = {
  individual: {
    label: '个人',
    color: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    icon: UserIcon,
  },
  artist: {
    label: '艺术家',
    color: 'bg-purple-50 text-purple-600 border-purple-200',
    icon: AwardIcon,
  },
  studio: {
    label: '工作室',
    color: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    icon: PaletteIcon,
  },
  company: {
    label: '公司',
    color: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    icon: Building2Icon,
  },
};

const statusConfig = {
  in_stock: {
    label: '库内合作',
    color: 'bg-green-50 text-green-600 border-green-200',
  },
  outreach: {
    label: '库外建联',
    color: 'bg-blue-50 text-blue-600 border-blue-200',
  },
  blacklisted: {
    label: '已拉黑',
    color: 'bg-gray-50 text-gray-500 border-gray-200',
  },
};

const styleColors: Record<string, string> = {
  古风: 'bg-red-50 text-red-600 border-red-200',
  'Q版': 'bg-amber-50 text-amber-600 border-amber-200',
  正比: 'bg-yellow-50 text-yellow-600 border-yellow-200',
  欧风: 'bg-cyan-50 text-cyan-600 border-cyan-200',
  写实: 'bg-blue-50 text-blue-600 border-blue-200',
  少女风: 'bg-pink-50 text-pink-600 border-pink-200',
  赛博朋克: 'bg-purple-50 text-purple-600 border-purple-200',
  立绘: 'bg-green-50 text-green-600 border-green-200',
  小物: 'bg-teal-50 text-teal-600 border-teal-200',
  场景: 'bg-sky-50 text-sky-600 border-sky-200',
  KKV: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  'L2D动效': 'bg-emerald-50 text-emerald-600 border-emerald-200',
  手书: 'bg-rose-50 text-rose-600 border-rose-200',
  '3D建模': 'bg-slate-50 text-slate-600 border-slate-200',
  像素风: 'bg-lime-50 text-lime-600 border-lime-200',
  推文长图: 'bg-stone-50 text-stone-600 border-stone-200',
  解说视频: 'bg-sky-50 text-sky-600 border-sky-200',
  逐帧动画: 'bg-orange-50 text-orange-600 border-orange-200',
  包装视频: 'bg-violet-50 text-violet-600 border-violet-200',
  'PV整包': 'bg-fuchsia-50 text-fuchsia-600 border-fuchsia-200',
  特效原画: 'bg-red-50 text-red-600 border-red-200',
  广告投放: 'bg-amber-50 text-amber-600 border-amber-200',
  活动搭建: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  达人合作: 'bg-pink-50 text-pink-600 border-pink-200',
};

const platformLabels: Record<string, string> = {
  weibo: '微博',
  pixiv: 'Pixiv',
  xiaohongshu: '小红书',
  website: '官网',
  bilibili: 'B站',
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 24,
    },
  },
};

const SupplierCard = React.memo(function SupplierCard({
  supplier,
  onSelect,
  isSelected,
  onToggleSelect,
}: {
  supplier: IProcessedSupplier;
  onSelect: (supplier: IProcessedSupplier) => void;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
}) {
  const typeInfo = typeConfig[supplier.type];
  const statusInfo = statusConfig[supplier.status];
  const hasLinks = Object.keys(supplier.links || {}).length > 0;
  const firstPlatformKey = Object.keys(supplier.links || {})[0];
  const firstPlatform = firstPlatformKey
    ? platformLabels[firstPlatformKey] || firstPlatformKey
    : null;

  const displayPrice = supplier.priceItems && supplier.priceItems.length > 0
    ? supplier.priceItems.map((p) => `${p.cooperationType} ${p.unitPrice}${p.priceUnit}`).join(' | ')
    : (supplier.priceText || '');

  return (
    <motion.div
      variants={itemVariants}
      whileHover={{
        scale: 1.02,
        y: -4,
        transition: { duration: 0.15 },
      }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onSelect(supplier)}
      className={cn(
        'group relative cursor-pointer overflow-hidden rounded-xl border bg-card',
        'border-border shadow-sm',
        'hover:border-primary/30 hover:shadow-md',
        'transition-shadow duration-200',
        isSelected && 'ring-2 ring-primary border-primary/30'
      )}
    >
      {/* Selection checkbox */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelect(supplier.id);
        }}
        className={cn(
          'absolute top-2 left-2 z-10 w-5 h-5 rounded border-2 flex items-center justify-center transition-all',
          isSelected
            ? 'bg-primary border-primary text-white'
            : 'bg-white/80 border-gray-300 opacity-0 group-hover:opacity-100'
        )}
      >
        {isSelected && <CheckIcon className="w-3 h-3" />}
      </button>

      {/* Artwork Image */}
      <div className="relative w-full h-[150px] bg-muted overflow-hidden">
        {supplier.works && supplier.works.length > 0 ? (
          <img
            src={supplier.works[0]}
            alt={supplier.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/5 to-accent/10">
            <ImageIcon className="w-10 h-10 text-muted-foreground/25" />
          </div>
        )}
      </div>

      {/* Card Content */}
      <div className="p-3">
        {/* Title + URL Status */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="flex-1 text-sm font-bold text-foreground line-clamp-1">
            {supplier.name}
          </h3>
          <Badge
            variant="outline"
            className={cn(
              'shrink-0 px-2 py-0 text-[10px] font-medium',
              hasLinks
                ? 'bg-blue-50 text-blue-600 border-blue-200'
                : 'bg-orange-50 text-orange-600 border-orange-200'
            )}
          >
            {hasLinks ? '已补URL' : '待补URL'}
          </Badge>
        </div>

        {/* Platform · Rating · Frequency */}
        <div className="mt-1 text-xs text-muted-foreground">
          {firstPlatform || '未知平台'} · 评分 {supplier.rating ?? '-'} · 频次{' '}
          {supplier.cooperationCount}
        </div>

        {/* Tags */}
        <div className="mt-2 flex flex-wrap gap-1">
          <span
            className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border',
              typeInfo.color
            )}
          >
            {typeInfo.label}
          </span>
          {supplier.cooperationCategory && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-600 border border-emerald-200">
              {supplier.cooperationCategory}
            </span>
          )}
          {supplier.styles.slice(0, 2).map((style) => (
            <span
              key={style}
              className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border',
                styleColors[style] || 'bg-muted text-muted-foreground border-border'
              )}
            >
              {style}
            </span>
          ))}
          {supplier.status === 'blacklisted' && (
            <span
              className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border',
                statusInfo.color
              )}
            >
              {supplier.riskStatus}
            </span>
          )}
        </div>

        {/* Price Info */}
        {displayPrice && (
          <div className="mt-2 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {displayPrice}
          </div>
        )}

        {/* Contact Info */}
        {supplier.contactItems && supplier.contactItems.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {supplier.contactItems.map((c, i) => (
              <span
                key={i}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-gray-50 text-gray-600 border border-gray-200"
              >
                {c.type === 'wechat' ? '微信' : c.type === 'qq' ? 'QQ' : '电话'}: {c.value}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
});

export default React.memo(function SupplierGridSection({
  suppliers,
  onSelect,
  selectedIds = new Set<string>(),
  onToggleSelect,
}: {
  suppliers: IProcessedSupplier[];
  onSelect: (supplier: IProcessedSupplier) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}) {
  return (
    <section className="w-full">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
      >
        {suppliers.map((supplier) => (
          <SupplierCard
            key={supplier.id}
            supplier={supplier}
            onSelect={onSelect}
            isSelected={selectedIds.has(supplier.id)}
            onToggleSelect={onToggleSelect || (() => {})}
          />
        ))}
      </motion.div>
    </section>
  );
});
