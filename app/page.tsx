import DashboardClient from '@/components/DashboardClient';

export default function Page({ searchParams }:{ searchParams: { date?: string } }){
  const date = searchParams?.date || new Date().toISOString().slice(0,10);
  return <DashboardClient initialDate={date} />;
}