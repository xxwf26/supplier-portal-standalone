import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { EyeIcon, EyeOffIcon } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // 启动时读取保存的账号密码
  useEffect(() => {
    try {
      const saved = localStorage.getItem('__saved_creds');
      if (saved) {
        const creds = JSON.parse(saved);
        setUsername(creds.username ?? '');
        setPassword(creds.password ?? '');
        setRememberMe(true);
      }
    } catch {}
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    // 取消记住时清除已保存的凭证
    if (!rememberMe) {
      localStorage.removeItem('__saved_creds');
    }

    setLoading(true);
    try {
      await login(username, password, rememberMe);
      toast.success('登录成功');
    } catch {
      toast.error('用户名或密码错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fbf9ff] flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-lg border border-[#dfe4ea] p-8 w-full max-w-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-[#8b5cf6] text-white font-extrabold grid place-items-center">恋</div>
          <div>
            <h2 className="text-lg font-bold text-[#1f2630]">供应商看板</h2>
            <p className="text-xs text-[#687382]">登录以继续</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#465260] mb-1">用户名</label>
            <input
              autoComplete="username"
              className="w-full border border-[#dfe4ea] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#8b5cf6] transition-colors"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="admin 或 viewer"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#465260] mb-1">密码</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete={rememberMe ? 'current-password' : 'off'}
                className="w-full border border-[#dfe4ea] rounded-lg px-3 py-2 pr-9 text-sm outline-none focus:border-[#8b5cf6] transition-colors"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="输入密码"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#687382] hover:text-[#465260] transition-colors"
                tabIndex={-1}
              >
                {showPassword
                  ? <EyeOffIcon className="w-4 h-4" />
                  : <EyeIcon className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* 记住我 + 登录时效提示 */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded accent-[#8b5cf6] cursor-pointer"
              />
              <span className="text-sm text-[#465260]">记住我</span>
            </label>
            <span className="text-xs text-[#687382]">
              有效期 30 天
            </span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#8b5cf6] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#7c3aed] transition-colors disabled:opacity-50"
          >
            {loading ? '登录中...' : '登 录'}
          </button>
        </form>

        <div className="mt-4 p-3 bg-[#f1eafe] rounded-lg text-xs text-[#687382]">
          <p className="font-medium mb-1">测试账号：</p>
          <p>管理员：admin / admin123</p>
          <p>仅查看：viewer / viewer123</p>
        </div>
      </div>
    </div>
  );
}
