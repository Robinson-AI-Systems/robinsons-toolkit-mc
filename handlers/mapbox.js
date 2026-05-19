/**
 * Mapbox Handler — 55 tools
 * Geocoding, routing, isochrones, map matching, matrix, static maps,
 * datasets, tilesets, styles, uploads, and YardSync Super Tools.
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

async function mbPatch(path, body) {
  const url = `${BASE}${path}${path.includes('?') ? '&' : '?'}access_token=${token()}`;
  const res = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(`Mapbox ${res.status}: ${data.message || JSON.stringify(data)}`);
  return data;
}

async function mbDelete(path) {
  const url = `${BASE}${path}${path.includes('?') ? '&' : '?'}access_token=${token()}`;
  const res = await fetch(url, { method: 'DELETE' });
  if (res.status === 204) return { success: true };
  const data = await res.json();
  if (!res.ok) throw new Error(`Mapbox ${res.status}: ${data.message || JSON.stringify(data)}`);
  return data;
}

function coordStr(waypoints) {
  return waypoints.map(w => `${w.longitude},${w.latitude}`).join(';');
}

// Haversine distance in miles
function haversine(lat1, lng1, lat2, lng2) {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function execute(tool, args) {

  // ── GEOCODING ─────────────────────────────────────────────────────────────
  if (tool === 'mapbox_geocode') {
    const { address, country = 'us', limit = 5, proximity } = args;
    if (!address) throw new Error('address is required');
    let path = `/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?country=${country}&limit=${limit}`;
    if (proximity) path += `&proximity=${proximity}`;
    const data = await mb(path);
    return { results: data.features?.map(f => ({ place_name: f.place_name, coordinates: f.center, relevance: f.relevance, place_type: f.place_type })) };
  }
  if (tool === 'mapbox_reverse_geocode') {
    const { longitude, latitude, types } = args;
    if (longitude === undefined || latitude === undefined) throw new Error('longitude and latitude are required');
    let path = `/geocoding/v5/mapbox.places/${longitude},${latitude}.json`;
    if (types) path += `?types=${types}`;
    const data = await mb(path);
    return { place_name: data.features?.[0]?.place_name, all_results: data.features?.map(f => ({ place_name: f.place_name, place_type: f.place_type })) };
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
  if (tool === 'mapbox_geocode_address_only') {
    // Returns only addresses (filters out POIs, cities, etc.)
    const { address, country = 'us', limit = 3 } = args;
    const data = await mb(`/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?types=address&country=${country}&limit=${limit}`);
    return { results: data.features?.map(f => ({ place_name: f.place_name, coordinates: f.center, relevance: f.relevance })) };
  }
  if (tool === 'mapbox_search_places') {
    // Search POIs by category/name near coordinates
    const { query, longitude, latitude, limit = 10, country = 'us' } = args;
    let path = `/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?limit=${limit}&country=${country}`;
    if (longitude !== undefined && latitude !== undefined) path += `&proximity=${longitude},${latitude}`;
    const data = await mb(path);
    return { results: data.features?.map(f => ({ place_name: f.place_name, coordinates: f.center, category: f.properties?.category, place_type: f.place_type })) };
  }
  if (tool === 'mapbox_validate_address') {
    const { address, country = 'us' } = args;
    const data = await mb(`/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?country=${country}&types=address&limit=1`);
    const match = data.features?.[0];
    return { valid: !!(match && match.relevance >= 0.7), relevance: match?.relevance, normalized_address: match?.place_name, coordinates: match?.center };
  }
  if (tool === 'mapbox_address_to_coordinates') {
    // Simplified: returns just longitude and latitude
    const { address, country = 'us' } = args;
    const data = await mb(`/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?country=${country}&limit=1`);
    const f = data.features?.[0];
    if (!f) return { found: false };
    return { found: true, longitude: f.center[0], latitude: f.center[1], place_name: f.place_name };
  }
  if (tool === 'mapbox_coordinates_to_address') {
    // Simplified: returns just the address string
    const { longitude, latitude } = args;
    const data = await mb(`/geocoding/v5/mapbox.places/${longitude},${latitude}.json?types=address`);
    return { address: data.features?.[0]?.place_name || null };
  }

  // ── DIRECTIONS ────────────────────────────────────────────────────────────
  if (tool === 'mapbox_get_directions') {
    const { waypoints, profile = 'driving', alternatives = false, steps = false, overview = 'full', exclude } = args;
    if (!waypoints || waypoints.length < 2) throw new Error('At least 2 waypoints required');
    let path = `/directions/v5/mapbox/${profile}/${coordStr(waypoints)}?alternatives=${alternatives}&steps=${steps}&overview=${overview}&geometries=geojson`;
    if (exclude) path += `&exclude=${exclude}`;
    const data = await mb(path);
    const route = data.routes?.[0];
    return {
      distance_meters: route?.distance,
      distance_miles: route?.distance ? Math.round(route.distance / 1609.34 * 100) / 100 : null,
      duration_seconds: route?.duration,
      duration_minutes: route?.duration ? Math.round(route.duration / 60) : null,
      geometry: route?.geometry,
      legs: route?.legs?.map(l => ({ distance: l.distance, duration: l.duration }))
    };
  }
  if (tool === 'mapbox_get_walking_directions') {
    const { waypoints, steps = true } = args;
    const path = `/directions/v5/mapbox/walking/${coordStr(waypoints)}?steps=${steps}&overview=full&geometries=geojson`;
    const data = await mb(path);
    const route = data.routes?.[0];
    return { distance_meters: route?.distance, duration_minutes: route?.duration ? Math.round(route.duration / 60) : null, geometry: route?.geometry };
  }
  if (tool === 'mapbox_get_cycling_directions') {
    const { waypoints, steps = true } = args;
    const path = `/directions/v5/mapbox/cycling/${coordStr(waypoints)}?steps=${steps}&overview=full&geometries=geojson`;
    const data = await mb(path);
    const route = data.routes?.[0];
    return { distance_meters: route?.distance, duration_minutes: route?.duration ? Math.round(route.duration / 60) : null, geometry: route?.geometry };
  }
  if (tool === 'mapbox_get_turn_by_turn') {
    const { waypoints, profile = 'driving' } = args;
    const path = `/directions/v5/mapbox/${profile}/${coordStr(waypoints)}?steps=true&overview=full&geometries=geojson&voice_instructions=true`;
    const data = await mb(path);
    const route = data.routes?.[0];
    const steps = route?.legs?.flatMap(l => l.steps?.map(s => ({ instruction: s.maneuver?.instruction, distance_m: s.distance, duration_s: s.duration, type: s.maneuver?.type, modifier: s.maneuver?.modifier })));
    return { distance_miles: route?.distance ? Math.round(route.distance/1609.34*100)/100 : null, duration_minutes: route?.duration ? Math.round(route.duration/60) : null, steps };
  }
  if (tool === 'mapbox_optimize_route') {
    const { waypoints, profile = 'driving', roundtrip = false } = args;
    if (!waypoints || waypoints.length < 3) throw new Error('At least 3 waypoints required for optimization');
    const path = `/optimized-trips/v1/mapbox/${profile}/${coordStr(waypoints)}?roundtrip=${roundtrip}&source=first&destination=last&overview=full`;
    const data = await mb(path);
    const trip = data.trips?.[0];
    return { optimized_waypoints: data.waypoints, distance_meters: trip?.distance, duration_seconds: trip?.duration, geometry: trip?.geometry };
  }
  if (tool === 'mapbox_get_map_matching') {
    // Snap GPS trace to road network
    const { coordinates, profile = 'driving', radiuses } = args;
    if (!coordinates?.length) throw new Error('coordinates array of [lng,lat] pairs is required');
    const coordPairs = coordinates.map(c => `${c[0]},${c[1]}`).join(';');
    let path = `/matching/v5/mapbox/${profile}/${coordPairs}?overview=full&geometries=geojson`;
    if (radiuses) path += `&radiuses=${radiuses.join(';')}`;
    const data = await mb(path);
    const match = data.matchings?.[0];
    return { confidence: match?.confidence, distance_meters: match?.distance, duration_seconds: match?.duration, geometry: match?.geometry };
  }

  // ── DISTANCE MATRIX ───────────────────────────────────────────────────────
  if (tool === 'mapbox_get_matrix') {
    const { sources, destinations, profile = 'driving', annotations = 'duration,distance' } = args;
    if (!sources || !destinations) throw new Error('sources and destinations required');
    const allCoords = [...sources, ...destinations];
    const srcIndices = sources.map((_, i) => i).join(';');
    const dstIndices = destinations.map((_, i) => sources.length + i).join(';');
    const path = `/directions-matrix/v1/mapbox/${profile}/${coordStr(allCoords)}?sources=${srcIndices}&destinations=${dstIndices}&annotations=${annotations}`;
    const data = await mb(path);
    return { durations_seconds: data.durations, distances_meters: data.distances, sources: data.sources, destinations: data.destinations };
  }

  // ── ISOCHRONES ────────────────────────────────────────────────────────────
  if (tool === 'mapbox_get_isochrone') {
    const { longitude, latitude, profile = 'driving', minutes, meters } = args;
    if (longitude === undefined || latitude === undefined) throw new Error('longitude and latitude required');
    const contourParam = minutes ? `contours_minutes=${Array.isArray(minutes) ? minutes.join(',') : minutes}` : `contours_meters=${Array.isArray(meters) ? meters.join(',') : meters}`;
    const data = await mb(`/isochrone/v1/mapbox/${profile}/${longitude},${latitude}?${contourParam}&polygons=true`);
    return { features: data.features?.map(f => ({ contour_value: f.properties?.contour, geometry: f.geometry })) };
  }
  if (tool === 'mapbox_get_service_area') {
    const { longitude, latitude, drive_time_minutes = [15, 30, 60] } = args;
    const data = await mb(`/isochrone/v1/mapbox/driving/${longitude},${latitude}?contours_minutes=${drive_time_minutes.join(',')}&polygons=true`);
    return { service_areas: data.features?.map(f => ({ drive_time_minutes: f.properties?.contour, area_geojson: f.geometry })) };
  }

  // ── STATIC MAPS ───────────────────────────────────────────────────────────
  if (tool === 'mapbox_get_static_map_url') {
    const { longitude, latitude, zoom = 12, width = 600, height = 400, style = 'streets-v12', markers } = args;
    let markerStr = '';
    if (markers?.length) markerStr = markers.map(m => `pin-s+${(m.color||'f44').replace('#','')}(${m.longitude},${m.latitude})`).join(',') + '/';
    return { url: `${BASE}/styles/v1/mapbox/${style}/static/${markerStr}${longitude},${latitude},${zoom}/${width}x${height}?access_token=${token()}` };
  }
  if (tool === 'mapbox_get_satellite_map_url') {
    const { longitude, latitude, zoom = 14, width = 600, height = 400 } = args;
    return { url: `${BASE}/styles/v1/mapbox/satellite-v9/static/${longitude},${latitude},${zoom}/${width}x${height}?access_token=${token()}` };
  }
  if (tool === 'mapbox_get_route_map_url') {
    const { start_lng, start_lat, end_lng, end_lat, zoom = 10, style = 'streets-v12' } = args;
    const centerLng = (start_lng + end_lng) / 2;
    const centerLat = (start_lat + end_lat) / 2;
    return { url: `${BASE}/styles/v1/mapbox/${style}/static/pin-s+00f(${start_lng},${start_lat}),pin-s+f00(${end_lng},${end_lat})/${centerLng},${centerLat},${zoom}/600x400?access_token=${token()}` };
  }

  // ── CALCULATIONS (no API call needed) ─────────────────────────────────────
  if (tool === 'mapbox_calculate_distance') {
    const { lng1, lat1, lng2, lat2 } = args;
    const dist = haversine(lat1, lng1, lat2, lng2);
    return { distance_miles: Math.round(dist*100)/100, distance_km: Math.round(dist*1.60934*100)/100, note: 'Straight-line distance.' };
  }
  if (tool === 'mapbox_calculate_bearing') {
    const { lng1, lat1, lng2, lat2 } = args;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const lat1R = lat1 * Math.PI / 180, lat2R = lat2 * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(lat2R);
    const x = Math.cos(lat1R) * Math.sin(lat2R) - Math.sin(lat1R) * Math.cos(lat2R) * Math.cos(dLng);
    const bearing = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    const directions = ['N','NE','E','SE','S','SW','W','NW','N'];
    return { bearing_degrees: Math.round(bearing * 10) / 10, compass: directions[Math.round(bearing / 45)] };
  }
  if (tool === 'mapbox_calculate_midpoint') {
    const { lng1, lat1, lng2, lat2 } = args;
    return { longitude: (lng1 + lng2) / 2, latitude: (lat1 + lat2) / 2 };
  }
  if (tool === 'mapbox_point_in_polygon') {
    // Ray casting algorithm — checks if point is inside a GeoJSON polygon
    const { longitude, latitude, polygon } = args;
    if (!polygon) throw new Error('polygon (GeoJSON geometry or coordinates array) is required');
    const coords = polygon.coordinates?.[0] || polygon;
    let inside = false;
    for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
      const [xi, yi] = coords[i], [xj, yj] = coords[j];
      if ((yi > latitude) !== (yj > latitude) && longitude < (xj - xi) * (latitude - yi) / (yj - yi) + xi) inside = !inside;
    }
    return { inside, longitude, latitude };
  }

  // ── DATASETS ──────────────────────────────────────────────────────────────
  if (tool === 'mapbox_list_datasets') {
    const username = process.env.MAPBOX_USERNAME;
    if (!username) throw new Error('MAPBOX_USERNAME not set in .env');
    return await mb(`/datasets/v1/${username}`);
  }
  if (tool === 'mapbox_create_dataset') {
    const username = process.env.MAPBOX_USERNAME;
    if (!username) throw new Error('MAPBOX_USERNAME not set in .env');
    return await mbPost(`/datasets/v1/${username}`, { name: args.name, description: args.description || '' });
  }
  if (tool === 'mapbox_get_dataset') {
    const username = process.env.MAPBOX_USERNAME || '';
    return await mb(`/datasets/v1/${username}/${args.dataset_id}`);
  }
  if (tool === 'mapbox_delete_dataset') {
    const username = process.env.MAPBOX_USERNAME || '';
    return await mbDelete(`/datasets/v1/${username}/${args.dataset_id}`);
  }
  if (tool === 'mapbox_list_dataset_features') {
    const username = process.env.MAPBOX_USERNAME || '';
    return await mb(`/datasets/v1/${username}/${args.dataset_id}/features?limit=${args.limit || 50}`);
  }
  if (tool === 'mapbox_add_dataset_feature') {
    const username = process.env.MAPBOX_USERNAME || '';
    const { dataset_id, feature_id, geometry, properties } = args;
    return await mbPatch(`/datasets/v1/${username}/${dataset_id}/features/${feature_id || Date.now()}`, { type: 'Feature', geometry, properties: properties || {} });
  }
  if (tool === 'mapbox_delete_dataset_feature') {
    const username = process.env.MAPBOX_USERNAME || '';
    return await mbDelete(`/datasets/v1/${username}/${args.dataset_id}/features/${args.feature_id}`);
  }

  // ── TILESETS ──────────────────────────────────────────────────────────────
  if (tool === 'mapbox_list_tilesets') {
    const username = process.env.MAPBOX_USERNAME || '';
    return await mb(`/tilesets/v1/${username}?limit=${args.limit || 20}&type=${args.type || ''}`);
  }
  if (tool === 'mapbox_get_tileset') {
    return await mb(`/tilesets/v1/${args.tileset_id}`);
  }
  if (tool === 'mapbox_delete_tileset') {
    return await mbDelete(`/tilesets/v1/${args.tileset_id}`);
  }

  // ── STYLES ────────────────────────────────────────────────────────────────
  if (tool === 'mapbox_list_styles') {
    const username = process.env.MAPBOX_USERNAME || '';
    return await mb(`/styles/v1/${username}`);
  }
  if (tool === 'mapbox_get_style') {
    const username = process.env.MAPBOX_USERNAME || '';
    return await mb(`/styles/v1/${username}/${args.style_id}`);
  }
  if (tool === 'mapbox_delete_style') {
    const username = process.env.MAPBOX_USERNAME || '';
    return await mbDelete(`/styles/v1/${username}/${args.style_id}`);
  }

  // ── UPLOADS ───────────────────────────────────────────────────────────────
  if (tool === 'mapbox_list_uploads') {
    const username = process.env.MAPBOX_USERNAME || '';
    return await mb(`/uploads/v1/${username}`);
  }
  if (tool === 'mapbox_get_upload') {
    const username = process.env.MAPBOX_USERNAME || '';
    return await mb(`/uploads/v1/${username}/${args.upload_id}`);
  }
  if (tool === 'mapbox_delete_upload') {
    const username = process.env.MAPBOX_USERNAME || '';
    return await mbDelete(`/uploads/v1/${username}/${args.upload_id}`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  SUPER TOOLS (YardSync-specific)
  // ══════════════════════════════════════════════════════════════════════════

  // SUPER: Find the nearest depot/location to a customer address
  if (tool === 'mapbox_find_nearest_depot') {
    const { customer_address, depots } = args;
    if (!customer_address || !depots?.length) throw new Error('customer_address and depots array required');
    const custData = await mb(`/geocoding/v5/mapbox.places/${encodeURIComponent(customer_address)}.json?limit=1`);
    const custCoords = custData.features?.[0]?.center;
    if (!custCoords) throw new Error(`Could not geocode: ${customer_address}`);
    const results = await Promise.all(depots.map(async (depot) => {
      const depotData = await mb(`/geocoding/v5/mapbox.places/${encodeURIComponent(depot.address || depot)}.json?limit=1`);
      const dc = depotData.features?.[0]?.center;
      const dist = dc ? haversine(custCoords[1], custCoords[0], dc[1], dc[0]) : Infinity;
      return { ...depot, coordinates: dc, distance_miles: Math.round(dist * 100) / 100 };
    }));
    results.sort((a, b) => a.distance_miles - b.distance_miles);
    return { customer_coordinates: custCoords, nearest_depot: results[0], all_depots: results };
  }

  // SUPER: Check if an address falls within a service area polygon
  if (tool === 'mapbox_check_service_coverage') {
    const { address, service_area_polygon, country = 'us' } = args;
    if (!address || !service_area_polygon) throw new Error('address and service_area_polygon are required');
    const data = await mb(`/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?country=${country}&limit=1`);
    const f = data.features?.[0];
    if (!f) return { in_service_area: false, reason: 'Address not found' };
    const [longitude, latitude] = f.center;
    const coords = service_area_polygon.coordinates?.[0] || service_area_polygon;
    let inside = false;
    for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
      const [xi, yi] = coords[i], [xj, yj] = coords[j];
      if ((yi > latitude) !== (yj > latitude) && longitude < (xj - xi) * (latitude - yi) / (yj - yi) + xi) inside = !inside;
    }
    return { in_service_area: inside, address: f.place_name, coordinates: f.center };
  }

  // SUPER: Get ETAs from one depot to many addresses (batched matrix)
  if (tool === 'mapbox_batch_eta') {
    const { depot_address, destination_addresses, profile = 'driving' } = args;
    const depotData = await mb(`/geocoding/v5/mapbox.places/${encodeURIComponent(depot_address)}.json?limit=1`);
    const depotCoords = depotData.features?.[0]?.center;
    if (!depotCoords) throw new Error(`Could not geocode depot: ${depot_address}`);
    const destCoords = [];
    for (const addr of destination_addresses) {
      const d = await mb(`/geocoding/v5/mapbox.places/${encodeURIComponent(addr)}.json?limit=1`);
      destCoords.push({ address: addr, coordinates: d.features?.[0]?.center });
    }
    const validDests = destCoords.filter(d => d.coordinates);
    if (!validDests.length) throw new Error('No destination addresses could be geocoded');
    const allCoords = [{ longitude: depotCoords[0], latitude: depotCoords[1] }, ...validDests.map(d => ({ longitude: d.coordinates[0], latitude: d.coordinates[1] }))];
    const srcIdx = '0';
    const dstIdx = validDests.map((_, i) => i + 1).join(';');
    const matrixData = await mb(`/directions-matrix/v1/mapbox/${profile}/${coordStr(allCoords)}?sources=${srcIdx}&destinations=${dstIdx}&annotations=duration,distance`);
    return {
      depot: depot_address,
      etas: validDests.map((d, i) => ({
        address: d.address,
        duration_minutes: matrixData.durations?.[0]?.[i] ? Math.round(matrixData.durations[0][i] / 60) : null,
        distance_miles: matrixData.distances?.[0]?.[i] ? Math.round(matrixData.distances[0][i] / 1609.34 * 10) / 10 : null
      })),
      failed_geocodes: destCoords.filter(d => !d.coordinates).map(d => d.address)
    };
  }

  // SUPER: Plan optimized driver stops from a depot address
  if (tool === 'mapbox_plan_driver_stops') {
    const { depot_address, stop_addresses, profile = 'driving' } = args;
    if (!depot_address || !stop_addresses?.length) throw new Error('depot_address and stop_addresses are required');
    const depotResult = await mb(`/geocoding/v5/mapbox.places/${encodeURIComponent(depot_address)}.json?limit=1`);
    const depot = depotResult.features?.[0]?.center;
    if (!depot) throw new Error(`Could not geocode depot: ${depot_address}`);
    const stops = [];
    for (const addr of stop_addresses) {
      const r = await mb(`/geocoding/v5/mapbox.places/${encodeURIComponent(addr)}.json?limit=1`);
      const cf = r.features?.[0];
      stops.push({ address: addr, coordinates: cf?.center, found: !!cf });
    }
    const foundStops = stops.filter(s => s.found);
    const waypoints = [{ longitude: depot[0], latitude: depot[1] }, ...foundStops.map(s => ({ longitude: s.coordinates[0], latitude: s.coordinates[1] }))];
    const routeData = await mb(`/optimized-trips/v1/mapbox/${profile}/${coordStr(waypoints)}?roundtrip=false&source=first&destination=last&overview=simplified`);
    return {
      depot: depot_address, stops_geocoded: foundStops.length, stops_failed: stops.filter(s => !s.found).map(s => s.address),
      optimized_order: routeData.waypoints?.map((w, i) => ({ stop: i, address: foundStops[w.waypoint_index - 1]?.address || depot_address })),
      total_distance_miles: routeData.trips?.[0]?.distance ? Math.round(routeData.trips[0].distance / 1609.34 * 10) / 10 : null,
      total_duration_minutes: routeData.trips?.[0]?.duration ? Math.round(routeData.trips[0].duration / 60) : null
    };
  }

  // SUPER: Generate service area coverage map for a depot
  if (tool === 'mapbox_service_area_map') {
    const { depot_address, drive_times = [15, 30, 60], country = 'us' } = args;
    if (!depot_address) throw new Error('depot_address is required');
    const data = await mb(`/geocoding/v5/mapbox.places/${encodeURIComponent(depot_address)}.json?country=${country}&limit=1`);
    const f = data.features?.[0];
    if (!f) throw new Error(`Could not geocode: ${depot_address}`);
    const [lng, lat] = f.center;
    const isoData = await mb(`/isochrone/v1/mapbox/driving/${lng},${lat}?contours_minutes=${drive_times.join(',')}&polygons=true`);
    const mapUrl = `${BASE}/styles/v1/mapbox/streets-v12/static/${lng},${lat},10/600x400?access_token=${token()}`;
    return {
      depot: depot_address, coordinates: f.center, map_url: mapUrl,
      service_areas: isoData.features?.map(f => ({ drive_time_minutes: f.properties?.contour, polygon: f.geometry }))
    };
  }

  throw new Error(`Unknown Mapbox tool: ${tool}`);
}

export default { execute };
