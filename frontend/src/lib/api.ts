// Use Next.js API routes as proxy to backend
const API_URL = '';

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

  logout(): void {
    localStorage.removeItem('token');
  }

  isAuthenticated(): boolean {
    return typeof window !== 'undefined' && !!localStorage.getItem('token');
  }
}

export const apiClient = new ApiClient();
export type { LoginCredentials, AuthResponse, User };
