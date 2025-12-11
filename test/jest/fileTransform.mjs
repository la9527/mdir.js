import path from "path";

// This is a custom Jest transformer turning file imports into filenames.
// http://facebook.github.io/jest/docs/en/webpack.html

const assetTransformer = {
  process(_src, filename) {
    const assetFilename = JSON.stringify(path.basename(filename));
    return `export default ${assetFilename};`;
  }
};

export default assetTransformer;
