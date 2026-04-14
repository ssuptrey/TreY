const fs = require('fs'); 
const files = [
  'frontend/src/pages/Dashboard.tsx',
  'frontend/src/pages/MyTasks.tsx',
  'frontend/src/pages/EvidenceWall.tsx',
  'frontend/src/pages/IngestionCenter.tsx',
  'frontend/src/pages/UnifiedInbox.tsx',
  'frontend/src/pages/Obligations.tsx'
];
for (const file of files) {
  if (fs.existsSync(file)) {
    let code = fs.readFileSync(file, 'utf8'); 
    code = code.replace(/\.toLocaleDateString\(\)/g, " .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) ");
    code = code.replace(/\.toLocaleString\(\)/g, " .toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) ");
    fs.writeFileSync(file, code);
  }
}
