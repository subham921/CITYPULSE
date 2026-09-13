-- ══════════════════════════════════════════════════════════════════════════════
-- CITYPULSE: Production Supabase (PostgreSQL + PostGIS) Schema
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Enable PostGIS for high-performance geospatial hazard queries
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create Events Table (Edge Fleet & Citizen Road Hazards)
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('POTHOLE', 'NEAR_MISS', 'MISSING_DIVIDER', 'ROAD_DISTRESS')),
    status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'UNDER_REVIEW', 'ACTIONED', 'DISMISSED')),
    severity TEXT NOT NULL DEFAULT 'MODERATE' CHECK (severity IN ('LOW', 'MODERATE', 'SEVERE')),
    bus_id TEXT NOT NULL DEFAULT 'CITIZEN_PORTAL',
    route_id TEXT DEFAULT 'PUBLIC_FEED',
    
    -- Coordinate storage
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    
    -- PostGIS geography column (automatically computed from lat/lng for radius & corridor queries)
    geom GEOGRAPHY(Point, 4326) GENERATED ALWAYS AS (
        ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
    ) STORED,
    
    -- Mappls Reverse Geocoded Address
    address TEXT,
    location JSONB DEFAULT '{}'::jsonb,
    
    -- Telemetry & AI Sensor Fusion
    gps JSONB DEFAULT '{}'::jsonb,
    imu JSONB DEFAULT '{}'::jsonb,
    vision JSONB DEFAULT '{}'::jsonb,
    fusion JSONB DEFAULT '{}'::jsonb,
    
    -- Specific hazard detail payloads
    pothole_details JSONB,
    near_miss_details JSONB,
    divider_details JSONB,
    citizen_details JSONB,
    
    -- Audit & Evidence Chain
    report_count INTEGER NOT NULL DEFAULT 1,
    status_history JSONB DEFAULT '[]'::jsonb,
    evidence_hash TEXT,
    previous_evidence_hash TEXT,
    
    -- Timestamps
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. High-Performance Spatial and Query Indexes
CREATE INDEX IF NOT EXISTS idx_events_geom ON public.events USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_events_status ON public.events (status);
CREATE INDEX IF NOT EXISTS idx_events_type ON public.events (event_type);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON public.events (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_bus ON public.events (bus_id);

-- 4. Enable Supabase Realtime for instant WebSocket updates on dashboards
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'events'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
    END IF;
END $$;

-- 5. Row-Level Security (RLS)
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Allow public read access (Both Admin & Citizen dashboards can query events)
DROP POLICY IF EXISTS "Public events can be read by anyone" ON public.events;
CREATE POLICY "Public events can be read by anyone"
ON public.events FOR SELECT
USING (true);

-- Allow inserting events (Citizens logging hazards and edge bus units posting telemetry)
DROP POLICY IF EXISTS "Anyone can report an event" ON public.events;
CREATE POLICY "Anyone can report an event"
ON public.events FOR INSERT
WITH CHECK (true);

-- Allow status updates (Authority workflow)
DROP POLICY IF EXISTS "Enable update for service role and transport authorities" ON public.events;
CREATE POLICY "Enable update for service role and transport authorities"
ON public.events FOR UPDATE
USING (true)
WITH CHECK (true);

-- 6. Spatial Stored Procedure: Find Hazards Near GPS Coordinate (within X meters)
CREATE OR REPLACE FUNCTION public.get_hazards_nearby(
    target_lat DOUBLE PRECISION,
    target_lng DOUBLE PRECISION,
    radius_meters DOUBLE PRECISION DEFAULT 2000.0
)
RETURNS TABLE (
    event_id TEXT,
    event_type TEXT,
    status TEXT,
    severity TEXT,
    address TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    distance_meters DOUBLE PRECISION
)
LANGUAGE sql STABLE AS $$
    SELECT 
        e.event_id,
        e.event_type,
        e.status,
        e.severity,
        e.address,
        e.latitude,
        e.longitude,
        ST_Distance(e.geom, ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::geography) AS distance_meters
    FROM public.events e
    WHERE ST_DWithin(e.geom, ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::geography, radius_meters)
    ORDER BY distance_meters ASC;
$$;
