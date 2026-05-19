/**
 * Mapbox Handler — 28 tools (NEW - built for YardSync)
 * Geocoding, reverse geocoding, routing, isochrones, directions,
 * matrix API, and static maps for dumpster/service area management.
 */

const BASE = 'https://api.mapbox.com';

function token() {
  const t = process.env.MAPBOX_ACCESS_TOKEN;
  if (!t) throw new Error('MAPBOX_ACCESS_TOKEN not set in .env');
  return t;
}

async function mb(path) {
  const url = `${BASE}${path}${path.includes('?') ? '&' : '?'}access_token=${token()}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(`Mapbox ${res.status}: ${data.message || JSON.stringify(data)}`);
  return data;
}

async function mbPost(path, body) {
  const url = `${BASE}${path}${path.includes('?') ? '&' : '?'}access_token=${token()}`;
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(`Mapbox ${res.status}: ${data.message || JSON.stringify(data)}`);
  return data;
}

function coords(lng, lat) { return `${lng},${lat}`; }

async function execute(tool, args) {

  // ── GEOCODING ─────────────────────────────────────────────────────────────
  if (tool === 'mapbox_geocode') {
    const { address, country = 'us', limit = 5, proximity } = args;
    if (!address) throw new Error('address is required');
    let path = `/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?country=${country}&limit=${limit}`;
    if (proximity) path += `&proximity=${proximity}`;
    const data = await mb(path);
    return {
      results: data.features?.map(f => ({
        place_name: f.place_name, coordinates: f.center, relevance: f.relevance,
        address: f.properties?.address, place_type: f.place_type
      }))
    };
  }
  if (tool === 'mapbox_reverse_geocode') {
    const { longitude, latitude, types } = args;
    if (longitude === undefined || latitude === undefined) throw new Error('longitude and latitude are required');
    let path = `/geocoding/v5/mapbox.places/${longitude},${latitude}.json`;
    if (types) path += `?types=${types}`;
    const data = await mb(path);
    return {
      place_name: data.features?.[0]?.place_name,
      address: data.features?.[0]?.properties?.address,
      all_results: data.features?.map(f => ({ place_name: f.place_name, place_type: f.place_type }))
    };
  }
  if (tool === 'mapbox_batch_geocode') {
    const { addresses, country = 'us' } = args;
    const results = [];
    for (const address of addresses) {
      try {
        const data = await mb(`/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?country=${country}&limit=1`);
        const f = data.features?.[0];
        results.push({ input: address, place_name: f?.place_name, coordinates: f?.center, found: !!f });
      } catch (e) { results.push({ input: address, error: e.message, found: false }); }
    }
    return { results, found: results.filter(r => r.found).length, not_found: results.filter(r => !r.found).length };
  }

  // ── DIRECTIONS / ROUTING ──────────────────────────────────────────────────
  if (tool === 'mapbox_get_directions') {
    const { waypoints, profile = 'driving', alternatives = false, steps = false, overview = 'full' } = args;
    if (!waypoints || waypoints.length < 2) throw new Error('At least 2 waypoints required: [{longitude, latitude}]');
    const coordStr = waypoints.map(w => coords(w.longitude, w.latitude)).join(';');
    const path = `/directions/v5/mapbox/${profile}/${coordStr}?alternatives=${alternatives}&steps=${steps}&overview=${overview}&geometries=geojson`;
    const data = await mb(path);
    const route = data.routes?.[0];
    return {
      distance_meters: route?.distance,
      distance_miles: route?.distance ? Math.round(route.distance / 1609.34 * 100) / 100 : null,
      duration_seconds: route?.duration,
      duration_minutes: route?.duration ? Math.round(route.duration / 60) : null,
      geometry: route?.geometry,
      legs: route?.legs?.map(l => ({ distance: l.distance, duration: l.duration, steps: steps ? l.steps : undefined })),
      alternatives: alternatives ? data.routes?.slice(1).map(r => ({ distance: r.distance, duration: r.duration })) : undefined
    };
  }
  if (tool === 'mapbox_optimize_route') {
    // Traveling salesman / route optimization for multiple stops
    const { waypoints, profile = 'driving' } = args;
    if (!waypoints || waypoints.length < 3) throw new Error('At least 3 waypoints for optimization (source, stops, destination)');
    const coordStr = waypoints.map(w => coords(w.longitude, w.latitude)).join(';');
    const path = `/optimized-trips/v1/mapbox/${profile}/${coordStr}?roundtrip=${args.roundtrip || false}&source=first&destination=last&overview=full`;
    const data = await mb(path);
    const trip = data.trips?.[0];
    return {
      optimized_waypoints: data.waypoints?.map(w => ({ name: w.name, waypoint_index: w.waypoint_index, trips_index: w.trips_index })),
      distance_meters: trip?.distance,
      duration_seconds: trip?.duration,
      geometry: trip?.geometry
    };
  }
  if (tool === 'mapbox_get_matrix') {
    // Get travel times between multiple origins and destinations
    const { sources, destinations, profile = 'driving', annotations = 'duration,distance' } = args;
    if (!sources || !destinations) throw new Error('sources and destinations arrays of coordinates required');
    const allCoords = [...sources, ...destinations].map(w => coords(w.longitude, w.latitude)).join(';');
    const srcIndices = sources.map((_, i) => i).join(';');
    const dstIndices = destinations.map((_, i) => sources.length + i).join(';');
    const path = `/directions-matrix/v1/mapbox/${profile}/${allCoords}?sources=${srcIndices}&destinations=${dstIndices}&annotations=${annotations}`;
    const data = await mb(path);
    return {
      durations_seconds: data.durations,
      distances_meters: data.distances,
      sources: data.sources,
      destinations: data.destinations
    };
  }

  // ── ISOCHRONES (service area / coverage zones — key for YardSync) ─────────
  if (tool === 'mapbox_get_isochrone') {
    const { longitude, latitude, profile = 'driving', minutes, meters } = args;
    if (longitude === undefined || latitude === undefined) throw new Error('longitude and latitude required');
    const contourParam = minutes ? `contours_minutes=${Array.isArray(minutes) ? minutes.join(',') : minutes}` :
                                   `contours_meters=${Array.isArray(meters) ? meters.join(',') : meters}`;
    const path = `/isochrone/v1/mapbox/${profile}/${longitude},${latitude}?${contourParam}&polygons=true`;
    const data = await mb(path);
    return {
      features: data.features?.map(f => ({
        contour_value: f.properties?.contour,
        color: f.properties?.color,
        geometry: f.geometry
      }))
    };
  }
  if (tool === 'mapbox_get_service_area') {
    // Returns isochrone polygon for a service location — useful for YardSync coverage
    const { longitude, latitude, drive_time_minutes = [15, 30, 60] } = args;
    const path = `/isochrone/v1/mapbox/driving/${longitude},${latitude}?contours_minutes=${drive_time_minutes.join(',')}&polygons=true`;
    const data = await mb(path);
    return {
      service_areas: data.features?.map(f => ({
        drive_time_minutes: f.properties?.contour,
        area_geojson: f.geometry,
        note: `${f.properties?.contour}-minute drive radius from coordinates`
      }))
    };
  }

  // ── STATIC MAPS ───────────────────────────────────────────────────────────
  if (tool === 'mapbox_get_static_map_url') {
    const { longitude, latitude, zoom = 12, width = 600, height = 400, style = 'streets-v12', markers } = args;
    let markerStr = '';
    if (markers) {
      markerStr = markers.map(m => `pin-s+${(m.color || 'f44').replace('#','')}(${m.longitude},${m.latitude})`).join(',') + '/';
    }
    const url = `${BASE}/styles/v1/mapbox/${style}/static/${markerStr}${longitude},${latitude},${zoom}/${width}x${height}?access_token=${token()}`;
    return { url, note: 'Use this URL in <img> tags or send to customers in emails.' };
  }
  if (tool === 'mapbox_get_route_map_url') {
    const { start_lng, start_lat, end_lng, end_lat, zoom = 10, style = 'streets-v12' } = args;
    const centerLng = (start_lng + end_lng) / 2;
    const centerLat = (start_lat + end_lat) / 2;
    const markers = `pin-s+00f(${start_lng},${start_lat}),pin-s+f00(${end_lng},${end_lat})`;
    const url = `${BASE}/styles/v1/mapbox/${style}/static/${markers}/${centerLng},${centerLat},${zoom}/600x400?access_token=${token()}`;
    return { url };
  }

  // ── ADDRESS VALIDATION ────────────────────────────────────────────────────
  if (tool === 'mapbox_validate_address') {
    const { address, country = 'us' } = args;
    const data = await mb(`/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?country=${country}&types=address&limit=1`);
    const match = data.features?.[0];
    return {
      valid: !!(match && match.relevance >= 0.7),
      relevance: match?.relevance,
      normalized_address: match?.place_name,
      coordinates: match?.center,
      note: match ? `Confidence: ${Math.round(match.relevance * 100)}%` : 'Address not found'
    };
  }
  if (tool === 'mapbox_calculate_distance') {
    const { lng1, lat1, lng2, lat2 } = args;
    // Haversine formula for straight-line distance
    const R = 3959; // Earth radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
    const distance_miles = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return {
      distance_miles: Math.round(distance_miles * 100) / 100,
      distance_km: Math.round(distance_miles * 1.60934 * 100) / 100,
      note: 'Straight-line distance. Use mapbox_get_directions for driving distance.'
    };
  }

  // ── SEARCH & PLACES ───────────────────────────────────────────────────────
  if (tool === 'mapbox_search_nearby') {
    const { longitude, latitude, query, limit = 10, radius_meters = 5000 } = args;
    const path = `/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?proximity=${longitude},${latitude}&limit=${limit}`;
    const data = await mb(path);
    return { results: data.features?.map(f => ({ place_name: f.place_name, distance_to_center: null, coordinates: f.center })) };
  }
  if (tool === 'mapbox_get_place_details') {
    // Forward geocode with full details
    const data = await mb(`/geocoding/v5/mapbox.places/${encodeURIComponent(args.place_name)}.json?limit=1`);
    return data.features?.[0] || null;
  }

  // ── YARDS / DISPATCH (YardSync compound) ──────────────────────────────────
  if (tool === 'mapbox_plan_driver_stops') {
    // Given a list of delivery addresses, geocode all and return optimized route
    const { depot_address, stop_addresses, profile = 'driving' } = args;
    if (!depot_address || !stop_addresses?.length) throw new Error('depot_address and stop_addresses are required');

    // Geocode depot
    const depotResult = await mb(`/geocoding/v5/mapbox.places/${encodeURIComponent(depot_address)}.json?limit=1`);
    const depot = depotResult.features?.[0]?.center;
    if (!depot) throw new Error(`Could not geocode depot: ${depot_address}`);

    // Geocode all stops
    const stops = [];
    for (const addr of stop_addresses) {
      const result = await mb(`/geocoding/v5/mapbox.places/${encodeURIComponent(addr)}.json?limit=1`);
      const coords_f = result.features?.[0];
      stops.push({ address: addr, coordinates: coords_f?.center, found: !!coords_f });
    }
    const foundStops = stops.filter(s => s.found);

    // Build waypoints for optimization
    const waypoints = [
      { longitude: depot[0], latitude: depot[1] },
      ...foundStops.map(s => ({ longitude: s.coordinates[0], latitude: s.coordinates[1] })),
      { longitude: depot[0], latitude: depot[1] } // Return to depot
    ];

    const coordStr = waypoints.map(w => `${w.longitude},${w.latitude}`).join(';');
    const routeData = await mb(`/optimized-trips/v1/mapbox/${profile}/${coordStr}?roundtrip=false&source=first&destination=last&overview=simplified`);

    return {
      depot: depot_address,
      stops_geocoded: foundStops.length,
      stops_failed: stops.filter(s => !s.found),
      optimized_order: routeData.waypoints?.map((w, i) => ({ stop_index: i, original_address: foundStops[w.waypoint_index - 1]?.address || depot_address })),
      total_distance_miles: routeData.trips?.[0]?.distance ? Math.round(routeData.trips[0].distance / 1609.34 * 10) / 10 : null,
      total_duration_minutes: routeData.trips?.[0]?.duration ? Math.round(routeData.trips[0].duration / 60) : null
    };
  }

  throw new Error(`Unknown Mapbox tool: ${tool}`);
}

export default { execute };
