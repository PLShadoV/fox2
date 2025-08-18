import { NextResponse } from "next/server";
import rcem from "@/public/rcem.json";

export async function GET(){
  // serves JSON map "YYYY-MM" -> price PLN/MWh
  return NextResponse.json(rcem);
}
