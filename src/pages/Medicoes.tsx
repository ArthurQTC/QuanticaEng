import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import DashboardLayout from "@/components/DashboardLayout";
import { FileText, CheckCircle2, Clock, AlertCircle, Calendar, DollarSign, Loader2, ChevronDown, X, Filter } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Cell } from "recharts";
import { supabase } from "@/lib/supabase";
import { format, isWithinInterval, parseISO, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

import { useProject } from "@/context/ProjectContext";

interface MedicaoRow {
  id: number;
  descricao: string;
  data_pagamento: string | null;
  data_vencimento: string | null;
  valor: number;
  status: string;
  obra: string;
}

const statusConfig: Record<string, { icon: any; color: string; bg: string }> = {
  "Paga": { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/15" },
  "Pago": { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/15" },
  "Aprovada": { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/15" },
  "Em análise": { icon: Clock, color: "text-amber-400", bg: "bg-amber-500/15" },
  "Em Análise": { icon: Clock, color: "text-amber-400", bg: "bg-amber-500/15" },
  "Em Analise": { icon: Clock, color: "text-amber-400", bg: "bg-amber-500/15" },
  "Pendente": { icon: Clock, color: "text-amber-400", bg: "bg-amber-500/15" },
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isApproved = ["Paga", "Pago", "Aprovada"].includes(data.status);
    const colorClass = isApproved ? "text-emerald-400" : "text-amber-400";
    
    return (
      <div className="bg-slate-950/95 backdrop-blur-xl border border-white/10 p-3.5 rounded-xl shadow-2xl z-50 min-w-[220px] ring-1 ring-white/5">
        <div className="mb-2.5 pb-2.5 border-b border-white/10">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-[9px] font-mono text-primary font-bold uppercase tracking-widest bg-primary/10 px-1.5 py-0.5 rounded">
              {data.obra}
            </span>
            <span className={`text-[9px] font-bold uppercase tracking-tight ${colorClass}`}>
              {data.status}
            </span>
          </div>
          <p className="text-xs font-display font-semibold text-foreground leading-tight">{data.periodo}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{data.displayMonth}</p>
        </div>
        
        <div className="space-y-2">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: entry.color || entry.fill }} />
                <span className="text-[10px] text-slate-400 font-medium">{entry.name}</span>
              </div>
              <span className={`text-[11px] font-mono font-bold ${colorClass}`}>
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(entry.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

export default function Medicoes() {
  const [loading, setLoading] = useState(true);
  const [medicoes, setMedicoes] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState<{ from: Date | null; to: Date | null }>({ from: null, to: null });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>("Todos");
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const { selectedObra, obras } = useProject();

  const uniqueStatuses = useMemo(() => {
    const statuses = new Set<string>();
    statuses.add("Todos");
    medicoes.forEach(m => {
      if (m.status) statuses.add(m.status);
    });
    return Array.from(statuses);
  }, [medicoes]);

  const quickFilters = [
    { label: "Tudo", value: "all" },
    { label: "Últimos 3 meses", value: 3 },
    { label: "Últimos 6 meses", value: 6 },
    { label: "Este Ano", value: "year" },
  ];

  const applyQuickFilter = (months: number | string) => {
    const end = new Date();
    let start: Date;
    
    if (months === "all") {
      setDateRange({ from: null, to: null });
      return;
    } else if (months === "year") {
      start = new Date(new Date().getFullYear(), 0, 1);
    } else {
      start = subMonths(end, months as number);
    }
    
    setDateRange({ from: start, to: end });
  };

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        let query = supabase
          .from('medicao')
          .select('*')
          .order('data_pagamento', { ascending: true, nullsFirst: false });

        if (selectedObra !== "Todas") {
          const selectedObraObj = obras.find(o => o.id.toString() === selectedObra);
          if (selectedObraObj) {
            query = query.eq('obra', selectedObraObj.obra);
          }
        }

        const { data, error } = await query;

        if (error) throw error;

        if (data) {
          const processed = data.map((m: MedicaoRow) => {
            let mesStr = "-";
            let dataAprovStr = "-";
            let dataVencStr = "-";

            if (m.data_pagamento) {
              const date = new Date(m.data_pagamento);
              // Format Month/Year (e.g., Jan/2026)
              const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
              mesStr = `${monthNames[date.getUTCMonth()]}/${date.getUTCFullYear()}`;
              
              // Format Full Date (e.g., 10/02/2026)
              dataAprovStr = date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
            }

            if (m.data_vencimento) {
              const date = new Date(m.data_vencimento);
              dataVencStr = date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
            }

            return {
              id: m.id,
              periodo: m.descricao,
              mes: mesStr,
              rawDate: m.data_pagamento,
              valorBruto: m.valor || 0,
              valorLiquido: m.valor || 0,
              status: m.status || "Pendente",
              dataAprov: dataAprovStr,
              dataVencimento: dataVencStr,
              obra: (m.obra || "Não informada").trim()
            };
          });
          setMedicoes(processed);
        }
      } catch (err) {
        console.error('Error fetching medicoes:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [selectedObra]);

  const filteredMedicoes = useMemo(() => {
    let result = medicoes;
    
    if (selectedStatus !== "Todos") {
      result = medicoes.filter(m => m.status === selectedStatus);
    } else {
      result = medicoes;
    }
    
    if (dateRange.from && dateRange.to) {
      result = result.filter(m => {
        if (!m.rawDate) return false;
        const d = parseISO(m.rawDate);
        return isWithinInterval(d, { start: startOfMonth(dateRange.from!), end: endOfMonth(dateRange.to!) });
      });
    }

    return result;
  }, [medicoes, dateRange, selectedStatus]);

  const chartData = filteredMedicoes.map((m, index) => {
    let displayMonth = m.mes;
    if (displayMonth === "-") {
      // Try to extract month from description if date is missing
      const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      const foundMonth = monthNames.find(name => m.periodo.toLowerCase().includes(name.toLowerCase()));
      const foundYear = m.periodo.match(/\d{4}/);
      
      if (foundMonth && foundYear) {
        displayMonth = `${foundMonth}/${foundYear[0]}`;
      } else {
        // Truncate long descriptions for the X-axis
        displayMonth = m.periodo.length > 12 ? "Medição" : m.periodo;
      }
    }

    return { 
      uniqueKey: `m-${m.id}-${index}`,
      displayMonth,
      obra: m.obra,
      periodo: m.periodo,
      bruto: m.valorBruto, 
      liquido: m.valorLiquido,
      status: m.status
    };
  });

  const totalBruto = filteredMedicoes.reduce((a, m) => a + m.valorBruto, 0);
  const totalLiquido = filteredMedicoes.reduce((a, m) => a + m.valorLiquido, 0);
  const totalPago = filteredMedicoes
    .filter(m => ["Paga", "Pago", "Aprovada"].includes(m.status))
    .reduce((a, m) => a + m.valorLiquido, 0);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
          <p className="text-sm text-muted-foreground font-display">Carregando medições...</p>
        </div>
      </DashboardLayout>
    );
  }
  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="text-xl md:text-2xl font-display font-bold text-foreground">
            <span className="text-primary">Medições</span> — Boletins de Medição
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Controle de medições mensais por obra</p>
        </motion.div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          {/* Status Filter */}
          <div className="relative">
            <button 
              onClick={() => setShowStatusPicker(!showStatusPicker)}
              className="flex items-center gap-2 px-3 py-2 bg-card/30 border border-border/50 rounded-lg text-xs font-medium hover:bg-card/50 transition-colors min-w-[140px] justify-between"
            >
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-primary" />
                <span>{selectedStatus}</span>
              </div>
              <ChevronDown className={`h-3 w-3 transition-transform ${showStatusPicker ? "rotate-180" : ""}`} />
            </button>

            <AnimatePresence>
              {showStatusPicker && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute left-0 mt-2 p-2 bg-slate-900 border border-white/10 rounded-xl shadow-2xl z-[110] min-w-[160px]"
                >
                  <div className="grid grid-cols-1 gap-1">
                    {uniqueStatuses.map((status) => (
                      <button
                        key={status}
                        onClick={() => {
                          setSelectedStatus(status);
                          setShowStatusPicker(false);
                        }}
                        className={`text-left px-3 py-2 text-xs rounded-md transition-colors ${
                          selectedStatus === status ? "bg-primary/20 text-primary font-bold" : "hover:bg-primary/10 hover:text-primary"
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Date Filter */}
          <div className="relative">
            <button 
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="flex items-center gap-2 px-3 py-2 bg-card/30 border border-border/50 rounded-lg text-xs font-medium hover:bg-card/50 transition-colors min-w-[160px] justify-between"
            >
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <span>{dateRange.from ? `${format(dateRange.from, "dd/MM")} - ${dateRange.to ? format(dateRange.to, "dd/MM") : "..."}` : "Período"}</span>
              </div>
              <ChevronDown className={`h-3 w-3 transition-transform ${showDatePicker ? "rotate-180" : ""}`} />
            </button>

            <AnimatePresence>
              {showDatePicker && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute right-0 mt-2 p-4 bg-slate-900 border border-white/10 rounded-xl shadow-2xl z-[110] w-[260px]"
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Filtrar período</span>
                    <button onClick={() => {
                      setDateRange({ from: null, to: null });
                      setShowDatePicker(false);
                    }} className="text-[10px] text-primary hover:underline font-bold">Limpar</button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-bold text-muted-foreground opacity-70">De</label>
                      <input 
                        type="date" 
                        value={dateRange.from ? format(dateRange.from, "yyyy-MM-dd") : ""}
                        onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value ? new Date(e.target.value + "T00:00:00") : null }))}
                        className="w-full bg-slate-950 border border-white/10 rounded-md p-1.5 text-[11px] text-foreground focus:outline-none focus:border-primary/40 color-scheme-dark"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-bold text-muted-foreground opacity-70">Até</label>
                      <input 
                        type="date" 
                        value={dateRange.to ? format(dateRange.to, "yyyy-MM-dd") : ""}
                        onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value ? new Date(e.target.value + "T00:00:00") : null }))}
                        className="w-full bg-slate-950 border border-white/10 rounded-md p-1.5 text-[11px] text-foreground focus:outline-none focus:border-primary/40 color-scheme-dark"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/5">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block mb-2 px-1">Atalhos</span>
                    <div className="grid grid-cols-2 gap-1">
                      {quickFilters.map((f) => (
                        <button
                          key={f.label}
                          onClick={() => {
                            applyQuickFilter(f.value);
                            setShowDatePicker(false);
                          }}
                          className="text-left px-2 py-1.5 text-[10px] bg-white/5 hover:bg-primary/20 hover:text-primary rounded transition-colors"
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          {dateRange.from && (
            <button 
              onClick={() => setDateRange({ from: null, to: null })}
              className="p-2 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-lg hover:bg-rose-500/20 transition-colors"
              title="Limpar Filtro"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total Medido (Bruto)", value: formatCurrency(totalBruto), icon: FileText },
          { label: "Total Líquido", value: formatCurrency(totalLiquido), icon: DollarSign },
          { label: "Total Pago", value: formatCurrency(totalPago), icon: CheckCircle2 },
          { label: "Medições Realizadas", value: `${filteredMedicoes.length}`, icon: Calendar },
        ].map((item, i) => (
          <motion.div key={item.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass-card p-4 border border-border/50 rounded-xl bg-card/30">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted-foreground font-display uppercase tracking-wider">{item.label}</span>
              <item.icon className="h-3.5 w-3.5 text-primary" />
            </div>
            <p className="text-lg font-display font-bold text-foreground">{item.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Chart */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-5 mb-4 border border-border/50 rounded-xl bg-card/30">
        <h3 className="font-display text-xs font-semibold text-foreground uppercase tracking-wider mb-4">Evolução das Medições (R$ mil)</h3>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,15%)" vertical={false} pointerEvents="none" />
              <XAxis 
                dataKey="uniqueKey" 
                tickFormatter={(val) => chartData.find(d => d.uniqueKey === val)?.displayMonth || ""} 
                stroke="hsl(220,10%,40%)" 
                fontSize={10} 
                fontFamily="JetBrains Mono" 
              />
              <YAxis stroke="hsl(220,10%,40%)" fontSize={10} fontFamily="JetBrains Mono" tickFormatter={(v) => `R$ ${v.toLocaleString()}`} />
              <Tooltip 
                content={<CustomTooltip />} 
                cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                wrapperStyle={{ zIndex: 100, pointerEvents: 'none' }}
              />
              <Bar dataKey="bruto" opacity={0.4} radius={[4, 4, 0, 0]} barSize={18} name="Bruto" isAnimationActive={false}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-bruto-${index}`} fill={["Paga", "Pago", "Aprovada"].includes(entry.status) ? "hsl(152,60%,45%)" : "hsl(38,92%,50%)"} />
                ))}
              </Bar>
              <Bar dataKey="liquido" radius={[4, 4, 0, 0]} barSize={18} name="Líquido" isAnimationActive={false}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-liquido-${index}`} fill={["Paga", "Pago", "Aprovada"].includes(entry.status) ? "hsl(152,60%,45%)" : "hsl(38,92%,50%)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-5 border border-border/50 rounded-xl bg-card/30">
        <h3 className="font-display text-xs font-semibold text-foreground uppercase tracking-wider mb-4">Detalhamento</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-3 px-3 text-[10px] text-muted-foreground font-display uppercase tracking-wider">Obra</th>
                <th className="text-left py-3 px-3 text-[10px] text-muted-foreground font-display uppercase tracking-wider">Período</th>
                <th className="text-left py-3 px-3 text-[10px] text-muted-foreground font-display uppercase tracking-wider">Mês</th>
                <th className="text-right py-3 px-3 text-[10px] text-muted-foreground font-display uppercase tracking-wider">Bruto</th>
                <th className="text-right py-3 px-3 text-[10px] text-muted-foreground font-display uppercase tracking-wider">Líquido</th>
                <th className="text-center py-3 px-3 text-[10px] text-muted-foreground font-display uppercase tracking-wider">Status</th>
                <th className="text-center py-3 px-3 text-[10px] text-muted-foreground font-display uppercase tracking-wider">Vencimento</th>
                <th className="text-center py-3 px-3 text-[10px] text-muted-foreground font-display uppercase tracking-wider">Aprovação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {filteredMedicoes.map((m) => {
                const sc = statusConfig[m.status];
                const Icon = sc?.icon;
                return (
                  <tr key={m.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="py-2.5 px-3 font-display font-medium text-primary/80">{m.obra}</td>
                    <td className="py-2.5 px-3 font-display font-medium text-foreground">{m.periodo}</td>
                    <td className="py-2.5 px-3 text-muted-foreground font-mono">{m.mes}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-foreground">{formatCurrency(m.valorBruto)}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-medium text-foreground">{formatCurrency(m.valorLiquido)}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${sc?.bg || "bg-muted/15"} ${sc?.color || "text-muted-foreground"}`}>
                        {Icon && <Icon className="h-2.5 w-2.5" />}
                        {m.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center text-muted-foreground font-mono">{m.dataVencimento}</td>
                    <td className="py-2.5 px-3 text-center text-muted-foreground font-mono">{m.dataAprov}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>
    </DashboardLayout>
  );
}
