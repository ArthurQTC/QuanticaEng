import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Obras from "./pages/Obras";
import Medicoes from "./pages/Medicoes";
import CronogramaFisicoFinanceiro from "./pages/CronogramaFisicoFinanceiro";
import CurvaS from "./pages/CurvaS";
import EAP from "./pages/EAP";
import PowerBI from "./pages/PowerBI";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProjectProvider } from "./context/ProjectContext";

export default function App() {
  return (
    <ProjectProvider>
      <TooltipProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/obras" element={<Obras />} />
            <Route path="/medicoes" element={<Medicoes />} />
            <Route path="/cronograma-fisico-financeiro" element={<CronogramaFisicoFinanceiro />} />
            <Route path="/curva-s" element={<CurvaS />} />
            <Route path="/eap" element={<EAP />} />
            <Route path="/power-bi" element={<PowerBI />} />
          </Routes>
        </Router>
      </TooltipProvider>
    </ProjectProvider>
  );
}
