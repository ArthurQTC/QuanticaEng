import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  LayoutDashboard,
  Building2,
  FileText,
  BarChart3,
  CalendarDays,
  TrendingUp,
  Layers,
  Menu,
  X,
  ChevronRight,
  Filter,
  Monitor,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useProject } from "@/context/ProjectContext";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Building2, label: "Obras", path: "/obras" },
  { icon: FileText, label: "Medições", path: "/medicoes" },
  { icon: BarChart3, label: "Cronograma Físico-Financeiro", path: "/cronograma-fisico-financeiro" },
  { icon: TrendingUp, label: "Curva S", path: "/curva-s" },
  { icon: Layers, label: "EAP", path: "/eap" },
  { icon: Monitor, label: "PowerBI", path: "/power-bi" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const location = useLocation();
  const { selectedObra, setSelectedObra, obras, obrasWithCFF, obrasWithMedicao, obrasWithOrcamento, obrasWithAnyData } = useProject();

  const isCFFRelated = ["/cronograma-fisico-financeiro", "/curva-s"].includes(location.pathname);
  const isMedicaoRelated = location.pathname === "/medicoes";
  const isEAPRelated = location.pathname === "/eap";
  const isPowerBIRelated = location.pathname === "/power-bi";
  const isDashboard = location.pathname === "/";
  
  const displayObras = isCFFRelated 
    ? obrasWithCFF 
    : isMedicaoRelated 
      ? obrasWithMedicao 
      : isEAPRelated
        ? obrasWithOrcamento
        : isPowerBIRelated || isDashboard
          ? obrasWithAnyData
          : obras;

  return (
    <div className="min-h-screen bg-background text-foreground flex overflow-hidden">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 bg-card border-r border-border/50 transition-all duration-300 ease-in-out lg:relative",
          isSidebarOpen ? "w-64" : "w-20",
          !isSidebarOpen && "lg:w-20"
        )}
      >
        <div className="h-full flex flex-col">
          {/* Logo */}
          <a href="/" className="p-6 flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center shrink-0">
              <img src="https://onpynlltbethkpdyxyiv.supabase.co/storage/v1/object/public/Quantica%20EAP/Quantica_page-0004.jpg" alt="Quântica Logo" className="w-full h-full object-cover" />
            </div>
            {isSidebarOpen && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="font-display font-bold text-lg tracking-tight"
              >
                Quântica<span className="text-emerald-500"> Analytics</span>
              </motion.span>
            )}
          </a>

          {/* Navigation */}
          <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group relative",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  )}
                >
                  <item.icon className={cn("h-5 w-5 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                  {isSidebarOpen && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-sm font-medium"
                    >
                      {item.label}
                    </motion.span>
                  )}
                  {isActive && (
                    <motion.div
                      layoutId="active-pill"
                      className="absolute left-0 w-1 h-6 bg-primary rounded-r-full"
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Toggle Button */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-4 border-t border-border/50 flex items-center justify-center hover:bg-secondary/30 transition-colors"
          >
            <ChevronRight
              className={cn(
                "h-5 w-5 text-muted-foreground transition-transform duration-300",
                isSidebarOpen ? "rotate-180" : "rotate-0"
              )}
            />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative flex flex-col">
        {/* Top Header with Filter */}
        <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/50 px-4 md:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="hidden lg:flex p-2 rounded-lg hover:bg-secondary/50 transition-colors"
            >
              <Menu className="h-5 w-5 text-muted-foreground" />
            </button>
            
            {/* Mobile Logo */}
            <a href="/" className="lg:hidden flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
                <Building2 className="text-primary-foreground h-4 w-4" />
              </div>
              <span className="font-display font-bold text-sm">Quântica</span>
            </a>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-secondary/30 border border-border/50 rounded-lg px-3 py-1.5 min-w-[180px] md:min-w-[240px]">
              <Filter className="h-3.5 w-3.5 text-primary" />
                <select
                  value={selectedObra}
                  onChange={(e) => setSelectedObra(e.target.value)}
                  className="bg-transparent border-none text-xs font-display font-medium text-foreground focus:outline-none w-full cursor-pointer"
                >
                  <option value="Todas" className="bg-card text-foreground">Todas as Obras</option>
                  {displayObras.map((obra) => (
                    <option key={obra.id} value={obra.id.toString()} className="bg-card text-foreground">
                      {obra.obra}
                    </option>
                  ))}
                </select>
            </div>
            
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="lg:hidden p-2 rounded-lg bg-secondary/50"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className={cn(
          "w-full flex-1 flex flex-col",
          isPowerBIRelated ? "p-0" : "p-4 md:p-8 max-w-7xl mx-auto"
        )}>
          {children}
        </div>
      </main>
    </div>
  );
}
