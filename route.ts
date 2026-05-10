import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(req: Request) {
  try {
    const { image, mediaType } = await req.json();
    if (!image) return NextResponse.json({ error: "Imagem não fornecida" }, { status: 400 });

    const prompt = `Você é um sommelier especialista. Analise esta imagem de rótulo de vinho e retorne APENAS um objeto JSON válido (sem markdown, sem texto fora do JSON) com exatamente estes campos:
{"nome":"string","vinicola":"string","ano":2020,"uva":"string","tipo":"Tinto|Branco|Rosé|Espumante","regiao":"string","descricao":"string 2-3 frases","harmonizacao":"string","precoMedio":120.00,"pontuacao":88,"fontePreco":"Estimativa sommelier","notasAromaticas":"string","temperatura":"string"}
Regras: use null para campos não identificados. pontuacao 0-100 estilo Wine Spectator. precoMedio em BRL. Retorne SOMENTE o JSON.`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: image } },
          { type: "text", text: prompt }
        ]
      }]
    });

    const text = response.content.find(b => b.type === "text")?.text;
    if (!text) throw new Error("Resposta vazia da IA");

    const match = text.replace(/```(?:json)?/g, "").trim().match(/\{[\s\S]*\}/);
    if (!match) throw new Error("JSON não encontrado na resposta");

    return NextResponse.json(JSON.parse(match[0]));
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || "Erro interno" }, { status: 500 });
  }
}
