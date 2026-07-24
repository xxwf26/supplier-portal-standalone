// Polyfill for @lark-apaas/client-toolkit/dataloom and tools/storage
import { axiosForBackend } from '@/api';

export async function getDataloom() {
  return {
    storage: {
      from: (_bucketId: string) => ({
        uploadFile: async (file: File) => {
          const formData = new FormData();
          formData.append('file', file);
          // 用带 JWT 的实例（/api/upload 现要求登录）；原生 axios 不带 token 会 401。
          // 必须显式设 multipart/form-data：axiosForBackend 默认 Content-Type 是 application/json，
          // 不覆盖的话 multer 按 JSON 解析不到文件 → 400 未接收到文件。
          const res = await axiosForBackend.post('/api/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          const url = res.data.url || res.data.download_url || '';
          const fileName = res.data.fileName || file.name;
          return {
            data: {
              id: fileName,
              file_path: url,
              bucket_id: _bucketId,
              download_url: url,
            },
            error: null,
          };
        },
      }),
    },
  };
}

export function getDefaultBucketId(): string {
  return 'default';
}

// Polyfill for @lark-apaas/client-toolkit/utils/getEnv
export function getEnv(): string {
  return 'development';
}