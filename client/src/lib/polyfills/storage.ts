// Polyfill for @lark-apaas/client-toolkit/dataloom and tools/storage
import axios from 'axios';

export async function getDataloom() {
  return {
    storage: {
      from: (_bucketId: string) => ({
        uploadFile: async (file: File) => {
          const formData = new FormData();
          formData.append('file', file);
          const res = await axios.post('/api/upload', formData);
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