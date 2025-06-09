
interface TestInterface {
  name: string;
  value: number;
}

const testData: TestInterface = {
  name: "Test",
  value: "not a number" // Type error
};

export { testData };
