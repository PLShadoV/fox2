import DashboardClient from "@/components/DashboardClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Page({ searchParams }: { searchParams: { date?: string } }) {
  const date = searchParams?.date || new Date().toISOString().slice(0,10);
  return <DashboardClient initialDate={date} />;
}
