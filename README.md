# UkrEvrocom

Full-stack web application with Next.js frontend and FastAPI backend.

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend**: FastAPI, Python 3.11+
- **Database**: PostgreSQL
- **Authentication**: JWT tokens

## Project Structure

```
ukrevrocom/
├── frontend/          # Next.js application
│   ├── src/
│   │   ├── app/      # App Router pages
│   │   ├── lib/      # Utilities and API client
│   │   └── components/
│   └── package.json
│
├── backend/           # FastAPI application
│   ├── app/
│   │   ├── api/      # API routes
│   │   ├── core/     # Config and security
│   │   ├── db/       # Database models
│   │   └── schemas/  # Pydantic schemas
│   └── requirements.txt
│
└── README.md
```

## Getting Started

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Copy and configure environment
cp .env.example .env

# Run server
uvicorn app.main:app --reload
```

API available at [http://localhost:8000](http://localhost:8000)

API docs at [http://localhost:8000/docs](http://localhost:8000/docs)

## Environment Variables

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Backend (.env)
```
SECRET_KEY=your-secret-key
DATABASE_URL=postgresql://user:pass@localhost:5432/ukrevrocom
```

## Deployment

### Vercel (Frontend)
1. Connect GitHub repository to Vercel
2. Set root directory to `frontend`
3. Add environment variables

### Backend Options
- Vercel Serverless Functions
- Railway
- Render
- DigitalOcean App Platform

## License

MIT
