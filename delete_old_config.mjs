import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

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

async function deleteOld() {
  console.log("Deleting old duplicate whatsapp_config...");
  
  const { data, error } = await supabase
    .from('whatsapp_config')
    .delete()
    .eq('id', 'b8e632e6-244d-4ba3-8a7e-66e52f8acb82')
    .select();
    
  if (error) {
    console.error("Error deleting old config:", error);
  } else {
    console.log("Deleted old config successfully:", data);
  }
}

deleteOld();
