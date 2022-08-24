module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@mini-zsm-vue/(.*?)$': '<rootDir>/packages/$1/src'
  }
}
