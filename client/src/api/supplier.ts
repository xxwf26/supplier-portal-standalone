import { axiosForBackend } from '@/api';
import { logger } from '@/lib/polyfills/logger';
import { ISupplier, ISupplierFilter, ISupplierListResponse, ISupplierStatistics, IBatchCreateResponse } from './types';

export const supplierApi = {
  getList: async (filter?: ISupplierFilter): Promise<ISupplierListResponse> => {
    const params = new URLSearchParams();
    if (filter?.supplierType?.length) params.append('supplierType', filter.supplierType.join(','));
    if (filter?.cooperationCategory?.length) params.append('cooperationCategory', filter.cooperationCategory.join(','));
    if (filter?.subCategory?.length) params.append('subCategory', filter.subCategory.join(','));
    if (filter?.riskStatus?.length) params.append('riskStatus', filter.riskStatus.join(','));
    if (filter?.entityType?.length) params.append('entityType', filter.entityType.join(','));
    if (filter?.keyword) params.append('keyword', filter.keyword);
    const qs = params.toString();
    const res = await axiosForBackend({ url: `/api/suppliers${qs ? `?${qs}` : ''}`, method: 'GET' });
    return res.data;
  },

  getById: async (id: string): Promise<ISupplier> => {
    const res = await axiosForBackend({ url: `/api/suppliers/${id}`, method: 'GET' });
    return res.data;
  },

  create: async (data: Partial<ISupplier>): Promise<ISupplier> => {
    const res = await axiosForBackend({ url: '/api/suppliers', method: 'POST', data });
    return res.data;
  },

  update: async (id: string, data: Partial<ISupplier>): Promise<ISupplier> => {
    const res = await axiosForBackend({ url: `/api/suppliers/${id}`, method: 'PUT', data });
    return res.data;
  },

  delete: async (id: string): Promise<{ success: boolean }> => {
    const res = await axiosForBackend({ url: `/api/suppliers/${id}`, method: 'DELETE' });
    return res.data;
  },

  getStatistics: async (): Promise<ISupplierStatistics> => {
    const res = await axiosForBackend({ url: '/api/suppliers/statistics', method: 'GET' });
    return res.data;
  },

  batchCreate: async (items: Partial<ISupplier>[]): Promise<IBatchCreateResponse> => {
    const res = await axiosForBackend({ url: '/api/suppliers/batch', method: 'POST', data: { items } });
    return res.data;
  },
};
