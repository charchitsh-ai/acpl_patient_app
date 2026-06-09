const fs = require('fs');
const readline = require('readline');
const path = require('path');

const logPath = 'C:\\Users\\hp\\.gemini\\antigravity\\brain\\4db0fa0f-8025-4831-a494-8850bc69f7cc\\.system_generated\\logs\\transcript.jsonl';

async function run() {
  const fileStream = fs.createReadStream(logPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (line.includes('ENCRYPTION_KEY') && line.includes('NEXT_PUBLIC_SUPABASE_URL')) {
      const data = JSON.parse(line);
      console.log('\n--- FOUND FULL LINE ---');
      if (data.tool_calls) {
        console.log(JSON.stringify(data.tool_calls, null, 2));
      } else {
        console.log(JSON.stringify(data, null, 2));
      }
    }
  }
}

run();
