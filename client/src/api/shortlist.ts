import { axiosForBackend } from '@/api';

const BASE = '/api/shortlists';

/** 接洽状态码与中文标签 */
export const SHORTLIST_STATUS: { value: string; label: string; color: string }[] = [
  { value: 'pending', label: '待联系', color: 'bg-gray-50 text-gray-600 border-gray-200' },
  { value: 'contacted', label: '已联系', color: 'bg-blue-50 text-blue-600 border-blue-200' },
  { value: 'quoted', label: '已报价', color: 'bg-amber-50 text-amber-600 border-amber-200' },
  { value: 'cooperated', label: '已合作', color: 'bg-green-50 text-green-600 border-green-200' },
  { value: 'dropped', label: '已放弃', color: 'bg-red-50 text-red-500 border-red-200' },
];

export const statusLabel = (v: string) => SHORTLIST_STATUS.find((s) => s.value === v)?.label ?? v;
export const statusColor = (v: string) => SHORTLIST_STATUS.find((s) => s.value === v)?.color ?? SHORTLIST_STATUS[0].color;

export interface IShortlist {
  id: string;
  name: string;
  description: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
}

export interface IShortlistItem {
  itemId: string;
  supplierId: string;
  status: string;
  note: string | null;
  addedBy: string | null;
  createdAt: string;
  accountName: string | null;
  supplierType: string | null;
  rating: number | null;
  artworkUrls: string[] | null;
  contactItems: { type: string; value: string }[] | null;
  riskStatus: string | null;
}

export interface IShortlistDetail extends Omit<IShortlist, 'itemCount'> {
  items: IShortlistItem[];
}

export const shortlistApi = {
  list: async () => {
    const res = await axiosForBackend.get(BASE);
    return res.data as IShortlist[];
  },
  get: async (id: string) => {
    const res = await axiosForBackend.get(`${BASE}/${id}`);
    return res.data as IShortlistDetail;
  },
  create: async (name: string, description?: string) => {
    const res = await axiosForBackend.post(BASE, { name, description });
    return res.data as { id: string; name: string };
  },
  update: async (id: string, data: { name?: string; description?: string }) => {
    const res = await axiosForBackend.put(`${BASE}/${id}`, data);
    return res.data as { success: boolean };
  },
  remove: async (id: string) => {
    const res = await axiosForBackend.delete(`${BASE}/${id}`);
    return res.data as { success: boolean };
  },
  addItems: async (id: string, supplierIds: string[]) => {
    const res = await axiosForBackend.post(`${BASE}/${id}/items`, { supplierIds });
    return res.data as { added: number; skipped: number };
  },
  updateItem: async (id: string, supplierId: string, data: { status?: string; note?: string }) => {
    const res = await axiosForBackend.put(`${BASE}/${id}/items/${supplierId}`, data);
    return res.data as { success: boolean };
  },
  removeItem: async (id: string, supplierId: string) => {
    const res = await axiosForBackend.delete(`${BASE}/${id}/items/${supplierId}`);
    return res.data as { success: boolean };
  },
};
