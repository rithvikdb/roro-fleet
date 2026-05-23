const GROQ_API_KEY = process.env.REACT_APP_GROQ_API_KEY;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

export async function parseNoonReport(reportText, vesselNames = []) {
  if (!GROQ_API_KEY) throw new Error('Groq API key not configured');

  const prompt = `You are a maritime data extraction system. Extract structured data from this noon report.
Return ONLY a valid JSON object — no markdown, no explanation, no code blocks.
JSON keys required:
{
  "vesselName": string,
  "imo": string,
  "reportDate": string,
  "lat": number,
  "lon": number,
  "speed": number,
  "fuelConsumed": number,
  "cargoLM": number,
  "cargoUtil": number,
  "nextPort": string,
  "eta": string,
  "status": "sea" or "port" or "loading" or "discharge",
  "distanceSailed": number,
  "windForce": number,
  "waveHeight": number
}
Noon report:
${reportText}`;

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Groq error: ${err.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content || '';
  const clean = raw.replace(/```json|```/g, '').trim();

  try {
    return JSON.parse(clean);
  } catch {
    throw new Error('AI returned invalid JSON. Try again or check the report format.');
  }
}