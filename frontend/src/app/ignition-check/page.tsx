'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { apiClient, User, IgnitionSensor } from '@/lib/api';

// Validator type names (Ukrainian translations from Wialon)
const VALIDATOR_TYPES: Record<number, string> = {
  0: 'Без валідатора',
  1: 'Логічне І',
  2: 'Логічне АБО',
  3: 'Сумувати',
  4: 'Перевірка моточасів',
  5: 'Математичний',
  6: 'Інтервальна фільтрація',
  7: 'Швидкість',
  8: 'Помножити',
  9: 'Ділити датчик на валідатор',
  10: 'Ділити валідатор на датчик',
  11: 'Замінити при помилці',
};

// Sensor type translations
const SENSOR_TYPE_NAMES: Record<string, string> = {
  'engine operation': 'Датчик запалювання',
  'engine hours': 'Моточаси',
  'engine rpm': 'Тахометр (об/хв)',
  'engine efficiency': 'Ефективність двигуна',
  'relative engine hours': 'Відносні моточаси',
};

// Normalize text for search (handle Cyrillic/Latin lookalikes)
const normalizeForSearch = (text: string): string => {
  // Map of Latin characters that look like Cyrillic
  const latinToCyrillic: Record<string, string> = {
    'A': 'А', 'a': 'а',
    'B': 'В', 'b': 'в',
    'C': 'С', 'c': 'с',
    'E': 'Е', 'e': 'е',
    'H': 'Н', 'h': 'н',
    'I': 'І', 'i': 'і',
    'K': 'К', 'k': 'к',
    'M': 'М', 'm': 'м',
    'O': 'О', 'o': 'о',
    'P': 'Р', 'p': 'р',
    'T': 'Т', 't': 'т',
    'X': 'Х', 'x': 'х',
  };

  return text.split('').map(char => latinToCyrillic[char] || char).join('').toLowerCase();
};

