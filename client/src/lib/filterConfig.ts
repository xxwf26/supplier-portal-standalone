// 共享筛选配置 — 全站唯一数据源
// 由 SystemConfigPage 管理，FilterPanelSection / NewSupplierModal 消费

// v2：供应商类型统一为中文全称（个人画师/艺术家/工作室/公司），升版以丢弃旧浏览器里缓存的英文 value 配置
export const STORAGE_KEY = '__admin_filter_config_v2';

export interface FilterOption {
  label: string;
  value: string;
  color?: string;
}

export interface FilterConfig {
  supplierType: FilterOption[];
  cooperationType: FilterOption[];
  style: FilterOption[];
  cooperationStatus: FilterOption[];
  project: FilterOption[];
}

export const DEFAULT_FILTER_CONFIG: FilterConfig = {
  supplierType: [
    { label: '个人画师', value: '个人画师', color: 'blue' },
    { label: '艺术家', value: '艺术家', color: 'purple' },
    { label: '工作室', value: '工作室', color: 'green' },
    { label: '公司', value: '公司', color: 'amber' },
  ],
  cooperationType: [
    { label: '角色原画', value: '角色原画' },
    { label: '场景原画', value: '场景原画' },
    { label: '平面海报', value: '平面海报' },
    { label: 'UI图标', value: 'UI图标' },
    { label: '视频动效', value: '视频动效' },
    { label: '平面拍摄', value: '平面拍摄' },
    { label: '视频拍摄', value: '视频拍摄' },
    { label: '达人营销', value: '达人营销' },
    { label: '驻场合作', value: '驻场合作' },
    { label: '笔替', value: '笔替' },
    { label: '文案', value: '文案' },
  ],
  style: [
    { label: 'Q版', value: 'Q版', color: 'amber' },
    { label: '正比', value: '正比', color: 'yellow' },
    { label: '古风', value: '古风', color: 'red' },
    { label: '欧风', value: '欧风', color: 'cyan' },
    { label: '写实', value: '写实', color: 'blue' },
    { label: '少女风', value: '少女风', color: 'pink' },
    { label: '赛博朋克', value: '赛博朋克', color: 'purple' },
    { label: '立绘', value: '立绘', color: 'green' },
    { label: '小物', value: '小物', color: 'teal' },
    { label: '场景', value: '场景', color: 'sky' },
    { label: 'KKV', value: 'KKV', color: 'indigo' },
    { label: 'L2D动效', value: 'L2D动效', color: 'emerald' },
    { label: '手书', value: '手书', color: 'rose' },
    { label: '3D建模', value: '3D建模', color: 'slate' },
    { label: '像素风', value: '像素风', color: 'lime' },
    { label: '推文长图', value: '推文长图', color: 'stone' },
    { label: '解说视频', value: '解说视频', color: 'sky' },
    { label: '逐帧动画', value: '逐帧动画', color: 'orange' },
    { label: '包装视频', value: '包装视频', color: 'violet' },
    { label: 'PV整包', value: 'PV整包', color: 'fuchsia' },
    { label: '特效原画', value: '特效原画', color: 'red' },
    { label: '广告投放', value: '广告投放', color: 'amber' },
    { label: '活动搭建', value: '活动搭建', color: 'emerald' },
    { label: '达人合作', value: '达人合作', color: 'pink' },
  ],
  cooperationStatus: [
    { label: '库内合作', value: 'in_stock', color: 'text-green-600' },
    { label: '库外建联', value: 'outreach', color: 'text-blue-600' },
    { label: '已拉黑', value: 'blacklisted', color: 'text-gray-500' },
  ],
  project: [
    { label: '恋与制作人', value: '恋与制作人' },
    { label: '深空', value: '深空' },
    { label: '闪暖', value: '闪暖' },
    { label: '无暖', value: '无暖' },
    { label: '无期迷途', value: '无期迷途' },
    { label: 'IP开发中心', value: 'IP开发中心' },
    { label: '通用', value: '通用' },
  ],
};

export const CATEGORY_LABELS: Record<string, string> = {
  supplierType: '供应商类型',
  cooperationType: '合作类型',
  style: '擅长风格',
  cooperationStatus: '合作状态',
  project: '所属项目',
};