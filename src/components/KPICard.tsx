import { motion } from "motion/react";
import { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: string;
  change: string;
  changeType: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  delay?: number;
}

export default function KPICard({
  title,
  value,
  change,
  changeType,
  icon: Icon,
  delay = 0,
}: KPICardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <Card className="p-4 glass-card border-border/50 hover:border-primary/30 transition-colors">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-muted-foreground font-display uppercase tracking-wider">
            {title}
          </span>
          <div className="p-1.5 rounded-lg bg-secondary/60">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        </div>
        <div className="flex flex-col">
          <p className="text-xl font-display font-bold text-foreground">{value}</p>
          <p
            className={cn(
              "text-[10px] mt-1 font-medium",
              changeType === "positive" && "text-success",
              changeType === "negative" && "text-destructive",
              changeType === "neutral" && "text-muted-foreground"
            )}
          >
            {change}
          </p>
        </div>
      </Card>
    </motion.div>
  );
}
