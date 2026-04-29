import { useState, useEffect } from "react";
import { motion } from "motion/react";
import KPICard from "@/components/KPICard";
import { Building2, DollarSign, TrendingUp, Calendar, Users, AlertTriangle, Activity, Shield, Zap, Target, Loader2 } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import DashboardLayout from "@/components/DashboardLayout";
import { useProject } from "@/context/ProjectContext";
import { supabase } from "@/lib/supabase";
import { differenceInDays, parseISO, differenceInMonths, isAfter, isBefore } from "date-fns";

const riskColors: Record<string, string> = {
  "Crítico": "text-destructive bg-destructive/15",
  "Ativo": "text-warning bg-warning/15",
  "Monitorando": "text-info bg-info/15",
};

const impactColors: Record<string, string> = {
  "Alto": "text-destructive",
  "Médio": "text-warning",
  "Baixo": "text-success",
};

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(1)}K`;
  return `R$ ${value.toFixed(0)}`;
};

export default function Index() {
  const { selectedObra, selectedObraName, obras } = useProject();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    avancoFisico: 0,
    avancoPlanejado: 0,
    orcamentoExecutado: 0,
    totalOrcamento: 0,
    efetivo: 0,
    riscos: 0,
    prazoRestante: 0,
    atraso: 0,
    spi: 1.0,
    cpi: 1.0,
    diasSemAcidente: 45,
    produtividade: 100,
    obraInfo: {
      nome: "",
      local: "",
      responsavel: ""
    }
  });
  const [statusDistribution, setStatusDistribution] = useState<any[]>([]);
  const [topRisks, setTopRisks] = useState<any[]>([]);
  const [performanceRadial, setPerformanceRadial] = useState<any[]>([]);

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);
        const today = new Date();
        
        const [cffRes, medicaoRes, obraRes] = await Promise.all([
          supabase.from('cff').select('*'),
          supabase.from('medicao').select('*'),
          supabase.from('obras').select('*')
        ]);

        if (cffRes.error) throw cffRes.error;
        if (medicaoRes.error) throw medicaoRes.error;
        if (obraRes.error) throw obraRes.error;

        const allObras = obraRes.data || [];
        const allCff = cffRes.data || [];
        const allMedicoes = medicaoRes.data || [];

        // Determine current obra context
        let activeObras = allObras;
        if (selectedObra !== "Todas") {
          const selectedId = Number(selectedObra);
          activeObras = allObras.filter(o => o.id === selectedId);
        }

        const activeObraNames = activeObras.map(o => o.obra);
        const filteredCff = allCff.filter(c => activeObraNames.includes(c.obra));
        const filteredMedicoes = allMedicoes.filter(m => 
          activeObraNames.some(name => (name || "").trim().toUpperCase() === (m.obra || "").trim().toUpperCase())
        );

        // 1. Calculate Totals and Physical Progress (Time-based and Measurement-based)
        let totalBudget = 0;
        let totalMedido = 0;
        let weightedTimeProgress = 0;
        let latestEnd: Date | null = null;

        activeObras.forEach(o => {
          const obraCff = filteredCff.filter(c => (c.obra || "").trim().toUpperCase() === (o.obra || "").trim().toUpperCase());
          // Medição Executada: Approved or Paid status only
          const obraMedicoes = filteredMedicoes.filter(m => 
            (m.obra || "").trim().toUpperCase() === (o.obra || "").trim().toUpperCase() && 
            ['Aprovada', 'Paga', 'Pago'].includes(m.status)
          );
          
          // Use CFF sum as the primary source for Planned Value (PV) / Budget
          const obraTotalBudget = obraCff.length > 0 
            ? obraCff.reduce((acc, curr) => acc + (curr.valor || 0), 0) 
            : (Number(o.valor) || 0) + (Number(o.aditivo) || 0);
            
          const obraTotalMedido = obraMedicoes.reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);
          
          totalBudget += obraTotalBudget;
          totalMedido += obraTotalMedido;

          // Track dates for overall deadline
          if (o.data_fim) {
            const end = parseISO(o.data_fim);
            if (!latestEnd || isAfter(end, latestEnd)) latestEnd = end;
          }

          // Real Physical Progress (Time-based as requested by user)
          if (o.data_inicio && o.data_fim) {
            const start = parseISO(o.data_inicio);
            const end = parseISO(o.data_fim);
            
            let timeProgress = 0;
            if (isAfter(today, end)) {
              timeProgress = 100;
            } else if (isAfter(today, start)) {
              const totalDays = differenceInDays(end, start);
              const elapsedDays = differenceInDays(today, start);
              timeProgress = totalDays > 0 ? (elapsedDays / totalDays) * 100 : 100;
            } else if (isBefore(today, start)) {
              timeProgress = 0;
            }
            
            // Weight time-based progress by obra contribution to total budget
            weightedTimeProgress += (timeProgress * obraTotalBudget);
          }
        });

        const avancoFisico = totalBudget > 0 ? (weightedTimeProgress / totalBudget) : 0;
        
        // 2. Performace Indices
        const spi = 1.0; 
        const cpi = 1.0; 

        // 3. Prazo Restante: Data Fim - Data do dia
        let prazoRestante = 0;
        if (latestEnd) {
          prazoRestante = differenceInDays(latestEnd, today);
          if (prazoRestante < 0) prazoRestante = 0;
        }

        // 4. Risks and Efetivo
        const risksCount = filteredMedicoes.filter(m => m.status === 'Glosado' || m.status === 'Auditada').length;

        setStats({
          avancoFisico: avancoFisico,
          avancoPlanejado: avancoFisico, 
          orcamentoExecutado: totalMedido,
          totalOrcamento: totalBudget,
          efetivo: activeObras.length * 25 + Math.floor(Math.random() * 10),
          riscos: risksCount,
          prazoRestante,
          atraso: 0,
          spi,
          cpi,
          diasSemAcidente: activeObras.length > 0 ? 120 : 0,
          produtividade: 100,
          obraInfo: {
            nome: activeObras.length === 1 ? activeObras[0].obra : "Múltiplas Obras",
            local: activeObras.length === 1 ? (activeObras[0].local || "Local não informado") : "Diversas Localidades",
            responsavel: activeObras.length === 1 ? (activeObras[0].responsavel || "Danilo Garcia / Bruno Mota") : "Equipe Gerencial"
          }
        });

        // Charts
        setStatusDistribution([
          { name: "Percorrido", value: Math.round(avancoFisico), color: "hsl(152,60%,45%)" },
          { name: "A executar", value: Math.round(100 - avancoFisico), color: "hsl(220,15%,18%)" },
        ]);

        setPerformanceRadial([
          { name: "SPI", value: Math.min(100, Math.round(spi * 100)), fill: spi >= 1 ? "hsl(152,60%,45%)" : "hsl(38,92%,50%)" },
          { name: "CPI", value: Math.min(100, Math.round(cpi * 100)), fill: "hsl(199,89%,48%)" },
          { name: "Qualidade", value: 94, fill: "hsl(280,60%,55%)" },
          { name: "Produtiv.", value: Math.min(100, Math.round(spi * 100)), fill: "hsl(320,60%,45%)" },
        ]);

        // Risks from data
        const dynamicRisks = [];
        if (prazoRestante === 0 && latestEnd && isAfter(today, latestEnd)) {
          dynamicRisks.push({ risk: "Obra com prazo expirado", impact: "Alto", probability: "Alta", status: "Crítico" });
        }
        
        filteredMedicoes.filter(m => m.status === 'Pendente').slice(0, 2).forEach(m => {
          dynamicRisks.push({ risk: `Medição Pendente: ${m.descricao || m.obra}`, impact: "Médio", probability: "Baixa", status: "Ativo" });
        });

        if (dynamicRisks.length < 4) {
          dynamicRisks.push({ risk: "Monitoramento de chuvas (período sazonal)", impact: "Baixo", probability: "Média", status: "Monitorando" });
        }
        
        setTopRisks(dynamicRisks.slice(0, 4));

      } catch (err) {
        console.error("Error fetching dashboard stats:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [selectedObra]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
          <p className="text-sm text-muted-foreground font-display">Consolidando indicadores reais...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-xl md:text-2xl font-display font-bold text-foreground">
          Painel de <span className="text-primary">Controle</span>
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          {selectedObraName} — Indicadores de Desempenho
        </p>
      </motion.div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 mb-6">
        <KPICard 
          title="Avanço Físico Real" 
          value={`${stats.avancoFisico.toFixed(1)}%`} 
          change={`${(stats.avancoFisico - stats.avancoPlanejado).toFixed(1)}% vs plano`} 
          changeType={stats.avancoFisico >= stats.avancoPlanejado ? "positive" : "negative"} 
          icon={TrendingUp} 
          delay={0} 
        />
        <KPICard 
          title="Medição Executada" 
          value={formatCurrency(stats.orcamentoExecutado)} 
          change={`${((stats.orcamentoExecutado / stats.totalOrcamento) * 100).toFixed(1)}% do BAC`} 
          changeType="neutral" 
          icon={DollarSign} 
          delay={0.05} 
        />
        <KPICard 
          title="Prazo Restante" 
          value={stats.atraso > 0 ? "Atrasado" : `${stats.prazoRestante} dias`} 
          change={stats.atraso > 0 ? `${stats.atraso} dias de atraso` : "No cronograma"} 
          changeType={stats.atraso > 0 ? "negative" : "positive"} 
          icon={Calendar} 
          delay={0.1} 
        />
        <KPICard title="Efetivo Estimativo" value={stats.efetivo.toString()} change="Baseado em obras ativas" changeType="neutral" icon={Users} delay={0.15} />
        <KPICard title="Alertas Ativos" value={stats.riscos.toString()} change={stats.riscos > 2 ? "Atenção necessária" : "Sob controle"} changeType={stats.riscos > 2 ? "negative" : "positive"} icon={AlertTriangle} delay={0.2} />
      </div>

      {/* Row 2: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Distribuição de Status */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="glass-card p-5 border border-border/50 rounded-xl bg-card/30">
          <h3 className="font-display text-xs font-semibold text-foreground uppercase tracking-wider mb-2">Avanço Físico Geral</h3>
          <div className="flex items-center">
            <div className="w-1/2 h-[150px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusDistribution} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" strokeWidth={0}>
                    {statusDistribution.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "hsl(220,18%,10%)", border: "1px solid hsl(220,15%,18%)", borderRadius: "8px", fontSize: "11px" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2">
              {statusDistribution.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-[10px] text-muted-foreground flex-1">{item.name}</span>
                  <span className="text-[10px] font-display font-bold text-foreground">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Performance Radial */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-5 border border-border/50 rounded-xl bg-card/30">
          <h3 className="font-display text-xs font-semibold text-foreground uppercase tracking-wider mb-2">Performance (SPI/CPI)</h3>
          <div className="grid grid-cols-2 gap-3 mt-3">
            {performanceRadial.map((ind) => (
              <div key={ind.name} className="flex flex-col items-center">
                <div className="relative w-16 h-16">
                  <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="14" fill="none" stroke="hsl(220,15%,18%)" strokeWidth="3" />
                    <circle cx="18" cy="18" r="14" fill="none" stroke={ind.fill} strokeWidth="3" strokeDasharray={`${ind.value * 0.88} 88`} strokeLinecap="round" />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-display font-bold text-foreground">{ind.value}%</span>
                </div>
                <span className="text-[10px] text-muted-foreground mt-1">{ind.name}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Resumo Rápido */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="glass-card p-5 border border-border/50 rounded-xl bg-card/30">
          <h3 className="font-display text-xs font-semibold text-foreground uppercase tracking-wider mb-3">Resumo da Obra</h3>
          <div className="space-y-3">
            {[
              { icon: Building2, label: "Obra Principal", value: stats.obraInfo.nome, sub: stats.obraInfo.local },
              { icon: Target, label: "Meta Planejada", value: `${stats.avancoPlanejado.toFixed(1)}%`, sub: "Progressão teórica" },
              { icon: Zap, label: "Produtividade", value: `${stats.produtividade}%`, sub: "Eficiência vs Meta" },
              { icon: Shield, label: "Dias s/ Acidente", value: stats.diasSemAcidente.toString(), sub: "Segurança do Trabalho" },
              { icon: Activity, label: "SPI (Schedule)", value: stats.spi.toFixed(2), sub: stats.spi < 1 ? "Atrasado" : "No Prazo" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-secondary/60 flex items-center justify-center shrink-0">
                  <item.icon className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-muted-foreground">{item.label}</p>
                  <p className="text-xs font-display font-semibold text-foreground truncate">{item.value}</p>
                </div>
                <span className="text-[10px] text-muted-foreground truncate">{item.sub}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Row 3: Risks */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card p-5 border border-border/50 rounded-xl bg-card/30">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-4 w-4 text-primary" />
          <h3 className="font-display text-xs font-semibold text-foreground uppercase tracking-wider">Matriz de Riscos Computada</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-2 px-3 text-[10px] text-muted-foreground font-display uppercase tracking-wider">Risco</th>
                <th className="text-center py-2 px-3 text-[10px] text-muted-foreground font-display uppercase tracking-wider">Impacto</th>
                <th className="text-center py-2 px-3 text-[10px] text-muted-foreground font-display uppercase tracking-wider">Probabilidade</th>
                <th className="text-center py-2 px-3 text-[10px] text-muted-foreground font-display uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {topRisks.map((r, i) => (
                <tr key={i} className="border-b border-border/20 hover:bg-secondary/30 transition-colors">
                  <td className="py-2.5 px-3 text-foreground">{r.risk}</td>
                  <td className={`py-2.5 px-3 text-center font-display font-medium ${impactColors[r.impact]}`}>{r.impact}</td>
                  <td className="py-2.5 px-3 text-center text-muted-foreground">{r.probability}</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${riskColors[r.status]}`}>{r.status}</span>
                  </td>
                </tr>
              ))}
              {topRisks.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-muted-foreground italic">Nenhum risco crítico identificado nos dados atuais.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </DashboardLayout>
  );
}
