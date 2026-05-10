"use client";

import { useEffect, useState, useCallback } from "react";
import { analisarRotulo } from "../lib/claude";

const G = {
  bg: "#0d0a08", surface: "#16110e", card: "#1e1712", border: "#2e231c",
  accent: "#c9a96e", accentDim: "#8a6a3a", red: "#8b1a1a",
  cream: "#f5ead8", muted: "#7a6a5a",
};

type Wine = {
  id: string; nome: string; vinicola: string; ano: number | null;
  uva: string; tipo: string; regiao: string; descricao: string;
  harmonizacao: string; precoMedio: number | null; pontuacao: number | null;
  fontePreco: string; notasAromaticas: string; temperatura: string;
  quantidade: number; notas: string; dataEntrada: string;
};

const uid = () => Math.random().toString(36).slice(2, 9);
const fmt = (n: number | null) => n != null ? `R$ ${Number(n).toFixed(2).replace(".", ",")}` : "—";
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

// ── resize image ──────────────────────────────────────────────────────────────
function resizeImage(file: File): Promise<{ b64: string; mediaType: string }> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1024;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
        else { width = Math.round(width * MAX / height); height = MAX; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      resolve({ b64: dataUrl.split(",")[1], mediaType: "image/jpeg" });
    };
    img.onerror = () => {
      const reader = new FileReader();
      reader.onload = (ev) => resolve({ b64: (ev.target!.result as string).split(",")[1], mediaType: file.type || "image/jpeg" });
      reader.readAsDataURL(file);
    };
    img.src = url;
  });
}

// ── ScoreBar ──────────────────────────────────────────────────────────────────
function ScoreBar({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score));
  return (
    <div style={{ height: 4, background: G.border, borderRadius: 2, overflow: "hidden", marginTop: 4 }}>
      <div style={{ height: "100%", width: `${pct}%`, borderRadius: 2, background: `linear-gradient(90deg, ${G.red}, ${G.accent})`, transition: "width 1s ease" }} />
    </div>
  );
}

