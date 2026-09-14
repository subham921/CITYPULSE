-- Add WATERLOGGED to events_event_type_check constraint
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_event_type_check;
ALTER TABLE public.events ADD CONSTRAINT events_event_type_check
    CHECK (event_type IN ('POTHOLE', 'NEAR_MISS', 'MISSING_DIVIDER', 'ROAD_DISTRESS', 'WATERLOGGED'));
