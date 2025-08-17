import Toolbar from "@/components/Toolbar";
import Dashboard from "@/components/Dashboard";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export default function Page({ searchParams }: { searchParams: { [k:string]: string | string[] | undefined } }){
  const date = typeof searchParams.date === "string" ? searchParams.date : format(new Date(), "yyyy-MM-dd");
  const range = typeof searchParams.range === "string" ? searchParams.range : "day";
  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-semibold">FoxESS + RCE — {date}</h1>
      <Toolbar />
      <Dashboard date={date} range={range} />
    </div>
  );
}
