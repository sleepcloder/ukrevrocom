import { NextRequest, NextResponse } from 'next/server';

// Use 127.0.0.1 instead of localhost for more reliable connection
const BACKEND_URL = 'http://127.0.0.1:8888';

export async function POST(request: NextRequest) {
  console.log('=== Login API Route called ===');

  try {
    const formData = await request.formData();
    const username = formData.get('username');
    const password = formData.get('password');

    console.log('Proxy login request for:', username);
    console.log('Backend URL:', `${BACKEND_URL}/api/auth/login`);

    const body = `username=${encodeURIComponent(username as string)}&password=${encodeURIComponent(password as string)}`;
    console.log('Request body:', body);

    const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body,
    });

    console.log('Backend response status:', response.status);

    const data = await response.json();
    console.log('Backend response data:', JSON.stringify(data));

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { detail: `Backend connection failed: ${error}` },
      { status: 502 }
    );
  }
}
