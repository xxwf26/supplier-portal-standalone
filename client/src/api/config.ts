import api from './index';

export interface IFilterOption {
  id: string;
  category: string;
  label: string;
  value: string;
  color: string | null;
  note: string | null;
  sortOrder: number;
  enabled: boolean;
}

export const configApi = {
  getAll: async (): Promise<Record<string, IFilterOption[]>> => {
    const res = await api.get('/api/config/filters');
    return res.data;
  },
  create: async (data: { category: string; label: string; value?: string; color?: string; note?: string }) => {
    const res = await api.post('/api/config/filters', data);
    return res.data;
  },
  update: async (id: string, data: { label?: string; value?: string; color?: string; note?: string; sort_order?: number; enabled?: boolean }) => {
    const res = await api.put(`/api/config/filters/${id}`, data);
    return res.data;
  },
  delete: async (id: string) => {
    const res = await api.delete(`/api/config/filters/${id}`);
    return res.data;
  },
};