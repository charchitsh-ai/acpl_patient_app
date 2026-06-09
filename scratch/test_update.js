const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  // Try to update one of the recipient rows of the "yes" broadcast
  // Broadcast id: 70ab43b3-3103-46d7-99ef-c2103a45b28f
  const { data: recs, error: fError } = await supabase
    .from('broadcast_recipients')
    .select('*')
    .eq('broadcast_id', '70ab43b3-3103-46d7-99ef-c2103a45b28f')
    .limit(1);

  if (fError || !recs || recs.length === 0) {
    console.error('Failed to find recipient:', fError);
    return;
  }

  const rec = recs[0];
  console.log('Found recipient row:', rec);

  console.log('Testing update with service role key...');
  const { data, error } = await supabase
    .from('broadcast_recipients')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      whatsapp_message_id: 'test-wamid-' + Date.now(),
    })
    .eq('id', rec.id)
    .select();

  if (error) {
    console.error('Update failed:', error);
  } else {
    console.log('Update succeeded:', data);
    
    // Check if parent broadcast count updated
    const { data: bcast } = await supabase
      .from('broadcasts')
      .select('id, name, sent_count')
      .eq('id', rec.broadcast_id)
      .single();
    console.log('Parent broadcast state after update:', bcast);
  }
}

run();
