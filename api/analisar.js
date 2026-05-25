export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { image, chat, system, messages } = req.body;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) return res.status(500).json({ error: 'API key não configurada.' });

  try {
    // Modo chat (sommelier)
    if (chat && messages) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-opus-4-5',
          max_tokens: 800,
          system: system || 'Você é um sommelier especialista. Responda em português brasileiro de forma elegante e concisa.',
          messages,
        }),
      });
      const data = await response.json();
      const text = data.content?.[0]?.text || 'Desculpe, não consegui responder.';
      return res.status(200).json({ text });
    }

    // Modo scanner (análise de rótulo por imagem)
    if (image) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-opus-4-5',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: 'image/jpeg', data: image },
              },
              {
                type: 'text',
                text: `Analise este rótulo de vinho e retorne SOMENTE um JSON válido, sem markdown, com estes campos:
{
  "nome": "nome completo do vinho",
  "vinicola": "nome da vinícola",
  "ano": "ano da safra ou null",
  "tipo": "Tinto, Branco, Rosé, Espumante ou Licoroso",
  "uva": "uva(s) principal(is)",
  "regiao": "região/país de origem",
  "pontuacao": número de 0 a 100 estimado estilo Wine Spectator,
  "precoMedio": número em BRL (reais brasileiros) estimado,
  "descricao": "descrição elegante do vinho em 1-2 frases",
  "notasAromaticas": "notas de aroma e sabor",
  "harmonizacao": "sugestões de harmonização",
  "temperatura": "temperatura ideal de serviço"
}`,
              },
            ],
          }],
        }),
      });

      const data = await response.json();
      const text = data.content?.[0]?.text || '';
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      return res.status(200).json(parsed);
    }

    return res.status(400).json({ error: 'Requisição inválida.' });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno: ' + (err.message || 'desconhecido') });
  }
}
