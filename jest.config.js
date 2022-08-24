module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@mini-jackz-vue/(.*?)$': '<rootDir>/packages/$1/src'
  }
}
