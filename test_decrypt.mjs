import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import crypto from 'crypto';

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

// Decrypt function from encryption.ts
function decrypt(ciphertextWithIvAndTag) {
  const keyHex = env.ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error('Invalid ENCRYPTION_KEY. Must be 64 hex characters (32 bytes).');
  }
  const key = Buffer.from(keyHex, 'hex');

  // Check format: should be IV_hex:ciphertext_hex:tag_hex
  const parts = ciphertextWithIvAndTag.split(':');
  if (parts.length !== 3) {
    throw new Error('Ciphertext format invalid. Expected IV:ciphertext:tag');
  }

  const [ivHex, ciphertextHex, tagHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(ciphertext, undefined, 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

async function test() {
  const { data: configs, error } = await supabase.from('whatsapp_config').select('*');
  if (error) {
    console.error("Error fetching configs:", error);
    return;
  }
  
  console.log("Found", configs.length, "configs. Testing decryption...");
  for (const c of configs) {
    console.log(`\nConfig ID: ${c.id}`);
    console.log(`User ID: ${c.user_id}`);
    console.log(`Phone Number ID: ${c.phone_number_id}`);
    
    try {
      const decryptedToken = decrypt(c.access_token);
      console.log("✅ Access token decrypted successfully! Starts with:", decryptedToken.substring(0, 15) + "...");
    } catch (e) {
      console.error("❌ Failed to decrypt access token:", e.message);
    }
    
    try {
      const decryptedVerify = decrypt(c.verify_token);
      console.log("✅ Verify token decrypted successfully! Value:", decryptedVerify);
    } catch (e) {
      console.error("❌ Failed to decrypt verify token:", e.message);
    }
  }
}

test();
