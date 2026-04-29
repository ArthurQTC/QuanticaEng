import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import DashboardLayout from "@/components/DashboardLayout";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  ResponsiveContainer, 
  Tooltip, 
  CartesianGrid, 
  Legend, 
  ComposedChart, 
  Line,
  Cell,
  LabelList,
  Legend as RechartsLegend
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Clock, 
  CheckCircle2, 
  Circle, 
  ArrowRight,
  Loader2
} from "lucide-react";
import { supabase } from "@/lib/supabase";

import { useProject } from "@/context/ProjectContext";

interface GanttTask {
  id: string;
  name: string;
  start: number;
  duration: number;
  progress: number;
  status: "done" | "in_progress" | "pending" | "critical" | "delayed";
  responsible: string;
}

const statusColors: Record<string, string> = {
  done: "bg-emerald-500",
  in_progress: "bg-blue-500",
  pending: "bg-muted",
  critical: "bg-rose-500",
  delayed: "bg-amber-500",
};

const statusBg: Record<string, string> = {
  done: "bg-emerald-500/20",
  in_progress: "bg-blue-500/20",
  pending: "bg-muted/20",
  critical: "bg-rose-500/20",
  delayed: "bg-amber-500/20",
};

const statusLabels: Record<string, string> = {
  done: "Concluído",
  in_progress: "Em andamento",
  pending: "Pendente",
  critical: "Crítico",
  delayed: "Atrasado",
};

