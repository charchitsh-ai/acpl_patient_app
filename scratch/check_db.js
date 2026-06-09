const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing env variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  try {
    const { data: config, error: configError } = await supabase
      .from('whatsapp_config')
      .select('*');
    
    console.log('--- WHATSAPP CONFIG ---');
    if (configError) {
      console.error('Error fetching config:', configError);
    } else {
      console.log(config);
    }

    const { count, error: countError } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true });
    
    console.log('\n--- MESSAGES COUNT ---');
    if (countError) {
      console.error('Error counting messages:', countError);
    } else {
      console.log('Total messages in DB:', count);
    }

    const { data: latestMessages, error: latestError } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    console.log('\n--- LATEST MESSAGES ---');
    if (latestError) {
      console.error('Error fetching latest messages:', latestError);
    } else {
      console.log(latestMessages);
    }

  } catch (err) {
    console.error(err);
  }
}

run();
