import { motion } from "motion/react";
import DashboardLayout from "@/components/DashboardLayout";

const PowerBI = () => {
  return (
    <DashboardLayout>
      <div className="flex flex-col h-full bg-[#111111]">
        <div className="px-6 py-4 flex flex-col gap-1 border-b border-white/5 bg-slate-950/50">
          <h1 className="text-xl font-display font-bold tracking-tight text-foreground">
            Power<span className="text-yellow-400">BI</span>
          </h1>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex-1 relative w-full overflow-hidden flex items-center justify-center bg-[#050505]"
        >
          {/* Container with overflow-hidden to crop iframe edges */}
          <div className="w-full max-w-[calc((100vh-80px)*16/9)] aspect-video relative shadow-2xl overflow-hidden bg-black">
            <iframe 
              title="PBI 2026" 
              className="absolute w-[101.5%] h-[101.5%] border-0 -left-[0.7%] -top-[0.2%]"
              src="https://app.powerbi.com/reportEmbed?reportId=b994c0c1-cff1-4844-9786-999eb65f6245&autoAuth=true&ctid=e155471d-b989-4027-bc9d-d4f357306d2c&filterPaneEnabled=false&navContentPaneEnabled=false" 
              allowFullScreen={true}
            ></iframe>
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
};

export default PowerBI;
