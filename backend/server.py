from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import requests


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Telegram configuration
TELEGRAM_BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN')
TELEGRAM_CHAT_ID = os.environ.get('TELEGRAM_CHAT_ID')

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class Location(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    latitude: float
    longitude: float
    accuracy: Optional[float] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class LocationCreate(BaseModel):
    latitude: float
    longitude: float
    accuracy: Optional[float] = None


# Telegram Bot Functions
def send_location_to_telegram(latitude: float, longitude: float):
    """Send location to Telegram bot"""
    try:
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendLocation"
        payload = {
            "chat_id": TELEGRAM_CHAT_ID,
            "latitude": latitude,
            "longitude": longitude
        }
        response = requests.post(url, json=payload, timeout=10)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logger.error(f"Failed to send location to Telegram: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to send to Telegram: {str(e)}")


# Routes
@api_router.get("/")
async def root():
    return {"message": "Location Sharing API"}

@api_router.post("/location/share", response_model=Location)
async def share_location(input: LocationCreate):
    """Save location to database and send to Telegram"""
    location_obj = Location(**input.model_dump())
    
    # Convert to dict and serialize datetime to ISO string for MongoDB
    doc = location_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    # Save to database
    await db.locations.insert_one(doc)
    
    # Send to Telegram
    send_location_to_telegram(input.latitude, input.longitude)
    
    return location_obj

@api_router.get("/locations", response_model=List[Location])
async def get_locations():
    """Get all location history"""
    locations = await db.locations.find({}, {"_id": 0}).sort("timestamp", -1).to_list(100)
    
    # Convert ISO string timestamps back to datetime objects
    for loc in locations:
        if isinstance(loc['timestamp'], str):
            loc['timestamp'] = datetime.fromisoformat(loc['timestamp'])
    
    return locations

@api_router.delete("/locations")
async def clear_locations():
    """Clear all location history"""
    result = await db.locations.delete_many({})
    return {"deleted_count": result.deleted_count}


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()