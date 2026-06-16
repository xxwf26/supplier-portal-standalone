import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { UsersIcon, UserIcon, Building2Icon, BuildingIcon, ActivityIcon } from 'lucide-react';
import { supplierApi } from '@/api/supplier';
import { ISupplierStatistics } from '@/api/types';
import { logger } from '@/lib/polyfills/logger';

interface IStatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  delay?: number;
}

const StatCard: React.FC<IStatCardProps> = ({ icon, label, value, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay }}
    className="flex-shrink-0 flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-3"
  >
    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
      {icon}
    </div>
    <div>
      <div className="text-2xl font-bold text-white font-mono">{value}</div>
      <div className="text-xs text-white/80">{label}</div>
    </div>
  </motion.div>
);

interface HeaderSectionProps {
  viewMode?: 'pc' | 'mobile';
}

export default function HeaderSection({ viewMode = 'pc' }: HeaderSectionProps) {
  const [stats, setStats] = useState<ISupplierStatistics>({
    total: 0,
    individualCount: 0,
    companyCount: 0,
    activeCount: 0,
    categoryCount: {},
    riskCount: {},
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatistics = async () => {
      try {
        const data = await supplierApi.getStatistics();
        setStats(data);
      } catch (error) {
        logger.error('Failed to fetch statistics:', String(error));
      } finally {
        setLoading(false);
      }
    };

    fetchStatistics();
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const studioCount = stats.total - (stats.individualCount + stats.companyCount);

  const statCards = [
    { icon: <UsersIcon className="w-5 h-5 text-white" />, label: '供应商总数', value: loading ? 0 : stats.total, delay: 0.1 },
    { icon: <UserIcon className="w-5 h-5 text-white" />, label: '个人画师', value: loading ? 0 : stats.individualCount, delay: 0.2 },
    { icon: <BuildingIcon className="w-5 h-5 text-white" />, label: '工作室', value: loading ? 0 : studioCount, delay: 0.3 },
    { icon: <Building2Icon className="w-5 h-5 text-white" />, label: '公司', value: loading ? 0 : stats.companyCount, delay: 0.4 },
    { icon: <ActivityIcon className="w-5 h-5 text-white" />, label: '库内合作供应商', value: loading ? 0 : stats.activeCount, delay: 0.5 },
  ];

  return (
    <header className="w-full bg-[hsl(270_60%_55%)] text-white">
      <div className="w-full px-4 md:px-6 py-5">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className={
            viewMode === 'mobile'
              ? 'flex flex-col gap-4'
              : 'flex items-center justify-between gap-6'
          }
        >
          {/* 左侧：系统名称（放大） */}
          <div className="flex items-center gap-4 flex-shrink-0">
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <UsersIcon className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold leading-tight tracking-tight">个人画师库可视化平台</h1>
              <p className="text-sm text-white/70 mt-1">美术类供应商/画师管理平台</p>
            </div>
          </div>

          {/* 右侧：统计卡片（手机模式横向滚动，PC 模式靠右换行） */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className={
              viewMode === 'mobile'
                ? 'flex gap-3 overflow-x-auto pb-1 scrollbar-none'
                : 'flex flex-wrap gap-3 justify-end'
            }
          >
            {statCards.map((card) => (
              <StatCard key={card.label} {...card} />
            ))}
          </motion.div>
        </motion.div>
      </div>
    </header>
  );
}
