const fs = require('fs'); 
let code = fs.readFileSync('frontend/src/pages/ObligationDetail.tsx', 'utf8'); 
code = code.replace(/\.toLocaleDateString\(\)/g, " .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) ");
code = code.replace(/\.toLocaleString\(\)/g, " .toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) ");
fs.writeFileSync('frontend/src/pages/ObligationDetail.tsx', code);