const folgaColors: Record<string, string> = { critical: "hsl(0,72%,55%)", warning: "hsl(38,92%,50%)", ok: "hsl(152,60%,45%)" };

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
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const formatNumber = (value: number, decimals: number = 0) => {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

export default function CronogramaFisicoFinanceiro() {
  const [loading, setLoading] = useState(true);
  const [cffData, setCffData] = useState<any[]>([]);
  const [insumos, setInsumos] = useState<any[]>([]);
  const [ganttTasks, setGanttTasks] = useState<GanttTask[]>([]);
  const [caminhoData, setCaminhoData] = useState<any[]>([]);
  const [marcos, setMarcos] = useState<any[]>([]);
  const [evmIndicators, setEvmIndicators] = useState<any[]>([]);
  const [dynamicMonths, setDynamicMonths] = useState<string[]>([]);
  const [medicaoData, setMedicaoData] = useState<any[]>([]);
  const [totalRealByMonth, setTotalRealByMonth] = useState<Record<number, number>>({});
  const { selectedObra, selectedObraName, obras } = useProject();

  const getMonthLabel = (obra: string, mesNum: number) => {
    const configs: Record<string, string> = {
      "CORA CORALINA": "2024-06-28",
      "JI PARANA": "2025-02-11",
      "JI-PARANÁ": "2025-02-11",
      "EBSERH": "2026-01-29",
      "NUCLEO BANDEIRANTE": "2026-01-19",
      "CACHOEIRA DO SUL": "2025-04-14",
      "RESENDE": "2025-08-01",
      "SANTA MARIA": "2025-10-01",
    };
    
    const obraKey = Object.keys(configs).find(k => obra.toUpperCase().includes(k));
    if (!obraKey) return `Mês ${mesNum}`;
    
    const startDate = new Date(configs[obraKey]);
    const targetDate = new Date(startDate.getFullYear(), startDate.getMonth() + mesNum - 1, 1);
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return `${monthNames[targetDate.getMonth()]}/${targetDate.getFullYear().toString().slice(-2)}`;
  };

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        
        let cffQuery = supabase
          .from('cff')
          .select('*')
          .order('item', { ascending: true })
          .order('mes', { ascending: true });

        let medicaoQuery = supabase.from('medicao').select('*').eq('status', 'Aprovada');

        if (selectedObra !== "Todas") {
          const selectedObraObj = obras.find(o => o.id.toString() === selectedObra);
          if (selectedObraObj) {
            cffQuery = cffQuery.eq('obra', selectedObraObj.obra);
            medicaoQuery = medicaoQuery.eq('obra', selectedObraObj.obra);
          }
        }

        const [cffRes, medicaoRes, obraRes] = await Promise.all([
          cffQuery,
          medicaoQuery,
          supabase.from('obras').select('*')
        ]);

        if (cffRes.error) throw cffRes.error;
        if (medicaoRes.error) throw medicaoRes.error;
        if (obraRes.error) throw obraRes.error;

        const rawData = cffRes.data || [];
        const medicoes = medicaoRes.data || [];
        const allObras = obraRes.data || [];

        if (rawData && rawData.length > 0) {
          const data = rawData;

          const totalBudgetByObra: Record<string, number> = {};
          data.forEach(r => {
            totalBudgetByObra[r.obra] = (totalBudgetByObra[r.obra] || 0) + (r.valor || 0);
          });
          const totalGlobalBudget = Object.values(totalBudgetByObra).reduce((a, b) => a + b, 0);

          const totalProjectMonths = Math.max(...data.map(r => r.mes));
          const monthsArray = Array.from({ length: totalProjectMonths }, (_, i) => getMonthLabel(selectedObra === "Todas" ? "Global" : selectedObraName, i + 1));
          setDynamicMonths(monthsArray);
          
          const monthlyTotals: Record<number, { custoPrev: number; fisicoPrev: number; custoReal: number; fisicoReal: number }> = {};
          
          data.forEach(row => {
            const m = row.mes;
            const percentual = (row.percentual || 0) * 100;
            if (!monthlyTotals[m]) {
              monthlyTotals[m] = { custoPrev: 0, fisicoPrev: 0, custoReal: 0, fisicoReal: 0 };
            }
            monthlyTotals[m].custoPrev += row.valor || 0;
            
            if (selectedObra === "Todas") {
              const weight = (totalBudgetByObra[row.obra] || 0) / totalGlobalBudget;
              monthlyTotals[m].fisicoPrev += percentual * weight;
            } else {
              monthlyTotals[m].fisicoPrev += percentual;
            }
          });

          medicoes.forEach(m => {
            let mes = 0;
            const match = m.descricao.match(/Mês\s*(\d+)/i);
            if (match) {
              mes = parseInt(match[1]);
            } else if (m.data_pagamento) {
              // Fallback to data_pagamento to determine month relative to obra start
              const obraName = allObras.find(o => o.obra === m.obra)?.obra || "";
              const obraKey = obraName.trim().toUpperCase();
              const configDates: Record<string, string> = {
                "CORA CORALINA": "2024-06-28",
                "JI PARANA": "2025-02-11",
                "JI-PARANÁ": "2025-02-11",
                "EBSERH": "2026-01-29",
                "NUCLEO BANDEIRANTE": "2026-01-19",
                "CACHOEIRA DO SUL": "2025-04-14",
                "RESENDE": "2025-08-01",
                "SANTA MARIA": "2025-10-01",
              };
              const startDateStr = Object.entries(configDates).find(([k]) => obraKey.includes(k))?.[1];
              if (startDateStr) {
                const start = new Date(startDateStr);
                const pay = new Date(m.data_pagamento);
                mes = (pay.getFullYear() - start.getFullYear()) * 12 + (pay.getMonth() - start.getMonth()) + 1;
              }
            }

            if (mes > 0 && monthlyTotals[mes]) {
              monthlyTotals[mes].custoReal += m.valor || 0;
              const obraBudget = selectedObra === "Todas" ? totalGlobalBudget : totalBudgetByObra[m.obra];
              if (obraBudget > 0) {
                monthlyTotals[mes].fisicoReal += ((m.valor || 0) / obraBudget) * 100;
              }
            }
          });

          const processedCff = Object.entries(monthlyTotals).map(([mes, values]) => ({
            m: getMonthLabel(selectedObra === "Todas" ? "Global" : selectedObraName, parseInt(mes)),
            custoPrev: values.custoPrev, 
            custoReal: values.custoReal, 
            fisicoPrev: values.fisicoPrev,
            fisicoReal: values.fisicoReal 
          })).sort((a, b) => {
            const m1 = parseInt(Object.entries(monthlyTotals).find(([_, v]) => getMonthLabel(selectedObra === "Todas" ? "Global" : selectedObraName, parseInt(_)) === a.m)?.[0] || "0");
            const m2 = parseInt(Object.entries(monthlyTotals).find(([_, v]) => getMonthLabel(selectedObra === "Todas" ? "Global" : selectedObraName, parseInt(_)) === b.m)?.[0] || "0");
            return m1 - m2;
          });

          setCffData(processedCff);

          const groupedData: Record<string, { item: string; descricao: string; obra: string; rows: any[] }> = {};
          data.forEach(row => {
            // Include obra in key to avoid merging different projects in "Todas" view
            const key = `${row.obra}-${row.item}-${row.descricao}`;
            if (!groupedData[key]) {
              groupedData[key] = { item: row.item, descricao: row.descricao, obra: row.obra, rows: [] };
            }
            groupedData[key].rows.push(row);
          });

          const sortedGroups = Object.values(groupedData).sort((a, b) => {
            // Sort by obra first, then by item
            if (a.obra !== b.obra) return a.obra.localeCompare(b.obra);
            const itemA = String(a.item || "");
            const itemB = String(b.item || "");
            return itemA.localeCompare(itemB, undefined, { numeric: true, sensitivity: 'base' });
          });

          // Calculate overall project progress for Gantt
          const totalCustoReal = Object.values(monthlyTotals).reduce((acc, curr) => acc + curr.custoReal, 0);
          const projectProgress = totalGlobalBudget > 0 ? (totalCustoReal / totalGlobalBudget) * 100 : 0;

          const tasks: GanttTask[] = sortedGroups.map((group, i) => {
            const itemRows = group.rows;
            const startMonth = Math.min(...itemRows.map(r => r.mes)) - 1;
            const endMonth = Math.max(...itemRows.map(r => r.mes)) - 1;
            const duration = endMonth - startMonth + 1;
            
            // Calculate real progress for this specific task based on medicoes
            // We match by description (partial match)
            const taskMedicoes = medicoes.filter(m => 
              m.obra === group.obra && 
              (m.descricao.toUpperCase().includes(group.descricao.toUpperCase()) || 
               group.descricao.toUpperCase().includes(m.descricao.toUpperCase()))
            );
            const totalRealTask = taskMedicoes.reduce((acc, m) => acc + (m.valor || 0), 0);
            const totalPrevTask = itemRows.reduce((acc, r) => acc + (r.valor || 0), 0);
            
            let progress = totalPrevTask > 0 ? Math.round((totalRealTask / totalPrevTask) * 100) : 0;
            
            // Fallback to project progress if no specific medicao found but task should have started
            if (progress === 0 && startMonth < 3) { // 3 is mock current month
               progress = Math.min(Math.round(projectProgress), 100);
            }

            return {
              id: String(i + 1),
              name: selectedObra === "Todas" ? `[${group.obra}] ${group.item} - ${group.descricao}` : `${group.item} - ${group.descricao}`,
              start: startMonth,
              duration: duration,
              progress: Math.min(progress, 100), 
              status: progress >= 100 ? "done" : progress > 0 ? "in_progress" : "pending",
              responsible: "Equipe Quântica"
            };
          });
          setGanttTasks(tasks);

          // Process Medicao Mensal Table
          const medicaoRows = sortedGroups.map(group => {
            const valorTotal = group.rows.reduce((acc, r) => acc + (r.valor || 0), 0);
            const meses: Record<number, { valor: number; percentual: number }> = {};
            group.rows.forEach(r => {
              meses[r.mes] = { valor: r.valor || 0, percentual: (r.percentual || 0) * 100 };
            });
            return {
              item: group.item,
              descricao: group.descricao,
              valorTotal,
              meses
            };
          });
          setMedicaoData(medicaoRows);

          // Calculate total real values per month for the table footer
          const realPerMonth: Record<number, number> = {};
          medicoes.forEach(m => {
            let mes = 0;
            const match = m.descricao.match(/Mês\s*(\d+)/i);
            if (match) {
              mes = parseInt(match[1]);
            } else if (m.data_pagamento) {
              const obraKey = (m.obra || "").trim().toUpperCase();
              const configDates: Record<string, string> = {
                "CORA CORALINA": "2024-06-28",
                "JI PARANA": "2025-02-11",
                "JI-PARANÁ": "2025-02-11",
                "EBSERH": "2026-01-29",
                "NUCLEO BANDEIRANTE": "2026-01-19",
                "CACHOEIRA DO SUL": "2025-04-14",
                "RESENDE": "2025-08-01",
                "SANTA MARIA": "2025-10-01",
              };
              const startDateStr = Object.entries(configDates).find(([k]) => obraKey.includes(k))?.[1];
              if (startDateStr) {
                const start = new Date(startDateStr);
                const pay = new Date(m.data_pagamento);
                mes = (pay.getFullYear() - start.getFullYear()) * 12 + (pay.getMonth() - start.getMonth()) + 1;
              }
            }
            if (mes > 0) {
              realPerMonth[mes] = (realPerMonth[mes] || 0) + (m.valor || 0);
            }
          });
          setTotalRealByMonth(realPerMonth);

          // Process Services (Insumos)
          const processedInsumos = sortedGroups.map(group => {
            const prev = group.rows.reduce((acc, r) => acc + (r.valor || 0), 0);
            if (prev === 0) return null;

            return {
              insumo: group.descricao,
              previsto: prev,
              realizado: 0,
              desvio: 0
            };
          }).filter(Boolean) as any[];
          setInsumos(processedInsumos);

          // Calculate EVM (Planned vs Real)
          const totalPV = data.reduce((acc, r) => acc + (r.valor || 0), 0);
          const totalAC = medicoes
            .reduce((acc, m) => acc + (m.valor || 0), 0);
          
          // EV is approximated as % physical progress * total budget
          const currentFisicoReal = processedCff.reduce((acc, curr) => acc + curr.fisicoReal, 0);
          const totalEV = (currentFisicoReal / 100) * totalPV;

          const cpi = totalAC > 0 ? totalEV / totalAC : 0;
          const spi = totalPV > 0 ? totalEV / totalPV : 0;

          const evm = [
            { label: "PV (Valor Planejado)", value: formatCurrency(totalPV), icon: Target, color: "text-foreground" },
            { label: "EV (Valor Agregado)", value: formatCurrency(totalEV), icon: TrendingUp, color: "text-blue-400" },
            { label: "AC (Custo Real)", value: formatCurrency(totalAC), icon: DollarSign, color: "text-amber-400" },
            { 
              label: "CV (Variação Custo)", 
              value: formatCurrency(totalEV - totalAC), 
              subValue: selectedObraName,
              icon: totalEV >= totalAC ? TrendingUp : TrendingDown, 
              color: totalEV >= totalAC ? "text-emerald-400" : "text-rose-400" 
            },
            { label: "SV (Variação Prazo)", value: formatCurrency(totalEV - totalPV), icon: totalEV >= totalPV ? TrendingUp : TrendingDown, color: totalEV >= totalPV ? "text-emerald-400" : "text-rose-400" },
            { label: "CPI", value: formatNumber(cpi, 2), icon: Target, color: cpi >= 1 ? "text-emerald-400" : "text-amber-400" },
            { label: "SPI", value: formatNumber(spi, 2), icon: Target, color: spi >= 1 ? "text-emerald-400" : "text-rose-400" },
            { label: "BAC (Orçamento no Término)", value: formatCurrency(totalPV), icon: DollarSign, color: "text-primary" },
          ];
          setEvmIndicators(evm);

          // Critical Path logic: folga = total months - count of months with work
          const pathRaw = sortedGroups.map(group => {
            const monthsWithWork = new Set(group.rows.map(r => r.mes)).size;
            const folga = totalProjectMonths - monthsWithWork;
            
            return {
              task: group.descricao,
              folga: folga,
              cor: folga === 0 ? "critical" : folga < 3 ? "warning" : "ok"
            };
          }).sort((a, b) => a.folga - b.folga);

          const maxFolga = Math.max(...pathRaw.map(p => p.folga), 1);
          const path = pathRaw.map(p => ({
            ...p,
            visualFolga: p.folga === 0 ? maxFolga : p.folga,
            isCritical: p.folga === 0
          }));

          setCaminhoData(path);

          setMarcos([
            { name: "Início da Obra", date: "Mês 1", status: "pending" },
            { name: "Conclusão Estrutura", date: `Mês ${Math.round(totalProjectMonths * 0.6)}`, status: "pending" },
            { name: "Entrega Final", date: `Mês ${totalProjectMonths}`, status: "pending" },
          ]);
        }
      } catch (err) {
        console.error('Error fetching data from Supabase:', err);
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
          <p className="text-sm text-muted-foreground font-display">Carregando dados do cronograma...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-xl md:text-2xl font-display font-bold text-foreground">
          Cronograma <span className="text-primary">Físico-Financeiro</span>
        </h1>
        <p className="text-xs text-muted-foreground mt-1">{selectedObra === "Todas" ? "Consolidado de todas as obras" : selectedObra} — Gestão integrada de tempo, custo e avanço</p>
      </motion.div>

      {/* EVM Cards Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {evmIndicators.slice(0, 4).map((ind, i) => (
          <motion.div key={ind.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass-card p-4 border border-border/50 rounded-xl bg-card/30">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted-foreground font-display uppercase tracking-wider">{ind.label}</span>
              <ind.icon className={`h-3.5 w-3.5 ${ind.color}`} />
            </div>
            <p className={`text-lg font-display font-bold ${ind.color}`}>{ind.value}</p>
            {ind.subValue && <p className="text-[9px] text-muted-foreground mt-1 truncate font-display">{ind.subValue}</p>}
          </motion.div>
        ))}
      </div>

      <Tabs defaultValue="gantt" className="space-y-4">
        <TabsList className="bg-secondary/50 border border-border/50 overflow-x-auto flex-nowrap">
          <TabsTrigger value="gantt" className="text-xs font-display">Gantt</TabsTrigger>
          <TabsTrigger value="medicao" className="text-xs font-display">Medição Mensal</TabsTrigger>
          <TabsTrigger value="fisico-fin" className="text-xs font-display">Físico x Financeiro</TabsTrigger>
          <TabsTrigger value="servicos" className="text-xs font-display">Serviços</TabsTrigger>
          <TabsTrigger value="critico" className="text-xs font-display">Caminho Crítico</TabsTrigger>
          <TabsTrigger value="evm" className="text-xs font-display">Análise EVM</TabsTrigger>
          <TabsTrigger value="marcos" className="text-xs font-display">Marcos</TabsTrigger>
        </TabsList>

        <TabsContent value="gantt">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5 border border-border/50 rounded-xl bg-card/30 overflow-x-auto">
            <h3 className="font-display text-xs font-semibold text-foreground uppercase tracking-wider mb-4">Gráfico de Gantt (Ordenado por Item)</h3>
            <div className="flex flex-wrap gap-3 mb-4 text-[10px] text-muted-foreground">
              {Object.entries(statusLabels).map(([k, v]) => (
                <span key={k} className="flex items-center gap-1">
                  <span className={`w-2.5 h-2.5 rounded-sm ${statusColors[k]}`} />
                  {v}
                </span>
              ))}
            </div>
            <div className="min-w-[800px]">
              <div className="flex ml-[220px] mb-2">
                {dynamicMonths.map((m) => (
                  <div key={m} className="flex-1 text-[9px] text-muted-foreground font-mono text-center border-l border-border/20">{m}</div>
                ))}
              </div>
              <div className="space-y-2">
                {ganttTasks.length > 0 ? ganttTasks.map((task, i) => (
                  <motion.div key={task.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className="flex items-center group">
                    <div className="w-[220px] shrink-0 pr-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusColors[task.status]}`} />
                        <span className="text-[11px] font-display text-foreground truncate">{task.name}</span>
                      </div>
                      <span className="text-[9px] text-muted-foreground ml-3.5">{task.responsible}</span>
                    </div>
                    <div className="flex-1 h-12 relative">
                      {dynamicMonths.map((_, mi) => (
                        <div key={mi} className="absolute top-0 bottom-0 border-l border-border/10" style={{ left: `${(mi / dynamicMonths.length) * 100}%` }} />
                      ))}
                      {/* Planned Bar */}
                      <div
                        className={`absolute top-1 h-4 rounded bg-blue-500/20 border border-blue-500/30`}
                        style={{
                          left: `${(task.start / dynamicMonths.length) * 100}%`,
                          width: `${(task.duration / dynamicMonths.length) * 100}%`,
                        }}
                      >
                        <div
                          className={`h-full rounded-l bg-blue-500 opacity-40`}
                          style={{ width: `100%` }}
                        />
                        <span className="absolute -top-3.5 left-0 text-[7px] text-blue-400 uppercase font-bold tracking-tighter">Previsto</span>
                      </div>
                      {/* Real Bar (Progress) */}
                      <div
                        className={`absolute top-6 h-4 rounded ${task.progress === 0 ? 'bg-transparent' : 'bg-emerald-500/20'} border border-emerald-500/30`}
                        style={{
                          left: `${(task.start / dynamicMonths.length) * 100}%`,
                          width: `${(task.duration / dynamicMonths.length) * 100}%`,
                        }}
                      >
                        <div
                          className={`h-full rounded-l bg-emerald-500 opacity-80`}
                          style={{ width: task.progress === 0 ? '2px' : `${task.progress}%` }}
                        />
                        <span className="absolute -bottom-3.5 left-0 text-[7px] text-emerald-400 uppercase font-bold tracking-tighter">Realizado ({task.progress}%)</span>
                      </div>
                    </div>
                  </motion.div>
                )) : (
                  <div className="text-center py-8 text-muted-foreground text-xs">Nenhuma tarefa encontrada no cronograma.</div>
                )}
              </div>
            </div>
          </motion.div>
        </TabsContent>

        <TabsContent value="medicao">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5 border border-border/50 rounded-xl bg-card/30 overflow-x-auto">
            <h3 className="font-display text-xs font-semibold text-foreground uppercase tracking-wider mb-4">Percentuais e Valores de Cada Parcela (Medição Mensal)</h3>
            <div className="min-w-[1000px]">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-secondary/50">
                    <th className="border border-border/50 p-2 text-[11px] font-display uppercase text-muted-foreground text-center w-12">Item</th>
                    <th className="border border-border/50 p-2 text-[11px] font-display uppercase text-muted-foreground text-left">Descrição do Serviço</th>
                    <th className="border border-border/50 p-2 text-[11px] font-display uppercase text-muted-foreground text-right w-32">Valor Total</th>
                    {dynamicMonths.map((m, idx) => (
                      <th key={idx} className="border border-border/50 p-2 text-[11px] font-display uppercase text-muted-foreground text-center">
                        {m}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {medicaoData.map((row, i) => (
                    <React.Fragment key={i}>
                      {/* Row 1: Percentages */}
                      <tr className="hover:bg-secondary/20 transition-colors">
                        <td rowSpan={2} className="border border-border/50 p-2 text-[11px] font-mono text-center align-middle bg-secondary/10">{row.item}</td>
                        <td rowSpan={2} className="border border-border/50 p-2 text-[11px] font-display font-medium align-middle">{row.descricao}</td>
                        <td className="border border-border/50 p-2 text-[11px] font-mono text-right font-bold">{formatNumber(row.valorTotal, 2)}</td>
                        {dynamicMonths.map((_, mIdx) => {
                          const mNum = mIdx + 1;
                          const data = row.meses[mNum];
                          return (
                            <td key={mIdx} className="border border-border/50 p-2 text-[11px] font-mono text-center text-primary/80 bg-primary/5">
                              {data ? `${formatNumber(data.percentual, 2)}%` : "-"}
                            </td>
                          );
                        })}
                      </tr>
                      {/* Row 2: Values */}
                      <tr className="hover:bg-secondary/20 transition-colors">
                        <td className="border border-border/50 p-2 text-[10px] font-mono text-right text-muted-foreground">R$</td>
                        {dynamicMonths.map((_, mIdx) => {
                          const mNum = mIdx + 1;
                          const data = row.meses[mNum];
                          return (
                            <td key={mIdx} className="border border-border/50 p-2 text-[11px] font-mono text-center text-muted-foreground">
                              {data ? formatNumber(data.valor, 2) : "-"}
                            </td>
                          );
                        })}
                      </tr>
                    </React.Fragment>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-emerald-500/10">
                    <td colSpan={2} className="border border-border/50 p-2 text-[10px] font-display font-bold uppercase text-emerald-400 text-right">Total Realizado (Medições)</td>
                    <td className="border border-border/50 p-2 text-[11px] font-mono text-right font-bold text-emerald-400">
                      {formatNumber((Object.values(totalRealByMonth) as number[]).reduce((a, b) => a + b, 0), 2)}
                    </td>
                    {dynamicMonths.map((_, mIdx) => {
                      const mNum = mIdx + 1;
                      const valorReal = totalRealByMonth[mNum];
                      return (
                        <td key={mIdx} className="border border-border/50 p-2 text-[11px] font-mono text-center font-bold text-emerald-400">
                          {valorReal ? formatNumber(valorReal, 2) : "-"}
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
          </motion.div>
        </TabsContent>

        <TabsContent value="fisico-fin">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5 border border-border/50 rounded-xl bg-card/30">
            <h3 className="font-display text-xs font-semibold text-foreground uppercase tracking-wider mb-4">Avanço Físico (%) x Custo Mensal (R$)</h3>
            <div className="h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={cffData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,15%)" vertical={false} />
                  <XAxis dataKey="m" stroke="hsl(220,10%,40%)" fontSize={10} fontFamily="JetBrains Mono" />
                  <YAxis yAxisId="left" stroke="hsl(220,10%,40%)" fontSize={10} fontFamily="JetBrains Mono" tickFormatter={(v) => `${v}%`} />
                  <YAxis yAxisId="right" orientation="right" stroke="hsl(220,10%,40%)" fontSize={10} fontFamily="JetBrains Mono" tickFormatter={(v) => formatNumber(v)} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: any, name: string) => [name.includes('%') ? `${v}%` : formatCurrency(v), name]} />
                  <Bar yAxisId="right" dataKey="custoPrev" fill="hsl(38,92%,50%)" radius={[4, 4, 0, 0]} barSize={16} name="Custo Previsto (R$)" />
                  <Bar yAxisId="right" dataKey="custoReal" fill="hsl(38,92%,50%)" opacity={0.3} radius={[4, 4, 0, 0]} barSize={16} name="Custo Real (R$)" />
                  <Line yAxisId="left" type="monotone" dataKey="fisicoPrev" stroke="hsl(199,89%,48%)" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Físico Prev. (%)" />
                  <Line yAxisId="left" type="monotone" dataKey="fisicoReal" stroke="hsl(152,60%,45%)" strokeWidth={2} dot={{ r: 3, fill: "hsl(152,60%,45%)" }} name="Físico Real (%)" connectNulls={false} />
                  <RechartsLegend wrapperStyle={{ fontSize: "10px", fontFamily: "Inter" }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </TabsContent>

        <TabsContent value="servicos">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5 border border-border/50 rounded-xl bg-card/30">
            <h3 className="font-display text-xs font-semibold text-foreground uppercase tracking-wider mb-4">Custo por Serviço (R$)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-2 px-3 text-[10px] text-muted-foreground font-display uppercase tracking-wider">Serviço</th>
                    <th className="text-right py-2 px-3 text-[10px] text-muted-foreground font-display uppercase tracking-wider">Previsto</th>
                    <th className="text-right py-2 px-3 text-[10px] text-muted-foreground font-display uppercase tracking-wider">Realizado</th>
                    <th className="text-right py-2 px-3 text-[10px] text-muted-foreground font-display uppercase tracking-wider">Desvio</th>
                    <th className="text-left py-2 px-3 text-[10px] text-muted-foreground font-display uppercase tracking-wider w-32">Visual</th>
                  </tr>
                </thead>
                <tbody>
                  {insumos.map((item) => (
                    <tr key={item.insumo} className="border-b border-border/20 hover:bg-secondary/30 transition-colors">
                      <td className="py-2.5 px-3 font-display font-medium text-foreground">{item.insumo}</td>
                      <td className="py-2.5 px-3 text-right text-muted-foreground font-mono">{formatNumber(item.previsto, 2)}</td>
                      <td className="py-2.5 px-3 text-right text-foreground font-mono font-medium">{formatNumber(item.realizado, 2)}</td>
                      <td className={`py-2.5 px-3 text-right font-mono font-bold ${item.desvio > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                        {item.desvio > 0 ? "+" : ""}{item.desvio}%
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${item.desvio > 0 ? "bg-rose-500" : "bg-emerald-500"}`}
                            style={{ width: `${Math.min(Math.abs(item.desvio) * 8, 100)}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </TabsContent>

        <TabsContent value="critico">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5 border border-border/50 rounded-xl bg-card/30">
              <h3 className="font-display text-xs font-semibold text-foreground uppercase tracking-wider mb-4">Folga das Atividades (meses)</h3>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={caminhoData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,15%)" horizontal={false} />
                    <XAxis type="number" stroke="hsl(220,10%,40%)" fontSize={10} fontFamily="JetBrains Mono" />
                    <YAxis 
                      dataKey="task" 
                      type="category" 
                      stroke="hsl(220,10%,40%)" 
                      fontSize={10} 
                      fontFamily="Inter" 
                      width={140}
                      tick={(props: any) => {
                        const { x, y, payload, index } = props;
                        const entry = caminhoData[index];
                        return (
                          <g transform={`translate(${x},${y})`}>
                            <text 
                              x={-10} 
                              y={0} 
                              dy={4} 
                              textAnchor="end" 
                              fill={entry?.isCritical ? "hsl(0,72%,55%)" : "hsl(220,10%,40%)"} 
                              className={`text-[10px] ${entry?.isCritical ? "font-bold" : "font-normal"}`}
                            >
                              {entry?.isCritical ? "⚠ " : ""}{payload.value}
                            </text>
                          </g>
                        );
                      }}
                    />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: any, name: string, props: any) => {
                      if (props.payload.isCritical) return ["0 meses (CRÍTICO)", "Folga"];
                      return [`${props.payload.folga} meses`, "Folga"];
                    }} />
                    <Bar dataKey="visualFolga" radius={[0, 4, 4, 0]} barSize={18}>
                      {caminhoData.map((entry, i) => (
                        <Cell key={i} fill={folgaColors[entry.cor]} fillOpacity={entry.isCritical ? 1 : 0.7} />
                      ))}
                      <LabelList 
                        dataKey="task" 
                        content={(props: any) => {
                          const { x, y, width, height, value, index } = props;
                          const entry = caminhoData[index];
                          if (!entry?.isCritical) return null;
                          return (
                            <text 
                              x={x + width / 2} 
                              y={y + height / 2} 
                              fill="#fff" 
                              textAnchor="middle" 
                              dominantBaseline="middle" 
                              className="text-[9px] font-bold font-display"
                            >
                              ⚠ CRÍTICO (FOLGA 0)
                            </text>
                          );
                        }} 
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5 border border-border/50 rounded-xl bg-card/30">
              <h3 className="font-display text-xs font-semibold text-foreground uppercase tracking-wider mb-4">Sequência do Caminho Crítico</h3>
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {caminhoData.filter(c => c.cor === "critical" || c.cor === "warning").map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30">
                    <div className={`w-2 h-8 rounded-full ${item.cor === "critical" ? "bg-rose-500" : "bg-amber-500"}`} />
                    <div className="flex-1">
                      <p className="text-xs font-display font-medium text-foreground">{item.task}</p>
                      <p className="text-[10px] text-muted-foreground">Folga: {item.folga} meses</p>
                    </div>
                    {i < caminhoData.filter(c => c.cor === "critical" || c.cor === "warning").length - 1 && (
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20">
                <p className="text-[10px] text-rose-400 font-display font-medium">⚠ Atenção: Atividades com folga zero impactam diretamente o prazo final.</p>
              </div>
            </motion.div>
          </div>
        </TabsContent>

        <TabsContent value="evm">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5 border border-border/50 rounded-xl bg-card/30">
            <h3 className="font-display text-xs font-semibold text-foreground uppercase tracking-wider mb-4">Earned Value Management (EVM)</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {evmIndicators.map((ind, i) => (
                <div key={ind.label} className="p-3 rounded-lg bg-secondary/30 border border-border/30">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] text-muted-foreground font-display uppercase tracking-wider">{ind.label}</span>
                    {ind.icon && <ind.icon className={`h-3 w-3 ${ind.color}`} />}
                  </div>
                  <p className={`text-sm font-display font-bold ${ind.color}`}>{ind.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 p-4 rounded-lg bg-secondary/20 border border-border/30">
              <h4 className="text-xs font-display font-semibold text-foreground mb-2">Interpretação</h4>
              <div className="space-y-1.5 text-[11px] text-muted-foreground">
                <p>• <span className="text-foreground font-medium">BAC</span> — Orçamento total planejado para a conclusão da obra.</p>
                <p>• <span className="text-blue-400 font-medium">EV</span> — Valor do trabalho efetivamente realizado (atualmente zero).</p>
                <p>• <span className="text-rose-400 font-medium">SV</span> — Variação de prazo negativa indica que a obra ainda não iniciou.</p>
              </div>
            </div>
          </motion.div>
        </TabsContent>

        <TabsContent value="marcos">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5 border border-border/50 rounded-xl bg-card/30">
            <h3 className="font-display text-xs font-semibold text-foreground uppercase tracking-wider mb-6">Marcos do Projeto</h3>
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border/50" />
              <div className="space-y-6">
                {marcos.map((marco, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }} className="flex items-center gap-4 relative">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center z-10 shrink-0 ${
                      marco.status === "done" ? "bg-emerald-500/20 border-2 border-emerald-500" :
                      marco.status === "in_progress" ? "bg-blue-500/20 border-2 border-blue-500" :
                      "bg-secondary border-2 border-border"
                    }`}>
                      {marco.status === "done" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> :
                       marco.status === "in_progress" ? <Clock className="h-3.5 w-3.5 text-blue-500" /> :
                       <Circle className="h-3.5 w-3.5 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-display font-medium text-foreground">{marco.name}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          marco.status === "done" ? "bg-emerald-500/15 text-emerald-400" :
                          marco.status === "in_progress" ? "bg-blue-500/15 text-blue-400" :
                          "bg-muted text-muted-foreground"
                        }`}>{statusLabels[marco.status] || "Pendente"}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{marco.date}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
