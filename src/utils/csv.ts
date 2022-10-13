const fs = require('fs');
const parse = require('csv-parse/lib/sync');
const stringify = require('csv-stringify');

export const loadCSV = (path) => {
  const input = fs.readFileSync(path, {
    encoding: 'utf-8',
  });

  const content = parse(input, {
    columns: true,
    skip_empty_lines: true,
  });
  return content;
};

export const saveCSV = (content, headers, path) => {
  // content : [ [col1, col2, col3], [col1, col2, col3] ... ]
  // headers : [ 'colname1', 'colname2', 'colname2' ]
  return stringify(
    content,
    {
      header: true,
      columns: headers,
    },
    (err, output) => {
      if (err) console.log(err);
      fs.writeFile(path, output, (err) => {
        if (err) throw err;
        console.log(`csv ${path} saved.`);
      });
    }
  );
};
