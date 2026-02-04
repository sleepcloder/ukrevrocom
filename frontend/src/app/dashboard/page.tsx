'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { apiClient, User, Unit, UnitDetail } from '@/lib/api';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingUnits, setIsLoadingUnits] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUnit, setSelectedUnit] = useState<UnitDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Sorting and filtering state
  const [sortField, setSortField] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filterStatus, setFilterStatus] = useState<'all' | 'online' | 'offline'>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterTracker, setFilterTracker] = useState<string>('all');

  useEffect(() => {
    const checkAuth = async () => {
      if (!apiClient.isAuthenticated()) {
        router.push('/');
        return;
      }

      try {
        const userData = await apiClient.getMe();
        setUser(userData);
        loadUnits();
      } catch {
        apiClient.logout();
        router.push('/');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const loadUnits = async () => {
    setIsLoadingUnits(true);
    try {
      const response = await apiClient.getUnits();
      setUnits(response.items);
    } catch (error) {
      console.error('Failed to load units:', error);
    } finally {
      setIsLoadingUnits(false);
    }
  };

  const loadUnitDetail = async (unitId: number) => {
    setIsLoadingDetail(true);
    try {
      const detail = await apiClient.getUnit(unitId);
      setSelectedUnit(detail);
    } catch (error) {
      console.error('Failed to load unit detail:', error);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleLogout = () => {
    apiClient.logout();
    router.push('/');
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatMileage = (km: number) => {
    if (!km) return '0 км';
    return `${(km / 1000).toLocaleString('uk-UA', { maximumFractionDigits: 0 })} км`;
  };

  const formatEngineHours = (hours: number) => {
    if (!hours) return '0 год';
    return `${(hours / 3600).toLocaleString('uk-UA', { maximumFractionDigits: 1 })} год`;
  };

  // Filter only activated units
  const activatedUnits = units.filter(unit => unit.is_activated);

  // Get unique types and trackers for filter dropdowns
  const uniqueTypes = [...new Set(activatedUnits.map(u => u.unit_type).filter(Boolean))];
  const uniqueTrackers = [...new Set(activatedUnits.map(u => u.tracker_type).filter(Boolean))];

  // Apply all filters
  const filteredUnits = activatedUnits
    .filter(unit => unit.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .filter(unit => {
      if (filterStatus === 'online') return unit.is_online;
      if (filterStatus === 'offline') return !unit.is_online;
      return true;
    })
    .filter(unit => filterType === 'all' || unit.unit_type === filterType)
    .filter(unit => filterTracker === 'all' || unit.tracker_type === filterTracker)
    .sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';

      switch (sortField) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'status':
          aVal = a.is_online ? 1 : 0;
          bVal = b.is_online ? 1 : 0;
          break;
        case 'type':
          aVal = a.unit_type?.toLowerCase() || '';
          bVal = b.unit_type?.toLowerCase() || '';
          break;
        case 'tracker':
          aVal = a.tracker_type?.toLowerCase() || '';
          bVal = b.tracker_type?.toLowerCase() || '';
          break;
        case 'speed':
          aVal = a.speed;
          bVal = b.speed;
          break;
        case 'mileage':
          aVal = a.mileage;
          bVal = b.mileage;
          break;
        case 'last_time':
          aVal = a.last_time || '';
          bVal = b.last_time || '';
          break;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }: { field: string }) => (
    <svg
      className={`w-4 h-4 ml-1 inline-block transition-transform ${
        sortField === field ? 'text-[#32373c]' : 'text-gray-300'
      } ${sortField === field && sortDirection === 'desc' ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
    </svg>
  );

  const onlineCount = activatedUnits.filter(u => u.is_online).length;
  const offlineCount = activatedUnits.filter(u => !u.is_online).length;
  const withPositionCount = activatedUnits.filter(u => u.latitude !== null).length;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#32373c]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-6">
              <Image
                src="/logo.svg"
                alt="UkrEvrokom"
                width={180}
                height={32}
                className="h-8 w-auto"
              />
              <nav className="flex gap-4">
                <span className="text-sm font-medium text-[#0693e3]">
                  Dashboard
                </span>
                <button
                  onClick={() => router.push('/raw-data')}
                  className="text-sm text-gray-500 hover:text-[#32373c]"
                >
                  Raw Data
                </button>
                <button
                  onClick={() => router.push('/ignition-check')}
                  className="text-sm text-gray-500 hover:text-[#32373c]"
                >
                  Ignition Check
                </button>
              </nav>
            </div>
            <div className="flex items-center gap-6">
            <span className="text-[#32373c] text-sm font-medium">
              {user?.full_name || user?.username}
            </span>
            <button
              onClick={handleLogout}
              className="px-6 py-2 text-sm font-medium text-white bg-[#32373c] hover:bg-[#1a1d20] rounded-full transition-all duration-200 shadow-sm hover:shadow-md"
            >
              Вийти
            </button>
          </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#32373c] rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Активних</p>
                <p className="text-2xl font-bold text-[#32373c]">{activatedUnits.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#22c55e] rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Онлайн</p>
                <p className="text-2xl font-bold text-[#22c55e]">{onlineCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#ef4444] rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Офлайн</p>
                <p className="text-2xl font-bold text-[#ef4444]">{offlineCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#0693e3] rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">З GPS</p>
                <p className="text-2xl font-bold text-[#0693e3]">{withPositionCount}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Units Table */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-xl font-bold text-[#32373c]">
              Обʼєкти моніторингу <span className="text-base font-normal text-gray-400">({filteredUnits.length})</span>
            </h2>
            <div className="flex items-center gap-3">
              <div className="relative">
                <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Пошук..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2.5 border border-gray-200 rounded-full focus:ring-2 focus:ring-[#32373c] focus:border-transparent text-sm w-64 transition-all duration-200"
                />
              </div>
              <button
                onClick={loadUnits}
                disabled={isLoadingUnits}
                className="px-5 py-2.5 text-sm font-medium text-white bg-[#32373c] hover:bg-[#1a1d20] disabled:bg-gray-400 rounded-full transition-all duration-200 shadow-sm hover:shadow-md flex items-center gap-2"
              >
                {isLoadingUnits ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Оновлення...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Оновити</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {isLoadingUnits && units.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#32373c]"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-[#f8f9fa]">
                    <th className="px-6 py-3 text-left">
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => handleSort('status')}
                          className="text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-[#32373c] flex items-center"
                        >
                          Статус <SortIcon field="status" />
                        </button>
                        <select
                          value={filterStatus}
                          onChange={(e) => setFilterStatus(e.target.value as 'all' | 'online' | 'offline')}
                          className="text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-[#32373c]"
                        >
                          <option value="all">Всі</option>
                          <option value="online">Онлайн</option>
                          <option value="offline">Офлайн</option>
                        </select>
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left">
                      <button
                        onClick={() => handleSort('name')}
                        className="text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-[#32373c] flex items-center"
                      >
                        Назва <SortIcon field="name" />
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left">
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => handleSort('type')}
                          className="text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-[#32373c] flex items-center"
                        >
                          Тип <SortIcon field="type" />
                        </button>
                        <select
                          value={filterType}
                          onChange={(e) => setFilterType(e.target.value)}
                          className="text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-[#32373c]"
                        >
                          <option value="all">Всі</option>
                          {uniqueTypes.map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left">
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => handleSort('tracker')}
                          className="text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-[#32373c] flex items-center"
                        >
                          Трекер <SortIcon field="tracker" />
                        </button>
                        <select
                          value={filterTracker}
                          onChange={(e) => setFilterTracker(e.target.value)}
                          className="text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-[#32373c]"
                        >
                          <option value="all">Всі</option>
                          {uniqueTrackers.map(tracker => (
                            <option key={tracker} value={tracker}>{tracker}</option>
                          ))}
                        </select>
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left">
                      <button
                        onClick={() => handleSort('speed')}
                        className="text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-[#32373c] flex items-center"
                      >
                        Швидкість <SortIcon field="speed" />
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left">
                      <button
                        onClick={() => handleSort('mileage')}
                        className="text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-[#32373c] flex items-center"
                      >
                        Пробіг <SortIcon field="mileage" />
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left">
                      <button
                        onClick={() => handleSort('last_time')}
                        className="text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-[#32373c] flex items-center"
                      >
                        Останнє оновлення <SortIcon field="last_time" />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredUnits.map((unit) => (
                    <tr key={unit.id} className="hover:bg-[#f8f9fa] transition-colors duration-150">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`w-3 h-3 rounded-full inline-block ${
                            unit.is_online ? 'bg-[#22c55e]' : 'bg-[#ef4444]'
                          }`}
                          title={unit.is_online ? 'Онлайн' : 'Офлайн'}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-[#32373c]">
                          {unit.name}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {unit.unit_type || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => loadUnitDetail(unit.id)}
                          className="text-sm font-medium text-[#0693e3] hover:text-[#0574b8] hover:underline transition-colors"
                        >
                          {unit.tracker_type || 'Avtograph'}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-medium ${unit.speed > 0 ? 'text-[#32373c]' : 'text-gray-400'}`}>
                          {unit.speed > 0 ? `${unit.speed} км/г` : '0 км/г'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatMileage(unit.mileage)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(unit.last_time)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Table Footer */}
          <div className="px-6 py-4 bg-[#f8f9fa] border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Показано <span className="font-semibold text-[#32373c]">{filteredUnits.length}</span> з <span className="font-semibold text-[#32373c]">{activatedUnits.length}</span> активних обʼєктів
            </p>
          </div>
        </div>
      </main>

      {/* Unit Detail Modal */}
      {(selectedUnit || isLoadingDetail) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => !isLoadingDetail && setSelectedUnit(null)}>
          <div className="bg-[#f5f5f5] rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {isLoadingDetail ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#32373c]"></div>
              </div>
            ) : selectedUnit && (
              <>
                {/* Modal Header */}
                <div className="bg-[#32373c] px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                        selectedUnit.is_online
                          ? 'bg-[#22c55e] text-white'
                          : 'bg-[#ef4444] text-white'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full bg-white`} />
                      {selectedUnit.is_online ? 'Онлайн' : 'Офлайн'}
                    </span>
                    <h3 className="text-lg font-bold text-white">{selectedUnit.name}</h3>
                    <span className="text-sm text-gray-300">{selectedUnit.tracker_type || 'Avtograph'}</span>
                  </div>
                  <button
                    onClick={() => setSelectedUnit(null)}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                  >
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Modal Content */}
                <div className="px-6 py-5 overflow-y-auto max-h-[calc(90vh-80px)]">
                  {/* Helper to get parameter value */}
                  {(() => {
                    const getParam = (name: string): number | string | null => {
                      const param = selectedUnit.parameters?.find(p => p.name === name);
                      return param?.value ?? null;
                    };
                    const getParamNum = (name: string): number => {
                      const val = getParam(name);
                      return typeof val === 'number' ? val : 0;
                    };

                    return (
                      <>
                        {/* Top Stats Cards */}
                        <div className="grid grid-cols-4 gap-3 mb-6">
                          <div className={`rounded-xl p-4 ${selectedUnit.speed > 0 ? 'bg-[#0693e3] text-white' : 'bg-white'}`}>
                            <div className="flex items-center gap-3">
                              <svg className={`w-8 h-8 ${selectedUnit.speed > 0 ? 'text-white/80' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              <div>
                                <p className={`text-2xl font-bold ${selectedUnit.speed > 0 ? 'text-white' : 'text-[#32373c]'}`}>{selectedUnit.speed}</p>
                                <p className={`text-xs ${selectedUnit.speed > 0 ? 'text-white/70' : 'text-gray-500'}`}>км/год</p>
                              </div>
                            </div>
                          </div>
                          <div className="bg-white rounded-xl p-4">
                            <div className="flex items-center gap-3">
                              <svg className="w-8 h-8 text-[#f59e0b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                              </svg>
                              <div>
                                <p className="text-2xl font-bold text-[#32373c]">{Math.round(getParamNum('adc1') || getParamNum('fuel_level') || 0)}</p>
                                <p className="text-xs text-gray-500">Паливо, л</p>
                              </div>
                            </div>
                          </div>
                          <div className="bg-white rounded-xl p-4">
                            <div className="flex items-center gap-3">
                              <svg className="w-8 h-8 text-[#0693e3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <div>
                                <p className="text-2xl font-bold text-[#32373c]">{Math.round(selectedUnit.engine_hours || getParamNum('engine_hours'))}</p>
                                <p className="text-xs text-gray-500">Моточасів</p>
                              </div>
                            </div>
                          </div>
                          <div className="bg-white rounded-xl p-4">
                            <div className="flex items-center gap-3">
                              <svg className="w-8 h-8 text-[#ef4444]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                              </svg>
                              <div>
                                <p className="text-2xl font-bold text-[#32373c]">{Math.round(getParamNum('coolant_temp') || getParamNum('fuel_temp') || 0)}</p>
                                <p className="text-xs text-gray-500">°C</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Info Blocks */}
                        <div className="grid grid-cols-2 gap-4 mb-6">
                          {/* Розташування */}
                          <div className="bg-white rounded-xl p-4 shadow-sm">
                            <h4 className="text-sm font-semibold text-[#32373c] mb-3 flex items-center gap-2">
                              <svg className="w-4 h-4 text-[#0693e3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              </svg>
                              Розташування
                            </h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-500">Широта</span>
                                <span className="font-medium text-[#32373c]">{selectedUnit.latitude?.toFixed(6) || '—'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Довгота</span>
                                <span className="font-medium text-[#32373c]">{selectedUnit.longitude?.toFixed(6) || '—'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Висота</span>
                                <span className="font-medium text-[#32373c]">{selectedUnit.altitude || 0} м</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Курс</span>
                                <span className="font-medium text-[#32373c]">{selectedUnit.course ? `${selectedUnit.course}°` : '—'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Супутники</span>
                                <span className="font-medium text-[#32373c]">{selectedUnit.satellites || 0}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">HDOP</span>
                                <span className="font-medium text-[#32373c]">{getParamNum('hdop').toFixed(1) || '—'}</span>
                              </div>
                            </div>
                          </div>

                          {/* Двигун */}
                          <div className="bg-white rounded-xl p-4 shadow-sm">
                            <h4 className="text-sm font-semibold text-[#32373c] mb-3 flex items-center gap-2">
                              <svg className="w-4 h-4 text-[#f59e0b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              Двигун
                            </h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-500">Оберти</span>
                                <span className="font-medium text-[#32373c]">{getParamNum('engine_rpm')} об/хв</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Температура</span>
                                <span className="font-medium text-[#32373c]">{getParamNum('coolant_temp') || getParamNum('fuel_temp')}°C</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Моточаси</span>
                                <span className="font-medium text-[#32373c]">{(selectedUnit.engine_hours || getParamNum('engine_hours')).toFixed(1)} год</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Запалення</span>
                                <span className={`font-medium ${getParamNum('ignition') || getParamNum('in1') ? 'text-[#22c55e]' : 'text-gray-400'}`}>
                                  {getParamNum('ignition') || getParamNum('in1') ? 'Увімкнено' : '—'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Паливо */}
                          <div className="bg-white rounded-xl p-4 shadow-sm">
                            <h4 className="text-sm font-semibold text-[#32373c] mb-3 flex items-center gap-2">
                              <svg className="w-4 h-4 text-[#22c55e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                              </svg>
                              Паливо
                            </h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-500">Бак 1</span>
                                <span className="font-medium text-[#32373c]">{getParamNum('adc1').toFixed(1) || getParamNum('fuel_level') || 0} л</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Бак 2</span>
                                <span className="font-medium text-[#32373c]">{getParamNum('adc2').toFixed(1) || 0} л</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Витрата</span>
                                <span className="font-medium text-[#32373c]">{getParamNum('fuel_consumption').toFixed(1)} л/год</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Пробіг</span>
                                <span className="font-medium text-[#32373c]">{(getParamNum('mileage') / 1000).toFixed(1) || (selectedUnit.mileage / 1000).toFixed(1)} км</span>
                              </div>
                            </div>
                          </div>

                          {/* Сигнали */}
                          <div className="bg-white rounded-xl p-4 shadow-sm">
                            <h4 className="text-sm font-semibold text-[#32373c] mb-3 flex items-center gap-2">
                              <svg className="w-4 h-4 text-[#8b5cf6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                              </svg>
                              Сигнали
                            </h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-500">Живлення</span>
                                <span className="font-medium text-[#32373c]">{getParamNum('pwr_ext').toFixed(1)} В</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">GSM</span>
                                <span className="font-medium text-[#32373c]">{getParamNum('gsm') || '—'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">ADC1</span>
                                <span className="font-medium text-[#32373c]">{getParamNum('adc1').toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">ADC2</span>
                                <span className="font-medium text-[#32373c]">{getParamNum('adc2').toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Parameters Table */}
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-[#32373c]">
                              Всі параметри ({selectedUnit.parameters?.length || 0})
                            </h4>
                            <input
                              type="text"
                              placeholder="Пошук..."
                              className="px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0693e3] bg-white text-sm w-48"
                              onChange={(e) => {
                                const searchValue = e.target.value.toLowerCase();
                                const rows = document.querySelectorAll('.param-row');
                                rows.forEach((row) => {
                                  const text = row.textContent?.toLowerCase() || '';
                                  (row as HTMLElement).style.display = text.includes(searchValue) ? '' : 'none';
                                });
                              }}
                            />
                          </div>
                          <div className="bg-white rounded-xl shadow-sm overflow-hidden max-h-64 overflow-y-auto">
                            <table className="min-w-full">
                              <thead className="sticky top-0 bg-[#f8f9fa]">
                                <tr className="border-b border-gray-100">
                                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Параметр</th>
                                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Значення</th>
                                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Оновлено</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50">
                                {selectedUnit.parameters?.map((param, index) => (
                                  <tr key={index} className="param-row hover:bg-[#f8f9fa] transition-colors">
                                    <td className="px-4 py-2 text-sm font-medium text-[#32373c]">{param.name}</td>
                                    <td className="px-4 py-2 text-sm text-[#0693e3] font-medium">
                                      {typeof param.value === 'object' && param.value !== null
                                        ? JSON.stringify(param.value)
                                        : typeof param.value === 'number'
                                          ? param.value.toLocaleString('uk-UA', { maximumFractionDigits: 6 })
                                          : param.value ?? '—'}
                                    </td>
                                    <td className="px-4 py-2 text-xs text-gray-500">{param.last_update || '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Footer with map link */}
                        {selectedUnit.latitude && selectedUnit.longitude && (
                          <div className="flex justify-end">
                            <a
                              href={`https://www.google.com/maps?q=${selectedUnit.latitude},${selectedUnit.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-lg text-sm text-[#32373c] hover:bg-gray-50 shadow-sm"
                            >
                              <svg className="w-4 h-4 text-[#0693e3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              </svg>
                              Показати на карті
                            </a>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
