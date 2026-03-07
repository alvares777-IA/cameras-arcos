import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://cameras:cameras123@localhost:5432/cameras_db"
    )
    RECORDINGS_PATH: str = os.getenv("RECORDINGS_PATH", "/recordings")
    RETENTION_DAYS: int = int(os.getenv("RETENTION_DAYS", "30"))
    SEGMENT_DURATION_SECONDS: int = int(os.getenv("SEGMENT_DURATION_SECONDS", "300"))
    MEDIAMTX_URL: str = os.getenv("MEDIAMTX_URL", "http://mediamtx:9997")
    MEDIAMTX_HLS_URL: str = os.getenv("MEDIAMTX_HLS_URL", "http://localhost:8888")
    BACKEND_HOST: str = os.getenv("BACKEND_HOST", "0.0.0.0")
    BACKEND_PORT: int = int(os.getenv("BACKEND_PORT", "8000"))
    RECORDING_ENABLED: bool = os.getenv("RECORDING_ENABLED", "false").lower() in ("true", "1", "yes")
    FACE_RECOGNITION_ENABLED: bool = os.getenv("FACE_RECOGNITION_ENABLED", "false").lower() in ("true", "1", "yes")
    CONTINUOUS_RECORDING_ENABLED: str = os.getenv("CONTINUOUS_RECORDING_ENABLED", "false").lower().strip()
    # Valores válidos: "true" (todas gravam contínuo), "false" (todas por movimento), "disable" (usa flag por câmera)

    # Parâmetros de detecção de movimento
    MOTION_THRESHOLD_PCT: float = float(os.getenv("MOTION_THRESHOLD_PCT", "1.5"))
    MOTION_PIXEL_THRESHOLD: int = int(os.getenv("MOTION_PIXEL_THRESHOLD", "25"))
    MOTION_BLUR_KERNEL: int = int(os.getenv("MOTION_BLUR_KERNEL", "21"))

settings = Settings()
