import asyncio
from app.database import async_session_factory
from app.models import Gravacao
from sqlalchemy import select, text

async def test():
    async with async_session_factory() as db:
        # Test raw SQL
        try:
            result = await db.execute(text('SELECT count(*) FROM gravacoes'))
            count = result.scalar()
            print(f'Total gravacoes: {count}')
        except Exception as e:
            print(f'Error raw SQL: {e}')
        
        # Test with model
        try:
            result = await db.execute(select(Gravacao).limit(2))
            rows = result.scalars().all()
            print(f'Model query returned: {len(rows)} rows')
            for r in rows:
                print(f'  id={r.id}, camera={r.id_camera}, face_analyzed={getattr(r, "face_analyzed", "MISSING")}')
        except Exception as e:
            print(f'Error model query: {e}')
        
        # Check if column exists
        try:
            result = await db.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='gravacoes' AND column_name='face_analyzed'"))
            col = result.scalar()
            print(f'face_analyzed column exists: {col is not None}')
        except Exception as e:
            print(f'Error checking column: {e}')

asyncio.run(test())
