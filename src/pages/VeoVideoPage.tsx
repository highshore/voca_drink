import { useEffect, useMemo, useRef, useState } from "react";
import { s } from "../ui/layout";
import { GoogleGenAI } from "@google/genai";

type ChatItem =
  | { role: "user"; text: string; ts: number }
  | {
      role: "assistant";
      text?: string;
      videoUrl?: string;
      status?: "pending" | "error" | "ready";
      ts: number;
    };

export function VeoVideoPage() {
  const [chat, setChat] = useState<ChatItem[]>([]);
  const [input, setInput] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [mode, setMode] = useState<"text" | "video">("text");
  const [model, setModel] = useState<
    | "veo-3.0-generate-preview"
    | "veo-3.0-fast-generate-preview"
    | "veo-2.0-generate-001"
  >("veo-3.0-generate-preview");
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16">("16:9");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [resultsCount, setResultsCount] = useState<number>(1);
  const [imageBytes, setImageBytes] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  const ai = useMemo(
    () => new GoogleGenAI({ apiKey: import.meta.env.VITE_GOOGLE_API_KEY }),
    []
  );

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [chat.length]);

  // Ensure settings align with model capabilities
  useEffect(() => {
    if (model.startsWith("veo-3.0")) {
      if (aspectRatio !== "16:9") setAspectRatio("16:9");
      if (resultsCount !== 1) setResultsCount(1);
    } else {
      if (resultsCount > 2) setResultsCount(2);
    }
  }, [model]);

  function onPickImage(file: File | null) {
    setImageBytes(null);
    setImageMime(null);
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(",")[1];
        setImageBytes(base64);
        setImageMime(file.type || "image/png");
      } catch (_) {}
    };
    reader.readAsDataURL(file);
  }

  async function generate(prompt: string) {
    setIsBusy(true);
    const ts = Date.now();
    setChat((c) => [
      ...c,
      { role: "user", text: prompt, ts },
      mode === "video"
        ? {
            role: "assistant",
            text: "Generating video…",
            status: "pending",
            ts: ts + 1,
          }
        : { role: "assistant", text: "", status: "pending", ts: ts + 1 },
    ]);
    try {
      if (mode === "video") {
        // Build request
        const reqBase: any = {
          model,
          prompt,
          config: { aspectRatio } as any,
        };
        if (negativePrompt.trim()) {
          (reqBase.config as any).negativePrompt = negativePrompt.trim();
        }
        if (imageBytes && imageMime) {
          reqBase.image = { imageBytes, mimeType: imageMime };
          if (model.startsWith("veo-3.0"))
            (reqBase as any).personGeneration = "allow_adult";
        } else if (model.startsWith("veo-3.0")) {
          (reqBase as any).personGeneration = "allow_all";
        }

        async function generateOne(): Promise<string | undefined> {
          let operation: any = await ai.models.generateVideos(reqBase);
          let iter = 0;
          while (!operation.done) {
            await new Promise((r) => setTimeout(r, iter < 3 ? 2000 : 5000));
            operation = await ai.operations.getVideosOperation({ operation });
            iter += 1;
          }
          const file = operation.response?.generatedVideos?.[0]?.video;
          const base: string | undefined = (file && (file.url || file.uri)) as
            | string
            | undefined;
          const apiKey = import.meta.env.VITE_GOOGLE_API_KEY as string;
          const build = (u: string, k: string, v: string) => {
            const url = new URL(u);
            url.searchParams.set(k, v);
            return url.toString();
          };
          let objectUrl: string | undefined;
          if (base) {
            const candidates = [
              base,
              build(base, "alt", "media"),
              build(base, "key", apiKey),
              build(build(base, "alt", "media"), "key", apiKey),
            ];
            for (const u of candidates) {
              try {
                const res = await fetch(u);
                if (!res.ok) continue;
                const ct = res.headers.get("content-type") || "";
                if (!ct.includes("video") && !ct.includes("octet-stream"))
                  continue;
                const blob = await res.blob();
                if (blob.size === 0) continue;
                objectUrl = URL.createObjectURL(blob);
                break;
              } catch (_) {}
            }
            if (!objectUrl) {
              try {
                const res = await fetch(base, {
                  headers: { "x-goog-api-key": apiKey } as any,
                });
                if (res.ok) {
                  const blob = await res.blob();
                  if (blob.size > 0) objectUrl = URL.createObjectURL(blob);
                }
              } catch (_) {}
            }
          }
          return objectUrl;
        }

        const runs = model.startsWith("veo-2.0")
          ? Math.max(1, Math.min(resultsCount, 2))
          : 1;
        for (let i = 0; i < runs; i++) {
          const objectUrl = await generateOne();
          setChat((c) => {
            const next = [...c];
            let replaced = false;
            for (let j = next.length - 1; j >= 0; j--) {
              if (
                (next[j] as any).role === "assistant" &&
                (next[j] as any).status === "pending"
              ) {
                next[j] = {
                  role: "assistant",
                  videoUrl: objectUrl,
                  status: objectUrl ? "ready" : "error",
                  ts: next[j].ts,
                } as ChatItem;
                replaced = true;
                break;
              }
            }
            if (!replaced) {
              next.push({
                role: "assistant",
                videoUrl: objectUrl,
                status: objectUrl ? "ready" : "error",
                ts: Date.now(),
              } as any);
            }
            return next;
          });
        }
      } else {
        // Text mode via Gemini 2.5 Pro
        const resp: any = await (ai as any).models.generateContent({
          model: "gemini-2.5-pro",
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        });
        const text = resp?.response?.text || resp?.text || "";
        setChat((c) => {
          const next = [...c];
          for (let i = next.length - 1; i >= 0; i--) {
            if ((next[i] as any).role === "assistant") {
              next[i] = {
                role: "assistant",
                text: text || "",
                status: "ready",
                ts: next[i].ts,
              } as ChatItem;
              break;
            }
          }
          return next;
        });
      }
    } catch (e: any) {
      setChat((c) => {
        const next = [...c];
        for (let i = next.length - 1; i >= 0; i--) {
          if ((next[i] as any).role === "assistant") {
            next[i] = {
              role: "assistant",
              text: e?.message || "Failed to generate.",
              status: "error",
              ts: next[i].ts,
            } as ChatItem;
            break;
          }
        }
        return next;
      });
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div
      style={{
        ...s.container,
        display: "flex",
        flexDirection: "column",
        minHeight: "70vh",
      }}
    >
      <h2 style={{ margin: 0, marginBottom: 8, ...s.gradientTitle }}>Chat</h2>
      <div style={{ color: "#64748b", fontSize: 12, marginBottom: 8 }}>
        Gemini 2.5 Pro • Veo 3 Video
      </div>
      <div
        ref={listRef}
        style={{
          ...s.card,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          flex: 1,
          overflow: "auto",
        }}
      >
        {chat.length === 0 && (
          <div style={{ color: "#64748b", fontSize: 14 }}>
            Enter a cinematic prompt below to generate an 8s 720p clip with
            audio. Example: “Close-up of rain on a window at night, neon
            reflections, a distant siren.”
          </div>
        )}
        {chat.map((m, idx) => (
          <div
            key={idx}
            style={{ display: "flex", gap: 10, alignItems: "flex-start" }}
          >
            <div
              style={{
                flex: 1,
                display: "flex",
                justifyContent: m.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  maxWidth: 680,
                  border: "1px solid #e2e8f0",
                  background: m.role === "user" ? "#f8fafc" : "#ffffff",
                  borderRadius: 12,
                  padding: 10,
                }}
              >
                {m.text && <div style={{ fontSize: 14 }}>{m.text}</div>}
                {m.role === "assistant" && (m as any).videoUrl && (
                  <video
                    src={(m as any).videoUrl}
                    controls
                    playsInline
                    style={{
                      width: "100%",
                      borderRadius: 12,
                      border: "1px solid #e2e8f0",
                    }}
                  />
                )}
                {m.role === "assistant" && (m as any).status === "pending" && (
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    Generating…
                  </div>
                )}
                {m.role === "assistant" && (m as any).status === "error" && (
                  <div style={{ fontSize: 12, color: "#b91c1c" }}>
                    Failed to generate.
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim() || isBusy) return;
          generate(input.trim());
          setInput("");
        }}
        style={{
          position: "sticky",
          bottom: 0,
          background: "#fff",
          paddingTop: 10,
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={() => setMode("text")}
            style={{
              ...s.button,
              ...(mode === "text" ? s.buttonBrand : {}),
            }}
          >
            Text
          </button>
          <button
            type="button"
            onClick={() => setMode("video")}
            style={{
              ...s.button,
              ...(mode === "video" ? s.buttonBrand : {}),
            }}
          >
            Video
          </button>
        </div>
        {mode === "video" && (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value as any)}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                padding: "8px 10px",
                fontSize: 12,
              }}
            >
              <option value="veo-3.0-generate-preview">Veo 3</option>
              <option value="veo-3.0-fast-generate-preview">Veo 3 Fast</option>
              <option value="veo-2.0-generate-001">Veo 2</option>
            </select>
            <button
              type="button"
              onClick={() => setShowOptions((v) => !v)}
              style={{ ...s.button }}
            >
              {showOptions ? "Hide options" : "Options"}
            </button>
          </div>
        )}
        {showOptions && mode === "video" && (
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              width: "100%",
              flexWrap: "wrap",
            }}
          >
            <label
              style={{
                display: "flex",
                gap: 6,
                alignItems: "center",
                fontSize: 12,
                color: "#64748b",
              }}
            >
              Aspect
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value as any)}
                disabled={model.startsWith("veo-3.0")}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  padding: "6px 8px",
                  fontSize: 12,
                }}
              >
                <option value="16:9">16:9</option>
                <option value="9:16">9:16 (Veo 2)</option>
              </select>
            </label>
            <label
              style={{
                display: "flex",
                gap: 6,
                alignItems: "center",
                fontSize: 12,
                color: "#64748b",
              }}
            >
              Results
              <input
                type="number"
                min={1}
                max={model.startsWith("veo-2.0") ? 2 : 1}
                value={resultsCount}
                onChange={(e) =>
                  setResultsCount(
                    Math.max(
                      1,
                      Math.min(
                        Number(e.target.value) || 1,
                        model.startsWith("veo-2.0") ? 2 : 1
                      )
                    )
                  )
                }
                style={{
                  width: 56,
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  padding: "6px 8px",
                  fontSize: 12,
                }}
              />
            </label>
            <input
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              placeholder="Negative prompt (e.g., cartoon, low quality)"
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                padding: "8px 10px",
                fontSize: 12,
                flex: 1,
                minWidth: 200,
              }}
            />
            <label
              style={{
                display: "flex",
                gap: 6,
                alignItems: "center",
                fontSize: 12,
                color: "#64748b",
              }}
            >
              Image
              <input
                type="file"
                accept="image/*"
                onChange={(e) => onPickImage(e.target.files?.[0] || null)}
              />
            </label>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              Duration: Veo 3 fixed at 8s; Veo 2 is 5–8s (model-defined)
            </div>
          </div>
        )}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            mode === "video"
              ? "Describe your video (supports dialogue & SFX)"
              : "Ask Gemini 2.5 Pro"
          }
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            padding: "12px 14px",
            fontSize: 14,
            flex: 1,
          }}
        />
        <button
          disabled={isBusy || !input.trim()}
          style={{ ...s.button, ...s.buttonBrand }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
