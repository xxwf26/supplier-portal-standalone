import { useEffect, useState } from 'react';

/**
 * 防抖值：value 变化后延迟 delay 毫秒才更新返回值。
 * 用于搜索框——输入即时回显（用原始 state），过滤/请求用防抖后的值，
 * 避免每次按键都触发昂贵的全量重算/重渲染。
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
