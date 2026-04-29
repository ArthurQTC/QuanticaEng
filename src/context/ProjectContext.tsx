import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface Obra {
  id: number;
  obra: string;
}

interface ProjectContextType {
  selectedObra: string; // This stores the ID (bigint as string), or "Todas"
  selectedObraName: string; // This stores the name for display
  setSelectedObra: (id: string) => void;
  obras: Obra[];
  obrasWithCFF: Obra[];
  obrasWithMedicao: Obra[];
  obrasWithOrcamento: Obra[];
  obrasWithAnyData: Obra[];
  loading: boolean;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [selectedObra, setSelectedObra] = useState<string>("Todas");
  const [obras, setObras] = useState<Obra[]>([]);
  const [obrasWithCFF, setObrasWithCFF] = useState<Obra[]>([]);
  const [obrasWithMedicao, setObrasWithMedicao] = useState<Obra[]>([]);
  const [obrasWithOrcamento, setObrasWithOrcamento] = useState<Obra[]>([]);
  const [obrasWithAnyData, setObrasWithAnyData] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);

  const selectedObraName = selectedObra === "Todas" 
    ? "Todas as Obras" 
    : obras.find(o => o.id.toString() === selectedObra)?.obra || "Obra não encontrada";

  useEffect(() => {
    async function fetchObras() {
      try {
        setLoading(true);
        
        // Helper to fetch all unique obra names from a large table
        const fetchUniqueNames = async (tableName: string) => {
          const namesSet = new Set<string>();
          let from = 0;
          let hasMore = true;
          
          while (hasMore) {
            const { data, error } = await supabase
              .from(tableName)
              .select('obra')
              .not('obra', 'is', null)
              .range(from, from + 999);
            
            if (error) throw error;
            if (data && data.length > 0) {
              data.forEach(item => namesSet.add(item.obra.trim()));
              if (data.length < 1000) hasMore = false;
              else from += 1000;
            } else {
              hasMore = false;
            }
            if (from > 30000) break; // Safe ceiling
          }
          return namesSet;
        };

        // Fetch all base obras
        const { data: allObras, error: allError } = await supabase
          .from('obras')
          .select('id, obra')
          .order('obra');

        if (allError) throw allError;
        const baseObras = allObras || [];
        setObras(baseObras);

        // Process distinct joins for each module
        const cffObraNames = await fetchUniqueNames('cff');
        setObrasWithCFF(baseObras.filter(o => 
          Array.from(cffObraNames).some(name => name.toUpperCase() === o.obra.trim().toUpperCase())
        ));

        const medicaoObraNames = await fetchUniqueNames('medicao');
        setObrasWithMedicao(baseObras.filter(o => 
          Array.from(medicaoObraNames).some(name => name.toUpperCase() === o.obra.trim().toUpperCase())
        ));

        const orcamentoObraNames = await fetchUniqueNames('orcamento');
        setObrasWithOrcamento(baseObras.filter(o => 
          Array.from(orcamentoObraNames).some(name => name.toUpperCase() === o.obra.trim().toUpperCase())
        ));

        // Combined logic for general Dashboard
        const allDataObraNames = new Set([
          ...Array.from(cffObraNames),
          ...Array.from(medicaoObraNames),
          ...Array.from(orcamentoObraNames)
        ]);
        setObrasWithAnyData(baseObras.filter(o => 
          Array.from(allDataObraNames).some(name => name.toUpperCase() === o.obra.trim().toUpperCase())
        ));

      } catch (err) {
        console.error("Error fetching obras for context:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchObras();
  }, []);

  return (
    <ProjectContext.Provider value={{ selectedObra, selectedObraName, setSelectedObra, obras, obrasWithCFF, obrasWithMedicao, obrasWithOrcamento, obrasWithAnyData, loading }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return context;
}
