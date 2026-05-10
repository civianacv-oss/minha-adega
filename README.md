# 🍷 Minha Adega IA

App de adega pessoal com análise de rótulo por IA.

## Instalação

```bash
npm install
```

## Configurar API Key

Crie o arquivo `.env.local` na raiz do projeto:

```
ANTHROPIC_API_KEY=sk-ant-api03-SUA_CHAVE_AQUI
```

Obtenha sua chave em: https://console.anthropic.com/

## Rodar

```bash
npm run dev
```

Acesse: http://localhost:3000

## Funcionalidades

- 📸 Foto do rótulo → IA identifica vinho, uva, vinícola, ano, região
- 💰 Preço médio estimado em BRL
- ⭐ Pontuação estilo Wine Spectator (0-100)
- 🍾 Controle de estoque (quantidade + dar baixa)
- 📝 Notas pessoais por vinho
- 📊 Estatísticas: total de rótulos, garrafas, valor da adega
- 💾 Dados salvos localmente no navegador

## Estrutura

```
app/
  page.tsx          ← UI principal
  layout.tsx        ← Layout global
  globals.css       ← Estilos base
  api/
    analisar/
      route.ts      ← API backend → chama Claude
lib/
  claude.ts         ← Helper para chamar a API
.env.local          ← Sua ANTHROPIC_API_KEY (não commitar!)
```
