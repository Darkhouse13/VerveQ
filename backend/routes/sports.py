"""
Sports routes for VerveQ Platform API
"""
from fastapi import APIRouter, HTTPException
from sports import SportDataFactory

router = APIRouter(prefix="/sports", tags=["sports"])

@router.get("")
async def get_available_sports():
    """Get list of available sports"""
    return {
        "sports": SportDataFactory.get_available_sports(),
        "count": len(SportDataFactory.get_available_sports())
    }

@router.get("/{sport}/theme")
async def get_sport_theme(sport: str):
    """Get theme configuration for a specific sport"""
    generator = SportDataFactory.get_generator(sport)
    if not generator:
        raise HTTPException(status_code=404, detail=f"Sport '{sport}' not found")
    
    return generator.get_sport_theme()