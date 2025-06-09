// Unformatted JavaScript file for testing Prettier

const obj = {
  name: 'test',
  age: 25,
  address: '123 Main St',
};

function doSomething(a, b, c) {
  console.log('Using double quotes');
  return a + b + c;
}

const arr = [1, 2, 3, 4, 5];

const longFunction = (param1, param2, param3, param4, param5) => {
  return param1 + param2 + param3 + param4 + param5;
};

if (true) {
  console.log('test');
} else {
  console.log('other');
}

export { doSomething, arr, longFunction };
