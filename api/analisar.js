export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { image } = req.body;
  if (!image) return res.status(400).json({ error: 'Imagem não fornecida' });

  const prompt = `Você é sommelier. Analise o rótulo e retorne APENAS JSON válido:\n{"nome":"string","vinicola":"string","ano":2020,"uva":"string","tipo":"Tinto","regiao":"string","descricao":"string","harmonizacao":"string","precoMedio":120.00,"pontuacao":88,"notasAromaticas":"string","temperatura":"string"}\nCampos desconhecidos: null. SOMENTE o JSON.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
          { type: 'text', text: prompt }
        ]
      }]
    })
  });

  const data = await response.json();
  if (data.type === 'error') return res.status(500).json({ error: data.error?.message });

  const text = data.content?.find(b => b.type === 'text')?.text;
  if (!text) return res.status(500).json({ error: 'Sem resposta da IA' });

  const match = text.replace(/```(?:json)?/g, '').trim().match(/\{[\s\S]*\}/);
  if (!match) return res.status(500).json({ error: 'JSON não encontrado' });

  res.status(200).json(JSON.parse(match[0]));
}
