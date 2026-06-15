import { axiosForBackend } from '@/api';

const BASE = '/api/audit';

export interface IAuditLog {
  id: number;
  operation: string;
  recordId: string | null;
  batchId: string | null;
  tableName: string;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  operatedBy: string | null;
  createdAt: string;
}

export interface IBatch {
  import_batch_id: string;
  count: number;
  imported_at: string;
}

export interface ISnapshot {
  filename: string;
  size: number;
  createdAt: string;
}

export const auditApi = {
  getLogs: async (page = 1, limit = 50, operation?: string) => {
    const params: Record<string, string> = { page: String(page), limit: String(limit) };
    if (operation) params.operation = operation;
    const res = await axiosForBackend.get(`${BASE}/logs`, { params });
    return res.data as { list: IAuditLog[]; total: number };
  },

  getBatches: async () => {
    const res = await axiosForBackend.get(`${BASE}/batches`);
    return res.data as IBatch[];
  },

  rollbackLog: async (id: number) => {
    const res = await axiosForBackend.post(`${BASE}/rollback-log/${id}`);
    return res.data as { message: string };
  },

  rollbackBatch: async (batchId: string) => {
    const res = await axiosForBackend.post(`${BASE}/rollback-batch/${encodeURIComponent(batchId)}`);
    return res.data as { deleted: number; message: string };
  },

  listSnapshots: async () => {
    const res = await axiosForBackend.get(`${BASE}/snapshots`);
    return res.data as ISnapshot[];
  },

  createSnapshot: async () => {
    const res = await axiosForBackend.post(`${BASE}/snapshots`);
    return res.data as { filename: string; size: number };
  },
};
