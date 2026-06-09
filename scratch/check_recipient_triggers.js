const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  // Query pg_trigger to find all triggers on broadcast_recipients
  const { data, error } = await supabase.rpc('execute_sql_query', {
    query_text: `
      SELECT tgname, tgenabled, tgtype, pg_get_triggerdef(oid) as definition
      FROM pg_trigger
      WHERE tgrelid = 'broadcast_recipients'::regclass;
    `
  });

  if (error) {
    // If execute_sql_query RPC doesn't exist, we can try to query information_schema.triggers
    console.log('execute_sql_query RPC failed or is not available. Trying direct query...');
    console.error(error);
  } else {
    console.log('Triggers on broadcast_recipients:');
    console.log(data);
  }
}

run();
