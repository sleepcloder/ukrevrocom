import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <main className="text-center">
        <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
          UkrEvrocom
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
          Welcome to your dashboard
        </p>
        <Link
          href="/login"
          className="inline-block px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
        >
          Sign In
        </Link>
      </main>
    </div>
  );
}
