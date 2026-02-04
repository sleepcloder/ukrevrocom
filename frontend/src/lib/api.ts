// Use Next.js API routes as proxy to backend
console.log('Using Next.js API proxy');

interface LoginCredentials {
  username: string;
  password: string;
}

interface AuthResponse {
  access_token: string;
  token_type: string;
}

interface User {
  id: number;
  username: string;
  full_name: string | null;
  is_active: boolean;
}

interface Unit {
  id: number;
  name: string;
  latitude: number | null;
  longitude: number | null;
  speed: number;
  course: number;
  altitude: number;
  satellites: number;
  last_time: string | null;
  is_online: boolean;
  mileage: number;
  engine_hours: number;
  custom_fields: Record<string, string>;
  unit_type: string;
  tracker_type: string;
  navigation_system: string;
  inputs_expander_status: number;
  is_activated: boolean;
}

interface Parameter {
  name: string;
  value: number | string | null;
  last_update: string | null;
}

interface Sensor {
  id: number;
  name: string;
  type: string;
  param: string;
  description: string;
  unit: string;
}

interface UnitDetail extends Unit {
  device_type: string;
  phone: string;
  phone2: string;
  uid: string;
  uid2: string;
  sensors: Sensor[];
  parameters: Parameter[];
  icon: string;
}

interface UnitsResponse {
  items: Unit[];
  total: number;
}

class ApiClient {
  private getAuthHeader(): HeadersInit {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const formData = new FormData();
    formData.append('username', credentials.username);
    formData.append('password', credentials.password);

    const url = `/api/auth/login`;
    console.log('Login request to:', url);

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    console.log('Login response status:', response.status);

    if (!response.ok) {
      const error = await response.json();
      console.error('Login error:', error);
      throw new Error(error.detail || 'Login failed');
    }

    const data = await response.json();
    console.log('Login success, token received');
    localStorage.setItem('token', data.access_token);
    return data;
  }

  async getMe(): Promise<User> {
    const response = await fetch(`/api/auth/me`, {
      headers: {
        ...this.getAuthHeader(),
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get user info');
    }

    return response.json();
  }

  async getUnits(): Promise<UnitsResponse> {
    const response = await fetch(`/api/units`, {
      headers: {
        ...this.getAuthHeader(),
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get units');
    }

    return response.json();
  }

  async getUnit(id: number): Promise<UnitDetail> {
    const response = await fetch(`/api/units/${id}`, {
      headers: {
        ...this.getAuthHeader(),
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get unit details');
    }

    return response.json();
  }

  async getUnitRaw(id: number): Promise<RawUnitResponse> {
    const response = await fetch(`/api/units/${id}/raw`, {
      headers: {
        ...this.getAuthHeader(),
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get raw unit data');
    }

    return response.json();
  }

  async getFlagsInfo(): Promise<FlagsInfoResponse> {
    const response = await fetch(`/api/wialon/flags-info`, {
      headers: {
        ...this.getAuthHeader(),
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get flags info');
    }

    return response.json();
  }

  async getIgnitionSensors(): Promise<IgnitionSensorsResponse> {
    const response = await fetch(`/api/sensors/ignition`, {
      headers: {
        ...this.getAuthHeader(),
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get ignition sensors');
    }

    return response.json();
  }

  logout(): void {
    localStorage.removeItem('token');
  }

  isAuthenticated(): boolean {
    return typeof window !== 'undefined' && !!localStorage.getItem('token');
  }
}

interface RawUnitResponse {
  unit_id: number;
  flags_used: number;
  flags_hex: string;
  raw_data: Record<string, unknown>;
}

interface FlagInfo {
  value: number;
  hex: string;
  description: string;
}

interface FlagsInfoResponse {
  flags: Record<string, FlagInfo>;
  common_combinations: Record<string, { value: number; description: string }>;
  response_fields: Record<string, string>;
}

interface CalibrationPoint {
  x: number;
  a: number;
  b: number;
}

interface IgnitionSensor {
  unit_id: number;
  unit_name: string;
  sensor_id: number;
  name: string;
  type: string;
  description: string;
  parameter: string;
  metric: string;
  calibration_table: CalibrationPoint[];
  validator_type: number;
  validator_sensor_id: number;
  validator_sensor_name: string;
  config: Record<string, unknown>;
  created: number;
  modified: number;
}

interface IgnitionSensorsResponse {
  total: number;
  sensors: IgnitionSensor[];
}

export const apiClient = new ApiClient();
export type { LoginCredentials, AuthResponse, User, Unit, UnitDetail, UnitsResponse, Parameter, Sensor, RawUnitResponse, FlagsInfoResponse, IgnitionSensor, IgnitionSensorsResponse, CalibrationPoint };
