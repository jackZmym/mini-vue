module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@mini-vue/(.*?)$': '<rootDir>/packages/$1/src'
  }
}
