const fs = require('fs');

const path = 'c:\\Users\\matbo\\.gemini\\antigravity\\scratch\\retirement_planner\\mobil\\style.css';
const content = fs.readFileSync(path, 'utf8');

let balance = 0;
let lineNum = 1;
let colNum = 0;

for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '\n') {
        lineNum++;
        colNum = 0;
    } else {
        colNum++;
    }

    if (char === '{') {
        balance++;
    } else if (char === '}') {
        balance--;
        if (balance < 0) {
            console.log(`Extra closing brace at Line ${lineNum}, Col ${colNum}`);
        }
    }
}

console.log(`Final balance: ${balance}`);
if (balance > 0) {
    console.log(`Missing ${balance} closing brace(s)`);
} else if (balance < 0) {
    console.log(`Extra ${-balance} closing brace(s)`);
} else {
    console.log('Braces are balanced!');
}
