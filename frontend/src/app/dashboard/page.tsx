'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, User } from '@/lib/api';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      if (!apiClient.isAuthenticated()) {
        router.push('/login');
        return;
      }

      try {
        const userData = await apiClient.getMe();
        setUser(userData);
      } catch {
        apiClient.logout();
        router.push('/login');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const handleLogout = () => {
    apiClient.logout();
    router.push('/login');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              UkrEvrocom Dashboard
            </h1>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Welcome back!
          </h2>

          {user && (
            <div className="space-y-2 text-gray-600 dark:text-gray-400">
              <p>
                <span className="font-medium">Email:</span> {user.email}
              </p>
              {user.full_name && (
                <p>
                  <span className="font-medium">Name:</span> {user.full_name}
                </p>
              )}
              <p>
                <span className="font-medium">Status:</span>{' '}
                <span className={user.is_active ? 'text-green-600' : 'text-red-600'}>
                  {user.is_active ? 'Active' : 'Inactive'}
                </span>
              </p>
            </div>
          )}
        </div>

        {/* Placeholder for future features */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              External API Integration
            </h3>
            <p className="mt-2 text-gray-600 dark:text-gray-400 text-sm">
              Connect to external services and APIs
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Data Management
            </h3>
            <p className="mt-2 text-gray-600 dark:text-gray-400 text-sm">
              Manage your data and records
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Reports
            </h3>
            <p className="mt-2 text-gray-600 dark:text-gray-400 text-sm">
              View analytics and reports
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
