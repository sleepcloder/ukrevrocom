'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { apiClient } from '@/lib/api';

export default function Home() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (apiClient.isAuthenticated()) {
      router.push('/dashboard');
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await apiClient.login({ username, password });
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка входу');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5]">
      <div className="w-full max-w-md px-4">
        <div className="bg-white rounded-2xl shadow-sm p-8">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <Image
              src="/logo.svg"
              alt="UkrEvrokom"
              width={220}
              height={40}
              priority
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-[#fee2e2] border border-[#fecaca] text-[#dc2626] rounded-xl text-sm font-medium">
              {error}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="login-field"
                className="block text-sm font-semibold text-[#32373c] mb-2"
              >
                Логін
              </label>
              <input
                id="login-field"
                name="login-field"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#32373c] focus:border-transparent transition-all duration-200 text-[#32373c]"
                placeholder="Введіть логін"
              />
            </div>

            <div>
              <label
                htmlFor="secret-field"
                className="block text-sm font-semibold text-[#32373c] mb-2"
              >
                Пароль
              </label>
              <input
                id="secret-field"
                name="secret-field"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#32373c] focus:border-transparent transition-all duration-200 text-[#32373c]"
                placeholder="Введіть пароль"
                style={{ WebkitTextSecurity: 'disc' } as React.CSSProperties}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 bg-[#32373c] hover:bg-[#1a1d20] disabled:bg-gray-400 text-white font-semibold rounded-full transition-all duration-200 shadow-sm hover:shadow-md mt-2"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Вхід...
                </span>
              ) : (
                'Увійти'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500 mt-6">
          © {new Date().getFullYear()} UkrEvrokom. Всі права захищені.
        </p>
      </div>
    </div>
  );
}
