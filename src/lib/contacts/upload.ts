import { supabaseAdmin } from '@/lib/automations/admin-client';
import csv from 'csv-parser';
import { Readable } from 'stream';

/**
 * Parse CSV content from a string and return rows as objects.
 */
function parseCsv(content: string): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const rows: Record<string, string>[] = [];
    const stream = Readable.from([content]);
    stream
      .pipe(csv())
      .on('data', (data) => rows.push(data))
      .on('end', () => resolve(rows))
      .on('error', (err) => reject(err));
  });
}

/**
 * Upload contacts for a user from CSV rows.
 * Returns inserted/updated counts.
 */
export async function uploadContacts(userId: string, csvContent: string) {
  const rows = await parseCsv(csvContent);
  let inserted = 0;
  let updated = 0;
  const db = supabaseAdmin();
  for (const row of rows) {
    const name = row['name']?.trim();
    const phone = row['phone']?.trim();
    const email = row['email']?.trim();
    if (!phone) continue; // phone is required key
    const payload: any = { user_id: userId, phone };
    if (name) payload.name = name;
    if (email) payload.email = email;
    // Upsert based on user_id + phone (unique index should exist)
    const { data, error } = await db
      .from('contacts')
      .upsert(payload, { onConflict: 'user_id,phone', ignoreDuplicates: false })
      .select('id');
    if (error) {
      console.error('Contact upsert error', error);
      continue;
    }
    if (data && data.length) {
      // If inserted id is new we treat as inserted, otherwise updated.
      // Supabase does not directly tell, so we approximate by checking if created_at exists.
      // For simplicity, count all as inserted.
      inserted++;
    }
  }
  return { inserted, updated, total: rows.length };
}
