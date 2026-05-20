/**
 * SAM.gov Handler — 19 tools
 * Federal contract opportunities, awards, entity registry,
 * exclusions (debarment), wage determinations, NAICS codes, and Super Tools.
 * API base: https://api.sam.gov
 */

const BASE = 'https://api.sam.gov';

function apiKey() {
  const key = process.env.SAM_API_KEY || process.env.INTAKE_SAM_TOKEN;
  if (!key) throw new Error('SAM_API_KEY or INTAKE_SAM_TOKEN not set in .env');
  return key;
}

async function sam(path, params = {}) {
  const key = apiKey();
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set('api_key', key);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), {
    headers: { 'Accept': 'application/json' }
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`SAM.gov ${res.status} for ${path}: ${err.slice(0, 300)}`);
  }
  return await res.json();
}

async function execute(tool, args) {

  // ── CONTRACT OPPORTUNITIES ───────────────────────────────────────────────
  if (tool === 'sam_search_opportunities') {
    const { keywords, naics_code, set_aside_code, agency, state, posted_from, posted_to, limit = 25, offset = 0 } = args;
    return await sam('/opportunities/v2/search', {
      q: keywords, naicsCode: naics_code, typeOfSetAside: set_aside_code,
      department: agency, placeOfPerformanceState: state,
      postedFrom: posted_from, postedTo: posted_to,
      limit, offset, active: 'Yes'
    });
  }

  if (tool === 'sam_get_opportunity') {
    const { notice_id } = args;
    if (!notice_id) throw new Error('notice_id is required');
    return await sam(`/opportunities/v2/${notice_id}`);
  }

  if (tool === 'sam_list_opportunity_attachments') {
    const { notice_id } = args;
    if (!notice_id) throw new Error('notice_id is required');
    const data = await sam(`/opportunities/v2/${notice_id}`);
    return {
      notice_id,
      attachments: data.attachments || data.resourceLinks || [],
      description: data.description || ''
    };
  }

  if (tool === 'sam_search_opportunities_by_naics') {
    const { naics_code, keywords, limit = 25 } = args;
    if (!naics_code) throw new Error('naics_code is required');
    return await sam('/opportunities/v2/search', { naicsCode: naics_code, q: keywords, limit, active: 'Yes' });
  }

  if (tool === 'sam_search_opportunities_by_agency') {
    const { agency, limit = 25 } = args;
    if (!agency) throw new Error('agency is required (department name or code)');
    return await sam('/opportunities/v2/search', { department: agency, limit, active: 'Yes' });
  }

  if (tool === 'sam_search_opportunities_near_location') {
    const { zip_code, radius_miles = 50, naics_code, limit = 25 } = args;
    if (!zip_code) throw new Error('zip_code is required');
    return await sam('/opportunities/v2/search', {
      placeOfPerformanceZip: zip_code,
      naicsCode: naics_code,
      limit, active: 'Yes'
    });
  }

  // ── AWARDS ────────────────────────────────────────────────────────────────
  if (tool === 'sam_search_awards') {
    const { keywords, naics_code, agency, uei, limit = 25, offset = 0 } = args;
    // Awards data is through USASpending API (a SAM-adjacent system)
    const awardRes = await fetch(`https://api.usaspending.gov/api/v2/search/spending_by_award/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filters: {
          keywords: keywords ? [keywords] : undefined,
          naics_codes: naics_code ? [naics_code] : undefined,
          agencies: agency ? [{ type: 'funding', tier: 'toptier', name: agency }] : undefined,
          recipient_search_text: uei ? [uei] : undefined,
          award_type_codes: ['A', 'B', 'C', 'D'] // contracts
        },
        fields: ['Award ID', 'Recipient Name', 'Award Amount', 'Description', 'Period of Performance Start Date', 'Period of Performance End Date', 'Awarding Agency'],
        sort: 'Award Amount', order: 'desc',
        limit, page: Math.floor(offset / limit) + 1
      })
    });
    if (!awardRes.ok) throw new Error(`USASpending API ${awardRes.status}`);
    return await awardRes.json();
  }

  if (tool === 'sam_get_award') {
    const { award_id } = args;
    if (!award_id) throw new Error('award_id is required');
    const res = await fetch(`https://api.usaspending.gov/api/v2/awards/${award_id}/`, {
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) throw new Error(`USASpending API ${res.status}`);
    return await res.json();
  }

  if (tool === 'sam_list_awards_by_contractor') {
    const { uei, limit = 25 } = args;
    if (!uei) throw new Error('uei (Unique Entity Identifier) is required');
    const res = await fetch(`https://api.usaspending.gov/api/v2/search/spending_by_award/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filters: { recipient_search_text: [uei], award_type_codes: ['A', 'B', 'C', 'D'] },
        fields: ['Award ID', 'Award Amount', 'Description', 'Period of Performance Start Date', 'Awarding Agency'],
        sort: 'Award Amount', order: 'desc', limit
      })
    });
    if (!res.ok) throw new Error(`USASpending API ${res.status}`);
    return await res.json();
  }

  if (tool === 'sam_list_awards_by_agency') {
    const { agency, limit = 25 } = args;
    if (!agency) throw new Error('agency is required');
    const res = await fetch(`https://api.usaspending.gov/api/v2/search/spending_by_award/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filters: { agencies: [{ type: 'funding', tier: 'toptier', name: agency }], award_type_codes: ['A', 'B', 'C', 'D'] },
        fields: ['Award ID', 'Recipient Name', 'Award Amount', 'Description', 'Period of Performance Start Date'],
        sort: 'Award Amount', order: 'desc', limit
      })
    });
    if (!res.ok) throw new Error(`USASpending API ${res.status}`);
    return await res.json();
  }

  // ── ENTITY REGISTRY ───────────────────────────────────────────────────────────
  if (tool === 'sam_search_entities') {
    const { keywords, legal_name, state, naics_code, limit = 10 } = args;
    return await sam('/entity-information/v3/entities', {
      q: keywords, legalBusinessName: legal_name,
      physicalAddressStateOrProvinceCode: state,
      naicsCode: naics_code, pageSize: limit
    });
  }

  if (tool === 'sam_get_entity') {
    const { uei } = args;
    if (!uei) throw new Error('uei (Unique Entity Identifier) is required');
    return await sam('/entity-information/v3/entities', { ueiSAM: uei });
  }

  if (tool === 'sam_check_entity_active') {
    const { uei } = args;
    if (!uei) throw new Error('uei is required');
    const data = await sam('/entity-information/v3/entities', { ueiSAM: uei, includeSections: 'entityRegistration' });
    const entity = data.entityData?.[0];
    if (!entity) return { active: false, message: 'Entity not found in SAM.gov' };
    const status = entity.entityRegistration?.registrationStatus;
    return {
      uei,
      active: status === 'Active',
      registration_status: status,
      expiration_date: entity.entityRegistration?.registrationExpirationDate,
      legal_name: entity.entityRegistration?.legalBusinessName
    };
  }

  // ── EXCLUSIONS ───────────────────────────────────────────────────────────────
  if (tool === 'sam_check_exclusions') {
    const { name, uei } = args;
    if (!name && !uei) throw new Error('name or uei is required');
    const params = uei ? { ueiSAM: uei } : { exclusionName: name };
    const data = await sam('/exclusions/v1/exclusions', params);
    const exclusions = data.exclusionData || [];
    return {
      excluded: exclusions.length > 0,
      count: exclusions.length,
      exclusions: exclusions.slice(0, 5).map(e => ({
        name: e.exclusionName,
        type: e.exclusionType,
        agency: e.excludingAgencyCode,
        start_date: e.activationDate,
        end_date: e.terminationDate || 'Indefinite'
      }))
    };
  }

  // ── WAGE DETERMINATIONS ──────────────────────────────────────────────────────
  if (tool === 'sam_search_wage_determinations') {
    const { state, county, keywords, type, limit = 10 } = args;
    return await sam('/wage-determinations/v2/wage-determinations', {
      q: keywords, stateCode: state, countyName: county,
      wdType: type, limit
    });
  }

  if (tool === 'sam_get_wage_determination') {
    const { wd_number, revision } = args;
    if (!wd_number) throw new Error('wd_number is required');
    const path = revision
      ? `/wage-determinations/v2/wage-determinations/${wd_number}/${revision}`
      : `/wage-determinations/v2/wage-determinations/${wd_number}`;
    return await sam(path);
  }

  // ── NAICS CODES ─────────────────────────────────────────────────────────────
  if (tool === 'sam_list_naics_codes') {
    const { keywords, limit = 20 } = args;
    if (!keywords) throw new Error('keywords is required for NAICS code search');
    return await sam('/prod/locationservices/v1/api/naics', { description: keywords, pageSize: limit });
  }

  if (tool === 'sam_get_naics_code') {
    const { naics_code } = args;
    if (!naics_code) throw new Error('naics_code is required');
    return await sam(`/prod/locationservices/v1/api/naics/${naics_code}`);
  }

  // ── SUPER TOOLS ───────────────────────────────────────────────────────────

  if (tool === 'sam_find_opportunities_for_contractor') {
    // Search for opportunities matching a contractor's profile
    const { naics_codes, state, keywords, limit = 15 } = args;
    if (!naics_codes?.length) throw new Error('naics_codes array is required');
    const results = [];
    for (const naics of naics_codes.slice(0, 3)) { // Search up to 3 NAICS codes
      try {
        const data = await sam('/opportunities/v2/search', {
          naicsCode: naics, placeOfPerformanceState: state,
          q: keywords, limit: Math.ceil(limit / naics_codes.length), active: 'Yes'
        });
        const opps = data.opportunitiesData || [];
        results.push(...opps.map(o => ({ naics_searched: naics, ...o })));
      } catch (e) {
        // skip failed naics
      }
    }
    return {
      total_found: results.length,
      naics_codes_searched: naics_codes.slice(0, 3),
      opportunities: results.slice(0, limit).map(o => ({
        notice_id: o.noticeId,
        title: o.title,
        agency: o.fullParentPathName || o.departmentName,
        posted: o.postedDate,
        response_deadline: o.responseDeadLine,
        set_aside: o.typeOfSetAside,
        type: o.type,
        naics: o.naicsCode
      }))
    };
  }

  if (tool === 'sam_contractor_due_diligence') {
    // Look up entity + check exclusions + get recent award count
    const { uei, name } = args;
    if (!uei && !name) throw new Error('uei or name is required');
    const results = { uei, name };
    // 1. Check entity registration
    try {
      const entityParams = uei ? { ueiSAM: uei } : { legalBusinessName: name };
      const entityData = await sam('/entity-information/v3/entities', entityParams);
      const entity = entityData.entityData?.[0];
      results.registration = entity ? {
        legal_name: entity.entityRegistration?.legalBusinessName,
        status: entity.entityRegistration?.registrationStatus,
        expiration: entity.entityRegistration?.registrationExpirationDate,
        uei: entity.entityRegistration?.ueiSAM,
        cage_code: entity.entityRegistration?.cageCode
      } : { status: 'Not found' };
    } catch { results.registration = { error: 'Lookup failed' }; }
    // 2. Check exclusions
    try {
      const exclParams = uei ? { ueiSAM: uei } : { exclusionName: name };
      const exclData = await sam('/exclusions/v1/exclusions', exclParams);
      const exclusions = exclData.exclusionData || [];
      results.exclusions = { excluded: exclusions.length > 0, count: exclusions.length };
    } catch { results.exclusions = { error: 'Lookup failed' }; }
    return results;
  }

  if (tool === 'sam_bid_opportunity_summary') {
    // Get full opportunity details + attachments + contact info
    const { notice_id } = args;
    if (!notice_id) throw new Error('notice_id is required');
    const data = await sam(`/opportunities/v2/${notice_id}`);
    return {
      notice_id,
      title: data.title,
      agency: data.fullParentPathName,
      type: data.type,
      posted: data.postedDate,
      response_deadline: data.responseDeadLine,
      set_aside: data.typeOfSetAside,
      naics: data.naicsCode,
      place_of_performance: data.placeOfPerformance,
      description: (data.description || '').slice(0, 2000),
      contact: {
        name: data.pointOfContact?.[0]?.fullName,
        email: data.pointOfContact?.[0]?.email,
        phone: data.pointOfContact?.[0]?.phone
      },
      attachments: (data.attachments || data.resourceLinks || []).slice(0, 10)
    };
  }

  throw new Error(`Unknown sam tool: ${tool}`);
}

export default { execute };
