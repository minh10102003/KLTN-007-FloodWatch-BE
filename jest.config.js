/** @type {import('jest').Config} */
module.exports = {
    projects: [
        {
            displayName: 'node',
            testEnvironment: 'node',
            roots: ['<rootDir>/tests'],
            testMatch: ['**/*.test.js']
        },
        {
            displayName: 'admin-ui',
            testEnvironment: 'jsdom',
            roots: ['<rootDir>/admin-ui'],
            testMatch: ['**/*.test.jsx'],
            transform: {
                '^.+\\.jsx$': 'babel-jest'
            }
        }
    ],
    verbose: true
};
