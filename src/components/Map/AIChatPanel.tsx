import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, X, Send, Upload, Trash2, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string };

interface LayerData {
  name: string;
  count: number;
  sample: Record<string, any>[];
}

interface AIChatPanelProps {
  getLayerData: () => LayerData[];
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/geo-chat`;

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map(h => h.replace(/^["']|["']$/g, "").trim());
  return lines.slice(1).map(line => {
    const vals = line.split(sep);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = (vals[i] || "").replace(/^["']|["']$/g, "").trim(); });
    return obj;
  });
}

function summarizeData(records: Record<string, any>[], maxRows = 50): string {
  if (records.length === 0) return "Ingen data";
  const keys = Object.keys(records[0]);
  const sample = records.slice(0, maxRows);
  const header = keys.join(" | ");
  const rows = sample.map(r => keys.map(k => String(r[k] ?? "")).join(" | "));
  let summary = `Totalt ${records.length} rader. Kolumner: ${keys.join(", ")}\n\n`;
  summary += `| ${header} |\n| ${keys.map(() => "---").join(" | ")} |\n`;
  rows.forEach(r => { summary += `| ${r} |\n`; });
  if (records.length > maxRows) summary += `\n... och ${records.length - maxRows} fler rader`;
  return summary;
}

export function AIChatPanel({ getLayerData }: AIChatPanelProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [csvData, setCsvData] = useState<{ name: string; records: Record<string, string>[] } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const streamChat = useCallback(async (allMessages: Msg[]) => {
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ messages: allMessages }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: "Okänt fel" }));
      throw new Error(err.error || `HTTP ${resp.status}`);
    }
    if (!resp.body) throw new Error("No response body");

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let assistantSoFar = "";

    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      const content = assistantSoFar;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, content } : m);
        }
        return [...prev, { role: "assistant", content }];
      });
    };

    let done = false;
    while (!done) {
      const { done: readerDone, value } = await reader.read();
      if (readerDone) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") { done = true; break; }
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) upsert(content);
        } catch {
          buffer = line + "\n" + buffer;
          break;
        }
      }
    }
  }, []);

  const send = async (text?: string) => {
    const msgText = text || input.trim();
    if (!msgText && !csvData) return;

    let content = msgText;

    // Include layer data context if requested
    if (msgText.toLowerCase().includes("kartdata") || msgText.toLowerCase().includes("laddad") || msgText.toLowerCase().includes("analys") || msgText.toLowerCase().includes("sammanfatt")) {
      const layers = getLayerData();
      const activeLayers = layers.filter(l => l.count > 0);
      if (activeLayers.length > 0) {
        content += "\n\n--- LADDAD KARTDATA ---\n";
        activeLayers.forEach(l => {
          content += `\n### ${l.name} (${l.count} objekt)\n`;
          content += summarizeData(l.sample);
        });
      }
    }

    // Include CSV data if uploaded
    if (csvData) {
      content += `\n\n--- UPPLADDAD CSV: ${csvData.name} ---\n`;
      content += summarizeData(csvData.records);
      setCsvData(null);
    }

    const userMsg: Msg = { role: "user", content };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      await streamChat([...messages, userMsg]);
    } catch (e: any) {
      console.error("Chat error:", e);
      toast.error(e.message || "Kunde inte nå AI-tjänsten");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".csv")) {
      toast.error("Bara CSV-filer stöds");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const records = parseCSV(text);
      if (records.length === 0) {
        toast.error("Kunde inte läsa CSV-filen");
        return;
      }
      setCsvData({ name: file.name, records });
      toast.success(`Laddade ${records.length} rader från ${file.name}`);
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute bottom-20 left-6 z-50 w-14 h-14 rounded-full bg-sgu-maroon text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center justify-center"
        title="AI-analys"
      >
        <Bot className="w-7 h-7" />
      </button>
    );
  }

  return (
    <div className="absolute bottom-6 left-6 z-50 w-[400px] h-[550px] bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-sgu-maroon text-white p-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5" />
          <span className="font-semibold text-sm">GeoAnalys AI</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => { setMessages([]); setCsvData(null); }} className="p-1 hover:bg-white/20 rounded" title="Rensa chatt">
            <Trash2 className="w-4 h-4" />
          </button>
          <button onClick={() => setOpen(false)} className="p-1 hover:bg-white/20 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-8 space-y-3">
            <Bot className="w-10 h-10 mx-auto opacity-40" />
            <p className="font-medium">Hej! Jag kan analysera geodata.</p>
            <div className="text-xs space-y-1">
              <p>• Skriv <strong>"analysera kartdata"</strong> för laddade lager</p>
              <p>• Ladda upp en <strong>CSV-fil</strong> för analys</p>
              <p>• Ställ frågor om geologi & hydrogeologi</p>
            </div>
            <div className="flex flex-wrap gap-1 justify-center pt-2">
              {["Analysera kartdata", "Sammanfatta brunnar", "Vad visar datan?"].map(q => (
                <button
                  key={q}
                  onClick={() => { setInput(q); }}
                  className="text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
              msg.role === "user"
                ? "bg-sgu-maroon text-white"
                : "bg-muted text-foreground"
            }`}>
              {msg.role === "assistant" ? (
                <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_table]:text-xs [&_th]:px-1 [&_td]:px-1">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap break-words">{msg.content.length > 300 ? msg.content.slice(0, 300) + "..." : msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-3 py-2">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      {/* CSV badge */}
      {csvData && (
        <div className="px-3 pb-1">
          <div className="flex items-center gap-2 bg-secondary rounded-md px-2 py-1 text-xs">
            <Upload className="w-3 h-3" />
            <span className="truncate flex-1">{csvData.name} ({csvData.records.length} rader)</span>
            <button onClick={() => setCsvData(null)} className="hover:text-destructive">
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-border shrink-0">
        <div className="flex gap-2">
          <input type="file" ref={fileInputRef} accept=".csv" onChange={handleFileUpload} className="hidden" />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors shrink-0"
            title="Ladda upp CSV"
          >
            <Upload className="w-4 h-4" />
          </button>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ställ en fråga..."
            className="flex-1 bg-secondary rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            disabled={isLoading}
          />
          <Button
            size="sm"
            onClick={() => send()}
            disabled={isLoading && !input.trim() && !csvData}
            className="bg-sgu-maroon hover:bg-sgu-maroon/90 shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
