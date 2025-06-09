// Sample JavaScript file with intentional issues for testing

var unusedVariable = 42

function badFunction() {
  console.log("Using double quotes")
    const x = 1
    const y = 2
  return x + y;
}

// Missing semicolon
const arrowFunc = () => {
  debugger // debugger statement
  return "test"
}

// Indentation issues
  if (true) {
console.log('mixed indentation');
   }

export default badFunction