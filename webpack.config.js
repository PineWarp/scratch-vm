const defaultsDeep = require('lodash.defaultsdeep');
const path = require('path');

const base = {
    mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    devServer: {
        contentBase: false,
        host: '0.0.0.0',
        port: process.env.PORT || 8073
    },
    devtool: 'cheap-module-source-map',
    output: {
        library: 'VirtualMachine',
        filename: '[name].js'
    },
    module: {
        rules: [{
            test: /\.(js|mjs)$/,
            loader: 'babel-loader',
            include: [
                path.resolve(__dirname, 'src'),
                // rotur-sdk 的 dist/index.mjs 使用了 class fields 语法，
                // webpack 4 无法直接解析，需要交给 babel 转译
                path.resolve(__dirname, 'node_modules', 'rotur-sdk')
            ],
            query: {
                presets: [['@babel/preset-env']]
            }
        },
        {
            test: /\.mp3$/,
            loader: 'file-loader',
            options: {
                outputPath: 'media/music/'
            }
        }]
    },
    plugins: []
};

module.exports = [
    // Web-compatible
    defaultsDeep({}, base, {
        target: 'web',
        entry: {
            'scratch-vm': './src/index.js',
            'scratch-vm.min': './src/index.js'
        },
        output: {
            libraryTarget: 'umd',
            path: path.resolve('dist', 'web')
        },
        module: {
            rules: base.module.rules.concat([
                {
                    test: require.resolve('./src/index.js'),
                    loader: 'expose-loader?VirtualMachine'
                }
            ])
        }
    }),
    // Node-compatible
    defaultsDeep({}, base, {
        target: 'node',
        entry: {
            'scratch-vm': './src/index.js'
        },
        output: {
            libraryTarget: 'commonjs2',
            path: path.resolve('dist', 'node')
        },
        externals: {
            'decode-html': true,
            'format-message': true,
            'htmlparser2': true,
            'scratch-parser': true,
            'socket.io-client': true,
            'text-encoding': true
        }
    })
];
