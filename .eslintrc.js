module.exports = {
    "env": {
        "browser": true,
        "node": true,
        "jest": true,
        "jest/globals": true
    },
    "extends": [ 
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended"
    ],
    "plugins": [
        "@typescript-eslint",
        "jest"
    ],
    "parser": "@typescript-eslint/parser",
    "parserOptions": {
        "project": require('path').resolve(__dirname, "./tsconfig.json"),
        "tsconfigRootDir": __dirname,
        "sourceType": "module",
        "ecmaVersion": 2019,
        "ecmaFeatures": {
            "jsx": true
        }
    },
    "settings": {
        
    },
    "rules": {
        "prefer-const": "warn",
        "no-useless-escape": "off",
        "no-extra-boolean-cast": "warn",
        "no-empty": "warn",
        "no-unused-vars": "off",
        "@typescript-eslint/naming-convention": [
            "error",
            {
              "selector": "class",
              "format": ["PascalCase"],
              "filter": {
                // you can expand this regex to add more allowed names
                "regex": "^(Property-Name-One|Property-Name-Two)$",
                "match": false
              }
            }
        ],
        "@typescript-eslint/no-unused-vars": [ 
            "warn", 
            { 
                "vars": "local", 
                "caughtErrors": "none", 
                "argsIgnorePattern": "^_" 
            }
        ],
        "@typescript-eslint/explicit-function-return-type": "off",
        "@typescript-eslint/explicit-module-boundary-types": "off",
        "@typescript-eslint/no-inferrable-types": "off",
        "@typescript-eslint/adjacent-overload-signatures": "error",
        "@typescript-eslint/array-type": "error",
        "@typescript-eslint/ban-types": "error",
        "@typescript-eslint/camelcase": "off",
        "@typescript-eslint/consistent-type-assertions": "error",
        "@typescript-eslint/consistent-type-definitions": "error",
        "@typescript-eslint/explicit-member-accessibility": [
            "off",
            {
                "accessibility": "explicit"
            }
        ],
        "@typescript-eslint/indent": [
            "warn",
            4,
            {
                "ObjectExpression": "first",
                "FunctionDeclaration": {
                    "parameters": "first"
                },
                "FunctionExpression": {
                    "parameters": "first"
                },
                "SwitchCase": 1
            }
        ],
        "@typescript-eslint/interface-name-prefix": "off",
        "@typescript-eslint/member-delimiter-style": [
            "error",
            {
                "multiline": {
                    "delimiter": "semi",
                    "requireLast": true
                },
                "singleline": {
                    "delimiter": "semi",
                    "requireLast": false
                }
            }
        ],
        "@typescript-eslint/member-ordering": "off",
        "@typescript-eslint/no-empty-function": "warn",
        "@typescript-eslint/no-empty-interface": "error",
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-misused-new": "error",
        "@typescript-eslint/no-namespace": "error",
        "@typescript-eslint/no-non-null-assertion": "off",
        "@typescript-eslint/no-parameter-properties": "off",
        "@typescript-eslint/no-this-alias": "off",
        "@typescript-eslint/no-unnecessary-type-assertion": "off",
        "@typescript-eslint/no-use-before-define": "off",
        "@typescript-eslint/no-var-requires": "error",
        "@typescript-eslint/prefer-for-of": "error",
        "@typescript-eslint/prefer-function-type": "error",
        "@typescript-eslint/prefer-namespace-keyword": "error",
        "@typescript-eslint/quotes": [
            "error",
            "double",
            {
                "avoidEscape": true
            }
        ],
        "@typescript-eslint/semi": [
            "error",
            "always"
        ],
        "@typescript-eslint/space-within-parens": [
            "off",
            "never"
        ],
        "@typescript-eslint/triple-slash-reference": "off",
        "@typescript-eslint/type-annotation-spacing": "warn",
        "@typescript-eslint/unified-signatures": "error",
    }
};
