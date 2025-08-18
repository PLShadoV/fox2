import { NextResponse } from 'next/server';
import rcem from '@/public/rcem.json';

export async function GET(){
  return NextResponse.json({ ok: true, months: rcem });
}