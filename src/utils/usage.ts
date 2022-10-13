import * as pkg from '../../package.json';
const printVersion = () => {
  console.log('Name: ', pkg.name);
  console.log('Version: ', pkg.version);
};

const error = (message: string) => {
  if (!message.endsWith('\n')) {
    message = message + '\n';
  }
  process.stderr.write(message);
};

export const printUsage = (msg = '') => {
  error(`${msg ? msg + '\n\n' : ''}Usage: node index.js [Network][Task][...Args]
  --------
  Network:    [main|test|main-standby|test-standby]
  Task:       [pos|pow|metric|scriptengine]`);
  process.exit(-1);
};

if (process.argv.length < 4) {
  if (process.argv.length >= 3 && process.argv[2] === 'version') {
    printVersion();
    process.exit(0);
  }
  printUsage();
  process.exit(-1);
}
