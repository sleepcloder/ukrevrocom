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

interface SensorData {
  fuel_level: number;
  fuel_level_2: number;
  fuel_consumption: number;
  engine_rpm: number;
  coolant_temp: number;
  engine_hours_lmsg: number;
  ignition: number;
  pwr_ext: number;
  pwr_int: number;
  gsm_signal: number;
  adc1: number;
  adc2: number;
  adc3: number;
  adc4: number;
  hdop: number;
  mileage_lmsg: number;
}

interface UnitDetail extends Unit {
  device_type: string;
  phone: string;
  phone2: string;
  uid: string;
  uid2: string;
  sensors: Record<string, { type: string; param: string; description: string }>;
  sensor_data: SensorData;
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

  logout(): void {
    localStorage.removeItem('token');
  }

  isAuthenticated(): boolean {
    return typeof window !== 'undefined' && !!localStorage.getItem('token');
  }
}

export const apiClient = new ApiClient();
export type { LoginCredentials, AuthResponse, User, Unit, UnitDetail, UnitsResponse, SensorData };
