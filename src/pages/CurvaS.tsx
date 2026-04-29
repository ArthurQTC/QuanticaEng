import { useState, useEffect } from "react";
import { motion } from "motion/react";
import DashboardLayout from "@/components/DashboardLayout";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend, LineChart, Line } from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProject } from "@/context/ProjectContext";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

const tooltipStyle = {
  backgroundColor: "hsl(220,18%,10%)",
  border: "1px solid hsl(220,15%,18%)",
  borderRadius: "8px",
  fontFamily: "JetBrains Mono",
  fontSize: "11px",
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export default function CurvaS() {
  const { selectedObra, selectedObraName, obras } = useProject();
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<any[]>([]);
  const [stats, setStats] = useState<any[]>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        
        let cffQuery = supabase.from('cff').select('*').order('mes', { ascending: true });

        if (selectedObra !== "Todas") {
          const selectedObraObj = obras.find(o => o.id.toString() === selectedObra);
          if (selectedObraObj) {
            cffQuery = cffQuery.eq('obra', selectedObraObj.obra);
          }
        }

        const [cffRes, obraRes] = await Promise.all([
          cffQuery,
          supabase.from('obras').select('*')
        ]);

        if (cffRes.error) throw cffRes.error;
        if (obraRes.error) throw obraRes.error;

        const allObras = obraRes.data || [];
        const rawData = cffRes.data || [];

        const data = rawData;

        const totalBudgetByObra: Record<string, number> = {};
        data.forEach(r => {
          totalBudgetByObra[r.obra] = (totalBudgetByObra[r.obra] || 0) + (r.valor || 0);
        });
        const totalGlobalBudget = Object.values(totalBudgetByObra).reduce((a, b) => a + b, 0);

        const maxMes = Math.max(...data.map(r => r.mes), 1);
        const monthlyData: any[] = [];
        
        let accPrevFisico = 0;
        let accPrevFinan = 0;

        for (let m = 1; m <= maxMes; m++) {
          const monthCff = data.filter(r => r.mes === m);
          
          // Get items with their percentages for this month from the database
          // Group by description to sum percentages if item is split across multiple rows in same month
          const itemGrouping = new Map<string, number>();
          monthCff.forEach(r => {
            const desc = r.descricao || "Item sem descrição";
            itemGrouping.set(desc, (itemGrouping.get(desc) || 0) + (r.percentual || 0));
          });

          const monthItems = Array.from(itemGrouping.entries())
            .map(([descricao, percentual]) => ({
              descricao,
              percentual: Number(percentual.toFixed(2))
            }))
            .sort((a, b) => b.percentual - a.percentual);

          const prevFinan = monthCff.reduce((a, b) => a + (b.valor || 0), 0);
          const prevFisico = totalGlobalBudget > 0 ? (prevFinan / totalGlobalBudget) * 100 : 0;

          accPrevFisico += prevFisico;
          accPrevFinan += prevFinan;

          monthlyData.push({
            m: `Mês ${m}`,
            previsto: prevFisico,
            acumuladoP: Math.min(accPrevFisico, 100),
            finanP_mensal: prevFinan / 1000, // Monthly in thousands
            finanP: accPrevFinan / 1000, // Accumulated in thousands
            detailedItems: monthItems
          });
        }

        setChartData(monthlyData);

        setStats([
          { label: "Orçamento Total (BAC)", value: formatCurrency(totalGlobalBudget), status: "neutral" },
          { label: "Prazo do Projeto", value: `${maxMes} meses`, status: "neutral" },
          { label: "Média Mensal Prevista", value: formatCurrency(totalGlobalBudget / maxMes), status: "neutral" },
          { label: "Pico de Desembolso", value: formatCurrency(Math.max(...monthlyData.map(d => d.previsto * totalGlobalBudget / 100))), status: "neutral" },
        ]);

      } catch (err) {
        console.error("Error fetching Curva S data:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [selectedObra]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
          <p className="text-sm text-muted-foreground font-display">Carregando análise de desempenho...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-xl md:text-2xl font-display font-bold text-foreground">
          <span className="text-primary">Curva S</span> — Análise de Desempenho
        </h1>
        <p className="text-xs text-muted-foreground mt-1">{selectedObraName} — Previsto vs Realizado</p>
      </motion.div>

      {/* Desvio cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        {stats.map((d, i) => (
          <motion.div key={d.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="glass-card p-3 border border-border/50 rounded-xl bg-card/30">
            <p className="text-[10px] text-muted-foreground font-display uppercase tracking-wider">{d.label}</p>
            <p className={`text-sm font-display font-bold mt-1 ${d.status === "negative" ? "text-rose-400" : d.status === "positive" ? "text-emerald-400" : "text-foreground"}`}>{d.value}</p>
          </motion.div>
        ))}
      </div>

      <Tabs defaultValue="fisica" className="space-y-4">
        <TabsList className="bg-secondary/50 border border-border/50">
          <TabsTrigger value="fisica" className="text-xs font-display">Curva S Física</TabsTrigger>
          <TabsTrigger value="financeira" className="text-xs font-display">Curva S Financeira</TabsTrigger>
          <TabsTrigger value="mensal" className="text-xs font-display">Avanço Mensal</TabsTrigger>
        </TabsList>

        <TabsContent value="fisica">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5 border border-border/50 rounded-xl bg-card/30">
            <h3 className="font-display text-xs font-semibold text-foreground uppercase tracking-wider mb-4">Avanço Físico Mensal (%)</h3>
            <div className="h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="gradP" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(38,92%,50%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(38,92%,50%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,15%)" vertical={false} />
                  <XAxis dataKey="m" stroke="hsl(220,10%,40%)" fontSize={10} fontFamily="JetBrains Mono" />
                  <YAxis stroke="hsl(220,10%,40%)" fontSize={10} fontFamily="JetBrains Mono" tickFormatter={(v) => `${v}%`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v.toFixed(1)}%`]} />
                  <Area type="monotone" dataKey="previsto" stroke="hsl(38,92%,50%)" fill="url(#gradP)" strokeWidth={2} name="Previsto (Mensal)" dot={{ r: 3, fill: "hsl(38,92%,50%)" }} />
                  <Legend wrapperStyle={{ fontSize: "11px", fontFamily: "Inter" }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            
            <div className="mt-6 pt-6 border-t border-border/50">
              <h4 className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-wider mb-3">Itens Contabilizados por Mês (Descrição e Avanço)</h4>
              <div className="space-y-4">
                {chartData.map((d) => (
                  <div key={d.m} className="flex flex-col gap-1.5 p-3 rounded-lg border border-border/30 bg-secondary/10">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] text-primary font-bold">{d.m}</span>
                      <span className="text-[10px] text-muted-foreground font-display">Peso no Projeto (Mês): <span className="text-foreground font-bold">{d.previsto.toFixed(2)}%</span></span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {d.detailedItems.map((item: any, idx: number) => (
                        <span key={idx} className="px-2 py-1 rounded bg-secondary/30 border border-border/30 text-[10px] text-muted-foreground">
                          {item.descricao} <span className="text-primary font-bold">({item.percentual}%)</span>
                        </span>
                      ))}
                      {d.detailedItems.length === 0 && <span className="text-[10px] text-muted-foreground italic">Nenhum item previsto</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </TabsContent>

        <TabsContent value="financeira">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5 border border-border/50 rounded-xl bg-card/30">
            <h3 className="font-display text-xs font-semibold text-foreground uppercase tracking-wider mb-4">Desembolso Financeiro Mensal (R$ mil)</h3>
            <div className="h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="gradFP" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(38,92%,50%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(38,92%,50%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,15%)" vertical={false} />
                  <XAxis dataKey="m" stroke="hsl(220,10%,40%)" fontSize={10} fontFamily="JetBrains Mono" />
                  <YAxis stroke="hsl(220,10%,40%)" fontSize={10} fontFamily="JetBrains Mono" tickFormatter={(v) => `R$${v}`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`R$ ${v.toLocaleString()}K`]} />
                  <Area type="monotone" dataKey="finanP_mensal" stroke="hsl(38,92%,50%)" fill="url(#gradFP)" strokeWidth={2} name="Previsto (Mensal)" dot={{ r: 3, fill: "hsl(38,92%,50%)" }} />
                  <Legend wrapperStyle={{ fontSize: "11px", fontFamily: "Inter" }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-6 pt-6 border-t border-border/50">
              <h4 className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-wider mb-3">Itens Contabilizados por Mês (Descrição e Avanço)</h4>
              <div className="space-y-4">
                {chartData.map((d) => (
                  <div key={d.m} className="flex flex-col gap-1.5 p-3 rounded-lg border border-border/30 bg-secondary/10">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] text-primary font-bold">{d.m}</span>
                      <span className="text-[10px] text-muted-foreground font-display">Peso no Projeto (Mês): <span className="text-foreground font-bold">{d.previsto.toFixed(2)}%</span></span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {d.detailedItems.map((item: any, idx: number) => (
                        <span key={idx} className="px-2 py-1 rounded bg-secondary/30 border border-border/30 text-[10px] text-muted-foreground">
                          {item.descricao} <span className="text-primary font-bold">({item.percentual}%)</span>
                        </span>
                      ))}
                      {d.detailedItems.length === 0 && <span className="text-[10px] text-muted-foreground italic">Nenhum item previsto</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </TabsContent>

        <TabsContent value="mensal">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5 border border-border/50 rounded-xl bg-card/30">
            <h3 className="font-display text-xs font-semibold text-foreground uppercase tracking-wider mb-4">Avanço Mensal — Previsto vs Realizado (%)</h3>
            <div className="h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,15%)" vertical={false} />
                  <XAxis dataKey="m" stroke="hsl(220,10%,40%)" fontSize={10} fontFamily="JetBrains Mono" />
                  <YAxis stroke="hsl(220,10%,40%)" fontSize={10} fontFamily="JetBrains Mono" tickFormatter={(v) => `${v}%`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v.toFixed(1)}%`]} />
                  <Line type="monotone" dataKey="previsto" stroke="hsl(38,92%,50%)" strokeWidth={2} name="Previsto" dot={{ r: 3, fill: "hsl(38,92%,50%)" }} />
                  <Legend wrapperStyle={{ fontSize: "11px", fontFamily: "Inter" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