// ── WineModal ─────────────────────────────────────────────────────────────────
function WineModal({ wine, onClose, onSave, onDarBaixa }: {
  wine: Partial<Wine>; onClose: () => void;
  onSave?: (w: Partial<Wine> & { quantidade: number; notas: string }) => void;
  onDarBaixa?: (id: string) => void;
}) {
  const [qty, setQty] = useState(wine.quantidade || 1);
  const [notes, setNotes] = useState(wine.notas || "");
  const isExisting = !!wine.id;

  const s: Record<string, React.CSSProperties> = {
    overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" },
    modal: { background: G.surface, borderRadius: "20px 20px 0 0", border: `1px solid ${G.border}`, borderBottom: "none", width: "100%", maxWidth: 430, padding: 20, maxHeight: "92vh", overflowY: "auto" },
    handle: { width: 36, height: 4, background: G.border, borderRadius: 2, margin: "0 auto 20px" },
    winery: { fontSize: 10, letterSpacing: 3, color: G.accent, textTransform: "uppercase", marginBottom: 4 },
    name: { fontFamily: "'Cormorant Garamond', serif", fontSize: 22, color: G.cream, lineHeight: 1.2, marginBottom: 12 },
    tags: { display: "flex", flexWrap: "wrap" as const, gap: 6, marginBottom: 14 },
    statsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 },
    statBox: { background: "rgba(255,255,255,.03)", border: `1px solid ${G.border}`, borderRadius: 8, padding: 10, textAlign: "center" as const },
    statVal: { fontFamily: "'Cormorant Garamond', serif", fontSize: 22, color: G.accent, display: "block" },
    statLbl: { fontSize: 8, letterSpacing: 3, color: G.muted, textTransform: "uppercase" as const },
    divider: { border: "none", borderTop: `1px solid ${G.border}`, margin: "14px 0" },
    label: { fontSize: 9, letterSpacing: 3, color: G.muted, textTransform: "uppercase" as const, marginBottom: 6, display: "block" },
    textarea: { width: "100%", background: "rgba(255,255,255,.04)", border: `1px solid ${G.border}`, borderRadius: 8, padding: 10, color: G.cream, fontSize: 13, fontFamily: "'Josefin Sans', sans-serif", resize: "vertical" as const, minHeight: 80, outline: "none", marginBottom: 14 },
    qtyWrap: { display: "flex", alignItems: "center", gap: 12, marginBottom: 14 },
    qtyBtn: { width: 32, height: 32, borderRadius: "50%", border: `1px solid ${G.border}`, background: G.card, color: G.cream, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" },
    qtyNum: { fontFamily: "'Cormorant Garamond', serif", fontSize: 28, color: G.accent, minWidth: 40, textAlign: "center" as const },
    btnPrimary: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 24px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "'Josefin Sans', sans-serif", fontSize: 11, letterSpacing: 3, textTransform: "uppercase" as const, background: `linear-gradient(135deg, ${G.accent}, ${G.accentDim})`, color: G.bg, width: "100%" },
    btnDanger: { display: "flex", alignItems: "center", justifyContent: "center", padding: "8px 16px", borderRadius: 8, border: `1px solid ${G.red}`, background: "transparent", color: "#e57373", cursor: "pointer", fontFamily: "'Josefin Sans', sans-serif", fontSize: 10, letterSpacing: 2, textTransform: "uppercase" as const, width: "100%", marginTop: 8 },
  };

  const tagStyle = (bg: string, color: string, border: string): React.CSSProperties => ({
    padding: "4px 10px", borderRadius: 20, fontSize: 9, letterSpacing: 2, textTransform: "uppercase", background: bg, color, border: `1px solid ${border}`
  });

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.handle} />
        <div style={s.winery}>{wine.vinicola || "Vinícola"}</div>
        <div style={s.name}>{wine.nome || "Vinho sem identificação"}</div>
        <div style={s.tags}>
          {wine.ano && <span style={tagStyle("rgba(201,169,110,.12)", G.accent, "rgba(201,169,110,.25)")}>{wine.ano}</span>}
          {wine.uva && <span style={tagStyle("rgba(139,26,26,.25)", "#e57373", "rgba(139,26,26,.4)")}>{wine.uva}</span>}
          {wine.tipo && <span style={tagStyle("rgba(255,255,255,.06)", G.muted, G.border)}>{wine.tipo}</span>}
          {wine.regiao && <span style={tagStyle("rgba(74,124,89,.15)", "#81c995", "rgba(74,124,89,.3)")}>{wine.regiao}</span>}
        </div>
        <div style={s.statsGrid}>
          <div style={s.statBox}>
            <span style={s.statVal}>{wine.pontuacao ?? "—"}</span>
            <span style={s.statLbl}>Pontuação</span>
            {wine.pontuacao && <ScoreBar score={wine.pontuacao} />}
          </div>
          <div style={s.statBox}>
            <span style={{ ...s.statVal, fontSize: 16 }}>{fmt(wine.precoMedio ?? null)}</span>
            <span style={s.statLbl}>Preço médio</span>
            {wine.fontePreco && <span style={{ fontSize: 8, color: G.muted }}>{wine.fontePreco}</span>}
          </div>
        </div>
        {wine.descricao && <p style={{ fontSize: 12, color: G.muted, lineHeight: 1.6, marginBottom: 12, fontStyle: "italic" }}>{wine.descricao}</p>}
        {wine.notasAromaticas && (
          <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 8, padding: "10px 14px", marginBottom: 10 }}>
            <span style={s.label}>Notas aromáticas</span>
            <span style={{ fontSize: 12, color: G.cream }}>{wine.notasAromaticas}</span>
          </div>
        )}
        {wine.harmonizacao && (
          <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 8, padding: "10px 14px", marginBottom: 10 }}>
            <span style={s.label}>Harmonização</span>
            <span style={{ fontSize: 12, color: G.cream }}>{wine.harmonizacao}</span>
          </div>
        )}
        {wine.temperatura && <div style={{ fontSize: 10, color: G.muted, letterSpacing: 2, marginBottom: 14, textTransform: "uppercase" }}>🌡 Temperatura: {wine.temperatura}</div>}
        <hr style={s.divider} />
        {isExisting ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 10, letterSpacing: 2, color: G.muted }}>ENTRADA: {fmtDate(wine.dataEntrada!)}</span>
              <span style={{ fontSize: 10, letterSpacing: 2, color: G.accent }}>{wine.quantidade} garrafa(s)</span>
            </div>
            {wine.notas && <p style={{ fontSize: 12, color: G.muted, marginBottom: 12, fontStyle: "italic" }}>{wine.notas}</p>}
            <button style={s.btnDanger} onClick={() => onDarBaixa!(wine.id!)}>🍾 Dar baixa (retirar 1 garrafa)</button>
          </>
        ) : (
          <>
            <span style={s.label}>Quantidade de garrafas</span>
            <div style={s.qtyWrap}>
              <button style={s.qtyBtn} onClick={() => setQty(q => Math.max(1, q - 1))}>−</button>
              <span style={s.qtyNum}>{qty}</span>
              <button style={s.qtyBtn} onClick={() => setQty(q => q + 1)}>+</button>
            </div>
            <span style={s.label}>Notas pessoais</span>
            <textarea style={s.textarea} placeholder="Observações, safra especial, presente de..." value={notes} onChange={e => setNotes(e.target.value)} />
            <button style={s.btnPrimary} onClick={() => onSave!({ ...wine, quantidade: qty, notas: notes })}>✦ Adicionar à adega</button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function Home() {
  const [tab, setTab] = useState<"scanner" | "cellar" | "stats">("scanner");
  const [cellar, setCellar] = useState<Wine[]>([]);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<Partial<Wine> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedWine, setSelectedWine] = useState<Wine | null>(null);

  useEffect(() => {
    try { const d = localStorage.getItem("adega_v2"); if (d) setCellar(JSON.parse(d)); } catch {}
  }, []);
  useEffect(() => { localStorage.setItem("adega_v2", JSON.stringify(cellar)); }, [cellar]);

  const processFile = useCallback(async (file: File) => {
    setScanning(true); setError(null); setResult(null);
    try {
      const { b64, mediaType } = await resizeImage(file);
      const wine = await analisarRotulo(b64, mediaType);
      setResult(wine);
    } catch (e: any) {
      setError(e.message || "Erro ao analisar o rótulo");
    } finally { setScanning(false); }
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { e.target.value = ""; processFile(file); }
  }, [processFile]);

  const handleSave = (wine: Partial<Wine> & { quantidade: number; notas: string }) => {
    const entry: Wine = { ...(wine as Wine), id: uid(), dataEntrada: new Date().toISOString() };
    setCellar(prev => [entry, ...prev]);
    setResult(null);
    setSuccess(`"${wine.nome || "Vinho"}" adicionado!`);
    setTimeout(() => setSuccess(null), 3000);
    setTab("cellar");
  };

  const handleDarBaixa = (id: string) => {
    setCellar(prev => prev.map(w => w.id !== id ? w : w.quantidade <= 1 ? null! : { ...w, quantidade: w.quantidade - 1 }).filter(Boolean));
    setSelectedWine(null);
    setSuccess("Garrafa retirada."); setTimeout(() => setSuccess(null), 3000);
  };

  const totalGarrafas = cellar.reduce((s, w) => s + w.quantidade, 0);
  const avgScore = cellar.length ? Math.round(cellar.reduce((s, w) => s + (w.pontuacao || 0), 0) / cellar.length) : 0;
  const totalValor = cellar.reduce((s, w) => s + (w.precoMedio || 0) * w.quantidade, 0);
  const topWines = [...cellar].sort((a, b) => (b.pontuacao || 0) - (a.pontuacao || 0)).slice(0, 5);

  // ── Styles ─────────────────────────────────────────────────────────────────
  const s: Record<string, React.CSSProperties> = {
    app: { maxWidth: 430, margin: "0 auto", minHeight: "100vh", background: G.bg, display: "flex", flexDirection: "column" },
    header: { padding: "20px 20px 12px", background: `linear-gradient(180deg, ${G.bg} 60%, transparent)`, position: "sticky", top: 0, zIndex: 50, borderBottom: `1px solid ${G.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" },
    title: { fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 300, letterSpacing: 3, color: G.accent },
    sub: { fontSize: 9, letterSpacing: 4, color: G.muted, textTransform: "uppercase", marginTop: 2 },
    nav: { display: "flex", borderBottom: `1px solid ${G.border}`, background: G.surface },
    content: { flex: 1, overflowY: "auto", padding: 16, paddingBottom: 80 },
    card: { background: G.card, border: `1px solid ${G.border}`, borderRadius: 12, padding: 16, marginBottom: 12 },
    spinner: { display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: 32, color: G.muted, fontSize: 10, letterSpacing: 3, textTransform: "uppercase" },
    alertErr: { padding: "12px 14px", borderRadius: 8, fontSize: 11, letterSpacing: 1, marginBottom: 12, background: "rgba(139,26,26,.15)", border: "1px solid rgba(139,26,26,.35)", color: "#e57373" },
    alertInfo: { padding: "12px 14px", borderRadius: 8, fontSize: 11, letterSpacing: 1, marginBottom: 12, background: "rgba(201,169,110,.1)", border: "1px solid rgba(201,169,110,.25)", color: G.accent },
    alertOk: { padding: "12px 14px", borderRadius: 8, fontSize: 11, letterSpacing: 1, margin: "12px 16px 0", background: "rgba(74,124,89,.15)", border: "1px solid rgba(74,124,89,.3)", color: "#81c995" },
    btnPrimary: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 24px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "'Josefin Sans', sans-serif", fontSize: 11, letterSpacing: 3, textTransform: "uppercase" as const, background: `linear-gradient(135deg, ${G.accent}, ${G.accentDim})`, color: G.bg, width: "100%", marginBottom: 10 },
    fileLabel: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 24px", borderRadius: 8, cursor: "pointer", background: G.card, border: `1px dashed ${G.border}`, color: G.muted, fontSize: 11, letterSpacing: 2, textTransform: "uppercase" as const, width: "100%" },
    wineItem: { background: G.card, border: `1px solid ${G.border}`, borderRadius: 12, padding: 14, marginBottom: 10, display: "flex", gap: 12, alignItems: "flex-start", cursor: "pointer" },
    statsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 },
    statsBox: { background: G.card, border: `1px solid ${G.border}`, borderRadius: 12, padding: 16, textAlign: "center" },
    statsBig: { fontFamily: "'Cormorant Garamond', serif", fontSize: 36, color: G.accent, display: "block" },
    statsLbl: { fontSize: 9, letterSpacing: 3, color: G.muted, textTransform: "uppercase" as const },
    empty: { textAlign: "center", padding: "60px 20px", color: G.muted, fontSize: 11, letterSpacing: 3, textTransform: "uppercase" as const },
  };

  const navBtn = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: "12px 4px", fontFamily: "'Josefin Sans', sans-serif", fontSize: 9,
    letterSpacing: 2, textTransform: "uppercase", background: "none", border: "none",
    color: active ? G.accent : G.muted, cursor: "pointer",
    borderBottom: `2px solid ${active ? G.accent : "transparent"}`,
  });

  return (
    <div style={s.app}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <div style={s.title}>ADEGA</div>
          <div style={s.sub}>Minha coleção pessoal</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, color: G.accent }}>{totalGarrafas}</div>
          <div style={{ fontSize: 11, letterSpacing: 2, color: G.accentDim }}>garrafas</div>
        </div>
      </div>

      {/* Nav */}
      <div style={s.nav}>
        {(["scanner", "cellar", "stats"] as const).map(id => (
          <button key={id} style={navBtn(tab === id)} onClick={() => { setTab(id); setResult(null); }}>
            {id === "scanner" ? "📷 Escanear" : id === "cellar" ? "🍷 Adega" : "📊 Estatísticas"}
          </button>
        ))}
      </div>

      {success && <div style={s.alertOk}>{success}</div>}

      <div style={s.content}>

        {/* ── SCANNER ── */}
        {tab === "scanner" && (
          <>
            {scanning ? (
              <div style={s.spinner}>
                <div style={{ width: 36, height: 36, border: `2px solid ${G.border}`, borderTopColor: G.accent, borderRadius: "50%", animation: "spin .8s linear infinite" }} />
                <span>Analisando rótulo com IA...</span>
              </div>
            ) : result ? (
              <WineModal wine={result} onClose={() => setResult(null)} onSave={handleSave} onDarBaixa={() => {}} />
            ) : (
              <>
                <div style={{ textAlign: "center", padding: "32px 0 24px" }}>
                  <div style={{ fontSize: 64, marginBottom: 16 }}>🍷</div>
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, color: G.cream, marginBottom: 8 }}>Identificar um vinho</div>
                  <div style={{ fontSize: 11, color: G.muted, letterSpacing: 1, lineHeight: 1.6 }}>
                    Fotografe o rótulo para identificar o vinho,<br />consultar pontuação e preço médio
                  </div>
                </div>
                {error && <div style={s.alertErr}>{error}</div>}
                <label style={{ ...s.btnPrimary, display: "flex" } as React.CSSProperties}>
                  📸 Fotografar ou escolher rótulo
                  <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />
                </label>
                <div style={s.alertInfo}>✦ A IA identifica o vinho, busca preço médio e pontuação estilo Wine Spectator automaticamente.</div>
              </>
            )}
          </>
        )}

        {/* ── ADEGA ── */}
        {tab === "cellar" && (
          cellar.length === 0 ? (
            <div style={s.empty}><span style={{ fontSize: 48, display: "block", marginBottom: 16, opacity: .4 }}>🍾</span>Sua adega está vazia.</div>
          ) : cellar.map(wine => (
            <div style={s.wineItem} key={wine.id} onClick={() => setSelectedWine(wine)}>
              <div style={{ width: 4, borderRadius: 2, alignSelf: "stretch", flexShrink: 0, background: `linear-gradient(180deg, ${G.red}, ${G.accentDim})` }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 17, color: G.cream, marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{wine.nome}</div>
                <div style={{ fontSize: 9, letterSpacing: 2, color: G.accentDim, textTransform: "uppercase" }}>{[wine.vinicola, wine.ano, wine.uva].filter(Boolean).join(" · ")}</div>
                <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {wine.tipo && <span style={{ padding: "3px 8px", borderRadius: 20, fontSize: 8, letterSpacing: 2, textTransform: "uppercase", background: "rgba(255,255,255,.06)", color: G.muted, border: `1px solid ${G.border}` }}>{wine.tipo}</span>}
                  {wine.pontuacao && <span style={{ padding: "3px 8px", borderRadius: 20, fontSize: 8, letterSpacing: 2, textTransform: "uppercase", background: "rgba(201,169,110,.12)", color: G.accent, border: "1px solid rgba(201,169,110,.25)" }}>⭐ {wine.pontuacao} pts</span>}
                  {wine.precoMedio && <span style={{ padding: "3px 8px", borderRadius: 20, fontSize: 8, letterSpacing: 2, textTransform: "uppercase", background: "rgba(74,124,89,.15)", color: "#81c995", border: "1px solid rgba(74,124,89,.3)" }}>{fmt(wine.precoMedio)}</span>}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, color: G.accent, display: "block" }}>{wine.quantidade}</span>
                <span style={{ fontSize: 8, letterSpacing: 2, color: G.muted, textTransform: "uppercase" }}>garrafa{wine.quantidade !== 1 ? "s" : ""}</span>
                <div style={{ fontSize: 9, color: G.muted, marginTop: 4 }}>{fmtDate(wine.dataEntrada)}</div>
              </div>
            </div>
          ))
        )}

        {/* ── ESTATÍSTICAS ── */}
        {tab === "stats" && (
          <>
            <div style={s.statsGrid}>
              {[
                [cellar.length, "Rótulos"], [totalGarrafas, "Garrafas"],
                [avgScore || "—", "Pontuação média"], [totalValor > 0 ? `R$${Math.round(totalValor)}` : "—", "Valor estimado"]
              ].map(([val, lbl]) => (
                <div style={s.statsBox} key={lbl}>
                  <span style={s.statsBig}>{val}</span>
                  <span style={s.statsLbl}>{lbl}</span>
                </div>
              ))}
            </div>
            {topWines.length > 0 && (
              <>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, color: G.cream, marginBottom: 12 }}>Melhores pontuações</div>
                {topWines.map((wine, i) => (
                  <div style={s.wineItem} key={wine.id} onClick={() => setSelectedWine(wine)}>
                    <div style={{ fontSize: 22, fontFamily: "'Cormorant Garamond', serif", color: G.accentDim, minWidth: 28 }}>{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 17, color: G.cream }}>{wine.nome}</div>
                      <div style={{ fontSize: 9, letterSpacing: 2, color: G.accentDim, textTransform: "uppercase" }}>{wine.vinicola} · {wine.ano}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, color: G.accent, display: "block" }}>{wine.pontuacao ?? "—"}</span>
                      <span style={{ fontSize: 8, letterSpacing: 2, color: G.muted, textTransform: "uppercase" }}>pts</span>
                    </div>
                  </div>
                ))}
              </>
            )}
            {cellar.length === 0 && <div style={s.empty}><span style={{ fontSize: 48, display: "block", marginBottom: 16, opacity: .4 }}>📊</span>Nenhum dado ainda.</div>}
          </>
        )}
      </div>

      {/* Spinner keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Detail modal */}
      {selectedWine && (
        <WineModal wine={selectedWine} onClose={() => setSelectedWine(null)} onSave={handleSave} onDarBaixa={handleDarBaixa} />
      )}

      {result && tab === "scanner" && !scanning && (
        <WineModal wine={result} onClose={() => setResult(null)} onSave={handleSave} onDarBaixa={() => {}} />
      )}
    </div>
  );
}
