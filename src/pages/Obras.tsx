import { useState, useEffect } from "react";
import { motion } from "motion/react";
import DashboardLayout from "@/components/DashboardLayout";
import { Building2, MapPin, Calendar, Users, TrendingUp, Loader2 } from "lucide-react";
import { useProject } from "@/context/ProjectContext";
import { supabase } from "@/lib/supabase";
import { format, differenceInMonths, differenceInDays, parseISO, isBefore, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";

const statusStyles: Record<string, string> = {
  "A iniciar": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  "Em andamento": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "Concluída": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  "Paralisada": "bg-rose-500/20 text-rose-400 border-rose-500/30",
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

export default function Obras() {
  const { selectedObra, selectedObraName } = useProject();
  const [loading, setLoading] = useState(true);
  const [obras, setObras] = useState<any[]>([]);

  useEffect(() => {
    async function fetchObrasData() {
      try {
        setLoading(true);
        const today = new Date(); // Using real today for calculations
        
        const [obraRes, medicaoRes, cffRes] = await Promise.all([
          supabase.from('obras').select('*'),
          supabase.from('medicao').select('*'),
          supabase.from('cff').select('*')
        ]);

        if (obraRes.error) throw obraRes.error;
        if (medicaoRes.error) throw medicaoRes.error;
        if (cffRes.error) throw cffRes.error;

        const allObras = obraRes.data || [];
        const medicaoData = medicaoRes.data || [];
        const cffData = cffRes.data || [];

        const processedObras = allObras
          .filter(o => (o.obra || "").trim().toUpperCase() !== "QUANTICA ENGENHARIA LTDA")
          .map((o) => {
            const nome = o.obra || "Obra sem nome";
            const id = o.id;
            const obraCff = cffData.filter(c => c.obra === nome);
            const obraMedicoes = medicaoData.filter(m => m.obra === nome && (m.status === 'Aprovada' || m.status === 'Paga' || m.status === 'Pago'));

            // Use valor + aditivo as the primary calculation for total budget
            const sumValorAditivo = (Number(o.valor) || 0) + (Number(o.aditivo) || 0);
            let totalBudget = sumValorAditivo || o.total_budget || o.orcamento || obraCff.reduce((acc, r) => acc + (r.valor || 0), 0);
            
            let progresso = 0;
            let prazo = "N/A";
            
            const dataInicio = o.data_inicio ? parseISO(o.data_inicio) : null;
            const dataFim = o.data_fim ? parseISO(o.data_fim) : null;

            if (dataInicio && dataFim) {
              const diffMeses = differenceInMonths(dataFim, dataInicio);
              prazo = `${diffMeses} meses (${format(dataInicio, "dd/MM/yyyy")} - ${format(dataFim, "dd/MM/yyyy")})`;
              
              if (isBefore(today, dataInicio)) {
                progresso = 0;
              } else if (isAfter(today, dataFim)) {
                progresso = 100;
              } else {
                const totalDays = differenceInDays(dataFim, dataInicio);
                const elapsedDays = differenceInDays(today, dataInicio);
                if (totalDays > 0) {
                  progresso = Math.round((elapsedDays / totalDays) * 100);
                } else {
                  progresso = 100;
                }
              }
            } else {
              // Fallback calculation for progress if no dates but user explicitly has o.progresso
              progresso = o.progresso || 0;
              if (o.prazo) prazo = o.prazo;
              else {
                const maxMes = Math.max(...obraCff.map(r => r.mes), 0);
                prazo = maxMes > 0 ? `${maxMes} meses` : "Prazo não definido";
              }
            }

            let status = o.status || (progresso >= 100 ? "Concluída" : progresso > 0 ? "Em andamento" : "A iniciar");
            let responsavel = o.responsavel || "Eng. Civil Danilo Garcia e Bruno Mota";
            let local = o.local || o.endereco || "Local não informado";
            let aditivo = o.aditivo || 0;

            return {
              id,
              nome,
              local,
              status,
              progresso: Math.min(Number(progresso) || 0, 100),
              prazo,
              responsavel,
              orcamento: formatCurrency(totalBudget),
              aditivo: aditivo > 0 ? formatCurrency(aditivo) : null,
              efetivo: o.efetivo || (obraMedicoes.length > 0 ? 45 : 0)
            };
          });

        setObras(processedObras);
      } catch (err) {
        console.error("Error fetching obras data:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchObrasData();
  }, []);

  const filteredObras = selectedObra === "Todas" 
    ? obras 
    : obras.filter(o => o.id.toString() === selectedObra);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
          <p className="text-sm text-muted-foreground font-display">Carregando portfólio de obras...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-xl md:text-2xl font-display font-bold text-foreground">
          <span className="text-primary">Obras</span> Cadastradas
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          {filteredObras.length} {filteredObras.length === 1 ? "obra exibida" : "obras registradas no sistema"}
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredObras.map((obra, i) => (
          <motion.div
            key={obra.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="glass-card p-5 border border-border/50 rounded-xl bg-card/30 hover:border-primary/30 transition-colors cursor-pointer group"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-display text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                  {obra.nome}
                </h3>
                <div className="flex items-center gap-1 mt-1 text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  <span className="text-[10px]">{obra.local}</span>
                </div>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${statusStyles[obra.status]}`}>
                {obra.status}
              </span>
            </div>

            {/* Progress bar */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted-foreground">Avanço físico</span>
                <span className="text-[10px] font-display font-bold text-foreground">{obra.progresso}%</span>
              </div>
              <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${obra.progresso}%` }}
                  transition={{ delay: i * 0.08 + 0.3, duration: 0.8 }}
                  className={`h-full rounded-full ${obra.progresso === 100 ? "bg-emerald-500" : "bg-primary"}`}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>{obra.prazo}</span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Users className="h-3 w-3" />
                <span>{obra.efetivo} colaboradores</span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Building2 className="h-3 w-3" />
                <span>{obra.orcamento}</span>
                {obra.aditivo && <span className="text-emerald-400 font-bold ml-1">+ {obra.aditivo}</span>}
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <TrendingUp className="h-3 w-3" />
                <span>{obra.responsavel}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </DashboardLayout>
  );
}
