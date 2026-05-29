import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Manual env parser
const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  console.log("Connecting to Supabase at:", env.NEXT_PUBLIC_SUPABASE_URL);
  
  // Check whatsapp_config
  const { data: configs, error: configError } = await supabase
    .from('whatsapp_config')
    .select('*');
    
  if (configError) {
    console.error("Error reading whatsapp_config:", configError);
  } else {
    console.log("whatsapp_config rows:", configs.length);
    configs.forEach(c => {
      console.log({
        id: c.id,
        phone_number_id: c.phone_number_id,
        waba_id: c.waba_id,
        verify_token_len: c.verify_token ? c.verify_token.length : 0,
        access_token_len: c.access_token ? c.access_token.length : 0,
        user_id: c.user_id,
        created_at: c.created_at
      });
    });
  }

  // Check messages
  const { data: messages, error: msgError } = await supabase
    .from('messages')
    .select('id, sender_type, content_type, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (msgError) {
    console.error("Error reading messages:", msgError);
  } else {
    console.log("Recent messages:", messages);
  }
}

check();
