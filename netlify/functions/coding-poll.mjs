import { getStore } from '@netlify/blobs';

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS });
  }

  const url = new URL(req.url);
  const jobId = url.searchParams.get('jobId');

  if (!jobId) {
    return new Response(JSON.stringify({ error: 'jobId query param required' }), { status: 400, headers: CORS });
  }

  const store = getStore('coding-jobs');
  let job;
  try {
    job = await store.get(jobId, { type: 'json' });
  } catch {
    job = null;
  }

  if (!job) {
    return new Response(JSON.stringify({ status: 'pending' }), { status: 200, headers: CORS });
  }

  return new Response(JSON.stringify(job), { status: 200, headers: CORS });
};