export default function IgnitionCheckPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [sensors, setSensors] = useState<IgnitionSensor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchUnit, setSearchUnit] = useState('');
  const [filterType, setFilterType] = useState<string>('engine operation');
  const [filterParameter, setFilterParameter] = useState<string>('all');
  const [filterValidator, setFilterValidator] = useState<string>('all');
  const [filterValidationType, setFilterValidationType] = useState<string>('all');
  const [expandedSensor, setExpandedSensor] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      if (!apiClient.isAuthenticated()) {
        router.push('/');
        return;
      }

      try {
        const userData = await apiClient.getMe();
        setUser(userData);

        const response = await apiClient.getIgnitionSensors();
        setSensors(response.sensors);
      } catch {
        apiClient.logout();
        router.push('/');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const handleLogout = () => {
    apiClient.logout();
    router.push('/');
  };

  // Get unique sensor types, parameters, validators and validation types
  const sensorTypes = [...new Set(sensors.map(s => s.type))];
  const sensorParameters = [...new Set(sensors.map(s => s.parameter))].sort();
  const validatorNames = [...new Set(sensors.map(s => s.validator_sensor_name).filter(Boolean))].sort();
  const validationTypes = [...new Set(sensors.map(s => s.validator_type))].filter(t => t > 0).sort((a, b) => a - b);

  // Filter sensors
  const filteredSensors = sensors
    .filter(s => filterType === 'all' || s.type === filterType)
    .filter(s => filterParameter === 'all' || s.parameter === filterParameter)
    .filter(s => {
      if (filterValidator === 'all') return true;
      if (filterValidator === 'none') return !s.validator_sensor_name;
      return s.validator_sensor_name === filterValidator;
    })
    .filter(s => {
      if (filterValidationType === 'all') return true;
      if (filterValidationType === 'none') return s.validator_type === 0;
      return s.validator_type === parseInt(filterValidationType);
    })
    .filter(s => normalizeForSearch(s.unit_name).includes(normalizeForSearch(searchUnit)));

  // Group by unit
  const sensorsByUnit = filteredSensors.reduce((acc, sensor) => {
    if (!acc[sensor.unit_name]) {
      acc[sensor.unit_name] = [];
    }
    acc[sensor.unit_name].push(sensor);
    return acc;
  }, {} as Record<string, IgnitionSensor[]>);

  const formatTimestamp = (ts: number) => {
    if (!ts) return '—';
    return new Date(ts * 1000).toLocaleDateString('uk-UA');
  };

  const renderCalibrationTable = (table: { x: number; a: number; b: number }[]) => {
    if (!table || table.length === 0) {
      return <span className="text-gray-400">Немає даних</span>;
    }

    return (
      <div className="space-y-1">
        {table.map((point, idx) => (
          <div key={idx} className="flex items-center gap-2 text-xs">
            <span className="bg-gray-100 px-2 py-0.5 rounded">X: {point.x}</span>
            <span className="text-gray-400">→</span>
            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
              Y = {point.a}*X + {point.b}
            </span>
            {point.b === 0 && point.a === 0 && <span className="text-red-500 ml-2">OFF</span>}
            {point.b === 1 && point.a === 0 && <span className="text-green-500 ml-2">ON</span>}
          </div>
        ))}
      </div>
    );
  };

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
                <button
                  onClick={() => router.push('/dashboard')}
                  className="text-sm text-gray-500 hover:text-[#32373c]"
                >
                  Dashboard
                </button>
                <button
                  onClick={() => router.push('/raw-data')}
                  className="text-sm text-gray-500 hover:text-[#32373c]"
                >
                  Raw Data
                </button>
                <span className="text-sm font-medium text-[#0693e3]">
                  Ignition Check
                </span>
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#0693e3] rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500">Всього сенсорів</p>
                <p className="text-2xl font-bold text-[#32373c]">{sensors.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#22c55e] rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500">Engine Operation</p>
                <p className="text-2xl font-bold text-[#22c55e]">
                  {sensors.filter(s => s.type === 'engine operation').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#f59e0b] rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500">Engine Hours</p>
                <p className="text-2xl font-bold text-[#f59e0b]">
                  {sensors.filter(s => s.type === 'engine hours').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#8b5cf6] rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500">З валідатором</p>
                <p className="text-2xl font-bold text-[#8b5cf6]">
                  {sensors.filter(s => s.validator_type > 0).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            {/* Search by unit name */}
            <div className="lg:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Об'єкт</label>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Пошук по об'єктах..."
                  value={searchUnit}
                  onChange={(e) => setSearchUnit(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0693e3] focus:border-transparent text-sm text-gray-800 bg-white transition-colors placeholder:text-gray-400"
                />
              </div>
            </div>

            {/* Filter by sensor type (Назва) */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Назва (тип)</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0693e3] focus:border-transparent text-sm text-gray-800 bg-white transition-colors cursor-pointer appearance-none"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center', backgroundSize: '1.5em 1.5em', paddingRight: '2.5rem' }}
              >
                <option value="all">Всі типи</option>
                {sensorTypes.map(type => (
                  <option key={type} value={type}>
                    {SENSOR_TYPE_NAMES[type] || type}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter by parameter */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Параметр</label>
              <select
                value={filterParameter}
                onChange={(e) => setFilterParameter(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0693e3] focus:border-transparent text-sm text-gray-800 bg-white transition-colors cursor-pointer appearance-none"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center', backgroundSize: '1.5em 1.5em', paddingRight: '2.5rem' }}
              >
                <option value="all">Всі</option>
                {sensorParameters.map(param => (
                  <option key={param} value={param}>{param}</option>
                ))}
              </select>
            </div>

            {/* Filter by validator sensor name */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Валідатор</label>
              <select
                value={filterValidator}
                onChange={(e) => setFilterValidator(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0693e3] focus:border-transparent text-sm text-gray-800 bg-white transition-colors cursor-pointer appearance-none"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center', backgroundSize: '1.5em 1.5em', paddingRight: '2.5rem' }}
              >
                <option value="all">Всі</option>
                <option value="none">Без валідатора</option>
                {validatorNames.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            {/* Filter by validation type */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Тип валідації</label>
              <select
                value={filterValidationType}
                onChange={(e) => setFilterValidationType(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0693e3] focus:border-transparent text-sm text-gray-800 bg-white transition-colors cursor-pointer appearance-none"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center', backgroundSize: '1.5em 1.5em', paddingRight: '2.5rem' }}
              >
                <option value="all">Всі</option>
                <option value="none">Без валідації</option>
                {validationTypes.map(type => (
                  <option key={type} value={type.toString()}>
                    {VALIDATOR_TYPES[type] || `Type ${type}`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Results count and active filters */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2 flex-wrap">
              {filterType !== 'all' && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                  {SENSOR_TYPE_NAMES[filterType] || filterType}
                  <button onClick={() => setFilterType('all')} className="hover:text-blue-900">×</button>
                </span>
              )}
              {filterParameter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                  {filterParameter}
                  <button onClick={() => setFilterParameter('all')} className="hover:text-green-900">×</button>
                </span>
              )}
              {filterValidator !== 'all' && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                  {filterValidator === 'none' ? 'Без валідатора' : filterValidator}
                  <button onClick={() => setFilterValidator('all')} className="hover:text-purple-900">×</button>
                </span>
              )}
              {filterValidationType !== 'all' && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                  {filterValidationType === 'none' ? 'Без валідації' : VALIDATOR_TYPES[parseInt(filterValidationType)] || filterValidationType}
                  <button onClick={() => setFilterValidationType('all')} className="hover:text-orange-900">×</button>
                </span>
              )}
              {searchUnit && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                  &quot;{searchUnit}&quot;
                  <button onClick={() => setSearchUnit('')} className="hover:text-gray-900">×</button>
                </span>
              )}
            </div>
            <div className="text-sm font-medium">
              Знайдено: <span className="text-[#0693e3] text-lg">{filteredSensors.length}</span> <span className="text-gray-400">/ {sensors.length}</span>
            </div>
          </div>
        </div>

        {/* Sensors Table */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-[#f8f9fa]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Об'єкт</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Назва</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Параметр</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Валідатор</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Тип валідації</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Дії</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSensors.map((sensor) => {
                  const sensorKey = `${sensor.unit_id}-${sensor.sensor_id}`;
                  const isExpanded = expandedSensor === sensorKey;

                  return (
                    <React.Fragment key={sensorKey}>
                      <tr
                        className={`hover:bg-[#f8f9fa] cursor-pointer ${isExpanded ? 'bg-[#f0f9ff]' : ''}`}
                        onClick={() => setExpandedSensor(isExpanded ? null : sensorKey)}
                      >
                        <td className="px-4 py-3 text-sm font-medium">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/dashboard?unit=${sensor.unit_id}`);
                            }}
                            className="text-[#0693e3] hover:underline flex items-center gap-1"
                          >
                            {sensor.unit_name}
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-[#32373c]">{sensor.name}</p>
                            {sensor.description && (
                              <p className="text-xs text-gray-500">{sensor.description}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <code className="text-sm bg-gray-100 px-2 py-0.5 rounded text-[#32373c] font-mono">
                            {sensor.parameter}
                          </code>
                        </td>
                        <td className="px-4 py-3">
                          {sensor.validator_sensor_name ? (
                            <span className="text-sm text-[#32373c]">{sensor.validator_sensor_name}</span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {sensor.validator_type > 0 ? (
                            <span className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-700">
                              {VALIDATOR_TYPES[sensor.validator_type] || `Type ${sensor.validator_type}`}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[#0693e3] text-sm flex items-center gap-1">
                            <svg
                              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                            </svg>
                            {isExpanded ? 'Згорнути' : 'Деталі'}
                          </span>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="px-0 py-0 bg-white border-t-2 border-[#0693e3]">
                            <div className="p-6">
                              {/* Sensor Info Header */}
                              <div className="flex items-center gap-4 mb-6 pb-4 border-b border-gray-100">
                                <div className="w-10 h-10 bg-[#0693e3] rounded-lg flex items-center justify-center">
                                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                  </svg>
                                </div>
                                <div>
                                  <h3 className="text-lg font-bold text-[#32373c]">{sensor.name}</h3>
                                  <p className="text-sm text-gray-500">
                                    ID: {sensor.sensor_id} • Параметр: <code className="bg-gray-100 px-1 rounded">{sensor.parameter}</code>
                                  </p>
                                </div>
                                <div className="ml-auto">
                                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                    sensor.config.act ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                  }`}>
                                    {sensor.config.act ? 'Активний' : 'Неактивний'}
                                  </span>
                                </div>
                              </div>

                              <div className="grid grid-cols-4 gap-6">
                                {/* Calibration Table */}
                                <div className="col-span-2 bg-[#f8f9fa] rounded-xl p-4">
                                  <h4 className="text-sm font-semibold text-[#32373c] mb-3 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-[#0693e3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                    Таблиця калібрування (Інтервали)
                                  </h4>
                                  {sensor.calibration_table && sensor.calibration_table.length > 0 ? (
                                    <div className="space-y-2">
                                      {sensor.calibration_table.map((point, idx) => (
                                        <div key={idx} className="flex items-center gap-3 bg-white rounded-lg p-2">
                                          <span className="text-xs font-mono bg-gray-200 px-2 py-1 rounded">
                                            X ≥ {point.x}
                                          </span>
                                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                          </svg>
                                          <span className="text-xs font-mono bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                            Y = {point.a}×X + {point.b}
                                          </span>
                                          {point.b === 0 && point.a === 0 && (
                                            <span className="ml-auto px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded-full font-medium">OFF</span>
                                          )}
                                          {point.b === 1 && point.a === 0 && (
                                            <span className="ml-auto px-2 py-0.5 bg-green-100 text-green-600 text-xs rounded-full font-medium">ON</span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-gray-400">Немає даних калібрування</p>
                                  )}
                                </div>

                                {/* Config */}
                                <div className="bg-[#f8f9fa] rounded-xl p-4">
                                  <h4 className="text-sm font-semibold text-[#32373c] mb-3 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-[#f59e0b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    Конфігурація
                                  </h4>
                                  <div className="space-y-2 text-sm">
                                    <div className="flex justify-between items-center">
                                      <span className="text-gray-500">Показувати в popup</span>
                                      <span className={sensor.config.appear_in_popup ? 'text-green-600' : 'text-gray-400'}>
                                        {sensor.config.appear_in_popup ? 'Так' : 'Ні'}
                                      </span>
                                    </div>
                                    {sensor.config.timeout !== undefined && (
                                      <div className="flex justify-between items-center">
                                        <span className="text-gray-500">Timeout</span>
                                        <span className="font-mono">{sensor.config.timeout as number} сек</span>
                                      </div>
                                    )}
                                    {sensor.config.consumption !== undefined && (
                                      <div className="flex justify-between items-center">
                                        <span className="text-gray-500">Витрата</span>
                                        <span className="font-mono">{sensor.config.consumption as number}</span>
                                      </div>
                                    )}
                                    {sensor.config.pos !== undefined && (
                                      <div className="flex justify-between items-center">
                                        <span className="text-gray-500">Позиція</span>
                                        <span className="font-mono">{sensor.config.pos as number}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Validator & Dates */}
                                <div className="space-y-4">
                                  {/* Validator */}
                                  <div className="bg-[#f8f9fa] rounded-xl p-4">
                                    <h4 className="text-sm font-semibold text-[#32373c] mb-3 flex items-center gap-2">
                                      <svg className="w-4 h-4 text-[#8b5cf6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                      </svg>
                                      Валідатор
                                    </h4>
                                    {sensor.validator_type > 0 ? (
                                      <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                          <span className="text-gray-500">Тип</span>
                                          <span className="text-purple-600 font-medium">
                                            {VALIDATOR_TYPES[sensor.validator_type]}
                                          </span>
                                        </div>
                                        {sensor.validator_sensor_name && (
                                          <div className="flex justify-between">
                                            <span className="text-gray-500">Сенсор</span>
                                            <span className="font-medium">{sensor.validator_sensor_name}</span>
                                          </div>
                                        )}
                                        <div className="flex justify-between">
                                          <span className="text-gray-500">Sensor ID</span>
                                          <span className="font-mono">{sensor.validator_sensor_id}</span>
                                        </div>
                                      </div>
                                    ) : (
                                      <p className="text-sm text-gray-400">Без валідатора</p>
                                    )}
                                  </div>

                                  {/* Dates */}
                                  <div className="bg-[#f8f9fa] rounded-xl p-4">
                                    <h4 className="text-sm font-semibold text-[#32373c] mb-3 flex items-center gap-2">
                                      <svg className="w-4 h-4 text-[#0693e3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                      </svg>
                                      Дати
                                    </h4>
                                    <div className="space-y-2 text-sm">
                                      <div className="flex justify-between">
                                        <span className="text-gray-500">Створено</span>
                                        <span>{formatTimestamp(sensor.created)}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-500">Змінено</span>
                                        <span>{formatTimestamp(sensor.modified)}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredSensors.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">Сенсори не знайдено</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
