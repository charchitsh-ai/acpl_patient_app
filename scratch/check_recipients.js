const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: broadcasts, error: bError } = await supabase
    .from('broadcasts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3);

  if (bError) {
    console.error(bError);
    return;
  }

  for (const b of broadcasts) {
    console.log(`\n--- Broadcast: ${b.name} (${b.id}) ---`);
    console.log(`Status: ${b.status}, Recipients: ${b.total_recipients}, Sent: ${b.sent_count}, Delivered: ${b.delivered_count}, Read: ${b.read_count}`);

    const { data: recs, error: rError } = await supabase
      .from('broadcast_recipients')
      .select('id, status, whatsapp_message_id, error_message')
      .eq('broadcast_id', b.id)
      .limit(5);

    if (rError) {
      console.error(rError);
    } else {
      console.log('Recipients sample:');
      console.log(recs);
    }
  }
}

run();
