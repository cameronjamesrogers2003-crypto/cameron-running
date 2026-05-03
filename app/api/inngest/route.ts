import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { processActivityJob } from "@/lib/jobs/processActivity";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processActivityJob],
});
