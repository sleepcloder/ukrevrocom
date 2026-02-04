'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { apiClient, User, Unit, RawUnitResponse, FlagsInfoResponse } from '@/lib/api';

export default function RawDataPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);
  const [rawData, setRawData] = useState<RawUnitResponse | null>(null);
  const [flagsInfo, setFlagsInfo] = useState<FlagsInfoResponse | null>(null);
  const [isLoadingRaw, setIsLoadingRaw] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set(['root']));
  const [showFlagsInfo, setShowFlagsInfo] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      if (!apiClient.isAuthenticated()) {
        router.push('/');
        return;
      }

      try {
        const userData = await apiClient.getMe();
        setUser(userData);

        const response = await apiClient.getUnits();
        setUnits(response.items.filter(u => u.is_activated));

        const flags = await apiClient.getFlagsInfo();
        setFlagsInfo(flags);
      } catch {
        apiClient.logout();
        router.push('/');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const loadRawData = async (unitId: number) => {
    setIsLoadingRaw(true);
    setSelectedUnitId(unitId);
    try {
      const data = await apiClient.getUnitRaw(unitId);
      setRawData(data);
      setExpandedKeys(new Set(['root']));
    } catch (error) {
      console.error('Failed to load raw data:', error);
    } finally {
      setIsLoadingRaw(false);
    }
  };

  const handleLogout = () => {
    apiClient.logout();
    router.push('/');
  };

  const toggleExpand = (key: string) => {
    const newExpanded = new Set(expandedKeys);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedKeys(newExpanded);
  };

  const expandAll = () => {
    const allKeys = new Set<string>(['root']);
    const collectKeys = (obj: unknown, prefix: string) => {
      if (typeof obj === 'object' && obj !== null) {
        Object.keys(obj).forEach(key => {
          const fullKey = `${prefix}.${key}`;
          allKeys.add(fullKey);
          collectKeys((obj as Record<string, unknown>)[key], fullKey);
        });
      }
    };
    if (rawData?.raw_data) {
      collectKeys(rawData.raw_data, 'root');
    }
    setExpandedKeys(allKeys);
  };

  const collapseAll = () => {
    setExpandedKeys(new Set(['root']));
  };

  // Render JSON tree recursively
  const renderJsonTree = (data: unknown, key: string, depth: number = 0): React.ReactNode => {
    const fullKey = key;
    const isExpanded = expandedKeys.has(fullKey);
    const indent = depth * 20;

    if (data === null) {
      return (
        <div style={{ marginLeft: indent }} className="py-0.5">
          <span className="text-gray-500">null</span>
        </div>
      );
    }

    if (typeof data === 'object' && data !== null) {
      const entries = Object.entries(data);
      const isArray = Array.isArray(data);

      return (
        <div style={{ marginLeft: indent }}>
          <button
            onClick={() => toggleExpand(fullKey)}
            className="flex items-center gap-1 py-0.5 hover:bg-gray-100 rounded px-1 -ml-1"
          >
            <svg
              className={`w-3 h-3 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
            <span className="text-[#0693e3] font-medium">{key.split('.').pop()}</span>
            <span className="text-gray-400 text-xs">
              {isArray ? `[${entries.length}]` : `{${entries.length}}`}
            </span>
          </button>
          {isExpanded && (
            <div>
              {entries.map(([k, v]) => (
                <div key={k}>
                  {renderJsonTree(v, `${fullKey}.${k}`, depth + 1)}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    // Primitive value
    const keyName = key.split('.').pop();
    const valueColor =
      typeof data === 'string' ? 'text-[#22c55e]' :
      typeof data === 'number' ? 'text-[#f59e0b]' :
      typeof data === 'boolean' ? 'text-[#8b5cf6]' :
      'text-gray-600';

    return (
      <div style={{ marginLeft: indent }} className="py-0.5 flex items-center gap-2">
        <span className="text-[#32373c] font-medium">{keyName}:</span>
        <span className={valueColor}>
          {typeof data === 'string' ? `"${data}"` : String(data)}
        </span>
      </div>
    );
  };

  // Get field description from flagsInfo
  const getFieldDescription = (fieldName: string): string => {
    return flagsInfo?.response_fields[fieldName] || '';
  };

  // Render raw data as table with field descriptions
  const renderDataTable = (data: Record<string, unknown>) => {
    const entries = Object.entries(data);

    return (
      <table className="min-w-full">
        <thead className="bg-[#f8f9fa] sticky top-0">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Поле</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Опис</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Тип</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Значення</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {entries.map(([key, value]) => {
            const valueType = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
            const description = getFieldDescription(key);
            const isExpandable = (valueType === 'object' || valueType === 'array') && value !== null;
            const isExpanded = expandedKeys.has(key);

            return (
              <React.Fragment key={key}>
                <tr className="hover:bg-[#f8f9fa]">
                  <td className="px-4 py-2 text-sm font-medium text-[#0693e3]">{key}</td>
                  <td className="px-4 py-2 text-sm text-gray-500">{description}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-1 rounded ${
                      valueType === 'null' ? 'bg-gray-100 text-gray-500' :
                      valueType === 'object' ? 'bg-blue-100 text-blue-700' :
                      valueType === 'array' ? 'bg-purple-100 text-purple-700' :
                      valueType === 'string' ? 'bg-green-100 text-green-700' :
                      valueType === 'number' ? 'bg-yellow-100 text-yellow-700' :
                      valueType === 'boolean' ? 'bg-pink-100 text-pink-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {valueType}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm">
                    {isExpandable ? (
                      <button
                        onClick={() => toggleExpand(key)}
                        className="text-[#0693e3] hover:underline flex items-center gap-1"
                      >
                        <svg
                          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                        {isExpanded ? 'Згорнути' : 'Розгорнути'}
                        <span className="text-gray-400 text-xs">
                          ({Array.isArray(value) ? value.length : Object.keys(value as object).length} елементів)
                        </span>
                      </button>
                    ) : (
                      <span className="font-mono text-[#32373c]">
                        {value === null ? 'null' : typeof value === 'string' ? `"${value}"` : String(value)}
                      </span>
                    )}
                  </td>
                </tr>
                {isExpandable && isExpanded && (
                  <tr>
                    <td colSpan={4} className="px-4 py-3 bg-[#f8f9fa]">
                      <pre className="text-xs font-mono text-[#32373c] whitespace-pre-wrap overflow-x-auto max-h-96 overflow-y-auto bg-white p-3 rounded-lg border border-gray-200">
                        {JSON.stringify(value, null, 2)}
                      </pre>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    );
  };

  const filteredUnits = units.filter(unit =>
    unit.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
                <span className="text-sm font-medium text-[#0693e3]">
                  Raw Data
                </span>
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-12 gap-6">
          {/* Left sidebar - Unit list */}
          <div className="col-span-3">
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <h3 className="text-lg font-bold text-[#32373c] mb-4">Об'єкти</h3>
              <input
                type="text"
                placeholder="Пошук..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0693e3] text-sm mb-3"
              />
              <div className="max-h-[calc(100vh-280px)] overflow-y-auto space-y-1">
                {filteredUnits.map(unit => (
                  <button
                    key={unit.id}
                    onClick={() => loadRawData(unit.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                      selectedUnitId === unit.id
                        ? 'bg-[#0693e3] text-white'
                        : 'hover:bg-gray-100 text-[#32373c]'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${unit.is_online ? 'bg-[#22c55e]' : 'bg-[#ef4444]'}`} />
                    <span className="truncate">{unit.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Main content - Raw data */}
          <div className="col-span-9">
            {/* Flags info toggle */}
            <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
              <button
                onClick={() => setShowFlagsInfo(!showFlagsInfo)}
                className="flex items-center gap-2 text-sm text-[#0693e3] hover:underline"
              >
                <svg className={`w-4 h-4 transition-transform ${showFlagsInfo ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
                Документація Wialon API Flags
              </button>

              {showFlagsInfo && flagsInfo && (
                <div className="mt-4 space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold text-[#32373c] mb-2">Доступні флаги</h4>
                    <div className="bg-[#f8f9fa] rounded-lg p-4 overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-500">
                            <th className="pr-4">Флаг</th>
                            <th className="pr-4">Значення</th>
                            <th className="pr-4">Hex</th>
                            <th>Опис</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(flagsInfo.flags).map(([name, info]) => (
                            <tr key={name}>
                              <td className="pr-4 font-mono text-[#0693e3]">{name}</td>
                              <td className="pr-4 font-mono">{info.value}</td>
                              <td className="pr-4 font-mono text-gray-500">{info.hex}</td>
                              <td className="text-gray-600">{info.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-[#32373c] mb-2">Типові комбінації</h4>
                    <div className="grid grid-cols-2 gap-4">
                      {Object.entries(flagsInfo.common_combinations).map(([name, info]) => (
                        <div key={name} className="bg-[#f8f9fa] rounded-lg p-3">
                          <span className="font-mono text-[#0693e3]">{name}</span>
                          <span className="text-gray-400 mx-2">=</span>
                          <span className="font-mono">{info.value}</span>
                          <p className="text-xs text-gray-500 mt-1">{info.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Raw data display */}
            {isLoadingRaw ? (
              <div className="bg-white rounded-2xl shadow-sm p-8 flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#32373c]"></div>
              </div>
            ) : rawData ? (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-[#32373c]">
                      {units.find(u => u.id === selectedUnitId)?.name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      Flags: <span className="font-mono">{rawData.flags_hex}</span> ({rawData.flags_used})
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={expandAll}
                      className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700"
                    >
                      Розгорнути все
                    </button>
                    <button
                      onClick={collapseAll}
                      className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700"
                    >
                      Згорнути все
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(rawData.raw_data, null, 2));
                      }}
                      className="px-3 py-1 text-xs bg-[#0693e3] hover:bg-[#0574b8] rounded-lg text-white"
                    >
                      Копіювати JSON
                    </button>
                  </div>
                </div>

                {/* Data view tabs */}
                <div className="border-b border-gray-100">
                  <div className="px-6 flex gap-4">
                    <button className="py-3 text-sm font-medium text-[#0693e3] border-b-2 border-[#0693e3]">
                      Таблиця
                    </button>
                    <button
                      onClick={() => {/* Switch to tree view */}}
                      className="py-3 text-sm font-medium text-gray-500 hover:text-[#32373c]"
                    >
                      JSON Tree
                    </button>
                  </div>
                </div>

                {/* Table view */}
                <div className="max-h-[calc(100vh-400px)] overflow-y-auto">
                  {renderDataTable(rawData.raw_data as Record<string, unknown>)}

                  {/* Expanded nested objects */}
                  {Object.entries(rawData.raw_data).map(([key, value]) => {
                    if ((typeof value === 'object' && value !== null) && expandedKeys.has(key)) {
                      return (
                        <div key={`expanded-${key}`} className="border-t border-gray-200 bg-[#f8f9fa]">
                          <div className="px-6 py-3 border-b border-gray-200">
                            <h4 className="text-sm font-bold text-[#32373c]">
                              {key} <span className="text-gray-400 font-normal">({getFieldDescription(key)})</span>
                            </h4>
                          </div>
                          <div className="p-4 font-mono text-sm overflow-x-auto">
                            <pre className="whitespace-pre-wrap text-[#32373c]">
                              {JSON.stringify(value, null, 2)}
                            </pre>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
                <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-500">Виберіть об'єкт зі списку для перегляду Raw даних</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
