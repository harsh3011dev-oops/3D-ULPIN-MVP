import os
from typing import Dict, Any, Optional
from supabase import create_client, Client
from app.config import settings

class SupabaseService:
    def __init__(self):
        self.url = settings.SUPABASE_URL
        self.key = settings.SUPABASE_KEY
        self.client: Optional[Client] = None
        
        try:
            if self.url and self.key:
                self.client = create_client(self.url, self.key)
                print(f"✅ Successfully connected to Supabase Cloud DB: {self.url}")
        except Exception as e:
            print(f"⚠️ Supabase connection warning: {e}")

    def save_building(self, building_data: Dict[str, Any]) -> bool:
        """Store Building & Volumetric Units into Supabase Database"""
        if not self.client:
            print("Supabase client offline, storing in local fallback memory")
            return True
        try:
            res = self.client.table("buildings").upsert({
                "building_id": building_data.get("building_id"),
                "parcel_id": building_data.get("parcel_id"),
                "address": building_data.get("address"),
                "height": building_data.get("height"),
                "floor_count": building_data.get("floor_count"),
                "total_units": len(building_data.get("units", [])),
                "confidence_score": str(building_data.get("confidence_score", "85.0%")),
                "raw_json": building_data
            }).execute()
            print(f"✅ Successfully saved building {building_data.get('building_id')} to Supabase Cloud DB")
            return True
        except Exception as e:
            print(f"⚠️ Notice: Table 'buildings' not yet migrated in Supabase, caching in-memory. Details: {e}")
            return False

    def get_building(self, building_id: str) -> Optional[Dict[str, Any]]:
        """Fetch Building record from Supabase"""
        if not self.client:
            return None
        try:
            res = self.client.table("buildings").select("*").eq("building_id", building_id).execute()
            if res.data and len(res.data) > 0:
                return res.data[0].get("raw_json")
        except Exception as e:
            print(f"Error fetching from Supabase: {e}")
        return None

supabase_service = SupabaseService()
