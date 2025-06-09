// TypeScript file with various issues for testing

interface User {
  name: string;
  age: number;
  email?: string;
}

// Unused variable
const unusedUser: User = {
  name: "Test",
  age: 25
};

// Type error - wrong type
function greetUser(user: User): string {
  // Implicit any
  const greeting = (prefix) => {
    return prefix + user.name;
  };
  
  // Possibly undefined access
  console.log(user.email.length);
  
  // Missing return in some code paths
  if (user.age > 18) {
    return greeting("Hello, ");
  }
  // No return here!
}

// Unused parameter
function processData(data: any[], unused: boolean): void {
  // Using any type
  data.forEach(item => {
    console.log(item.value); // Unsafe access
  });
}

// Incorrect types
const numberValue: number = "not a number";

// Non-null assertion on possibly null
function riskyFunction(input: string | null) {
  return input!.toUpperCase();
}

// Fall-through in switch
function handleAction(action: string) {
  switch (action) {
    case "start":
      console.log("Starting...");
      // Missing break - fall through
    case "stop":
      console.log("Stopping...");
      break;
    default:
      console.log("Unknown action");
  }
}

// Export to avoid module error
export { greetUser, processData };