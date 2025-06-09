
// Test file for watcher - updated
const message = 'Updated version';
console.log(message);

function testFunction() {
  // Added comment
  return message.toUpperCase();
}

const unusedVar = 42; // This will trigger a warning

export { testFunction };
