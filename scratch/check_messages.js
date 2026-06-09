const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: messages, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', 'f49f73d1-d46b-480a-b72c-8c8d4d02dc20')
    .order('created_at', { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  console.log(`Found ${messages.length} messages:`);
  messages.forEach((m, i) => {
    console.log(`${i + 1}. [${m.sender_type}] [${m.created_at}] status:${m.status} Text: ${m.content_text?.substring(0, 60)}`);
  });
}

run();
