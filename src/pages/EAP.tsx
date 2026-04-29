import { useState, useEffect } from "react";
import { motion } from "motion/react";
import DashboardLayout from "@/components/DashboardLayout";
import { Layers, ChevronRight, ChevronDown, Building2, DollarSign, Calendar, Loader2, CheckCircle2, Clock, AlertCircle, Circle } from "lucide-react";
import { useProject } from "@/context/ProjectContext";
import { supabase } from "@/lib/supabase";

interface EAPItem {
  id: string;
  item: string;
  descricao: string;
  valor: number;
  percentual: number;
  status: "done" | "in_progress" | "pending" | "critical";
  classe?: "A" | "B" | "C";
  children?: EAPItem[];
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const statusIcon = {
  done: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  in_progress: <Clock className="h-4 w-4 text-blue-500" />,
  pending: <Circle className="h-4 w-4 text-muted-foreground" />,
  critical: <AlertCircle className="h-4 w-4 text-rose-500" />,
};

export default function EAP() {
  const { selectedObra, selectedObraName, obras } = useProject();
  const [loading, setLoading] = useState(true);
  const [eapTree, setEapTree] = useState<EAPItem[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function fetchEAP() {
      try {
        setLoading(true);
        let allData: any[] = [];
        let from = 0;
        let to = 999;
        let hasMore = true;

        while (hasMore) {
          let query = supabase
            .from('orcamento')
            .select('*')
            .order('item', { ascending: true })
            .range(from, to);

          if (selectedObra !== "Todas") {
            const selectedObraObj = obras.find(o => o.id.toString() === selectedObra);
            if (selectedObraObj) {
              query = query.eq('obra', selectedObraObj.obra);
            }
          }

          const { data, error } = await query;
          if (error) throw error;
          
          if (data && data.length > 0) {
            allData = [...allData, ...data];
            if (data.length < 1000) {
              hasMore = false;
            } else {
              from += 1000;
              to += 1000;
            }
          } else {
            hasMore = false;
          }
          
          // Safety break to prevent infinite loops
          if (from > 10000) break;
        }

        if (allData.length > 0) {
          const filteredData = allData;
          
          // Group by item to sum all periods/rows for the same EAP node
          const itemTotals: Record<string, { item: string; descricao: string; valor: number; percentual: number }> = {};
          filteredData.forEach(row => {
            const itemCode = (row.item || "").toString().trim();
            if (!itemCode) return;
            
            if (!itemTotals[itemCode]) {
              itemTotals[itemCode] = { item: itemCode, descricao: row.descricao || "Sem descrição", valor: 0, percentual: 0 };
            }
            itemTotals[itemCode].valor += Number(row.valor || 0);
            itemTotals[itemCode].percentual += (Number(row.percentual || 0)) * 100;
          });

          // Build tree and calculate grand total correctly
          const sortedItems = Object.values(itemTotals).sort((a, b) => 
            a.item.localeCompare(b.item, undefined, { numeric: true })
          );
          
          // ABC Curve Logic (Pareto Principle)
          // Sort items by value DESC to calculate cumulative percentage
          const totalBudgetSum = Object.values(itemTotals).reduce((acc, curr) => acc + curr.valor, 0);
          const itemsByValue = [...Object.values(itemTotals)].sort((a, b) => b.valor - a.valor);
          
          const abcLevels: Record<string, "A" | "B" | "C"> = {};
          let accumulatedValue = 0;
          
          itemsByValue.forEach(item => {
            if (totalBudgetSum > 0) {
              accumulatedValue += item.valor;
              const accumulatedPercentage = (accumulatedValue / totalBudgetSum) * 100;
              
              if (accumulatedPercentage <= 80) abcLevels[item.item] = "A";
              else if (accumulatedPercentage <= 95) abcLevels[item.item] = "B";
              else abcLevels[item.item] = "C";
            } else {
              abcLevels[item.item] = "C";
            }
          });

          const tree: EAPItem[] = [];
          const map: Record<string, EAPItem> = {};

          sortedItems.forEach(item => {
            // Derived status for better visualization
            const status: any = item.item.startsWith('1') ? "done" : item.item.startsWith('2') ? "in_progress" : "pending";
            
            const node: EAPItem = { 
              ...item, 
              id: item.item, 
              status, 
              classe: abcLevels[item.item],
              children: [] 
            };
            map[node.id] = node;

            // Normalize item for splitting: remove trailing dot if it exists for hierarchy lookup
            const normalizedItem = node.item.endsWith('.') ? node.item.slice(0, -1) : node.item;
            const parts = normalizedItem.split('.');
            
            if (parts.length === 1) {
              tree.push(node);
            } else {
              const parentId = parts.slice(0, -1).join('.');
              // Try finding parent as "01" or "01."
              const potentialParent = map[parentId] || map[parentId + '.'];
              
              if (potentialParent) {
                if (!potentialParent.children) potentialParent.children = [];
                potentialParent.children!.push(node);
              } else {
                tree.push(node); // Fallback to root if parent still not found
              }
            }
          });

          setEapTree(tree);
          
          // Expand first level by default
          const initialExpanded: Record<string, boolean> = {};
          tree.forEach(node => {
            initialExpanded[node.id] = true;
          });
          setExpanded(initialExpanded);
        }
      } catch (err) {
        console.error("Error fetching EAP data:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchEAP();
  }, [selectedObra]);

  const toggleExpand = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const renderItem = (item: EAPItem, level: number = 0) => {
    const isExpanded = expanded[item.id];
    const hasChildren = item.children && item.children.length > 0;

    return (
      <div key={item.id} className="w-full">
        <div 
          className={`flex items-center gap-3 p-3 border-b border-border/30 hover:bg-secondary/30 transition-colors cursor-pointer ${level === 0 ? "bg-secondary/20" : ""}`}
          style={{ paddingLeft: `${level * 24 + 12}px` }}
          onClick={() => hasChildren && toggleExpand(item.id)}
        >
          <div className="w-5 h-5 flex items-center justify-center">
            {hasChildren ? (
              isExpanded ? <ChevronDown className="h-4 w-4 text-primary" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />
            ) : null}
          </div>
          
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-5 h-5 flex items-center justify-center shrink-0">
              {statusIcon[item.status]}
            </div>
            <span className="text-[10px] font-mono text-primary font-bold min-w-[60px] shrink-0 mr-2">{item.item}</span>
            <span className={`text-xs truncate ${level === 0 ? "font-bold text-foreground" : "text-muted-foreground"}`}>{item.descricao}</span>
          </div>
          
          <div className="hidden md:flex items-center gap-6 text-[10px]">
            <div className="w-24 text-right">
              <span className="text-muted-foreground block uppercase tracking-tighter">Valor Total</span>
              <span className="font-display font-medium text-foreground">{formatCurrency(item.valor)}</span>
            </div>
            <div className="w-16 text-right">
              <span className="text-muted-foreground block uppercase tracking-tighter">Classe</span>
              <span className={`font-display font-bold px-2 py-0.5 rounded-md ${
                item.classe === 'A' ? "bg-green-100 text-green-700" :
                item.classe === 'B' ? "bg-yellow-100 text-yellow-700" :
                "bg-blue-200 text-blue-900"
              }`}>
                {item.classe || "C"}
              </span>
            </div>
          </div>
        </div>
        
        {hasChildren && isExpanded && (
          <div className="w-full">
            {item.children?.map(child => renderItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
          <p className="text-sm text-muted-foreground font-display">Estruturando árvore de atividades...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-xl md:text-2xl font-display font-bold text-foreground">
          <span className="text-primary">EAP</span> — Estrutura Analítica do Projeto
        </h1>
        <p className="text-xs text-muted-foreground mt-1">{selectedObraName} — Hierarquia de atividades e custos</p>
      </motion.div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-4 border border-border/50 rounded-xl bg-card/30 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total de Itens (Nível 1)</p>
            <p className="text-lg font-display font-bold text-foreground">{eapTree.length}</p>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="glass-card p-4 border border-border/50 rounded-xl bg-card/30 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <DollarSign className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Valor Global</p>
            <p className="text-lg font-display font-bold text-foreground">
              {formatCurrency(
                eapTree
                  .filter(node => /^\d+\.?$/.test(node.item.trim())) // Integers (1, 2) OR Integers with trailing dot (01., 02.)
                  .reduce((acc, curr) => acc + curr.valor, 0)
              )}
            </p>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="glass-card p-4 border border-border/50 rounded-xl bg-card/30 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <Calendar className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Níveis da EAP</p>
            <p className="text-lg font-display font-bold text-foreground">3 Níveis</p>
          </div>
        </motion.div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        className="glass-card border border-border/50 rounded-xl bg-card/30 overflow-hidden"
      >
        <div className="p-4 border-b border-border/50 bg-secondary/30 flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <h3 className="font-display text-xs font-semibold text-foreground uppercase tracking-wider">Navegador da Estrutura</h3>
        </div>
        
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            {eapTree.map(item => renderItem(item))}
          </div>
        </div>
      </motion.div>
    </DashboardLayout>
  );
}
