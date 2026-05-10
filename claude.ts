export async function analisarRotulo(base64: string, mediaType: string) {
  const response = await fetch("/api/analisar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64, mediaType })
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data;
}
